import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { writeAudit } from "../services/auditService.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

const router = Router();

// Helper function to format currency
function formatCurrency(amount: number, currency: string = "HKD"): string {
  return new Intl.NumberFormat('en-HK', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// Helper function to format date
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-HK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// 1. Claims Report (Excel) - Working
router.get("/claims.xlsx", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.reference_number, c.status, c.claimed_amount, c.currency, 
             c.incident_date, c.created_at, u.full_name as customer_name,
             c.fraud_risk_score, c.coverage_status
      FROM claims c
      JOIN users u ON u.id = c.customer_id
      ORDER BY c.created_at DESC
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Claims Report");

    worksheet.columns = [
      { header: "Reference", key: "reference", width: 20 },
      { header: "Customer", key: "customer", width: 25 },
      { header: "Status", key: "status", width: 15 },
      { header: "Amount", key: "amount", width: 15 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Fraud Score", key: "fraud_score", width: 12 },
      { header: "Coverage", key: "coverage", width: 12 },
      { header: "Incident Date", key: "incident_date", width: 12 },
      { header: "Submitted Date", key: "created_at", width: 12 },
    ];

    for (const row of rows) {
      worksheet.addRow({
        reference: row.reference_number,
        customer: row.customer_name,
        status: row.status,
        amount: row.claimed_amount,
        currency: row.currency,
        fraud_score: row.fraud_risk_score || "N/A",
        coverage: row.coverage_status || "Pending",
        incident_date: formatDate(row.incident_date),
        created_at: formatDate(row.created_at),
      });
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=claims_report.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Claims report error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

// 2. Executive Summary (PDF)
router.get("/summary.pdf", requireAuth, async (req, res) => {
  try {
    const { rows: stats } = await pool.query(`
      SELECT 
        COUNT(*) as total_claims,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status IN ('submitted', 'under_review') THEN 1 END) as pending,
        COALESCE(SUM(claimed_amount), 0) as total_amount
      FROM claims
    `);

    const doc = new PDFDocument({ margin: 50 });
    const stream = new PassThrough();
    doc.pipe(stream);

    // Header
    doc.fontSize(20).text("Executive Summary", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown();

    // Key Metrics
    doc.fontSize(14).text("Key Performance Indicators", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Total Claims: ${stats[0].total_claims}`);
    doc.text(`Approved Claims: ${stats[0].approved}`);
    doc.text(`Rejected Claims: ${stats[0].rejected}`);
    doc.text(`Pending Review: ${stats[0].pending}`);
    doc.text(`Total Claim Value: ${formatCurrency(stats[0].total_amount)}`);
    doc.moveDown();

    doc.end();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=executive_summary.pdf");
    stream.pipe(res);
  } catch (error) {
    console.error("Executive summary error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

// 3. Audit Trail Report (Excel)
router.get("/audit.xlsx", requireAuth, requireRoles("manager", "claim_officer"), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, u.email as user_email, u.full_name as user_name
      FROM audit_log a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC
      LIMIT 1000
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Audit Trail");

    worksheet.columns = [
      { header: "Timestamp", key: "timestamp", width: 20 },
      { header: "User", key: "user", width: 25 },
      { header: "Action", key: "action", width: 20 },
      { header: "Entity Type", key: "entity_type", width: 15 },
      { header: "Entity ID", key: "entity_id", width: 35 },
      { header: "IP Address", key: "ip", width: 15 },
    ];

    for (const row of rows) {
      worksheet.addRow({
        timestamp: formatDate(row.created_at),
        user: row.user_name || row.user_email || "System",
        action: row.action,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        ip: row.ip_address || "N/A",
      });
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=audit_trail.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Audit report error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

// 4. Financial Disbursement (PDF)
router.get("/financial.pdf", requireAuth, requireRoles("accounting_staff", "manager"), async (req, res) => {
  try {
    const { rows: disbursements } = await pool.query(`
      SELECT d.*, c.reference_number as claim_ref
      FROM disbursements d
      JOIN claims c ON c.id = d.claim_id
      ORDER BY d.created_at DESC
    `);

    const doc = new PDFDocument({ margin: 50 });
    const stream = new PassThrough();
    doc.pipe(stream);

    doc.fontSize(20).text("Financial Disbursement Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text("Disbursement Summary", { underline: true });
    doc.moveDown(0.5);

    for (const d of disbursements) {
      doc.fontSize(10);
      doc.text(`Claim: ${d.claim_ref}`);
      doc.text(`Payee: ${d.payee_name}`);
      doc.text(`Amount: ${formatCurrency(d.net_amount, d.currency)}`);
      doc.text(`Status: ${d.status}`);
      doc.text(`Due Date: ${formatDate(d.due_date)}`);
      doc.moveDown(0.5);
    }

    doc.end();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=financial_disbursement.pdf");
    stream.pipe(res);
  } catch (error) {
    console.error("Financial report error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

// 5. Regulatory Compliance (Excel)
router.get("/compliance.xlsx", requireAuth, requireRoles("manager", "claim_officer"), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM compliance_events 
      ORDER BY created_at DESC 
      LIMIT 500
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Compliance Events");

    worksheet.columns = [
      { header: "Date", key: "date", width: 20 },
      { header: "Framework", key: "framework", width: 15 },
      { header: "Rule Code", key: "rule_code", width: 15 },
      { header: "Severity", key: "severity", width: 10 },
      { header: "Entity Type", key: "entity_type", width: 15 },
      { header: "Entity ID", key: "entity_id", width: 35 },
      { header: "Details", key: "details", width: 40 },
    ];

    for (const row of rows) {
      worksheet.addRow({
        date: formatDate(row.created_at),
        framework: row.framework,
        rule_code: row.rule_code,
        severity: row.severity,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        details: JSON.stringify(row.details || {}),
      });
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=compliance_report.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Compliance report error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

// 6. Risk Assessment (PDF)
router.get("/risk.pdf", requireAuth, requireRoles("manager", "claim_officer"), async (req, res) => {
  try {
    const { rows: riskClaims } = await pool.query(`
      SELECT c.reference_number, c.claimed_amount, c.currency, c.fraud_risk_score,
             c.fraud_flags, u.full_name as customer_name
      FROM claims c
      JOIN users u ON u.id = c.customer_id
      WHERE c.fraud_risk_score >= 40 OR c.fraud_risk_score IS NULL
      ORDER BY c.fraud_risk_score DESC NULLS LAST
    `);

    const doc = new PDFDocument({ margin: 50 });
    const stream = new PassThrough();
    doc.pipe(stream);

    doc.fontSize(20).text("Risk Assessment Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown();

    doc.fontSize(14).text("High & Medium Risk Claims", { underline: true });
    doc.moveDown(0.5);

    for (const claim of riskClaims) {
      doc.fontSize(10);
      doc.text(`Claim: ${claim.reference_number}`);
      doc.text(`Customer: ${claim.customer_name}`);
      doc.text(`Amount: ${formatCurrency(claim.claimed_amount, claim.currency)}`);
      doc.text(`Risk Score: ${claim.fraud_risk_score || "Not assessed"}%`);
      if (claim.fraud_flags) {
        doc.text(`Flags: ${JSON.stringify(claim.fraud_flags)}`);
      }
      doc.moveDown(0.5);
    }

    doc.end();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=risk_assessment.pdf");
    stream.pipe(res);
  } catch (error) {
    console.error("Risk report error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

// 7. General Ledger (Excel)
router.get("/ledger.xlsx", requireAuth, requireRoles("accounting_staff", "manager"), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        c.reference_number,
        c.claimed_amount,
        c.currency,
        c.status,
        c.created_at,
        c.approved_amount,
        d.net_amount as disbursed_amount,
        d.status as disbursement_status,
        u.full_name as customer_name
      FROM claims c
      LEFT JOIN disbursements d ON d.claim_id = c.id
      JOIN users u ON u.id = c.customer_id
      ORDER BY c.created_at DESC
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("General Ledger");

    worksheet.columns = [
      { header: "Claim Reference", key: "reference", width: 20 },
      { header: "Customer", key: "customer", width: 25 },
      { header: "Claim Amount", key: "claimed", width: 15 },
      { header: "Approved Amount", key: "approved", width: 15 },
      { header: "Disbursed Amount", key: "disbursed", width: 15 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Status", key: "status", width: 15 },
      { header: "Disbursement Status", key: "disb_status", width: 18 },
      { header: "Date", key: "date", width: 12 },
    ];

    for (const row of rows) {
      worksheet.addRow({
        reference: row.reference_number,
        customer: row.customer_name,
        claimed: row.claimed_amount,
        approved: row.approved_amount || "Pending",
        disbursed: row.disbursed_amount || "Not disbursed",
        currency: row.currency,
        status: row.status,
        disb_status: row.disbursement_status || "N/A",
        date: formatDate(row.created_at),
      });
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=general_ledger.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Ledger report error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

// 8. Regulatory Filing (PDF)
router.get("/regulatory.pdf", requireAuth, requireRoles("manager", "accounting_staff"), async (req, res) => {
  try {
    const { rows: stats } = await pool.query(`
      SELECT 
        COUNT(*) as total_claims,
        COALESCE(SUM(claimed_amount), 0) as total_value,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN date_part('month', created_at) = date_part('month', CURRENT_DATE) THEN 1 END) as monthly_total
      FROM claims
    `);

    const doc = new PDFDocument({ margin: 50 });
    const stream = new PassThrough();
    doc.pipe(stream);

    doc.fontSize(20).text("Regulatory Filing Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text("For submission to Insurance Authority", { align: "center" });
    doc.moveDown();
    doc.fontSize(10).text(`Reporting Period: ${formatDate(new Date())}`, { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text("Summary Statistics", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Total Claims Processed: ${stats[0].total_claims}`);
    doc.text(`Total Claim Value: ${formatCurrency(stats[0].total_value)}`);
    doc.text(`Claims Approved: ${stats[0].approved_count}`);
    doc.text(`Claims Rejected: ${stats[0].rejected_count}`);
    doc.text(`Current Month Claims: ${stats[0].monthly_total}`);

    doc.end();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=regulatory_filing.pdf");
    stream.pipe(res);
  } catch (error) {
    console.error("Regulatory report error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

export default router;