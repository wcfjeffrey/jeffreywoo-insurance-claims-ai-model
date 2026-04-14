import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";

interface ForecastData {
  period: string;
  projected_balance: number;
  confidence_lower: number;
  confidence_upper: number;
  cash_inflow: number;
  cash_outflow: number;
}

interface DisbursementData {
  id: string;
  reference_number: string;
  currency: string;
  net_amount: number;
  status: string;
  payee: string;
  due_date: string;
  approval_status: string;
  bank_account?: string;
  payment_method?: string;
}

interface ROI {
  total_claims: number;
  total_disbursed: number;
  pending_approval: number;
  avg_processing_days: number;
  projected_savings: number;
  exposure_amount: number;
  risk_adjusted_return?: number;
  capital_reserve_requirement?: number;
}

// Helper function to map disbursement status to translation key
const getDisbursementStatusKey = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: "accounting.pending",
    completed: "accounting.completed",
    failed: "accounting.failed",
    processing: "accounting.processing",
  };
  return statusMap[status?.toLowerCase()] || "accounting.pending";
};

// Helper function to map approval status to translation key
const getApprovalStatusKey = (approvalStatus: string): string => {
  const statusMap: Record<string, string> = {
    pending: "accounting.pending",
    approved: "accounting.approved",
    rejected: "accounting.rejected",
    under_review: "accounting.underReview",
  };
  return statusMap[approvalStatus?.toLowerCase()] || "accounting.pending";
};

// Helper function to translate payee/status field
const getTranslatedPayee = (payee: string, t: (key: string) => string): string => {
  if (!payee) return "—";
  
  const payeeMap: Record<string, string> = {
    pending: t("accounting.pending"),
    completed: t("accounting.completed"),
    failed: t("accounting.failed"),
    processing: t("accounting.processing"),
    approved: t("accounting.approved"),
    rejected: t("accounting.rejected"),
    under_review: t("accounting.underReview"),
  };
  
  const lowerPayee = payee.toLowerCase();
  if (payeeMap[lowerPayee]) {
    return payeeMap[lowerPayee];
  }
  
  // If it's not a status keyword, return the original value
  return payee;
};

