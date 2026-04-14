import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";

type AuditEntry = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_email: string;
  user_name?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
};

type SortField = "timestamp" | "action" | "entity" | "user";
type SortOrder = "asc" | "desc";

// Helper function to translate entity types
const getTranslatedEntityType = (entityType: string, t: (key: string) => string): string => {
  const entityMap: Record<string, string> = {
    // Core entities
    claim: "audit.entityClaim",
    user: "audit.entityUser",
    document: "audit.entityDocument",
    payment: "audit.entityPayment",
    disbursement: "audit.entityDisbursement",
    workflow: "audit.entityWorkflow",
    comment: "audit.entityComment",
    report: "audit.entityReport",
    contract: "audit.entityContract",
    measurement: "audit.entityMeasurement",
    compliance: "audit.entityCompliance",
    
    // Document related
    claim_document: "audit.entityClaimDocument",
    claim_documents: "audit.entityClaimDocument",
    
    // Accounting/Financial
    ledger: "audit.entityLedger",
    journal: "audit.entityJournal",
    transaction: "audit.entityTransaction",
    accounting_entry: "audit.entityAccountingEntry",
    
    // HKFRS 17 related
    csm_calculation: "audit.entityCsmCalculation",
    risk_adjustment: "audit.entityRiskAdjustment",
    
    // AI related
    ai_validation: "audit.entityAiValidation",
    ai_prediction: "audit.entityAiPrediction",
    
    // Compliance
    audit_log: "audit.entityAuditLog",
    compliance_event: "audit.entityComplianceEvent",
    
    // Settings
    user_role: "audit.entityUserRole",
    permission: "audit.entityPermission",
    system_setting: "audit.entitySystemSetting",
  };
  
  const lowerEntity = entityType?.toLowerCase();
  if (entityMap[lowerEntity]) {
    return t(entityMap[lowerEntity]);
  }
  return entityType || t("audit.entityUnknown");
};

// Helper function to translate actions
const getTranslatedAction = (action: string, t: (key: string) => string): string => {
  const actionMap: Record<string, string> = {
    create: "audit.actionCreate",
    update: "audit.actionUpdate",
    delete: "audit.actionDelete",
    submit: "audit.actionSubmit",
    approve: "audit.actionApprove",
    reject: "audit.actionReject",
    escalate: "audit.actionEscalate",
    review: "audit.actionReview",
    upload: "audit.actionUpload",
    download: "audit.actionDownload",
    login: "audit.actionLogin",
    logout: "audit.actionLogout",
    transition: "audit.actionTransition",
    sync: "audit.actionSync",
    validate: "audit.actionValidate",
    calculate: "audit.actionCalculate",
    export: "audit.actionExport",
    import: "audit.actionImport",
  };
  
  const lowerAction = action?.toLowerCase();
  if (actionMap[lowerAction]) {
    return t(actionMap[lowerAction]);
  }
  return action || t("audit.actionUnknown");
};

// Helper function to get entity icon
const getEntityIcon = (entityType: string): string => {
  const icons: Record<string, string> = {
    claim: "📋",
    user: "👤",
    document: "📄",
    claim_document: "📎",
    claim_documents: "📎",
    payment: "💰",
    disbursement: "💵",
    workflow: "⚙️",
    comment: "💬",
    report: "📊",
    contract: "📑",
    measurement: "📏",
    compliance: "⚖️",
    ledger: "📒",
    journal: "📓",
    transaction: "🔄",
    accounting_entry: "📝",
    csm_calculation: "🧮",
    risk_adjustment: "⚠️",
    ai_validation: "🤖",
    ai_prediction: "🔮",
    audit_log: "🔍",
    compliance_event: "📋",
    user_role: "👥",
    permission: "🔐",
    system_setting: "⚙️",
  };
  return icons[entityType?.toLowerCase()] || "📌";
};

