import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";

type ClaimRow = {
  id: string;
  reference_number: string;
  status: string;
  claimed_amount: string;
  currency: string;
  customer_name?: string;
  created_at?: string;
  updated_at?: string;
  fraud_risk_score?: number;
};

type SortField = "reference" | "customer" | "status" | "risk" | "amount" | "date";
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
  return statusMap[status?.toLowerCase()] || `claims.${status?.toLowerCase()}`;
};

export function ClaimsListPage() {
  const { t } = useTranslation();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    async function fetchClaims() {
      try {
        const r = await api<{ claims: ClaimRow[] }>("/claims");
        setClaims(r.claims);
      } catch (error) {
        console.error("Failed to fetch claims:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchClaims();
  }, []);

  const formatCurrency = (amount: string, currency: string) => {
    return new Intl.NumberFormat('en-HK', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(amount) || 0);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString('en-HK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return "N/A";
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

  const getRiskBadge = (score?: number) => {
    if (!score) return null;
    if (score >= 70) return { bg: "#ffebee", color: "#c62828", icon: "🔴", label: t("claims.highRisk") };
    if (score >= 40) return { bg: "#fff3e0", color: "#f57c00", icon: "🟠", label: t("claims.mediumRisk") };
    return { bg: "#e8f5e9", color: "#2e7d32", icon: "🟢", label: t("claims.lowRisk") };
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

  const handleDelete = async (id: string) => {
    if (!confirm(t("claims.confirmDelete"))) {
      return;
    }
    
    setDeletingId(id);
    try {
      await api(`/claims/${id}`, {
        method: "DELETE",
      });
      const r = await api<{ claims: ClaimRow[] }>("/claims");
      setClaims(r.claims);
      setShowConfirm(null);
      alert(t("claims.deleteSuccess"));
    } catch (error) {
      console.error("Failed to delete claim:", error);
      alert(error instanceof Error ? error.message : t("claims.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  const getFilteredAndSortedClaims = () => {
    let filtered = [...claims];
    
    // Status filter
    if (filter !== "all") {
      filtered = filtered.filter(c => c.status?.toLowerCase() === filter);
    }
    
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.reference_number?.toLowerCase().includes(searchLower) ||
        c.customer_name?.toLowerCase().includes(searchLower)
      );
    }
    
    // Date range filter
    if (dateRange.start) {
      filtered = filtered.filter(c => new Date(c.created_at || "") >= new Date(dateRange.start));
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59);
      filtered = filtered.filter(c => new Date(c.created_at || "") <= endDate);
    }
    
    // Sorting
    return filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "reference":
          aVal = a.reference_number;
          bVal = b.reference_number;
          break;
        case "customer":
          aVal = a.customer_name || "";
          bVal = b.customer_name || "";
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "risk":
          aVal = a.fraud_risk_score || 0;
          bVal = b.fraud_risk_score || 0;
          break;
        case "amount":
          aVal = parseFloat(a.claimed_amount);
          bVal = parseFloat(b.claimed_amount);
          break;
        case "date":
          aVal = new Date(a.created_at || "").getTime();
          bVal = new Date(b.created_at || "").getTime();
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

  const filteredAndSortedClaims = getFilteredAndSortedClaims();

  const stats = {
    total: claims.length,
    approved: claims.filter(c => c.status === "approved").length,
    pending: claims.filter(c => c.status === "submitted" || c.status === "under_review").length,
    rejected: claims.filter(c => c.status === "rejected").length,
    totalValue: claims.reduce((sum, c) => sum + (parseFloat(c.claimed_amount) || 0), 0),
    highRisk: claims.filter(c => (c.fraud_risk_score || 0) >= 70).length,
  };

  // Get status options for filter dropdown with translations
  const statusOptions = [
    { value: "all", label: t("claims.allStatuses") },
    { value: "draft", label: t("claims.draft") },
    { value: "submitted", label: t("claims.submitted") },
    { value: "under_review", label: t("claims.underReview") },
    { value: "escalated", label: t("claims.escalated") },
    { value: "approved", label: t("claims.approved") },
    { value: "rejected", label: t("claims.rejected") },
    { value: "payment_pending", label: t("claims.paymentPending") },
    { value: "paid", label: t("claims.paid") },
  ];

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
        {t("claims.loading")}
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
          {t("claims.management")}
        </h1>
        <p style={{ color: "#5a5a5a", margin: 0, fontSize: "14px" }}>
          {t("claims.subtitle")}
        </p>
      </div>

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
            {t("dashboard.totalClaims")}
          </div>
          <div style={{ fontSize: "32px", fontWeight: "bold" }}>{stats.total.toLocaleString()}</div>
        </div>
        <div style={{
          background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
          borderRadius: "12px",
          padding: "20px",
          color: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {t("dashboard.approvalRate")}
          </div>
          <div style={{ fontSize: "32px", fontWeight: "bold" }}>{stats.approved}</div>
        </div>
        <div style={{
          background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
          borderRadius: "12px",
          padding: "20px",
          color: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {t("dashboard.pendingReview")}
          </div>
          <div style={{ fontSize: "32px", fontWeight: "bold" }}>{stats.pending}</div>
        </div>
        <div style={{
          background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
          borderRadius: "12px",
          padding: "20px",
          color: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {t("claims.highRisk")}
          </div>
          <div style={{ fontSize: "32px", fontWeight: "bold" }}>{stats.highRisk}</div>
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
              placeholder={t("claims.searchByReferenceOrCustomer")}
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
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                background: "white",
                color: "#1a1a1a"
              }}
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: "130px" }}>
            <label style={{
              display: "block",
              fontSize: "11px",
              fontWeight: "600",
              color: "#666",
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
              }}>
              {t("claims.fromDate")}
            </label>
            <input
              type="date"
              placeholder={t("claims.fromDate")}
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#1a1a1a",
                backgroundColor: "white",
                cursor: "pointer"
              }}
            />
          </div>
          <div style={{ minWidth: "130px" }}>
            <label style={{
              display: "block",
              fontSize: "11px",
              fontWeight: "600",
              color: "#666",
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
              }}>
              {t("claims.toDate")}
            </label>
            <input
              type="date"
              placeholder={t("claims.toDate")}
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#1a1a1a",
                backgroundColor: "white",
                cursor: "pointer"
              }}
            />
          </div>
          {(filter !== "all" || searchTerm || dateRange.start || dateRange.end) && (
            <button
              onClick={() => {
                setFilter("all");
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
              {t("claims.clearAll")}
            </button>
          )}
        </div>
      </div>

      {/* Claims Table */}
      {filteredAndSortedClaims.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "60px",
          background: "white",
          borderRadius: "12px",
          color: "#666",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)"
        }}>
          {t("claims.noClaims")}
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
                    onClick={() => handleSort("reference")}
                  >
                    {t("claims.reference")} {getSortIcon("reference")}
                  </th>
                  <th 
                    style={{ padding: "14px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "white", cursor: "pointer" }}
                    onClick={() => handleSort("customer")}
                  >
                    {t("claims.customer")} {getSortIcon("customer")}
                  </th>
                  <th 
                    style={{ padding: "14px", textAlign: "center", fontWeight: "600", fontSize: "13px", color: "white", cursor: "pointer" }}
                    onClick={() => handleSort("status")}
                  >
                    {t("claims.status")} {getSortIcon("status")}
                  </th>
                  <th 
                    style={{ padding: "14px", textAlign: "center", fontWeight: "600", fontSize: "13px", color: "white", cursor: "pointer" }}
                    onClick={() => handleSort("risk")}
                  >
                    {t("claims.risk")} {getSortIcon("risk")}
                  </th>
                  <th 
                    style={{ padding: "14px", textAlign: "right", fontWeight: "600", fontSize: "13px", color: "white", cursor: "pointer" }}
                    onClick={() => handleSort("amount")}
                  >
                    {t("claims.amount")} {getSortIcon("amount")}
                  </th>
                  <th 
                    style={{ padding: "14px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "white", cursor: "pointer" }}
                    onClick={() => handleSort("date")}
                  >
                    {t("claims.submittedDate")} {getSortIcon("date")}
                  </th>
                  <th style={{ padding: "14px", textAlign: "center", fontWeight: "600", fontSize: "13px", color: "white" }}>
                    {t("claims.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedClaims.map((c, idx) => {
                  const riskBadge = getRiskBadge(c.fraud_risk_score);
                  const isDraft = c.status?.toLowerCase() === "draft";
                  return (
                    <tr 
                      key={c.id} 
                      style={{ 
                        borderBottom: idx === filteredAndSortedClaims.length - 1 ? "none" : "1px solid #f0f0f0",
                        transition: "background 0.2s",
                        background: idx % 2 === 0 ? "white" : "#fafafa"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f5f5"; }}
                      onMouseLeave={(e) => { 
                        e.currentTarget.style.background = idx % 2 === 0 ? "white" : "#fafafa";
                      }}
                    >
                      <td style={{ padding: "14px", fontWeight: "600", color: "#1a1a1a", fontSize: "13px" }}>
                        {c.reference_number}
                      </td>
                      <td style={{ padding: "14px", color: "#424242", fontSize: "13px" }}>
                        {c.customer_name || "—"}
                      </td>
                      <td style={{ padding: "14px", textAlign: "center" }}>
                        {getStatusBadge(c.status)}
                      </td>
                      <td style={{ padding: "14px", textAlign: "center" }}>
                        {riskBadge && (
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 10px",
                            borderRadius: "20px",
                            fontSize: "11px",
                            fontWeight: "600",
                            background: riskBadge.bg,
                            color: riskBadge.color
                          }}>
                            {riskBadge.icon} {riskBadge.label}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "14px", textAlign: "right", fontWeight: "600", color: "#1a1a1a", fontSize: "14px" }}>
                        {formatCurrency(c.claimed_amount, c.currency)}
                      </td>
                      <td style={{ padding: "14px", fontSize: "12px", color: "#666" }}>
                        {formatDate(c.updated_at) || formatDate(c.created_at) || "N/A"}
                      </td>
                      <td style={{ padding: "14px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                          <Link
                            to={`/claims/${c.id}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "6px 16px",
                              background: "#1976d2",
                              color: "white",
                              textDecoration: "none",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "500",
                              transition: "background 0.2s"
                            }}
                            onMouseEnter={(e) => {
                              const link = e.currentTarget as HTMLElement;
                              link.style.background = "#1565c0";
                            }}
                            onMouseLeave={(e) => {
                              const link = e.currentTarget as HTMLElement;
                              link.style.background = "#1976d2";
                            }}
                          >
                            {t("claims.viewDetails")} →
                          </Link>
                          {isDraft && (
                            <>
                              {showConfirm === c.id ? (
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button
                                    onClick={() => handleDelete(c.id)}
                                    disabled={deletingId === c.id}
                                    style={{
                                      padding: "6px 12px",
                                      background: "#d32f2f",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "6px",
                                      cursor: "pointer",
                                      fontSize: "12px",
                                      fontWeight: "500",
                                      transition: "background 0.2s"
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = "#b71c1c"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = "#d32f2f"; }}
                                  >
                                    {deletingId === c.id ? "..." : t("claims.confirm")}
                                  </button>
                                  <button
                                    onClick={() => setShowConfirm(null)}
                                    style={{
                                      padding: "6px 12px",
                                      background: "#757575",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "6px",
                                      cursor: "pointer",
                                      fontSize: "12px",
                                      fontWeight: "500"
                                    }}
                                  >
                                    {t("claims.cancel")}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setShowConfirm(c.id)}
                                  style={{
                                    padding: "6px 12px",
                                    background: "#f44336",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                    fontWeight: "500",
                                    transition: "background 0.2s"
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = "#d32f2f"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = "#f44336"; }}
                                >
                                  🗑️ {t("claims.delete")}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Stats */}
          <div style={{
            marginTop: "20px",
            padding: "14px 20px",
            background: "white",
            borderRadius: "10px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            border: "1px solid #e8e8e8"
          }}>
            <div style={{ fontSize: "13px", color: "#666" }}>
              {t("claims.showing")} <strong>{filteredAndSortedClaims.length}</strong> {t("claims.of")} <strong>{claims.length}</strong> {t("claims.claimsFound")}
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
                🖨️ {t("claims.print")}
              </button>
              <button
                onClick={() => {
                  const headers = [t("claims.reference"), t("claims.customer"), t("claims.status"), "Risk Score", t("claims.amount"), "Currency", t("claims.submittedDate")];
                  const csvRows = filteredAndSortedClaims.map(c => [
                    c.reference_number,
                    c.customer_name || "",
                    c.status,
                    c.fraud_risk_score || "",
                    c.claimed_amount,
                    c.currency,
                    formatDate(c.created_at)
                  ]);
                  const csvContent = [headers, ...csvRows].map(row => row.join(",")).join("\n");
                  const blob = new Blob([csvContent], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `claims_export_${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{
                  padding: "6px 14px",
                  background: "#4caf50",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "white",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#43a047"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#4caf50"; }}
              >
                📥 {t("claims.exportCsv")}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Compliance Footer */}
      <div style={{
        marginTop: "24px",
        padding: "14px 20px",
        background: "#f8f9fa",
        borderRadius: "8px",
        border: "1px solid #e8e8e8",
        fontSize: "12px",
        color: "#666",
        textAlign: "center"
      }}>
        <span>🔒 {t("claims.dataEncrypted")} | </span>
        <span>📋 {t("claims.compliantWith")} | </span>
        <span>🕒 {t("claims.realTimeUpdates")}</span>
      </div>
    </div>
  );
}