import { Router, type Request } from "express";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { writeAudit } from "../services/auditService.js";
import { analyzeClaimFraud } from "../services/fraudService.js";
import {
  canTransition,
  nextEscalationLevel,
  type ClaimStatus,
} from "../services/workflowService.js";
import { emitClaimUpdate } from "../realtime.js";

const uploadDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = Router();

function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? String(v[0]) : String(v ?? "");
}

async function nextReference(): Promise<string> {
  const year = new Date().getFullYear();
  const { rows } = await pool.query<{ c: number }>(
    `SELECT count(*)::int AS c FROM claims WHERE reference_number LIKE $1`,
    [`CLM-${year}-%`],
  );
  const n = rows[0].c + 1;
  return `CLM-${year}-${String(n).padStart(4, "0")}`;
}

function claimListWhere(role: string, userId: string): {
  sql: string;
  params: unknown[];
} {
  if (role === "customer") {
    return {
      sql: "WHERE c.customer_id = $1",
      params: [userId],
    };
  }
  if (role === "accounting_staff") {
    return {
      sql: "",
      params: [],
    };
  }
  return { sql: "", params: [] };
}

// Text extraction from various file types
async function extractTextFromFile(filePath: string, mimeType: string, originalName: string): Promise<string | null> {
  try {
    console.log(`Extracting from: ${originalName}, type: ${mimeType}`);
    
    const lowerName = originalName.toLowerCase();
    // .docx is a ZIP of XML — reading it as UTF-8 destroys text; use a real parser.
    const isDocx =
      lowerName.endsWith(".docx") ||
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (isDocx) {
      try {
        const mammoth = await import("mammoth");
        const buffer = fs.readFileSync(filePath);
        const { value } = await mammoth.extractRawText({ buffer });
        const text = (value || "").trim();
        console.log(`Extracted ${text.length} characters from DOCX`);
        return text.length > 0 ? text.substring(0, 10000) : null;
      } catch (err) {
        console.error("DOCX text extraction failed:", err);
        return null;
      }
    }

    // Legacy binary .doc (not .docx)
    const isDoc =
      (lowerName.endsWith(".doc") && !lowerName.endsWith(".docx")) ||
      mimeType === "application/msword";
    if (isDoc) {
      try {
        const WordExtractor = (await import("word-extractor")).default;
        const extractor = new WordExtractor();
        const doc = await extractor.extract(filePath);
        const text = doc.getBody().trim();
        console.log(`Extracted ${text.length} characters from DOC`);
        return text.length > 0 ? text.substring(0, 10000) : null;
      } catch (err) {
        console.error("DOC text extraction failed:", err);
        return null;
      }
    }
    
    // For PDF files (by MIME type or extension)
    const isPdf =
      mimeType === "application/pdf" ||
      originalName.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      try {
        const { PDFParse } = await import("pdf-parse");
        const dataBuffer = fs.readFileSync(filePath);
        const parser = new PDFParse({ data: new Uint8Array(dataBuffer) });
        const textResult = await parser.getText();
        await parser.destroy().catch(() => undefined);
        const fullText = textResult.text || "";
        const t = fullText.trim();
        if (t.length < 15) {
          console.warn(
            `PDF "${originalName}" has little or no text (likely a scan). OCR is not enabled.`,
          );
        }
        return fullText.substring(0, 10000);
      } catch (err) {
        console.error("PDF text extraction failed:", err);
        return null;
      }
    }
    
    // For text files
    if (originalName.toLowerCase().endsWith('.txt')) {
      return fs.readFileSync(filePath, 'utf-8').substring(0, 10000);
    }
    
    return null;
  } catch (error) {
    console.error('Text extraction error:', error);
    return null;
  }
}

router.get("/", requireAuth, async (req, res) => {
  const { sql, params } = claimListWhere(req.user!.role, req.user!.id);
  const q = `
    SELECT c.*, u.full_name AS customer_name
    FROM claims c
    JOIN users u ON u.id = c.customer_id
    ${sql}
    ORDER BY c.created_at DESC
    LIMIT 200
  `;
  const { rows } = await pool.query(q, params);
  res.json({ claims: rows });
});

