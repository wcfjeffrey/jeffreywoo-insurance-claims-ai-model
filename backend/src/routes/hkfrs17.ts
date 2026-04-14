import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = Router();

// Get HKFRS 17 compliance summary
router.get("/compliance-summary", requireAuth, requireRoles("manager", "accounting_staff"), async (req, res) => {
  try {
    // Get contract statistics
    const { rows: contractStats } = await pool.query(`
      SELECT 
        COUNT(*) as total_contracts,
        COALESCE(SUM(liability_for_remaining_coverage), 0) as total_lrc,
        COALESCE(SUM(liability_for_incurred_claims), 0) as total_lic,
        COALESCE(SUM(risk_adjustment), 0) as total_risk_adj,
        COALESCE(AVG(discount_rate), 0) as avg_discount_rate
      FROM hkfrs17_contracts
    `);

    // Get measurement statistics
    const { rows: measurementStats } = await pool.query(`
      SELECT 
        COUNT(*) as total_measurements,
        COALESCE(SUM(insurance_revenue), 0) as total_revenue,
        COALESCE(SUM(insurance_service_expenses), 0) as total_expenses
      FROM hkfrs17_measurements
      WHERE measurement_date >= NOW() - INTERVAL '12 months'
    `);

    const stats = contractStats[0] || {};
    const measStats = measurementStats[0] || {};
    
    // Calculate compliance score based on data completeness
    let complianceScore = 100;
    const issues = [];
    
    if (parseInt(stats.total_contracts) === 0) {
      complianceScore -= 30;
      issues.push("No insurance contracts found in system");
    }
    if (parseInt(measStats.total_measurements) === 0 && parseInt(stats.total_contracts) > 0) {
      complianceScore -= 20;
      issues.push("No periodic measurements recorded");
    }
    if (parseFloat(stats.total_lrc) === 0 && parseInt(stats.total_contracts) > 0) {
      complianceScore -= 15;
      issues.push("Liability for remaining coverage not calculated");
    }
    
    const complianceStatus = complianceScore >= 80 ? "Fully Compliant" : 
                            complianceScore >= 60 ? "Partially Compliant" : 
                            "Non-Compliant - Action Required";

    res.json({
      compliance_status: complianceStatus,
      compliance_score: Math.max(0, complianceScore),
      issues: issues,
      last_assessment_date: new Date().toISOString(),
      next_assessment_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      total_contracts: parseInt(stats.total_contracts) || 0,
      total_lrc: parseFloat(stats.total_lrc) || 0,
      total_lic: parseFloat(stats.total_lic) || 0,
      total_risk_adj: parseFloat(stats.total_risk_adj) || 0,
      avg_discount_rate: parseFloat(stats.avg_discount_rate) || 0,
      total_revenue: parseFloat(measStats.total_revenue) || 0,
      total_expenses: parseFloat(measStats.total_expenses) || 0
    });
  } catch (error) {
    console.error("HKFRS 17 compliance error:", error);
    res.status(500).json({ 
      error: "Failed to fetch compliance data",
      compliance_status: "Error - Unable to calculate",
      total_contracts: 0,
      total_lrc: 0,
      total_lic: 0,
      total_risk_adj: 0
    });
  }
});

// Calculate HKFRS 17 liability for a claim
router.get("/claim-liability/:claimId", requireAuth, async (req, res) => {
  try {
    const { claimId } = req.params;
    
    // Get claim details
    const { rows: claimRows } = await pool.query(
      `SELECT claimed_amount, incident_date, currency, policy_number, status 
       FROM claims WHERE id = $1::uuid`,
      [claimId]
    );
    
    if (claimRows.length === 0) {
      res.status(404).json({ error: "Claim not found" });
      return;
    }
    
    const claim = claimRows[0];
    const amount = parseFloat(claim.claimed_amount);
    
    // Calculate present value of future cashflows using discount rate
    const discountRate = 0.03; // 3% per annum
    const yearsToSettlement = 0.5; // Assume 6 months to settlement
    const pvCashflows = amount / Math.pow(1 + discountRate, yearsToSettlement);
    
    // Calculate risk adjustment (5-15% based on claim type and amount)
    let riskAdjustmentPercentage = 0.05;
    if (amount > 500000) riskAdjustmentPercentage = 0.15;
    else if (amount > 100000) riskAdjustmentPercentage = 0.10;
    
    const riskAdjustment = amount * riskAdjustmentPercentage;
    
    // Contractual Service Margin (simplified)
    const csm = amount * 0.08;
    
    // Fulfillment cashflows = PV of cashflows + RA + CSM
    const fulfillmentCashflows = pvCashflows + riskAdjustment + csm;
    
    // Determine liability category
    let liabilityCategory = "Liability for Incurred Claims";
    if (claim.status === "submitted") {
      liabilityCategory = "Liability for Remaining Coverage";
    }
    
    res.json({
      claim_id: claimId,
      claimed_amount: amount,
      currency: claim.currency,
      pv_cashflows: Math.round(pvCashflows * 100) / 100,
      risk_adjustment: Math.round(riskAdjustment * 100) / 100,
      contractual_service_margin: Math.round(csm * 100) / 100,
      fulfillment_cashflows: Math.round(fulfillmentCashflows * 100) / 100,
      discount_rate_applied: discountRate,
      liability_category: liabilityCategory,
      measurement_date: new Date().toISOString().split('T')[0]
    });
  } catch (error) {
    console.error("Liability calculation error:", error);
    res.status(500).json({ error: "Failed to calculate liability" });
  }
});

