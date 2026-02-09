import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { registerForEventAtomic } from "../services/registration-service";
import { checkEventCanAcceptRegistrations, recalculateBatchesForEvent, getModalitiesAvailability } from "../services/batch-validation-service";
import { formatBrazilDateTime, utcToBrazilLocal } from "../utils/timezone";

const router = Router();

const createRegistrationSchema = z.object({
  eventId: z.string().uuid(),
  modalityId: z.string().uuid(),
  tamanhoCamisa: z.string().optional(),
  equipe: z.string().optional(),
  voucherCode: z.string().optional()
});

router.get("/events/:slug/registration-info", async (req, res) => {
  try {
    const { slug } = req.params;
    
    const event = await storage.getEventBySlug(slug);
    if (!event) {
      return res.status(404).json({ success: false, error: "Evento não encontrado" });
    }

    // IMPORTANT: Recalculate batches before checking event status
    // This ensures we have up-to-date info about batch expiration and event sold out status
    try {
      await recalculateBatchesForEvent(event.id);
    } catch (batchError) {
      console.error("Error recalculating batches:", batchError);
    }

    // Refresh event after batch recalculation
    const updatedEvent = await storage.getEventBySlug(slug);
    const currentEvent = updatedEvent || event;

    // Check if event is sold out
    if (currentEvent.status === "esgotado") {
      // Get modalities availability for display (all will be sold out)
      const modalitiesAvailability = await getModalitiesAvailability(currentEvent.id);
      
      return res.status(200).json({ 
        success: true, 
        data: {
          event: {
            id: currentEvent.id,
            nome: currentEvent.nome,
            slug: currentEvent.slug,
            descricao: currentEvent.descricao,
            dataEvento: currentEvent.dataEvento,
            endereco: currentEvent.endereco,
            cidade: currentEvent.cidade,
            estado: currentEvent.estado,
            limiteVagasTotal: currentEvent.limiteVagasTotal,
            vagasRestantes: 0,
            entregaCamisaNoKit: currentEvent.entregaCamisaNoKit,
            idadeMinimaEvento: currentEvent.idadeMinimaEvento
          },
          eventSoldOut: true,
          registrationStatus: 'sold_out' as const,
          registrationMessage: 'Evento esgotado - todas as vagas foram preenchidas',
          soldOutMessage: "Inscrições encerradas - evento esgotado.",
          modalities: modalitiesAvailability.modalities.map(m => ({
            id: m.id,
            nome: m.nome,
            tipoAcesso: m.tipoAcesso,
            preco: null,
            taxaComodidade: 0,
            limiteVagas: m.limiteVagas,
            vagasDisponiveis: 0,
            inscricaoBloqueada: true,
            motivoBloqueio: "Evento esgotado",
            isSoldOut: true,
            isAvailable: false
          })),
          activeBatch: null,
          shirtSizes: { byModality: false, data: [] },
          attachments: []
        }
      });
    }

    if (currentEvent.status !== "publicado") {
      return res.status(400).json({ success: false, error: "Evento não disponível para inscrições" });
    }

    const now = new Date();
    const abertura = new Date(currentEvent.aberturaInscricoes);
    const encerramento = new Date(currentEvent.encerramentoInscricoes);
    
    // Calculate registration status
    let registrationStatus: 'not_started' | 'open' | 'closed' | 'sold_out' = 'open';
    let registrationMessage: string | null = null;

    if (now < abertura) {
      registrationStatus = 'not_started';
      registrationMessage = `Inscrições abrem em ${formatBrazilDateTime(abertura)}`;
      return res.status(400).json({ 
        success: false, 
        error: "Inscrições ainda não abertas",
        registrationStatus,
        registrationMessage,
        aberturaInscricoes: currentEvent.aberturaInscricoes
      });
    }

    if (now >= encerramento) {
      registrationStatus = 'closed';
      registrationMessage = 'Inscrições encerradas';
      return res.status(400).json({ 
        success: false, 
        error: "Inscrições encerradas",
        registrationStatus,
        registrationMessage
      });
    }

    // Get modalities availability
    let modalitiesAvailability;
    try {
      modalitiesAvailability = await getModalitiesAvailability(currentEvent.id);
    } catch (availError) {
      console.error("Error getting modalities availability:", availError);
      modalitiesAvailability = null;
    }

    const modalities = await storage.getModalitiesByEvent(currentEvent.id);
    const activeBatch = await storage.getActiveBatch(currentEvent.id);
    const allPrices = await storage.getPricesByEvent(currentEvent.id);
    const attachments = await storage.getAttachmentsByEvent(currentEvent.id);

    let shirtSizes;
    if (currentEvent.usarGradePorModalidade) {
      const allSizes: { modalityId: string; sizes: any[] }[] = [];
      for (const mod of modalities) {
        const sizes = await storage.getShirtSizesByModality(mod.id);
        allSizes.push({ 
          modalityId: mod.id, 
          sizes: sizes.map(s => ({
            id: s.id,
            tamanho: s.tamanho,
            disponivel: s.quantidadeDisponivel,
            ajustePreco: s.ajustePreco || '0'
          }))
        });
      }
      shirtSizes = { byModality: true, data: allSizes };
    } else {
      const sizes = await storage.getShirtSizesByEvent(currentEvent.id);
      shirtSizes = { 
        byModality: false, 
        data: sizes.map(s => ({
          id: s.id,
          tamanho: s.tamanho,
          disponivel: s.quantidadeDisponivel,
          ajustePreco: s.ajustePreco || '0'
        }))
      };
    }

    const currentRegistrations = await storage.getRegistrationsByEvent(currentEvent.id);
    const confirmedRegistrations = currentRegistrations.filter(r => r.status === "confirmada");
    const vagasRestantes = currentEvent.limiteVagasTotal - confirmedRegistrations.length;

    const modalitiesWithInfo = modalities.map(mod => {
      const modalityRegistrations = confirmedRegistrations.filter(r => r.modalityId === mod.id);
      const modalityPrice = allPrices.find(p => p.modalityId === mod.id && activeBatch && p.batchId === activeBatch.id);
      
      let vagasModalidade = null;
      if (mod.limiteVagas) {
        vagasModalidade = mod.limiteVagas - modalityRegistrations.length;
      }

      // CRITICAL BUSINESS RULE: Check if paid modality has valid price
      // Modalities with type 'gratuita' or 'voucher' can have zero price
      const isPaidModality = !['gratuita', 'voucher'].includes(mod.tipoAcesso);
      let inscricaoBloqueada = false;
      let motivoBloqueio: string | null = null;
      
      // Get availability info from the validation service
      const availInfo = modalitiesAvailability?.modalities?.find(m => m.id === mod.id);
      const isSoldOut = availInfo?.isSoldOut ?? (vagasModalidade !== null && vagasModalidade <= 0);
      const isAvailable = availInfo?.isAvailable ?? !isSoldOut;
      
      if (isSoldOut) {
        inscricaoBloqueada = true;
        motivoBloqueio = "Modalidade esgotada";
      } else if (isPaidModality) {
        // For paid modalities, require a valid price from the active batch
        if (!activeBatch) {
          inscricaoBloqueada = true;
          motivoBloqueio = "Nenhum lote ativo disponível no momento.";
        } else if (!modalityPrice) {
          inscricaoBloqueada = true;
          motivoBloqueio = "Nenhum preço configurado para esta modalidade no lote atual.";
        } else {
          const priceValue = parseFloat(modalityPrice.valor);
          if (isNaN(priceValue) || priceValue <= 0) {
            inscricaoBloqueada = true;
            motivoBloqueio = "Preço inválido configurado para esta modalidade.";
          }
        }
      }

      // For paid modalities without valid price, show null instead of 0
      // This prevents the UI from showing R$ 0,00 for paid modalities
      let precoExibicao: number | null;
      if (isPaidModality) {
        // For paid modalities, only show price if it's valid (exists and > 0)
        if (modalityPrice) {
          const priceValue = parseFloat(modalityPrice.valor);
          if (!isNaN(priceValue) && priceValue > 0) {
            precoExibicao = priceValue;
          } else {
            precoExibicao = null; // Invalid price - show null, not 0
          }
        } else {
          precoExibicao = null; // No price configured - show null, not 0
        }
      } else {
        // For free modalities, 0 is valid
        precoExibicao = modalityPrice ? parseFloat(modalityPrice.valor) : 0;
      }

      return {
        id: mod.id,
        nome: mod.nome,
        distancia: mod.distancia,
        unidadeDistancia: mod.unidadeDistancia,
        horarioLargada: mod.horarioLargada,
        descricao: mod.descricao,
        tipoAcesso: mod.tipoAcesso,
        preco: precoExibicao,
        taxaComodidade: parseFloat(mod.taxaComodidade) || 0,
        limiteVagas: mod.limiteVagas,
        vagasDisponiveis: vagasModalidade,
        idadeMinima: mod.idadeMinima ?? currentEvent.idadeMinimaEvento,
        ordem: mod.ordem,
        ativo: mod.ativo,
        inscricaoBloqueada,
        motivoBloqueio,
        isSoldOut,
        isAvailable
      };
    }).sort((a, b) => a.ordem - b.ordem);

    // Check if event is sold out and update registration status
    const isEventSoldOut = modalitiesAvailability?.eventSoldOut ?? false;
    if (isEventSoldOut) {
      registrationStatus = 'sold_out';
      registrationMessage = 'Evento esgotado - todas as vagas foram preenchidas';
    }

    res.json({
      success: true,
      data: {
        event: {
          id: currentEvent.id,
          nome: currentEvent.nome,
          slug: currentEvent.slug,
          descricao: currentEvent.descricao,
          dataEvento: currentEvent.dataEvento,
          endereco: currentEvent.endereco,
          cidade: currentEvent.cidade,
          estado: currentEvent.estado,
          limiteVagasTotal: currentEvent.limiteVagasTotal,
          vagasRestantes,
          entregaCamisaNoKit: currentEvent.entregaCamisaNoKit,
          idadeMinimaEvento: currentEvent.idadeMinimaEvento
        },
        eventSoldOut: isEventSoldOut,
        registrationStatus,
        registrationMessage,
        modalities: modalitiesWithInfo,
        activeBatch: activeBatch ? {
          id: activeBatch.id,
          nome: activeBatch.nome,
          dataInicio: activeBatch.dataInicio,
          dataTermino: activeBatch.dataTermino
        } : null,
        shirtSizes,
        attachments: attachments.map(a => ({
          id: a.id,
          nome: a.nome,
          url: a.url,
          obrigatorioAceitar: a.obrigatorioAceitar
        }))
      }
    });
  } catch (error) {
    console.error("Erro ao buscar informações de inscrição:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.post("/", async (req, res) => {
  try {
    const sessionAthleteId = (req.session as any)?.athleteId;
    if (!sessionAthleteId) {
      return res.status(401).json({ success: false, error: "Não autenticado" });
    }

    const parsed = createRegistrationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Dados inválidos",
        details: parsed.error.flatten() 
      });
    }

    const { eventId, modalityId, tamanhoCamisa, equipe } = parsed.data;
    const athleteId = sessionAthleteId;

    // IMPORTANT: Check if event can accept registrations BEFORE proceeding
    // This recalculates batches and checks event status (sold out, closed, etc.)
    const canAcceptResult = await checkEventCanAcceptRegistrations(eventId);
    if (!canAcceptResult.canAccept) {
      const statusCode = canAcceptResult.errorCode === 'EVENT_NOT_FOUND' ? 404 :
                         canAcceptResult.errorCode === 'EVENT_SOLD_OUT' ? 409 :
                         canAcceptResult.errorCode === 'EVENT_FULL' ? 409 : 400;
      return res.status(statusCode).json({ 
        success: false, 
        error: canAcceptResult.reason,
        errorCode: canAcceptResult.errorCode
      });
    }

    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: "Evento não encontrado" });
    }

    // Double check event status after batch recalculation
    if (event.status === "esgotado") {
      return res.status(409).json({ 
        success: false, 
        error: "Inscrições encerradas - evento esgotado.",
        errorCode: "EVENT_SOLD_OUT"
      });
    }

    if (event.status !== "publicado") {
      return res.status(400).json({ success: false, error: "Evento não disponível para inscrições" });
    }

    const now = new Date();
    const abertura = new Date(event.aberturaInscricoes);
    const encerramento = new Date(event.encerramentoInscricoes);
    
    if (now < abertura) {
      return res.status(400).json({ 
        success: false, 
        error: "Inscrições ainda não abertas. As inscrições para este evento começam em " + formatBrazilDateTime(abertura),
        errorCode: "REGISTRATION_NOT_STARTED",
        registrationStatus: 'not_started',
        registrationMessage: `Inscrições abrem em ${formatBrazilDateTime(abertura)}`
      });
    }
    
    if (now >= encerramento) {
      return res.status(400).json({ 
        success: false, 
        error: "Período de inscrições encerrado",
        errorCode: "REGISTRATION_CLOSED",
        registrationStatus: 'closed',
        registrationMessage: 'Inscrições encerradas'
      });
    }

    const modality = await storage.getModality(modalityId);
    if (!modality || modality.eventId !== eventId) {
      return res.status(404).json({ success: false, error: "Modalidade não encontrada" });
    }

    // Voucher validation for voucher-type modalities
    const { voucherCode } = parsed.data;
    let validatedVoucher: { id: string; code: string } | null = null;
    
    if (modality.tipoAcesso === "voucher") {
      if (!voucherCode) {
        return res.status(400).json({ 
          success: false, 
          error: "Código de voucher obrigatório para esta modalidade",
          errorCode: "VOUCHER_REQUIRED"
        });
      }

      const voucher = await storage.getVoucherByCode(eventId, voucherCode);
      
      if (!voucher) {
        return res.status(400).json({ 
          success: false, 
          error: "Voucher não encontrado para este evento",
          errorCode: "VOUCHER_NOT_FOUND"
        });
      }

      const voucherNow = new Date();
      
      if (new Date(voucher.validFrom) > voucherNow) {
        return res.status(400).json({ 
          success: false, 
          error: "Este voucher ainda não está válido",
          errorCode: "VOUCHER_NOT_VALID_YET"
        });
      }

      if (new Date(voucher.validUntil) < voucherNow) {
        return res.status(400).json({ 
          success: false, 
          error: "Este voucher expirou",
          errorCode: "VOUCHER_EXPIRED"
        });
      }

      if (voucher.status === "used") {
        return res.status(400).json({ 
          success: false, 
          error: "Este voucher já foi utilizado",
          errorCode: "VOUCHER_ALREADY_USED"
        });
      }

      if (voucher.status === "expired") {
        return res.status(400).json({ 
          success: false, 
          error: "Este voucher expirou",
          errorCode: "VOUCHER_EXPIRED"
        });
      }

      validatedVoucher = { id: voucher.id, code: voucher.code };
    }

    const activeBatch = await storage.getActiveBatch(eventId);
    if (!activeBatch) {
      return res.status(400).json({ success: false, error: "Nenhum lote disponível" });
    }

    const athlete = await storage.getAthlete(athleteId);
    if (!athlete) {
      return res.status(404).json({ success: false, error: "Atleta não encontrado" });
    }

    // Validação de idade mínima
    // A modalidade pode ter sua própria idade mínima (ex: modalidade kids)
    // Se não tiver, usa a idade mínima do evento
    const idadeMinimaAplicavel = modality.idadeMinima !== null ? modality.idadeMinima : event.idadeMinimaEvento;
    
    if (idadeMinimaAplicavel > 0 && athlete.dataNascimento) {
      const hoje = new Date();
      const dataNasc = new Date(athlete.dataNascimento);
      let idadeAtleta = hoje.getFullYear() - dataNasc.getFullYear();
      const mesAtual = hoje.getMonth();
      const mesNasc = dataNasc.getMonth();
      
      // Ajusta se ainda não fez aniversário este ano
      if (mesAtual < mesNasc || (mesAtual === mesNasc && hoje.getDate() < dataNasc.getDate())) {
        idadeAtleta--;
      }
      
      if (idadeAtleta < idadeMinimaAplicavel) {
        const origem = modality.idadeMinima !== null ? "modalidade" : "evento";
        return res.status(400).json({ 
          success: false, 
          error: `Idade mínima para esta ${origem === "modalidade" ? "modalidade" : "inscrição"} é ${idadeMinimaAplicavel} anos. Idade do atleta: ${idadeAtleta} anos.`,
          errorCode: "MINIMUM_AGE_NOT_MET",
          details: {
            idadeMinima: idadeMinimaAplicavel,
            idadeAtleta,
            origem
          }
        });
      }
    }

    const price = await storage.getPrice(modalityId, activeBatch.id);
    const taxaComodidade = parseFloat(modality.taxaComodidade) || 0;
    
    // CRITICAL BUSINESS RULE: Only "paga" modalities MUST have a valid price > 0
    // "voucher" modalities can be free or paid (depends on configured price)
    // "gratuita" modalities are always free
    const isPaidModality = modality.tipoAcesso === "paga";
    
    if (isPaidModality) {
      if (!price || price.valor === null || price.valor === undefined) {
        return res.status(400).json({ 
          success: false, 
          error: "Nenhum lote válido disponível para esta modalidade no momento.",
          errorCode: "NO_VALID_BATCH_FOR_PAID_MODALITY"
        });
      }
      const priceValue = parseFloat(price.valor);
      if (isNaN(priceValue) || priceValue <= 0) {
        return res.status(400).json({ 
          success: false, 
          error: "Nenhum lote válido disponível para esta modalidade no momento.",
          errorCode: "NO_VALID_BATCH_FOR_PAID_MODALITY"
        });
      }
    }
    
    let valorInscricao = price ? parseFloat(price.valor) : 0;
    
    // Aplicar ajuste de preço do tamanho de camisa
    let ajustePrecoTamanho = 0;
    if (tamanhoCamisa) {
      const usarGradePorModalidade = event.usarGradePorModalidade || false;
      let shirtSizes;
      if (usarGradePorModalidade) {
        shirtSizes = await storage.getShirtSizesByModality(modalityId);
      } else {
        shirtSizes = await storage.getShirtSizesByEvent(eventId);
      }
      console.log(`[registrations] Buscando ajuste de preco para camisa "${tamanhoCamisa}", usarGradePorModalidade=${usarGradePorModalidade}, tamanhos encontrados:`, shirtSizes.map(s => ({ tamanho: s.tamanho, ajustePreco: s.ajustePreco })));
      const selectedSize = shirtSizes.find(s => s.tamanho === tamanhoCamisa);
      if (selectedSize) {
        ajustePrecoTamanho = parseFloat(selectedSize.ajustePreco || '0');
        const valorOriginal = valorInscricao;
        valorInscricao = Math.max(0, valorInscricao + ajustePrecoTamanho);
        console.log(`[registrations] Ajuste aplicado: original=${valorOriginal}, ajuste=${ajustePrecoTamanho}, novo=${valorInscricao}`);
      } else {
        console.log(`[registrations] Tamanho "${tamanhoCamisa}" nao encontrado na grade`);
      }
    }
    
    const valorTotal = valorInscricao + taxaComodidade;

    // isGratuita is true for:
    // - "gratuita" modalities (always free)
    // - "voucher" modalities with price 0 or no price (free access via voucher)
    // For "paga" modalities, never derive gratuita from price (that was the bug!)
    const isGratuita = modality.tipoAcesso === "gratuita" || 
                       (modality.tipoAcesso === "voucher" && valorInscricao === 0);

    const orderNumber = await storage.getNextOrderNumber();
    const registrationNumber = await storage.getNextRegistrationNumber();

    // Calculate expiration date for pending (paid) orders: 30 minutes from now
    const expirationMinutes = parseInt(process.env.ORDER_EXPIRATION_MINUTES || "30", 10);
    const dataExpiracao = isGratuita ? null : new Date(Date.now() + expirationMinutes * 60 * 1000).toISOString();

    const result = await registerForEventAtomic(
      {
        numeroPedido: orderNumber,
        eventId,
        compradorId: athleteId,
        valorTotal: valorTotal.toString(),
        valorDesconto: "0",
        status: isGratuita ? "pago" : "pendente",
        metodoPagamento: isGratuita ? "gratuito" : null,
        ipComprador: req.ip || null,
        dataExpiracao
      },
      {
        eventId,
        athleteId,
        modalityId,
        batchId: activeBatch.id,
        orderId: "",
        numeroInscricao: registrationNumber,
        tamanhoCamisa: tamanhoCamisa || null,
        equipe: equipe || null,
        valorUnitario: valorInscricao.toString(),
        taxaComodidade: taxaComodidade.toString(),
        status: isGratuita ? "confirmada" : "pendente",
        nomeCompleto: athlete.nome,
        cpf: athlete.cpf,
        dataNascimento: athlete.dataNascimento,
        sexo: athlete.sexo
      }
    );

    if (!result.success) {
      const statusCode = result.errorCode === 'EVENT_NOT_FOUND' ? 404 :
                         result.errorCode === 'VAGAS_ESGOTADAS' ? 409 :
                         result.errorCode === 'JA_INSCRITO' ? 409 :
                         result.errorCode === 'SHIRT_SIZE_SOLD_OUT' ? 409 :
                         result.errorCode === 'NO_VALID_BATCH_FOR_PAID_MODALITY' ? 400 : 500;
      return res.status(statusCode).json({ 
        success: false, 
        error: result.error,
        errorCode: result.errorCode
      });
    }

    // Mark voucher as used after successful registration
    if (validatedVoucher && result.order && result.registration) {
      try {
        // Update voucher status to used
        await storage.updateVoucher(validatedVoucher.id, { status: "used" });
        // Create voucher usage record
        await storage.createVoucherUsage({
          voucherId: validatedVoucher.id,
          userId: athleteId,
          registrationId: result.registration.id,
          ipAddress: req.ip || null
        });
        // Update order with voucher code
        await storage.updateOrder(result.order.id, { codigoVoucher: validatedVoucher.code });
      } catch (voucherError) {
        console.error("Error marking voucher as used:", voucherError);
        // Don't fail the registration if voucher marking fails
      }
    }

    res.status(201).json({
      success: true,
      data: {
        order: {
          ...result.order,
          dataExpiracao: result.order?.dataExpiracao || null
        },
        registration: {
          ...result.registration,
          modalidade: modality.nome,
          tamanhoCamisa: tamanhoCamisa || null
        },
        evento: {
          nome: event.nome,
          dataEvento: event.dataEvento,
          endereco: event.endereco,
          cidade: event.cidade,
          estado: event.estado
        }
      }
    });

  } catch (error: any) {
    console.error("Erro ao criar inscrição:", error);
    
    if (error.message?.includes("Lote esgotado")) {
      return res.status(400).json({ success: false, error: "Lote esgotado" });
    }
    if (error.message?.includes("Idade minima")) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.message?.includes("esgotado") || error.message?.includes("nao disponivel")) {
      return res.status(400).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.get("/orders/:orderId", async (req, res) => {
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

    const event = await storage.getEvent(order.eventId);
    const registrations = await storage.getRegistrationsByOrder(orderId);
    
    const registrationsWithDetails = await Promise.all(
      registrations.map(async (reg) => {
        const modality = await storage.getModality(reg.modalityId);
        
        let ajustePrecoTamanho = 0;
        if (reg.tamanhoCamisa && event) {
          const usarGradePorModalidade = event.usarGradePorModalidade || false;
          let shirtSizes;
          if (usarGradePorModalidade) {
            shirtSizes = await storage.getShirtSizesByModality(reg.modalityId);
          } else {
            shirtSizes = await storage.getShirtSizesByEvent(event.id);
          }
          const selectedSize = shirtSizes.find(s => s.tamanho === reg.tamanhoCamisa);
          if (selectedSize) {
            ajustePrecoTamanho = parseFloat(selectedSize.ajustePreco || '0');
          }
        }
        
        return {
          id: reg.id,
          numeroInscricao: reg.numeroInscricao,
          tamanhoCamisa: reg.tamanhoCamisa,
          equipe: reg.equipe,
          valorUnitario: parseFloat(reg.valorUnitario),
          taxaComodidade: parseFloat(reg.taxaComodidade),
          ajustePrecoTamanho,
          modalidade: modality ? {
            id: modality.id,
            nome: modality.nome,
            distancia: modality.distancia,
            unidadeDistancia: modality.unidadeDistancia,
            tipoAcesso: modality.tipoAcesso
          } : null
        };
      })
    );

    res.json({
      success: true,
      data: {
        order: {
          id: order.id,
          numeroPedido: order.numeroPedido,
          valorTotal: parseFloat(order.valorTotal),
          valorDesconto: parseFloat(order.valorDesconto),
          status: order.status,
          metodoPagamento: order.metodoPagamento,
          codigoVoucher: order.codigoVoucher,
          dataExpiracao: order.dataExpiracao,
          idPagamentoGateway: order.idPagamentoGateway,
          dataPagamento: order.dataPagamento
        },
        evento: event ? {
          id: event.id,
          nome: event.nome,
          slug: event.slug,
          dataEvento: event.dataEvento,
          cidade: event.cidade,
          estado: event.estado
        } : null,
        registrations: registrationsWithDetails
      }
    });
  } catch (error) {
    console.error("Erro ao buscar pedido:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.get("/my-registrations", async (req, res) => {
  try {
    const athleteId = (req.session as any)?.athleteId;
    if (!athleteId) {
      return res.status(401).json({ success: false, error: "Não autenticado" });
    }

    const registrations = await storage.getRegistrationsByAthlete(athleteId);
    
    const registrationsWithDetails = await Promise.all(
      registrations.map(async (reg) => {
        const event = await storage.getEvent(reg.eventId);
        const modality = await storage.getModality(reg.modalityId);
        const order = await storage.getOrder(reg.orderId);
        
        const athlete = await storage.getAthlete(reg.athleteId);
        
        let ajustePrecoTamanho = 0;
        if (reg.tamanhoCamisa && event) {
          const usarGradePorModalidade = event.usarGradePorModalidade || false;
          let shirtSizes;
          if (usarGradePorModalidade) {
            shirtSizes = await storage.getShirtSizesByModality(reg.modalityId);
          } else {
            shirtSizes = await storage.getShirtSizesByEvent(event.id);
          }
          const selectedSize = shirtSizes.find(s => s.tamanho === reg.tamanhoCamisa);
          if (selectedSize) {
            ajustePrecoTamanho = parseFloat(selectedSize.ajustePreco || '0');
          }
        }
        
        return {
          id: reg.id,
          numeroInscricao: reg.numeroInscricao,
          status: reg.status,
          tamanhoCamisa: reg.tamanhoCamisa,
          equipe: reg.equipe,
          dataInscricao: reg.dataInscricao,
          valorPago: parseFloat(reg.valorUnitario) + parseFloat(reg.taxaComodidade),
          ajustePrecoTamanho,
          participanteNome: reg.nomeCompleto || athlete?.nome || "Participante",
          participanteCpf: reg.cpf || athlete?.cpf || null,
          participanteDataNascimento: reg.dataNascimento || athlete?.dataNascimento || null,
          participanteSexo: reg.sexo || athlete?.sexo || null,
          participanteTelefone: athlete?.telefone || null,
          participanteEmail: athlete?.email || null,
          evento: event ? {
            id: event.id,
            nome: event.nome,
            slug: event.slug,
            dataEvento: event.dataEvento,
            cidade: event.cidade,
            estado: event.estado,
            bannerUrl: event.bannerUrl
          } : null,
          modalidade: modality ? {
            id: modality.id,
            nome: modality.nome,
            distancia: modality.distancia,
            unidadeDistancia: modality.unidadeDistancia
          } : null,
          pedido: order ? {
            id: order.id,
            numeroPedido: order.numeroPedido,
            status: order.status
          } : null
        };
      })
    );

    res.json({ success: true, data: registrationsWithDetails });
  } catch (error) {
    console.error("Erro ao buscar inscrições:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.get("/my-orders", async (req, res) => {
  try {
    const athleteId = (req.session as any)?.athleteId;
    if (!athleteId) {
      return res.status(401).json({ success: false, error: "Não autenticado" });
    }

    const orders = await storage.getOrdersByBuyer(athleteId);
    
    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        const event = await storage.getEvent(order.eventId);
        const registrations = await storage.getRegistrationsByOrder(order.id);
        
        const registrationsWithDetails = await Promise.all(
          registrations.map(async (reg) => {
            const modality = await storage.getModality(reg.modalityId);
            const athlete = await storage.getAthlete(reg.athleteId);
            
            let ajustePrecoTamanho = 0;
            if (reg.tamanhoCamisa && event) {
              const usarGradePorModalidade = event.usarGradePorModalidade || false;
              let shirtSizes;
              if (usarGradePorModalidade) {
                shirtSizes = await storage.getShirtSizesByModality(reg.modalityId);
              } else {
                shirtSizes = await storage.getShirtSizesByEvent(event.id);
              }
              const selectedSize = shirtSizes.find(s => s.tamanho === reg.tamanhoCamisa);
              if (selectedSize) {
                ajustePrecoTamanho = parseFloat(selectedSize.ajustePreco || '0');
              }
            }
            
            return {
              id: reg.id,
              numeroInscricao: reg.numeroInscricao,
              status: reg.status,
              tamanhoCamisa: reg.tamanhoCamisa,
              equipe: reg.equipe,
              participanteNome: reg.nomeCompleto || athlete?.nome || "Participante",
              participanteCpf: reg.cpf || athlete?.cpf || null,
              participanteDataNascimento: reg.dataNascimento || athlete?.dataNascimento || null,
              participanteSexo: reg.sexo || athlete?.sexo || null,
              valorUnitario: parseFloat(reg.valorUnitario),
              taxaComodidade: parseFloat(reg.taxaComodidade),
              ajustePrecoTamanho,
              modalidade: modality ? {
                id: modality.id,
                nome: modality.nome,
                distancia: modality.distancia,
                unidadeDistancia: modality.unidadeDistancia
              } : null
            };
          })
        );

        return {
          id: order.id,
          numeroPedido: order.numeroPedido,
          dataPedido: order.dataPedido,
          status: order.status,
          valorTotal: parseFloat(order.valorTotal),
          valorDesconto: parseFloat(order.valorDesconto),
          metodoPagamento: order.metodoPagamento,
          evento: event ? {
            id: event.id,
            nome: event.nome,
            slug: event.slug,
            dataEvento: event.dataEvento,
            cidade: event.cidade,
            estado: event.estado,
            bannerUrl: event.bannerUrl
          } : null,
          inscricoes: registrationsWithDetails
        };
      })
    );

    res.json({ success: true, data: ordersWithDetails });
  } catch (error) {
    console.error("Erro ao buscar pedidos:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

export default router;
