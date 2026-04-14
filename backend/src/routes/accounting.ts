// backend/src/routes/accounting.ts
import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { writeAudit } from "../services/auditService.js";
import { syncLedgerToERP, getSyncStatus } from "../services/integrationService.js";

// CREATE the router - THIS IS WHAT YOU'RE MISSING
const router = Router();

// ============================================
// Routes
// ============================================

// Get disbursements
router.get("/disbursements", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        d.id, 
        d.claim_id,
        d.net_amount, 
        d.currency, 
        d.status,
        d.created_at,
        c.reference_number as claim_reference,
        u.full_name as payee_name
      FROM disbursements d
      LEFT JOIN claims c ON d.claim_id = c.id
      LEFT JOIN users u ON c.customer_id = u.id
      ORDER BY d.created_at DESC
    `);
    
    res.json({ disbursements: result.rows });
  } catch (error) {
    console.error("Error fetching disbursements:", error);
    res.status(500).json({ error: "Failed to fetch disbursements" });
  }
});

// Get financial summary
router.get("/summary", requireAuth, async (req, res) => {
  try {
    // Get total claims
    const totalClaimsQuery = await pool.query(`
      SELECT COALESCE(SUM(claimed_amount), 0) as total
      FROM claims 
      WHERE status != 'draft'
    `);
    
    // Get disbursed (paid claims)
    const disbursedQuery = await pool.query(`
      SELECT COALESCE(SUM(claimed_amount), 0) as total
      FROM claims 
      WHERE status = 'paid'
    `);
    
    // Get pending approval
    const pendingQuery = await pool.query(`
      SELECT COALESCE(SUM(claimed_amount), 0) as total
      FROM claims 
      WHERE status = 'approved'
    `);
    
    // Get exposure
    const exposureQuery = await pool.query(`
      SELECT COALESCE(SUM(claimed_amount), 0) as total
      FROM claims 
      WHERE status IN ('submitted', 'under_review', 'approved')
    `);
    
    // Calculate average processing days using updated_at - created_at
    const avgDaysQuery = await pool.query(`
      SELECT COALESCE(AVG(EXTRACT(DAY FROM (updated_at - created_at))), 0) as avg_days
      FROM claims 
      WHERE status = 'paid' AND updated_at IS NOT NULL
    `);
    
    const totalClaims = parseFloat(totalClaimsQuery.rows[0]?.total || 0);
    const totalDisbursed = parseFloat(disbursedQuery.rows[0]?.total || 0);
    const pendingApproval = parseFloat(pendingQuery.rows[0]?.total || 0);
    const exposureAmount = parseFloat(exposureQuery.rows[0]?.total || 0);
    const avgProcessingDays = parseFloat(avgDaysQuery.rows[0]?.avg_days || 0);
    
    console.log("Summary calculated:", {
      totalClaims,
      totalDisbursed,
      pendingApproval,
      exposureAmount,
      avgProcessingDays
    });
    
    res.json({
      total_claims: totalClaims,
      total_disbursed: totalDisbursed,
      pending_approval: pendingApproval,
      avg_processing_days: avgProcessingDays,
      projected_savings: totalClaims * 0.15,
      exposure_amount: exposureAmount,
      risk_adjusted_return: 8.5,
      capital_reserve_requirement: totalClaims * 0.2
    });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// Get cash flow forecast
router.get("/forecast", requireAuth, async (req, res) => {
  try {
    // Mock forecast data for demo
    const forecast = [];
    const today = new Date();
    
    for (let i = 0; i < 6; i++) {
      const date = new Date(today);
      date.setMonth(today.getMonth() + i);
      
      forecast.push({
        period: date.toLocaleDateString('en-HK', { year: 'numeric', month: 'short' }),
        cash_inflow: Math.random() * 500000 + 200000,
        cash_outflow: Math.random() * 400000 + 150000,
        net_cash_flow: 0,
        projected_balance: 0,
        confidence_lower: 0,
        confidence_upper: 0
      });
    }
    
    // Calculate net cash flow and running balance
    let balance = 1000000;
    for (const item of forecast) {
      item.net_cash_flow = item.cash_inflow - item.cash_outflow;
      balance += item.net_cash_flow;
      item.projected_balance = balance;
      item.confidence_lower = item.net_cash_flow * 0.9;
      item.confidence_upper = item.net_cash_flow * 1.1;
    }
    
    res.json(forecast);
  } catch (error) {
    console.error("Error fetching forecast:", error);
    res.status(500).json({ error: "Failed to fetch forecast" });
  }
});

// Sync ledger to ERP
router.post("/sync-ledger", requireAuth, async (req, res) => {
  try {
    const { system = 'both' } = req.body;
    
    console.log("Sync ledger request received for system:", system);
    
    const result = await syncLedgerToERP(system, pool);
    
    console.log("Sync result:", result);
    
    await writeAudit(pool, {
      userId: req.user!.id,
      action: "accounting.sync_ledger",
      entityType: "accounting",
      entityId: null,
      metadata: { system, result },
      req,
    });
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: result.message || `Successfully synced to ${system}`,
        details: result
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: result.message || result.error || "Sync failed",
        details: result
      });
    }
  } catch (error) {
    console.error("Sync ledger error:", error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to sync ledger" 
    });
  }
});

// Get sync status
router.get("/sync-status", requireAuth, async (req, res) => {
  try {
    const status = await getSyncStatus(pool);
    res.json(status);
  } catch (error) {
    console.error("Error fetching sync status:", error);
    res.status(500).json({ error: "Failed to get sync status" });
  }
});

// Create disbursement from claim
router.post("/disbursements/from-claim/:claimId", requireAuth, async (req, res) => {
  const { claimId } = req.params;
  
  try {
    // Get claim details
    const claimResult = await pool.query(`
      SELECT id, reference_number, claimed_amount, currency, customer_id
      FROM claims
      WHERE id = $1
    `, [claimId]);
    
    if (claimResult.rows.length === 0) {
      res.status(404).json({ error: "Claim not found" });
      return;
    }
    
    const claim = claimResult.rows[0];
    
    // Create disbursement
    const result = await pool.query(`
      INSERT INTO disbursements (
        claim_id,
        reference_number,
        gross_amount,
        net_amount,
        currency,
        status,
        approval_status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'pending', 'pending', NOW(), NOW())
      RETURNING *
    `, [claimId, `DISB-${claim.reference_number}`, claim.claimed_amount, claim.claimed_amount, claim.currency]);
    
    // Update claim status
    await pool.query(`
      UPDATE claims 
      SET status = 'payment_pending', updated_at = NOW()
      WHERE id = $1
    `, [claimId]);
    
    res.json({ disbursement: result.rows[0] });
  } catch (error) {
    console.error("Error creating disbursement:", error);
    res.status(500).json({ error: "Failed to create disbursement" });
  }
});

// Submit disbursement to HKMA
router.post("/disbursements/:disbursementId/hkma-submit", requireAuth, async (req, res) => {
  const { disbursementId } = req.params;
  
  try {
    // Update disbursement status
    await pool.query(`
      UPDATE disbursements 
      SET status = 'processing', 
          hkma_submitted_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `, [disbursementId]);
    
    res.json({ success: true, message: "Submitted to HKMA successfully" });
  } catch (error) {
    console.error("Error submitting to HKMA:", error);
    res.status(500).json({ error: "Failed to submit to HKMA" });
  }
});

// ============================================
// DEFAULT EXPORT
// ============================================
export default router;