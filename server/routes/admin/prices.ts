import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { requireAuth, requireRole, checkEventOwnership } from "../../middleware/auth";

const router = Router({ mergeParams: true });

const priceSchema = z.object({
  modalityId: z.string().min(1, "Modalidade e obrigatoria"),
  batchId: z.string().min(1, "Lote e obrigatorio"),
  valor: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Valor deve ser um numero positivo ou zero")
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

    const prices = await storage.getPricesByEvent(eventId);
    res.json({ success: true, data: prices });
  } catch (error) {
    console.error("Get prices error:", error);
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

    const validation = priceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const modality = await storage.getModality(validation.data.modalityId);
    if (!modality || modality.eventId !== eventId) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_MODALITY", message: "Modalidade nao pertence a este evento" }
      });
    }

    const batch = await storage.getBatch(validation.data.batchId);
    if (!batch || batch.eventId !== eventId) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_BATCH", message: "Lote nao pertence a este evento" }
      });
    }

    const existingPrice = await storage.getPrice(validation.data.modalityId, validation.data.batchId);
    if (existingPrice) {
      return res.status(409).json({
        success: false,
        error: { code: "DUPLICATE_PRICE", message: "Ja existe um preco para esta combinacao de modalidade e lote" }
      });
    }

    const price = await storage.createPrice(validation.data);
    res.status(201).json({ success: true, data: price });
  } catch (error) {
    console.error("Create price error:", error);
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

    const price = await storage.getPriceById(req.params.id);
    if (!price) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Preco nao encontrado" }
      });
    }

    const modality = await storage.getModality(price.modalityId);
    if (!modality || modality.eventId !== eventId) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Preco nao pertence a este evento" }
      });
    }

    const updateSchema = z.object({
      valor: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Valor deve ser um numero positivo ou zero")
    });

    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const updated = await storage.updatePrice(req.params.id, validation.data);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update price error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.put("/bulk", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento nao encontrado" }
      });
    }

    const bulkSchema = z.object({
      prices: z.array(z.object({
        modalityId: z.string(),
        batchId: z.string(),
        valor: z.string()
      }))
    });

    const validation = bulkSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const results = [];
    for (const priceData of validation.data.prices) {
      const existingPrice = await storage.getPrice(priceData.modalityId, priceData.batchId);
      if (existingPrice) {
        const updated = await storage.updatePrice(existingPrice.id, { valor: priceData.valor });
        results.push(updated);
      } else {
        const created = await storage.createPrice(priceData);
        results.push(created);
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error("Bulk update prices error:", error);
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

    const price = await storage.getPriceById(req.params.id);
    if (!price) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Preco nao encontrado" }
      });
    }

    await storage.deletePrice(req.params.id);
    res.json({ success: true, data: { message: "Preco removido com sucesso" } });
  } catch (error) {
    console.error("Delete price error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

export default router;
