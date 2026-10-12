import { Router } from "express";
import { requestJson } from "../services/httpClient.js";

const router = Router();

const burnoutServiceUrl =
  process.env.BURNOUT_SERVICE_URL ?? "http://127.0.0.1:5001";

router.post("/predict", async (req, res) => {
  try {
    const data = await requestJson(`${burnoutServiceUrl}/predict`, {
      method: "POST",
      body: JSON.stringify(req.body),
      timeout: 5000
    });

    const score = Number(data.burnout_rate ?? data.score ?? 0);

    return res.json({
      workloadBalanceScore: score,
      burnoutRate: score,
      ...data
    });
  } catch (error) {
    console.warn("Burnout prediction service unavailable:", error.message);

    return res.json({
      workloadBalanceScore: 0.3,
      burnoutRate: 0.3,
      fallback: true
    });
  }
});

export default router;
