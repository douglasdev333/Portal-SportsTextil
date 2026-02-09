import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { hashPassword } from "../../utils/password";
import { requireAuth, requireRole } from "../../middleware/auth";

const router = Router();

router.use(requireAuth);

const createUserSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  role: z.enum(["superadmin", "admin", "organizador"]),
  organizerId: z.string().uuid().optional().nullable()
}).refine(
  (data) => {
    if (data.role === "organizador" && !data.organizerId) {
      return false;
    }
    return true;
  },
  { message: "Organizador deve estar vinculado a um organizador", path: ["organizerId"] }
);

const updateUserSchema = z.object({
  email: z.string().email("Email invalido").optional(),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional(),
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
  role: z.enum(["superadmin", "admin", "organizador"]).optional(),
  status: z.enum(["ativo", "inativo", "bloqueado"]).optional(),
  organizerId: z.string().uuid().optional().nullable()
});

router.get("/", requireRole("superadmin"), async (req, res) => {
  try {
    const users = await storage.getAdminUsers();
    const safeUsers = users.map(({ passwordHash, ...user }) => user);
    res.json({ success: true, data: safeUsers });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.get("/:id", requireRole("superadmin"), async (req, res) => {
  try {
    const user = await storage.getAdminUser(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Usuario nao encontrado" }
      });
    }
    const { passwordHash, ...safeUser } = user;
    res.json({ success: true, data: safeUser });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.post("/", requireRole("superadmin"), async (req, res) => {
  try {
    const validation = createUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const { email, password, nome, role, organizerId } = validation.data;

    const existingUser = await storage.getAdminUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: { code: "EMAIL_EXISTS", message: "Email ja cadastrado" }
      });
    }

    if (organizerId) {
      const organizer = await storage.getOrganizer(organizerId);
      if (!organizer) {
        return res.status(400).json({
          success: false,
          error: { code: "ORGANIZER_NOT_FOUND", message: "Organizador nao encontrado" }
        });
      }
    }

    const passwordHash = hashPassword(password);
    const user = await storage.createAdminUser({
      email,
      passwordHash,
      nome,
      role,
      status: "ativo",
      organizerId: organizerId || null
    });

    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json({ success: true, data: safeUser });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.patch("/:id", requireRole("superadmin"), async (req, res) => {
  try {
    const user = await storage.getAdminUser(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Usuario nao encontrado" }
      });
    }


    const validation = updateUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const { email, password, nome, role, status, organizerId } = validation.data;

    if (email && email !== user.email) {
      const existingUser = await storage.getAdminUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: { code: "EMAIL_EXISTS", message: "Email ja cadastrado" }
        });
      }
    }

    if (organizerId) {
      const organizer = await storage.getOrganizer(organizerId);
      if (!organizer) {
        return res.status(400).json({
          success: false,
          error: { code: "ORGANIZER_NOT_FOUND", message: "Organizador nao encontrado" }
        });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (email) updateData.email = email;
    if (nome) updateData.nome = nome;
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (password) updateData.passwordHash = hashPassword(password);
    if (organizerId !== undefined) updateData.organizerId = organizerId;

    const updatedUser = await storage.updateAdminUser(req.params.id, updateData);
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Usuario nao encontrado" }
      });
    }

    const { passwordHash: _, ...safeUser } = updatedUser;
    res.json({ success: true, data: safeUser });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.delete("/:id", requireRole("superadmin"), async (req, res) => {
  try {
    const user = await storage.getAdminUser(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Usuario nao encontrado" }
      });
    }

    if (user.role === "superadmin") {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Nao e possivel excluir superadmin" }
      });
    }

    if (user.id === req.adminUser?.id) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Nao e possivel excluir seu proprio usuario" }
      });
    }

    await storage.deleteAdminUser(req.params.id);
    res.json({ success: true, data: { message: "Usuario excluido com sucesso" } });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.get("/by-organizer/:organizerId", requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const users = await storage.getAdminUsersByOrganizer(req.params.organizerId);
    const safeUsers = users.map(({ passwordHash, ...user }) => user);
    res.json({ success: true, data: safeUsers });
  } catch (error) {
    console.error("List users by organizer error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

export default router;
