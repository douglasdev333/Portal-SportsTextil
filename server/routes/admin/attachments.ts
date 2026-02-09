import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { requireAuth, requireRole, checkEventOwnership } from "../../middleware/auth";

const router = Router({ mergeParams: true });

const attachmentSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  url: z.string().min(1, "URL ou caminho do arquivo e obrigatorio").refine(
    (val) => val.startsWith("/uploads/") || val.startsWith("http://") || val.startsWith("https://"),
    "URL ou caminho do arquivo invalido"
  ),
  obrigatorioAceitar: z.boolean().optional(),
  ordem: z.number().int().optional()
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

    const attachments = await storage.getAttachmentsByEvent(eventId);
    res.json({ success: true, data: attachments });
  } catch (error) {
    console.error("Get attachments error:", error);
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

    const validation = attachmentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const currentAttachments = await storage.getAttachmentsByEvent(eventId);
    const nextOrder = currentAttachments.length > 0 
      ? Math.max(...currentAttachments.map(a => a.ordem)) + 1 
      : 0;

    const attachment = await storage.createAttachment({
      ...validation.data,
      eventId,
      obrigatorioAceitar: validation.data.obrigatorioAceitar ?? false,
      ordem: validation.data.ordem ?? nextOrder
    });

    res.status(201).json({ success: true, data: attachment });
  } catch (error) {
    console.error("Create attachment error:", error);
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

    const attachment = await storage.getAttachment(req.params.id);
    if (!attachment || attachment.eventId !== eventId) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Anexo nao encontrado" }
      });
    }

    const updateSchema = attachmentSchema.partial();
    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const updated = await storage.updateAttachment(req.params.id, validation.data);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update attachment error:", error);
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

    const attachment = await storage.getAttachment(req.params.id);
    if (!attachment || attachment.eventId !== eventId) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Anexo nao encontrado" }
      });
    }

    await storage.deleteAttachment(req.params.id);
    res.json({ success: true, data: { message: "Anexo removido com sucesso" } });
  } catch (error) {
    console.error("Delete attachment error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

export default router;
