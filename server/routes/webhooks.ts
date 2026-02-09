import { Router } from "express";
import { storage } from "../storage";
import { getPaymentStatus, validateWebhookSignature } from "../services/mercadopago-service";
import { confirmPaymentAtomic } from "../services/registration-service";

const router = Router();

router.post("/mercadopago", async (req, res) => {
  console.log("[webhook] ========== WEBHOOK RECEBIDO ==========");
  console.log("[webhook] Headers:", JSON.stringify(req.headers, null, 2));
  console.log("[webhook] Body:", JSON.stringify(req.body, null, 2));
  console.log("[webhook] ========================================");
  
  try {
    const xSignature = req.headers['x-signature'] as string | undefined;
    const xRequestId = req.headers['x-request-id'] as string | undefined;
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

    const body = req.body;
    const dataId = body?.data?.id?.toString() || "";
    const notificationType = body?.type || body?.action;

    console.log(`[webhook] Notificação recebida: type=${notificationType}, data.id=${dataId}`);

    if (webhookSecret && !validateWebhookSignature(xSignature, xRequestId, dataId, webhookSecret)) {
      console.warn("[webhook] Assinatura inválida - ignorando webhook");
      return res.status(200).json({ received: true });
    }

    if (notificationType === "payment" || notificationType === "payment.created" || notificationType === "payment.updated") {
      const paymentId = dataId;
      
      if (!paymentId) {
        console.warn("[webhook] Payment ID não encontrado no payload");
        return res.status(200).json({ received: true });
      }

      const paymentResult = await getPaymentStatus(paymentId);
      
      if (!paymentResult.success) {
        console.error(`[webhook] Erro ao consultar pagamento ${paymentId}:`, paymentResult.error);
        return res.status(200).json({ received: true });
      }

      console.log(`[webhook] Status do pagamento ${paymentId}: ${paymentResult.status}`);
      console.log(`[webhook] External reference: ${paymentResult.externalReference}`);

      // Primeiro tenta buscar pelo ID do pagamento
      let order = await storage.getOrdersByPaymentId(paymentId);
      
      // Se não encontrar, usa o external_reference (orderId) como fallback
      if (!order && paymentResult.externalReference) {
        // Remove o prefixo "order_" se existir
        let orderId = paymentResult.externalReference;
        if (orderId.startsWith("order_")) {
          orderId = orderId.replace("order_", "");
        }
        console.log(`[webhook] Buscando pedido pelo external_reference: ${paymentResult.externalReference} -> orderId: ${orderId}`);
        order = await storage.getOrder(orderId);
        
        // PROTEÇÃO: Só atualiza o payment ID se o pedido não tiver um ID diferente já definido
        // Isso evita sobrescrever o ID de um pagamento válido com outro
        if (order) {
          if (!order.idPagamentoGateway || order.idPagamentoGateway === paymentId) {
            console.log(`[webhook] Pedido encontrado via external_reference, atualizando payment ID`);
            await storage.updateOrder(order.id, { idPagamentoGateway: paymentId });
          } else {
            console.warn(`[webhook] Pedido ${order.id} já tem payment ID diferente (${order.idPagamentoGateway}), não sobrescrevendo com ${paymentId}`);
          }
        }
      }

      if (!order) {
        console.warn(`[webhook] Pedido não encontrado para pagamento ${paymentId} (external_ref: ${paymentResult.externalReference})`);
        return res.status(200).json({ received: true });
      }

      if (paymentResult.status === "approved" && order.status === "pendente") {
        const confirmResult = await confirmPaymentAtomic(order.id, order.metodoPagamento || "pix");
        if (confirmResult.success) {
          console.log(`[webhook] Pedido ${order.id} confirmado via webhook`);
        } else {
          console.error(`[webhook] Erro ao confirmar pedido ${order.id}:`, confirmResult.error);
        }
      } else if (paymentResult.status === "rejected" || paymentResult.status === "cancelled") {
        console.log(`[webhook] Pagamento ${paymentId} rejeitado/cancelado - pedido ${order.id} permanece pendente`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[webhook] Erro ao processar webhook:", error);
    return res.status(200).json({ received: true });
  }
});

export default router;
