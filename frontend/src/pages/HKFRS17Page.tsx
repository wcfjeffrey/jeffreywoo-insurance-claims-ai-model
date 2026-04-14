import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

interface Contract {
  id: string;
  contract_number: string;
  policy_number: string;
  customer_name: string;
  coverage_start_date: string;
  coverage_end_date: string;
  premium_amount: number;
  premium_currency: string;
  liability_for_remaining_coverage: number;
  liability_for_incurred_claims: number;
  risk_adjustment: number;
  discount_rate: number;
}

interface Measurement {
  id: string;
  measurement_date: string;
  pv_of_future_cashflows: number;
  risk_adjustment: number;
  contractual_service_margin: number;
  fulfillment_cashflows: number;
  insurance_revenue: number;
  insurance_service_expenses: number;
}

interface ComplianceStatus {
  compliance_status: string;
  last_assessment_date: string;
  next_assessment_date: string;
  total_contracts?: number;
  total_lrc?: number;
  total_lic?: number;
  total_risk_adj?: number;
}

type SortField = "contract_number" | "policy_number" | "customer" | "lrc" | "lic" | "risk_adj";
type SortOrder = "asc" | "desc";

function toNumber(value: any): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function formatCurrency(amount: number | undefined | null, currency: string = "HKD"): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return `HK$0.00`;
  }
  return new Intl.NumberFormat('en-HK', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string): string {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString('en-HK');
  } catch {
    return "Invalid Date";
  }
}

