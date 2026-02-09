import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { requireAuth, requireRole } from "../../middleware/auth";
import { isValidCPFOrCNPJ, isValidEmail, isValidPhone } from "../../utils/validators";

const router = Router();

const organizerSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  cpfCnpj: z.string().refine(isValidCPFOrCNPJ, "CPF ou CNPJ invalido"),
  email: z.string().refine(isValidEmail, "Email invalido"),
  telefone: z.string().refine(isValidPhone, "Telefone invalido")
});

router.get("/", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const organizers = await storage.getOrganizers();
    res.json({ success: true, data: organizers });
  } catch (error) {
    console.error("Get organizers error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.get("/:id", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const organizer = await storage.getOrganizer(req.params.id);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Organizador nao encontrado" }
      });
    }
    res.json({ success: true, data: organizer });
  } catch (error) {
    console.error("Get organizer error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.post("/", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const validation = organizerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const existing = await storage.getOrganizerByCpfCnpj(validation.data.cpfCnpj);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: "DUPLICATE_CPF_CNPJ", message: "Ja existe um organizador com este CPF/CNPJ" }
      });
    }

    const organizer = await storage.createOrganizer(validation.data);
    res.status(201).json({ success: true, data: organizer });
  } catch (error) {
    console.error("Create organizer error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.patch("/:id", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const organizer = await storage.getOrganizer(req.params.id);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Organizador nao encontrado" }
      });
    }

    const updateSchema = organizerSchema.partial();
    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    if (validation.data.cpfCnpj && validation.data.cpfCnpj !== organizer.cpfCnpj) {
      const existing = await storage.getOrganizerByCpfCnpj(validation.data.cpfCnpj);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: { code: "DUPLICATE_CPF_CNPJ", message: "Ja existe um organizador com este CPF/CNPJ" }
        });
      }
    }

    const updated = await storage.updateOrganizer(req.params.id, validation.data);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update organizer error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.delete("/:id", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const organizer = await storage.getOrganizer(req.params.id);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Organizador nao encontrado" }
      });
    }

    const events = await storage.getEventsByOrganizer(req.params.id);
    if (events.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: "HAS_EVENTS", message: "Nao e possivel excluir organizador com eventos" }
      });
    }

    await storage.deleteOrganizer(req.params.id);
    res.json({ success: true, data: { message: "Organizador removido com sucesso" } });
  } catch (error) {
    console.error("Delete organizer error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

export default router;