export function AccountingPage() {
  const { t } = useTranslation();
  const [forecast, setForecast] = useState<ForecastData[] | null>(null);
  const [disb, setDisb] = useState<DisbursementData[]>([]);
  const [roi, setRoi] = useState<ROI | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");
  const [loading, setLoading] = useState({
    forecast: true,
    disbursements: true,
    roi: true,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading({ forecast: true, disbursements: true, roi: true });
        
        const forecastData = await api<ForecastData[]>("/accounting/forecast");
        setForecast(forecastData);
        setLoading(prev => ({ ...prev, forecast: false }));
        
        const disbData = await api<{ disbursements: DisbursementData[] }>(
          "/accounting/disbursements",
        );
        setDisb(disbData.disbursements);
        setLoading(prev => ({ ...prev, disbursements: false }));
        
        const roiData = await api<ROI>("/accounting/summary");
        setRoi(roiData);
        setLoading(prev => ({ ...prev, roi: false }));
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setMsgType("error");
        setMsg(t("accounting.fetchError"));
        setLoading({ forecast: false, disbursements: false, roi: false });
      }
    }
    
    fetchData();
  }, [t]);

  const formatCurrency = (amount: number, currency: string = "HKD") => {
    return new Intl.NumberFormat('en-HK', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-HK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string, type: "disbursement" | "approval" = "disbursement") => {
    if (type === "approval") {
      const styles: Record<string, { bg: string; color: string; icon: string }> = {
        approved: { bg: "#e8f5e9", color: "#1b5e20", icon: "✓" },
        pending: { bg: "#fff3e0", color: "#e65100", icon: "⏳" },
        rejected: { bg: "#ffebee", color: "#c62828", icon: "✗" },
        under_review: { bg: "#e3f2fd", color: "#0d47a1", icon: "🔍" },
      };
      const style = styles[status?.toLowerCase()] || styles.pending;
      const translationKey = getApprovalStatusKey(status);
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
          {style.icon} {t(translationKey)}
        </span>
      );
    }
    
    const styles: Record<string, { bg: string; color: string; icon: string }> = {
      completed: { bg: "#e8f5e9", color: "#1b5e20", icon: "✓" },
      pending: { bg: "#fff3e0", color: "#e65100", icon: "⏳" },
      failed: { bg: "#ffebee", color: "#c62828", icon: "✗" },
      processing: { bg: "#e3f2fd", color: "#0d47a1", icon: "⟳" },
    };
    const style = styles[status?.toLowerCase()] || styles.pending;
    const translationKey = getDisbursementStatusKey(status);
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
        {style.icon} {t(translationKey)}
      </span>
    );
  };

  if (loading.roi && loading.forecast && loading.disbursements) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
        {t("accounting.loadingFinancialData")}
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
          {t("accounting.title")}
        </h1>
        <p style={{ color: "#5a5a5a", margin: 0, fontSize: "14px" }}>
          {t("accounting.subtitle")}
        </p>
      </div>
      
      {/* Notification Banner */}
      {msg && (
        <div style={{ 
          background: msgType === "success" ? "#e8f5e9" : msgType === "error" ? "#ffebee" : "#e3f2fd",
          borderLeft: `4px solid ${msgType === "success" ? "#4caf50" : msgType === "error" ? "#f44336" : "#2196f3"}`,
          padding: "14px 20px",
          marginBottom: "24px",
          borderRadius: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
        }}>
          <span style={{ 
            color: msgType === "success" ? "#2e7d32" : msgType === "error" ? "#c62828" : "#0d47a1",
            fontSize: "14px",
            fontWeight: "500"
          }}>
            {msgType === "success" ? "✓" : msgType === "error" ? "⚠" : "ℹ"} {msg}
          </span>
          <button 
            onClick={() => setMsg(null)}
            style={{ 
              background: "none", 
              border: "none", 
              cursor: "pointer",
              fontSize: "18px",
              color: "#666"
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ROI / Exposure Summary Cards */}
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ 
          fontSize: "18px", 
          fontWeight: "600", 
          color: "#1a1a1a",
          marginBottom: "16px",
          letterSpacing: "-0.3px"
        }}>
          {t("accounting.financialSummary")}
        </h2>
        {loading.roi ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>{t("accounting.loadingFinancialData")}</div>
        ) : roi ? (
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
            gap: "20px"
          }}>
            {/* Total Claims Value */}
            <div style={{ 
              padding: "24px", 
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "12px",
              color: "white",
              boxShadow: "0 4px 15px rgba(102, 126, 234, 0.3)",
              transition: "transform 0.2s, box-shadow 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(102, 126, 234, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.3)";
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ fontSize: "14px", opacity: 0.9, fontWeight: "500" }}>{t("accounting.totalClaimsValue")}</div>
                <div style={{ fontSize: "28px" }}>📋</div>
              </div>
              <div style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "8px" }}>
                {formatCurrency(roi.total_claims || 0)}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>
                {t("accounting.totalClaimsProcessed")}
              </div>
            </div>
            
            {/* Total Disbursed */}
            <div style={{ 
              padding: "24px", 
              background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
              borderRadius: "12px",
              color: "white",
              boxShadow: "0 4px 15px rgba(67, 233, 123, 0.3)",
              transition: "transform 0.2s, box-shadow 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(67, 233, 123, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 15px rgba(67, 233, 123, 0.3)";
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ fontSize: "14px", opacity: 0.9, fontWeight: "500" }}>{t("accounting.totalDisbursed")}</div>
                <div style={{ fontSize: "28px" }}>💰</div>
              </div>
              <div style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "8px" }}>
                {formatCurrency(roi.total_disbursed || 0)}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>
                {t("accounting.totalPaymentsReleased")}
              </div>
            </div>
            
            {/* Pending Approval */}
            <div style={{ 
              padding: "24px", 
              background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
              borderRadius: "12px",
              color: "white",
              boxShadow: "0 4px 15px rgba(250, 112, 154, 0.3)",
              transition: "transform 0.2s, box-shadow 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(250, 112, 154, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 15px rgba(250, 112, 154, 0.3)";
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ fontSize: "14px", opacity: 0.9, fontWeight: "500" }}>{t("accounting.pendingApproval")}</div>
                <div style={{ fontSize: "28px" }}>⏳</div>
              </div>
              <div style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "8px" }}>
                {formatCurrency(roi.pending_approval || 0)}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>
                {t("accounting.awaitingAuthorization")}
              </div>
            </div>
            
            {/* Projected Savings */}
            <div style={{ 
              padding: "24px", 
              background: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
              borderRadius: "12px",
              color: "#1a1a1a",
              boxShadow: "0 4px 15px rgba(168, 237, 234, 0.3)",
              transition: "transform 0.2s, box-shadow 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(168, 237, 234, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 15px rgba(168, 237, 234, 0.3)";
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ fontSize: "14px", opacity: 0.8, fontWeight: "500" }}>{t("accounting.projectedSavings")}</div>
                <div style={{ fontSize: "28px" }}>💡</div>
              </div>
              <div style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "8px", color: "#5e35b1" }}>
                {formatCurrency(roi.projected_savings || 0)}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.7, color: "#1a1a1a" }}>
                {t("accounting.aiOptimizedProjections")}
              </div>
            </div>
            
            {/* Exposure Amount */}
            <div style={{ 
              padding: "24px", 
              background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
              borderRadius: "12px",
              color: "white",
              boxShadow: "0 4px 15px rgba(240, 147, 251, 0.3)",
              transition: "transform 0.2s, box-shadow 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(240, 147, 251, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 15px rgba(240, 147, 251, 0.3)";
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ fontSize: "14px", opacity: 0.9, fontWeight: "500" }}>{t("accounting.exposureAmount")}</div>
                <div style={{ fontSize: "28px" }}>⚠️</div>
              </div>
              <div style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "8px" }}>
                {formatCurrency(roi.exposure_amount || 0)}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>
                {t("accounting.currentFinancialExposure")}
              </div>
            </div>
            
            {/* Average Processing Days */}
            <div style={{ 
              padding: "24px", 
              background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
              borderRadius: "12px",
              color: "white",
              boxShadow: "0 4px 15px rgba(79, 172, 254, 0.3)",
              transition: "transform 0.2s, box-shadow 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(79, 172, 254, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 15px rgba(79, 172, 254, 0.3)";
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ fontSize: "14px", opacity: 0.9, fontWeight: "500" }}>{t("accounting.averageProcessingDays")}</div>
                <div style={{ fontSize: "28px" }}>📅</div>
              </div>
              <div style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "8px" }}>
                {roi.avg_processing_days?.toFixed(1) || 0}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>
                {t("accounting.claimToPaymentCycle")}
              </div>
            </div>

            {/* Risk-Adjusted Return */}
            {roi.risk_adjusted_return && (
              <div style={{ 
                padding: "24px", 
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: "12px",
                color: "white",
                boxShadow: "0 4px 15px rgba(102, 126, 234, 0.3)",
                transition: "transform 0.2s, box-shadow 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 8px 25px rgba(102, 126, 234, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.3)";
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ fontSize: "14px", opacity: 0.9, fontWeight: "500" }}>{t("accounting.riskAdjustedReturn")}</div>
                  <div style={{ fontSize: "28px" }}>📈</div>
                </div>
                <div style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "8px" }}>
                  {roi.risk_adjusted_return.toFixed(1)}%
                </div>
                <div style={{ fontSize: "12px", opacity: 0.8 }}>
                  {t("accounting.rarocCalculation")}
                </div>
              </div>
            )}

            {/* Capital Reserve Requirement */}
            {roi.capital_reserve_requirement && (
              <div style={{ 
                padding: "24px", 
                background: "linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)",
                borderRadius: "12px",
                color: "white",
                boxShadow: "0 4px 15px rgba(252, 203, 144, 0.3)",
                transition: "transform 0.2s, box-shadow 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 8px 25px rgba(252, 203, 144, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 15px rgba(252, 203, 144, 0.3)";
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ fontSize: "14px", opacity: 0.9, fontWeight: "500" }}>{t("accounting.capitalReserveRequirement")}</div>
                  <div style={{ fontSize: "28px" }}>🏦</div>
                </div>
                <div style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "8px" }}>
                  {formatCurrency(roi.capital_reserve_requirement)}
                </div>
                <div style={{ fontSize: "12px", opacity: 0.8 }}>
                  {t("accounting.baselIiiCompliant")}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Cash Flow Forecast Table */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1a1a1a", margin: 0 }}>
            {t("accounting.cashFlowForecast")}
          </h2>
          <button
            type="button"
            onClick={async () => {
              try {
                await api("/accounting/sync-ledger", {
                  method: "POST",
                  body: JSON.stringify({ provider: "sap" }),
                });
                setMsgType("success");
                setMsg(t("accounting.syncSuccess"));
                const freshForecast = await api<ForecastData[]>("/accounting/forecast");
                setForecast(freshForecast);
                setTimeout(() => setMsg(null), 5000);
              } catch (error) {
                setMsgType("error");
                setMsg(t("accounting.syncError"));
                setTimeout(() => setMsg(null), 5000);
              }
            }}
            style={{
              padding: "8px 20px",
              background: "#1976d2",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "500",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#1565c0"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#1976d2"; }}
          >
            {t("accounting.syncLedger")}
          </button>
        </div>
        
        {loading.forecast ? (
          <div style={{ textAlign: "center", padding: "40px", background: "white", borderRadius: "8px" }}>
            {t("accounting.loadingForecast")}
          </div>
        ) : forecast && forecast.length > 0 ? (
          <div style={{ overflowX: "auto", background: "white", borderRadius: "8px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <table style={{ 
              width: "100%", 
              borderCollapse: "collapse"
            }}>
              <thead>
                <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e8e8e8" }}>
                  <th style={{ padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("accounting.period")}</th>
                  <th style={{ padding: "16px", textAlign: "right", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("accounting.cashInflow")}</th>
                  <th style={{ padding: "16px", textAlign: "right", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("accounting.cashOutflow")}</th>
                  <th style={{ padding: "16px", textAlign: "right", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("accounting.netCashFlow")}</th>
                  <th style={{ padding: "16px", textAlign: "right", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("accounting.projectedBalance")}</th>
                  <th style={{ padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("accounting.confidenceInterval")}</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((item, idx) => {
                  const netCashFlow = item.cash_inflow - item.cash_outflow;
                  return (
                    <tr key={idx} style={{ borderBottom: idx === forecast.length - 1 ? "none" : "1px solid #f0f0f0" }}>
                      <td style={{ padding: "16px", fontWeight: "500", color: "#1a1a1a" }}>{item.period}</td>
                      <td style={{ padding: "16px", textAlign: "right", color: "#2e7d32", fontWeight: "500" }}>
                        {formatCurrency(item.cash_inflow)}
                      </td>
                      <td style={{ padding: "16px", textAlign: "right", color: "#c62828", fontWeight: "500" }}>
                        {formatCurrency(item.cash_outflow)}
                      </td>
                      <td style={{ 
                        padding: "16px", 
                        textAlign: "right", 
                        fontWeight: "600",
                        color: netCashFlow >= 0 ? "#2e7d32" : "#c62828"
                      }}>
                        {formatCurrency(netCashFlow)}
                      </td>
                      <td style={{ padding: "16px", textAlign: "right", fontWeight: "600", color: "#1976d2" }}>
                        {formatCurrency(item.projected_balance)}
                      </td>
                      <td style={{ padding: "16px", fontSize: "12px", color: "#666" }}>
                        {formatCurrency(item.confidence_lower)} – {formatCurrency(item.confidence_upper)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "40px", background: "white", borderRadius: "8px", color: "#666" }}>
            {t("accounting.noForecastData")}
          </div>
        )}
      </div>

      {/* Disbursements Table */}
      <div>
        <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1a1a1a", marginBottom: "16px" }}>
          {t("accounting.disbursementsPayments")}
        </h2>
        {loading.disbursements ? (
          <div style={{ textAlign: "center", padding: "40px", background: "white", borderRadius: "8px" }}>
            {t("accounting.loadingDisbursements")}
          </div>
        ) : disb.length > 0 ? (
          <div style={{ overflowX: "auto", background: "white", borderRadius: "8px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <table style={{ 
              width: "100%", 
              borderCollapse: "collapse"
            }}>
              <thead>
                <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e8e8e8" }}>
                  <th style={{ padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("accounting.reference")}</th>
                  <th style={{ padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("accounting.payee")}</th>
                  <th style={{ padding: "16px", textAlign: "right", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("accounting.netAmount")}</th>
                  <th style={{ padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("accounting.dueDate")}</th>
                  <th style={{ padding: "16px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("accounting.status")}</th>
                  <th style={{ padding: "16px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("accounting.approval")}</th>
                  <th style={{ padding: "16px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("accounting.hkmaAction")}</th>
                </tr>
              </thead>
              <tbody>
                {disb.map((d, idx) => {
                  // Translate the payee field if it contains a status keyword
                  const translatedPayee = getTranslatedPayee(d.payee, t);
                  return (
                    <tr key={String(d.id)} style={{ borderBottom: idx === disb.length - 1 ? "none" : "1px solid #f0f0f0" }}>
                      <td style={{ padding: "16px", fontWeight: "500", color: "#1a1a1a", fontFamily: "monospace", fontSize: "13px" }}>
                        {String(d.reference_number)}
                      </td>
                      <td style={{ padding: "16px", color: "#424242" }}>
                        {translatedPayee}
                      </td>
                      <td style={{ padding: "16px", textAlign: "right", fontWeight: "600", color: "#1a1a1a" }}>
                        {formatCurrency(d.net_amount, d.currency)}
                      </td>
                      <td style={{ padding: "16px", fontSize: "13px", color: "#666" }}>
                        {d.due_date ? formatDate(d.due_date) : "—"}
                      </td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        {getStatusBadge(d.status, "disbursement")}
                      </td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        {getStatusBadge(d.approval_status || "pending", "approval")}
                      </td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await api(`/hkma/payments/${String(d.id)}`, {
                                method: "POST",
                                body: "{}",
                              });
                              setMsgType("success");
                              setMsg(t("accounting.hkmaSubmitSuccess", { reference: d.reference_number }));
                              setTimeout(() => setMsg(null), 5000);
                            } catch (error) {
                              setMsgType("error");
                              setMsg(t("accounting.hkmaSubmitError", { reference: d.reference_number }));
                              setTimeout(() => setMsg(null), 5000);
                            }
                          }}
                          style={{
                            padding: "6px 16px",
                            background: "#4caf50",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "500",
                            transition: "background 0.2s"
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#45a049"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "#4caf50"; }}
                        >
                          {t("accounting.submitToHkma")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "40px", background: "white", borderRadius: "8px", color: "#666" }}>
            {t("accounting.noDisbursements")}
          </div>
        )}
      </div>

      {/* Footer Note */}
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
        <span>📊 {t("accounting.dataUpdatedRealTime")} | </span>
        <span>🔒 {t("accounting.compliantWith")} HKICPA, IFRS 17, Basel III | </span>
        <span>🕒 {t("accounting.lastSync")}: {new Date().toLocaleString('en-HK')}</span>
      </div>
    </div>
  );
}