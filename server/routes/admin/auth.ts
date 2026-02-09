import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { hashPassword, verifyPassword } from "../../utils/password";
import { requireAuth } from "../../middleware/auth";

const router = Router();

const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres")
});

router.post("/login", async (req, res) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const { email, password } = validation.data;
    const user = await storage.getAdminUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Email ou senha incorretos" }
      });
    }

    if (user.status !== "ativo") {
      return res.status(403).json({
        success: false,
        error: { code: "USER_INACTIVE", message: "Usuario inativo ou bloqueado" }
      });
    }

    const isValidPassword = verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Email ou senha incorretos" }
      });
    }

    await storage.updateAdminUserLastLogin(user.id);

    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regeneration error:", err);
        return res.status(500).json({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Erro ao criar sessao" }
        });
      }
      
      req.session.adminUserId = user.id;
      
      const { passwordHash, ...safeUser } = user;
      res.json({ success: true, data: safeUser });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.post("/logout", requireAuth, (req, res) => {
  req.session.destroy((err: Error | null) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: { code: "LOGOUT_ERROR", message: "Erro ao fazer logout" }
      });
    }
    res.json({ success: true, data: { message: "Logout realizado com sucesso" } });
  });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.session.adminUserId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Nao autenticado" }
      });
    }

    const user = await storage.getAdminUser(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "Usuario nao encontrado" }
      });
    }

    const { passwordHash, ...safeUser } = user;
    res.json({ success: true, data: safeUser });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.post("/setup", async (req, res) => {
  try {
    const users = await storage.getAdminUsers();
    if (users.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: "SETUP_ALREADY_DONE", message: "Sistema ja foi configurado" }
      });
    }

    const setupSchema = z.object({
      email: z.string().email("Email invalido"),
      password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
      nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres")
    });

    const validation = setupSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const { email, password, nome } = validation.data;
    const passwordHash = hashPassword(password);

    const superadmin = await storage.createAdminUser({
      email,
      passwordHash,
      nome,
      role: "superadmin",
      status: "ativo"
    });

    const { passwordHash: _, ...safeUser } = superadmin;
    res.status(201).json({ success: true, data: safeUser });
  } catch (error) {
    console.error("Setup error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

export default router;
