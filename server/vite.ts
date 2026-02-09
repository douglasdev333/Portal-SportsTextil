import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import { storage } from "./storage";

const viteLogger = createLogger();

function truncateWords(text: string, maxWords: number): string {
  if (!text) return '';
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function injectOpenGraphMeta(html: string, url: string, host: string): Promise<string> {
  // Usar PUBLIC_URL se definida, senão usar o host da requisição
  const publicUrl = process.env.PUBLIC_URL;
  const baseUrl = publicUrl || `https://${host}`;
  const defaultImage = `${baseUrl}/og-images/Marathon_runners_landscape_hero_b439e181.png`;
  const eventMatch = url.match(/^\/evento\/([^\/\?]+)/);
  
  let ogTags = '';
  
  if (eventMatch) {
    const slug = eventMatch[1];
    try {
      const event = await storage.getEventBySlug(slug);
      if (event) {
        const eventUrl = `${baseUrl}/evento/${slug}`;
        // Buscar banner: primeiro no campo banner_url, depois na tabela event_banners
        let imageUrl = event.bannerUrl;
        
        if (!imageUrl) {
          // Buscar banner da tabela event_banners
          const banners = await storage.getEventBannersByEvent(event.id);
          if (banners && banners.length > 0) {
            imageUrl = banners[0].imagemUrl;
          }
        }
        
        if (!imageUrl) {
          imageUrl = defaultImage;
        } else if (!imageUrl.startsWith('http')) {
          // Se a URL é relativa, converter para absoluta
          imageUrl = `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
        }
        
        const description = escapeHtml(truncateWords(event.descricao || '', 30)) || `Inscreva-se no evento ${escapeHtml(event.nome)}`;
        const title = escapeHtml(event.nome);
        
        ogTags = `
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${eventUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="KitRunner" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />`;
      }
    } catch (error) {
      console.error("Error injecting OG meta tags:", error);
    }
  } else {
    // Default OG tags para a página inicial e outras páginas
    ogTags = `
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${baseUrl}${url}" />
    <meta property="og:title" content="KitRunner - Portal de Inscrições" />
    <meta property="og:description" content="Inscreva-se nas melhores corridas e eventos esportivos do Brasil. Portal para maratonas, corridas de rua, trail running e muito mais." />
    <meta property="og:image" content="${defaultImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="KitRunner" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="KitRunner - Portal de Inscrições" />
    <meta name="twitter:description" content="Inscreva-se nas melhores corridas e eventos esportivos do Brasil. Portal para maratonas, corridas de rua, trail running e muito mais." />
    <meta name="twitter:image" content="${defaultImage}" />`;
  }
  
  if (ogTags) {
    html = html.replace('</head>', `${ogTags}\n  </head>`);
  }
  
  return html;
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      
      // Inject Open Graph meta tags for event pages
      const host = req.get('host') || 'localhost';
      template = await injectOpenGraphMeta(template, url, host);
      
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", async (req, res) => {
    const url = req.originalUrl;
    const indexPath = path.resolve(distPath, "index.html");
    
    try {
      let html = await fs.promises.readFile(indexPath, "utf-8");
      
      // Inject Open Graph meta tags for event pages
      const host = req.get('host') || 'localhost';
      html = await injectOpenGraphMeta(html, url, host);
      
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (error) {
      res.sendFile(indexPath);
    }
  });
}
