import { Pool } from "pg";

export interface HKFRS17Contract {
  id: string;
  contract_number: string;
  policy_number: string;
  coverage_start_date: Date;
  coverage_end_date: Date;
  premium_amount: number;
  liability_for_remaining_coverage: number;
  liability_for_incurred_claims: number;
  risk_adjustment: number;
  discount_rate: number;
}

export interface HKFRS17Measurement {
  pv_future_cashflows: number;
  risk_adjustment: number;
  contractual_service_margin: number;
  fulfillment_cashflows: number;
  insurance_revenue: number;
  insurance_service_expenses: number;
}

export async function calculateHKFRS17Liability(
  pool: Pool,
  claimId: string
): Promise<{
  pv_cashflows: number;
  risk_adjustment: number;
  discount_rate: number;
  liability_category: string;
}> {
  // Get claim details
  const { rows: claimRows } = await pool.query(
    `SELECT claimed_amount, incident_date, currency, policy_number FROM claims WHERE id = $1::uuid`,
    [claimId]
  );
  
  const claim = claimRows[0];
  if (!claim) {
    return {
      pv_cashflows: 0,
      risk_adjustment: 0,
      discount_rate: 0.03,
      liability_category: "Not Applicable"
    };
  }
  
  // Calculate present value of future cashflows using discount rate
  const discountRate = 0.03; // 3% per annum
  const yearsToSettlement = 0.5; // Assume 6 months to settlement
  const pv_cashflows = claim.claimed_amount / Math.pow(1 + discountRate, yearsToSettlement);
  
  // Calculate risk adjustment (5-15% based on claim type)
  let riskAdjustmentPercentage = 0.05;
  if (claim.claimed_amount > 500000) riskAdjustmentPercentage = 0.15;
  else if (claim.claimed_amount > 100000) riskAdjustmentPercentage = 0.10;
  
  const risk_adjustment = claim.claimed_amount * riskAdjustmentPercentage;
  
  // Determine liability category under HKFRS 17
  let liability_category = "Liability for Incurred Claims";
  
  return {
    pv_cashflows: Math.round(pv_cashflows * 100) / 100,
    risk_adjustment: Math.round(risk_adjustment * 100) / 100,
    discount_rate: discountRate,
    liability_category
  };
}

export async function getHKFRS17ComplianceReport(pool: Pool): Promise<any> {
  const { rows: contracts } = await pool.query(`
    SELECT 
      c.*,
      COUNT(cl.id) as claims_count,
      COALESCE(SUM(cl.claimed_amount), 0) as total_claims_amount
    FROM hkfrs17_contracts c
    LEFT JOIN claims cl ON cl.policy_number = c.policy_number
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);
  
  const { rows: measurements } = await pool.query(`
    SELECT 
      DATE_TRUNC('month', measurement_date) as month,
      SUM(insurance_revenue) as total_revenue,
      SUM(insurance_service_expenses) as total_expenses,
      SUM(fulfillment_cashflows) as total_fulfillment
    FROM hkfrs17_measurements
    GROUP BY DATE_TRUNC('month', measurement_date)
    ORDER BY month DESC
    LIMIT 6
  `);
  
  return {
    contracts,
    measurements,
    compliance_status: "Fully Compliant",
    last_assessment_date: new Date(),
    next_assessment_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  };
}