import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { requireAuth, checkEventOwnership } from "../../middleware/auth";
import { utcToBrazilLocal } from "../../utils/timezone";
import { confirmPaymentAtomic } from "../../services/registration-service";
import { logStatusChange, getStatusHistory } from "../../services/status-log-service";

const router = Router({ mergeParams: true });

const safeNumber = (val: any): number => {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
};

router.get("/:eventId/stats", requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento não encontrado" }
      });
    }

    const hasAccess = await checkEventOwnership(req, res, eventId, event);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Sem permissão para acessar este evento" }
      });
    }

    const [registrations, modalities, orders, batches, shirtSizes, prices] = await Promise.all([
      storage.getRegistrationsByEvent(eventId),
      storage.getModalitiesByEvent(eventId),
      storage.getOrdersByEvent(eventId),
      storage.getBatchesByEvent(eventId),
      storage.getShirtSizesByEvent(eventId),
      storage.getPricesByEvent(eventId)
    ]);

    const confirmedRegistrations = registrations.filter(r => r.status === "confirmada");
    const pendingRegistrations = registrations.filter(r => r.status === "pendente");

    const byModality = modalities.map(mod => {
      const modRegistrations = confirmedRegistrations.filter(r => r.modalityId === mod.id);
      return {
        modalityId: mod.id,
        modalityName: mod.nome,
        total: modRegistrations.length,
        masculino: modRegistrations.filter(r => r.sexo === "masculino").length,
        feminino: modRegistrations.filter(r => r.sexo === "feminino").length,
        limiteVagas: mod.limiteVagas,
        vagasOcupadas: mod.vagasOcupadas,
        vagasDisponiveis: mod.limiteVagas !== null ? mod.limiteVagas - mod.vagasOcupadas : null,
      };
    });

    const paidOrders = orders.filter(o => o.status === "pago");
    const totalDescontos = paidOrders.reduce((sum, o) => sum + safeNumber(o.valorDesconto), 0);
    const totalTaxaComodidade = confirmedRegistrations.reduce((sum, r) => sum + safeNumber(r.taxaComodidade), 0);
    const totalValorInscricoes = confirmedRegistrations.reduce((sum, r) => sum + safeNumber(r.valorUnitario), 0);
    // Valor bruto = valor das inscrições + taxas de comodidade (total arrecadado)
    const totalBruto = totalValorInscricoes + totalTaxaComodidade;
    // Valor líquido = valor das inscrições - descontos (valor para o organizador, sem a taxa)
    const totalLiquido = totalValorInscricoes - totalDescontos;

    const shirtSizeConsumoConfirmado = confirmedRegistrations.reduce((acc, reg) => {
      if (reg.tamanhoCamisa) {
        acc[reg.tamanhoCamisa] = (acc[reg.tamanhoCamisa] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const shirtSizeConsumoPendente = pendingRegistrations.reduce((acc, reg) => {
      if (reg.tamanhoCamisa) {
        acc[reg.tamanhoCamisa] = (acc[reg.tamanhoCamisa] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const shirtGrid = shirtSizes.map(size => ({
      id: size.id,
      tamanho: size.tamanho,
      quantidadeTotal: size.quantidadeTotal,
      quantidadeDisponivel: size.quantidadeDisponivel,
      consumoConfirmado: shirtSizeConsumoConfirmado[size.tamanho] || 0,
      consumoPendente: shirtSizeConsumoPendente[size.tamanho] || 0,
      consumo: shirtSizeConsumoConfirmado[size.tamanho] || 0
    }));

    const now = new Date();
    const activeBatch = batches.find(b => 
      b.status === 'active' && 
      new Date(b.dataInicio) <= now &&
      (!b.dataTermino || new Date(b.dataTermino) > now) &&
      (!b.quantidadeMaxima || b.quantidadeUtilizada < b.quantidadeMaxima)
    );

    const modalityMap = new Map(modalities.map(m => [m.id, m]));

    const batchesInfo = batches.map(batch => {
      const batchPrices = prices.filter(p => p.batchId === batch.id);
      const pricesWithModalityName = batchPrices.map(p => ({
        modalityId: p.modalityId,
        modalityName: modalityMap.get(p.modalityId)?.nome || 'N/A',
        valor: p.valor
      }));
      
      const dataTerminoDate = batch.dataTermino ? new Date(batch.dataTermino) : null;
      const isExpirado = dataTerminoDate ? dataTerminoDate < now : false;
      const isLotado = batch.quantidadeMaxima ? batch.quantidadeUtilizada >= batch.quantidadeMaxima : false;
      
      return {
        id: batch.id,
        nome: batch.nome,
        dataInicio: utcToBrazilLocal(batch.dataInicio),
        dataTermino: batch.dataTermino ? utcToBrazilLocal(batch.dataTermino) : null,
        quantidadeMaxima: batch.quantidadeMaxima,
        quantidadeUtilizada: batch.quantidadeUtilizada,
        ativo: batch.ativo,
        status: batch.status,
        isVigente: activeBatch?.id === batch.id,
        isExpirado,
        isLotado,
        precos: pricesWithModalityName
      };
    });

    res.json({
      success: true,
      data: {
        totalInscritos: confirmedRegistrations.length,
        totalPendentes: pendingRegistrations.length,
        masculino: confirmedRegistrations.filter(r => r.sexo === "masculino").length,
        feminino: confirmedRegistrations.filter(r => r.sexo === "feminino").length,
        byModality,
        faturamento: {
          bruto: totalBruto,
          descontos: totalDescontos,
          taxaComodidade: totalTaxaComodidade,
          liquido: totalLiquido
        },
        vagas: {
          total: event.limiteVagasTotal,
          ocupadas: event.vagasOcupadas,
          disponiveis: event.limiteVagasTotal - event.vagasOcupadas
        },
        shirtGrid,
        batches: batchesInfo,
        activeBatchId: activeBatch?.id || null
      }
    });
  } catch (error) {
    console.error("Get event stats error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.get("/:eventId/registrations", requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento não encontrado" }
      });
    }

    const hasAccess = await checkEventOwnership(req, res, eventId, event);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Sem permissão para acessar este evento" }
      });
    }

    const [registrations, modalities, batches] = await Promise.all([
      storage.getRegistrationsByEvent(eventId),
      storage.getModalitiesByEvent(eventId),
      storage.getBatchesByEvent(eventId)
    ]);

    const modalityMap = new Map(modalities.map(m => [m.id, m]));
    const batchMap = new Map(batches.map(b => [b.id, b]));

    const athleteIds = Array.from(new Set(registrations.map(r => r.athleteId)));
    const athletesData = await Promise.all(athleteIds.map(id => storage.getAthlete(id)));
    const athleteMap = new Map(athletesData.filter(Boolean).map(a => [a!.id, a!]));

    const orderIds = Array.from(new Set(registrations.map(r => r.orderId)));
    const ordersData = await Promise.all(orderIds.map(id => storage.getOrder(id)));
    const orderMap = new Map(ordersData.filter(Boolean).map(o => [o!.id, o!]));

    const orderRegistrationsCount = registrations.reduce((acc, reg) => {
      acc[reg.orderId] = (acc[reg.orderId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const enrichedRegistrations = registrations.map(reg => {
      const modality = modalityMap.get(reg.modalityId);
      const athlete = athleteMap.get(reg.athleteId);
      const batch = batchMap.get(reg.batchId);
      const order = orderMap.get(reg.orderId);
      
      return {
        ...reg,
        modalityName: modality?.nome || "N/A",
        athleteName: reg.nomeCompleto || athlete?.nome || "N/A",
        athleteEmail: athlete?.email || "N/A",
        athletePhone: athlete?.telefone || "N/A",
        batchName: batch?.nome || "N/A",
        orderStatus: order?.status || "N/A",
        metodoPagamento: order?.metodoPagamento || null,
        dataPagamento: order?.dataPagamento || null,
        valorTotal: order?.valorTotal || "0",
        valorDesconto: order?.valorDesconto || "0",
        codigoCupom: order?.codigoCupom || null,
        codigoVoucher: order?.codigoVoucher || null,
        orderId: reg.orderId,
        numeroPedido: order?.numeroPedido || null,
        orderRegistrationsCount: orderRegistrationsCount[reg.orderId] || 1,
      };
    });

    res.json({
      success: true,
      data: enrichedRegistrations
    });
  } catch (error) {
    console.error("Get event registrations error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

const confirmPaymentSchema = z.object({
  metodoPagamento: z.string().min(1, "Método de pagamento obrigatório")
});

router.post("/:eventId/orders/:orderId/confirm", requireAuth, async (req, res) => {
  try {
    const { eventId, orderId } = req.params;
    
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento não encontrado" }
      });
    }

    const hasAccess = await checkEventOwnership(req, res, eventId, event);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Sem permissão para acessar este evento" }
      });
    }

    const order = await storage.getOrder(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Pedido não encontrado" }
      });
    }

    if (order.eventId !== eventId) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_ORDER", message: "Pedido não pertence a este evento" }
      });
    }

    const validation = confirmPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const result = await confirmPaymentAtomic(orderId, validation.data.metodoPagamento);

    if (!result.success) {
      const statusCode = result.errorCode === 'ORDER_NOT_FOUND' ? 404 :
                         result.errorCode === 'ALREADY_PAID' ? 409 :
                         result.errorCode === 'ORDER_CANCELLED' ? 409 :
                         result.errorCode === 'SHIRT_SIZE_SOLD_OUT' ? 409 : 500;
      return res.status(statusCode).json({
        success: false,
        error: { code: result.errorCode, message: result.error }
      });
    }

    res.json({
      success: true,
      data: { message: "Pagamento confirmado com sucesso" }
    });
  } catch (error) {
    console.error("Confirm payment error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

// Buscar histórico de status de uma entidade
router.get("/status-history/:entityType/:entityId", requireAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    
    if (!['event', 'order', 'registration'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_ENTITY_TYPE", message: "Tipo de entidade inválido" }
      });
    }
    
    const history = await getStatusHistory(entityType as any, entityId);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error("Get status history error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

// Alterar status da inscrição
const updateRegistrationStatusSchema = z.object({
  status: z.enum(["pendente", "confirmada", "cancelada"]),
  reason: z.string().min(1, "Motivo obrigatório")
});

router.patch("/:eventId/registrations/:registrationId/status", requireAuth, async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento não encontrado" }
      });
    }

    const hasAccess = await checkEventOwnership(req, res, eventId, event);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Sem permissão para acessar este evento" }
      });
    }
    
    const registration = await storage.getRegistration(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Inscrição não encontrada" }
      });
    }
    
    if (registration.eventId !== eventId) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_REGISTRATION", message: "Inscrição não pertence a este evento" }
      });
    }
    
    const validation = updateRegistrationStatusSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }
    
    const oldStatus = registration.status;
    const newStatus = validation.data.status;
    
    if (oldStatus === newStatus) {
      return res.status(400).json({
        success: false,
        error: { code: "SAME_STATUS", message: "Status já está definido como " + newStatus }
      });
    }
    
    await storage.updateRegistration(registrationId, { status: newStatus });
    
    await logStatusChange({
      entityType: 'registration',
      entityId: registrationId,
      oldStatus,
      newStatus,
      reason: validation.data.reason,
      changedByType: 'admin',
      changedById: req.adminUser?.id || null,
      metadata: {
        adminEmail: req.adminUser?.email,
        eventId
      }
    });
    
    res.json({
      success: true,
      data: { message: "Status da inscrição atualizado com sucesso" }
    });
  } catch (error) {
    console.error("Update registration status error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

// Alterar status do pedido
const updateOrderStatusSchema = z.object({
  status: z.enum(["pendente", "pago", "cancelado", "expirado"]),
  reason: z.string().min(1, "Motivo obrigatório")
});

router.patch("/:eventId/orders/:orderId/status", requireAuth, async (req, res) => {
  try {
    const { eventId, orderId } = req.params;
    
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento não encontrado" }
      });
    }

    const hasAccess = await checkEventOwnership(req, res, eventId, event);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Sem permissão para acessar este evento" }
      });
    }
    
    const order = await storage.getOrder(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Pedido não encontrado" }
      });
    }
    
    if (order.eventId !== eventId) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_ORDER", message: "Pedido não pertence a este evento" }
      });
    }
    
    const validation = updateOrderStatusSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }
    
    const oldStatus = order.status;
    const newStatus = validation.data.status;
    
    if (oldStatus === newStatus) {
      return res.status(400).json({
        success: false,
        error: { code: "SAME_STATUS", message: "Status já está definido como " + newStatus }
      });
    }
    
    await storage.updateOrder(orderId, { status: newStatus });
    
    await logStatusChange({
      entityType: 'order',
      entityId: orderId,
      oldStatus,
      newStatus,
      reason: validation.data.reason,
      changedByType: 'admin',
      changedById: req.adminUser?.id || null,
      metadata: {
        adminEmail: req.adminUser?.email,
        eventId,
        numeroPedido: order.numeroPedido
      }
    });
    
    res.json({
      success: true,
      data: { message: "Status do pedido atualizado com sucesso" }
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.get("/:eventId/voucher-stats", requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento não encontrado" }
      });
    }

    const hasAccess = await checkEventOwnership(req, res, eventId, event);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Sem permissão para acessar este evento" }
      });
    }

    const [coupons, orders, modalities] = await Promise.all([
      storage.getCouponsByEvent(eventId),
      storage.getOrdersByEvent(eventId),
      storage.getModalitiesByEvent(eventId)
    ]);

    const modalityMap = new Map(modalities.map(m => [m.id, m.nome]));
    
    const paidOrders = orders.filter(o => o.status === "pago");
    
    const voucherStats = coupons.map(coupon => {
      const ordersWithCoupon = paidOrders.filter(o => o.cupomId === coupon.id);
      const totalDesconto = ordersWithCoupon.reduce((sum, o) => sum + safeNumber(o.valorDesconto), 0);
      
      return {
        id: coupon.id,
        codigo: coupon.code,
        tipo: coupon.discountType,
        valor: coupon.discountValue || "0",
        limiteUsos: coupon.maxUses,
        quantidadeUtilizada: coupon.currentUses,
        modalityName: null,
        desconto: totalDesconto
      };
    });

    const totalDescontos = voucherStats.reduce((sum, v) => sum + v.desconto, 0);

    res.json({
      success: true,
      data: {
        vouchers: voucherStats,
        totalDescontos
      }
    });
  } catch (error) {
    console.error("Get voucher stats error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

// Endpoint para relatório de pedidos
router.get("/:eventId/orders", requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento não encontrado" }
      });
    }

    const hasAccess = await checkEventOwnership(req, res, eventId, event);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Sem permissão para acessar este evento" }
      });
    }

    const [orders, registrations] = await Promise.all([
      storage.getOrdersByEvent(eventId),
      storage.getRegistrationsByEvent(eventId)
    ]);

    const athleteIds = Array.from(new Set(orders.map(o => o.compradorId)));
    const athletesData = await Promise.all(athleteIds.map(id => storage.getAthlete(id)));
    const athleteMap = new Map(athletesData.filter(Boolean).map(a => [a!.id, a!]));

    // Calcular quantidade de inscrições por pedido
    const registrationCountByOrder = registrations.reduce((acc, reg) => {
      acc[reg.orderId] = (acc[reg.orderId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calcular taxa de comodidade total por pedido
    const taxaComodidadeByOrder = registrations.reduce((acc, reg) => {
      acc[reg.orderId] = (acc[reg.orderId] || 0) + safeNumber(reg.taxaComodidade);
      return acc;
    }, {} as Record<string, number>);

    // Calcular subtotal (valor unitário) por pedido
    const subtotalByOrder = registrations.reduce((acc, reg) => {
      acc[reg.orderId] = (acc[reg.orderId] || 0) + safeNumber(reg.valorUnitario);
      return acc;
    }, {} as Record<string, number>);

    const enrichedOrders = orders.map(order => {
      const comprador = athleteMap.get(order.compradorId);
      const qtdInscricoes = registrationCountByOrder[order.id] || 0;
      const taxaComodidade = taxaComodidadeByOrder[order.id] || 0;
      const subtotal = subtotalByOrder[order.id] || 0;
      const valorDesconto = safeNumber(order.valorDesconto);
      const valorTotal = safeNumber(order.valorTotal);
      
      // Valor líquido: subtotal - desconto (valor para o organizador, sem a taxa)
      const valorLiquido = subtotal - valorDesconto;
      
      return {
        id: order.id,
        numeroPedido: order.numeroPedido,
        nomeEvento: event.nome,
        nomeComprador: comprador?.nome || "N/A",
        emailComprador: comprador?.email || "N/A",
        cpfComprador: comprador?.cpf || null,
        status: order.status,
        dataPedido: order.dataPedido,
        dataPagamento: order.dataPagamento,
        subtotal: subtotal,
        valorDesconto: valorDesconto,
        codigoCupom: order.codigoCupom || null,
        codigoVoucher: order.codigoVoucher || null,
        taxaComodidade: taxaComodidade,
        valorTotal: valorTotal,
        valorLiquido: valorLiquido,
        metodoPagamento: order.metodoPagamento || null,
        idPagamentoGateway: order.idPagamentoGateway || null,
        qtdInscricoes: qtdInscricoes,
      };
    });

    // Calcular totais apenas de pedidos pagos
    const paidOrders = enrichedOrders.filter(o => o.status === "pago");
    const totalSubtotal = paidOrders.reduce((sum, o) => sum + o.subtotal, 0);
    const totalDescontos = paidOrders.reduce((sum, o) => sum + o.valorDesconto, 0);
    const totalTaxaComodidade = paidOrders.reduce((sum, o) => sum + o.taxaComodidade, 0);
    const totais = {
      // Valor bruto = subtotal + taxa (total arrecadado)
      totalBruto: totalSubtotal + totalTaxaComodidade,
      totalDescontos,
      totalTaxaComodidade,
      // Valor líquido = subtotal - descontos (valor para o organizador)
      totalLiquido: totalSubtotal - totalDescontos,
    };

    res.json({
      success: true,
      data: {
        orders: enrichedOrders,
        totais
      }
    });
  } catch (error) {
    console.error("Get event orders error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

export default router;
