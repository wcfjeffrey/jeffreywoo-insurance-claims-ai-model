import { useEffect, useState, type FormEvent, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { marked } from 'marked';

type Detail = {
  claim: Record<string, unknown>;
  documents: { id: string; original_name: string; created_at?: string }[];
  workflow: { action: string; from_status?: string; to_status: string; actor_name: string | null; created_at: string }[];
};

type AIResult = {
  score: number;
  flags: string[];
  claimType: string;
  coverageStatus: "likely" | "uncertain" | "unlikely" | string;
  coveragePosture?: string;
  recommendation: string;
  notes?: string;
  riskBand?: "Critical" | "High" | "Medium" | "Low";
  executiveRecommendation?: string;
  reportMarkdown?: string;
  vendorAnalysis: {
    totalFound: number;
    verified: Array<{ name: string; type: string; category: string; document: string; rating?: number; website?: string }>;
    unverified: Array<{ name: string; type: string; category: string; document: string; flag?: string; rating?: number; website?: string }>;
    byClaimType: { relevant: number; irrelevant: number };
    recommendation: string;
    extractionNote?: string;
  };
  documentAnalysis: Array<{
    document: string;
    issues: Array<{
      type: string;
      severity: "low" | "medium" | "high" | "critical";
      description: string;
      recommendation: string;
    }>;
  }>;
  googleSearchSummary?: {
    searchesPerformed: number;
    resultsFound: number;
    vendorsVerified: string[];
  };
};

type SortField = "name" | "date";
type SortOrder = "asc" | "desc";
type WorkflowSortField = "action" | "from" | "to" | "actor" | "date";
type WorkflowSortOrder = "asc" | "desc";

function formatStatus(status: string): string {
  if (!status) return "Unknown";
  return status.replace(/_/g, ' ');
}

function formatCoverageStatus(status: string, t: any): string {
  if (!status) return t("claimDetail.notAnalyzedYet");
  if (status === "likely") return t("claimDetail.likely");
  if (status === "uncertain") return t("claimDetail.uncertain");
  if (status === "unlikely") return t("claimDetail.unlikely");
  return status;
}

function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function riskScoreVisual(score: number, t: any): { bg: string; fg: string; label: string } {
  if (score >= 80) return { bg: "#ffebee", fg: "#b71c1c", label: t("claimDetail.riskLevels.critical") };
  if (score >= 60) return { bg: "#fff3e0", fg: "#e65100", label: t("claimDetail.riskLevels.high") };
  if (score >= 40) return { bg: "#fff8e1", fg: "#f57f17", label: t("claimDetail.riskLevels.medium") };
  return { bg: "#e8f5e9", fg: "#2e7d32", label: t("claimDetail.riskLevels.low") };
}

export function ClaimDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [errType, setErrType] = useState<"error" | "success" | "info">("error");
  const [notes, setNotes] = useState("");
  const [approvedAmt, setApprovedAmt] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Document sorting state
  const [docSortField, setDocSortField] = useState<SortField>("name");
  const [docSortOrder, setDocSortOrder] = useState<SortOrder>("asc");
  
  // Workflow sorting state
  const [workflowSortField, setWorkflowSortField] = useState<WorkflowSortField>("date");
  const [workflowSortOrder, setWorkflowSortOrder] = useState<WorkflowSortOrder>("desc");

  const load = () => {
    if (!id) return;
    setLoading(true);
    void api<Detail>(`/claims/${id}`)
      .then(setData)
      .catch((e) => {
        setErrType("error");
        setErr(String(e));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  async function transition(to_status: string) {
    if (!id) return;
    setErr(null);
    setActionLoading(to_status);
    try {
      await api(`/claims/${id}/transition`, {
        method: "POST",
        body: JSON.stringify({
          to_status,
          notes: notes || undefined,
          approved_amount: approvedAmt ? Number(approvedAmt) : undefined,
        }),
      });
      setErrType("success");
      setErr(t("claimDetail.transitionSuccess", { status: to_status.replace(/_/g, ' ') }));
      setNotes("");
      setApprovedAmt("");
      load();
      setTimeout(() => setErr(null), 5000);
    } catch (e) {
      setErrType("error");
      setErr(e instanceof Error ? e.message : t("claimDetail.transitionError"));
    } finally {
      setActionLoading(null);
    }
  }

  async function aiValidate() {
    if (!id) return;
    setErr(null);
    setActionLoading("ai");
    setAiResult(null);
    try {
      const response = await api<any>(`/claims/${id}/ai-validate`, { 
        method: "POST", 
        body: "{}" 
      });
      if (response && response.fraud) {
        setAiResult(response.fraud);
        setErrType("success");
        setErr(t("claimDetail.aiValidationSuccess", { score: response.fraud.score, flags: response.fraud.flags?.length || 0 }));
      } else {
        setErrType("success");
        setErr(t("claimDetail.aiValidationComplete"));
      }
      load();
    } catch (e) {
      setErrType("error");
      setErr(e instanceof Error ? e.message : t("claimDetail.aiValidationFailed"));
    } finally {
      setActionLoading(null);
    }
  }

  async function uploadFile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id) return;
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File | null;
    if (!file?.size) return;
    
    setUploading(true);
    const token = localStorage.getItem("jw_token");
    try {
      const res = await fetch(`/api/claims/${id}/documents`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        setErrType("error");
        setErr(await res.text());
        return;
      }
      setErrType("success");
      setErr(t("claimDetail.uploadSuccess"));
      load();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setTimeout(() => setErr(null), 3000);
    } catch (e) {
      setErrType("error");
      setErr(e instanceof Error ? e.message : t("claimDetail.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function deleteDocument(documentId: string, documentName: string) {
    if (!id) {
      setErrType("error");
      setErr(t("claimDetail.noClaimFound"));
      return;
    }
    
    if (!confirm(t("claimDetail.confirmDeleteDocument", { name: documentName }))) {
      return;
    }
    
    setDeletingDocId(documentId);
    const token = localStorage.getItem("jw_token");
    
    try {
      const res = await fetch(`/api/claims/${id}/documents/${documentId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (!res.ok) {
        let errorMessage = t("claimDetail.deleteDocumentFailed");
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = res.statusText || errorMessage;
        }
        setErrType("error");
        setErr(errorMessage);
        return;
      }
      
      setErrType("success");
      setErr(t("claimDetail.deleteDocumentSuccess", { name: documentName }));
      load(); // Refresh the page to update document list
      setTimeout(() => setErr(null), 3000);
    } catch (e) {
      console.error("Delete error:", e);
      setErrType("error");
      setErr(e instanceof Error ? e.message : t("claimDetail.deleteDocumentFailed"));
    } finally {
      setDeletingDocId(null);
    }
  }

  const formatCurrency = (amount: unknown, currency: unknown) => {
    return new Intl.NumberFormat('en-HK', {
      style: 'currency',
      currency: String(currency || 'HKD'),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
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
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 14px",
        borderRadius: "20px",
        fontSize: "13px",
        fontWeight: "600",
        background: style.bg,
        color: style.color
      }}>
        {style.icon} {capitalizeFirst(formatStatus(status))}
      </span>
    );
  };

  const getRiskBadge = (score: number) => {
    if (score >= 70) return { bg: "#ffebee", color: "#c62828", label: t("claims.highRisk"), icon: "🔴" };
    if (score >= 40) return { bg: "#fff3e0", color: "#f57c00", label: t("claims.mediumRisk"), icon: "🟠" };
    return { bg: "#e8f5e9", color: "#2e7d32", label: t("claims.lowRisk"), icon: "🟢" };
  };

  // Check if claim is in draft status
  const isDraft = data?.claim?.status === "draft";

  // Document sorting handlers
  const handleDocSort = (field: SortField) => {
    if (docSortField === field) {
      setDocSortOrder(docSortOrder === "asc" ? "desc" : "asc");
    } else {
      setDocSortField(field);
      setDocSortOrder("asc");
    }
  };

  const getDocSortIcon = (field: SortField) => {
    if (docSortField !== field) return "↕️";
    return docSortOrder === "asc" ? "↑" : "↓";
  };

  const getSortedDocuments = () => {
    if (!data?.documents) return [];
    
    return [...data.documents].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (docSortField) {
        case "name":
          aVal = a.original_name;
          bVal = b.original_name;
          break;
        case "date":
          aVal = new Date(a.created_at || "").getTime();
          bVal = new Date(b.created_at || "").getTime();
          break;
        default:
          aVal = a.original_name;
          bVal = b.original_name;
      }
      
      if (aVal < bVal) return docSortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return docSortOrder === "asc" ? 1 : -1;
      return 0;
    });
  };

  // Workflow sorting handlers
  const handleWorkflowSort = (field: WorkflowSortField) => {
    if (workflowSortField === field) {
      setWorkflowSortOrder(workflowSortOrder === "asc" ? "desc" : "asc");
    } else {
      setWorkflowSortField(field);
      setWorkflowSortOrder("asc");
    }
  };

  const getWorkflowSortIcon = (field: WorkflowSortField) => {
    if (workflowSortField !== field) return "↕️";
    return workflowSortOrder === "asc" ? "↑" : "↓";
  };

  const getSortedWorkflow = () => {
    if (!data?.workflow) return [];
    
    return [...data.workflow].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (workflowSortField) {
        case "action":
          aVal = a.action;
          bVal = b.action;
          break;
        case "from":
          aVal = a.from_status || "";
          bVal = b.from_status || "";
          break;
        case "to":
          aVal = a.to_status;
          bVal = b.to_status;
          break;
        case "actor":
          aVal = a.actor_name || "";
          bVal = b.actor_name || "";
          break;
        case "date":
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        default:
          aVal = a.created_at;
          bVal = b.created_at;
      }
      
      if (aVal < bVal) return workflowSortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return workflowSortOrder === "asc" ? 1 : -1;
      return 0;
    });
  };

  const sortedDocuments = getSortedDocuments();
  const sortedWorkflow = getSortedWorkflow();

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
        {t("claimDetail.loading")}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        {err ? (
          <div style={{ color: "#c62828", background: "#ffebee", padding: "16px", borderRadius: "8px", display: "inline-block" }}>
            {t("claimDetail.error")}: {err}
          </div>
        ) : (
          t("claimDetail.notFound")
        )}
      </div>
    );
  }

  const c = data.claim;
  const role = user?.role;
  const fraudScore = c.fraud_risk_score as number;
  const riskStyle = fraudScore ? getRiskBadge(fraudScore) : null;

  return (
    <div style={{ 
      padding: "24px", 
      maxWidth: "1400px", 
      margin: "0 auto", 
      background: "#f0f2f5", 
      minHeight: "100vh",
      fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif"
    }}>
      {/* Back Button */}
      <Link 
        to="/claims" 
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          color: "#1976d2",
          textDecoration: "none",
          marginBottom: "20px",
          fontWeight: "500",
          fontSize: "14px",
          transition: "color 0.2s"
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "#0d47a1"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "#1976d2"; }}
      >
        ← {t("claimDetail.backToClaims")}
      </Link>

      {/* Header */}
      <div style={{
        background: "white",
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "24px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
        border: "1px solid #e8e8e8"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ margin: 0, marginBottom: "12px", fontSize: "28px", fontWeight: "600", color: "#1a1a1a", letterSpacing: "-0.5px" }}>
              {String(c.reference_number)}
            </h1>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              {getStatusBadge(String(c.status))}
              {fraudScore && (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: "600",
                  background: riskStyle?.bg,
                  color: riskStyle?.color
                }}>
                  {riskStyle?.icon} {riskStyle?.label} ({fraudScore}%)
                </span>
              )}
            </div>
          </div>
          <div style={{ 
            fontSize: "28px", 
            fontWeight: "600", 
            color: "#1a1a1a",
            padding: "12px 20px",
            background: "#f8f9fa",
            borderRadius: "8px",
            border: "1px solid #e8e8e8"
          }}>
            {formatCurrency(c.claimed_amount, c.currency)}
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {err && (
        <div style={{ 
          background: errType === "success" ? "#e8f5e9" : errType === "error" ? "#ffebee" : "#e3f2fd",
          borderLeft: `4px solid ${errType === "success" ? "#4caf50" : errType === "error" ? "#f44336" : "#2196f3"}`,
          padding: "14px 20px",
          marginBottom: "24px",
          borderRadius: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
        }}>
          <span style={{ 
            color: errType === "success" ? "#2e7d32" : errType === "error" ? "#c62828" : "#0d47a1",
            fontSize: "14px",
            fontWeight: "500"
          }}>
            {errType === "success" ? "✓" : errType === "error" ? "⚠" : "ℹ"} {err}
          </span>
          <button 
            onClick={() => setErr(null)}
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

      {/* Claim Details Card */}
      <div style={{
        background: "white",
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "24px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
        border: "1px solid #e8e8e8"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#1a1a1a", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>📋</span> {t("claimDetail.claimInformation")}
          </h2>
          {aiResult && (
            <span style={{
              fontSize: "11px",
              padding: "4px 12px",
              borderRadius: "20px",
              background: "#e3f2fd",
              color: "#1976d2"
            }}>
              {t("claimDetail.aiAnalyzed")}
            </span>
          )}
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "20px"
        }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "600", color: "#999", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("claimDetail.claimStatus")}
            </div>
            <div style={{ fontSize: "15px", fontWeight: "500", color: "#1a1a1a" }}>
              {capitalizeFirst(formatStatus(String(c.status)))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "600", color: "#999", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("claimDetail.claimType")}
            </div>
            <div style={{ fontSize: "15px", fontWeight: "500", color: "#1a1a1a" }}>
              {aiResult?.claimType ? capitalizeFirst(aiResult.claimType) : t("claimDetail.notAnalyzedYet")}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "600", color: "#999", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("claimDetail.coveragePosture")}
            </div>
            <div style={{ 
              fontSize: "15px", 
              fontWeight: "500", 
              color: aiResult?.coverageStatus === "likely" ? "#2e7d32" : 
                     aiResult?.coverageStatus === "uncertain" ? "#f57c00" : 
                     aiResult?.coverageStatus === "unlikely" ? "#c62828" : "#666"
            }}>
              {formatCoverageStatus(aiResult?.coverageStatus || "", t)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "600", color: "#999", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("claimDetail.claimedAmount")}
            </div>
            <div style={{ fontSize: "15px", fontWeight: "500", color: "#1a1a1a" }}>
              {formatCurrency(c.claimed_amount, c.currency)}
            </div>
          </div>
          {c.approved_amount != null && String(c.approved_amount) !== "" && (
            <div>
              <div style={{ fontSize: "11px", fontWeight: "600", color: "#999", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {t("claimDetail.approvedAmount")}
              </div>
              <div style={{ fontSize: "15px", fontWeight: "500", color: "#2e7d32" }}>
                {formatCurrency(c.approved_amount, c.currency)}
              </div>
            </div>
          )}
          <div>
            <div style={{ fontSize: "11px", fontWeight: "600", color: "#999", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("claimDetail.currency")}
            </div>
            <div style={{ fontSize: "15px", fontWeight: "500", color: "#1a1a1a" }}>{String(c.currency)}</div>
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "600", color: "#999", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("claimDetail.submittedBy")}
            </div>
            <div style={{ fontSize: "15px", fontWeight: "500", color: "#1a1a1a" }}>
              {String(c.created_by_name || c.created_by || "N/A")}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "600", color: "#999", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("claimDetail.submittedDate")}
            </div>
            <div style={{ fontSize: "15px", fontWeight: "500", color: "#1a1a1a" }}>
              {c.created_at ? formatDate(String(c.created_at)) : "N/A"}
            </div>
          </div>
        </div>
        
        {c.incident_description != null && String(c.incident_description).trim() !== "" && (
          <div style={{ marginTop: "24px" }}>
            <div style={{ fontSize: "11px", fontWeight: "600", color: "#999", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("claimDetail.incidentDescription")}
            </div>
            <div style={{
              padding: "16px",
              background: "#f8f9fa",
              borderRadius: "8px",
              fontSize: "14px",
              lineHeight: "1.6",
              color: "#424242",
              border: "1px solid #e8e8e8"
            }}>
              {String(c.incident_description)}
            </div>
          </div>
        )}
      </div>

      {/* AI Validation Report (unchanged) */}
      {aiResult && (
        <div style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          border: "1px solid #e8e8e8",
        }}>
          {/* AI Validation content remains the same */}
          <h2 style={{
            margin: 0,
            marginBottom: "8px",
            fontSize: "18px",
            fontWeight: "600",
            color: "#1a1a1a",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}>
            <span>🤖</span>
            {t("claimDetail.aiValidationReport")}
            <span style={{
              marginLeft: "auto",
              fontSize: "12px",
              padding: "4px 12px",
              borderRadius: "20px",
              background: "#e3f2fd",
              color: "#1976d2",
            }}>
              {t("claimDetail.claimType")}: {capitalizeFirst(aiResult.claimType || t("claimDetail.general"))}
            </span>
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#666", lineHeight: 1.5 }}>
            {t("claimDetail.reportDescription")}
          </p>

          {aiResult.reportMarkdown ? (
            (() => {
              const rv = riskScoreVisual(aiResult.score, t);
              return (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "16px",
                      padding: "12px 16px",
                      background: rv.bg,
                      borderRadius: "8px",
                      border: `1px solid ${rv.fg}33`,
                    }}
                  >
                    <div style={{ flex: "1 1 220px" }}>
                      <div style={{ fontSize: "12px", color: "#555", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: "600" }}>
                        {t("claimDetail.overallRiskAssessment")}
                      </div>
                      <div style={{ fontSize: "24px", fontWeight: "700", color: rv.fg }}>
                        {aiResult.score}/100
                        {aiResult.riskBand && (
                          <span style={{ fontSize: "15px", fontWeight: "600", marginLeft: "10px" }}>
                            {aiResult.riskBand}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>{rv.label}</div>
                    </div>
                    <button
  type="button"
  onClick={async () => {
    if (!aiResult?.reportMarkdown) return;
    
    try {
      // Convert markdown to HTML using marked
      const htmlContent = await marked(aiResult.reportMarkdown);
      
      const fullHtml = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>AI Validation Report</title>
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            margin: 40px;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 { color: #1a237e; border-bottom: 2px solid #1a237e; padding-bottom: 10px; }
          h2 { color: #283593; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
          h3 { color: #1a237e; margin-top: 20px; }
          table { border-collapse: collapse; width: 100%; margin: 15px 0; }
          th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
          th { background: #f5f5f5; font-weight: 600; }
          code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
          pre { background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; }
          .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
        </style>
      </head>
      <body>
        ${htmlContent}
        <div class="footer">
          <p>Generated by JeffreyWoo Insurance Claims System on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>`;
      
      const blob = new Blob([fullHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai_validation_report_${new Date().toISOString().split('T')[0]}.html`;
      a.click();
      URL.revokeObjectURL(url);
      
      setErrType("success");
      setErr(t("claimDetail.downloadSuccess"));
      setTimeout(() => setErr(null), 4000);
    } catch (error) {
      console.error("Download failed:", error);
      setErrType("error");
      setErr(t("claimDetail.downloadFailed"));
      setTimeout(() => setErr(null), 4000);
    }
  }}
  style={{
    padding: "10px 18px",
    background: "#4caf50",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  }}
  onMouseEnter={(e) => { e.currentTarget.style.background = "#43a047"; }}
  onMouseLeave={(e) => { e.currentTarget.style.background = "#4caf50"; }}
>
  <span>⬇️</span> {t("claimDetail.downloadFullReport")}
</button>
                  </div>
                  <div
                    className="claim-report-markdown"
                    style={{
                      maxHeight: "min(75vh, 800px)",
                      overflowY: "auto",
                      padding: "20px 24px",
                      background: "#fafafa",
                      borderRadius: "10px",
                      border: "1px solid #e0e0e0",
                    }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResult.reportMarkdown}</ReactMarkdown>
                  </div>
                </>
              );
            })()
          ) : (
            <div style={{
              padding: "16px",
              background: "#fff3e0",
              borderRadius: "8px",
              fontSize: "14px",
              color: "#5d4037",
            }}>
              <strong>{t("claimDetail.riskScore")}:</strong> {aiResult.score}/100. {aiResult.recommendation || t("claimDetail.noReportAvailable")}
            </div>
          )}
        </div>
      )}

      {/* Supporting Evidence Section (unchanged) */}
      {aiResult?.googleSearchSummary && (
        <div style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          border: "1px solid #e8e8e8"
        }}>
          <h2 style={{ margin: 0, marginBottom: "20px", fontSize: "18px", fontWeight: "600", color: "#1a1a1a", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>📊</span> {t("claimDetail.supportingEvidence")}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div style={{ padding: "12px", background: "#f5f5f5", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase" }}>{t("claimDetail.searchesPerformed")}</div>
              <div style={{ fontSize: "24px", fontWeight: "600", color: "#1976d2" }}>
                {aiResult.googleSearchSummary.searchesPerformed}
              </div>
            </div>
            <div style={{ padding: "12px", background: "#f5f5f5", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase" }}>{t("claimDetail.resultsFound")}</div>
              <div style={{ fontSize: "24px", fontWeight: "600", color: "#4caf50" }}>
                {aiResult.googleSearchSummary.resultsFound}
              </div>
            </div>
            <div style={{ padding: "12px", background: "#f5f5f5", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase" }}>{t("claimDetail.vendorsVerified")}</div>
              <div style={{ fontSize: "24px", fontWeight: "600", color: "#ff9800" }}>
                {aiResult.googleSearchSummary.vendorsVerified.length}
              </div>
            </div>
          </div>
          {aiResult.googleSearchSummary.vendorsVerified.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: "500", color: "#666", marginBottom: "8px" }}>{t("claimDetail.verifiedVendors")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {aiResult.googleSearchSummary.vendorsVerified.map((vendor, idx) => (
                  <span key={idx} style={{ fontSize: "12px", background: "#e8f5e9", color: "#2e7d32", padding: "4px 12px", borderRadius: "16px" }}>
                    ✓ {vendor}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Officer Actions (unchanged) */}
      {(role === "claim_officer" || role === "manager") && (
        <div style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          border: "1px solid #e8e8e8"
        }}>
          <h2 style={{ margin: 0, marginBottom: "20px", fontSize: "18px", fontWeight: "600", color: "#1a1a1a", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>🛠️</span> {t("claimDetail.officerActions")}
          </h2>
          <button
            type="button"
            onClick={aiValidate}
            disabled={actionLoading === "ai"}
            style={{
              padding: "10px 24px",
              background: actionLoading === "ai" ? "#ccc" : "#9c27b0",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: actionLoading === "ai" ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "500",
              marginBottom: "20px",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => { if (actionLoading !== "ai") e.currentTarget.style.background = "#7b1fa2"; }}
            onMouseLeave={(e) => { if (actionLoading !== "ai") e.currentTarget.style.background = "#9c27b0"; }}
          >
            {actionLoading === "ai" ? t("claimDetail.processing") : t("claimDetail.runAiValidation")}
          </button>
          <div style={{ display: "grid", gap: "12px", marginBottom: "20px" }}>
            <input
              type="number"
              step="0.01"
              placeholder={t("claimDetail.approvedAmountPlaceholder")}
              value={approvedAmt}
              onChange={(e) => setApprovedAmt(e.target.value)}
              style={{
                padding: "12px 14px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "14px",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#667eea"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#ddd"; }}
            />
            <textarea
              placeholder={t("claimDetail.internalNotesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{
                padding: "12px 14px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "14px",
                fontFamily: "inherit",
                resize: "vertical",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#667eea"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#ddd"; }}
            />
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => transition("under_review")}
              disabled={actionLoading !== null}
              style={{
                padding: "8px 20px",
                background: actionLoading ? "#ccc" : "#ff9800",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: actionLoading ? "not-allowed" : "pointer",
                fontWeight: "500",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => { if (!actionLoading) e.currentTarget.style.background = "#f57c00"; }}
              onMouseLeave={(e) => { if (!actionLoading) e.currentTarget.style.background = "#ff9800"; }}
            >
              {t("claimDetail.markUnderReview")}
            </button>
            <button
              type="button"
              onClick={() => transition("escalated")}
              disabled={actionLoading !== null}
              style={{
                padding: "8px 20px",
                background: actionLoading ? "#ccc" : "#f44336",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: actionLoading ? "not-allowed" : "pointer",
                fontWeight: "500",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => { if (!actionLoading) e.currentTarget.style.background = "#d32f2f"; }}
              onMouseLeave={(e) => { if (!actionLoading) e.currentTarget.style.background = "#f44336"; }}
            >
              {t("claimDetail.escalate")}
            </button>
            <button
              type="button"
              onClick={() => transition("approved")}
              disabled={actionLoading !== null}
              style={{
                padding: "8px 20px",
                background: actionLoading ? "#ccc" : "#4caf50",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: actionLoading ? "not-allowed" : "pointer",
                fontWeight: "500",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => { if (!actionLoading) e.currentTarget.style.background = "#43a047"; }}
              onMouseLeave={(e) => { if (!actionLoading) e.currentTarget.style.background = "#4caf50"; }}
            >
              {t("claimDetail.approve")}
            </button>
            <button
              type="button"
              onClick={() => transition("rejected")}
              disabled={actionLoading !== null}
              style={{
                padding: "8px 20px",
                background: actionLoading ? "#ccc" : "#757575",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: actionLoading ? "not-allowed" : "pointer",
                fontWeight: "500",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => { if (!actionLoading) e.currentTarget.style.background = "#616161"; }}
              onMouseLeave={(e) => { if (!actionLoading) e.currentTarget.style.background = "#757575"; }}
            >
              {t("claimDetail.reject")}
            </button>
          </div>
        </div>
      )}

      {/* Manager Escalation Actions (unchanged) */}
      {role === "manager" && String(c.status) === "escalated" && (
        <div style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          border: "1px solid #e8e8e8",
          borderTop: "4px solid #f44336"
        }}>
          <h2 style={{ margin: 0, marginBottom: "20px", fontSize: "18px", fontWeight: "600", color: "#1a1a1a", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>⚠️</span> {t("claimDetail.managerReview")}
          </h2>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => transition("approved")}
              disabled={actionLoading !== null}
              style={{
                padding: "10px 24px",
                background: actionLoading ? "#ccc" : "#4caf50",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: actionLoading ? "not-allowed" : "pointer",
                fontWeight: "500",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => { if (!actionLoading) e.currentTarget.style.background = "#43a047"; }}
              onMouseLeave={(e) => { if (!actionLoading) e.currentTarget.style.background = "#4caf50"; }}
            >
              {t("claimDetail.approveEscalation")}
            </button>
            <button
              type="button"
              onClick={() => transition("rejected")}
              disabled={actionLoading !== null}
              style={{
                padding: "10px 24px",
                background: actionLoading ? "#ccc" : "#f44336",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: actionLoading ? "not-allowed" : "pointer",
                fontWeight: "500",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => { if (!actionLoading) e.currentTarget.style.background = "#d32f2f"; }}
              onMouseLeave={(e) => { if (!actionLoading) e.currentTarget.style.background = "#f44336"; }}
            >
              {t("claimDetail.reject")}
            </button>
          </div>
        </div>
      )}

      {/* Accounting Actions (unchanged) */}
      {(role === "accounting_staff" || role === "manager") && String(c.status) === "approved" && (
        <div style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          border: "1px solid #e8e8e8"
        }}>
          <h2 style={{ margin: 0, marginBottom: "20px", fontSize: "18px", fontWeight: "600", color: "#1a1a1a", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>💰</span> {t("claimDetail.accountingDisbursement")}
          </h2>
          <button
            type="button"
            onClick={async () => {
              if (!id) return;
              setActionLoading("disbursement");
              try {
                await api(`/accounting/disbursements/from-claim/${id}`, {
                  method: "POST",
                  body: "{}",
                });
                setErrType("success");
                setErr(t("claimDetail.disbursementSuccess"));
                load();
                setTimeout(() => setErr(null), 3000);
              } catch (e) {
                setErrType("error");
                setErr(e instanceof Error ? e.message : t("claimDetail.disbursementFailed"));
              } finally {
                setActionLoading(null);
              }
            }}
            disabled={actionLoading !== null}
            style={{
              padding: "10px 24px",
              background: actionLoading ? "#ccc" : "#1976d2",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: actionLoading ? "not-allowed" : "pointer",
              fontWeight: "500",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => { if (!actionLoading) e.currentTarget.style.background = "#1565c0"; }}
            onMouseLeave={(e) => { if (!actionLoading) e.currentTarget.style.background = "#1976d2"; }}
          >
            {actionLoading === "disbursement" ? t("claimDetail.processing") : t("claimDetail.createDisbursement")}
          </button>
        </div>
      )}

      {/* Customer Submit Action (unchanged) */}
      {role === "customer" && String(c.status) === "draft" && (
        <div style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          border: "1px solid #e8e8e8"
        }}>
          <h2 style={{ margin: 0, marginBottom: "20px", fontSize: "18px", fontWeight: "600", color: "#1a1a1a", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>📤</span> {t("claimDetail.submitClaim")}
          </h2>
          <button
            type="button"
            onClick={async () => {
              if (!id) return;
              setActionLoading("submit");
              try {
                await api(`/claims/${id}/submit`, { method: "POST", body: "{}" });
                setErrType("success");
                setErr(t("claimDetail.submitSuccess"));
                load();
                setTimeout(() => setErr(null), 3000);
              } catch (e) {
                setErrType("error");
                setErr(e instanceof Error ? e.message : t("claimDetail.submitFailed"));
              } finally {
                setActionLoading(null);
              }
            }}
            disabled={actionLoading !== null}
            style={{
              padding: "10px 24px",
              background: actionLoading ? "#ccc" : "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: actionLoading ? "not-allowed" : "pointer",
              fontWeight: "500",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => { if (!actionLoading) e.currentTarget.style.background = "#43a047"; }}
            onMouseLeave={(e) => { if (!actionLoading) e.currentTarget.style.background = "#4caf50"; }}
          >
            {actionLoading === "submit" ? t("claimDetail.submitting") : t("claimDetail.submitClaimForReview")}
          </button>
        </div>
      )}

      {/* Documents Section with Download and Delete Buttons */}
<div style={{
  background: "white",
  borderRadius: "12px",
  padding: "24px",
  marginBottom: "24px",
  boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
  border: "1px solid #e8e8e8"
}}>
  <h2 style={{ margin: 0, marginBottom: "20px", fontSize: "18px", fontWeight: "600", color: "#1a1a1a", display: "flex", alignItems: "center", gap: "8px" }}>
    <span style={{ fontSize: "20px" }}>📎</span> {t("claimDetail.supportingDocuments")} ({data.documents.length})
    {isDraft && (
      <span style={{
        marginLeft: "12px",
        fontSize: "11px",
        padding: "2px 8px",
        borderRadius: "12px",
        background: "#fff3e0",
        color: "#e65100"
      }}>
        {t("claimDetail.canDelete") || "Can delete"}
      </span>
    )}
  </h2>
  
  {data.documents.length === 0 ? (
    <p style={{ color: "#666", textAlign: "center", padding: "40px", background: "#f8f9fa", borderRadius: "8px" }}>
      {t("claimDetail.noDocuments")}
    </p>
  ) : (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e8e8e8" }}>
            <th 
              style={{ padding: "12px", textAlign: "left", cursor: "pointer", color: "#1a1a1a" }}
              onClick={() => handleDocSort("name")}
            >
              {t("claimDetail.documentName")} {getDocSortIcon("name")}
            </th>
            <th 
              style={{ padding: "12px", textAlign: "right", cursor: "pointer", color: "#1a1a1a" }}
              onClick={() => handleDocSort("date")}
            >
              {t("claimDetail.uploadedDate")} {getDocSortIcon("date")}
            </th>
            <th style={{ padding: "12px", textAlign: "center", color: "#1a1a1a" }}>{t("claimDetail.action")}</th>
          </tr>
        </thead>
        <tbody>
          {sortedDocuments.map((d, idx) => (
            <tr key={d.id} style={{ borderBottom: idx === sortedDocuments.length - 1 ? "none" : "1px solid #f0f0f0" }}>
              <td style={{ padding: "12px", fontWeight: "500", color: "#1a1a1a" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px" }}>📄</span>
                  {d.original_name}
                </span>
              </td>
              <td style={{ padding: "12px", fontSize: "12px", color: "#666", textAlign: "right" }}>
                {d.created_at ? formatDate(d.created_at) : "N/A"}
              </td>
              <td style={{ padding: "12px", textAlign: "center" }}>
                <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                  {/* Download Button - Always visible */}
                  <button
                    type="button"
                    onClick={async () => {
                      const token = localStorage.getItem("jw_token");
                      const res = await fetch(
                        `/api/claims/${id}/documents/${d.id}/download`,
                        {
                          headers: token ? { Authorization: `Bearer ${token}` } : {},
                        }
                      );
                      if (!res.ok) return;
                      const blob = await res.blob();
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = d.original_name;
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }}
                    style={{
                      padding: "6px 16px",
                      background: "#1976d2",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "500",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#1565c0"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#1976d2"; }}
                  >
                    📥 {t("claimDetail.download")}
                  </button>
                  
                  {/* Delete Button - Only show for draft claims */}
                  {isDraft && (
                    <button
                      type="button"
                      onClick={() => deleteDocument(d.id, d.original_name)}
                      disabled={deletingDocId === d.id}
                      style={{
                        padding: "6px 16px",
                        background: deletingDocId === d.id ? "#ccc" : "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: deletingDocId === d.id ? "not-allowed" : "pointer",
                        fontSize: "12px",
                        fontWeight: "500",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                      onMouseEnter={(e) => { 
                        if (deletingDocId !== d.id) {
                          e.currentTarget.style.background = "#c82333"; 
                        }
                      }}
                      onMouseLeave={(e) => { 
                        if (deletingDocId !== d.id) {
                          e.currentTarget.style.background = "#dc3545"; 
                        }
                      }}
                    >
                      🗑️ {deletingDocId === d.id ? t("claimDetail.deleting") : t("claimDetail.delete")}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
  
  {/* Upload Document Form - Only show for draft claims */}
  {isDraft && (
    <form onSubmit={uploadFile} style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #e8e8e8" }}>
      <input
        ref={fileInputRef}
        type="file"
        name="file"
        required
        style={{
          flex: 1,
          padding: "10px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          fontSize: "14px",
          cursor: "pointer"
        }}
      />
      <button
        type="submit"
        disabled={uploading}
        style={{
          padding: "10px 24px",
          background: uploading ? "#ccc" : "#4caf50",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: uploading ? "not-allowed" : "pointer",
          fontWeight: "500"
        }}
        onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.background = "#43a047"; }}
        onMouseLeave={(e) => { if (!uploading) e.currentTarget.style.background = "#4caf50"; }}
      >
        {uploading ? t("claimDetail.uploading") : t("claimDetail.uploadDocument")}
      </button>
    </form>
  )}
</div>

      {/* Workflow History with Sorting */}
      <div style={{
        background: "white",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
        border: "1px solid #e8e8e8"
      }}>
        <h2 style={{ margin: 0, marginBottom: "20px", fontSize: "18px", fontWeight: "600", color: "#1a1a1a", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "20px" }}>📜</span> {t("claimDetail.workflowHistory")}
        </h2>
        {data.workflow.length === 0 ? (
          <p style={{ color: "#666", textAlign: "center", padding: "40px", background: "#f8f9fa", borderRadius: "8px" }}>
            {t("claimDetail.noWorkflowHistory")}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e8e8e8" }}>
                  <th 
                    style={{ padding: "12px", textAlign: "left", cursor: "pointer" }}
                    onClick={() => handleWorkflowSort("date")}
                  >
                    {t("claimDetail.dateTime")} {getWorkflowSortIcon("date")}
                  </th>
                  <th 
                    style={{ padding: "12px", textAlign: "left", cursor: "pointer" }}
                    onClick={() => handleWorkflowSort("action")}
                  >
                    {t("claimDetail.action")} {getWorkflowSortIcon("action")}
                  </th>
                  <th 
                    style={{ padding: "12px", textAlign: "left", cursor: "pointer" }}
                    onClick={() => handleWorkflowSort("from")}
                  >
                    {t("claimDetail.fromStatus")} {getWorkflowSortIcon("from")}
                  </th>
                  <th 
                    style={{ padding: "12px", textAlign: "left", cursor: "pointer" }}
                    onClick={() => handleWorkflowSort("to")}
                  >
                    {t("claimDetail.toStatus")} {getWorkflowSortIcon("to")}
                  </th>
                  <th 
                    style={{ padding: "12px", textAlign: "left", cursor: "pointer" }}
                    onClick={() => handleWorkflowSort("actor")}
                  >
                    {t("claimDetail.actor")} {getWorkflowSortIcon("actor")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedWorkflow.map((item, idx) => {
                  let actionText = "";
                  let fromStatus = item.from_status || "";
                  let toStatus = item.to_status || "";

                  if (item.action === "submit") {
                    actionText = t("claimDetail.claimSubmitted");
                    fromStatus = t("claims.draft");
                    toStatus = t("claims.submitted");
                  } else if (item.action === "transition") {
                    actionText = t("claimDetail.statusChanged");
                  } else if (item.action === "approve") {
                    actionText = t("claimDetail.claimApproved");
                  } else if (item.action === "reject") {
                    actionText = t("claimDetail.claimRejected");
                  } else if (item.action === "escalate") {
                    actionText = t("claimDetail.claimEscalated");
                  } else {
                    actionText = item.action?.replace(/_/g, ' ') || t("claimDetail.statusUpdate");
                  }

                  return (
                    <tr key={idx} style={{ borderBottom: idx === sortedWorkflow.length - 1 ? "none" : "1px solid #f0f0f0" }}>
                      <td style={{ padding: "12px", fontSize: "12px", color: "#666" }}>
                        {formatDate(item.created_at)}
                      </td>
                      <td style={{ padding: "12px", fontWeight: "500", color: "#1a1a1a" }}>
                        {actionText}
                      </td>
                      <td style={{ padding: "12px", fontSize: "13px", color: "#424242" }}>
                        {fromStatus ? capitalizeFirst(formatStatus(fromStatus)) : "-"}
                      </td>
                      <td style={{ padding: "12px", fontSize: "13px", color: "#424242" }}>
                        {capitalizeFirst(formatStatus(toStatus))}
                      </td>
                      <td style={{ padding: "12px", fontSize: "13px", color: "#424242" }}>
                        {item.actor_name || t("claimDetail.system")}
                      </td>
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
        marginTop: "24px",
        padding: "16px 20px",
        background: "#f8f9fa",
        borderRadius: "8px",
        border: "1px solid #e8e8e8",
        fontSize: "12px",
        color: "#666",
        textAlign: "center"
      }}>
        <span>🔒 {t("claimDetail.auditTrailEnabled")} | </span>
        <span>📋 {t("claimDetail.compliance")}: HKICPA, IFRS 17, HKFRS 17 | </span>
        <span>🕒 {t("claimDetail.lastUpdated")}: {new Date().toLocaleString('en-HK')}</span>
      </div>
    </div>
  );
}