import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { requireAuth, requireRole } from "../../middleware/auth";

const router = Router();

router.use(requireAuth);

const createAthleteSchema = z.object({
  cpf: z.string().min(11, "CPF invalido").max(14),
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  dataNascimento: z.string(),
  sexo: z.string(),
  email: z.string().email("Email invalido"),
  telefone: z.string().min(10, "Telefone invalido"),
  estado: z.string().length(2, "Estado invalido"),
  cidade: z.string().min(2, "Cidade invalida"),
  cep: z.string().optional().nullable(),
  rua: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  escolaridade: z.string().optional().nullable(),
  profissao: z.string().optional().nullable(),
});

const updateAthleteSchema = z.object({
  cpf: z.string().min(11, "CPF invalido").max(14).optional(),
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
  dataNascimento: z.string().optional(),
  sexo: z.string().optional(),
  email: z.string().email("Email invalido").optional(),
  telefone: z.string().min(10, "Telefone invalido").optional(),
  estado: z.string().length(2, "Estado invalido").optional(),
  cidade: z.string().min(2, "Cidade invalida").optional(),
  cep: z.string().optional().nullable(),
  rua: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  escolaridade: z.string().optional().nullable(),
  profissao: z.string().optional().nullable(),
});

router.get("/", requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const athletes = await storage.getAthletes();
    res.json({ success: true, data: athletes });
  } catch (error) {
    console.error("List athletes error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.get("/:id", requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const athlete = await storage.getAthlete(req.params.id);
    if (!athlete) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Atleta nao encontrado" }
      });
    }
    res.json({ success: true, data: athlete });
  } catch (error) {
    console.error("Get athlete error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.get("/:id/registrations", requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const athlete = await storage.getAthlete(req.params.id);
    if (!athlete) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Atleta nao encontrado" }
      });
    }

    const registrations = await storage.getRegistrationsByAthlete(req.params.id);
    
    const registrationsWithDetails = await Promise.all(
      registrations.map(async (reg) => {
        const [event, modality] = await Promise.all([
          storage.getEvent(reg.eventId),
          storage.getModality(reg.modalityId)
        ]);
        return {
          ...reg,
          eventoNome: event?.nome || "Evento desconhecido",
          modalidadeNome: modality?.nome || "Modalidade desconhecida",
        };
      })
    );

    res.json({ success: true, data: registrationsWithDetails });
  } catch (error) {
    console.error("Get athlete registrations error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.post("/", requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const validation = createAthleteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const { cpf, email } = validation.data;

    const existingByCpf = await storage.getAthleteByCpf(cpf);
    if (existingByCpf) {
      return res.status(400).json({
        success: false,
        error: { code: "CPF_EXISTS", message: "CPF ja cadastrado" }
      });
    }

    const existingByEmail = await storage.getAthleteByEmail(email);
    if (existingByEmail) {
      return res.status(400).json({
        success: false,
        error: { code: "EMAIL_EXISTS", message: "Email ja cadastrado" }
      });
    }

    const athlete = await storage.createAthlete(validation.data);
    res.status(201).json({ success: true, data: athlete });
  } catch (error) {
    console.error("Create athlete error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.patch("/:id", requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const athlete = await storage.getAthlete(req.params.id);
    if (!athlete) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Atleta nao encontrado" }
      });
    }

    const validation = updateAthleteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const { cpf, email } = validation.data;

    if (cpf && cpf !== athlete.cpf) {
      const existingByCpf = await storage.getAthleteByCpf(cpf);
      if (existingByCpf) {
        return res.status(400).json({
          success: false,
          error: { code: "CPF_EXISTS", message: "CPF ja cadastrado para outro atleta" }
        });
      }
    }

    if (email && email !== athlete.email) {
      const existingByEmail = await storage.getAthleteByEmail(email);
      if (existingByEmail) {
        return res.status(400).json({
          success: false,
          error: { code: "EMAIL_EXISTS", message: "Email ja cadastrado para outro atleta" }
        });
      }
    }

    const updatedAthlete = await storage.updateAthlete(req.params.id, validation.data);
    if (!updatedAthlete) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Atleta nao encontrado" }
      });
    }

    res.json({ success: true, data: updatedAthlete });
  } catch (error) {
    console.error("Update athlete error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

export default router;
