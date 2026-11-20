import express from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApiApp } from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export async function createApp() {
  const app = createApiApp();
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: path.join(rootDir, "client"),
      server: { middlewareMode: true },
      appType: "custom"
    });

    app.use(vite.middlewares);

    app.get("*", async (req, res, next) => {
      if (path.extname(req.path)) {
        return next();
      }

      try {
        const url = req.originalUrl;
        const templatePath = path.join(rootDir, "client", "index.html");
        const transformed = await vite.transformIndexHtml(
          url,
          await readFile(templatePath, "utf-8")
        );
        return res.status(200).set({ "Content-Type": "text/html" }).end(transformed);
      } catch (error) {
        vite.ssrFixStacktrace(error);
        return next(error);
      }
    });

    app.use((_req, res) => res.status(404).send("Not found"));
  } else {
    const distPath = path.join(rootDir, "dist");
    app.use(express.static(distPath));

    app.get("*", (req, res, next) => {
      if (path.extname(req.path)) {
        return next();
      }

      return res.sendFile(path.join(distPath, "index.html"));
    });

    app.use((_req, res) => res.status(404).send("Not found"));
  }

  return app;
}

const isDirectRun = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  createApp()
    .then((app) => {
      const port = Number(process.env.PORT ?? 3000);
      app.listen(port, () => {
        console.log(`Wellby listening on http://localhost:${port}`);
      });
    })
    .catch((error) => {
      console.error("Failed to start Wellby", error);
      process.exit(1);
    });
}
