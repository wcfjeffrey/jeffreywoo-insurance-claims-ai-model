import { getChatHistory, addChatMessage, clearChatHistory } from '../lib/redis.js';
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { createOpenAIClient } from "../lib/openaiClient.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { writeAudit } from "../services/auditService.js";
import { ParsedQs } from "qs";
import { validateVendor as validateVendorService } from "../services/externalValidationService.js";
import { collectFraudIndicatorDetails, deriveRiskBand, deriveExecutiveRecommendation } from "../services/claimAnalysisReport.js";

const router = Router();

// ============================================
// Simple Query Parser (No AI required)
// ============================================

function simpleParseQuery(query: string): any {
  const lowerQuery = query.toLowerCase();
  const filters: any = {};
  
  // Status detection - in priority order
  if (lowerQuery.includes('pending payment') || lowerQuery.includes('payment pending')) {
    filters.status = 'payment_pending';
  } 
  else if (lowerQuery.includes('pending') || lowerQuery.includes('waiting')) {
    filters.status = 'submitted';
  }
  else if (lowerQuery.includes('approved')) {
    filters.status = 'approved';
  }
  else if (lowerQuery.includes('rejected')) {
    filters.status = 'rejected';
  }
  else if (lowerQuery.includes('under review')) {
    filters.status = 'under_review';
  }
  else if (lowerQuery.includes('paid')) {
    filters.status = 'paid';
  }
  else if (lowerQuery.includes('draft')) {
    filters.status = 'draft';
  }
  else if (lowerQuery.includes('escalated')) {
    filters.status = 'escalated';
  }
  else if (lowerQuery.includes('submitted')) {
    filters.status = 'submitted';
  }
  
  // Amount detection (e.g., "over 10000", "greater than 5000")
  const amountOverMatch = lowerQuery.match(/(?:over|above|greater than|more than)\s+(\d+(?:,\d+)?)/i);
  if (amountOverMatch) {
    filters.min_amount = parseFloat(amountOverMatch[1].replace(/,/g, ''));
  }
  
  // Amount detection (e.g., "under 10000", "less than 5000")
  const amountUnderMatch = lowerQuery.match(/(?:under|below|less than)\s+(\d+(?:,\d+)?)/i);
  if (amountUnderMatch) {
    filters.max_amount = parseFloat(amountUnderMatch[1].replace(/,/g, ''));
  }
  
  // Date detection
  if (lowerQuery.includes('last month')) {
    const now = new Date();
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    filters.from_date = firstDayOfLastMonth.toISOString().split('T')[0];
    filters.to_date = lastDayOfLastMonth.toISOString().split('T')[0];
  } else if (lowerQuery.includes('this month')) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    filters.from_date = firstDayOfMonth.toISOString().split('T')[0];
  }
  
  // Claimant detection
  const claimantMatch = lowerQuery.match(/from\s+([a-z\s]+)$/i);
  if (claimantMatch && claimantMatch[1].trim().length > 2) {
    filters.claimant = claimantMatch[1].trim();
  }
  
  console.log("Simple parse result:", filters);
  return filters;
}

// ============================================
// Types for AI Tool Calling
// ============================================

interface ToolResult {
  success: boolean;
  data?: any[];
  count?: number;
  summary?: string;
  error?: string;
  riskAnalysis?: {
    riskAnalysisText: string[];
    riskBand: string;
    executiveRecommendation: string;
  };
}

interface ChatResponse {
  reply: string;
  toolUsed?: string;
  claims?: any[];
  riskAnalysis?: {  
    riskAnalysisText: string[];
    riskBand: string;
    executiveRecommendation: string;
  };
}

// ============================================
// Available Tools/Functions for the AI
// ============================================