router.get("/:id/documents/:docId/download", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT cd.*, c.customer_id FROM claim_documents cd
     JOIN claims c ON c.id = cd.claim_id
     WHERE cd.id = $1::uuid AND cd.claim_id = $2::uuid`,
    [param(req, "docId"), param(req, "id")],
  );
  const doc = rows[0];
  if (!doc) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (
    req.user!.role === "customer" &&
    doc.customer_id !== req.user!.id
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const fp = path.join(uploadDir, doc.storage_path);
  res.download(fp, doc.original_name);
});

router.get("/:id", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.*, u.full_name AS customer_name, u.email AS customer_email
     FROM claims c
     JOIN users u ON u.id = c.customer_id
     WHERE c.id = $1`,
    [param(req, "id")],
  );
  const claim = rows[0];
  if (!claim) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (
    req.user!.role === "customer" &&
    claim.customer_id !== req.user!.id
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const docs = await pool.query(
    `SELECT id, original_name, mime_type, size_bytes, created_at FROM claim_documents WHERE claim_id = $1 ORDER BY created_at`,
    [param(req, "id")],
  );
  const events = await pool.query(
    `SELECT
       w.id, 
       w.claim_id, 
       w.from_status, 
       w.to_status, 
       w.actor_id, 
       w.action, 
       w.notes, 
       w.created_at,
       u.full_name AS actor_name
     FROM workflow_events w
     LEFT JOIN users u ON u.id = w.actor_id
     WHERE w.claim_id = $1 ORDER BY w.created_at ASC`,
    [param(req, "id")],
  );
  res.json({ claim, documents: docs.rows, workflow: events.rows });
});

const createSchema = z.object({
  policy_number: z.string().min(3),
  incident_date: z.string(),
  incident_description: z.string().min(5),
  claimed_amount: z.number().positive(),
  currency: z.string().default("HKD"),
});

router.post(
  "/",
  requireAuth,
  requireRoles("customer", "manager"),
  async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    const customerId =
      req.user!.role === "customer" ? req.user!.id : req.body.customer_id;
    if (!customerId || typeof customerId !== "string") {
      res.status(400).json({ error: "customer_id required for manager" });
      return;
    }
    const ref = await nextReference();
    const { rows } = await pool.query(
      `INSERT INTO claims (
        reference_number, customer_id, policy_number, incident_date,
        incident_description, claimed_amount, currency, status
      ) VALUES ($1,$2::uuid,$3,$4::date,$5,$6,$7,'draft')
      RETURNING *`,
      [
        ref,
        customerId,
        body.policy_number,
        body.incident_date,
        body.incident_description,
        body.claimed_amount,
        body.currency,
      ],
    );
    const claim = rows[0];
    await writeAudit(pool, {
      userId: req.user!.id,
      action: "claim.create",
      entityType: "claim",
      entityId: claim.id,
      metadata: { reference_number: ref },
      req,
    });
    emitClaimUpdate(claim.id, { status: claim.status });
    res.status(201).json({ claim });
  },
);

