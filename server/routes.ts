import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import path from "path";
import { storage } from "./storage";
import { utcToBrazilLocal, formatBrazilDateTime } from "./utils/timezone";
import { recalculateBatchesForEvent, getModalitiesAvailability } from "./services/batch-validation-service";

import authRoutes from "./routes/admin/auth";
import usersRoutes from "./routes/admin/users";
import organizersRoutes from "./routes/admin/organizers";
import eventsRoutes from "./routes/admin/events";
import modalitiesRoutes from "./routes/admin/modalities";
import batchesRoutes from "./routes/admin/batches";
import pricesRoutes from "./routes/admin/prices";
import shirtsRoutes from "./routes/admin/shirts";
import attachmentsRoutes from "./routes/admin/attachments";
import uploadsRoutes from "./routes/admin/uploads";
import eventStatsRoutes from "./routes/admin/eventStats";
import vouchersRoutes from "./routes/admin/vouchers";
import couponsRoutes from "./routes/admin/coupons";
import athletesRoutes from "./routes/athletes";
import adminAthletesRoutes from "./routes/admin/athletes";
import registrationsRoutes from "./routes/registrations";
import paymentsRoutes from "./routes/payments";
import webhooksRoutes from "./routes/webhooks";
import receiptsRoutes from "./routes/receipts";
import publicVouchersRoutes from "./routes/vouchers";
import publicCouponsRoutes from "./routes/coupons";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.use("/api/admin/auth", authRoutes);
  app.use("/api/admin/users", usersRoutes);
  app.use("/api/admin/organizers", organizersRoutes);
  app.use("/api/admin/events", eventsRoutes);
  app.use("/api/admin/events/:eventId/modalities", modalitiesRoutes);
  app.use("/api/admin/events/:eventId/batches", batchesRoutes);
  app.use("/api/admin/events/:eventId/prices", pricesRoutes);
  app.use("/api/admin/events/:eventId/shirts", shirtsRoutes);
  app.use("/api/admin/events/:eventId/attachments", attachmentsRoutes);
  app.use("/api/admin/uploads", uploadsRoutes);
  app.use("/api/admin/events", eventStatsRoutes);
  app.use("/api/admin/athletes", adminAthletesRoutes);
  app.use("/api/admin/events/:eventId/vouchers", vouchersRoutes);
  app.use("/api/admin/events/:eventId/coupons", couponsRoutes);

  app.use("/api/athletes", athletesRoutes);
  app.use("/api/registrations", registrationsRoutes);
  app.use("/api/payments", paymentsRoutes);
  app.use("/api/webhooks", webhooksRoutes);
  app.use("/api/receipts", receiptsRoutes);
  app.use("/api/vouchers", publicVouchersRoutes);
  app.use("/api/coupons", publicCouponsRoutes);

  function formatEventForResponse(event: any) {
    return {
      ...event,
      aberturaInscricoes: utcToBrazilLocal(event.aberturaInscricoes),
      encerramentoInscricoes: utcToBrazilLocal(event.encerramentoInscricoes),
    };
  }

  function formatBatchForResponse(batch: any) {
    return {
      ...batch,
      dataInicio: utcToBrazilLocal(batch.dataInicio),
      dataTermino: batch.dataTermino ? utcToBrazilLocal(batch.dataTermino) : null,
    };
  }

  app.get("/api/events", async (req, res) => {
    try {
      const events = await storage.getEvents();
      // Show published, sold-out and finalized events
      const publicEvents = events.filter(e => e.status === "publicado" || e.status === "esgotado" || e.status === "finalizado");
      
      // Get banners for each event if bannerUrl is not set
      const eventsWithBanners = await Promise.all(
        publicEvents.map(async (event) => {
          let bannerUrl = event.bannerUrl;
          if (!bannerUrl) {
            const banners = await storage.getEventBannersByEvent(event.id);
            if (banners.length > 0) {
              bannerUrl = banners[0].imagemUrl;
            }
          }
          return { ...formatEventForResponse(event), bannerUrl };
        })
      );
      
      res.json({ success: true, data: eventsWithBanners });
    } catch (error) {
      console.error("Get public events error:", error);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
      });
    }
  });

  app.get("/api/events/:slug", async (req, res) => {
    try {
      const event = await storage.getEventBySlug(req.params.slug);
      // Allow viewing published, sold-out and finalized events
      if (!event || (event.status !== "publicado" && event.status !== "esgotado" && event.status !== "finalizado")) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Evento nao encontrado" }
        });
      }

      // IMPORTANT: Recalculate batches before returning event data
      // This ensures batch status is up-to-date (expired batches closed, next activated, etc.)
      try {
        await recalculateBatchesForEvent(event.id);
      } catch (batchError) {
        console.error("Error recalculating batches:", batchError);
        // Continue even if batch recalculation fails
      }

      // Get modalities availability (includes sold out status)
      let modalitiesAvailability;
      try {
        modalitiesAvailability = await getModalitiesAvailability(event.id);
      } catch (availError) {
        console.error("Error getting modalities availability:", availError);
        modalitiesAvailability = null;
      }

      const [modalities, batches, prices, attachments, banners] = await Promise.all([
        storage.getModalitiesByEvent(event.id),
        storage.getBatchesByEvent(event.id),
        storage.getPricesByEvent(event.id),
        storage.getAttachmentsByEvent(event.id),
        storage.getEventBannersByEvent(event.id)
      ]);

      // Refresh event status after recalculation
      const updatedEvent = await storage.getEventBySlug(req.params.slug);
      const currentEvent = updatedEvent || event;

      const activeBatch = batches.find(b => b.ativo && b.status === 'active');
      
      // Get all active batches (ativo = true) for display
      const activeBatches = batches.filter(b => b.ativo).sort((a, b) => a.ordem - b.ordem);

      // Add availability info to modalities and convert legacy mapaPercursoUrl
      const modalitiesWithAvailability = modalities.map(mod => {
        const availInfo = modalitiesAvailability?.modalities?.find(m => m.id === mod.id);
        
        // Fallback: convert legacy mapaPercursoUrl to linksPercurso format if needed
        let linksPercurso = mod.linksPercurso;
        if ((!linksPercurso || (Array.isArray(linksPercurso) && linksPercurso.length === 0)) && mod.mapaPercursoUrl) {
          linksPercurso = [{ nome: 'Ver Percurso', url: mod.mapaPercursoUrl }];
        }
        
        return {
          ...mod,
          linksPercurso,
          isAvailable: availInfo?.isAvailable ?? true,
          isSoldOut: availInfo?.isSoldOut ?? false
        };
      });

      // Calculate registration status based on dates
      const now = new Date();
      const abertura = new Date(currentEvent.aberturaInscricoes);
      const encerramento = new Date(currentEvent.encerramentoInscricoes);
      
      let registrationStatus: 'not_started' | 'open' | 'closed' | 'sold_out' | 'finished' = 'open';
      let registrationMessage: string | null = null;
      
      // PRIORIDADE: Data de abertura futura = "em breve" (independente do status do evento)
      if (now < abertura) {
        registrationStatus = 'not_started';
        registrationMessage = `Inscrições abrem em ${formatBrazilDateTime(abertura)}`;
      } else if (currentEvent.status === 'finalizado') {
        registrationStatus = 'finished';
        registrationMessage = 'Evento finalizado - confira os resultados';
      } else if (now >= encerramento) {
        registrationStatus = 'closed';
        registrationMessage = 'Inscrições encerradas';
      } else if (currentEvent.status === 'esgotado' || modalitiesAvailability?.eventSoldOut) {
        registrationStatus = 'sold_out';
        registrationMessage = 'Evento esgotado - todas as vagas foram preenchidas';
      }

      // Get banner URL from event or from banners table
      let bannerUrl = currentEvent.bannerUrl;
      if (!bannerUrl && banners.length > 0) {
        bannerUrl = banners[0].imagemUrl;
      }

      res.json({
        success: true,
        data: {
          ...formatEventForResponse(currentEvent),
          bannerUrl,
          eventSoldOut: modalitiesAvailability?.eventSoldOut ?? (currentEvent.status === 'esgotado'),
          registrationStatus,
          registrationMessage,
          modalities: modalitiesWithAvailability,
          activeBatch: activeBatch ? formatBatchForResponse(activeBatch) : null,
          activeBatches: activeBatches.map(formatBatchForResponse),
          prices: prices.filter(p => p.batchId === activeBatch?.id),
          attachments,
          banners
        }
      });
    } catch (error) {
      console.error("Get public event error:", error);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" }
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
