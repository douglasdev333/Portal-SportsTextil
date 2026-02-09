import { storage } from '../storage';
import { getPaymentStatus, isConfigured } from '../services/mercadopago-service';
import { confirmPaymentAtomic } from '../services/registration-service';

const POLLING_INTERVAL_MS = parseInt(process.env.PAYMENT_POLLING_INTERVAL_MS || '120000', 10);

export async function pollPayments(): Promise<{ processed: number; confirmed: number; errors: number }> {
  if (!isConfigured()) {
    return { processed: 0, confirmed: 0, errors: 0 };
  }

  let processed = 0;
  let confirmed = 0;
  let errors = 0;

  try {
    const pendingOrders = await storage.getPendingOrdersWithPayment();
    
    console.log(`[payment-polling] Verificando ${pendingOrders.length} pedidos pendentes com pagamento criado`);

    for (const order of pendingOrders) {
      processed++;
      
      try {
        // Verificar pagamento atual (idPagamentoGateway)
        let paymentApproved = false;
        let approvedPaymentMethod = order.metodoPagamento || "pix";
        
        if (order.idPagamentoGateway) {
          const result = await getPaymentStatus(order.idPagamentoGateway);
          
          if (result.success) {
            if (result.status === 'approved') {
              paymentApproved = true;
            } else if (result.status === 'rejected' || result.status === 'cancelled') {
              console.log(`[payment-polling] Pagamento ${order.idPagamentoGateway} rejeitado/cancelado - verificando PIX alternativo`);
            }
          }
        }
        
        // Se o pagamento atual não foi aprovado, verificar PIX separado (pode ter sido substituído por cartão)
        if (!paymentApproved && (order as any).pixPaymentId && (order as any).pixPaymentId !== order.idPagamentoGateway) {
          const pixPaymentId = (order as any).pixPaymentId;
          console.log(`[payment-polling] Verificando PIX alternativo ${pixPaymentId} para pedido ${order.id}`);
          
          const pixResult = await getPaymentStatus(pixPaymentId);
          
          if (pixResult.success && pixResult.status === 'approved') {
            paymentApproved = true;
            approvedPaymentMethod = "pix";
            // Atualizar o idPagamentoGateway para o PIX que foi pago
            await storage.updateOrder(order.id, { idPagamentoGateway: pixPaymentId });
            console.log(`[payment-polling] PIX ${pixPaymentId} aprovado! Atualizando pedido ${order.id}`);
          }
        }
        
        if (paymentApproved) {
          const confirmResult = await confirmPaymentAtomic(order.id, approvedPaymentMethod);
          if (confirmResult.success) {
            console.log(`[payment-polling] Pedido ${order.id} confirmado via polling`);
            confirmed++;
          } else {
            console.error(`[payment-polling] Erro ao confirmar pedido ${order.id}:`, confirmResult.error);
            errors++;
          }
        }
      } catch (orderError) {
        console.error(`[payment-polling] Erro ao processar pedido ${order.id}:`, orderError);
        errors++;
      }
    }
  } catch (error) {
    console.error('[payment-polling] Erro geral no job:', error);
    errors++;
  }

  return { processed, confirmed, errors };
}

export function startPaymentPollingJob(): NodeJS.Timeout {
  console.log(`[payment-polling] Iniciando job de polling (intervalo: ${POLLING_INTERVAL_MS}ms)`);
  
  return setInterval(async () => {
    const result = await pollPayments();
    if (result.processed > 0) {
      console.log(`[payment-polling] Resultado: ${result.processed} processados, ${result.confirmed} confirmados, ${result.errors} erros`);
    }
  }, POLLING_INTERVAL_MS);
}
