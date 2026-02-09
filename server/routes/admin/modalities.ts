import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { requireAuth, requireRole, checkEventOwnership } from "../../middleware/auth";

const router = Router({ mergeParams: true });

const linkPercursoSchema = z.object({
  nome: z.string(),
  url: z.string().url()
});

const optionalUrl = z.string().transform(val => val === "" ? null : val).nullable().refine(
  val => val === null || val === undefined || /^(https?:\/\/|\/uploads\/).+/.test(val),
  { message: "URL inválida" }
).optional();

const modalitySchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  distancia: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Distancia deve ser um numero positivo"),
  unidadeDistancia: z.enum(["km", "m"]).optional(),
  horarioLargada: z.string().min(1, "Horario de largada e obrigatorio"),
  descricao: z.string().optional().nullable(),
  imagemUrl: optionalUrl,
  linksPercurso: z.array(linkPercursoSchema).optional().nullable(),
  limiteVagas: z.number().int().positive().optional().nullable(),
  tipoAcesso: z.enum(["gratuita", "paga", "voucher", "pcd", "aprovacao_manual"]).optional(),
  taxaComodidade: z.string().optional(),
  idadeMinima: z.number().int().min(0).max(100).optional().nullable(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional()
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento nao encontrado" }
      });
    }

    const hasAccess = await checkEventOwnership(req, res, eventId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Sem permissao para acessar este evento" }
      });
    }

    const modalities = await storage.getModalitiesByEvent(eventId);
    res.json({ success: true, data: modalities });
  } catch (error) {
    console.error("Get modalities error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.post("/", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento nao encontrado" }
      });
    }

    const validation = modalitySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const currentModalities = await storage.getModalitiesByEvent(eventId);
    
    if (validation.data.limiteVagas) {
      const totalUsed = currentModalities.reduce((sum, m) => sum + (m.limiteVagas || 0), 0);
      if (totalUsed + validation.data.limiteVagas > event.limiteVagasTotal) {
        return res.status(400).json({
          success: false,
          error: { 
            code: "LIMIT_EXCEEDED", 
            message: `Soma das vagas por modalidade (${totalUsed + validation.data.limiteVagas}) excede o limite total do evento (${event.limiteVagasTotal})` 
          }
        });
      }
    }

    const nextOrder = currentModalities.length > 0 
      ? Math.max(...currentModalities.map(m => m.ordem)) + 1 
      : 0;

    const modality = await storage.createModality({
      ...validation.data,
      eventId,
      distancia: validation.data.distancia,
      unidadeDistancia: validation.data.unidadeDistancia ?? "km",
      tipoAcesso: validation.data.tipoAcesso ?? "paga",
      taxaComodidade: validation.data.taxaComodidade ?? "0",
      ordem: validation.data.ordem ?? nextOrder
    });

    res.status(201).json({ success: true, data: modality });
  } catch (error) {
    console.error("Create modality error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.patch("/:id", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento nao encontrado" }
      });
    }

    const modality = await storage.getModality(req.params.id);
    if (!modality || modality.eventId !== eventId) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Modalidade nao encontrada" }
      });
    }

    const updateSchema = modalitySchema.partial();
    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    if (validation.data.limiteVagas !== undefined) {
      const currentModalities = await storage.getModalitiesByEvent(eventId);
      const otherModalities = currentModalities.filter(m => m.id !== modality.id);
      const totalUsed = otherModalities.reduce((sum, m) => sum + (m.limiteVagas || 0), 0);
      
      if (validation.data.limiteVagas && totalUsed + validation.data.limiteVagas > event.limiteVagasTotal) {
        return res.status(400).json({
          success: false,
          error: { 
            code: "LIMIT_EXCEEDED", 
            message: `Soma das vagas por modalidade (${totalUsed + validation.data.limiteVagas}) excede o limite total do evento (${event.limiteVagasTotal})` 
          }
        });
      }
    }

    const updated = await storage.updateModality(req.params.id, validation.data);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update modality error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.patch("/reorder", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento nao encontrado" }
      });
    }

    const reorderSchema = z.object({
      order: z.array(z.object({
        id: z.string(),
        ordem: z.number().int()
      }))
    });

    const validation = reorderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const updates = await Promise.all(
      validation.data.order.map(item => 
        storage.updateModality(item.id, { ordem: item.ordem })
      )
    );

    res.json({ success: true, data: updates });
  } catch (error) {
    console.error("Reorder modalities error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.delete("/:id", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento nao encontrado" }
      });
    }

    const modality = await storage.getModality(req.params.id);
    if (!modality || modality.eventId !== eventId) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Modalidade nao encontrada" }
      });
    }

    const registrations = await storage.getRegistrationsByEvent(eventId);
    const modalityRegistrations = registrations.filter(r => r.modalityId === modality.id);
    if (modalityRegistrations.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: "HAS_REGISTRATIONS", message: "Modalidade possui inscricoes e nao pode ser excluida" }
      });
    }

    await storage.deleteModality(req.params.id);
    res.json({ success: true, data: { message: "Modalidade removida com sucesso" } });
  } catch (error) {
    console.error("Delete modality error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

export default router;
