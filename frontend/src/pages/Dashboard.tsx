import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { io, type Socket } from "socket.io-client";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

type Summary = {
  claimStatusCounts: Record<string, number>;
  recentClaims: {
    id: string;
    reference_number: string;
    status: string;
    claimed_amount: string;
    currency: string;
    updated_at: string;
  }[];
  myOpenClaims?: number;
};

type SortField = "reference" | "status" | "amount" | "date";
type SortOrder = "asc" | "desc";

// Helper function to map status to translation key
const getStatusTranslationKey = (status: string): string => {
  const statusMap: Record<string, string> = {
    draft: "claims.draft",
    submitted: "claims.submitted",
    under_review: "claims.underReview",
    escalated: "claims.escalated",
    approved: "claims.approved",
    rejected: "claims.rejected",
    payment_pending: "claims.paymentPending",
    paid: "claims.paid",
  };
  return statusMap[status?.toLowerCase()] || status;
};

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [live, setLive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    async function fetchData() {
      try {
        const summary = await api<Summary>("/dashboard/summary");
        setData(summary);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    const socket: Socket = io({
      transports: ["websocket"],
    });
    socket.on("claim:update", (p: { claimId?: string }) => {
      setLive(t("dashboard.claimUpdated", { claimId: p.claimId ?? "?" }));
      void api<Summary>("/dashboard/summary").then(setData);
      setTimeout(() => setLive(null), 5000);
    });
    return () => {
      socket.disconnect();
    };
  }, [t]);

  const formatCurrency = (amount: string, currency: string) => {
    return new Intl.NumberFormat('en-HK', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(amount) || 0);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('en-HK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString || "N/A";
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; color: string; icon: string }> = {
      draft: { bg: "#e3f2fd", color: "#0d47a1", icon: "📝" },
      submitted: { bg: "#e0f2f1", color: "#004d40", icon: "📤" },
      under_review: { bg: "#fff3e0", color: "#e65100", icon: "🔍" },
      escalated: { bg: "#f3e5f5", color: "#4a148c", icon: "⚠️" },
      approved: { bg: "#e8f5e9", color: "#1b5e20", icon: "✓" },
      rejected: { bg: "#ffebee", color: "#c62828", icon: "✗" },
      payment_pending: { bg: "#fff9c4", color: "#f57f17", icon: "💰" },
      paid: { bg: "#e8f5e9", color: "#1b5e20", icon: "💵" },
    };
    const style = statusMap[status?.toLowerCase()] || { bg: "#f5f5f5", color: "#424242", icon: "📄" };
    const translationKey = getStatusTranslationKey(status);
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 12px",
        borderRadius: "16px",
        fontSize: "12px",
        fontWeight: "600",
        background: style.bg,
        color: style.color
      }}>
        {style.icon} {t(translationKey)}
      </span>
    );
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "#0d47a1",
      submitted: "#004d40",
      under_review: "#e65100",
      escalated: "#4a148c",
      approved: "#1b5e20",
      rejected: "#c62828",
      payment_pending: "#f57f17",
      paid: "#1b5e20",
    };
    return colors[status?.toLowerCase()] || "#424242";
  };

  const getStatusDisplayName = (status: string): string => {
    const translationKey = getStatusTranslationKey(status);
    return t(translationKey);
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

  const getSortedClaims = () => {
    if (!data?.recentClaims) return [];
    
    return [...data.recentClaims].sort((a, b) => {
      let aVal: any;
      let bVal: any;
      
      switch (sortField) {
        case "reference":
          aVal = a.reference_number;
          bVal = b.reference_number;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "amount":
          aVal = parseFloat(a.claimed_amount);
          bVal = parseFloat(b.claimed_amount);
          break;
        case "date":
          aVal = new Date(a.updated_at).getTime();
          bVal = new Date(b.updated_at).getTime();
          break;
        default:
          aVal = a.updated_at;
          bVal = b.updated_at;
      }
      
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  };

  // Calculate totals
  const totalClaims = data?.claimStatusCounts 
    ? Object.values(data.claimStatusCounts).reduce((a, b) => a + b, 0)
    : 0;

  // Calculate approval rate
  const approvedCount = data?.claimStatusCounts?.["approved"] || 0;
  const approvalRate = totalClaims > 0 ? (approvedCount / totalClaims * 100).toFixed(1) : 0;

  const sortedClaims = getSortedClaims();

  if (loading) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "400px",
        color: "#666"
      }}>
        <div>{t("dashboard.loading")}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ 
        textAlign: "center", 
        padding: "60px", 
        color: "#666", 
        background: "white", 
        borderRadius: "12px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.04)"
      }}>
        {t("dashboard.noData")}
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
      {/* Welcome Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ 
          fontSize: "28px", 
          fontWeight: "600", 
          color: "#1a1a1a",
          margin: 0,
          marginBottom: "8px",
          letterSpacing: "-0.5px"
        }}>
          {t("dashboard.welcome")}
          {user ? `, ${user.fullName}` : ""}
        </h1>
        <p style={{ color: "#5a5a5a", margin: 0, fontSize: "14px" }}>
          {t("dashboard.subtitle")}
        </p>
      </div>

      {/* Live Notification Banner */}
      {live && (
        <div style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          padding: "14px 20px",
          borderRadius: "10px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          animation: "slideDown 0.3s ease-out",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          <span style={{ fontSize: "20px" }}>🔔</span>
          <span style={{ flex: 1, fontWeight: "500", fontSize: "14px" }}>{live}</span>
          <button 
            onClick={() => setLive(null)}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "white",
              cursor: "pointer",
              padding: "4px 10px",
              borderRadius: "6px",
              fontWeight: "500",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Key Metrics Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "20px",
        marginBottom: "32px"
      }}>
        {/* My Open Claims Card */}
        {data.myOpenClaims != null && (
          <div style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: "12px",
            padding: "24px",
            color: "white",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
          }}>
            <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("dashboard.yourOpenClaims")}
            </div>
            <div style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "4px" }}>
              {data.myOpenClaims}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.8 }}>
              {t("dashboard.awaitingAttention")}
            </div>
          </div>
        )}

        {/* Total Claims Card */}
        <div style={{
          background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
          borderRadius: "12px",
          padding: "24px",
          color: "white",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {t("dashboard.totalClaims")}
          </div>
          <div style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "4px" }}>
            {totalClaims}
          </div>
          <div style={{ fontSize: "12px", opacity: 0.8 }}>
            {t("dashboard.allClaimsInSystem")}
          </div>
        </div>

        {/* Approval Rate Card */}
        <div style={{
          background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
          borderRadius: "12px",
          padding: "24px",
          color: "white",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {t("dashboard.approvalRate")}
          </div>
          <div style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "4px" }}>
            {approvalRate}%
          </div>
          <div style={{ fontSize: "12px", opacity: 0.8 }}>
            {t("dashboard.claimsApproved")}
          </div>
        </div>

        {/* Pending Card */}
        <div style={{
          background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
          borderRadius: "12px",
          padding: "24px",
          color: "white",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {t("dashboard.pendingReview")}
          </div>
          <div style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "4px" }}>
            {(data.claimStatusCounts?.["submitted"] || 0) + (data.claimStatusCounts?.["under_review"] || 0)}
          </div>
          <div style={{ fontSize: "12px", opacity: 0.8 }}>
            {t("dashboard.awaitingProcessing")}
          </div>
        </div>
      </div>

      {/* Status Distribution Section */}
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ 
          fontSize: "18px", 
          fontWeight: "600", 
          color: "#1a1a1a",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <span>📊</span> {t("dashboard.claimsStatusDistribution")}
        </h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px"
        }}>
          {Object.entries(data.claimStatusCounts).map(([status, count]) => {
            const percentage = totalClaims > 0 ? (count / totalClaims * 100).toFixed(1) : 0;
            const statusName = getStatusDisplayName(status);
            return (
              <div key={status} style={{
                background: "white",
                borderRadius: "12px",
                padding: "20px",
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
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <span style={{ fontSize: "13px", color: "#666", textTransform: "capitalize", fontWeight: "500" }}>
                    {statusName}
                  </span>
                  <span style={{ fontSize: "28px", fontWeight: "600", color: getStatusColor(status) }}>
                    {count}
                  </span>
                </div>
                <div style={{
                  background: "#e8e8e8",
                  height: "8px",
                  borderRadius: "4px",
                  overflow: "hidden"
                }}>
                  <div style={{
                    width: `${percentage}%`,
                    height: "100%",
                    background: getStatusColor(status),
                    transition: "width 0.3s ease"
                  }} />
                </div>
                <div style={{ fontSize: "11px", color: "#999", marginTop: "8px", fontWeight: "500" }}>
                  {percentage}% {t("dashboard.ofTotalClaims")}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Claims Section with Sorting */}
      <div>
        <h2 style={{ 
          fontSize: "18px", 
          fontWeight: "600", 
          color: "#1a1a1a",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <span>🕒</span> {t("dashboard.recentActivity")}
        </h2>
        {sortedClaims.length === 0 ? (
          <div style={{ 
            textAlign: "center", 
            padding: "60px", 
            color: "#666", 
            background: "white", 
            borderRadius: "12px",
            border: "1px solid #e8e8e8"
          }}>
            {t("dashboard.noRecentClaims")}
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.04)" }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "white",
              borderRadius: "12px",
              overflow: "hidden",
              minWidth: "600px"
            }}>
              <thead>
                <tr style={{ background: "#1a237e", color: "white" }}>
                  <th 
                    style={{ padding: "16px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "white", width: "25%", cursor: "pointer" }}
                    onClick={() => handleSort("reference")}
                  >
                    {t("dashboard.referenceNumber")} {getSortIcon("reference")}
                  </th>
                  <th 
                    style={{ padding: "16px", textAlign: "center", fontWeight: "600", fontSize: "13px", color: "white", width: "20%", cursor: "pointer" }}
                    onClick={() => handleSort("status")}
                  >
                    {t("dashboard.status")} {getSortIcon("status")}
                  </th>
                  <th 
                    style={{ padding: "16px", textAlign: "right", fontWeight: "600", fontSize: "13px", color: "white", width: "25%", cursor: "pointer" }}
                    onClick={() => handleSort("amount")}
                  >
                    {t("dashboard.amount")} {getSortIcon("amount")}
                  </th>
                  <th 
                    style={{ padding: "16px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "white", width: "30%", cursor: "pointer" }}
                    onClick={() => handleSort("date")}
                  >
                    {t("dashboard.lastUpdated")} {getSortIcon("date")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedClaims.map((c, idx) => (
                  <tr 
                    key={c.id} 
                    style={{ 
                      borderBottom: idx === sortedClaims.length - 1 ? "none" : "1px solid #f0f0f0",
                      transition: "background 0.2s",
                      background: idx % 2 === 0 ? "white" : "#fafafa"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f5f5"; }}
                    onMouseLeave={(e) => { 
                      e.currentTarget.style.background = idx % 2 === 0 ? "white" : "#fafafa";
                    }}
                  >
                    <td style={{ padding: "16px", fontWeight: "600", fontSize: "14px", color: "#1a1a1a" }}>
                      {c.reference_number}
                    </td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      {getStatusBadge(c.status)}
                    </td>
                    <td style={{ padding: "16px", textAlign: "right", fontWeight: "700", fontSize: "15px", color: "#1a1a1a" }}>
                      {formatCurrency(c.claimed_amount, c.currency)}
                    </td>
                    <td style={{ padding: "16px", fontSize: "13px", color: "#666" }}>
                      {formatDate(c.updated_at)}
                    </td>
                  </tr>
                ))}
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
        <span>🔒 {t("dashboard.secureDashboard")} | </span>
        <span>📊 {t("dashboard.realTimeUpdates")} | </span>
        <span>🕒 {t("dashboard.lastRefresh")}: {new Date().toLocaleString('en-HK')}</span>
      </div>

      {/* Add animation styles */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
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