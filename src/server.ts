import express from "express";
import cors from "cors";
import { verifyAuthorization } from "./verifyService";
import { settleAuthorization } from "./settleService";
import { VerifyRequest, VerifyResponse, SettleRequest, SettleResponse } from "./types";
import { validateEnv } from "./env";

const app = express();
app.use(cors());
app.use(express.json());

// リクエストログ
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// favicon・トップページの404を消す
app.get("/", (req, res) => {
  res.json({ service: "jpyc-x402-facilitator-polygon", status: "ok" });
});
app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/favicon.png", (req, res) => res.status(204).end());

// ヘルスチェック
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "jpyc-x402-facilitator-polygon"
  });
});

// x402 v1/v2 対応：サポートするネットワーク・スキームを返す
app.get("/supported", (req, res) => {
  res.json({
    kinds: [
      {
        x402Version: 1,
        scheme: "exact",
        network: "polygon"
      },
      {
        x402Version: 2,
        scheme: "exact",
        network: "eip155:137"
      }
    ]
  });
});

app.post("/verify", async (req, res) => {
  try {
    const verifyReq = req.body as VerifyRequest;
    console.log(`[Verify] Request received:`, JSON.stringify(verifyReq, null, 2));

    if (!verifyReq.x402Version || !verifyReq.paymentPayload || !verifyReq.paymentRequirements) {
      console.log(`[Verify] Invalid request format, returning 400`);
      return res.status(400).json({
        errorType: "invalid_request",
        errorMessage: "Invalid request. Please check the request body and parameters.",
      });
    }

    const result = await verifyAuthorization(verifyReq);
    console.log(`[Verify] Result:`, result);

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[Verify] Unexpected error:", err);
    return res.status(500).json({
      errorType: "internal_server_error",
      errorMessage: "An internal server error occurred. Please try again later.",
    });
  }
});

app.post("/settle", async (req, res) => {
  try {
    console.log(`[Settle] Request received from:`, req.ip);
    console.log(`[Settle] Request body:`, JSON.stringify(req.body, null, 2));
    console.log(`[Settle] Request headers:`, JSON.stringify(req.headers, null, 2));

    const settleReq = req.body as SettleRequest;

    if (!settleReq || !settleReq.paymentPayload) {
      console.log(`[Settle] Invalid request format, returning 400`);
      return res.status(400).json({
        errorType: "invalid_request",
        errorMessage: "Invalid request. Please check the request body and parameters.",
      });
    }

    const result = await settleAuthorization(settleReq);
    console.log(`[Settle] Settlement result:`, result);

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[Settle] Unexpected error:", err);
    return res.status(500).json({
      errorType: "internal_server_error",
      errorMessage: "An internal server error occurred. Please try again later.",
    });
  }
});

// Vercelデプロイ時はappをエクスポート、ローカル開発時はサーバーを起動
if (process.env.VERCEL || process.env.VERCEL_ENV) {
  module.exports = app;
} else {
  try {
    validateEnv();
  } catch (error: any) {
    console.error("Environment validation failed:", error.message);
    process.exit(1);
  }

  const PORT = 4021;
  app.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Facilitator running on http://localhost:${PORT}`);
  });
}
