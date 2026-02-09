import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../../middleware/auth";
import { storage } from "../../storage";

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const createStorage = (subfolder: string) => multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(UPLOAD_DIR, subfolder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const imageFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Tipo de arquivo nao permitido. Use JPEG, PNG, WebP ou GIF."));
  }
};

const documentFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain"
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Tipo de arquivo nao permitido. Use PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, WebP ou TXT."));
  }
};

const uploadBanner = multer({
  storage: createStorage("banners"),
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const uploadRoute = multer({
  storage: createStorage("routes"),
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const uploadDocument = multer({
  storage: createStorage("documents"),
  fileFilter: documentFilter,
  limits: { fileSize: 20 * 1024 * 1024 }
});

router.post("/banner/:eventId", requireAuth, uploadBanner.single("image"), async (req, res) => {
  try {
    const { eventId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: "Nenhum arquivo enviado" });
    }

    const event = await storage.getEvent(eventId);
    if (!event) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ success: false, message: "Evento nao encontrado" });
    }

    const imageUrl = `/uploads/banners/${file.filename}`;
    
    const existingBanners = await storage.getEventBannersByEvent(eventId);
    const ordem = existingBanners.length;

    const banner = await storage.createEventBanner({
      eventId,
      imagemUrl: imageUrl,
      ordem
    });

    res.json({ success: true, data: banner });
  } catch (error) {
    console.error("Upload banner error:", error);
    res.status(500).json({ success: false, message: "Erro ao fazer upload do banner" });
  }
});

router.post("/banners/:eventId", requireAuth, uploadBanner.array("images", 10), async (req, res) => {
  try {
    const { eventId } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: "Nenhum arquivo enviado" });
    }

    const event = await storage.getEvent(eventId);
    if (!event) {
      files.forEach(file => fs.unlinkSync(file.path));
      return res.status(404).json({ success: false, message: "Evento nao encontrado" });
    }

    const existingBanners = await storage.getEventBannersByEvent(eventId);
    let ordem = existingBanners.length;

    const banners = [];
    for (const file of files) {
      const imageUrl = `/uploads/banners/${file.filename}`;
      const banner = await storage.createEventBanner({
        eventId,
        imagemUrl: imageUrl,
        ordem: ordem++
      });
      banners.push(banner);
    }

    res.json({ success: true, data: banners });
  } catch (error) {
    console.error("Upload banners error:", error);
    res.status(500).json({ success: false, message: "Erro ao fazer upload dos banners" });
  }
});

router.get("/banners/:eventId", requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const banners = await storage.getEventBannersByEvent(eventId);
    res.json({ success: true, data: banners });
  } catch (error) {
    console.error("Get banners error:", error);
    res.status(500).json({ success: false, message: "Erro ao buscar banners" });
  }
});

router.delete("/banner/:bannerId", requireAuth, async (req, res) => {
  try {
    const { bannerId } = req.params;
    
    const banner = await storage.getEventBanner(bannerId);
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner nao encontrado" });
    }

    const filePath = path.join(UPLOAD_DIR, banner.imagemUrl.replace("/uploads/", ""));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await storage.deleteEventBanner(bannerId);

    res.json({ success: true, message: "Banner removido com sucesso" });
  } catch (error) {
    console.error("Delete banner error:", error);
    res.status(500).json({ success: false, message: "Erro ao remover banner" });
  }
});

router.put("/banners/:eventId/reorder", requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { bannerIds } = req.body;

    if (!Array.isArray(bannerIds)) {
      return res.status(400).json({ success: false, message: "bannerIds deve ser um array" });
    }

    for (let i = 0; i < bannerIds.length; i++) {
      await storage.updateEventBanner(bannerIds[i], { ordem: i });
    }

    const banners = await storage.getEventBannersByEvent(eventId);
    res.json({ success: true, data: banners });
  } catch (error) {
    console.error("Reorder banners error:", error);
    res.status(500).json({ success: false, message: "Erro ao reordenar banners" });
  }
});

router.post("/route/:eventId", requireAuth, uploadRoute.single("image"), async (req, res) => {
  try {
    const { eventId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: "Nenhum arquivo enviado" });
    }

    const event = await storage.getEvent(eventId);
    if (!event) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ success: false, message: "Evento nao encontrado" });
    }

    if (event.imagemPercursoUrl) {
      const oldFilePath = path.join(UPLOAD_DIR, event.imagemPercursoUrl.replace("/uploads/", ""));
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    const imageUrl = `/uploads/routes/${file.filename}`;
    
    const updatedEvent = await storage.updateEvent(eventId, {
      imagemPercursoUrl: imageUrl
    });

    res.json({ success: true, data: { imagemPercursoUrl: imageUrl, event: updatedEvent } });
  } catch (error) {
    console.error("Upload route error:", error);
    res.status(500).json({ success: false, message: "Erro ao fazer upload da imagem do percurso" });
  }
});

router.delete("/route/:eventId", requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Evento nao encontrado" });
    }

    if (event.imagemPercursoUrl) {
      const filePath = path.join(UPLOAD_DIR, event.imagemPercursoUrl.replace("/uploads/", ""));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await storage.updateEvent(eventId, { imagemPercursoUrl: null });

    res.json({ success: true, message: "Imagem do percurso removida com sucesso" });
  } catch (error) {
    console.error("Delete route error:", error);
    res.status(500).json({ success: false, message: "Erro ao remover imagem do percurso" });
  }
});

router.post("/document", requireAuth, uploadDocument.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: "Nenhum arquivo enviado" });
    }

    const fileUrl = `/uploads/documents/${file.filename}`;
    const originalName = file.originalname;

    res.json({ 
      success: true, 
      data: { 
        url: fileUrl, 
        originalName,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size
      } 
    });
  } catch (error) {
    console.error("Upload document error:", error);
    res.status(500).json({ success: false, message: "Erro ao fazer upload do documento" });
  }
});

router.delete("/document/:filename", requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(UPLOAD_DIR, "documents", filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: "Documento removido com sucesso" });
    } else {
      res.status(404).json({ success: false, message: "Documento nao encontrado" });
    }
  } catch (error) {
    console.error("Delete document error:", error);
    res.status(500).json({ success: false, message: "Erro ao remover documento" });
  }
});

const uploadModality = multer({
  storage: createStorage("modalities"),
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post("/modality-image", requireAuth, uploadModality.single("image"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: "Nenhum arquivo enviado" });
    }

    const imageUrl = `/uploads/modalities/${file.filename}`;

    res.json({ 
      success: true, 
      data: { 
        imageUrl,
        filename: file.filename
      } 
    });
  } catch (error) {
    console.error("Upload modality image error:", error);
    res.status(500).json({ success: false, message: "Erro ao fazer upload da imagem da modalidade" });
  }
});

router.delete("/modality-image/:filename", requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(UPLOAD_DIR, "modalities", filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: "Imagem removida com sucesso" });
    } else {
      res.status(404).json({ success: false, message: "Imagem não encontrada" });
    }
  } catch (error) {
    console.error("Delete modality image error:", error);
    res.status(500).json({ success: false, message: "Erro ao remover imagem" });
  }
});

export default router;