const AVAILABLE_TOOLS = [
  {
    type: "function",
    function: {
      name: "query_claims",
      description: "Search for insurance claims based on various criteria. Returns a list of claims with their details.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["draft", "submitted", "under_review", "escalated", "approved", "rejected", "payment_pending", "paid"],
            description: "Filter claims by their current status"
          },
          min_amount: {
            type: "number",
            description: "Minimum claimed amount in HKD"
          },
          max_amount: {
            type: "number",
            description: "Maximum claimed amount in HKD"
          },
          customer_name: {
            type: "string",
            description: "Customer name to search for (partial match supported)"
          },
          reference_number: {
            type: "string",
            description: "Specific claim reference number"
          },
          from_date: {
            type: "string",
            format: "date",
            description: "Start date for claim submission (YYYY-MM-DD)"
          },
          to_date: {
            type: "string",
            format: "date",
            description: "End date for claim submission (YYYY-MM-DD)"
          },
          risk_level: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "Filter by fraud risk level"
          },
          limit: {
            type: "integer",
            description: "Maximum number of results to return",
            default: 20
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_claim_statistics",
      description: "Get statistical summaries of claims including totals, averages, and counts by status",
      parameters: {
        type: "object",
        properties: {
          group_by: {
            type: "string",
            enum: ["status", "month", "risk_level"],
            description: "How to group the statistics"
          },
          from_date: {
            type: "string",
            format: "date",
            description: "Start date filter"
          },
          to_date: {
            type: "string",
            format: "date",
            description: "End date filter"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_fraud_summary",
      description: "Get fraud detection summary including high-risk claims and risk factors",
      parameters: {
        type: "object",
        properties: {
          min_risk_score: {
            type: "number",
            description: "Minimum risk score threshold (0-100)",
            default: 70
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_disbursement_summary",
      description: "Get payment and disbursement information including pending approvals",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["scheduled", "processing", "completed", "failed", "cancelled", "all"],
            description: "Filter disbursements by status: scheduled (pending), processing, completed (paid), failed, cancelled, or all",
            default: "scheduled"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_audit_events",
      description: "Get recent audit trail events for compliance monitoring",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "Filter by specific action (create, update, approve, reject, etc.)"
          },
          entity_type: {
            type: "string",
            description: "Filter by entity type (claim, payment, user, etc.)"
          },
          limit: {
            type: "integer",
            description: "Number of events to return",
            default: 20
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_vendor_details",
      description: "Get vendor/service provider details for a specific claim, including towing companies, repair shops, hospitals, etc.",
      parameters: {
        type: "object",
        properties: {
          claim_reference: {
            type: "string",
            description: "The claim reference number (e.g., CLM-2026-0103)"
          }
        },
        required: ["claim_reference"]
      }
    }
  }
];

// ============================================
// Helper Functions
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-HK', {
    style: 'currency',
    currency: 'HKD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

async function getClaimRiskAnalysis(claimId: string): Promise<{
  riskAnalysisText: string[];
  riskBand: string;
  executiveRecommendation: string;
} | undefined> {
  
  try {
    const claimResult = await pool.query(
      `SELECT fraud_risk_score, reference_number, claimed_amount, status FROM claims WHERE id = $1`,
      [claimId]
    );
    
    if (claimResult.rows.length === 0) {
      return undefined;
    }
    
    const claim = claimResult.rows[0];
    const riskScore = claim.fraud_risk_score || 0;
    const riskBand = deriveRiskBand(riskScore);
    const executiveRecommendation = deriveExecutiveRecommendation(riskScore);
    
    const riskAnalysisText = [];
    
    if (riskBand === 'Critical') {
      riskAnalysisText.push('🔴 **CRITICAL RISK** - Immediate SIU referral required. Do not process payment.');
    } else if (riskBand === 'High') {
      riskAnalysisText.push('🟠 **HIGH RISK** - Enhanced due diligence and manager review required.');
    } else if (riskBand === 'Medium') {
      riskAnalysisText.push('🟡 **MEDIUM RISK** - Additional documentation and verification recommended.');
    } else {
      riskAnalysisText.push('🟢 **LOW RISK** - Standard verification path.');
    }
    
    if (riskScore >= 70) {
      riskAnalysisText.push(`⚠️ **Fraud Risk Score**: ${riskScore}/100 - High risk claim detected.`);
    } else if (riskScore >= 40) {
      riskAnalysisText.push(`⚠️ **Fraud Risk Score**: ${riskScore}/100 - Moderate risk, recommend verification.`);
    }
    
    if (claim.status === 'escalated') {
      riskAnalysisText.push(`📌 **Status**: This claim has been escalated for manager review.`);
    }
    
    return {
      riskAnalysisText,
      riskBand,
      executiveRecommendation
    };
    
  } catch (error) {
    console.error("getClaimRiskAnalysis error:", error);
    return undefined;
  }
}

// ============================================
// Tool Execution Functions
// ============================================

async function executeQueryClaims(args: any, userId: string, userRole: string): Promise<ToolResult> {
  const { 
    status, 
    min_amount, 
    max_amount, 
    customer_name, 
    reference_number, 
    from_date, 
    to_date, 
    risk_level, 
    limit = 20 
  } = args;
  
  console.log("=== executeQueryClaims called ===");
  console.log("Arguments:", JSON.stringify(args, null, 2));
  console.log("userRole:", userRole);
  console.log("userId:", userId);
  console.log("reference_number:", reference_number);
  
  let sql = `
    SELECT 
      c.id, 
      c.reference_number, 
      c.status, 
      c.claimed_amount, 
      c.currency,
      u.full_name as customer_name,
      c.created_at, 
      c.fraud_risk_score,
      COALESCE(c.approved_amount, 0) as approved_amount
    FROM claims c
    LEFT JOIN users u ON c.customer_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramCount = 1;
  
  if (status) {
    sql += ` AND c.status = $${paramCount++}`;
    params.push(status);
  }
  if (min_amount) {
    sql += ` AND c.claimed_amount >= $${paramCount++}`;
    params.push(min_amount);
  }
  if (max_amount) {
    sql += ` AND c.claimed_amount <= $${paramCount++}`;
    params.push(max_amount);
  }
  if (customer_name) {
    sql += ` AND u.full_name ILIKE $${paramCount++}`;
    params.push(`%${customer_name}%`);
  }
  if (reference_number) {
    sql += ` AND c.reference_number ILIKE $${paramCount++}`;
    params.push(`%${reference_number}%`);
  }
  if (from_date) {
    sql += ` AND c.created_at >= $${paramCount++}`;
    params.push(from_date);
  }
  if (to_date) {
    sql += ` AND c.created_at <= $${paramCount++}`;
    params.push(to_date + ' 23:59:59');
  }
  if (risk_level === 'high') {
    sql += ` AND c.fraud_risk_score >= 70`;
  } else if (risk_level === 'medium') {
    sql += ` AND c.fraud_risk_score >= 40 AND c.fraud_risk_score < 70`;
  } else if (risk_level === 'low') {
    sql += ` AND c.fraud_risk_score < 40 AND c.fraud_risk_score IS NOT NULL`;
  }
  
  if (userRole === 'customer') {
    sql += ` AND c.customer_id = $${paramCount++}`;
    params.push(userId);
  }
  
  sql += ` ORDER BY c.created_at DESC LIMIT $${paramCount++}`;
  params.push(limit);
  
  console.log("Final SQL:", sql);
  console.log("Params:", params);
  
  try {
    const result = await pool.query(sql, params);
    
    if (result.rows.length === 0) {
      return {
        success: true,
        data: [],
        count: 0,
        summary: "No claims found matching your criteria"
      };
    }
    
    const formattedClaims = result.rows.map(row => ({
      id: row.id,
      reference_number: row.reference_number,
      status: row.status,
      claimed_amount: parseFloat(row.claimed_amount),
      currency: row.currency || 'HKD',
      customer_name: row.customer_name || 'N/A',
      created_at: row.created_at,
      fraud_risk_score: row.fraud_risk_score || 0,
      approved_amount: parseFloat(row.approved_amount) || 0
    }));
    
    const totalAmount = formattedClaims.reduce((sum, row) => sum + (row.claimed_amount || 0), 0);
    
    let riskAnalysis = undefined;
    if (formattedClaims.length === 1 && reference_number) {
      riskAnalysis = await getClaimRiskAnalysis(formattedClaims[0].id);
    }

    return {
      success: true,
      data: formattedClaims,
      count: formattedClaims.length,
      summary: `Found ${formattedClaims.length} claim(s) with total value of ${formatCurrency(totalAmount)}`,
      riskAnalysis
    };
  } catch (error) {
    console.error("Query claims error:", error);
    return { 
      success: false, 
      error: `Database error: ${error instanceof Error ? error.message : String(error)}`, 
      data: [] 
    };
  }
}

async function executeGetClaimStatistics(args: any): Promise<ToolResult> {
  const { group_by = "status", from_date, to_date } = args;
  
  let sql = `
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(claimed_amount), 0) as total_amount,
      COALESCE(AVG(claimed_amount), 0) as avg_amount
  `;
  
  if (group_by === "status") {
    sql += `, status as group_key FROM claims WHERE 1=1 GROUP BY status ORDER BY count DESC`;
  } else if (group_by === "month") {
    sql += `, DATE_TRUNC('month', created_at) as group_key FROM claims WHERE 1=1 GROUP BY DATE_TRUNC('month', created_at) ORDER BY group_key DESC`;
  } else if (group_by === "risk_level") {
    sql += `, 
      CASE 
        WHEN fraud_risk_score >= 70 THEN 'High'
        WHEN fraud_risk_score >= 40 THEN 'Medium'
        WHEN fraud_risk_score < 40 THEN 'Low'
        ELSE 'Unknown'
      END as group_key 
      FROM claims WHERE fraud_risk_score IS NOT NULL 
      GROUP BY group_key ORDER BY count DESC`;
  }
  
  if (from_date) {
    sql = sql.replace("WHERE 1=1", `WHERE created_at >= '${from_date}'`);
  }
  if (to_date) {
    sql = sql.replace("WHERE 1=1", `WHERE created_at <= '${to_date} 23:59:59'`);
  }
  
  try {
    const result = await pool.query(sql);
    return {
      success: true,
      data: result.rows,
      count: result.rows.length,
      summary: `Retrieved statistics grouped by ${group_by}`
    };
  } catch (error) {
    console.error("Get statistics error:", error);
    return { success: false, error: "Failed to get statistics", data: [] };
  }
}

async function executeGetFraudSummary(args: any): Promise<ToolResult> {
  const { min_risk_score = 70 } = args;
  
  try {
    const highRiskQuery = await pool.query(`
      SELECT COUNT(*) as high_risk_count, COALESCE(SUM(claimed_amount), 0) as high_risk_amount
      FROM claims WHERE fraud_risk_score >= $1 AND status != 'draft'
    `, [min_risk_score]);
    
    const allClaimsQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_claims,
        COALESCE(AVG(fraud_risk_score), 0) as avg_risk_score,
        COUNT(CASE WHEN fraud_risk_score >= 70 THEN 1 END) as critical_risk,
        COUNT(CASE WHEN fraud_risk_score >= 50 AND fraud_risk_score < 70 THEN 1 END) as high_risk,
        COUNT(CASE WHEN fraud_risk_score >= 25 AND fraud_risk_score < 50 THEN 1 END) as medium_risk,
        COUNT(CASE WHEN fraud_risk_score < 25 THEN 1 END) as low_risk
      FROM claims WHERE fraud_risk_score IS NOT NULL AND status != 'draft'
    `);
    
    const topRiskClaims = await pool.query(`
      SELECT reference_number, claimed_amount, fraud_risk_score
      FROM claims 
      WHERE fraud_risk_score >= $1 AND status != 'draft'
      ORDER BY fraud_risk_score DESC 
      LIMIT 5
    `, [min_risk_score]);
    
    const fraudData = {
      summary: allClaimsQuery.rows[0],
      high_risk: {
        count: parseInt(highRiskQuery.rows[0]?.high_risk_count || 0),
        amount: parseFloat(highRiskQuery.rows[0]?.high_risk_amount || 0)
      },
      top_risk_claims: topRiskClaims.rows
    };
    
    const resultData: ToolResult = {
      success: true,
      data: [fraudData],
      count: 1
    };
    
    if (allClaimsQuery.rows[0]) {
      resultData.summary = `Fraud summary: ${allClaimsQuery.rows[0]?.critical_risk || 0} critical risk claims identified`;
    }
    
    return resultData;
  } catch (error) {
    console.error("Get fraud summary error:", error);
    return { success: false, error: "Failed to get fraud summary", data: [] };
  }
}

async function executeGetDisbursementSummary(args: any, userRole: string): Promise<ToolResult> {
  const { status = "pending" } = args;
  
  try {
    let sql = `
      SELECT 
        d.id, 
        d.claim_id,
        d.gross_amount,
        d.tax_amount,
        d.net_amount, 
        d.currency,
        d.status, 
        d.scheduled_for as due_date, 
        d.paid_at,
        d.created_at,
        c.reference_number as claim_reference,
        COALESCE(u.full_name, 'Unknown') as payee_name
      FROM disbursements d
      LEFT JOIN claims c ON d.claim_id = c.id
      LEFT JOIN users u ON c.customer_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;
    
    let dbStatus = null;
    switch (status) {
      case "pending":
      case "scheduled":
        dbStatus = "scheduled";
        break;
      case "processing":
        dbStatus = "processing";
        break;
      case "completed":
      case "paid":
        dbStatus = "completed";
        break;
      case "failed":
        dbStatus = "failed";
        break;
      case "cancelled":
        dbStatus = "cancelled";
        break;
      case "all":
        dbStatus = null;
        break;
      default:
        dbStatus = null;
    }
    
    if (status !== "all" && dbStatus) {
      sql += ` AND d.status = $${paramCount++}`;
      params.push(dbStatus);
    }
    
    sql += ` ORDER BY d.created_at DESC LIMIT 20`;
    
    const result = await pool.query(sql, params);
    
    console.log("Disbursement query result:", result.rows);
    
    const formattedDisbursements = result.rows.map(row => {
      let displayStatus = row.status;
      let displayApproval = 'pending';
      
      switch (row.status) {
        case 'scheduled':
          displayStatus = 'pending';
          displayApproval = 'pending';
          break;
        case 'processing':
          displayStatus = 'processing';
          displayApproval = 'processing';
          break;
        case 'completed':
          displayStatus = 'completed';
          displayApproval = 'approved';
          break;
        case 'failed':
          displayStatus = 'failed';
          displayApproval = 'rejected';
          break;
        case 'cancelled':
          displayStatus = 'cancelled';
          displayApproval = 'rejected';
          break;
      }
      
      return {
        id: row.id,
        reference_number: row.claim_reference || `DISB-${row.id.substring(0, 8)}`,
        payee_name: row.payee_name || 'Unknown',
        net_amount: parseFloat(row.net_amount),
        currency: row.currency,
        status: displayStatus,
        approval_status: displayApproval,
        due_date: row.due_date,
        created_at: row.created_at
      };
    });
    
    const statusSummary = result.rows.reduce((acc: any, row: any) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});
    
    const summaryText = Object.entries(statusSummary)
      .map(([s, count]) => `${count} ${s}`)
      .join(', ');
    
    return {
      success: true,
      data: formattedDisbursements,
      count: formattedDisbursements.length,
      summary: `Found ${formattedDisbursements.length} disbursement(s): ${summaryText}`
    };
    
  } catch (error) {
    console.error("Get disbursement error:", error);
    return { 
      success: false, 
      error: `Failed to retrieve disbursements: ${error instanceof Error ? error.message : String(error)}`, 
      data: [] 
    };
  }
}

async function executeGetAuditEvents(args: any): Promise<ToolResult> {
  const { action, entity_type, limit = 10 } = args;
  
  let sql = `
    SELECT id, created_at, action, entity_type, entity_id, user_email, metadata
    FROM audit_logs 
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramCount = 1;
  
  if (action) {
    sql += ` AND action = $${paramCount++}`;
    params.push(action);
  }
  if (entity_type) {
    sql += ` AND entity_type = $${paramCount++}`;
    params.push(entity_type);
  }
  
  sql += ` ORDER BY created_at DESC LIMIT $${paramCount++}`;
  params.push(limit);
  
  try {
    const result = await pool.query(sql, params);
    const resultData: ToolResult = {
      success: true,
      data: result.rows,
      count: result.rows.length
    };
    
    if (result.rows.length > 0) {
      resultData.summary = `Retrieved ${result.rows.length} recent audit events`;
    }
    
    return resultData;
  } catch (error) {
    console.error("Get audit events error:", error);
    return { success: false, error: "Failed to get audit events", data: [] };
  }
}

async function executeGetVendorDetails(args: any): Promise<ToolResult> {
  const { claim_reference } = args;
  
  try {
    // 查询 vendors 表（假设存在）
    const result = await pool.query(`
      SELECT 
        v.name,
        v.type,
        v.category,
        v.address,
        v.phone,
        v.website,
        v.rating,
        v.verified,
        v.document_source
      FROM vendors v
      JOIN claims c ON v.claim_id = c.id
      WHERE c.reference_number = $1
    `, [claim_reference]);
    
    if (result.rows.length === 0) {
      return {
        success: true,
        data: [],
        count: 0,
        summary: `No vendor details found for claim ${claim_reference}`
      };
    }
    
    return {
      success: true,
      data: result.rows,
      count: result.rows.length,
      summary: `Found ${result.rows.length} vendor(s) for claim ${claim_reference}`
    };
  } catch (error) {
    console.error("Get vendor details error:", error);
    return {
      success: false,
      error: `Failed to get vendor details: ${error instanceof Error ? error.message : String(error)}`,
      data: []
    };
  }
}

// ============================================
// AI Tool Calling Function
// ============================================

async function callAIWithTools(
  userMessage: string, 
  openai: any,
  userId: string,
  userRole: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<ChatResponse> {
  
  const systemPrompt = `You are JeffreyWoo Insurance Claims AI Assistant. You help users query claims, payments, fraud risks, and audit trails.
   
IMPORTANT RULES:
1. When a user asks to SEE, SHOW, LIST, FIND, or SEARCH for claims, you MUST use the query_claims tool.
2. When asked about statistics (totals, averages, how many), use get_claim_statistics.
3. When asked about fraud or risk, use get_fraud_summary.
4. When asked about payments or disbursements, use get_disbursement_summary.
5. When asked about audit trail or who did what, use get_audit_events.
6. Always provide specific numbers and details from the tool results.
7. Format claim lists in a readable way with reference numbers and amounts.

You have access to these tools. Call them when appropriate.`;

  console.log(`📝 Chat session - User: ${userId}, History length: ${history.length}`);

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userMessage }
      ],
      tools: AVAILABLE_TOOLS,
      tool_choice: "auto",
      temperature: 0.3,
    });
    
    const message = response.choices[0].message;
    
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);
      
      console.log(`AI calling tool: ${functionName}`, functionArgs);
      
      let toolResult: ToolResult;
      let claimsData: any[] = [];
      let riskAnalysisData = undefined;
      
      switch (functionName) {
        case "query_claims":
          toolResult = await executeQueryClaims(functionArgs, userId, userRole);
          if (toolResult.success && toolResult.data) {
            claimsData = toolResult.data;
            riskAnalysisData = toolResult.riskAnalysis;
          }
          break;
        case "get_claim_statistics":
          toolResult = await executeGetClaimStatistics(functionArgs);
          break;
        case "get_fraud_summary":
          toolResult = await executeGetFraudSummary(functionArgs);
          break;
        case "get_disbursement_summary":
          toolResult = await executeGetDisbursementSummary(functionArgs, userRole);
          break;
        case "get_audit_events":
          toolResult = await executeGetAuditEvents(functionArgs);
          break;
        case "get_vendor_details":
            toolResult = await executeGetVendorDetails(functionArgs);
            break;  
        default:
          toolResult = { success: false, error: `Unknown tool: ${functionName}` };
      }
      
      const finalResponse = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: userMessage },
          { role: "assistant", content: message.content, tool_calls: message.tool_calls },
          {
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          }
        ],
        temperature: 0.3,
      });
      
      const finalReply = finalResponse.choices[0].message.content || "";
      
      const chatResponse: ChatResponse = { 
        reply: finalReply,
        toolUsed: functionName
      };
      
      if (claimsData.length > 0) {
        chatResponse.claims = claimsData;
      }
      
      if (riskAnalysisData) {
        chatResponse.riskAnalysis = riskAnalysisData;
      }
      
      return chatResponse;
    }
    
    return { reply: message.content || "I understand. How can I help with insurance claims today?" };
    
  } catch (error) {
    console.error("AI call error:", error);
    throw error;
  }
}