router.patch("/:id", requireAuth, async (req, res) => {
  const patchSchema = z.object({
    incident_description: z.string().optional(),
    claimed_amount: z.number().positive().optional(),
    policy_number: z.string().optional(),
  });
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { rows: existing } = await pool.query(
    `SELECT * FROM claims WHERE id = $1`,
    [param(req, "id")],
  );
  const c = existing[0];
  if (!c) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (
    req.user!.role === "customer" &&
    c.customer_id !== req.user!.id
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (c.status !== "draft" && req.user!.role === "customer") {
    res.status(400).json({ error: "Only draft claims are editable by customer" });
    return;
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  const b = parsed.data;
  if (b.incident_description) {
    updates.push(`incident_description = $${i++}`);
    params.push(b.incident_description);
  }
  if (b.claimed_amount) {
    updates.push(`claimed_amount = $${i++}`);
    params.push(b.claimed_amount);
  }
  if (b.policy_number) {
    updates.push(`policy_number = $${i++}`);
    params.push(b.policy_number);
  }
  if (!updates.length) {
    res.json({ claim: c });
    return;
  }
  updates.push(`updated_at = now()`);
  params.push(param(req, "id"));
  const { rows } = await pool.query(
    `UPDATE claims SET ${updates.join(", ")} WHERE id = $${i}::uuid RETURNING *`,
    params,
  );
  await writeAudit(pool, {
    userId: req.user!.id,
    action: "claim.update",
    entityType: "claim",
    entityId: param(req, "id"),
    metadata: b,
    req,
  });
  res.json({ claim: rows[0] });
});

router.post("/:id/submit", requireAuth, requireRoles("customer", "manager"), async (req, res) => {
  const { rows: existing } = await pool.query(
    `SELECT * FROM claims WHERE id = $1`,
    [param(req, "id")],
  );
  const c = existing[0];
  if (!c) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (req.user!.role === "customer" && c.customer_id !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (c.status !== "draft") {
    res.status(400).json({ error: "Not in draft" });
    return;
  }
  const from = c.status as ClaimStatus;
  const to: ClaimStatus = "submitted";
  if (!canTransition(from, to, req.user!.role)) {
    res.status(400).json({ error: "Invalid transition" });
    return;
  }
  const { rows } = await pool.query(
    `UPDATE claims SET status = $1::claim_status, updated_at = now(), workflow_step = 1 WHERE id = $2::uuid RETURNING *`,
    [to, param(req, "id")],
  );
  await pool.query(
    `INSERT INTO workflow_events (claim_id, from_status, to_status, actor_id, action)
     VALUES ($1::uuid, $2::claim_status, $3::claim_status, $4::uuid, $5)`,
    [param(req, "id"), from, to, req.user!.id, "submit"],
  );
  await writeAudit(pool, {
    userId: req.user!.id,
    action: "claim.submit",
    entityType: "claim",
    entityId: param(req, "id"),
    metadata: {},
    req,
  });
  await pool.query(
    `INSERT INTO compliance_events (framework, rule_code, severity, entity_type, entity_id, details)
     VALUES ('IFRS','CLM-SUBMIT','info','claim',$1::text, '{}'::jsonb)`,
    [param(req, "id")],
  );
  emitClaimUpdate(param(req, "id"), { status: to });
  res.json({ claim: rows[0] });
});

const transitionSchema = z.object({
  to_status: z.enum([
    "under_review",
    "escalated",
    "approved",
    "rejected",
    "payment_pending",
    "paid",
    "closed",
  ]),
  notes: z.string().optional(),
  approved_amount: z.number().optional(),
});

router.post("/:id/transition", requireAuth, async (req, res) => {
  const parsed = transitionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { to_status, notes, approved_amount } = parsed.data;
  const { rows: existing } = await pool.query(
    `SELECT * FROM claims WHERE id = $1`,
    [param(req, "id")],
  );
  const c = existing[0];
  if (!c) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const from = c.status as ClaimStatus;
  if (!canTransition(from, to_status as ClaimStatus, req.user!.role)) {
    res.status(400).json({ error: "Transition not allowed for your role" });
    return;
  }
  const esc = nextEscalationLevel(
    c.escalation_level,
    to_status as ClaimStatus,
  );

  const updates: string[] = [
    `status = $1::claim_status`,
    `escalation_level = $2`,
    `updated_at = now()`,
  ];
  const params: unknown[] = [to_status, esc];
  let i = 3;
  if (approved_amount != null && ["approved", "payment_pending"].includes(to_status)) {
    updates.push(`approved_amount = $${i++}`);
    params.push(approved_amount);
  }
  params.push(param(req, "id"));

  const { rows } = await pool.query(
    `UPDATE claims SET ${updates.join(", ")} WHERE id = $${i}::uuid RETURNING *`,
    params,
  );

  await pool.query(
    `INSERT INTO workflow_events (claim_id, from_status, to_status, actor_id, action, notes)
     VALUES ($1::uuid, $2::claim_status, $3::claim_status, $4::uuid, $5, $6)`,
    [param(req, "id"), from, to_status, req.user!.id, "transition", notes ?? null],
  );
  await writeAudit(pool, {
    userId: req.user!.id,
    action: "claim.transition",
    entityType: "claim",
    entityId: param(req, "id"),
    metadata: { from, to: to_status },
    req,
  });
  if (to_status === "approved") {
    await pool.query(
      `INSERT INTO compliance_events (framework, rule_code, severity, entity_type, entity_id, details)
       VALUES ('Basel','OPS-APPROVE','info','claim',$1::text, '{"stage":"approval"}'::jsonb)`,
      [param(req, "id")],
    );
  }
  emitClaimUpdate(param(req, "id"), { status: to_status });
  res.json({ claim: rows[0] });
});

// Updated document upload with text extraction
router.post(
  "/:id/documents",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "file required" });
      return;
    }
    const { rows: existing } = await pool.query(
      `SELECT * FROM claims WHERE id = $1`,
      [param(req, "id")],
    );
    const c = existing[0];
    if (!c) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (req.user!.role === "customer" && c.customer_id !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    
    // Extract text from uploaded document
    const extractedText = await extractTextFromFile(
      req.file.path, 
      req.file.mimetype, 
      req.file.originalname
    );
    
    const { rows } = await pool.query(
      `INSERT INTO claim_documents (claim_id, original_name, storage_path, mime_type, size_bytes, uploaded_by, extracted_text)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid, $7) RETURNING *`,
      [
        param(req, "id"),
        req.file.originalname,
        req.file.filename,
        req.file.mimetype,
        req.file.size,
        req.user!.id,
        extractedText,
      ],
    );
    await writeAudit(pool, {
      userId: req.user!.id,
      action: "claim.document.upload",
      entityType: "claim_document",
      entityId: rows[0].id,
      metadata: { claim_id: param(req, "id") },
      req,
    });
    res.status(201).json({ document: rows[0] });
  },
);

