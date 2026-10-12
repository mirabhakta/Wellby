import { Router } from "express";

const router = Router();

router.get("/status", (_req, res) => {
  return res.json({
    connected: false,
    fatigueDetected: false,
    confidence: 0,
    status: "browser-local-required",
    warning: "Fatigue detection now runs in the browser after opt-in.",
    source: "browser-local-only"
  });
});

export default router;
