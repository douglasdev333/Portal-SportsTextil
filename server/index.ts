import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startOrderExpirationJob } from "./jobs/order-expiration-job";
import { startPaymentPollingJob } from "./jobs/payment-polling-job";

const app = express();

// Servir attached_assets estaticamente para imagens de OG meta tags
app.use('/og-images', express.static(path.resolve(import.meta.dirname, '..', 'attached_assets', 'generated_images')));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

declare module "express-session" {
  interface SessionData {
    adminUserId?: string;
  }
}

// Confiar no proxy (Nginx) para que cookies/sessões funcionem com HTTPS
if (process.env.NODE_ENV === "production") {
  app.set('trust proxy', 1);
}

app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || "st-eventos-dev-secret-change-in-production",
  resave: true,
  saveUninitialized: false,
  cookie: {
    secure: process.env.COOKIE_SECURE === "true", // Só ativar quando tiver HTTPS
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    const expirationIntervalMs = parseInt(process.env.ORDER_EXPIRATION_CHECK_INTERVAL_MS || '60000', 10);
    startOrderExpirationJob(expirationIntervalMs);
    
    startPaymentPollingJob();
  });
})();
