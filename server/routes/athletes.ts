import { Router } from "express";
import { storage } from "../storage";
import { insertAthleteSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

const loginSchema = z.object({
  cpf: z.string().min(11).max(14),
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD")
});

const registerSchema = insertAthleteSchema.extend({
  cpf: z.string().min(11).max(14),
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD")
});

function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

router.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Dados inválidos",
        details: parsed.error.flatten() 
      });
    }

    const { cpf, dataNascimento } = parsed.data;
    const normalizedCpf = normalizeCpf(cpf);
    
    let athlete = await storage.getAthleteByCpf(normalizedCpf);
    if (!athlete) {
      athlete = await storage.getAthleteByCpf(cpf);
    }
    
    if (!athlete) {
      return res.status(404).json({ 
        success: false, 
        error: "Atleta não encontrado. Verifique o CPF ou faça seu cadastro." 
      });
    }

    const athleteBirthDate = new Date(athlete.dataNascimento).toISOString().split('T')[0];
    if (athleteBirthDate !== dataNascimento) {
      return res.status(401).json({ 
        success: false, 
        error: "Data de nascimento incorreta" 
      });
    }

    (req.session as any).athleteId = athlete.id;

    req.session.save((err) => {
      if (err) {
        console.error("Erro ao salvar sessão:", err);
        return res.status(500).json({ success: false, error: "Erro ao criar sessão" });
      }
      
      res.json({ 
        success: true, 
        data: {
          id: athlete.id,
          nome: athlete.nome,
          cpf: athlete.cpf,
          email: athlete.email,
          telefone: athlete.telefone,
          cidade: athlete.cidade,
          estado: athlete.estado,
          dataNascimento: athlete.dataNascimento,
          sexo: athlete.sexo
        }
      });
    });
  } catch (error) {
    console.error("Erro ao fazer login:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Dados inválidos",
        details: parsed.error.flatten() 
      });
    }

    const existingAthleteByCpf = await storage.getAthleteByCpf(parsed.data.cpf);
    if (existingAthleteByCpf) {
      return res.status(409).json({ 
        success: false, 
        error: "CPF já cadastrado. Faça login com suas credenciais." 
      });
    }

    const existingAthleteByEmail = await storage.getAthleteByEmail(parsed.data.email);
    if (existingAthleteByEmail) {
      return res.status(409).json({ 
        success: false, 
        error: "E-mail já cadastrado. Use outro e-mail ou faça login." 
      });
    }

    const athlete = await storage.createAthlete(parsed.data);
    
    (req.session as any).athleteId = athlete.id;

    res.status(201).json({ 
      success: true, 
      data: {
        id: athlete.id,
        nome: athlete.nome,
        cpf: athlete.cpf,
        email: athlete.email,
        telefone: athlete.telefone,
        cidade: athlete.cidade,
        estado: athlete.estado,
        dataNascimento: athlete.dataNascimento,
        sexo: athlete.sexo
      }
    });
  } catch (error) {
    console.error("Erro ao cadastrar atleta:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const athleteId = (req.session as any)?.athleteId;
    
    if (!athleteId) {
      return res.status(401).json({ 
        success: false, 
        error: "Não autenticado" 
      });
    }

    const athlete = await storage.getAthlete(athleteId);
    
    if (!athlete) {
      return res.status(404).json({ 
        success: false, 
        error: "Atleta não encontrado" 
      });
    }

    res.json({ 
      success: true, 
      data: {
        id: athlete.id,
        nome: athlete.nome,
        cpf: athlete.cpf,
        email: athlete.email,
        telefone: athlete.telefone,
        cidade: athlete.cidade,
        estado: athlete.estado,
        cep: athlete.cep,
        rua: athlete.rua,
        numero: athlete.numero,
        complemento: athlete.complemento,
        dataNascimento: athlete.dataNascimento,
        sexo: athlete.sexo,
        escolaridade: athlete.escolaridade,
        profissao: athlete.profissao
      }
    });
  } catch (error) {
    console.error("Erro ao buscar dados do atleta:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.put("/me", async (req, res) => {
  try {
    const athleteId = (req.session as any)?.athleteId;
    
    if (!athleteId) {
      return res.status(401).json({ 
        success: false, 
        error: "Não autenticado" 
      });
    }

    const updateSchema = z.object({
      nome: z.string().min(2).optional(),
      email: z.string().email().optional(),
      telefone: z.string().min(10).optional(),
      estado: z.string().length(2).optional(),
      cidade: z.string().min(2).optional(),
      cep: z.string().max(9).optional(),
      rua: z.string().optional(),
      numero: z.string().max(20).optional(),
      complemento: z.string().optional(),
      escolaridade: z.string().optional(),
      profissao: z.string().optional(),
      dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD").optional(),
      sexo: z.string().optional()
    });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Dados inválidos",
        details: parsed.error.flatten() 
      });
    }

    const updatedAthlete = await storage.updateAthlete(athleteId, parsed.data);
    
    if (!updatedAthlete) {
      return res.status(404).json({ 
        success: false, 
        error: "Atleta não encontrado" 
      });
    }

    res.json({ 
      success: true, 
      data: {
        id: updatedAthlete.id,
        nome: updatedAthlete.nome,
        cpf: updatedAthlete.cpf,
        email: updatedAthlete.email,
        telefone: updatedAthlete.telefone,
        cidade: updatedAthlete.cidade,
        estado: updatedAthlete.estado,
        cep: updatedAthlete.cep,
        rua: updatedAthlete.rua,
        numero: updatedAthlete.numero,
        complemento: updatedAthlete.complemento,
        dataNascimento: updatedAthlete.dataNascimento,
        sexo: updatedAthlete.sexo,
        escolaridade: updatedAthlete.escolaridade,
        profissao: updatedAthlete.profissao
      }
    });
  } catch (error) {
    console.error("Erro ao atualizar dados do atleta:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.post("/logout", (req, res) => {
  (req.session as any).athleteId = null;
  res.json({ success: true });
});

export default router;
