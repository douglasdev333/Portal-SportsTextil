import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import ExcelJS from "exceljs";
import { storage } from "../../storage";
import { requireAuth, requireRole, checkEventOwnership } from "../../middleware/auth";
import { utcToBrazilLocal, localToBrazilUTC } from "../../utils/timezone";

const router = Router({ mergeParams: true });

function generateVoucherCode(length: number = 8): string {
  return crypto.randomBytes(length / 2).toString("hex").toUpperCase();
}

function formatVoucherBatchForResponse(batch: any) {
  return {
    ...batch,
    validFrom: utcToBrazilLocal(batch.validFrom),
    validUntil: utcToBrazilLocal(batch.validUntil),
    createdAt: utcToBrazilLocal(batch.createdAt),
  };
}

function formatVoucherForResponse(voucher: any) {
  return {
    ...voucher,
    validFrom: utcToBrazilLocal(voucher.validFrom),
    validUntil: utcToBrazilLocal(voucher.validUntil),
    createdAt: utcToBrazilLocal(voucher.createdAt),
  };
}

const batchCreateSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  quantidade: z.number().int().min(1).max(50000, "Maximo de 50.000 vouchers por lote"),
  validFrom: z.string().refine(val => !isNaN(Date.parse(val)), "Data de inicio invalida"),
  validUntil: z.string().refine(val => !isNaN(Date.parse(val)), "Data de termino invalida"),
  descricao: z.string().optional().nullable(),
});

const voucherCreateSchema = z.object({
  code: z.string().min(4, "Codigo deve ter pelo menos 4 caracteres").max(20, "Codigo deve ter no maximo 20 caracteres").optional(),
  validFrom: z.string().refine(val => !isNaN(Date.parse(val)), "Data de inicio invalida"),
  validUntil: z.string().refine(val => !isNaN(Date.parse(val)), "Data de termino invalida"),
});