// Updated AI validation endpoint with enhanced fraud detection
router.post(
  "/:id/ai-validate",
  requireAuth,
  requireRoles("claim_officer", "manager"),
  async (req, res) => {
    try {
      const claimId = param(req, "id");
      
      // Check if claim exists
      const { rows: existing } = await pool.query(
        `SELECT * FROM claims WHERE id = $1::uuid`,
        [claimId],
      );
      
      if (!existing[0]) {
        res.status(404).json({ error: "Claim not found" });
        return;
      }
      
      const fraud = await analyzeClaimFraud(pool, claimId);
      
      if (!fraud || fraud.score === undefined) {
        res.status(500).json({ error: "AI analysis failed to produce result" });
        return;
      }
      
      // Update claim with fraud analysis results
      await pool.query(
        `UPDATE claims SET 
          fraud_risk_score = $2, 
          fraud_flags = $3::jsonb, 
          coverage_status = $4, 
          updated_at = now() 
        WHERE id = $1::uuid`,
        [
          claimId,
          fraud.score,
          JSON.stringify(fraud.flags || []),
          fraud.coverageStatus || (fraud.coverageLikely ? "likely" : "uncertain"),
        ],
      );
      
      // Store AI analysis
      await pool.query(
        `INSERT INTO ai_analyses (claim_id, analysis_type, score, result)
         VALUES ($1::uuid, 'fraud_rules', $2, $3::jsonb)`,
        [claimId, fraud.score, JSON.stringify(fraud)],
      );
      
      await writeAudit(pool, {
        userId: req.user!.id,
        action: "claim.ai_validate",
        entityType: "claim",
        entityId: claimId,
        metadata: { score: fraud.score, flags: fraud.flags },
        req,
      });
      
      res.json({ fraud });
    } catch (error) {
      console.error("AI Validation error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "AI validation failed" });
    }
  },
);

// DELETE /api/claims/:id - Delete a draft claim
router.delete("/:id", requireAuth, async (req, res) => {
  const claimId = param(req, "id");
  
  try {
    // Get the claim
    const { rows: existing } = await pool.query(
      `SELECT * FROM claims WHERE id = $1::uuid`,
      [claimId],
    );
    
    const claim = existing[0];
    if (!claim) {
      res.status(404).json({ error: "Claim not found" });
      return;
    }
    
    // Check permissions - only customers can delete and only draft claims
    if (req.user!.role === "customer") {
      if (claim.customer_id !== req.user!.id) {
        res.status(403).json({ error: "You can only delete your own claims" });
        return;
      }
      if (claim.status !== "draft") {
        res.status(403).json({ error: "Only draft claims can be deleted" });
        return;
      }
    } else {
      // Officers, managers, accounting staff cannot delete claims
      res.status(403).json({ error: "Only customers can delete draft claims" });
      return;
    }
    
    // Delete associated documents from filesystem first
    const { rows: documents } = await pool.query(
      `SELECT storage_path FROM claim_documents WHERE claim_id = $1::uuid`,
      [claimId],
    );
    
    for (const doc of documents) {
      const filePath = path.join(uploadDir, doc.storage_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // Delete documents from database
    await pool.query(
      `DELETE FROM claim_documents WHERE claim_id = $1::uuid`,
      [claimId],
    );
    
    // Delete workflow events
    await pool.query(
      `DELETE FROM workflow_events WHERE claim_id = $1::uuid`,
      [claimId],
    );
    
    // Delete AI analyses
    await pool.query(
      `DELETE FROM ai_analyses WHERE claim_id = $1::uuid`,
      [claimId],
    );
    
    // Delete compliance events related to this claim
    await pool.query(
      `DELETE FROM compliance_events WHERE entity_id = $1::text AND entity_type = 'claim'`,
      [claimId],
    );
    
    // Finally delete the claim
    await pool.query(
      `DELETE FROM claims WHERE id = $1::uuid`,
      [claimId],
    );
    
    // Write audit log
    await writeAudit(pool, {
      userId: req.user!.id,
      action: "claim.delete",
      entityType: "claim",
      entityId: claimId,
      metadata: { reference_number: claim.reference_number },
      req,
    });
    
    // Emit real-time update
    emitClaimUpdate(claimId, { status: "deleted" });
    
    res.status(204).send();
  } catch (error) {
    console.error("Delete claim error:", error);
    res.status(500).json({ error: "Failed to delete claim" });
  }
});

// Delete claim endpoint
router.delete("/:id/documents/:docId", requireAuth, async (req, res) => {
  const claimId = param(req, "id");
  const docId = param(req, "docId");
  
  // Validate UUIDs
  if (!claimId || claimId === "undefined" || claimId === "null") {
    res.status(400).json({ error: "Invalid claim ID" });
    return;
  }
  
  if (!docId || docId === "undefined" || docId === "null") {
    res.status(400).json({ error: "Invalid document ID" });
    return;
  }
  
  console.log(`Delete request - Claim ID: ${claimId}, Document ID: ${docId}`);
  
  try {
    // Get the claim to check status and permissions
    const { rows: claimRows } = await pool.query(
      `SELECT * FROM claims WHERE id = $1::uuid`,
      [claimId]
    );
    
    const claim = claimRows[0];
    if (!claim) {
      res.status(404).json({ error: "Claim not found" });
      return;
    }
    
    // Check permissions - only allow deletion for draft claims
    if (claim.status !== "draft") {
      res.status(403).json({ error: "Documents can only be deleted from draft claims" });
      return;
    }
    
    // Check user permissions
    if (req.user!.role === "customer") {
      if (claim.customer_id !== req.user!.id) {
        res.status(403).json({ error: "You can only delete documents from your own claims" });
        return;
      }
    }
    
    // Get document info
    const { rows: docRows } = await pool.query(
      `SELECT * FROM claim_documents WHERE id = $1::uuid AND claim_id = $2::uuid`,
      [docId, claimId]
    );
    
    const document = docRows[0];
    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    
    // Delete physical file from uploads directory
    const filePath = path.join(uploadDir, document.storage_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted file: ${filePath}`);
    }
    
    // Delete database record
    await pool.query(
      `DELETE FROM claim_documents WHERE id = $1::uuid`,
      [docId]
    );
    
    // Write audit log
    await writeAudit(pool, {
      userId: req.user!.id,
      action: "claim.document.delete",
      entityType: "claim_document",
      entityId: docId,
      metadata: { 
        claim_id: claimId, 
        document_name: document.original_name,
        claim_status: claim.status
      },
      req,
    });
    
    console.log(`Document deleted: ${document.original_name} from claim ${claimId}`);
    
    res.status(204).send();
  } catch (error) {
    console.error("Delete document error:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

export default router;