export function AuditPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchAudit() {
      try {
        const r = await api<{ entries: AuditEntry[] }>("/audit?limit=500");
        setEntries(r.entries);
      } catch (error) {
        console.error("Failed to fetch audit trail:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAudit();
  }, []);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('en-HK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateString || "N/A";
    }
  };

  const getActionBadge = (action: string) => {
    const actionMap: Record<string, { bg: string; color: string; icon: string }> = {
      create: { bg: "#e8f5e9", color: "#1b5e20", icon: "➕" },
      update: { bg: "#e3f2fd", color: "#0d47a1", icon: "✏️" },
      delete: { bg: "#ffebee", color: "#c62828", icon: "🗑️" },
      submit: { bg: "#e0f2f1", color: "#004d40", icon: "📤" },
      approve: { bg: "#e8f5e9", color: "#1b5e20", icon: "✓" },
      reject: { bg: "#ffebee", color: "#c62828", icon: "✗" },
      escalate: { bg: "#fff3e0", color: "#e65100", icon: "⚠️" },
      review: { bg: "#f3e5f5", color: "#4a148c", icon: "🔍" },
      upload: { bg: "#e1f5fe", color: "#0277bd", icon: "📎" },
      download: { bg: "#f1f8e9", color: "#33691e", icon: "⬇️" },
      login: { bg: "#e8eaf6", color: "#283593", icon: "🔐" },
      logout: { bg: "#ffebee", color: "#c62828", icon: "🚪" },
      validate: { bg: "#e8eaf6", color: "#283593", icon: "✅" },
      calculate: { bg: "#fff8e1", color: "#f57f17", icon: "🧮" },
      export: { bg: "#e8f5e9", color: "#2e7d32", icon: "📤" },
      import: { bg: "#e3f2fd", color: "#1565c0", icon: "📥" },
    };
    const style = actionMap[action?.toLowerCase()] || { bg: "#f5f5f5", color: "#424242", icon: "📝" };
    const translatedAction = getTranslatedAction(action, t);
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 12px",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: "600",
        background: style.bg,
        color: style.color
      }}>
        {style.icon} {translatedAction}
      </span>
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return "↕️";
    return sortOrder === "asc" ? "↑" : "↓";
  };

  const getFilteredAndSortedEntries = () => {
    let filtered = [...entries];
    
    // Action filter
    if (actionFilter !== "all") {
      filtered = filtered.filter(e => e.action === actionFilter);
    }
    
    // Entity filter
    if (entityFilter !== "all") {
      filtered = filtered.filter(e => e.entity_type === entityFilter);
    }
    
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(e => 
        e.action?.toLowerCase().includes(searchLower) ||
        e.entity_type?.toLowerCase().includes(searchLower) ||
        e.user_email?.toLowerCase().includes(searchLower) ||
        e.entity_id?.toLowerCase().includes(searchLower)
      );
    }
    
    // Date range filter
    if (dateRange.start) {
      filtered = filtered.filter(e => new Date(e.created_at) >= new Date(dateRange.start));
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59);
      filtered = filtered.filter(e => new Date(e.created_at) <= endDate);
    }
    
    // Sorting
    return filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "timestamp":
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        case "action":
          aVal = a.action;
          bVal = b.action;
          break;
        case "entity":
          aVal = a.entity_type;
          bVal = b.entity_type;
          break;
        case "user":
          aVal = a.user_email;
          bVal = b.user_email;
          break;
        default:
          aVal = a.created_at;
          bVal = b.created_at;
      }
      
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  };

  // Get unique actions and entities for filters with translations
  const uniqueActions = Array.from(new Set(entries.map(e => e.action))).sort();
  const uniqueEntities = Array.from(new Set(entries.map(e => e.entity_type))).sort();

  const filteredAndSortedEntries = getFilteredAndSortedEntries();

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
        {t("audit.loading")}
      </div>
    );
  }

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
          {t("audit.title")}
        </h1>
        <p style={{ color: "#5a5a5a", margin: 0, fontSize: "14px" }}>
          {t("audit.subtitle")}
        </p>
      </div>

      {/* Stats Summary - Gradient Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "16px",
        marginBottom: "24px"
      }}>
        <div style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: "10px",
          padding: "20px",
          color: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px" }}>{t("audit.totalEvents")}</div>
          <div style={{ fontSize: "32px", fontWeight: "bold" }}>{entries.length.toLocaleString()}</div>
        </div>
        <div style={{
          background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
          borderRadius: "10px",
          padding: "20px",
          color: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px" }}>{t("audit.uniqueActions")}</div>
          <div style={{ fontSize: "32px", fontWeight: "bold" }}>{uniqueActions.length}</div>
        </div>
        <div style={{
          background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
          borderRadius: "10px",
          padding: "20px",
          color: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px" }}>{t("audit.activeUsers")}</div>
          <div style={{ fontSize: "32px", fontWeight: "bold" }}>
            {new Set(entries.map(e => e.user_email)).size}
          </div>
        </div>
        <div style={{
          background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
          borderRadius: "10px",
          padding: "20px",
          color: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px" }}>{t("audit.entitiesTracked")}</div>
          <div style={{ fontSize: "32px", fontWeight: "bold" }}>
            {new Set(entries.map(e => e.entity_type)).size}
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div style={{
        background: "white",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "24px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
        border: "1px solid #e8e8e8"
      }}>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 2, minWidth: "200px" }}>
            <input
              type="text"
              placeholder={t("audit.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "14px",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#667eea"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#ddd"; }}
            />
          </div>
          <div style={{ minWidth: "150px" }}>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "14px",
                cursor: "pointer",
                background: "white",
                color: "#1a1a1a"
              }}
            >
              <option value="all">{t("audit.allActions")}</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{getTranslatedAction(action, t)}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: "150px" }}>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "14px",
                cursor: "pointer",
                background: "white",
                color: "#1a1a1a"
              }}
            >
              <option value="all">{t("audit.allEntities")}</option>
              {uniqueEntities.map(entity => (
                <option key={entity} value={entity}>{getTranslatedEntityType(entity, t)}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: "130px" }}>
            <input
              type="date"
              placeholder={t("audit.from")}
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "14px"
              }}
            />
          </div>
          <div style={{ minWidth: "130px" }}>
            <input
              type="date"
              placeholder={t("audit.to")}
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "14px"
              }}
            />
          </div>
          {(actionFilter !== "all" || entityFilter !== "all" || searchTerm || dateRange.start || dateRange.end) && (
            <button
              onClick={() => {
                setActionFilter("all");
                setEntityFilter("all");
                setSearchTerm("");
                setDateRange({ start: "", end: "" });
              }}
              style={{
                padding: "8px 20px",
                background: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "13px",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#d32f2f"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#f44336"; }}
            >
              {t("audit.clearAllFilters")}
            </button>
          )}
        </div>
      </div>

      {/* Audit Table */}
      {filteredAndSortedEntries.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "60px",
          background: "white",
          borderRadius: "12px",
          color: "#666",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)"
        }}>
          {t("audit.noEntriesFound")}
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.04)" }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "white",
              borderRadius: "12px",
              overflow: "hidden"
            }}>
              <thead>
                <tr style={{ background: "#1a237e", color: "white" }}>
                  <th 
                    style={{ padding: "14px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "white", cursor: "pointer" }}
                    onClick={() => handleSort("timestamp")}
                  >
                    {t("audit.timestamp")} {getSortIcon("timestamp")}
                  </th>
                  <th 
                    style={{ padding: "14px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "white", cursor: "pointer" }}
                    onClick={() => handleSort("action")}
                  >
                    {t("audit.action")} {getSortIcon("action")}
                  </th>
                  <th 
                    style={{ padding: "14px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "white", cursor: "pointer" }}
                    onClick={() => handleSort("entity")}
                  >
                    {t("audit.entity")} {getSortIcon("entity")}
                  </th>
                  <th style={{ padding: "14px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "white" }}>
                    {t("audit.entityId")}
                  </th>
                  <th 
                    style={{ padding: "14px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "white", cursor: "pointer" }}
                    onClick={() => handleSort("user")}
                  >
                    {t("audit.user")} {getSortIcon("user")}
                  </th>
                  <th style={{ padding: "14px", textAlign: "center", fontWeight: "600", fontSize: "13px", color: "white" }}>
                    {t("audit.details")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedEntries.map((entry, idx) => (
                  <tr 
                    key={entry.id} 
                    style={{ 
                      borderBottom: idx === filteredAndSortedEntries.length - 1 ? "none" : "1px solid #f0f0f0",
                      transition: "background 0.2s",
                      cursor: "pointer",
                      background: idx % 2 === 0 ? "white" : "#fafafa"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f5f5"; }}
                    onMouseLeave={(e) => { 
                      e.currentTarget.style.background = idx % 2 === 0 ? "white" : "#fafafa";
                    }}
                    onClick={() => setSelectedEntry(selectedEntry?.id === entry.id ? null : entry)}
                  >
                    <td style={{ padding: "14px", fontSize: "12px", color: "#424242" }}>
                      {formatDate(entry.created_at)}
                    </td>
                    <td style={{ padding: "14px" }}>
                      {getActionBadge(entry.action)}
                    </td>
                    <td style={{ padding: "14px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "16px" }}>{getEntityIcon(entry.entity_type)}</span>
                        <span style={{ fontWeight: "500", color: "#1a1a1a", fontSize: "13px" }}>
                          {getTranslatedEntityType(entry.entity_type, t)}
                        </span>
                      </span>
                    </td>
                    <td style={{ padding: "14px", fontFamily: "monospace", fontSize: "12px", color: "#666" }}>
                      {entry.entity_id}
                    </td>
                    <td style={{ padding: "14px" }}>
                      <div>
                        <div style={{ fontWeight: "500", color: "#1a1a1a", fontSize: "13px" }}>{entry.user_name || entry.user_email}</div>
                        {entry.user_email && entry.user_name && (
                          <div style={{ fontSize: "11px", color: "#999" }}>{entry.user_email}</div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "14px", textAlign: "center" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEntry(selectedEntry?.id === entry.id ? null : entry);
                        }}
                        style={{
                          padding: "6px 16px",
                          background: selectedEntry?.id === entry.id ? "#4caf50" : "#1976d2",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "500",
                          transition: "background 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          if (selectedEntry?.id !== entry.id) {
                            e.currentTarget.style.background = "#1565c0";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedEntry?.id !== entry.id) {
                            e.currentTarget.style.background = "#1976d2";
                          }
                        }}
                      >
                        {selectedEntry?.id === entry.id ? t("audit.hide") : t("audit.viewDetails")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expanded Details Panel */}
          {selectedEntry && (
            <div style={{
              marginTop: "20px",
              background: "white",
              borderRadius: "12px",
              border: "1px solid #e8e8e8",
              overflow: "hidden",
              animation: "slideUp 0.3s ease-out",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
            }}>
              <div style={{
                background: "#263238",
                color: "white",
                padding: "14px 20px",
                fontWeight: "600",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontSize: "14px" }}>📋 {t("audit.detailedInfo")}</span>
                <button
                  onClick={() => setSelectedEntry(null)}
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "none",
                    color: "white",
                    cursor: "pointer",
                    padding: "4px 10px",
                    borderRadius: "4px",
                    fontSize: "14px",
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.3)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
                >
                  ✕
                </button>
              </div>
              <div style={{ padding: "24px" }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
                  gap: "20px",
                  marginBottom: "20px"
                }}>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: "600", color: "#999", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {t("audit.ipAddress")}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "500", color: "#1a1a1a", fontFamily: "monospace" }}>
                      {selectedEntry.ip_address || t("audit.notRecorded")}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: "600", color: "#999", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {t("audit.userAgent")}
                    </div>
                    <div style={{ fontSize: "12px", color: "#666", wordBreak: "break-all" }}>
                      {selectedEntry.user_agent || t("audit.notRecorded")}
                    </div>
                  </div>
                </div>
                
                {selectedEntry.old_values && Object.keys(selectedEntry.old_values).length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "#c62828", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>⚠️</span> {t("audit.previousValues")}
                    </div>
                    <div style={{
                      background: "#ffebee",
                      padding: "16px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                      border: "1px solid #ffcdd2"
                    }}>
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {JSON.stringify(selectedEntry.old_values, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
                
                {selectedEntry.new_values && Object.keys(selectedEntry.new_values).length > 0 && (
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "#2e7d32", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>✓</span> {t("audit.newValues")}
                    </div>
                    <div style={{
                      background: "#e8f5e9",
                      padding: "16px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                      border: "1px solid #c8e6c9"
                    }}>
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {JSON.stringify(selectedEntry.new_values, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Stats */}
          <div style={{
            marginTop: "20px",
            padding: "14px 20px",
            background: "white",
            borderRadius: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            border: "1px solid #e8e8e8"
          }}>
            <div style={{ fontSize: "13px", color: "#666" }}>
              {t("audit.showing")} <strong>{filteredAndSortedEntries.length}</strong> {t("audit.of")} <strong>{entries.length}</strong> {t("audit.auditEvents")}
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => window.print()}
                style={{
                  padding: "6px 14px",
                  background: "#f5f5f5",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "#666",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#eee"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#f5f5f5"; }}
              >
                🖨️ {t("audit.printReport")}
              </button>
              <button
                onClick={() => {
                  const csv = filteredAndSortedEntries.map(e => 
                    `${e.created_at},${e.action},${e.entity_type},${e.entity_id},${e.user_email}`
                  ).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `audit_report_${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{
                  padding: "6px 14px",
                  background: "#4caf50",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#43a047"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#4caf50"; }}
              >
                📥 {t("audit.exportCsv")}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Compliance Footer */}
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
        <span>🔒 {t("audit.compliantWith")} </span>
        <strong>{t("audit.hkicpa")}</strong>, <strong>{t("audit.ifrs")}</strong>, {t("audit.and")} <strong>{t("audit.baselIii")}</strong> {t("audit.standards")} | 
        <span> 📅 {t("audit.retentionPeriod")}: 7 {t("audit.years")} | </span>
        <span> 🔐 {t("audit.immutableRecord")}</span>
      </div>

      {/* Add animation styles */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}