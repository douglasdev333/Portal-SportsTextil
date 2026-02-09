import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const router = Router();

const validateVoucherSchema = z.object({
  code: z.string().min(1, "Código do voucher é obrigatório"),
  eventId: z.string().min(1, "ID do evento é obrigatório"),
});

router.post("/validate", async (req, res) => {
  try {
    const validation = validateVoucherSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error.errors[0].message }
      });
    }

    const { code, eventId } = validation.data;
    
    const voucher = await storage.getVoucherByCode(eventId, code.toUpperCase().trim());
    
    if (!voucher) {
      return res.status(404).json({
        success: false,
        error: { code: "VOUCHER_NOT_FOUND", message: "Voucher não encontrado. Verifique se o código está correto e pertence a este evento." }
      });
    }

    const now = new Date();
    
    if (new Date(voucher.validFrom) > now) {
      const validFromDate = new Date(voucher.validFrom).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      return res.status(422).json({
        success: false,
        error: { code: "VOUCHER_NOT_VALID_YET", message: `Este voucher ainda não está válido. Válido a partir de ${validFromDate}.` }
      });
    }

    if (new Date(voucher.validUntil) < now) {
      const validUntilDate = new Date(voucher.validUntil).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      return res.status(422).json({
        success: false,
        error: { code: "VOUCHER_EXPIRED", message: `Este voucher expirou em ${validUntilDate}.` }
      });
    }

    if (voucher.status === "used") {
      return res.status(409).json({
        success: false,
        error: { code: "VOUCHER_ALREADY_USED", message: "Este voucher já foi utilizado em outra inscrição." }
      });
    }

    if (voucher.status === "expired") {
      return res.status(422).json({
        success: false,
        error: { code: "VOUCHER_EXPIRED", message: "Este voucher expirou e não pode mais ser utilizado." }
      });
    }

    let batchName = null;
    if (voucher.batchId) {
      const batch = await storage.getVoucherBatch(voucher.batchId);
      batchName = batch?.nome;
    }

    res.json({
      success: true,
      data: {
        voucher: {
          id: voucher.id,
          code: voucher.code,
          batchName,
          validUntil: voucher.validUntil,
        }
      }
    });
  } catch (error) {
    console.error("Validate voucher error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Erro ao validar voucher. Por favor, tente novamente." }
    });
  }
});

export default router;
