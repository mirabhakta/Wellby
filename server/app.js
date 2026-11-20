import express from "express";
import helmet from "helmet";
import burnoutRoutes from "./routes/burnout.js";
import fatigueRoutes from "./routes/fatigue.js";
import healthRoutes from "./routes/health.js";

/**
 * The API is an optional adapter: the shipped app computes its score in the
 * browser. Kept small, testable, and free of static-file concerns.
 */
export function createApiApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "32kb" }));

  app.use("/api/health", healthRoutes);
  app.use("/api/burnout", burnoutRoutes);
  app.use("/api/fatigue", fatigueRoutes);

  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  app.use((error, _req, res, _next) => {
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    console.error("Wellby API error", error);
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
