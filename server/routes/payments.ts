import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { createPixPayment, createCardPayment, getPaymentStatus, isConfigured } from "../services/mercadopago-service";
import { confirmPaymentAtomic } from "../services/registration-service";

const router = Router();

router.get("/config", async (req, res) => {
  try {
    const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY;
    
    return res.json({
      success: true,
      data: {
        publicKey: publicKey || null,
        configured: isConfigured() && !!publicKey
      }
    });
  } catch (error) {
    console.error("[payments] Erro ao obter configuração:", error);
    return res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

const createPaymentSchema = z.object({
  orderId: z.string().uuid(),
  paymentMethod: z.enum(["pix", "credit_card"]),
  cardToken: z.string().optional(),
  installments: z.number().min(1).max(12).optional().default(1),
  paymentMethodId: z.string().optional(),
  issuerId: z.string().optional(),
  payerIdentification: z.object({
    type: z.string(),
    number: z.string()
  }).optional(),
  cardholderName: z.string().optional(),
  deviceId: z.string().optional()
});

router.post("/create", async (req, res) => {
  try {
    const athleteId = (req.session as any)?.athleteId;
    if (!athleteId) {
      return res.status(401).json({ success: false, error: "Não autenticado" });
    }

    if (!isConfigured()) {
      return res.status(503).json({ 
        success: false, 
        error: "Sistema de pagamento não configurado. Por favor, tente novamente mais tarde." 
      });
    }

    const parsed = createPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Dados inválidos",
        details: parsed.error.flatten() 
      });
    }

    const { orderId, paymentMethod, cardToken, installments, paymentMethodId, issuerId, payerIdentification, cardholderName, deviceId } = parsed.data;

    const order = await storage.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Pedido não encontrado" });
    }

    if (order.compradorId !== athleteId) {
      return res.status(403).json({ success: false, error: "Acesso não autorizado" });
    }

    if (order.status !== "pendente") {
      return res.status(400).json({ 
        success: false, 
        error: order.status === "pago" 
          ? "Este pedido já foi pago" 
          : "Este pedido não está disponível para pagamento"
      });
    }

    // Verificar expiração do pedido
    // REGRA: Se existe PIX válido, o pedido está válido (mesmo se dataExpiracao original passou)
    // REGRA: Se não existe PIX e método é PIX, permitir criar (vai estabelecer novo deadline)
    // REGRA: Se não existe PIX e método é cartão, verificar dataExpiracao normal
    if (order.dataExpiracao) {
      const expirationDate = new Date(order.dataExpiracao);
      const now = new Date();
      
      if (now >= expirationDate) {
        // Verificar se existe PIX válido que pode ser reutilizado
        const hasValidPix = order.pixExpiracao && new Date(order.pixExpiracao) > now;
        
        if (hasValidPix) {
          // PIX válido - permitir continuar
          console.log(`[payments] Pedido ${order.id} expirado mas tem PIX válido - permitindo`);
        } else if (paymentMethod === "pix") {
          // Não tem PIX, mas vai criar um novo - permitir (vai estabelecer novo deadline)
          console.log(`[payments] Pedido ${order.id} expirado, criando novo PIX com novo deadline`);
        } else {
          // Pedido expirado, sem PIX válido, e não está criando PIX - bloquear
          return res.status(400).json({ 
            success: false, 
            error: "Tempo de pagamento expirado. Por favor, faça uma nova inscrição.",
            errorCode: "ORDER_EXPIRED"
          });
        }
      }
    }

    const event = await storage.getEvent(order.eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: "Evento não encontrado" });
    }

    const athlete = await storage.getAthlete(athleteId);
    if (!athlete) {
      return res.status(404).json({ success: false, error: "Atleta não encontrado" });
    }

    const amount = parseFloat(order.valorTotal);
    const description = `Pedido #${order.numeroPedido} - Inscrição - ${event.nome}`;
    const externalReference = `order_${order.id}`;

    if (paymentMethod === "pix") {
      // Verificar se já existe um PIX válido para este pedido
      // IMPORTANTE: Usar APENAS pixPaymentId (campo dedicado) para reutilização
      // NÃO usar idPagamentoGateway pois pode ter sido sobrescrito por tentativa de cartão
      const pixPaymentId = order.pixPaymentId; // Removido fallback para idPagamentoGateway
      console.log(`[payments] Verificando PIX existente para pedido ${order.id}: pixPaymentId=${pixPaymentId}, pixExpiracao=${order.pixExpiracao}`);
      if (order.pixQrCode && order.pixQrCodeBase64 && order.pixExpiracao && pixPaymentId) {
        const pixExpiration = new Date(order.pixExpiracao);
        const now = new Date();
        
        // Se o PIX ainda não expirou, reutilizar o código existente
        if (pixExpiration > now) {
          console.log(`[payments] Reutilizando PIX existente para pedido ${order.id} (pixPaymentId: ${pixPaymentId})`);
          
          // IMPORTANTE: Restaurar idPagamentoGateway para apontar para o PIX
          // Isso garante que outros componentes (job de expiração, polling) funcionem corretamente
          await storage.updateOrderPaymentId(order.id, pixPaymentId, "pix");
          
          return res.json({
            success: true,
            data: {
              paymentId: pixPaymentId,
              status: "pending",
              qrCode: order.pixQrCode,
              qrCodeBase64: order.pixQrCodeBase64,
              expirationDate: order.pixExpiracao,
              orderId: order.id,
              dataExpiracao: order.pixExpiracao, // Usar a expiração do PIX
              reutilizado: true
            }
          });
        } else {
          console.log(`[payments] PIX anterior expirado para pedido ${order.id}, criando novo`);
        }
      }

      const result = await createPixPayment(
        order.id,
        amount,
        description,
        athlete.email,
        athlete.nome,
        externalReference
      );

      if (!result.success) {
        return res.status(500).json({ 
          success: false, 
          error: result.error || "Erro ao criar pagamento PIX" 
        });
      }

      console.log(`[payments] Novo PIX criado para pedido ${order.id}: paymentId=${result.paymentId}, hasQrCode=${!!result.qrCode}, hasQrCodeBase64=${!!result.qrCodeBase64}, expirationDate=${result.expirationDate}`);
      
      // Primeiro salvar os dados do PIX (QR code, etc.) - isso deve acontecer ANTES de updateOrderPaymentId
      // para garantir que os dados sejam salvos mesmo se houver conflito de ID
      let newOrderExpiration: Date | null = order.dataExpiracao;
      if (result.qrCode && result.qrCodeBase64 && result.expirationDate) {
        const pixExpirationDate = new Date(result.expirationDate);
        
        try {
          // Sincronizar a expiração do pedido com a expiração do PIX
          // O pedido não deve expirar antes do PIX
          await storage.updateOrderPixData(order.id, {
            qrCode: result.qrCode,
            qrCodeBase64: result.qrCodeBase64,
            expiracao: pixExpirationDate,
            paymentId: result.paymentId // Salvar o ID do PIX separadamente no campo pixPaymentId
          });
          console.log(`[payments] PIX dados salvos para pedido ${order.id}: pixPaymentId=${result.paymentId}`);
          
          // Atualizar a dataExpiracao do pedido para coincidir com o PIX
          newOrderExpiration = pixExpirationDate;
          await storage.updateOrder(order.id, { 
            dataExpiracao: pixExpirationDate 
          });
          
          console.log(`[payments] PIX criado para pedido ${order.id}. Expiração sincronizada: ${result.expirationDate}`);
        } catch (pixDataError) {
          console.error(`[payments] Erro ao salvar dados do PIX para pedido ${order.id}:`, pixDataError);
        }
      } else {
        console.warn(`[payments] PIX criado mas sem dados completos para pedido ${order.id}: qrCode=${!!result.qrCode}, qrCodeBase64=${!!result.qrCodeBase64}, expirationDate=${result.expirationDate}`);
      }
      
      // Depois tentar atualizar o idPagamentoGateway (pode falhar se ID já existe em outro pedido)
      await storage.updateOrderPaymentId(order.id, result.paymentId!, "pix");

      return res.json({
        success: true,
        data: {
          paymentId: result.paymentId,
          status: result.status,
          qrCode: result.qrCode,
          qrCodeBase64: result.qrCodeBase64,
          expirationDate: result.expirationDate,
          orderId: order.id,
          dataExpiracao: newOrderExpiration,
          reutilizado: false
        }
      });
    } else if (paymentMethod === "credit_card") {
      if (!cardToken || !paymentMethodId) {
        return res.status(400).json({ 
          success: false, 
          error: "Token do cartão e método de pagamento são obrigatórios" 
        });
      }

      // Limpar CPF removendo caracteres não numéricos antes de enviar ao Mercado Pago
      const cleanedPayerIdentification = payerIdentification ? {
        type: payerIdentification.type,
        number: payerIdentification.number.replace(/\D/g, "")
      } : undefined;

      // Capturar IP do cliente para prevenção de fraude
      const clientIp = req.headers['x-forwarded-for'] 
        ? (req.headers['x-forwarded-for'] as string).split(',')[0].trim()
        : req.socket.remoteAddress || undefined;

      // Extrair telefone do atleta (formato: (XX) XXXXX-XXXX ou similar)
      const phoneDigits = athlete.telefone?.replace(/\D/g, "") || "";
      const payerPhone = phoneDigits.length >= 10 ? {
        areaCode: phoneDigits.substring(0, 2),
        number: phoneDigits.substring(2)
      } : undefined;

      // Extrair endereço do atleta
      const payerAddress = athlete.cep ? {
        zipCode: athlete.cep,
        streetName: athlete.rua || undefined,
        streetNumber: athlete.numero || undefined,
        neighborhood: undefined,
        city: athlete.cidade || undefined,
        federalUnit: athlete.estado || undefined
      } : undefined;

      const result = await createCardPayment(
        order.id,
        amount,
        cardToken,
        installments || 1,
        athlete.email,
        paymentMethodId,
        issuerId || "",
        externalReference,
        cleanedPayerIdentification,
        cardholderName,
        description,
        clientIp,
        payerPhone,
        payerAddress,
        deviceId
      );

      if (!result.success) {
        return res.status(500).json({ 
          success: false, 
          error: result.error || "Erro ao processar pagamento com cartão" 
        });
      }

      await storage.updateOrderPaymentId(order.id, result.paymentId!, "credit_card");

      if (result.status === "approved") {
        const confirmResult = await confirmPaymentAtomic(order.id, "credit_card");
        if (!confirmResult.success) {
          console.error("[payments] Erro ao confirmar pagamento:", confirmResult.error);
          return res.status(500).json({ 
            success: false, 
            error: confirmResult.error || "Erro ao confirmar pagamento",
            errorCode: confirmResult.errorCode
          });
        }
      }

      return res.json({
        success: true,
        data: {
          paymentId: result.paymentId,
          status: result.status,
          statusDetail: result.statusDetail,
          orderId: order.id
        }
      });
    }

    return res.status(400).json({ success: false, error: "Método de pagamento inválido" });
  } catch (error) {
    console.error("[payments] Erro ao criar pagamento:", error);
    return res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.get("/order/:orderId", async (req, res) => {
  try {
    const athleteId = (req.session as any)?.athleteId;
    if (!athleteId) {
      return res.status(401).json({ success: false, error: "Não autenticado" });
    }

    const { orderId } = req.params;
    const order = await storage.getOrder(orderId);

    if (!order) {
      return res.status(404).json({ success: false, error: "Pedido não encontrado" });
    }

    if (order.compradorId !== athleteId) {
      return res.status(403).json({ success: false, error: "Acesso não autorizado" });
    }

    const [registrations, event, athlete] = await Promise.all([
      storage.getRegistrationsByOrder(orderId),
      storage.getEvent(order.eventId),
      storage.getAthlete(order.compradorId)
    ]);

    const registrationsWithDetails = await Promise.all(
      registrations.map(async (reg) => {
        const [modality, participantAthlete] = await Promise.all([
          storage.getModality(reg.modalityId),
          storage.getAthlete(reg.athleteId)
        ]);
        return {
          id: reg.id,
          numeroInscricao: reg.numeroInscricao,
          status: reg.status,
          tamanhoCamisa: reg.tamanhoCamisa,
          equipe: reg.equipe,
          valorUnitario: parseFloat(reg.valorUnitario),
          taxaComodidade: parseFloat(reg.taxaComodidade),
          dataInscricao: reg.dataInscricao,
          participanteNome: reg.nomeCompleto || participantAthlete?.nome || "Participante",
          participanteCpf: reg.cpf || participantAthlete?.cpf,
          modalidade: modality ? {
            id: modality.id,
            nome: modality.nome,
            distancia: modality.distancia,
            unidadeDistancia: modality.unidadeDistancia
          } : null
        };
      })
    );

    const now = new Date();
    const pixExpired = order.pixExpiracao ? new Date(order.pixExpiracao) <= now : true;
    const orderExpired = order.dataExpiracao ? new Date(order.dataExpiracao) <= now : false;

    // Verificar status do último pagamento se existir
    let lastPaymentStatus: string | null = null;
    let lastPaymentStatusDetail: string | null = null;
    
    if (order.idPagamentoGateway && order.status === "pendente") {
      try {
        const { getPaymentStatus } = await import("../services/mercadopago-service");
        const paymentResult = await getPaymentStatus(order.idPagamentoGateway);
        if (paymentResult.success) {
          lastPaymentStatus = paymentResult.status || null;
          lastPaymentStatusDetail = paymentResult.statusDetail || null;
        }
      } catch (e) {
        console.log("[payments] Erro ao buscar status do pagamento:", e);
      }
    }

    // Calcular subtotal e taxa total
    const subtotal = registrationsWithDetails.reduce((acc, r) => acc + r.valorUnitario, 0);
    const taxaTotal = registrationsWithDetails.reduce((acc, r) => acc + r.taxaComodidade, 0);

    return res.json({
      success: true,
      data: {
        id: order.id,
        numeroPedido: order.numeroPedido,
        status: order.status,
        valorTotal: parseFloat(order.valorTotal),
        valorDesconto: parseFloat(order.valorDesconto),
        subtotal,
        taxaTotal,
        codigoVoucher: order.codigoVoucher,
        codigoCupom: order.codigoCupom,
        metodoPagamento: order.metodoPagamento,
        dataPedido: order.dataPedido,
        dataPagamento: order.dataPagamento,
        dataExpiracao: order.dataExpiracao,
        pixQrCode: !pixExpired ? order.pixQrCode : null,
        pixQrCodeBase64: !pixExpired ? order.pixQrCodeBase64 : null,
        pixExpiracao: order.pixExpiracao,
        pixDataGeracao: order.pixDataGeracao,
        pixExpired,
        orderExpired,
        lastPaymentStatus,
        lastPaymentStatusDetail,
        evento: event ? {
          id: event.id,
          nome: event.nome,
          slug: event.slug,
          dataEvento: event.dataEvento,
          cidade: event.cidade,
          estado: event.estado,
          bannerUrl: event.bannerUrl
        } : null,
        comprador: athlete ? {
          id: athlete.id,
          nome: athlete.nome,
          email: athlete.email
        } : null,
        inscricoes: registrationsWithDetails
      }
    });
  } catch (error) {
    console.error("[payments] Erro ao buscar pedido:", error);
    return res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.post("/change-method/:orderId", async (req, res) => {
  try {
    const athleteId = (req.session as any)?.athleteId;
    if (!athleteId) {
      return res.status(401).json({ success: false, error: "Não autenticado" });
    }

    const { orderId } = req.params;
    const order = await storage.getOrder(orderId);

    if (!order) {
      return res.status(404).json({ success: false, error: "Pedido não encontrado" });
    }

    if (order.compradorId !== athleteId) {
      return res.status(403).json({ success: false, error: "Acesso não autorizado" });
    }

    if (order.status !== "pendente") {
      return res.status(400).json({ 
        success: false, 
        error: "Só é possível trocar método de pagamento para pedidos pendentes"
      });
    }

    // Verificar se existe PIX válido - se sim, verificar pela expiração do PIX
    const now = new Date();
    const hasValidPix = order.pixExpiracao && new Date(order.pixExpiracao) > now;
    
    // Se tem PIX válido, usar a expiração do PIX; senão, usar a expiração do pedido
    const effectiveExpiration = hasValidPix ? order.pixExpiracao : order.dataExpiracao;
    if (effectiveExpiration && new Date(effectiveExpiration) <= now) {
      return res.status(400).json({ 
        success: false, 
        error: "O prazo para pagamento deste pedido expirou"
      });
    }

    // NÃO limpar dados do PIX - apenas limpar o método de pagamento atual
    // Isso permite reutilizar o PIX se o usuário voltar a escolhê-lo
    await storage.updateOrder(orderId, { metodoPagamento: null });

    // Verificar se há PIX válido para informar ao frontend
    const pixStillValid = order.pixExpiracao && new Date(order.pixExpiracao) > now;

    return res.json({
      success: true,
      message: "Método de pagamento limpo. Você pode escolher um novo método.",
      hasValidPix: pixStillValid,
      pixExpiracao: pixStillValid ? order.pixExpiracao : null
    });
  } catch (error) {
    console.error("[payments] Erro ao trocar método:", error);
    return res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.get("/status/:orderId", async (req, res) => {
  try {
    const athleteId = (req.session as any)?.athleteId;
    if (!athleteId) {
      return res.status(401).json({ success: false, error: "Não autenticado" });
    }

    const { orderId } = req.params;
    const order = await storage.getOrder(orderId);

    if (!order) {
      return res.status(404).json({ success: false, error: "Pedido não encontrado" });
    }

    if (order.compradorId !== athleteId) {
      return res.status(403).json({ success: false, error: "Acesso não autorizado" });
    }

    if (!order.idPagamentoGateway) {
      return res.json({
        success: true,
        data: {
          orderId: order.id,
          orderStatus: order.status,
          paymentCreated: false
        }
      });
    }

    if (!isConfigured()) {
      return res.json({
        success: true,
        data: {
          orderId: order.id,
          orderStatus: order.status,
          paymentCreated: true,
          paymentId: order.idPagamentoGateway
        }
      });
    }

    // Verificar pagamento atual
    let result = await getPaymentStatus(order.idPagamentoGateway);
    let paymentApproved = result.success && result.status === "approved";
    let approvedPaymentId = order.idPagamentoGateway;
    let approvedPaymentMethod = order.metodoPagamento || "pix";
    
    // Se não está aprovado, verificar PIX separado (pode ter sido substituído por cartão)
    if (!paymentApproved && order.pixPaymentId && order.pixPaymentId !== order.idPagamentoGateway) {
      console.log(`[payments] Verificando PIX alternativo ${order.pixPaymentId} para pedido ${order.id}`);
      const pixResult = await getPaymentStatus(order.pixPaymentId);
      
      if (pixResult.success && pixResult.status === "approved") {
        result = pixResult;
        paymentApproved = true;
        approvedPaymentId = order.pixPaymentId;
        approvedPaymentMethod = "pix";
        // Atualizar o idPagamentoGateway para o PIX que foi pago
        await storage.updateOrder(order.id, { idPagamentoGateway: order.pixPaymentId });
        console.log(`[payments] PIX ${order.pixPaymentId} aprovado! Atualizando pedido ${order.id}`);
      }
    }

    if (paymentApproved && order.status === "pendente") {
      const confirmResult = await confirmPaymentAtomic(order.id, approvedPaymentMethod);
      if (!confirmResult.success) {
        console.error("[payments] Erro ao confirmar pagamento via status check:", confirmResult.error);
      } else {
        // Recarregar pedido para retornar status atualizado
        const updatedOrder = await storage.getOrder(orderId);
        return res.json({
          success: true,
          data: {
            orderId: order.id,
            orderStatus: updatedOrder?.status || "confirmado",
            paymentCreated: true,
            paymentId: approvedPaymentId,
            paymentStatus: result.status,
            paymentStatusDetail: result.statusDetail,
            confirmed: true
          }
        });
      }
    }

    return res.json({
      success: true,
      data: {
        orderId: order.id,
        orderStatus: order.status,
        paymentCreated: true,
        paymentId: order.idPagamentoGateway,
        paymentStatus: result.status,
        paymentStatusDetail: result.statusDetail
      }
    });
  } catch (error) {
    console.error("[payments] Erro ao consultar status:", error);
    return res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.post("/confirm-free", async (req, res) => {
  try {
    const athleteId = (req.session as any)?.athleteId;
    if (!athleteId) {
      return res.status(401).json({ success: false, error: "Não autenticado" });
    }

    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: "ID do pedido é obrigatório" });
    }

    const order = await storage.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Pedido não encontrado" });
    }

    if (order.compradorId !== athleteId) {
      return res.status(403).json({ success: false, error: "Acesso não autorizado" });
    }

    if (order.status !== "pendente") {
      return res.status(400).json({ 
        success: false, 
        error: order.status === "pago" 
          ? "Este pedido já foi confirmado" 
          : "Este pedido não está disponível para confirmação"
      });
    }

    const valorTotal = parseFloat(order.valorTotal);
    if (valorTotal > 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Este pedido requer pagamento. Utilize PIX ou cartão de crédito."
      });
    }

    if (order.dataExpiracao) {
      const expirationDate = new Date(order.dataExpiracao);
      if (new Date() >= expirationDate) {
        return res.status(400).json({ 
          success: false, 
          error: "Tempo de pagamento expirado. Por favor, faça uma nova inscrição.",
          errorCode: "ORDER_EXPIRED"
        });
      }
    }

    const confirmResult = await confirmPaymentAtomic(order.id, "free");
    
    if (!confirmResult.success) {
      return res.status(500).json({ 
        success: false, 
        error: confirmResult.error || "Erro ao confirmar inscrição gratuita",
        errorCode: confirmResult.errorCode
      });
    }

    const registrations = await storage.getRegistrationsByOrder(order.id);

    return res.json({
      success: true,
      data: {
        orderId: order.id,
        status: "pago",
        message: "Inscrição confirmada com sucesso!",
        registrationId: registrations[0]?.id
      }
    });
  } catch (error) {
    console.error("[payments] Erro ao confirmar pedido gratuito:", error);
    return res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

export default router;