router.get("/batches", requireAuth, async (req, res) => {
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

    const batches = await storage.getVoucherBatchesByEvent(eventId);
    res.json({ success: true, data: batches.map(formatVoucherBatchForResponse) });
  } catch (error) {
    console.error("Get voucher batches error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.post("/batches", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
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

    const userId = (req as any).user?.id;
    
    const batch = await storage.createVoucherBatch({
      eventId,
      nome: validation.data.nome,
      quantidade: validation.data.quantidade,
      validFrom: localToBrazilUTC(validation.data.validFrom),
      validUntil: localToBrazilUTC(validation.data.validUntil),
      descricao: validation.data.descricao,
      createdBy: userId,
    });

    const vouchers: any[] = [];
    const existingCodes = new Set<string>();
    
    for (let i = 0; i < validation.data.quantidade; i++) {
      let code: string;
      let attempts = 0;
      let isUnique = false;
      do {
        code = generateVoucherCode(8);
        attempts++;
        if (attempts > 100) {
          throw new Error("Falha ao gerar codigos unicos");
        }
        if (!existingCodes.has(code)) {
          const uniqueCheck = await storage.isCodeGloballyUnique(eventId, code);
          isUnique = uniqueCheck.isUnique;
        }
      } while (existingCodes.has(code) || !isUnique);
      
      existingCodes.add(code);
      vouchers.push({
        eventId,
        batchId: batch.id,
        code,
        validFrom: localToBrazilUTC(validation.data.validFrom),
        validUntil: localToBrazilUTC(validation.data.validUntil),
      });
    }

    await storage.createVouchersBulk(vouchers);

    res.status(201).json({ 
      success: true, 
      data: {
        batch: formatVoucherBatchForResponse(batch),
        vouchersCreated: vouchers.length
      }
    });
  } catch (error) {
    console.error("Create voucher batch error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

const batchUpdateSchema = z.object({
  validFrom: z.string().refine(val => !isNaN(Date.parse(val)), "Data de inicio invalida").optional(),
  validUntil: z.string().refine(val => !isNaN(Date.parse(val)), "Data de termino invalida").optional(),
});

router.patch("/batches/:batchId", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const batchId = req.params.batchId;
    
    const batch = await storage.getVoucherBatch(batchId);
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

    const updateData: any = {};
    if (validation.data.validFrom) {
      updateData.validFrom = localToBrazilUTC(validation.data.validFrom);
    }
    if (validation.data.validUntil) {
      updateData.validUntil = localToBrazilUTC(validation.data.validUntil);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Nenhum campo para atualizar" }
      });
    }

    const updatedBatch = await storage.updateVoucherBatch(batchId, updateData);
    
    const vouchersUpdated = await storage.updateVouchersByBatch(batchId, updateData);

    res.json({ 
      success: true, 
      data: {
        batch: updatedBatch ? formatVoucherBatchForResponse(updatedBatch) : null,
        vouchersUpdated
      }
    });
  } catch (error) {
    console.error("Update voucher batch error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
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

    const vouchers = await storage.getVouchersByEvent(eventId);
    
    const vouchersWithUsage = await Promise.all(
      vouchers.map(async (voucher) => {
        const usage = await storage.getVoucherUsage(voucher.id);
        return {
          ...formatVoucherForResponse(voucher),
          usage: usage ? {
            usedAt: utcToBrazilLocal(usage.usedAt),
            userId: usage.userId,
            registrationId: usage.registrationId,
          } : null,
        };
      })
    );

    res.json({ success: true, data: vouchersWithUsage });
  } catch (error) {
    console.error("Get vouchers error:", error);
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

    const validation = voucherCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const code = validation.data.code || generateVoucherCode(8);
    
    const uniqueCheck = await storage.isCodeGloballyUnique(eventId, code);
    if (!uniqueCheck.isUnique) {
      return res.status(400).json({
        success: false,
        error: { 
          code: "DUPLICATE_CODE", 
          message: uniqueCheck.type === "coupon" 
            ? "Este codigo ja esta em uso como cupom de desconto" 
            : "Codigo de voucher ja existe para este evento" 
        }
      });
    }

    const voucher = await storage.createVoucher({
      eventId,
      code,
      validFrom: localToBrazilUTC(validation.data.validFrom),
      validUntil: localToBrazilUTC(validation.data.validUntil),
    });

    res.status(201).json({ success: true, data: formatVoucherForResponse(voucher) });
  } catch (error) {
    console.error("Create voucher error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.delete("/:voucherId", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const voucherId = req.params.voucherId;
    
    const voucher = await storage.getVoucher(voucherId);
    if (!voucher || voucher.eventId !== eventId) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Voucher nao encontrado" }
      });
    }

    if (voucher.status === "used") {
      return res.status(400).json({
        success: false,
        error: { code: "VOUCHER_USED", message: "Nao e possivel excluir voucher ja utilizado" }
      });
    }

    await storage.deleteVoucher(voucherId);
    res.json({ success: true, data: { message: "Voucher removido com sucesso" } });
  } catch (error) {
    console.error("Delete voucher error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.get("/report", requireAuth, async (req, res) => {
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

    const vouchers = await storage.getVouchersByEvent(eventId);
    const now = new Date();
    
    const report = {
      total: vouchers.length,
      available: vouchers.filter(v => v.status === "available" && new Date(v.validUntil) >= now).length,
      used: vouchers.filter(v => v.status === "used").length,
      expired: vouchers.filter(v => v.status === "expired" || (v.status === "available" && new Date(v.validUntil) < now)).length,
    };

    res.json({ success: true, data: report });
  } catch (error) {
    console.error("Get voucher report error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

router.get("/export", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const batchId = req.query.batchId as string | undefined;
    const format = (req.query.format as string) || "xlsx";
    
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

    let vouchers = await storage.getVouchersByEvent(eventId);
    const batches = await storage.getVoucherBatchesByEvent(eventId);
    const batchMap = new Map(batches.map(b => [b.id, b.nome]));

    let selectedBatchName = "";
    if (batchId) {
      vouchers = vouchers.filter(v => v.batchId === batchId);
      selectedBatchName = batchMap.get(batchId) || batchId;
    }

    const usageDataMap = new Map<string, { usedAt: Date; userId: string }>();
    const userInfoMap = new Map<string, { nome: string; email: string }>();
    
    for (const v of vouchers) {
      if (v.status === "used") {
        const usage = await storage.getVoucherUsage(v.id);
        if (usage) {
          usageDataMap.set(v.id, { usedAt: usage.usedAt, userId: usage.userId });
          if (!userInfoMap.has(usage.userId)) {
            const athlete = await storage.getAthlete(usage.userId);
            if (athlete) {
              userInfoMap.set(usage.userId, { nome: athlete.nome, email: athlete.email });
            }
          }
        }
      }
    }

    const now = new Date();
    
    const exportData = vouchers.map(v => {
      const status = v.status === "used" ? "Usado" : 
                     new Date(v.validUntil) < now ? "Expirado" : "Disponivel";
      const batchName = v.batchId ? (batchMap.get(v.batchId) || v.batchId) : "-";
      const usageData = usageDataMap.get(v.id);
      const userInfo = usageData ? userInfoMap.get(usageData.userId) : null;
      
      return {
        codigo: v.code,
        lote: batchName,
        status: status,
        validoDe: new Date(v.validFrom).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        validoAte: new Date(v.validUntil).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        usado: v.status === "used" ? "Sim" : "Nao",
        dataUso: usageData ? new Date(usageData.usedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "-",
        atleta: userInfo ? userInfo.nome : "-",
        emailAtleta: userInfo ? userInfo.email : "-",
        criadoEm: new Date(v.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
      };
    });

    const batchSuffix = selectedBatchName ? `_lote-${selectedBatchName.replace(/[^a-zA-Z0-9]/g, '-')}` : "";
    const baseFilename = `vouchers_${event.slug || eventId}${batchSuffix}_${new Date().toISOString().split("T")[0]}`;

    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "ST Eventos";
      workbook.created = new Date();
      
      const worksheet = workbook.addWorksheet("Vouchers");
      
      worksheet.columns = [
        { header: "Codigo", key: "codigo", width: 15 },
        { header: "Lote", key: "lote", width: 25 },
        { header: "Status", key: "status", width: 12 },
        { header: "Valido De", key: "validoDe", width: 20 },
        { header: "Valido Ate", key: "validoAte", width: 20 },
        { header: "Usado", key: "usado", width: 8 },
        { header: "Data de Uso", key: "dataUso", width: 20 },
        { header: "Atleta", key: "atleta", width: 30 },
        { header: "Email Atleta", key: "emailAtleta", width: 35 },
        { header: "Criado Em", key: "criadoEm", width: 20 }
      ];
      
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E3A5F" }
      };
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      
      for (const row of exportData) {
        const addedRow = worksheet.addRow(row);
        if (row.status === "Usado") {
          addedRow.getCell("status").fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD4EDDA" }
          };
        } else if (row.status === "Expirado") {
          addedRow.getCell("status").fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8D7DA" }
          };
        }
      }
      
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: exportData.length + 1, column: 10 }
      };
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${baseFilename}.xlsx"`);
      
      await workbook.xlsx.write(res);
      res.end();
    } else {
      const headers = ["Codigo", "Lote", "Status", "Valido De", "Valido Ate", "Usado", "Data de Uso", "Atleta", "Email Atleta", "Criado Em"];
      const csvRows = [headers.join(";")];
      
      for (const row of exportData) {
        csvRows.push([
          row.codigo,
          row.lote,
          row.status,
          row.validoDe,
          row.validoAte,
          row.usado,
          row.dataUso,
          row.atleta,
          row.emailAtleta,
          row.criadoEm
        ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";"));
      }

      const csv = csvRows.join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${baseFilename}.csv"`);
      res.send("\uFEFF" + csv);
    }
  } catch (error) {
    console.error("Export vouchers error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
    });
  }
});

export default router;
