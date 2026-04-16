import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";

interface NLQueryResult {
  filters: Record<string, unknown>;
  rows: Array<{
    id: string;
    reference_number: string;
    amount: number;
    currency: string;
    status: string;
    claimant: string;
    submitted_date: string;
    approval_status: string;
    [key: string]: unknown;
  }>;
  summary: string;
}

interface PredictionSummary {
  risk_score: number;
  total_claims: number;
  high_risk_claims: number;
  medium_risk_claims: number;
  low_risk_claims: number;
  predicted_fraud_probability: number;
  estimated_exposure: number;
  top_risk_factors: Array<{
    factor: string;
    impact: number;
    description: string;
  }>;
  recommendations: string[];
}

export function AIPage() {
  const { t } = useTranslation();
  const [chatIn, setChatIn] = useState("");
  const [chatOut, setChatOut] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatClaims, setChatClaims] = useState<any[] | null>(null);
  const [nlIn, setNlIn] = useState("");
  const [nlResult, setNlResult] = useState<NLQueryResult | null>(null);
  const [nlError, setNlError] = useState<string | null>(null);
  const [nlLoading, setNlLoading] = useState(false);
  const [pred, setPred] = useState<PredictionSummary | null>(null);
  const [predLoading, setPredLoading] = useState(false);

  async function chat(e: FormEvent) {
    e.preventDefault();
    const msg = chatIn.trim();
    if (!msg) {
      setChatError(t("ai.errors.typeQuestionFirst"));
      setChatOut("");
      setChatClaims(null);
      return;
    }
    setChatError(null);
    setChatBusy(true);
    setChatOut("");
    setChatClaims(null);
    
    try {
      const r = await api<{ reply: string; claims?: any[]; toolUsed?: string }>("/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message: msg }),
      });
      
      if (r.claims && r.claims.length > 0) {
        setChatClaims(r.claims);
      }
      
      setChatOut(r.reply ?? "");
      
      if (!r.reply?.trim()) {
        setChatError(t("ai.errors.emptyReply"));
      }
    } catch (err) {
      setChatOut("");
      setChatClaims(null);
      setChatError(
        err instanceof Error ? err.message : t("ai.errors.cannotReach"),
      );
    } finally {
      setChatBusy(false);
    }
  }

  async function nl(e: FormEvent) {
    e.preventDefault();
    setNlError(null);
    setNlLoading(true);
    setNlResult(null);
    try {
      const r = await api<NLQueryResult>("/ai/nl-query", {
        method: "POST",
        body: JSON.stringify({ query: nlIn }),
      });
      setNlResult(r);
    } catch (err) {
      setNlError(
        err instanceof Error ? err.message : t("ai.errors.nlQueryFailed"),
      );
    } finally {
      setNlLoading(false);
    }
  }

  const formatCurrency = (amount: number, currency: string = "HKD") => {
    return new Intl.NumberFormat('en-HK', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-HK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString || "N/A";
    }
  };

  const getRiskLevel = (score: number) => {
    if (score >= 70) return { label: t("ai.riskLevels.critical"), color: "#c62828", bg: "#ffebee", icon: "🔴" };
    if (score >= 50) return { label: t("ai.riskLevels.high"), color: "#f57c00", bg: "#fff3e0", icon: "🟠" };
    if (score >= 25) return { label: t("ai.riskLevels.medium"), color: "#f9a825", bg: "#fff9c4", icon: "🟡" };
    return { label: t("ai.riskLevels.low"), color: "#2e7d32", bg: "#e8f5e9", icon: "🟢" };
  };

  const getPriorityLabel = (impact: number) => {
    if (impact >= 70) return t("ai.priority.high");
    if (impact >= 40) return t("ai.priority.medium");
    return t("ai.priority.low");
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
        padding: "4px 12px",
        borderRadius: "16px",
        fontSize: "12px",
        fontWeight: "600",
        background: style.bg,
        color: style.color
      }}>
        {style.icon} {status}
      </span>
    );
  };

  const getRiskBadge = (score: number) => {
    if (score >= 70) return { bg: "#ffebee", color: "#c62828", label: t("claims.highRisk") };
    if (score >= 40) return { bg: "#fff3e0", color: "#f57c00", label: t("claims.mediumRisk") };
    if (score > 0) return { bg: "#e8f5e9", color: "#2e7d32", label: t("claims.lowRisk") };
    return null;
  };

  // Function to download the risk assessment report
  const downloadRiskReport = () => {
    if (!pred) {
      alert(t("ai.noRiskAssessment"));
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>AI Risk Assessment Report</title>
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            margin: 40px;
            color: #333;
            line-height: 1.6;
          }
          h1 {
            color: #1a237e;
            border-bottom: 2px solid #1a237e;
            padding-bottom: 10px;
          }
          h2 {
            color: #283593;
            margin-top: 30px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 8px;
          }
          h3 {
            color: #1a237e;
            margin-top: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          th {
            background: #1a237e;
            color: white;
            padding: 10px;
            text-align: left;
          }
          td {
            padding: 8px;
            border-bottom: 1px solid #ddd;
          }
          .summary-card {
            background: linear-gradient(135deg, #1a237e 0%, #283593 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
          }
          .risk-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            border-left: 4px solid #667eea;
          }
          .risk-high {
            border-left-color: #c62828;
          }
          .risk-medium {
            border-left-color: #f57c00;
          }
          .risk-low {
            border-left-color: #2e7d32;
          }
          .footer {
            margin-top: 40px;
            font-size: 12px;
            color: #666;
            text-align: center;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
          .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
          }
          .badge-critical { background: #ffebee; color: #c62828; }
          .badge-high { background: #fff3e0; color: #f57c00; }
          .badge-medium { background: #fff9c4; color: #f9a825; }
          .badge-low { background: #e8f5e9; color: #2e7d32; }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin: 20px 0;
          }
          .stat-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .stat-value {
            font-size: 28px;
            font-weight: bold;
            color: #1976d2;
          }
        </style>
      </head>
      <body>
        <h1>🤖 AI Risk Assessment Report</h1>
        <p>Generated: ${new Date().toLocaleString()} | Report ID: AI-${Date.now()}</p>
        
        <div class="summary-card">
          <h2 style="color: white; margin-top: 0;">Executive Summary</h2>
          <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
            <div>
              <div style="font-size: 12px; opacity: 0.8;">Overall Enterprise Risk Score</div>
              <div style="font-size: 48px; font-weight: bold;">${pred.risk_score}%</div>
              <div class="badge badge-${pred.risk_score >= 70 ? 'critical' : pred.risk_score >= 50 ? 'high' : pred.risk_score >= 25 ? 'medium' : 'low'}">
                ${getRiskLevel(pred.risk_score).icon} ${getRiskLevel(pred.risk_score).label} Risk Level
              </div>
            </div>
            <div>
              <div style="font-size: 12px; opacity: 0.8;">Total Claims</div>
              <div style="font-size: 32px; font-weight: bold;">${pred.total_claims.toLocaleString()}</div>
            </div>
            <div>
              <div style="font-size: 12px; opacity: 0.8;">High Risk Claims</div>
              <div style="font-size: 32px; font-weight: bold; color: #ff7043;">${pred.high_risk_claims}</div>
            </div>
            <div>
              <div style="font-size: 12px; opacity: 0.8;">Estimated Exposure</div>
              <div style="font-size: 24px; font-weight: bold;">${formatCurrency(pred.estimated_exposure)}</div>
            </div>
            <div>
              <div style="font-size: 12px; opacity: 0.8;">Fraud Probability</div>
              <div style="font-size: 24px; font-weight: bold;">${(pred.predicted_fraud_probability * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
        
        <h2>Risk Distribution</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div>High Risk</div>
            <div class="stat-value" style="color: #c62828;">${pred.high_risk_claims}</div>
            <div>${pred.total_claims > 0 ? ((pred.high_risk_claims / pred.total_claims) * 100).toFixed(1) : 0}% of total</div>
          </div>
          <div class="stat-card">
            <div>Medium Risk</div>
            <div class="stat-value" style="color: #f57c00;">${pred.medium_risk_claims}</div>
            <div>${pred.total_claims > 0 ? ((pred.medium_risk_claims / pred.total_claims) * 100).toFixed(1) : 0}% of total</div>
          </div>
          <div class="stat-card">
            <div>Low Risk</div>
            <div class="stat-value" style="color: #2e7d32;">${pred.low_risk_claims}</div>
            <div>${pred.total_claims > 0 ? ((pred.low_risk_claims / pred.total_claims) * 100).toFixed(1) : 0}% of total</div>
          </div>
        </div>
        
        <h2>Top Risk Factors</h2>
        <table>
          <thead>
            <tr><th>Risk Factor</th><th>Impact Score</th><th>Description</th><th>Priority</th></tr>
          </thead>
          <tbody>
            ${pred.top_risk_factors?.map(factor => `
              <tr>
                <td>${factor.factor}</td>
                <td><span class="badge badge-${factor.impact >= 70 ? 'critical' : factor.impact >= 40 ? 'high' : 'medium'}">${factor.impact}%</span></td>
                <td>${factor.description}</td>
                <td>${getPriorityLabel(factor.impact)}</td>
              </tr>
            `).join('') || ''}
          </tbody>
        </table>
        
        <h2>AI Recommendations</h2>
        <div class="risk-card">
          <ul>
            ${pred.recommendations?.map(rec => `<li>${rec}</li>`).join('') || '<li>No recommendations at this time</li>'}
          </ul>
        </div>
        
        <div class="footer">
          <p>This report is AI-generated based on claims data analysis.</p>
          <p>JeffreyWoo Insurance Claims System | ${new Date().getFullYear()}</p>
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_risk_report_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderClaimsTable = (claims: any[]) => {
    if (!claims || claims.length === 0) return null;
    
    return (
      <div style={{ marginTop: "20px" }}>
        <div style={{ 
          fontSize: "13px", 
          fontWeight: "600", 
          color: "#666", 
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <span>📋</span> 
          {t("ai.results")} ({claims.length} {t("ai.claimsFound")})
        </div>
        <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #e8e8e8" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
            <thead>
              <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e8e8e8" }}>
                <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("claims.reference")}</th>
                <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("claims.customer")}</th>
                <th style={{ padding: "12px", textAlign: "right", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("claims.amount")}</th>
                <th style={{ padding: "12px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("claims.status")}</th>
                <th style={{ padding: "12px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("claims.risk")}</th>
                <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("claims.submittedDate")}</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim, idx) => {
                const riskBadge = getRiskBadge(claim.fraud_risk_score);
                return (
                  <tr key={claim.id || idx} style={{ borderBottom: idx === claims.length - 1 ? "none" : "1px solid #f0f0f0" }}>
                    <td style={{ padding: "12px", fontWeight: "500", fontSize: "13px", color: "#1a1a1a" }}>
                      {claim.reference_number}
                    </td>
                    <td style={{ padding: "12px", fontSize: "13px", color: "#424242" }}>
                      {claim.customer_name || "N/A"}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: "600", fontSize: "13px", color: "#1a1a1a" }}>
                      {formatCurrency(claim.claimed_amount, claim.currency)}
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      {getStatusBadge(claim.status)}
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
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
                          {riskBadge.label}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px", fontSize: "12px", color: "#666" }}>
                      {formatDate(claim.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
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
          {t("ai.title")}
        </h1>
        <p style={{ color: "#5a5a5a", margin: 0, fontSize: "14px" }}>
          {t("ai.subtitle")}
        </p>
      </div>

      {/* Conversational Assistant */}
      <div style={{ marginBottom: "32px", background: "white", borderRadius: "12px", border: "1px solid #e8e8e8", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div style={{ 
              width: "40px", 
              height: "40px", 
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
              borderRadius: "10px", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              fontSize: "20px"
            }}>
              🤖
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#1a1a1a" }}>{t("ai.conversationalAssistant")}</h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#666" }}>{t("ai.askAbout")}</p>
            </div>
          </div>
          
          <div style={{ marginBottom: "16px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "#666" }}>Try:</span>
            <button
              type="button"
              onClick={() => setChatIn("Show me all submitted claims over HK$10,000")}
              style={{ background: "#f0f2f5", border: "1px solid #ddd", borderRadius: "16px", padding: "4px 12px", fontSize: "11px", cursor: "pointer" }}
            >
              📋 Submitted claims &gt; HK$10k
            </button>
            <button
              type="button"
              onClick={() => setChatIn("How many claims were approved this month?")}
              style={{ background: "#f0f2f5", border: "1px solid #ddd", borderRadius: "16px", padding: "4px 12px", fontSize: "11px", cursor: "pointer" }}
            >
              📊 Approved claims this month
            </button>
            <button
              type="button"
              onClick={() => setChatIn("What are the high-risk claims?")}
              style={{ background: "#f0f2f5", border: "1px solid #ddd", borderRadius: "16px", padding: "4px 12px", fontSize: "11px", cursor: "pointer" }}
            >
              ⚠️ High-risk claims
            </button>
            <button
              type="button"
              onClick={() => setChatIn("Show me pending payments")}
              style={{ background: "#f0f2f5", border: "1px solid #ddd", borderRadius: "16px", padding: "4px 12px", fontSize: "11px", cursor: "pointer" }}
            >
              💰 Pending payments
            </button>
          </div>
          
          <form onSubmit={chat}>
            <textarea
              value={chatIn}
              onChange={(e) => setChatIn(e.target.value)}
              rows={3}
              placeholder={t("ai.chatPlaceholder")}
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: "14px",
                fontFamily: "inherit",
                border: "1px solid #ddd",
                borderRadius: "8px",
                marginBottom: "16px",
                resize: "vertical",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#667eea"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#ddd"; }}
            />
            <button
              type="submit"
              disabled={chatBusy}
              style={{
                padding: "10px 24px",
                background: chatBusy ? "#ccc" : "#1976d2",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: chatBusy ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "500",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => { if (!chatBusy) e.currentTarget.style.background = "#1565c0"; }}
              onMouseLeave={(e) => { if (!chatBusy) e.currentTarget.style.background = "#1976d2"; }}
            >
              {chatBusy ? t("ai.processing") : t("ai.sendMessage")}
            </button>
          </form>
          
          {chatError && (
            <div style={{ marginTop: "16px", padding: "12px 16px", background: "#ffebee", borderRadius: "8px", color: "#c62828", fontSize: "13px" }}>
              {chatError}
            </div>
          )}
          
          {chatOut && (
            <div style={{ marginTop: "20px" }}>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {t("ai.response")}
              </div>
              <div style={{
                padding: "16px",
                background: "#f8f9fa",
                borderRadius: "8px",
                lineHeight: "1.6",
                fontSize: "14px",
                color: "#1a1a1a",
                border: "1px solid #e8e8e8",
                whiteSpace: "pre-wrap"
              }}>
                {chatOut}
              </div>
              {chatClaims && renderClaimsTable(chatClaims)}
            </div>
          )}
        </div>
      </div>

      {/* Natural Language Claims Query */}
      <div style={{ marginBottom: "32px", background: "white", borderRadius: "12px", border: "1px solid #e8e8e8", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div style={{ 
              width: "40px", 
              height: "40px", 
              background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", 
              borderRadius: "10px", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              fontSize: "20px"
            }}>
              🔍
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#1a1a1a" }}>{t("ai.naturalLanguageQuery")}</h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#666" }}>{t("ai.naturalLanguageDesc")}</p>
            </div>
          </div>
          
          <form onSubmit={nl}>
            <textarea
              value={nlIn}
              onChange={(e) => setNlIn(e.target.value)}
              rows={3}
              placeholder={t("ai.queryPlaceholder")}
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: "14px",
                fontFamily: "inherit",
                border: "1px solid #ddd",
                borderRadius: "8px",
                marginBottom: "16px",
                resize: "vertical",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#4facfe"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#ddd"; }}
            />
            <button
              type="submit"
              disabled={nlLoading}
              style={{
                padding: "10px 24px",
                background: nlLoading ? "#ccc" : "#4caf50",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: nlLoading ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "500",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => { if (!nlLoading) e.currentTarget.style.background = "#43a047"; }}
              onMouseLeave={(e) => { if (!nlLoading) e.currentTarget.style.background = "#4caf50"; }}
            >
              {nlLoading ? t("ai.processingQuery") : t("ai.executeQuery")}
            </button>
          </form>

          {nlError && (
            <div style={{ marginTop: "16px", padding: "12px 16px", background: "#ffebee", borderRadius: "8px", color: "#c62828", fontSize: "13px" }}>
              {nlError}
            </div>
          )}

          {nlResult && (
            <div style={{ marginTop: "24px" }}>
              <div style={{
                padding: "16px",
                background: "#e3f2fd",
                borderRadius: "8px",
                marginBottom: "20px",
                borderLeft: "4px solid #1976d2"
              }}>
                <div style={{ fontWeight: "600", marginBottom: "8px", color: "#0d47a1", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {t("ai.queryInterpretation")}
                </div>
                <div style={{ fontSize: "14px", lineHeight: "1.5", color: "#1a1a1a" }}>{nlResult.summary}</div>
              </div>

              {nlResult.filters && Object.keys(nlResult.filters).length > 0 && (
                <div style={{
                  padding: "12px 16px",
                  background: "#fff8e1",
                  borderRadius: "8px",
                  marginBottom: "20px",
                  border: "1px solid #ffe082"
                }}>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "#e65100", marginBottom: "8px" }}>{t("ai.appliedFilters")}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {Object.entries(nlResult.filters).map(([key, value]) => (
                      <span key={key} style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "#ff9800",
                        color: "white",
                        padding: "4px 12px",
                        borderRadius: "20px",
                        fontSize: "11px",
                        fontWeight: "500"
                      }}>
                        {key}: {String(value)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {nlResult.rows && nlResult.rows.length > 0 ? (
                <>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#666", marginBottom: "12px" }}>
                    {t("ai.results")} ({nlResult.rows.length} {t("ai.claimsFound")})
                  </div>
                  <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #e8e8e8" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
                      <thead>
                        <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e8e8e8" }}>
                          <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("claims.reference")}</th>
                          <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("claims.customer")}</th>
                          <th style={{ padding: "12px", textAlign: "right", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("claims.amount")}</th>
                          <th style={{ padding: "12px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("claims.status")}</th>
                          <th style={{ padding: "12px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("claims.approval")}</th>
                          <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("claims.submittedDate")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nlResult.rows.map((row, idx) => (
                          <tr key={row.id || idx} style={{ borderBottom: idx === nlResult.rows.length - 1 ? "none" : "1px solid #f0f0f0" }}>
                            <td style={{ padding: "12px", fontWeight: "500", fontSize: "13px", color: "#1a1a1a" }}>{row.reference_number}</td>
                            <td style={{ padding: "12px", fontSize: "13px", color: "#424242" }}>{row.claimant}</td>
                            <td style={{ padding: "12px", textAlign: "right", fontWeight: "600", fontSize: "13px", color: "#1a1a1a" }}>
                              {formatCurrency(row.amount as number, row.currency as string)}
                            </td>
                            <td style={{ padding: "12px", textAlign: "center" }}>{getStatusBadge(row.status as string)}</td>
                            <td style={{ padding: "12px", textAlign: "center" }}>{getStatusBadge(row.approval_status as string)}</td>
                            <td style={{ padding: "12px", fontSize: "12px", color: "#666" }}>{formatDate(row.submitted_date as string)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "48px", color: "#666", background: "#f8f9fa", borderRadius: "8px" }}>
                  {t("ai.noClaimsFound")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Predictive Risk Summary */}
      <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e8e8e8", boxShadow: "0 2px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ 
                width: "40px", 
                height: "40px", 
                background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", 
                borderRadius: "10px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                fontSize: "20px"
              }}>
                📊
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#1a1a1a" }}>{t("ai.predictiveRiskAssessment")}</h2>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#666" }}>{t("ai.predictiveRiskDesc")}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              {pred && (
                <button
                  type="button"
                  onClick={downloadRiskReport}
                  style={{
                    padding: "8px 20px",
                    background: "#4caf50",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "500",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#43a047"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#4caf50"; }}
                >
                  📥 Download Report
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  setPredLoading(true);
                  try {
                    const r = await api<PredictionSummary>("/ai/predictions/summary");
                    setPred(r);
                  } catch (error) {
                    console.error("Failed to load predictions:", error);
                  } finally {
                    setPredLoading(false);
                  }
                }}
                style={{
                  padding: "8px 20px",
                  background: "#ff9800",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "500",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f57c00"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#ff9800"; }}
              >
                {predLoading ? t("ai.analyzing") : t("ai.refreshAnalysis")}
              </button>
            </div>
          </div>

          {pred ? (
            <div>
              {/* Executive Summary Card */}
              <div style={{
                background: "linear-gradient(135deg, #1a237e 0%, #283593 100%)",
                borderRadius: "12px",
                padding: "28px",
                marginBottom: "24px",
                color: "white"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
                  <div>
                    <div style={{ fontSize: "12px", opacity: 0.8, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
                      {t("ai.overallEnterpriseRiskScore")}
                    </div>
                    <div style={{ fontSize: "56px", fontWeight: "bold", lineHeight: 1 }}>
                      {pred.risk_score}%
                    </div>
                    <div style={{ 
                      display: "inline-block", 
                      marginTop: "12px",
                      padding: "6px 16px",
                      borderRadius: "20px",
                      background: getRiskLevel(pred.risk_score).bg,
                      color: getRiskLevel(pred.risk_score).color,
                      fontSize: "13px",
                      fontWeight: "600"
                    }}>
                      {getRiskLevel(pred.risk_score).icon} {getRiskLevel(pred.risk_score).label} {t("ai.riskLevelSuffix")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "11px", opacity: 0.7 }}>{t("ai.totalClaims")}</div>
                      <div style={{ fontSize: "28px", fontWeight: "bold" }}>{pred.total_claims.toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "11px", opacity: 0.7 }}>{t("ai.highRiskClaims")}</div>
                      <div style={{ fontSize: "28px", fontWeight: "bold", color: "#ff7043" }}>{pred.high_risk_claims}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "11px", opacity: 0.7 }}>{t("ai.exposure")}</div>
                      <div style={{ fontSize: "24px", fontWeight: "bold" }}>{formatCurrency(pred.estimated_exposure)}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "11px", opacity: 0.7 }}>{t("ai.fraudProbability")}</div>
                      <div style={{ fontSize: "24px", fontWeight: "bold" }}>{(pred.predicted_fraud_probability * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk Distribution Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "24px" }}>
                <div style={{ background: "#f8f9fa", borderRadius: "10px", padding: "20px", border: "1px solid #e8e8e8" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>📊</span> {t("ai.riskDistribution")}
                  </div>
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "12px", color: "#666" }}>{t("ai.riskLevels.high")}</span>
                      <span style={{ fontSize: "14px", fontWeight: "600", color: "#c62828" }}>{pred.high_risk_claims}</span>
                    </div>
                    <div style={{ background: "#e0e0e0", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${(pred.high_risk_claims / Math.max(pred.total_claims, 1)) * 100}%`, height: "100%", background: "#c62828" }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "12px", color: "#666" }}>{t("ai.riskLevels.medium")}</span>
                      <span style={{ fontSize: "14px", fontWeight: "600", color: "#f57c00" }}>{pred.medium_risk_claims}</span>
                    </div>
                    <div style={{ background: "#e0e0e0", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${(pred.medium_risk_claims / Math.max(pred.total_claims, 1)) * 100}%`, height: "100%", background: "#f57c00" }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "12px", color: "#666" }}>{t("ai.riskLevels.low")}</span>
                      <span style={{ fontSize: "14px", fontWeight: "600", color: "#2e7d32" }}>{pred.low_risk_claims}</span>
                    </div>
                    <div style={{ background: "#e0e0e0", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${(pred.low_risk_claims / Math.max(pred.total_claims, 1)) * 100}%`, height: "100%", background: "#2e7d32" }} />
                    </div>
                  </div>
                </div>

                <div style={{ background: "#f8f9fa", borderRadius: "10px", padding: "20px", border: "1px solid #e8e8e8" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>💰</span> {t("ai.financialImpact")}
                  </div>
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ fontSize: "11px", color: "#666" }}>{t("ai.estimatedExposure")}</div>
                    <div style={{ fontSize: "24px", fontWeight: "700", color: "#c62828" }}>{formatCurrency(pred.estimated_exposure)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#666" }}>{t("ai.highRiskValue")}</div>
                    <div style={{ fontSize: "20px", fontWeight: "600", color: "#f57c00" }}>
                      {formatCurrency(pred.estimated_exposure * (pred.high_risk_claims / Math.max(pred.total_claims, 1)))}
                    </div>
                  </div>
                </div>

                <div style={{ background: "linear-gradient(135deg, #667eea15 0%, #764ba215 100%)", borderRadius: "10px", padding: "20px", border: "1px solid #667eea30" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>🎯</span> {t("ai.fraudDetectionMetrics")}
                  </div>
                  <div style={{ textAlign: "center", marginBottom: "16px" }}>
                    <div style={{ fontSize: "36px", fontWeight: "bold", color: "#667eea" }}>
                      {(pred.predicted_fraud_probability * 100).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>{t("ai.predictedFraudRate")}</div>
                  </div>
                  <div style={{ background: "white", borderRadius: "6px", padding: "12px" }}>
                    <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}>{t("ai.riskScoreRange")}</div>
                    <div style={{ fontSize: "18px", fontWeight: "600", color: "#1a1a1a" }}>
                      {pred.risk_score >= 70 ? "70-100" : pred.risk_score >= 40 ? "40-69" : "0-39"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Risk Factors Table */}
              {pred.top_risk_factors && pred.top_risk_factors.length > 0 && (
                <div style={{ marginBottom: "24px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#1a1a1a", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>⚠️</span> {t("ai.topRiskFactors")}
                  </h3>
                  <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #e8e8e8", background: "white" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e8e8e8" }}>
                          <th style={{ padding: "14px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("ai.riskFactor")}</th>
                          <th style={{ padding: "14px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("ai.impactScore")}</th>
                          <th style={{ padding: "14px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("ai.description")}</th>
                          <th style={{ padding: "14px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{t("ai.priorityColumn")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pred.top_risk_factors.map((factor, idx) => {
                          const priority = getPriorityLabel(factor.impact);
                          const priorityColor = factor.impact >= 70 ? "#c62828" : factor.impact >= 40 ? "#f57c00" : "#2e7d32";
                          return (
                            <tr key={idx} style={{ borderBottom: idx === pred.top_risk_factors.length - 1 ? "none" : "1px solid #f0f0f0" }}>
                              <td style={{ padding: "14px", fontWeight: "500", fontSize: "13px", color: "#1a1a1a" }}>{factor.factor}</td>
                              <td style={{ padding: "14px", textAlign: "center" }}>
                                <div style={{
                                  display: "inline-block",
                                  padding: "4px 12px",
                                  borderRadius: "20px",
                                  background: factor.impact >= 70 ? "#ffebee" : factor.impact >= 40 ? "#fff3e0" : "#e8f5e9",
                                  color: factor.impact >= 70 ? "#c62828" : factor.impact >= 40 ? "#f57c00" : "#2e7d32",
                                  fontWeight: "600",
                                  fontSize: "13px"
                                }}>
                                  {factor.impact}%
                                </div>
                              </td>
                              <td style={{ padding: "14px", fontSize: "13px", color: "#424242" }}>{factor.description}</td>
                              <td style={{ padding: "14px", textAlign: "center" }}>
                                <span style={{
                                  display: "inline-block",
                                  padding: "4px 12px",
                                  borderRadius: "20px",
                                  background: priority === t("ai.priority.high") ? "#ffebee" : priority === t("ai.priority.medium") ? "#fff3e0" : "#e8f5e9",
                                  color: priorityColor,
                                  fontSize: "11px",
                                  fontWeight: "600"
                                }}>
                                  {priority}
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

              {/* AI Recommendations */}
              {pred.recommendations && pred.recommendations.length > 0 && (
                <div style={{
                  padding: "20px",
                  background: "#e8eaf6",
                  borderRadius: "12px",
                  borderLeft: "4px solid #5e35b1"
                }}>
                  <div style={{ fontWeight: "600", marginBottom: "16px", color: "#5e35b1", fontSize: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <span>💡</span> {t("ai.aiRecommendations")}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px" }}>
                    {pred.recommendations.map((rec, idx) => (
                      <div key={idx} style={{
                        padding: "12px 16px",
                        background: "white",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        border: "1px solid #d1c4e9"
                      }}>
                        <span style={{ fontSize: "18px" }}>{idx === 0 ? "🔴" : idx === 1 ? "🟡" : "🟢"}</span>
                        <span style={{ fontSize: "13px", color: "#1a1a1a", lineHeight: "1.4" }}>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : predLoading ? (
            <div style={{ textAlign: "center", padding: "60px", color: "#666", background: "#f8f9fa", borderRadius: "8px" }}>
              <div style={{ width: "40px", height: "40px", border: "3px solid #e0e0e0", borderTopColor: "#667eea", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }}></div>
              <div style={{ fontSize: "14px" }}>{t("ai.analyzingData")}</div>
              <div style={{ fontSize: "12px", color: "#999", marginTop: "8px" }}>{t("ai.runningModels")}</div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "60px", color: "#666", background: "#f8f9fa", borderRadius: "8px" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🤖</div>
              <div style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px" }}>{t("ai.noRiskAssessment")}</div>
              <div style={{ fontSize: "13px", color: "#999" }}>{t("ai.clickRefreshToGenerate")}</div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
