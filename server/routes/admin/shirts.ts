import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { requireAuth, requireRole, checkEventOwnership } from "../../middleware/auth";

const router = Router({ mergeParams: true });

const shirtSizeSchema = z.object({
  modalityId: z.string().optional().nullable(),
  tamanho: z.string().min(1, "Tamanho e obrigatorio"),
  quantidadeTotal: z.number().int().positive("Quantidade deve ser positiva"),
  quantidadeDisponivel: z.number().int().min(0, "Quantidade disponivel nao pode ser negativa").optional(),
  ajustePreco: z.union([z.number(), z.string()]).transform(val => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? 0 : num;
  }).optional().default(0)
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

    let shirtSizes;
    if (event.usarGradePorModalidade) {
      const modalities = await storage.getModalitiesByEvent(eventId);
      const allSizes = await Promise.all(
        modalities.map(m => storage.getShirtSizesByModality(m.id))
      );
      shirtSizes = allSizes.flat();
    } else {
      shirtSizes = await storage.getShirtSizesByEvent(eventId);
    }

    res.json({ success: true, data: shirtSizes });
  } catch (error) {
    console.error("Get shirt sizes error:", error);
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

    const validation = shirtSizeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    if (event.usarGradePorModalidade && !validation.data.modalityId) {
      return res.status(400).json({
        success: false,
        error: { code: "MODALITY_REQUIRED", message: "Modalidade e obrigatoria quando grade por modalidade esta ativa" }
      });
    }

    if (!event.usarGradePorModalidade && validation.data.modalityId) {
      return res.status(400).json({
        success: false,
        error: { code: "MODALITY_NOT_ALLOWED", message: "Modalidade nao deve ser especificada quando grade e global" }
      });
    }

    if (validation.data.modalityId) {
      const modality = await storage.getModality(validation.data.modalityId);
      if (!modality || modality.eventId !== eventId) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_MODALITY", message: "Modalidade nao pertence a este evento" }
        });
      }
    }

    const shirtSize = await storage.createShirtSize({
      eventId,
      modalityId: validation.data.modalityId ?? null,
      tamanho: validation.data.tamanho,
      quantidadeTotal: validation.data.quantidadeTotal,
      quantidadeDisponivel: validation.data.quantidadeDisponivel ?? validation.data.quantidadeTotal,
      ajustePreco: String(validation.data.ajustePreco ?? 0)
    });

    res.status(201).json({ success: true, data: shirtSize });
  } catch (error) {
    console.error("Create shirt size error:", error);
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

    const shirtSize = await storage.getShirtSize(req.params.id);
    if (!shirtSize || shirtSize.eventId !== eventId) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Tamanho de camisa nao encontrado" }
      });
    }

    const updateSchema = z.object({
      tamanho: z.string().min(1).optional(),
      quantidadeTotal: z.number().int().positive().optional(),
      quantidadeDisponivel: z.number().int().min(0).optional(),
      ajustePreco: z.union([z.number(), z.string()]).transform(val => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return isNaN(num) ? 0 : num;
      }).optional()
    });

    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const updateData: any = { ...validation.data };
    if (updateData.ajustePreco !== undefined) {
      updateData.ajustePreco = String(updateData.ajustePreco);
    }
    const updated = await storage.updateShirtSize(req.params.id, updateData);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update shirt size error:", error);
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

    const shirtSize = await storage.getShirtSize(req.params.id);
    if (!shirtSize || shirtSize.eventId !== eventId) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Tamanho de camisa nao encontrado" }
      });
    }

    if (shirtSize.quantidadeTotal !== shirtSize.quantidadeDisponivel) {
      return res.status(400).json({
        success: false,
        error: { code: "HAS_USAGE", message: "Tamanho de camisa ja foi utilizado em inscricoes" }
      });
    }

    await storage.deleteShirtSize(req.params.id);
    res.json({ success: true, data: { message: "Tamanho de camisa removido com sucesso" } });
  } catch (error) {
    console.error("Delete shirt size error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

export default router;
