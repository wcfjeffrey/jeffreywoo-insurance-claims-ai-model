import { getToken } from "../api";
import { useState } from "react";
import { useTranslation } from "react-i18next";

async function download(path: string, filename: string): Promise<boolean> {
  const token = getToken();
  try {
    const res = await fetch(`/api/reports${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error("You don't have permission to download this report. Please contact your administrator.");
      } else if (res.status === 401) {
        throw new Error("Your session has expired. Please log in again.");
      } else if (res.status === 404) {
        throw new Error("Report not found. The report may be under development.");
      } else {
        const errorText = await res.text();
        throw new Error(errorText || "Download failed. Please try again later.");
      }
    }
    
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  } catch (err) {
    throw err;
  }
}

interface Report {
  id: string;
  nameKey: string;
  descKey: string;
  icon: string;
  color: string;
  path: string;
  filename: string;
  type: string;
  badgeColor: string;
  categoryKey: string;
}

export function ReportsPage() {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDownload = async (path: string, filename: string, reportName: string) => {
    setDownloading(reportName);
    setError(null);
    setSuccess(null);
    try {
      await download(path, filename);
      setSuccess(t("reports.downloadSuccess"));
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      let errorMessage = t("reports.downloadFailed");
      const errMsg = err instanceof Error ? err.message : "";
      
      if (errMsg.includes("permission") || errMsg.includes("403")) {
        errorMessage = t("reports.noPermission");
      } else if (errMsg.includes("expired") || errMsg.includes("401")) {
        errorMessage = t("reports.sessionExpired");
      } else if (errMsg.includes("not found") || errMsg.includes("404")) {
        errorMessage = t("reports.reportNotFound");
      }
      
      setError(errorMessage);
      setTimeout(() => setError(null), 8000);
    } finally {
      setDownloading(null);
    }
  };

  // Define reports with translation keys
  const reports: Report[] = [
    {
      id: "claims",
      nameKey: "reports.claimsRegister",
      descKey: "reports.claimsRegisterDesc",
      icon: "📋",
      color: "#1976d2",
      path: "/claims.xlsx",
      filename: "claims_register.xlsx",
      type: "Excel",
      badgeColor: "#4caf50",
      categoryKey: "reports.operationalReports",
    },
    {
      id: "summary",
      nameKey: "reports.executiveDashboard",
      descKey: "reports.executiveDashboardDesc",
      icon: "📊",
      color: "#ff9800",
      path: "/summary.pdf",
      filename: "executive_summary.pdf",
      type: "PDF",
      badgeColor: "#f44336",
      categoryKey: "reports.executiveReports",
    },
    {
      id: "audit",
      nameKey: "reports.auditTrailReport",
      descKey: "reports.auditTrailReportDesc",
      icon: "🔍",
      color: "#9c27b0",
      path: "/audit.xlsx",
      filename: "audit_trail.xlsx",
      type: "Excel",
      badgeColor: "#4caf50",
      categoryKey: "reports.complianceReports",
    },
    {
      id: "financial",
      nameKey: "reports.financialDisbursement",
      descKey: "reports.financialDisbursementDesc",
      icon: "💰",
      color: "#2e7d32",
      path: "/financial.pdf",
      filename: "financial_summary.pdf",
      type: "PDF",
      badgeColor: "#f44336",
      categoryKey: "reports.financialReports",
    },
    {
      id: "compliance",
      nameKey: "reports.regulatoryCompliance",
      descKey: "reports.regulatoryComplianceDesc",
      icon: "⚖️",
      color: "#607d8b",
      path: "/compliance.xlsx",
      filename: "compliance_report.xlsx",
      type: "Excel",
      badgeColor: "#4caf50",
      categoryKey: "reports.complianceReports",
    },
    {
      id: "risk",
      nameKey: "reports.riskAssessment",
      descKey: "reports.riskAssessmentDesc",
      icon: "⚠️",
      color: "#d32f2f",
      path: "/risk.pdf",
      filename: "risk_assessment.pdf",
      type: "PDF",
      badgeColor: "#f44336",
      categoryKey: "reports.riskReports",
    },
    {
      id: "accounting",
      nameKey: "reports.generalLedger",
      descKey: "reports.generalLedgerDesc",
      icon: "📒",
      color: "#5c6bc0",
      path: "/ledger.xlsx",
      filename: "general_ledger.xlsx",
      type: "Excel",
      badgeColor: "#4caf50",
      categoryKey: "reports.financialReports",
    },
    {
      id: "regulatory",
      nameKey: "reports.regulatoryFiling",
      descKey: "reports.regulatoryFilingDesc",
      icon: "📑",
      color: "#455a64",
      path: "/regulatory.pdf",
      filename: "regulatory_filing.pdf",
      type: "PDF",
      badgeColor: "#f44336",
      categoryKey: "reports.complianceReports",
    }
  ];

  // Group reports by category - filter out undefined categories
  const categoryMap = new Map<string, Report[]>();
  reports.forEach(report => {
    const category = report.categoryKey;
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(report);
  });

  const getCategoryIcon = (categoryKey: string): string => {
    if (categoryKey === "reports.executiveReports") return "👔";
    if (categoryKey === "reports.complianceReports") return "⚖️";
    if (categoryKey === "reports.financialReports") return "💰";
    if (categoryKey === "reports.riskReports") return "⚠️";
    if (categoryKey === "reports.operationalReports") return "📋";
    return "📋";
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
          {t("reports.title")}
        </h1>
        <p style={{ color: "#5a5a5a", margin: 0, fontSize: "14px" }}>
          {t("reports.subtitle")}
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div style={{
          background: "#e8f5e9",
          borderLeft: "4px solid #4caf50",
          padding: "14px 20px",
          marginBottom: "24px",
          borderRadius: "8px",
          color: "#2e7d32",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>✅</span> {success}
          </span>
          <button 
            onClick={() => setSuccess(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#2e7d32" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Message */}
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
          alignItems: "center",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>⚠️</span> {error}
          </span>
          <button 
            onClick={() => setError(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#c62828" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Quick Stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "16px",
        marginBottom: "32px"
      }}>
        <div style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: "12px",
          padding: "20px",
          color: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>📋</div>
          <div style={{ fontSize: "28px", fontWeight: "bold" }}>{reports.length}</div>
          <div style={{ fontSize: "12px", opacity: 0.9, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {t("reports.availableReports")}
          </div>
        </div>
        <div style={{
          background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
          borderRadius: "12px",
          padding: "20px",
          color: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>📊</div>
          <div style={{ fontSize: "28px", fontWeight: "bold" }}>{t("reports.excelPdf")}</div>
          <div style={{ fontSize: "12px", opacity: 0.9, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {t("reports.exportFormats")}
          </div>
        </div>
        <div style={{
          background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
          borderRadius: "12px",
          padding: "20px",
          color: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>🔒</div>
          <div style={{ fontSize: "28px", fontWeight: "bold" }}>{t("reports.aes256")}</div>
          <div style={{ fontSize: "12px", opacity: 0.9, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {t("reports.encryptionStandard")}
          </div>
        </div>
        <div style={{
          background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
          borderRadius: "12px",
          padding: "20px",
          color: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>🕒</div>
          <div style={{ fontSize: "28px", fontWeight: "bold" }}>{t("reports.realTime")}</div>
          <div style={{ fontSize: "12px", opacity: 0.9, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {t("reports.dataFreshness")}
          </div>
        </div>
      </div>

      {/* Reports by Category */}
      {Array.from(categoryMap.entries()).map(([categoryKey, categoryReports]) => (
        <div key={categoryKey} style={{ marginBottom: "32px" }}>
          <h2 style={{ 
            fontSize: "18px", 
            fontWeight: "600", 
            color: "#1a1a1a",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span>{getCategoryIcon(categoryKey)}</span>
            {t(categoryKey)} {t("reports.reports")}
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: "20px"
          }}>
            {categoryReports.map((report) => {
              const reportName = t(report.nameKey);
              return (
                <div
                  key={report.id}
                  style={{
                    background: "white",
                    borderRadius: "12px",
                    padding: "24px",
                    border: "1px solid #e8e8e8",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    cursor: "pointer"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.04)";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "16px" }}>
                    <div style={{
                      fontSize: "40px",
                      background: `linear-gradient(135deg, ${report.color}15 0%, ${report.color}30 100%)`,
                      width: "56px",
                      height: "56px",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      {report.icon}
                    </div>
                    <span style={{
                      padding: "4px 12px",
                      borderRadius: "20px",
                      fontSize: "11px",
                      fontWeight: "600",
                      background: report.badgeColor === "#4caf50" ? "#e8f5e9" : "#ffebee",
                      color: report.badgeColor
                    }}>
                      {report.type}
                    </span>
                  </div>
                  
                  <h3 style={{
                    margin: 0,
                    marginBottom: "8px",
                    fontSize: "17px",
                    fontWeight: "600",
                    color: "#1a1a1a"
                  }}>
                    {reportName}
                  </h3>
                  
                  <p style={{
                    margin: 0,
                    marginBottom: "20px",
                    fontSize: "13px",
                    color: "#666",
                    lineHeight: "1.5"
                  }}>
                    {t(report.descKey)}
                  </p>
                  
                  <button
                    type="button"
                    onClick={() => handleDownload(report.path, report.filename, reportName)}
                    disabled={downloading === reportName}
                    style={{
                      width: "100%",
                      padding: "10px 20px",
                      background: downloading === reportName ? "#ccc" : report.color,
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: downloading === reportName ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      transition: "background 0.2s, transform 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      if (downloading !== reportName) {
                        e.currentTarget.style.background = report.color + "dd";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (downloading !== reportName) {
                        e.currentTarget.style.background = report.color;
                        e.currentTarget.style.transform = "translateY(0)";
                      }
                    }}
                  >
                    {downloading === reportName ? (
                      <>
                        <span className="spinner"></span> {t("reports.generating")}
                      </>
                    ) : (
                      <>
                        <span>⬇️</span> {t("reports.download")} {report.type}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Note about permissions */}
      <div style={{
        marginTop: "16px",
        padding: "12px 16px",
        background: "#e3f2fd",
        borderRadius: "8px",
        border: "1px solid #bbdefb",
        fontSize: "12px",
        color: "#0d47a1",
        textAlign: "center"
      }}>
        💡 <strong>{t("reports.note")}:</strong> {t("reports.permissionNote")}
      </div>

      {/* Compliance & Security Information */}
      <div style={{
        marginTop: "24px",
        background: "white",
        borderRadius: "12px",
        padding: "24px",
        border: "1px solid #e8e8e8",
        boxShadow: "0 2px 4px rgba(0,0,0,0.04)"
      }}>
        <h3 style={{
          margin: 0,
          marginBottom: "20px",
          fontSize: "16px",
          fontWeight: "600",
          color: "#1a1a1a",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <span>🔒</span> {t("reports.securityCompliance")}
        </h3>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px"
        }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("reports.dataProtection")}
            </div>
            <div style={{ fontSize: "13px", color: "#1a1a1a" }}>
              {t("reports.encryptedInfo")}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("reports.accessControl")}
            </div>
            <div style={{ fontSize: "13px", color: "#1a1a1a" }}>
              {t("reports.rbacInfo")}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("reports.auditTrail")}
            </div>
            <div style={{ fontSize: "13px", color: "#1a1a1a" }}>
              {t("reports.auditLogInfo")}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("reports.retentionPolicy")}
            </div>
            <div style={{ fontSize: "13px", color: "#1a1a1a" }}>
              {t("reports.retentionInfo")}
            </div>
          </div>
        </div>
      </div>

      {/* Support & Contact */}
      <div style={{
        marginTop: "20px",
        padding: "16px 20px",
        background: "#f8f9fa",
        borderRadius: "8px",
        border: "1px solid #e8e8e8",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <div style={{ fontSize: "12px", color: "#666", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>📧</span> {t("reports.customReport")}
        </div>
        <div style={{ fontSize: "11px", color: "#999" }}>
          {t("reports.lastUpdated")}: {new Date().toLocaleString('en-HK')}
        </div>
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 0.8s linear infinite;
        }
      `}</style>
    </div>
  );
}