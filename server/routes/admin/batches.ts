import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { requireAuth, requireRole, checkEventOwnership } from "../../middleware/auth";
import { localToBrazilUTC, localToBrazilUTCOptional, utcToBrazilLocal } from "../../utils/timezone";

const router = Router({ mergeParams: true });

function formatBatchForResponse(batch: any) {
  return {
    ...batch,
    dataInicio: utcToBrazilLocal(batch.dataInicio),
    dataTermino: batch.dataTermino ? utcToBrazilLocal(batch.dataTermino) : null,
  };
}

const batchCreateSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  dataInicio: z.string().refine(val => !isNaN(Date.parse(val)), "Data de inicio invalida"),
  dataTermino: z.string().refine(val => val === "" || !isNaN(Date.parse(val)), "Data de termino invalida").optional().nullable().transform(val => val === "" ? null : val),
  quantidadeMaxima: z.number().int().positive().optional().nullable(),
  ativo: z.boolean().optional(),
  status: z.enum(["active", "closed", "future"]).optional(),
  ordem: z.number().int().optional()
});

const batchUpdateSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
  dataInicio: z.string().refine(val => !isNaN(Date.parse(val)), "Data de inicio invalida").optional(),
  dataTermino: z.string().refine(val => val === "" || !isNaN(Date.parse(val)), "Data de termino invalida").optional().nullable().transform(val => val === "" ? null : val),
  quantidadeMaxima: z.number().int().positive().optional().nullable(),
  ordem: z.number().int().optional()
});