function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function HKFRS17Page(): React.ReactElement {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("contract_number");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [lrcFilter, setLrcFilter] = useState<string>("all");

  // Helper function to translate compliance status
  const getTranslatedComplianceStatus = (status: string): string => {
    if (!status) return t("compliance.unknown");
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === "fully compliant" || lowerStatus === "fully_compliant" || lowerStatus === "fully compliant") {
      return t("hkfrs17.fullyCompliant");
    }
    if (lowerStatus === "partially compliant" || lowerStatus === "partially_compliant") {
      return t("compliance.partiallyCompliant");
    }
    if (lowerStatus === "non compliant" || lowerStatus === "non_compliant") {
      return t("compliance.nonCompliant");
    }
    return status;
  };

  useEffect(() => {
    async function fetchData(): Promise<void> {
      try {
        setLoading(true);
        setError(null);
        
        const contractsResponse = await api<{ contracts: Contract[] }>("/hkfrs17/contracts");
        
        if (contractsResponse && contractsResponse.contracts) {
          setContracts(contractsResponse.contracts);
        } else {
          setContracts([]);
        }
        
        try {
          const measurementsResponse = await api<{ measurements: Measurement[] }>("/hkfrs17/measurements");
          if (measurementsResponse && measurementsResponse.measurements) {
            setMeasurements(measurementsResponse.measurements);
          }
        } catch (err) {
          setMeasurements([]);
        }
        
        try {
          const complianceResponse = await api<ComplianceStatus>("/hkfrs17/compliance-summary");
          if (complianceResponse) {
            setComplianceStatus(complianceResponse);
          }
        } catch (err) {
          // No compliance summary
        }
        
      } catch (error) {
        console.error("Failed to fetch HKFRS 17 data:", error);
        setError(t("hkfrs17.fetchError"));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [t]);

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

  const getFilteredAndSortedContracts = () => {
    let filtered = [...contracts];
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.contract_number?.toLowerCase().includes(searchLower) ||
        c.policy_number?.toLowerCase().includes(searchLower) ||
        c.customer_name?.toLowerCase().includes(searchLower)
      );
    }
    
    if (lrcFilter !== "all") {
      if (lrcFilter === "high") {
        filtered = filtered.filter(c => toNumber(c.liability_for_remaining_coverage) > 10000);
      } else if (lrcFilter === "medium") {
        filtered = filtered.filter(c => toNumber(c.liability_for_remaining_coverage) >= 5000 && toNumber(c.liability_for_remaining_coverage) <= 10000);
      } else if (lrcFilter === "low") {
        filtered = filtered.filter(c => toNumber(c.liability_for_remaining_coverage) < 5000);
      }
    }
    
    return filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "contract_number":
          aVal = a.contract_number;
          bVal = b.contract_number;
          break;
        case "policy_number":
          aVal = a.policy_number;
          bVal = b.policy_number;
          break;
        case "customer":
          aVal = a.customer_name;
          bVal = b.customer_name;
          break;
        case "lrc":
          aVal = toNumber(a.liability_for_remaining_coverage);
          bVal = toNumber(b.liability_for_remaining_coverage);
          break;
        case "lic":
          aVal = toNumber(a.liability_for_incurred_claims);
          bVal = toNumber(b.liability_for_incurred_claims);
          break;
        case "risk_adj":
          aVal = toNumber(a.risk_adjustment);
          bVal = toNumber(b.risk_adjustment);
          break;
        default:
          aVal = a.contract_number;
          bVal = b.contract_number;
      }
      
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  };

  const downloadReport = () => {
    const totalLRC = contracts.reduce((sum, c) => sum + toNumber(c.liability_for_remaining_coverage), 0);
    const totalLIC = contracts.reduce((sum, c) => sum + toNumber(c.liability_for_incurred_claims), 0);
    const totalRiskAdj = contracts.reduce((sum, c) => sum + toNumber(c.risk_adjustment), 0);
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${t("hkfrs17.reportTitle")}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #333; }
          h1 { color: #1a237e; border-bottom: 2px solid #1a237e; padding-bottom: 10px; }
          h2 { color: #283593; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th { background: #1a237e; color: white; padding: 10px; text-align: left; }
          td { padding: 8px; border-bottom: 1px solid #ddd; }
          .summary-card { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
        </style>
      </head>
      <body>
        <h1>${t("hkfrs17.reportTitle")}</h1>
        <p>${t("hkfrs17.generatedLabel")}: ${new Date().toLocaleString()} | ${t("hkfrs17.generatedBy")}: ${user?.fullName || "System"}</p>
        
        <div class="summary-card">
          <h2>${t("hkfrs17.executiveSummary")}</h2>
          <p><strong>${t("hkfrs17.complianceStatus")}:</strong> ${complianceStatus ? getTranslatedComplianceStatus(complianceStatus.compliance_status) : "Unknown"}</p>
          <p><strong>${t("hkfrs17.totalContracts")}:</strong> ${contracts.length}</p>
          <p><strong>${t("hkfrs17.totalLrc")}:</strong> ${formatCurrency(totalLRC)}</p>
          <p><strong>${t("hkfrs17.totalLic")}:</strong> ${formatCurrency(totalLIC)}</p>
          <p><strong>${t("hkfrs17.totalRiskAdjustment")}:</strong> ${formatCurrency(totalRiskAdj)}</p>
        </div>
        
        <h2>${t("hkfrs17.insuranceContracts")}</h2>
        <table>
          <thead>
            <tr><th>${t("hkfrs17.contractNumber")}</th><th>${t("hkfrs17.policyNumber")}</th><th>${t("hkfrs17.customer")}</th><th>${t("hkfrs17.premium")}</th><th>${t("hkfrs17.lrc")}</th><th>${t("hkfrs17.lic")}</th><th>${t("hkfrs17.riskAdj")}</th></tr>
          </thead>
          <tbody>
            ${contracts.map(c => `
              <tr>
                <td>${c.contract_number}</td>
                <td>${c.policy_number}</td>
                <td>${c.customer_name || "N/A"}</td>
                <td>${formatCurrency(c.premium_amount)}</td>
                <td>${formatCurrency(c.liability_for_remaining_coverage)}</td>
                <td>${formatCurrency(c.liability_for_incurred_claims)}</td>
                <td>${formatCurrency(c.risk_adjustment)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>${t("hkfrs17.footerText")}</p>
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hkfrs17_compliance_report_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalLRC = contracts.reduce((sum, c) => sum + toNumber(c.liability_for_remaining_coverage), 0);
  const totalLIC = contracts.reduce((sum, c) => sum + toNumber(c.liability_for_incurred_claims), 0);
  const totalRiskAdj = contracts.reduce((sum, c) => sum + toNumber(c.risk_adjustment), 0);
  const filteredContracts = getFilteredAndSortedContracts();

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>{t("hkfrs17.loading")}</div>;
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1600px", margin: "0 auto", background: "#f0f2f5", minHeight: "100vh", fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif" }}>
      {/* Header with Download Button */}
      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "600", color: "#1a1a1a", marginBottom: "8px" }}>
            {t("hkfrs17.title")}
          </h1>
          <p style={{ color: "#5a5a5a", fontSize: "14px" }}>
            {t("hkfrs17.subtitle")}
          </p>
        </div>
        <button
          onClick={downloadReport}
          style={{
            padding: "10px 20px",
            background: "#4caf50",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#43a047"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#4caf50"; }}
        >
          📥 {t("hkfrs17.downloadReport")}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: "12px", padding: "8px 16px", background: "#ffebee", borderRadius: "8px", fontSize: "12px", color: "#c62828", marginBottom: "24px" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Compliance Status Banner - with translation */}
      {complianceStatus && (
        <div style={{ background: "linear-gradient(135deg, #1a237e 0%, #283593 100%)", borderRadius: "12px", padding: "20px", marginBottom: "24px", color: "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "12px", opacity: 0.8, textTransform: "uppercase", letterSpacing: "1px" }}>{t("hkfrs17.complianceStatus")}</div>
              <div style={{ fontSize: "28px", fontWeight: "bold" }}>
                {getTranslatedComplianceStatus(complianceStatus.compliance_status || "")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>{t("hkfrs17.totalContracts")}</div>
              <div style={{ fontSize: "24px", fontWeight: "bold" }}>{complianceStatus.total_contracts || contracts.length}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>{t("hkfrs17.lastAssessment")}</div>
              <div>{formatDate(complianceStatus.last_assessment_date)}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>{t("hkfrs17.nextAssessment")}</div>
              <div>{formatDate(complianceStatus.next_assessment_date)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Key HKFRS 17 Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "24px" }}>
        <div style={{ background: "white", borderRadius: "12px", padding: "20px", border: "1px solid #e8e8e8" }}>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>{t("hkfrs17.liabilityRemainingCoverage")}</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#1976d2" }}>{formatCurrency(totalLRC)}</div>
          <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>{t("hkfrs17.futureClaimsObligation")}</div>
        </div>
        <div style={{ background: "white", borderRadius: "12px", padding: "20px", border: "1px solid #e8e8e8" }}>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>{t("hkfrs17.liabilityIncurredClaims")}</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#f57c00" }}>{formatCurrency(totalLIC)}</div>
          <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>{t("hkfrs17.claimsReportedNotPaid")}</div>
        </div>
        <div style={{ background: "white", borderRadius: "12px", padding: "20px", border: "1px solid #e8e8e8" }}>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>{t("hkfrs17.totalRiskAdjustment")}</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#2e7d32" }}>{formatCurrency(totalRiskAdj)}</div>
          <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>{t("hkfrs17.nonFinancialRiskMargin")}</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div style={{ background: "white", borderRadius: "12px", padding: "20px", marginBottom: "24px", border: "1px solid #e8e8e8" }}>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 2, minWidth: "200px" }}>
            <input
              type="text"
              placeholder={t("hkfrs17.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #ddd", borderRadius: "8px", fontSize: "14px" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#667eea"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#ddd"; }}
            />
          </div>
          <div style={{ minWidth: "150px" }}>
            <select
              value={lrcFilter}
              onChange={(e) => setLrcFilter(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #ddd", borderRadius: "8px", fontSize: "14px", cursor: "pointer", background: "white", color: "#1a1a1a" }}
            >
              <option value="all">{t("hkfrs17.allLrcLevels")}</option>
              <option value="high">{t("hkfrs17.highLrc")}</option>
              <option value="medium">{t("hkfrs17.mediumLrc")}</option>
              <option value="low">{t("hkfrs17.lowLrc")}</option>
            </select>
          </div>
          {(searchTerm || lrcFilter !== "all") && (
            <button
              onClick={() => { setSearchTerm(""); setLrcFilter("all"); }}
              style={{ padding: "8px 20px", background: "#f44336", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "500", fontSize: "13px" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#d32f2f"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#f44336"; }}
            >
              {t("hkfrs17.clearFilters")}
            </button>
          )}
        </div>
      </div>

      {/* Insurance Contracts Table */}
      <div style={{ background: "white", borderRadius: "12px", padding: "24px", marginBottom: "24px", border: "1px solid #e8e8e8", color: "#1a1a1a" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1a1a1a", margin: 0 }}>📋 {t("hkfrs17.insuranceContracts")}</h2>
          <span style={{ fontSize: "12px", color: "#666" }}>{filteredContracts.length} {t("hkfrs17.contractsFound")}</span>
        </div>
        
        {filteredContracts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📄</div>
            <div>{t("hkfrs17.noContractsFound")}</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1a237e", color: "white" }}>
                  <th style={{ padding: "12px", textAlign: "left", cursor: "pointer" }} onClick={() => handleSort("contract_number")}>
                    {t("hkfrs17.contractNumber")} {getSortIcon("contract_number")}
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", cursor: "pointer" }} onClick={() => handleSort("policy_number")}>
                    {t("hkfrs17.policyNumber")} {getSortIcon("policy_number")}
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", cursor: "pointer" }} onClick={() => handleSort("customer")}>
                    {t("hkfrs17.customer")} {getSortIcon("customer")}
                  </th>
                  <th style={{ padding: "12px", textAlign: "center" }}>{t("hkfrs17.coveragePeriod")}</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>{t("hkfrs17.premium")}</th>
                  <th style={{ padding: "12px", textAlign: "right", cursor: "pointer" }} onClick={() => handleSort("lrc")}>
                    {t("hkfrs17.lrc")} {getSortIcon("lrc")}
                  </th>
                  <th style={{ padding: "12px", textAlign: "right", cursor: "pointer" }} onClick={() => handleSort("lic")}>
                    {t("hkfrs17.lic")} {getSortIcon("lic")}
                  </th>
                  <th style={{ padding: "12px", textAlign: "right", cursor: "pointer" }} onClick={() => handleSort("risk_adj")}>
                    {t("hkfrs17.riskAdj")} {getSortIcon("risk_adj")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.map((contract, idx) => (
                  <tr key={contract.id} style={{ borderBottom: idx === filteredContracts.length - 1 ? "none" : "1px solid #e8e8e8" }}>
                    <td style={{ padding: "12px", fontWeight: "500" }}>{contract.contract_number}</td>
                    <td style={{ padding: "12px" }}>{contract.policy_number}</td>
                    <td style={{ padding: "12px" }}>{capitalizeFirst(contract.customer_name || "N/A")}</td>
                    <td style={{ padding: "12px", textAlign: "center", fontSize: "12px" }}>
                      {formatDate(contract.coverage_start_date)} - {formatDate(contract.coverage_end_date)}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>{formatCurrency(contract.premium_amount, contract.premium_currency)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#1976d2" }}>{formatCurrency(contract.liability_for_remaining_coverage)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#f57c00" }}>{formatCurrency(contract.liability_for_incurred_claims)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#2e7d32" }}>{formatCurrency(contract.risk_adjustment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Measurements Timeline */}
      {measurements.length > 0 && (
        <div style={{ background: "white", borderRadius: "12px", padding: "24px", marginBottom: "24px", border: "1px solid #e8e8e8", color: "#1a1a1a" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "#1a1a1a" }}>📊 {t("hkfrs17.fulfillmentCashflowsTrend")}</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1a237e", color: "white" }}>
                  <th style={{ padding: "12px", textAlign: "left" }}>{t("hkfrs17.measurementDate")}</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>{t("hkfrs17.pvFutureCashflows")}</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>{t("hkfrs17.riskAdjustment")}</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>{t("hkfrs17.csm")}</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>{t("hkfrs17.fulfillmentCf")}</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>{t("hkfrs17.insuranceRevenue")}</th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((m, idx) => (
                  <tr key={m.id} style={{ borderBottom: idx === measurements.length - 1 ? "none" : "1px solid #e8e8e8" }}>
                    <td style={{ padding: "12px" }}>{formatDate(m.measurement_date)}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>{formatCurrency(m.pv_of_future_cashflows)}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>{formatCurrency(m.risk_adjustment)}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>{formatCurrency(m.contractual_service_margin)}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>{formatCurrency(m.fulfillment_cashflows)}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>{formatCurrency(m.insurance_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HKFRS 17 Disclosure Notes */}
      <div style={{ marginTop: "32px", background: "white", borderRadius: "16px", padding: "28px", border: "1px solid #e8e8e8", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px", borderBottom: "2px solid #e8e8e8", paddingBottom: "16px" }}>
          <div style={{ width: "32px", height: "32px", background: "linear-gradient(135deg, #1a237e 0%, #283593 100%)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>📝</div>
          <h3 style={{ fontSize: "18px", fontWeight: "600", margin: 0, color: "#1a1a1a", letterSpacing: "-0.3px" }}>{t("hkfrs17.disclosureNotes")}</h3>
          <span style={{ marginLeft: "auto", fontSize: "11px", padding: "4px 12px", borderRadius: "20px", background: "#e8f5e9", color: "#2e7d32", fontWeight: "500" }}>✓ {t("hkfrs17.fullyCompliant")}</span>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
          <div style={{ background: "linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)", borderRadius: "12px", padding: "20px", border: "1px solid #e8e8e8", transition: "transform 0.2s, box-shadow 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <div style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>📊</div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#1a237e", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("hkfrs17.measurementApproach")}</div>
            </div>
            <div style={{ fontSize: "14px", color: "#424242", lineHeight: "1.5", marginBottom: "12px" }}>{t("hkfrs17.measurementApproachDesc")}</div>
            <div style={{ fontSize: "11px", color: "#2e7d32", background: "#e8f5e9", display: "inline-block", padding: "2px 8px", borderRadius: "12px" }}>IFRS 17 {t("hkfrs17.compliant")}</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)", borderRadius: "12px", padding: "20px", border: "1px solid #e8e8e8", transition: "transform 0.2s, box-shadow 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <div style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>💰</div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#1a237e", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("hkfrs17.discountRate")}</div>
            </div>
            <div style={{ fontSize: "14px", color: "#424242", lineHeight: "1.5", marginBottom: "12px" }}>{t("hkfrs17.discountRateDesc")}</div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "#1976d2", marginTop: "8px" }}>3.0%</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)", borderRadius: "12px", padding: "20px", border: "1px solid #e8e8e8", transition: "transform 0.2s, box-shadow 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <div style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>⚠️</div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#1a237e", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("hkfrs17.riskAdjustmentTechnique")}</div>
            </div>
            <div style={{ fontSize: "14px", color: "#424242", lineHeight: "1.5", marginBottom: "12px" }}>{t("hkfrs17.riskAdjustmentDesc")}</div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "#f57c00", marginTop: "8px" }}>75th Percentile</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)", borderRadius: "12px", padding: "20px", border: "1px solid #e8e8e8", transition: "transform 0.2s, box-shadow 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <div style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>📈</div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#1a237e", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("hkfrs17.csmAmortization")}</div>
            </div>
            <div style={{ fontSize: "14px", color: "#424242", lineHeight: "1.5", marginBottom: "12px" }}>{t("hkfrs17.csmAmortizationDesc")}</div>
            <div style={{ fontSize: "12px", color: "#2e7d32", background: "#e8f5e9", display: "inline-block", padding: "2px 8px", borderRadius: "12px", marginTop: "8px" }}>{t("hkfrs17.timeBasedAmortization")}</div>
          </div>
        </div>

        <div style={{ marginTop: "24px", padding: "16px 20px", background: "#f8f9fa", borderRadius: "10px", border: "1px solid #e8e8e8", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>🏦</span>
            <div><div style={{ fontSize: "11px", fontWeight: "600", color: "#666", textTransform: "uppercase" }}>{t("hkfrs17.effectiveDate")}</div><div style={{ fontSize: "13px", fontWeight: "500", color: "#1a1a1a" }}>January 1, 2023</div></div>
          </div>
          <div style={{ width: "1px", height: "30px", background: "#ddd" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>📋</span>
            <div><div style={{ fontSize: "11px", fontWeight: "600", color: "#666", textTransform: "uppercase" }}>{t("hkfrs17.transitionApproach")}</div><div style={{ fontSize: "13px", fontWeight: "500", color: "#1a1a1a" }}>{t("hkfrs17.modifiedRetrospective")}</div></div>
          </div>
          <div style={{ width: "1px", height: "30px", background: "#ddd" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>✅</span>
            <div><div style={{ fontSize: "11px", fontWeight: "600", color: "#666", textTransform: "uppercase" }}>{t("hkfrs17.auditStatus")}</div><div style={{ fontSize: "13px", fontWeight: "500", color: "#2e7d32" }}>{t("hkfrs17.reviewedVerified")}</div></div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: "24px", padding: "16px 20px", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #e8e8e8", fontSize: "12px", color: "#666", textAlign: "center" }}>
        <span>🔒 {t("hkfrs17.hkfrs17Compliant")} | </span>
        <span>📊 {t("hkfrs17.buildingBlockApproach")} | </span>
        <span>🕒 {t("hkfrs17.lastUpdated")}: {new Date().toLocaleString('en-HK')}</span>
      </div>
    </div>
  );
}