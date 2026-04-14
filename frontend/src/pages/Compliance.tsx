import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";

interface ComplianceEvent {
  id: string;
  event_type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  timestamp: string;
  source: string;
  status: "open" | "investigating" | "resolved" | "closed";
  assigned_to?: string;
  regulation: string;
}

interface MonitoringData {
  summary: {
    total_events: number;
    open_issues: number;
    critical_alerts: number;
    compliance_rate: number;
    last_assessment: string;
    next_assessment: string;
  };
  risk_metrics: Array<{
    category: string;
    current_value: number;
    threshold: number;
    status: string;
    trend: "up" | "down" | "stable";
  }>;
  recent_findings: Array<{
    id: string;
    finding: string;
    severity: string;
    discovered_date: string;
    remediation_status: string;
    responsible_party: string;
  }>;
  regulatory_deadlines: Array<{
    regulation: string;
    requirement: string;
    deadline: string;
    status: string;
  }>;
}

type EventSortField = "severity" | "event_type" | "description" | "regulation" | "timestamp" | "status" | "assigned_to";
type SortOrder = "asc" | "desc";

export function CompliancePage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<ComplianceEvent[]>([]);
  const [monitoring, setMonitoring] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState({
    events: true,
    monitoring: false,
  });
  const [filter, setFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<EventSortField>("timestamp");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    async function fetchEvents() {
      try {
        const response = await api<any>("/compliance/events");
        if (Array.isArray(response)) {
          setEvents(response);
        } else if (response.events && Array.isArray(response.events)) {
          setEvents(response.events);
        } else {
          setEvents([]);
        }
      } catch (error) {
        console.error("Failed to fetch compliance events:", error);
        setError(t("compliance.fetchError"));
      } finally {
        setLoading(prev => ({ ...prev, events: false }));
      }
    }
    fetchEvents();
  }, [t]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-HK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString || t("compliance.dateNotAvailable");
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('en-HK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString || t("compliance.dateNotAvailable");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "critical": return { bg: "#ffebee", color: "#c62828", icon: "🔴", label: t("compliance.critical") };
      case "high": return { bg: "#fff3e0", color: "#f57c00", icon: "🟠", label: t("compliance.high") };
      case "medium": return { bg: "#fff9c4", color: "#f9a825", icon: "🟡", label: t("compliance.medium") };
      case "low": return { bg: "#e8f5e9", color: "#2e7d32", icon: "🟢", label: t("compliance.low") };
      default: return { bg: "#f5f5f5", color: "#666", icon: "⚪", label: t("compliance.unknown") };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "open": return { bg: "#ffebee", color: "#c62828", label: t("compliance.open") };
      case "investigating": return { bg: "#fff3e0", color: "#f57c00", label: t("compliance.investigating") };
      case "resolved": return { bg: "#e8f5e9", color: "#2e7d32", label: t("compliance.resolved") };
      case "closed": return { bg: "#e3f2fd", color: "#1976d2", label: t("compliance.closed") };
      case "completed": return { bg: "#e8f5e9", color: "#1b5e20", label: t("compliance.completed") };
      case "in-progress": return { bg: "#fff3e0", color: "#e65100", label: t("compliance.inProgress") };
      case "pending": return { bg: "#fff9c4", color: "#f57f17", label: t("compliance.pending") };
      default: return { bg: "#f5f5f5", color: "#424242", label: status || t("compliance.unknown") };
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up": return "📈";
      case "down": return "📉";
      default: return "➡️";
    }
  };

  const getComplianceStatusDisplay = (status: string): string => {
    if (!status) return t("compliance.unknown");
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === "fully compliant" || lowerStatus === "fully_compliant") {
      return t("compliance.fullyCompliant");
    }
    if (lowerStatus === "partially compliant" || lowerStatus === "partially_compliant") {
      return t("compliance.partiallyCompliant");
    }
    if (lowerStatus === "non compliant" || lowerStatus === "non_compliant") {
      return t("compliance.nonCompliant");
    }
    return status;
  };

  const handleSort = (field: EventSortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (field: EventSortField) => {
    if (sortField !== field) return "↕️";
    return sortOrder === "asc" ? "↑" : "↓";
  };

  const getFilteredAndSortedEvents = () => {
    let filtered = [...events];
    
    // Severity filter
    if (severityFilter !== "all") {
      filtered = filtered.filter(e => e.severity?.toLowerCase() === severityFilter);
    }
    
    // Status filter
    if (filter !== "all") {
      filtered = filtered.filter(e => e.status?.toLowerCase() === filter);
    }
    
    // Sorting
    return filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "severity":
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          aVal = severityOrder[a.severity?.toLowerCase() as keyof typeof severityOrder] || 0;
          bVal = severityOrder[b.severity?.toLowerCase() as keyof typeof severityOrder] || 0;
          break;
        case "event_type":
          aVal = a.event_type;
          bVal = b.event_type;
          break;
        case "description":
          aVal = a.description;
          bVal = b.description;
          break;
        case "regulation":
          aVal = a.regulation;
          bVal = b.regulation;
          break;
        case "timestamp":
          aVal = new Date(a.timestamp).getTime();
          bVal = new Date(b.timestamp).getTime();
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "assigned_to":
          aVal = a.assigned_to || "";
          bVal = b.assigned_to || "";
          break;
        default:
          aVal = a.timestamp;
          bVal = b.timestamp;
      }
      
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  };

  const filteredAndSortedEvents = getFilteredAndSortedEvents();

  const stats = {
    total: events.length,
    open: events.filter(e => e.status?.toLowerCase() === "open").length,
    investigating: events.filter(e => e.status?.toLowerCase() === "investigating").length,
    resolved: events.filter(e => e.status?.toLowerCase() === "resolved").length,
    critical: events.filter(e => e.severity?.toLowerCase() === "critical").length,
    high: events.filter(e => e.severity?.toLowerCase() === "high").length,
  };

  const transformMonitoringData = (data: any): MonitoringData => {
    return {
      summary: {
        total_events: data.total_events || data.summary?.total_events || 0,
        open_issues: data.open_issues || data.summary?.open_issues || 0,
        critical_alerts: data.critical_alerts || data.summary?.critical_alerts || 0,
        compliance_rate: data.compliance_rate || data.summary?.compliance_rate || 0,
        last_assessment: data.last_assessment || data.summary?.last_assessment || new Date().toISOString(),
        next_assessment: data.next_assessment || data.summary?.next_assessment || new Date().toISOString(),
      },
      risk_metrics: data.risk_metrics || data.risk_indicators?.map((r: any) => ({
        category: r.name || r.category,
        current_value: r.value || r.current_value,
        threshold: r.threshold || 100,
        status: r.status || (r.value > r.threshold ? "warning" : "healthy"),
        trend: r.trend || "stable"
      })) || [],
      recent_findings: data.recent_findings || data.findings?.map((f: any) => ({
        id: f.id,
        finding: f.description || f.finding,
        severity: f.severity || "medium",
        discovered_date: f.date || f.discovered_date,
        remediation_status: f.status || f.remediation_status,
        responsible_party: f.assigned_to || f.responsible_party
      })) || [],
      regulatory_deadlines: data.regulatory_deadlines || data.deadlines?.map((d: any) => ({
        regulation: d.regulation,
        requirement: d.requirement,
        deadline: d.deadline,
        status: d.status
      })) || [],
    };
  };

  return (
    <div style={{ 
      padding: "24px", 
      maxWidth: "1600px", 
      margin: "0 auto", 
      background: "#f0f2f5", 
      minHeight: "100vh",
      fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif"
    }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ 
          fontSize: "28px", 
          fontWeight: "600", 
          color: "#1a1a1a",
          margin: 0,
          marginBottom: "8px",
          letterSpacing: "-0.5px"
        }}>
          {t("compliance.title")}
        </h1>
        <p style={{ color: "#5a5a5a", margin: 0, fontSize: "14px" }}>
          {t("compliance.subtitle")}
        </p>
      </div>

      {error && (
        <div style={{ 
          background: "#ffebee", 
          borderLeft: "4px solid #c62828",
          padding: "14px 20px",
          marginBottom: "24px",
          borderRadius: "8px",
          color: "#c62828",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span>⚠️ {error}</span>
          <button 
            onClick={() => setError(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#c62828" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px",
        marginBottom: "24px"
      }}>
        <div style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: "12px",
          padding: "20px",
          color: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {t("compliance.totalEvents")}
          </div>
          <div style={{ fontSize: "32px", fontWeight: "bold" }}>{stats.total}</div>
        </div>
        <div style={{
          background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
          borderRadius: "12px",
          padding: "20px",
          color: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {t("compliance.openIssues")}
          </div>
          <div style={{ fontSize: "32px", fontWeight: "bold" }}>{stats.open}</div>
        </div>
        <div style={{
          background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
          borderRadius: "12px",
          padding: "20px",
          color: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {t("compliance.criticalAlerts")}
          </div>
          <div style={{ fontSize: "32px", fontWeight: "bold" }}>{stats.critical}</div>
        </div>
        <div style={{
          background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
          borderRadius: "12px",
          padding: "20px",
          color: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {t("compliance.complianceRate")}
          </div>
          <div style={{ fontSize: "32px", fontWeight: "bold" }}>{stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 100}%</div>
        </div>
      </div>

      {/* Monitoring Section */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#1a1a1a" }}>
            {t("compliance.riskMonitoringDashboard")}
          </h2>
          <button
            type="button"
            onClick={async () => {
              setLoading(prev => ({ ...prev, monitoring: true }));
              setError(null);
              try {
                const r = await api<any>("/compliance/monitoring");
                setMonitoring(transformMonitoringData(r));
                if (!r || Object.keys(r).length === 0) {
                  setError(t("compliance.noDataError"));
                }
              } catch (error) {
                console.error("Failed to load monitoring data:", error);
                setError(error instanceof Error ? error.message : t("compliance.monitoringError"));
                setMonitoring(null);
              } finally {
                setLoading(prev => ({ ...prev, monitoring: false }));
              }
            }}
            style={{
              padding: "8px 20px",
              background: "#1976d2",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "500",
              fontSize: "13px",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#1565c0"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#1976d2"; }}
          >
            {loading.monitoring ? t("compliance.loading") : t("compliance.refreshMonitoringData")}
          </button>
        </div>

        {loading.monitoring && (
          <div style={{ textAlign: "center", padding: "60px", background: "white", borderRadius: "12px", border: "1px solid #e8e8e8" }}>
            {t("compliance.loadingMonitoringData")}
          </div>
        )}

        {monitoring && !loading.monitoring && (
          <div>
            {/* Summary Cards */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
              marginBottom: "24px"
            }}>
              <div style={{ padding: "20px", background: "white", borderRadius: "12px", border: "1px solid #e8e8e8", boxShadow: "0 2px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px", fontWeight: "500" }}>{t("compliance.totalEvents")}</div>
                <div style={{ fontSize: "32px", fontWeight: "bold", color: "#1976d2" }}>{monitoring.summary.total_events}</div>
              </div>
              <div style={{ padding: "20px", background: "white", borderRadius: "12px", border: "1px solid #e8e8e8", boxShadow: "0 2px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px", fontWeight: "500" }}>{t("compliance.openIssues")}</div>
                <div style={{ fontSize: "32px", fontWeight: "bold", color: "#f57c00" }}>{monitoring.summary.open_issues}</div>
              </div>
              <div style={{ padding: "20px", background: "white", borderRadius: "12px", border: "1px solid #e8e8e8", boxShadow: "0 2px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px", fontWeight: "500" }}>{t("compliance.criticalAlerts")}</div>
                <div style={{ fontSize: "32px", fontWeight: "bold", color: "#c62828" }}>{monitoring.summary.critical_alerts}</div>
              </div>
              <div style={{ padding: "20px", background: "white", borderRadius: "12px", border: "1px solid #e8e8e8", boxShadow: "0 2px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px", fontWeight: "500" }}>{t("compliance.complianceRate")}</div>
                <div style={{ fontSize: "32px", fontWeight: "bold", color: "#2e7d32" }}>{monitoring.summary.compliance_rate}%</div>
              </div>
            </div>

            {/* Assessment Dates */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginBottom: "24px" }}>
              <div style={{ padding: "14px 16px", background: "#e3f2fd", borderRadius: "8px", borderLeft: "3px solid #1976d2" }}>
                <div style={{ fontSize: "11px", fontWeight: "600", color: "#1976d2", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {t("compliance.lastAssessment")}
                </div>
                <div style={{ fontSize: "14px", fontWeight: "500", color: "#1a1a1a" }}>
                  {formatDateTime(monitoring.summary.last_assessment)}
                </div>
              </div>
              <div style={{ padding: "14px 16px", background: "#fff3e0", borderRadius: "8px", borderLeft: "3px solid #f57c00" }}>
                <div style={{ fontSize: "11px", fontWeight: "600", color: "#f57c00", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {t("compliance.nextAssessment")}
                </div>
                <div style={{ fontSize: "14px", fontWeight: "500", color: "#1a1a1a" }}>
                  {formatDateTime(monitoring.summary.next_assessment)}
                </div>
              </div>
            </div>

            {/* Compliance Status Banner */}
            {monitoring.summary.compliance_rate !== undefined && (
              <div style={{
                background: "linear-gradient(135deg, #1a237e 0%, #283593 100%)",
                borderRadius: "12px",
                padding: "20px",
                marginBottom: "24px",
                color: "white"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                  <div>
                    <div style={{ fontSize: "12px", opacity: 0.8, textTransform: "uppercase", letterSpacing: "1px" }}>
                      {t("compliance.complianceStatus")}
                    </div>
                    <div style={{ fontSize: "28px", fontWeight: "bold" }}>
                      {monitoring.summary.compliance_rate >= 90 
                        ? t("compliance.fullyCompliant")
                        : monitoring.summary.compliance_rate >= 70
                        ? t("compliance.partiallyCompliant")
                        : t("compliance.nonCompliant")}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", opacity: 0.8 }}>{t("compliance.complianceRate")}</div>
                    <div style={{ fontSize: "28px", fontWeight: "bold" }}>{monitoring.summary.compliance_rate}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", opacity: 0.8 }}>{t("compliance.lastAssessment")}</div>
                    <div>{formatDate(monitoring.summary.last_assessment)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", opacity: 0.8 }}>{t("compliance.nextAssessment")}</div>
                    <div>{formatDate(monitoring.summary.next_assessment)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Risk Metrics Table */}
            {monitoring.risk_metrics && monitoring.risk_metrics.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ marginBottom: "16px", fontSize: "16px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.riskMetrics")}</h3>
                <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #e8e8e8", background: "white" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e8e8e8" }}>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.category")}</th>
                        <th style={{ padding: "12px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.currentValue")}</th>
                        <th style={{ padding: "12px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.threshold")}</th>
                        <th style={{ padding: "12px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.status")}</th>
                        <th style={{ padding: "12px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.trend")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitoring.risk_metrics.map((metric, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === monitoring.risk_metrics.length - 1 ? "none" : "1px solid #f0f0f0" }}>
                          <td style={{ padding: "12px", fontWeight: "500", fontSize: "13px", color: "#1a1a1a" }}>{metric.category}</td>
                          <td style={{ padding: "12px", textAlign: "center", fontWeight: "600", fontSize: "13px", color: "#1a1a1a" }}>{metric.current_value}</td>
                          <td style={{ padding: "12px", textAlign: "center", fontSize: "13px", color: "#666" }}>{metric.threshold}</td>
                          <td style={{ padding: "12px", textAlign: "center" }}>
                            <span style={{
                              display: "inline-block",
                              padding: "4px 12px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: "600",
                              background: metric.status === "critical" ? "#ffebee" : metric.status === "warning" ? "#fff3e0" : "#e8f5e9",
                              color: metric.status === "critical" ? "#c62828" : metric.status === "warning" ? "#e65100" : "#2e7d32"
                            }}>
                              {metric.status === "critical" ? t("compliance.critical") : 
                               metric.status === "warning" ? t("compliance.high") : 
                               t("compliance.healthy")}
                            </span>
                          </td>
                          <td style={{ padding: "12px", textAlign: "center", fontSize: "20px" }}>
                            {getTrendIcon(metric.trend)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent Findings Table */}
            {monitoring.recent_findings && monitoring.recent_findings.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ marginBottom: "16px", fontSize: "16px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.recentAuditFindings")}</h3>
                <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #e8e8e8", background: "white" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e8e8e8" }}>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.finding")}</th>
                        <th style={{ padding: "12px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.severity")}</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.discovered")}</th>
                        <th style={{ padding: "12px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.status")}</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.responsible")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitoring.recent_findings.map((finding, idx) => {
                        const severityStyle = getSeverityColor(finding.severity);
                        const statusStyle = getStatusColor(finding.remediation_status);
                        return (
                          <tr key={finding.id} style={{ borderBottom: idx === monitoring.recent_findings.length - 1 ? "none" : "1px solid #f0f0f0" }}>
                            <td style={{ padding: "12px", fontSize: "13px", color: "#424242" }}>{finding.finding}</td>
                            <td style={{ padding: "12px", textAlign: "center" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "4px", background: severityStyle.bg, color: severityStyle.color, fontSize: "11px", fontWeight: "600" }}>
                                {severityStyle.icon} {severityStyle.label}
                              </span>
                            </td>
                            <td style={{ padding: "12px", fontSize: "12px", color: "#666" }}>{formatDate(finding.discovered_date)}</td>
                            <td style={{ padding: "12px", textAlign: "center" }}>
                              <span style={{ padding: "4px 10px", borderRadius: "4px", background: statusStyle.bg, color: statusStyle.color, fontSize: "11px", fontWeight: "500" }}>
                                {statusStyle.label}
                              </span>
                            </td>
                            <td style={{ padding: "12px", fontSize: "12px", color: "#424242" }}>{finding.responsible_party}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Regulatory Deadlines Table */}
            {monitoring.regulatory_deadlines && monitoring.regulatory_deadlines.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ marginBottom: "16px", fontSize: "16px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.regulatoryDeadlines")}</h3>
                <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #e8e8e8", background: "white" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e8e8e8" }}>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.regulation")}</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.requirement")}</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.deadline")}</th>
                        <th style={{ padding: "12px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitoring.regulatory_deadlines.map((deadline, idx) => {
                        const statusStyle = getStatusColor(deadline.status);
                        const isOverdue = new Date(deadline.deadline) < new Date();
                        return (
                          <tr key={idx} style={{ borderBottom: idx === monitoring.regulatory_deadlines.length - 1 ? "none" : "1px solid #f0f0f0" }}>
                            <td style={{ padding: "12px", fontWeight: "600", fontSize: "13px", color: "#1a1a1a" }}>{deadline.regulation}</td>
                            <td style={{ padding: "12px", fontSize: "13px", color: "#424242" }}>{deadline.requirement}</td>
                            <td style={{ padding: "12px", color: isOverdue ? "#c62828" : "#666", fontWeight: isOverdue ? "bold" : "normal", fontSize: "12px" }}>
                              {formatDate(deadline.deadline)} {isOverdue && `⚠️ ${t("compliance.overdue")}`}
                            </td>
                            <td style={{ padding: "12px", textAlign: "center" }}>
                              <span style={{ padding: "4px 10px", borderRadius: "4px", background: statusStyle.bg, color: statusStyle.color, fontSize: "11px", fontWeight: "500" }}>
                                {statusStyle.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Events Table Section with Sorting */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#1a1a1a" }}>{t("compliance.complianceEventsLog")}</h2>
          <div style={{ display: "flex", gap: "12px" }}>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                padding: "8px 14px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
                background: "white",
                color: "#1a1a1a"
              }}
            >
              <option value="all" style={{ color: "#1a1a1a", fontWeight: "500", background: "white" }}>📊 {t("compliance.allSeverities")}</option>
              <option value="critical" style={{ color: "#c62828", fontWeight: "500", background: "white" }}>🔴 {t("compliance.critical")}</option>
              <option value="high" style={{ color: "#f57c00", fontWeight: "500", background: "white" }}>🟠 {t("compliance.high")}</option>
              <option value="medium" style={{ color: "#f9a825", fontWeight: "500", background: "white" }}>🟡 {t("compliance.medium")}</option>
              <option value="low" style={{ color: "#2e7d32", fontWeight: "500", background: "white" }}>🟢 {t("compliance.low")}</option>
            </select>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                padding: "8px 14px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
                background: "white",
                color: "#1a1a1a"
              }}
            >
              <option value="all" style={{ color: "#1a1a1a", fontWeight: "500", background: "white" }}>📋 {t("compliance.allStatuses")}</option>
              <option value="open" style={{ color: "#c62828", fontWeight: "500", background: "white" }}>🔴 {t("compliance.open")}</option>
              <option value="investigating" style={{ color: "#f57c00", fontWeight: "500", background: "white" }}>🟠 {t("compliance.investigating")}</option>
              <option value="resolved" style={{ color: "#2e7d32", fontWeight: "500", background: "white" }}>🟢 {t("compliance.resolved")}</option>
              <option value="closed" style={{ color: "#1976d2", fontWeight: "500", background: "white" }}>🔵 {t("compliance.closed")}</option>
            </select>
          </div>
        </div>

        {loading.events ? (
          <div style={{ textAlign: "center", padding: "60px", background: "white", borderRadius: "12px", border: "1px solid #e8e8e8" }}>
            {t("compliance.loadingEvents")}
          </div>
        ) : filteredAndSortedEvents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", background: "white", borderRadius: "12px", color: "#666", border: "1px solid #e8e8e8" }}>
            {t("compliance.noEventsFound")}
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #e8e8e8", background: "white" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1a237e", color: "white" }}>
                  <th 
                    style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "white", cursor: "pointer" }}
                    onClick={() => handleSort("severity")}
                  >
                    {t("compliance.severity")} {getSortIcon("severity")}
                  </th>
                  <th 
                    style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "white", cursor: "pointer" }}
                    onClick={() => handleSort("event_type")}
                  >
                    {t("compliance.eventType")} {getSortIcon("event_type")}
                  </th>
                  <th 
                    style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "white", cursor: "pointer" }}
                    onClick={() => handleSort("description")}
                  >
                    {t("compliance.description")} {getSortIcon("description")}
                  </th>
                  <th 
                    style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "white", cursor: "pointer" }}
                    onClick={() => handleSort("regulation")}
                  >
                    {t("compliance.regulation")} {getSortIcon("regulation")}
                  </th>
                  <th 
                    style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "white", cursor: "pointer" }}
                    onClick={() => handleSort("timestamp")}
                  >
                    {t("compliance.timestamp")} {getSortIcon("timestamp")}
                  </th>
                  <th 
                    style={{ padding: "12px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "white", cursor: "pointer" }}
                    onClick={() => handleSort("status")}
                  >
                    {t("compliance.status")} {getSortIcon("status")}
                  </th>
                  <th 
                    style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "white", cursor: "pointer" }}
                    onClick={() => handleSort("assigned_to")}
                  >
                    {t("compliance.assignedTo")} {getSortIcon("assigned_to")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedEvents.map((event, idx) => {
                  const severityStyle = getSeverityColor(event.severity);
                  const statusStyle = getStatusColor(event.status);
                  return (
                    <tr key={event.id} style={{ borderBottom: idx === filteredAndSortedEvents.length - 1 ? "none" : "1px solid #f0f0f0", background: idx % 2 === 0 ? "white" : "#fafafa" }}>
                      <td style={{ padding: "12px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "4px", background: severityStyle.bg, color: severityStyle.color, fontSize: "11px", fontWeight: "600" }}>
                          {severityStyle.icon} {severityStyle.label}
                        </span>
                       </td>
                      <td style={{ padding: "12px", fontWeight: "500", fontSize: "13px", color: "#1a1a1a" }}>{event.event_type}</td>
                      <td style={{ padding: "12px", fontSize: "13px", color: "#424242", maxWidth: "300px" }}>{event.description}</td>
                      <td style={{ padding: "12px" }}>
                        <code style={{ background: "#f5f5f5", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "500", color: "#1a1a1a" }}>{event.regulation}</code>
                      </td>
                      <td style={{ padding: "12px", fontSize: "12px", color: "#666" }}>{formatDateTime(event.timestamp)}</td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <span style={{ padding: "4px 10px", borderRadius: "4px", background: statusStyle.bg, color: statusStyle.color, fontSize: "11px", fontWeight: "500" }}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td style={{ padding: "12px", fontSize: "12px", color: "#424242" }}>{event.assigned_to || t("compliance.unassigned")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: "32px",
        padding: "16px 20px",
        background: "#f8f9fa",
        borderRadius: "8px",
        border: "1px solid #e8e8e8",
        fontSize: "12px",
        color: "#666",
        textAlign: "center"
      }}>
        <span>🔒 {t("compliance.compliantWithStandards")} | </span>
        <span>📋 {t("compliance.realTimeMonitoring")} | </span>
        <span>🕒 {t("compliance.lastUpdated")}: {new Date().toLocaleString('en-HK')}</span>
      </div>
    </div>
  );
}