// Get contracts list
router.get("/contracts", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        c.*, 
        u.full_name as customer_name,
        COUNT(cl.id) as claims_count,
        COALESCE(SUM(cl.claimed_amount), 0) as total_claims_amount
      FROM hkfrs17_contracts c
      LEFT JOIN users u ON u.id = c.customer_id
      LEFT JOIN claims cl ON cl.policy_number = c.policy_number
      GROUP BY c.id, u.full_name
      ORDER BY c.created_at DESC
    `);
    res.json({ contracts: rows });
  } catch (error) {
    console.error("Error fetching contracts:", error);
    res.status(500).json({ error: "Failed to fetch contracts" });
  }
});

// Get contract details
router.get("/contracts/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, u.full_name as customer_name, u.email as customer_email
       FROM hkfrs17_contracts c
       LEFT JOIN users u ON u.id = c.customer_id
       WHERE c.id = $1::uuid`,
      [req.params.id]
    );
    
    if (rows.length === 0) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }
    
    // Get related claims
    const { rows: claims } = await pool.query(
      `SELECT id, reference_number, claimed_amount, status, created_at, fraud_risk_score
       FROM claims
       WHERE policy_number = $1
       ORDER BY created_at DESC`,
      [rows[0].policy_number]
    );
    
    // Get measurements for this contract
    const { rows: measurements } = await pool.query(
      `SELECT * FROM hkfrs17_measurements 
       WHERE contract_id = $1::uuid 
       ORDER BY measurement_date DESC`,
      [rows[0].id]
    );
    
    res.json({ 
      contract: rows[0], 
      claims: claims,
      measurements: measurements
    });
  } catch (error) {
    console.error("Error fetching contract details:", error);
    res.status(500).json({ error: "Failed to fetch contract details" });
  }
});

// Get measurements
router.get("/measurements", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        m.*, 
        c.contract_number, 
        c.policy_number,
        c.customer_id,
        u.full_name as customer_name
      FROM hkfrs17_measurements m
      JOIN hkfrs17_contracts c ON c.id = m.contract_id
      LEFT JOIN users u ON u.id = c.customer_id
      ORDER BY m.measurement_date DESC
      LIMIT 50
    `);
    res.json({ measurements: rows });
  } catch (error) {
    console.error("Error fetching measurements:", error);
    res.status(500).json({ error: "Failed to fetch measurements" });
  }
});

// Create a new contract
router.post("/contracts", requireAuth, requireRoles("manager", "accounting_staff"), async (req, res) => {
  try {
    const {
      contract_number,
      policy_number,
      customer_id,
      coverage_start_date,
      coverage_end_date,
      premium_amount,
      premium_currency = "HKD",
      liability_for_remaining_coverage = 0,
      liability_for_incurred_claims = 0,
      risk_adjustment = 0,
      discount_rate = 0.03
    } = req.body;
    
    const { rows } = await pool.query(
      `INSERT INTO hkfrs17_contracts (
        contract_number, policy_number, customer_id, coverage_start_date, 
        coverage_end_date, premium_amount, premium_currency, 
        liability_for_remaining_coverage, liability_for_incurred_claims, 
        risk_adjustment, discount_rate
      ) VALUES ($1, $2, $3::uuid, $4::date, $5::date, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        contract_number, policy_number, customer_id, coverage_start_date,
        coverage_end_date, premium_amount, premium_currency,
        liability_for_remaining_coverage, liability_for_incurred_claims,
        risk_adjustment, discount_rate
      ]
    );
    
    res.status(201).json({ contract: rows[0] });
  } catch (error) {
    console.error("Error creating contract:", error);
    res.status(500).json({ error: "Failed to create contract" });
  }
});

// Create a measurement for a contract
router.post("/measurements", requireAuth, requireRoles("manager", "accounting_staff"), async (req, res) => {
  try {
    const {
      contract_id,
      measurement_date,
      pv_of_future_cashflows,
      risk_adjustment,
      contractual_service_margin,
      fulfillment_cashflows,
      insurance_revenue = 0,
      insurance_service_expenses = 0
    } = req.body;
    
    const { rows } = await pool.query(
      `INSERT INTO hkfrs17_measurements (
        contract_id, measurement_date, pv_of_future_cashflows, risk_adjustment,
        contractual_service_margin, fulfillment_cashflows, insurance_revenue, insurance_service_expenses
      ) VALUES ($1::uuid, $2::date, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        contract_id, measurement_date, pv_of_future_cashflows, risk_adjustment,
        contractual_service_margin, fulfillment_cashflows, insurance_revenue, insurance_service_expenses
      ]
    );
    
    res.status(201).json({ measurement: rows[0] });
  } catch (error) {
    console.error("Error creating measurement:", error);
    res.status(500).json({ error: "Failed to create measurement" });
  }
});

export default router;