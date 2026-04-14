import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /compliance/events
router.get("/events", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        id,
        framework as event_type,
        severity,
        COALESCE(details->>'description', framework || ' ' || rule_code) as description,
        COALESCE(details->>'source', 'System') as source,
        CASE 
          WHEN details->>'status' IS NOT NULL THEN details->>'status'
          WHEN created_at < NOW() - INTERVAL '30 days' THEN 'resolved'
          ELSE 'open'
        END as status,
        framework as regulation,
        COALESCE(details->>'assigned_to', 'Unassigned') as assigned_to,
        created_at as timestamp
      FROM compliance_events 
      ORDER BY created_at DESC 
      LIMIT 100
    `);
    
    res.json({ events: rows });
  } catch (error) {
    console.error("Error fetching compliance events:", error);
    res.status(500).json({ error: "Failed to fetch compliance events" });
  }
});

// GET /compliance/monitoring
router.get("/monitoring", requireAuth, async (req, res) => {
  try {
    const { rows: stats } = await pool.query(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN severity IN ('critical', 'high') AND created_at > NOW() - INTERVAL '30 days' THEN 1 END) as open_issues,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts
      FROM compliance_events
    `);
    
    const totalEvents = parseInt(stats[0]?.total_events) || 0;
    const openIssues = parseInt(stats[0]?.open_issues) || 0;
    const criticalAlerts = parseInt(stats[0]?.critical_alerts) || 0;
    const complianceRate = totalEvents > 0 ? Math.round(((totalEvents - openIssues) / totalEvents) * 100) : 100;
    
    // Get risk metrics
    const riskMetrics = [
      { 
        category: "Compliance Score", 
        current_value: complianceRate, 
        threshold: 90, 
        status: complianceRate >= 90 ? "healthy" : complianceRate >= 70 ? "warning" : "critical", 
        trend: "stable" 
      },
      { 
        category: "Open Issues", 
        current_value: openIssues, 
        threshold: 10, 
        status: openIssues <= 5 ? "healthy" : openIssues <= 10 ? "warning" : "critical", 
        trend: openIssues > 5 ? "up" : "down" 
      },
      { 
        category: "Critical Alerts", 
        current_value: criticalAlerts, 
        threshold: 5, 
        status: criticalAlerts <= 2 ? "healthy" : criticalAlerts <= 5 ? "warning" : "critical", 
        trend: criticalAlerts > 0 ? "up" : "down" 
      }
    ];
    
    // Get recent findings
    const { rows: findings } = await pool.query(`
      SELECT 
        id,
        COALESCE(details->>'description', framework || ' ' || rule_code) as finding,
        severity,
        created_at as discovered_date,
        CASE 
          WHEN created_at < NOW() - INTERVAL '30 days' THEN 'resolved'
          ELSE 'open'
        END as remediation_status,
        COALESCE(details->>'assigned_to', 'Unassigned') as responsible_party
      FROM compliance_events 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    // Get regulatory deadlines (you can store these in a separate table or return as is)
    const regulatoryDeadlines = [
      {
        regulation: "HKMA",
        requirement: "Quarterly Financial Report",
        deadline: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15).toISOString(),
        status: "pending"
      },
      {
        regulation: "IFRS 17",
        requirement: "Annual Disclosure",
        deadline: new Date(new Date().getFullYear(), 2, 31).toISOString(),
        status: "in-progress"
      },
      {
        regulation: "Basel III",
        requirement: "Capital Adequacy Report",
        deadline: new Date(new Date().getFullYear(), new Date().getMonth() + 2, 30).toISOString(),
        status: "not-started"
      }
    ];
    
    res.json({
      summary: {
        total_events: totalEvents,
        open_issues: openIssues,
        critical_alerts: criticalAlerts,
        compliance_rate: complianceRate,
        last_assessment: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        next_assessment: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      risk_metrics: riskMetrics,
      recent_findings: findings,
      regulatory_deadlines: regulatoryDeadlines
    });
  } catch (error) {
    console.error("Error fetching monitoring data:", error);
    res.status(500).json({ error: "Failed to fetch monitoring data" });
  }
});

export default router;