// ============================================
// Routes
// ============================================

const chatSchema = z.object({
  message: z.string().trim().min(1, "Message is required"),
});

const nlSchema = z.object({
  query: z.string().min(1),
});

router.post("/chat", requireAuth, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a question before clicking Ask." });
    return;
  }
  
  const userMessage = parsed.data.message;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  const openai = createOpenAIClient();
  
  if (!openai) {
    res.json({
      reply: "OpenAI API key not configured. Please set OPENAI_API_KEY to enable AI features.",
    });
    return;
  }
  
  try {
    const history = await getChatHistory(userId);

    const { reply, toolUsed, claims, riskAnalysis } = await callAIWithTools(
      userMessage,
      openai,
      userId,
      userRole,
      history
    );
    
    await addChatMessage(userId, 'user', userMessage);
    await addChatMessage(userId, 'assistant', reply);

    await writeAudit(pool, {
      userId: req.user!.id,
      action: "ai.chat",
      entityType: "ai",
      entityId: null,
      metadata: { 
        query: userMessage.slice(0, 200),
        tool_used: toolUsed,
        claims_count: claims?.length || 0,
        history_length: history.length
      },
      req,
    });

    const responseData: any = { reply };
    if (claims && claims.length > 0) {
      responseData.claims = claims;
    }
    if (toolUsed) {
      responseData.toolUsed = toolUsed;
    }
    if (riskAnalysis) {
      responseData.riskAnalysis = riskAnalysis;
    }
    
    // ✅ 只发送一次响应
    res.json(responseData);
    
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[ai/chat] Error:", e);
    // ✅ 只发送一次错误响应
    res.json({
      reply: `I encountered an error: ${msg}. Please try again or rephrase your question.`,
    });
  }
});

