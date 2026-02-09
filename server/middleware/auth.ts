import type { Request, Response, NextFunction } from "express";
import type { AdminUser, UserRole } from "@shared/schema";
import { storage } from "../storage";

declare global {
  namespace Express {
    interface Request {
      adminUser?: AdminUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.adminUserId) {
    return res.status(401).json({ 
      success: false, 
      error: { code: "UNAUTHORIZED", message: "Autenticação necessária" } 
    });
  }

  try {
    const user = await storage.getAdminUser(req.session.adminUserId);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: { code: "UNAUTHORIZED", message: "Usuário não encontrado" } 
      });
    }

    if (user.status !== "ativo") {
      return res.status(403).json({ 
        success: false, 
        error: { code: "USER_INACTIVE", message: "Usuario inativo ou bloqueado" } 
      });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ 
      success: false, 
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" } 
    });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.adminUser) {
      return res.status(401).json({ 
        success: false, 
        error: { code: "UNAUTHORIZED", message: "Autenticação necessária" } 
      });
    }
    
    if (!allowedRoles.includes(req.adminUser.role)) {
      return res.status(403).json({ 
        success: false, 
        error: { code: "FORBIDDEN", message: "Permissão negada" } 
      });
    }
    
    next();
  };
}

export async function checkEventOwnership(req: Request, res: Response, eventId: string, preloadedEvent?: { organizerId: string | null }): Promise<boolean> {
  if (!req.adminUser) return false;
  
  if (req.adminUser.role === "superadmin" || req.adminUser.role === "admin") {
    return true;
  }
  
  if (req.adminUser.role === "organizador") {
    if (!req.adminUser.organizerId) {
      return false;
    }
    
    const event = preloadedEvent || await storage.getEvent(eventId);
    if (!event) return false;
    
    return event.organizerId === req.adminUser.organizerId;
  }
  
  return false;
}

