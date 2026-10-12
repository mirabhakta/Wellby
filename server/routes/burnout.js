import { Router } from "express";
import { calculateBurnoutScore } from "../services/burnoutScoring.js";

const router = Router();

router.post("/predict", (req, res) => {
  const { score, factors } = calculateBurnoutScore(req.body);

  return res.json({
    workloadBalanceScore: score,
    burnoutRate: score,
    burn_rate: score,
    source: "wellby-local-burnout-v1",
    factors
  });
});

export default router;