async function validateSingleActiveBatch(eventId: string, newStatus: string | undefined, excludeBatchId?: string): Promise<{ valid: boolean; error?: string; activeBatches?: any[] }> {
  if (newStatus !== 'active') {
    return { valid: true };
  }
  
  const existingBatches = await storage.getBatchesByEvent(eventId);
  const activeBatches = existingBatches.filter(b => 
    b.status === 'active' && b.id !== excludeBatchId
  );
  
  if (activeBatches.length > 0) {
    return { 
      valid: false, 
      error: "Somente um lote pode estar com status 'active' ao mesmo tempo.",
      activeBatches
    };
  }
  
  return { valid: true };
}

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

    const batches = await storage.getBatchesByEvent(eventId);
    res.json({ success: true, data: batches.map(formatBatchForResponse) });
  } catch (error) {
    console.error("Get batches error:", error);
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

    const validation = batchCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const maxOrdem = await storage.getMaxBatchOrder(eventId);
    const nextOrder = maxOrdem + 1;

    const willBeAtivo = validation.data.ativo ?? false;
    const willBeStatus = validation.data.status ?? 'future';

    const ordemToUse = validation.data.ordem ?? nextOrder;

    const ordemExists = await storage.checkBatchOrderExists(eventId, ordemToUse);
    if (ordemExists) {
      return res.status(400).json({
        success: false,
        error: { 
          code: "ORDER_INDEX_ALREADY_EXISTS", 
          message: "Ja existe um lote usando essa ordem. Altere a ordem dos demais ou utilize outro numero." 
        }
      });
    }

    const activeBatchValidation = await validateSingleActiveBatch(eventId, willBeStatus);
    if (!activeBatchValidation.valid) {
      return res.status(400).json({
        success: false,
        error: { code: "MULTIPLE_ACTIVE_BATCHES", message: activeBatchValidation.error }
      });
    }

    const batch = await storage.createBatch({
      ...validation.data,
      eventId,
      dataInicio: localToBrazilUTC(validation.data.dataInicio),
      dataTermino: localToBrazilUTCOptional(validation.data.dataTermino),
      ativo: willBeAtivo,
      status: willBeStatus,
      ordem: ordemToUse
    });

    res.status(201).json({ success: true, data: formatBatchForResponse(batch) });
  } catch (error) {
    console.error("Create batch error:", error);
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

    const batch = await storage.getBatch(req.params.id);
    if (!batch || batch.eventId !== eventId) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Lote nao encontrado" }
      });
    }

    const validation = batchUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    if (validation.data.ordem !== undefined) {
      const ordemExists = await storage.checkBatchOrderExists(eventId, validation.data.ordem, req.params.id);
      if (ordemExists) {
        return res.status(400).json({
          success: false,
          error: { 
            code: "ORDER_INDEX_ALREADY_EXISTS", 
            message: "Ja existe um lote usando essa ordem. Altere a ordem dos demais ou utilize outro numero." 
          }
        });
      }
    }

    const updateData: Record<string, unknown> = { ...validation.data };
    if (validation.data.dataInicio) {
      updateData.dataInicio = localToBrazilUTC(validation.data.dataInicio);
    }
    if (validation.data.dataTermino !== undefined) {
      updateData.dataTermino = localToBrazilUTCOptional(validation.data.dataTermino);
    }

    const updated = await storage.updateBatch(req.params.id, updateData);
    res.json({ success: true, data: formatBatchForResponse(updated) });
  } catch (error) {
    console.error("Update batch error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.post("/:id/activate", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const batchId = req.params.id;
    const { closeOthers, publishEvent } = req.body;
    
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento nao encontrado" }
      });
    }

    const batch = await storage.getBatch(batchId);
    if (!batch || batch.eventId !== eventId) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Lote nao encontrado" }
      });
    }

    const existingBatches = await storage.getBatchesByEvent(eventId);
    const activeBatches = existingBatches.filter(b => 
      b.status === 'active' && b.id !== batchId
    );

    if (activeBatches.length > 0 && !closeOthers) {
      return res.status(409).json({
        success: false,
        error: { 
          code: "ACTIVE_BATCH_EXISTS", 
          message: "Existe um lote com status 'active'. Confirme para fechar os outros lotes.",
          activeBatches: activeBatches.map(b => ({
            id: b.id,
            nome: b.nome,
            status: b.status
          }))
        }
      });
    }

    if (closeOthers && activeBatches.length > 0) {
      for (const activeBatch of activeBatches) {
        await storage.updateBatch(activeBatch.id, { status: 'closed' });
      }
    }

    const updated = await storage.updateBatch(batchId, { status: 'active', ativo: true });
    
    const isEventNotPublished = event.status !== 'publicado';
    const eventNeedsPublish = isEventNotPublished && (event.status === 'rascunho' || event.status === 'finalizado' || event.status === 'esgotado');
    
    if (eventNeedsPublish && publishEvent === true) {
      await storage.updateEvent(eventId, { status: 'publicado' });
    }
    
    res.json({ 
      success: true, 
      data: formatBatchForResponse(updated),
      eventStatus: event.status,
      eventNeedsPublish: eventNeedsPublish
    });
  } catch (error) {
    console.error("Activate batch error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.post("/:id/close", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const batchId = req.params.id;
    
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento nao encontrado" }
      });
    }

    const batch = await storage.getBatch(batchId);
    if (!batch || batch.eventId !== eventId) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Lote nao encontrado" }
      });
    }

    const updated = await storage.updateBatch(batchId, { status: 'closed' });
    res.json({ success: true, data: formatBatchForResponse(updated) });
  } catch (error) {
    console.error("Close batch error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.post("/:id/set-future", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const batchId = req.params.id;
    
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento nao encontrado" }
      });
    }

    const batch = await storage.getBatch(batchId);
    if (!batch || batch.eventId !== eventId) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Lote nao encontrado" }
      });
    }

    if (batch.status === 'active') {
      return res.status(400).json({
        success: false,
        error: { 
          code: "CANNOT_SET_FUTURE_ACTIVE", 
          message: "Nao e possivel marcar um lote ativo como futuro. Feche-o primeiro ou ative outro lote." 
        }
      });
    }

    const updated = await storage.updateBatch(batchId, { status: 'future' });
    res.json({ success: true, data: formatBatchForResponse(updated) });
  } catch (error) {
    console.error("Set future batch error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.patch("/:id/visibility", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const batchId = req.params.id;
    const { ativo } = req.body;
    
    if (typeof ativo !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Campo 'ativo' deve ser um booleano" }
      });
    }
    
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Evento nao encontrado" }
      });
    }

    const batch = await storage.getBatch(batchId);
    if (!batch || batch.eventId !== eventId) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Lote nao encontrado" }
      });
    }

    const updated = await storage.updateBatch(batchId, { ativo });
    res.json({ success: true, data: formatBatchForResponse(updated) });
  } catch (error) {
    console.error("Update visibility error:", error);
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

    const batch = await storage.getBatch(req.params.id);
    if (!batch || batch.eventId !== eventId) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Lote nao encontrado" }
      });
    }

    const deleteResult = await storage.deleteBatchSafe(req.params.id);
    
    if (!deleteResult.success) {
      const statusCode = deleteResult.code === "BATCH_HAS_REGISTRATIONS" ? 400 : 
                        deleteResult.code === "NOT_FOUND" ? 404 : 500;
      return res.status(statusCode).json({
        success: false,
        error: { 
          code: deleteResult.code, 
          message: deleteResult.message 
        }
      });
    }

    res.json({ success: true, data: { message: "Lote removido com sucesso" } });
  } catch (error: any) {
    console.error("Delete batch error:", error);
    
    if (error?.code === "23503") {
      return res.status(400).json({
        success: false,
        error: { 
          code: "FK_CONSTRAINT_VIOLATION", 
          message: "O lote possui dependencias que impedem a exclusao." 
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

export default router;