router.post(
  "/nl-query",
  requireAuth,
  requireRoles("manager", "claim_officer", "accounting_staff"),
  async (req, res) => {
    try {
      const parsed = nlSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid body" });
        return;
      }
      
      const query = parsed.data.query;
      console.log("=== NL QUERY RECEIVED ===");
      console.log("Query:", query);
      
      const filters = simpleParseQuery(query);
      console.log("Parsed filters:", filters);
      
      let sql = `
        SELECT 
          id, 
          reference_number, 
          status, 
          claimed_amount as amount, 
          currency,
          created_at as submitted_date
        FROM claims 
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramCount = 1;
      
      if (filters.status) {
        sql += ` AND status = $${paramCount++}`;
        params.push(filters.status);
      }
      if (filters.min_amount) {
        sql += ` AND claimed_amount >= $${paramCount++}`;
        params.push(filters.min_amount);
      }
      if (filters.max_amount) {
        sql += ` AND claimed_amount <= $${paramCount++}`;
        params.push(filters.max_amount);
      }
      if (filters.from_date) {
        sql += ` AND created_at >= $${paramCount++}`;
        params.push(filters.from_date);
      }
      if (filters.to_date) {
        sql += ` AND created_at <= $${paramCount++}`;
        params.push(filters.to_date);
      }
      
      sql += ` ORDER BY created_at DESC LIMIT 50`;
      
      console.log("SQL:", sql);
      console.log("Params:", params);
      
      const result = await pool.query(sql, params);
      console.log(`Query returned ${result.rows.length} rows`);
      
      const claimIds = result.rows.map(row => row.id);
      let customerNames: Record<string, string> = {};
      
      if (claimIds.length > 0) {
        const usersResult = await pool.query(`
          SELECT c.id, u.full_name
          FROM claims c
          LEFT JOIN users u ON c.customer_id = u.id
          WHERE c.id = ANY($1)
        `, [claimIds]);
        
        usersResult.rows.forEach(row => {
          customerNames[row.id] = row.full_name || 'N/A';
        });
      }
      
      const rows = result.rows.map(row => ({
        id: row.id,
        reference_number: row.reference_number,
        amount: parseFloat(row.amount),
        currency: row.currency,
        status: row.status,
        claimant: customerNames[row.id] || 'N/A',
        submitted_date: row.submitted_date,
        approval_status: row.status
      }));
      
      const summary = `Found ${rows.length} claim(s)${filters.status ? ` with status "${filters.status}"` : ''}`;
      
      await writeAudit(pool, {
        userId: req.user!.id,
        action: "ai.nl_query",
        entityType: "claim",
        entityId: null,
        metadata: { filters, query },
        req,
      });
      
      res.json({ filters, rows, summary });
      
    } catch (error) {
      console.error("NL Query ERROR:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Unknown error", 
        filters: {}, 
        rows: [], 
        summary: "Error processing your query" 
      });
    }
  }
);

router.get("/predictions/summary", requireAuth, async (_req, res) => {
  try {
    const { rows: claimStats } = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(claimed_amount), 0) as total_amount,
        COUNT(CASE WHEN fraud_risk_score >= 70 THEN 1 END) as high_risk,
        COUNT(CASE WHEN fraud_risk_score >= 40 AND fraud_risk_score < 70 THEN 1 END) as medium_risk,
        COUNT(CASE WHEN fraud_risk_score < 40 AND fraud_risk_score IS NOT NULL THEN 1 END) as low_risk,
        COALESCE(AVG(fraud_risk_score), 0) as avg_score
      FROM claims 
      WHERE status != 'draft'
    `);
    
    const stats = claimStats[0] || {};
    const totalClaims = parseInt(stats.total_count) || 0;
    const highRiskClaims = parseInt(stats.high_risk) || 0;
    const mediumRiskClaims = parseInt(stats.medium_risk) || 0;
    const lowRiskClaims = parseInt(stats.low_risk) || 0;
    const avgRiskScore = parseFloat(stats.avg_score) || 0;
    const estimatedExposure = parseFloat(stats.total_amount) || 0;
    const predictedFraudProbability = totalClaims > 0 ? highRiskClaims / totalClaims : 0.15;
    
    let topRiskFactors = [
      { factor: "Claim Volume", impact: Math.min(100, Math.round((totalClaims / 100) * 100)), description: `${totalClaims} total claims in system` }
    ];
    
    if (highRiskClaims > 0) {
      topRiskFactors.unshift({ 
        factor: "High Risk Claims", 
        impact: Math.min(100, Math.round((highRiskClaims / Math.max(totalClaims, 1)) * 100)), 
        description: `${highRiskClaims} claims with fraud risk score >= 70%` 
      });
    }
    
    if (estimatedExposure > 1000000) {
      topRiskFactors.push({ 
        factor: "Financial Exposure", 
        impact: 70, 
        description: `Total exposure of HK$${Math.round(estimatedExposure).toLocaleString()}` 
      });
    }
    
    const recommendations = [];
    if (highRiskClaims > 0) {
      recommendations.push(`Review ${highRiskClaims} high-risk claim(s) flagged for potential fraud`);
    }
    if (totalClaims === 0) {
      recommendations.push("No claims found. Create test claims to generate risk assessment.");
    } else {
      recommendations.push("Continue standard monitoring of claims");
    }
    if (avgRiskScore > 50) {
      recommendations.push("Average risk score above threshold - consider enhanced review process");
    }
    
    const responseData = {
      risk_score: Math.round(avgRiskScore),
      total_claims: totalClaims,
      high_risk_claims: highRiskClaims,
      medium_risk_claims: mediumRiskClaims,
      low_risk_claims: lowRiskClaims,
      predicted_fraud_probability: predictedFraudProbability,
      estimated_exposure: estimatedExposure,
      top_risk_factors: topRiskFactors,
      recommendations: recommendations.length > 0 ? recommendations : ["No recommendations at this time"]
    };
    
    res.json(responseData);
  } catch (error) {
    console.error("Predictions error:", error);
    res.json({
      risk_score: 25,
      total_claims: 0,
      high_risk_claims: 0,
      medium_risk_claims: 0,
      low_risk_claims: 0,
      predicted_fraud_probability: 0,
      estimated_exposure: 0,
      top_risk_factors: [{ factor: "System Initializing", impact: 10, description: "Add claims to see risk analysis" }],
      recommendations: ["Create claims through the New Claim page to generate risk assessment"]
    });
  }
});

router.get("/test-vendor", requireAuth, async (req, res) => {
  const vendorName = req.query.name as string || "Hudson Valley Towing & Recovery Inc.";
    
  console.log(`[TEST-VENDOR] Searching for: ${vendorName}`);
  
  const result = await validateVendorService(vendorName);
  
  res.json({
    success: true,
    vendor: vendorName,
    result
  });
  
});

export default router;
