import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { requireAuth, requireRole, checkEventOwnership } from "../../middleware/auth";
import { slugify, generateUniqueSlug } from "../../utils/slugify";
import { localToBrazilUTC, utcToBrazilLocal } from "../../utils/timezone";
import { logStatusChange } from "../../services/status-log-service";

const router = Router();

function formatEventForResponse(event: any) {
  return {
    ...event,
    aberturaInscricoes: utcToBrazilLocal(event.aberturaInscricoes),
    encerramentoInscricoes: utcToBrazilLocal(event.encerramentoInscricoes),
  };
}

function formatBatchForResponse(batch: any) {
  return {
    ...batch,
    dataInicio: utcToBrazilLocal(batch.dataInicio),
    dataTermino: batch.dataTermino ? utcToBrazilLocal(batch.dataTermino) : null,
  };
}

const eventSchema = z.object({
  organizerId: z.string().min(1, "Organizador e obrigatorio"),
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  descricao: z.string().min(10, "Descricao deve ter pelo menos 10 caracteres"),
  dataEvento: z.string().refine(val => !isNaN(Date.parse(val)), "Data do evento invalida"),
  endereco: z.string().min(5, "Endereco deve ter pelo menos 5 caracteres"),
  cidade: z.string().min(2, "Cidade deve ter pelo menos 2 caracteres"),
  estado: z.string().length(2, "Estado deve ter 2 caracteres"),
  bannerUrl: z.string().url().optional().nullable(),
  aberturaInscricoes: z.string().refine(val => !isNaN(Date.parse(val)), "Data de abertura invalida"),
  encerramentoInscricoes: z.string().refine(val => !isNaN(Date.parse(val)), "Data de encerramento invalida"),
  limiteVagasTotal: z.number().int().positive("Limite de vagas deve ser positivo"),
  entregaCamisaNoKit: z.boolean().optional(),
  usarGradePorModalidade: z.boolean().optional(),
  informacoesRetiradaKit: z.string().optional().nullable(),
  idadeMinimaEvento: z.number().int().min(0, "Idade minima deve ser positiva").max(100, "Idade minima invalida").optional(),
  permitirMultiplasModalidades: z.boolean().optional(),
  status: z.enum(["rascunho", "publicado", "cancelado", "finalizado", "esgotado"]).optional()
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.adminUser;
    let events;
    
    if (user?.role === "organizador") {
      if (!user.organizerId) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "Usuario organizador sem organizacao vinculada" }
        });
      }
      events = await storage.getEventsByOrganizer(user.organizerId);
    } else {
      events = await storage.getEvents();
    }
    
    res.json({ success: true, data: events.map(formatEventForResponse) });
  } catch (error) {
    console.error("Get events error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const event = await storage.getEvent(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento nao encontrado" }
      });
    }

    const hasAccess = await checkEventOwnership(req, res, event.id, event);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Sem permissao para acessar este evento" }
      });
    }

    res.json({ success: true, data: formatEventForResponse(event) });
  } catch (error) {
    console.error("Get event error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.get("/:id/full", requireAuth, async (req, res) => {
  try {
    const event = await storage.getEvent(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento nao encontrado" }
      });
    }

    const hasAccess = await checkEventOwnership(req, res, event.id, event);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Sem permissao para acessar este evento" }
      });
    }
    
    const [modalities, batches, prices, shirtSizes, attachments, banners] = await Promise.all([
      storage.getModalitiesByEvent(event.id),
      storage.getBatchesByEvent(event.id),
      storage.getPricesByEvent(event.id),
      storage.getShirtSizesByEvent(event.id),
      storage.getAttachmentsByEvent(event.id),
      storage.getEventBannersByEvent(event.id)
    ]);
    
    res.json({ 
      success: true, 
      data: {
        ...formatEventForResponse(event),
        modalities,
        batches: batches.map(formatBatchForResponse),
        prices,
        shirtSizes,
        attachments,
        banners
      }
    });
  } catch (error) {
    console.error("Get event full error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.post("/", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const validation = eventSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const organizer = await storage.getOrganizer(validation.data.organizerId);
    if (!organizer) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_ORGANIZER", message: "Organizador nao encontrado" }
      });
    }

    const allEvents = await storage.getEvents();
    const existingSlugs = allEvents.map(e => e.slug);
    const slug = generateUniqueSlug(validation.data.nome, existingSlugs);

    const event = await storage.createEvent({
      nome: validation.data.nome,
      organizerId: validation.data.organizerId,
      slug,
      descricao: validation.data.descricao,
      dataEvento: validation.data.dataEvento,
      endereco: validation.data.endereco,
      cidade: validation.data.cidade,
      estado: validation.data.estado,
      aberturaInscricoes: localToBrazilUTC(validation.data.aberturaInscricoes),
      encerramentoInscricoes: localToBrazilUTC(validation.data.encerramentoInscricoes),
      limiteVagasTotal: validation.data.limiteVagasTotal,
      bannerUrl: validation.data.bannerUrl ?? null,
      status: validation.data.status ?? "rascunho",
      entregaCamisaNoKit: validation.data.entregaCamisaNoKit ?? true,
      usarGradePorModalidade: validation.data.usarGradePorModalidade ?? false,
      informacoesRetiradaKit: validation.data.informacoesRetiradaKit ?? null,
      idadeMinimaEvento: validation.data.idadeMinimaEvento ?? 18
    });

    res.status(201).json({ success: true, data: formatEventForResponse(event) });
  } catch (error) {
    console.error("Create event error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.patch("/:id", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const event = await storage.getEvent(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento nao encontrado" }
      });
    }

    const updateSchema = eventSchema.partial();
    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    if (validation.data.organizerId) {
      const organizer = await storage.getOrganizer(validation.data.organizerId);
      if (!organizer) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_ORGANIZER", message: "Organizador nao encontrado" }
        });
      }
    }

    const updateData: Record<string, unknown> = { ...validation.data };
    if (validation.data.aberturaInscricoes) {
      updateData.aberturaInscricoes = localToBrazilUTC(validation.data.aberturaInscricoes);
    }
    if (validation.data.encerramentoInscricoes) {
      updateData.encerramentoInscricoes = localToBrazilUTC(validation.data.encerramentoInscricoes);
    }

    const updated = await storage.updateEvent(req.params.id, updateData);
    res.json({ success: true, data: formatEventForResponse(updated) });
  } catch (error) {
    console.error("Update event error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.patch("/:id/status", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const event = await storage.getEvent(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento nao encontrado" }
      });
    }

    const statusSchema = z.object({
      status: z.enum(["rascunho", "publicado", "cancelado", "finalizado"])
    });

    const validation = statusSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Status invalido" }
      });
    }

    const newStatus = validation.data.status;

    if (newStatus === "publicado") {
      const modalities = await storage.getModalitiesByEvent(event.id);
      if (modalities.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: "NO_MODALITIES", message: "Evento precisa ter pelo menos uma modalidade" }
        });
      }

      const batches = await storage.getBatchesByEvent(event.id);
      const activeBatches = batches.filter(b => b.status === 'active');
      
      const paidModalities = modalities.filter(m => m.tipoAcesso === "paga");
      const prices = await storage.getPricesByEvent(event.id);
      
      for (const modality of paidModalities) {
        const hasPrice = prices.some(p => p.modalityId === modality.id);
        if (!hasPrice) {
          return res.status(400).json({
            success: false,
            error: { code: "MISSING_PRICE", message: `Modalidade "${modality.nome}" precisa ter preco definido` }
          });
        }
      }
      
      const hasNoActiveBatch = activeBatches.length === 0;
      if (hasNoActiveBatch) {
        const updated = await storage.updateEvent(req.params.id, { status: newStatus });
        
        // Log status change
        await logStatusChange({
          entityType: 'event',
          entityId: event.id,
          oldStatus: event.status,
          newStatus: newStatus,
          reason: 'Status alterado pelo admin (sem lote ativo)',
          changedByType: 'admin',
          changedById: req.adminUser?.id || null,
          metadata: {
            adminEmail: req.adminUser?.email,
            warning: 'NO_ACTIVE_BATCH'
          }
        });
        
        return res.json({ 
          success: true, 
          data: updated,
          warning: {
            code: "NO_ACTIVE_BATCH",
            message: "Este evento nao possui nenhum lote com status 'active'. Ele sera publicado, mas as inscricoes aparecerao como indisponiveis ate que um lote seja ativado."
          }
        });
      }
    }

    const updated = await storage.updateEvent(req.params.id, { status: newStatus });
    
    // Log status change
    await logStatusChange({
      entityType: 'event',
      entityId: event.id,
      oldStatus: event.status,
      newStatus: newStatus,
      reason: 'Status alterado pelo admin',
      changedByType: 'admin',
      changedById: req.adminUser?.id || null,
      metadata: {
        adminEmail: req.adminUser?.email
      }
    });
    
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update event status error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.delete("/:id", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const event = await storage.getEvent(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento nao encontrado" }
      });
    }

    if (event.status !== "rascunho") {
      return res.status(400).json({
        success: false,
        error: { code: "CANNOT_DELETE", message: "Apenas eventos em rascunho podem ser excluidos" }
      });
    }

    const registrations = await storage.getRegistrationsByEvent(event.id);
    if (registrations.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: "HAS_REGISTRATIONS", message: "Evento possui inscricoes e nao pode ser excluido" }
      });
    }

    await storage.deleteEvent(req.params.id);
    res.json({ success: true, data: { message: "Evento removido com sucesso" } });
  } catch (error) {
    console.error("Delete event error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

export default router;
