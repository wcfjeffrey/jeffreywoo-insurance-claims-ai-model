import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pool } from "./db/pool.js";
import authRoutes from "./routes/auth.js";
import claimsRoutes from "./routes/claims.js";
import accountingRoutes from "./routes/accounting.js";
import dashboardRoutes from "./routes/dashboard.js";
import aiRoutes from "./routes/ai.js";
import complianceRoutes from "./routes/compliance.js";
import hkmaRoutes from "./routes/hkma.js";
import notificationsRoutes from "./routes/notifications.js";
import reportsRoutes from "./routes/reports.js";
import auditRoutes from "./routes/audit.js";
import hkfrs17Routes from './routes/hkfrs17.js';
import hkfrs17CalculatorRoutes from './routes/hkfrs17Calculator.js';

export function createApp(): express.Express {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

  // Security middleware
  app.use(helmet({ 
    crossOriginResourcePolicy: { policy: "cross-origin" } 
  }));
  
  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: Number(process.env.RATE_LIMIT_MAX ?? 400),
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  
  // CORS
  app.use(cors({ origin: corsOrigin, credentials: true }));
  
  // JSON parser
  app.use(express.json({ limit: "50mb" }));

  // Health check endpoints
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "jeffreywoo-insurance-api" });
  });

  app.get("/api/health/db", async (_req, res) => {
    try {
      const r = await pool.query("SELECT 1 AS ok");
      res.json({ ok: true, db: r.rows[0] });
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown error";
      res.status(503).json({ ok: false, error: message });
    }
  });

  // API Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/claims", claimsRoutes);
  app.use("/api/accounting", accountingRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/compliance", complianceRoutes);
  app.use("/api/hkma", hkmaRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/audit", auditRoutes);
  app.use('/api/hkfrs17', hkfrs17Routes);
  app.use('/api/hkfrs17', hkfrs17CalculatorRoutes);
  
  // 404 handler for undefined routes
  app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
  });

  // Global error handler
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error("Server error:", err);
      res.status(500).json({ error: "Internal server error" });
    },
  );

  return app;
}