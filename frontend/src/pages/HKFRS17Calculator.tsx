import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

interface CSMInputs {
  contractNumber: string;
  policyNumber: string;
  customerName: string;
  initialCSM: number;
  coveragePeriodYears: number;
  coverageUnitsMethod: "evenly" | "weighted_by_sum_assured" | "expected_claims" | "custom";
  customCoverageUnits: number[];
  discountRate: number;
  riskAdjustmentMethod: "confidence_level" | "cost_of_capital";
  riskAdjustmentPercentage: number;
  portfolio: string;
  annualCohort: number;
  onerousClassification: "non_onerous" | "onerous";
  assumptionChangeYear?: number;
  assumptionChangeType?: "mortality" | "lapse" | "expense" | "claims_development";
  assumptionChangeImpact?: number;
}

interface CSMYearlyData {
  year: number;
  openingCSM: number;
  interestAccretion: number;
  amortization: number;
  closingCSM: number;
  coverageUnits: number;
  coverageUnitsPercentage: number;
}

interface AccountingEntry {
  year: number;
  account: string;
  debit: number;
  credit: number;
  description: string;
}

export function HKFRS17Calculator() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [inputs, setInputs] = useState<CSMInputs>({
    contractNumber: "",
    policyNumber: "",
    customerName: "",
    initialCSM: 1000000,
    coveragePeriodYears: 10,
    coverageUnitsMethod: "weighted_by_sum_assured",
    customCoverageUnits: [],
    discountRate: 4.0,
    riskAdjustmentMethod: "confidence_level",
    riskAdjustmentPercentage: 8.0,
    portfolio: "Life Insurance",
    annualCohort: new Date().getFullYear(),
    onerousClassification: "non_onerous",
  });
  
  const [showAssumptionChange, setShowAssumptionChange] = useState(false);
  const [csmTable, setCsmTable] = useState<CSMYearlyData[]>([]);
  const [accountingEntries, setAccountingEntries] = useState<AccountingEntry[]>([]);
  const [calculated, setCalculated] = useState(false);
  const [saving, setSaving] = useState(false);

  const calculateCoverageUnits = (year: number, totalYears: number, method: string, customUnits?: number[]): number => {
    switch (method) {
      case "evenly":
        return 1;
      case "weighted_by_sum_assured":
        const midPoint = (totalYears + 1) / 2;
        if (year <= midPoint) {
          return 1 + (year - 1) * 0.5;
        } else {
          return 1 + (totalYears - year) * 0.5;
        }
      case "expected_claims":
        return 0.5 + (year * 0.3);
      case "custom":
        return customUnits?.[year - 1] || 1;
      default:
        return 1;
    }
  };

  const getCoverageUnitsArray = (): number[] => {
    if (inputs.coverageUnitsMethod === "custom") {
      if (inputs.customCoverageUnits.length !== inputs.coveragePeriodYears) {
        return Array(inputs.coveragePeriodYears).fill(1);
      }
      return inputs.customCoverageUnits;
    }
    
    const units = [];
    for (let year = 1; year <= inputs.coveragePeriodYears; year++) {
      units.push(calculateCoverageUnits(year, inputs.coveragePeriodYears, inputs.coverageUnitsMethod));
    }
    return units;
  };

  const updateCustomCoverageUnit = (yearIndex: number, value: number) => {
    const newUnits = [...(inputs.customCoverageUnits.length === inputs.coveragePeriodYears 
      ? inputs.customCoverageUnits 
      : Array(inputs.coveragePeriodYears).fill(1))];
    newUnits[yearIndex] = value;
    setInputs({ ...inputs, customCoverageUnits: newUnits });
  };

  const calculateCSM = () => {
    const { initialCSM, coveragePeriodYears, discountRate, coverageUnitsMethod, assumptionChangeYear, assumptionChangeImpact } = inputs;
    const rate = discountRate / 100;
    
    const table: CSMYearlyData[] = [];
    let openingCSM = initialCSM;
    
    let coverageUnitsArray: number[];
    if (coverageUnitsMethod === "custom") {
      coverageUnitsArray = inputs.customCoverageUnits.length === coveragePeriodYears
        ? inputs.customCoverageUnits
        : Array(coveragePeriodYears).fill(1);
    } else {
      coverageUnitsArray = [];
      for (let year = 1; year <= coveragePeriodYears; year++) {
        let units = calculateCoverageUnits(year, coveragePeriodYears, coverageUnitsMethod);
        if (assumptionChangeYear && assumptionChangeYear === year && assumptionChangeImpact) {
          units = units * (1 + assumptionChangeImpact / 100);
        }
        coverageUnitsArray.push(units);
      }
    }
    
    const totalUnits = coverageUnitsArray.reduce((sum, u) => sum + u, 0);
    const percentages = coverageUnitsArray.map(u => u / totalUnits);
    
    for (let year = 1; year <= coveragePeriodYears; year++) {
      const coveragePercentage = percentages[year - 1];
      const interestAccretion = openingCSM * rate;
      const amortization = (openingCSM + interestAccretion) * coveragePercentage;
      const closingCSM = openingCSM + interestAccretion - amortization;
      
      table.push({
        year,
        openingCSM: Math.round(openingCSM * 100) / 100,
        interestAccretion: Math.round(interestAccretion * 100) / 100,
        amortization: Math.round(amortization * 100) / 100,
        closingCSM: Math.round(closingCSM * 100) / 100,
        coverageUnits: Math.round(coverageUnitsArray[year - 1] * 100) / 100,
        coverageUnitsPercentage: Math.round(coveragePercentage * 10000) / 100,
      });
      
      openingCSM = closingCSM;
    }
    
    setCsmTable(table);
    generateAccountingEntries(table, rate);
    setCalculated(true);
  };
  
  const generateAccountingEntries = (table: CSMYearlyData[], rate: number) => {
    const entries: AccountingEntry[] = [];
    
    for (const yearData of table) {
      entries.push({
        year: yearData.year,
        account: t("hkfrs17Calculator.drCsm"),
        debit: yearData.interestAccretion,
        credit: 0,
        description: t("hkfrs17Calculator.interestAccretionDesc", { rate: (rate * 100).toFixed(1), year: yearData.year }),
      });
      
      entries.push({
        year: yearData.year,
        account: t("hkfrs17Calculator.crInsuranceFinance"),
        debit: 0,
        credit: yearData.interestAccretion,
        description: t("hkfrs17Calculator.financeIncomeDesc", { year: yearData.year }),
      });
      
      entries.push({
        year: yearData.year,
        account: t("hkfrs17Calculator.drCsm"),
        debit: yearData.amortization,
        credit: 0,
        description: t("hkfrs17Calculator.csmReleaseDesc", { year: yearData.year }),
      });
      
      entries.push({
        year: yearData.year,
        account: t("hkfrs17Calculator.crInsuranceRevenue"),
        debit: 0,
        credit: yearData.amortization,
        description: t("hkfrs17Calculator.insuranceRevenueDesc", { year: yearData.year }),
      });
    }
    
    setAccountingEntries(entries);
  };
  
  const saveCalculation = async () => {
    setSaving(true);
    try {
      await api("/hkfrs17/save-calculation", {
        method: "POST",
        body: JSON.stringify({
          inputs,
          csmTable,
          accountingEntries,
          calculatedAt: new Date().toISOString(),
        }),
      });
      alert(t("hkfrs17Calculator.saveSuccess"));
    } catch (error) {
      console.error("Failed to save calculation:", error);
      alert(t("hkfrs17Calculator.saveFailed"));
    } finally {
      setSaving(false);
    }
  };
  
  const downloadReport = () => {
    if (!calculated || csmTable.length === 0) {
      alert(t("hkfrs17Calculator.calculateFirst"));
      return;
    }
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${t("hkfrs17Calculator.reportTitle")}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #333; }
          h1 { color: #1a237e; border-bottom: 2px solid #1a237e; padding-bottom: 10px; }
          h2 { color: #283593; margin-top: 30px; }
          h3 { color: #1a237e; margin-top: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th { background: #1a237e; color: white; padding: 10px; text-align: left; }
          td { padding: 8px; border-bottom: 1px solid #ddd; }
          .summary-card { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
          .disclosure { background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <h1>${t("hkfrs17Calculator.reportTitle")}</h1>
        <p>${t("hkfrs17Calculator.generatedLabel")}: ${new Date().toLocaleString()} | ${t("hkfrs17Calculator.generatedBy")}: ${user?.fullName || "System"} | ${t("hkfrs17Calculator.contractLabel")}: ${inputs.contractNumber || "N/A"}</p>
        
        <div class="summary-card">
          <h2>${t("hkfrs17Calculator.contractSummary")}</h2>
          <p><strong>${t("hkfrs17Calculator.contractNumber")}:</strong> ${inputs.contractNumber || "N/A"}</p>
          <p><strong>${t("hkfrs17Calculator.policyNumber")}:</strong> ${inputs.policyNumber || "N/A"}</p>
          <p><strong>${t("hkfrs17Calculator.customerName")}:</strong> ${inputs.customerName || "N/A"}</p>
          <p><strong>${t("hkfrs17Calculator.portfolio")}:</strong> ${inputs.portfolio}</p>
          <p><strong>${t("hkfrs17Calculator.annualCohort")}:</strong> ${inputs.annualCohort}</p>
          <p><strong>${t("hkfrs17Calculator.classification")}:</strong> ${inputs.onerousClassification === "non_onerous" ? t("hkfrs17Calculator.nonOnerous") : t("hkfrs17Calculator.onerous")}</p>
        </div>
        
        <div class="summary-card">
          <h2>${t("hkfrs17Calculator.measurementAssumptions")}</h2>
          <p><strong>${t("hkfrs17Calculator.initialCsm")}:</strong> ${formatCurrency(inputs.initialCSM)}</p>
          <p><strong>${t("hkfrs17Calculator.coveragePeriodYears")}:</strong> ${inputs.coveragePeriodYears} ${t("hkfrs17Calculator.years")}</p>
          <p><strong>${t("hkfrs17Calculator.coverageUnitsMethod")}:</strong> ${
            inputs.coverageUnitsMethod === "evenly" ? t("hkfrs17Calculator.evenly") :
            inputs.coverageUnitsMethod === "weighted_by_sum_assured" ? t("hkfrs17Calculator.weightedBySumAssured") :
            inputs.coverageUnitsMethod === "expected_claims" ? t("hkfrs17Calculator.expectedClaims") : 
            t("hkfrs17Calculator.custom")
          }</p>
          <p><strong>${t("hkfrs17Calculator.discountRate")}:</strong> ${inputs.discountRate}%</p>
          <p><strong>${t("hkfrs17Calculator.riskAdjustment")}:</strong> ${inputs.riskAdjustmentPercentage}%</p>
        </div>
        
        <h2>${t("hkfrs17Calculator.csmAmortizationTable")}</h2>
        <table>
          <thead>
            <tr><th>${t("hkfrs17Calculator.year")}</th><th>${t("hkfrs17Calculator.openingCsm")}</th><th>${t("hkfrs17Calculator.interestAccretion")}</th><th>${t("hkfrs17Calculator.amortization")}</th><th>${t("hkfrs17Calculator.closingCsm")}</th><th>${t("hkfrs17Calculator.coveragePercentage")}</th></tr>
          </thead>
          <tbody>
            ${csmTable.map(row => `
              <tr>
                <td>${row.year}</td>
                <td>${formatCurrency(row.openingCSM)}</td>
                <td>${formatCurrency(row.interestAccretion)}</td>
                <td>${formatCurrency(row.amortization)}</td>
                <td>${formatCurrency(row.closingCSM)}</td>
                <td>${row.coverageUnitsPercentage}%</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #f0f0f0; font-weight: bold;">
              <td>${t("hkfrs17Calculator.total")}</td>
              <td>-</td>
              <td>${formatCurrency(csmTable.reduce((sum, r) => sum + r.interestAccretion, 0))}</td>
              <td>${formatCurrency(csmTable.reduce((sum, r) => sum + r.amortization, 0))}</td>
              <td>-</td>
              <td>100%</td>
            </tr>
          </tfoot>
        </table>
        
        <h2>${t("hkfrs17Calculator.accountingJournalEntries")}</h2>
        <table>
          <thead>
            <tr><th>${t("hkfrs17Calculator.year")}</th><th>${t("hkfrs17Calculator.account")}</th><th>${t("hkfrs17Calculator.debit")}</th><th>${t("hkfrs17Calculator.credit")}</th><th>${t("hkfrs17Calculator.description")}</th></tr>
          </thead>
          <tbody>
            ${accountingEntries.map(entry => `
              <tr>
                <td>${entry.year}</td>
                <td>${entry.account}</td>
                <td>${entry.debit > 0 ? formatCurrency(entry.debit) : "-"}</td>
                <td>${entry.credit > 0 ? formatCurrency(entry.credit) : "-"}</td>
                <td>${entry.description}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="summary-card">
          <h3>${t("hkfrs17Calculator.summaryTotals")}</h3>
          <p><strong>${t("hkfrs17Calculator.totalCsmReleased")}:</strong> ${formatCurrency(csmTable.reduce((sum, r) => sum + r.amortization, 0))}</p>
          <p><strong>${t("hkfrs17Calculator.totalFinanceIncome")}:</strong> ${formatCurrency(csmTable.reduce((sum, r) => sum + r.interestAccretion, 0))}</p>
          <p><strong>${t("hkfrs17Calculator.remainingCsm")}:</strong> ${formatCurrency(csmTable[csmTable.length - 1]?.closingCSM || 0)}</p>
        </div>
        
        <div class="disclosure">
          <h3>${t("hkfrs17Calculator.disclosureNotes")}</h3>
          <p><strong>${t("hkfrs17Calculator.measurementApproach")}:</strong> ${t("hkfrs17Calculator.measurementApproachDesc")}</p>
          <p><strong>${t("hkfrs17Calculator.discountRate")}:</strong> ${t("hkfrs17Calculator.discountRateDesc")} (${inputs.discountRate}%)</p>
          <p><strong>${t("hkfrs17Calculator.riskAdjustmentTechnique")}:</strong> ${t("hkfrs17Calculator.riskAdjustmentDesc")} (${inputs.riskAdjustmentPercentage}%)</p>
        </div>
        
        <div class="footer">
          <p>${t("hkfrs17Calculator.footerText")}</p>
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hkfrs17_csm_report_${inputs.contractNumber || "calculation"}_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-HK', {
      style: 'currency',
      currency: 'HKD',
      minimumFractionDigits: 2,
    }).format(amount);
  };
  
  const coverageUnitsPreview = getCoverageUnitsArray();
  const totalUnits = coverageUnitsPreview.reduce((sum, u) => sum + u, 0);
  
  return (
    <div style={{ padding: "24px", maxWidth: "1600px", margin: "0 auto", background: "#f0f2f5", minHeight: "100vh", fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif" }}>
      {/* Header with Download Button */}
      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "600", color: "#1a1a1a", marginBottom: "8px" }}>{t("hkfrs17Calculator.title")}</h1>
          <p style={{ color: "#5a5a5a", fontSize: "14px" }}>{t("hkfrs17Calculator.subtitle")}</p>
        </div>
        {calculated && (
          <button
            onClick={downloadReport}
            style={{ padding: "10px 20px", background: "#ff9800", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "500", display: "flex", alignItems: "center", gap: "8px" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f57c00"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#ff9800"; }}
          >
            📥 {t("hkfrs17Calculator.downloadReport")}
          </button>
        )}
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(600px, 1fr))", gap: "24px" }}>
        {/* Input Form */}
        <div style={{ background: "white", borderRadius: "12px", padding: "24px", border: "1px solid #e8e8e8" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "#1a1a1a" }}>📋 {t("hkfrs17Calculator.contractCsmInputs")}</h2>
          
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "4px", display: "block" }}>{t("hkfrs17Calculator.contractNumber")}</label>
                <input type="text" value={inputs.contractNumber} onChange={(e) => setInputs({ ...inputs, contractNumber: e.target.value })} placeholder={t("hkfrs17Calculator.contractNumberPlaceholder")} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px" }} />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "4px", display: "block" }}>{t("hkfrs17Calculator.policyNumber")}</label>
                <input type="text" value={inputs.policyNumber} onChange={(e) => setInputs({ ...inputs, policyNumber: e.target.value })} placeholder={t("hkfrs17Calculator.policyNumberPlaceholder")} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px" }} />
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "4px", display: "block" }}>{t("hkfrs17Calculator.customerName")}</label>
              <input type="text" value={inputs.customerName} onChange={(e) => setInputs({ ...inputs, customerName: e.target.value })} placeholder={t("hkfrs17Calculator.customerNamePlaceholder")} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px" }} />
            </div>
            
            <div style={{ borderTop: "1px solid #e8e8e8", marginTop: "8px", paddingTop: "16px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "#1a1a1a" }}>{t("hkfrs17Calculator.csmMeasurement")}</h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "4px", display: "block" }}>{t("hkfrs17Calculator.initialCsm")} (HK$)</label>
                  <input type="number" value={inputs.initialCSM} onChange={(e) => setInputs({ ...inputs, initialCSM: parseFloat(e.target.value) || 0 })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "4px", display: "block" }}>{t("hkfrs17Calculator.coveragePeriodYears")}</label>
                  <input type="number" value={inputs.coveragePeriodYears} onChange={(e) => { const years = parseInt(e.target.value) || 1; setInputs({ ...inputs, coveragePeriodYears: years, customCoverageUnits: [] }); }} min={1} max={30} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px" }} />
                </div>
              </div>
            
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "4px", display: "block" }}>{t("hkfrs17Calculator.coverageUnitsMethod")}</label>
                <select value={inputs.coverageUnitsMethod} onChange={(e) => setInputs({ ...inputs, coverageUnitsMethod: e.target.value as any, customCoverageUnits: [] })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px" }}>
                  <option value="evenly">{t("hkfrs17Calculator.evenly")}</option>
                  <option value="weighted_by_sum_assured">{t("hkfrs17Calculator.weightedBySumAssured")}</option>
                  <option value="expected_claims">{t("hkfrs17Calculator.expectedClaims")}</option>
                  <option value="custom">{t("hkfrs17Calculator.custom")}</option>
                </select>
              </div>
              
              {inputs.coverageUnitsMethod === "custom" && (
                <div style={{ marginBottom: "16px", border: "1px solid #e8e8e8", borderRadius: "8px", padding: "12px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "8px", display: "block" }}>{t("hkfrs17Calculator.customCoverageUnits")}</label>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(5, inputs.coveragePeriodYears)}, 1fr)`, gap: "8px" }}>
                    {Array(inputs.coveragePeriodYears).fill(0).map((_, idx) => (
                      <div key={idx}>
                        <div style={{ fontSize: "10px", textAlign: "center", marginBottom: "4px", color: "#1a1a1a" }}>{t("hkfrs17Calculator.year")} {idx + 1}</div>
                        <input type="number" step="0.1" value={inputs.customCoverageUnits[idx] || 1} onChange={(e) => updateCustomCoverageUnit(idx, parseFloat(e.target.value) || 0)} style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: "4px", textAlign: "center" }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: "11px", color: "#666", marginTop: "8px", textAlign: "center" }}>{t("hkfrs17Calculator.totalUnits")}: {totalUnits.toFixed(1)} | {t("hkfrs17Calculator.percentagesCalculated")}</div>
                </div>
              )}
              
              {inputs.coverageUnitsMethod !== "custom" && (
                <div style={{ marginBottom: "16px", background: "#f8f9fa", borderRadius: "8px", padding: "12px", color: "#1a1a1a" }}>
                  <div style={{ fontSize: "11px", fontWeight: "600", color: "#666", marginBottom: "8px" }}>{t("hkfrs17Calculator.coverageUnitsPreview")}:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {coverageUnitsPreview.map((unit, idx) => (
                      <span key={idx} style={{ fontSize: "11px", background: "#e3f2fd", padding: "2px 8px", borderRadius: "12px" }}>{t("hkfrs17Calculator.year")} {idx + 1}: {unit.toFixed(1)}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: "11px", color: "#666", marginTop: "8px" }}>{t("hkfrs17Calculator.totalUnits")}: {totalUnits.toFixed(1)} | {t("hkfrs17Calculator.percentagesCalculated")}</div>
                </div>
              )}
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "4px", display: "block" }}>{t("hkfrs17Calculator.discountRate")} (%)</label>
                  <input type="number" step="0.1" value={inputs.discountRate} onChange={(e) => setInputs({ ...inputs, discountRate: parseFloat(e.target.value) || 0 })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "4px", display: "block" }}>{t("hkfrs17Calculator.riskAdjustment")} (%)</label>
                  <input type="number" step="0.1" value={inputs.riskAdjustmentPercentage} onChange={(e) => setInputs({ ...inputs, riskAdjustmentPercentage: parseFloat(e.target.value) || 0 })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px" }} />
                </div>
              </div>
            </div>
            
            <div style={{ borderTop: "1px solid #e8e8e8", marginTop: "8px", paddingTop: "16px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "#1a1a1a" }}>{t("hkfrs17Calculator.groupingInformation")}</h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "4px", display: "block" }}>{t("hkfrs17Calculator.portfolio")}</label>
                  <input type="text" value={inputs.portfolio} onChange={(e) => setInputs({ ...inputs, portfolio: e.target.value })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "4px", display: "block" }}>{t("hkfrs17Calculator.annualCohort")}</label>
                  <input type="number" value={inputs.annualCohort} onChange={(e) => setInputs({ ...inputs, annualCohort: parseInt(e.target.value) || new Date().getFullYear() })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px" }} />
                </div>
              </div>
              
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "4px", display: "block" }}>{t("hkfrs17Calculator.onerousClassification")}</label>
                <select value={inputs.onerousClassification} onChange={(e) => setInputs({ ...inputs, onerousClassification: e.target.value as any })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px" }}>
                  <option value="non_onerous">{t("hkfrs17Calculator.nonOnerous")}</option>
                  <option value="onerous">{t("hkfrs17Calculator.onerous")}</option>
                </select>
              </div>
            </div>
            
            <div style={{ borderTop: "1px solid #e8e8e8", marginTop: "8px", paddingTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "600", margin: 0, color: "#1a1a1a" }}>{t("hkfrs17Calculator.assumptionChanges")}</h3>
                <button onClick={() => setShowAssumptionChange(!showAssumptionChange)} style={{ padding: "4px 12px", background: "#e3f2fd", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", color: "#1a1a1a" }}>{showAssumptionChange ? t("hkfrs17Calculator.hide") : t("hkfrs17Calculator.addAssumptionChange")}</button>
              </div>
              
              {showAssumptionChange && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "#666", marginBottom: "4px", display: "block" }}>{t("hkfrs17Calculator.changeYear")}</label>
                    <input type="number" value={inputs.assumptionChangeYear || ""} onChange={(e) => setInputs({ ...inputs, assumptionChangeYear: parseInt(e.target.value) || undefined })} min={1} max={inputs.coveragePeriodYears} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "#666", marginBottom: "4px", display: "block" }}>{t("hkfrs17Calculator.changeType")}</label>
                    <select value={inputs.assumptionChangeType || ""} onChange={(e) => setInputs({ ...inputs, assumptionChangeType: e.target.value as any })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px" }}>
                      <option value="">{t("hkfrs17Calculator.selectType")}</option>
                      <option value="mortality">{t("hkfrs17Calculator.mortality")}</option>
                      <option value="lapse">{t("hkfrs17Calculator.lapse")}</option>
                      <option value="expense">{t("hkfrs17Calculator.expense")}</option>
                      <option value="claims_development">{t("hkfrs17Calculator.claimsDevelopment")}</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "#666", marginBottom: "4px", display: "block" }}>{t("hkfrs17Calculator.impact")} (%)</label>
                    <input type="number" step="1" value={inputs.assumptionChangeImpact || ""} onChange={(e) => setInputs({ ...inputs, assumptionChangeImpact: parseFloat(e.target.value) || undefined })} style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px" }} />
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
              <button onClick={calculateCSM} style={{ flex: 1, padding: "12px 24px", background: "linear-gradient(135deg, #1a237e 0%, #283593 100%)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}>{t("hkfrs17Calculator.calculate")}</button>
              {calculated && (
                <button onClick={saveCalculation} disabled={saving} style={{ padding: "12px 24px", background: saving ? "#ccc" : "#4caf50", color: "white", border: "none", borderRadius: "8px", cursor: saving ? "not-allowed" : "pointer", fontWeight: "600", fontSize: "14px" }}>{saving ? t("hkfrs17Calculator.saving") : t("hkfrs17Calculator.saveCalculation")}</button>
              )}
            </div>
          </div>
        </div>
        
        {/* Results Section */}
        <div style={{ background: "white", borderRadius: "12px", padding: "24px", border: "1px solid #e8e8e8" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "#1a1a1a" }}>📊 {t("hkfrs17Calculator.results")}</h2>
          
          {!calculated ? (
            <div style={{ textAlign: "center", padding: "60px", color: "#666" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📝</div>
              <div>{t("hkfrs17Calculator.calculatePrompt")}</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", color: "#1a237e" }}>{t("hkfrs17Calculator.csmAmortizationTable")}</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", color: "#1a1a1a" }}>
                    <thead>
                      <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e8e8e8" }}>
                        <th style={{ padding: "10px", textAlign: "center" }}>{t("hkfrs17Calculator.year")}</th>
                        <th style={{ padding: "10px", textAlign: "right" }}>{t("hkfrs17Calculator.openingCsm")}</th>
                        <th style={{ padding: "10px", textAlign: "right" }}>{t("hkfrs17Calculator.interestAccretion")}</th>
                        <th style={{ padding: "10px", textAlign: "right" }}>{t("hkfrs17Calculator.amortization")}</th>
                        <th style={{ padding: "10px", textAlign: "right" }}>{t("hkfrs17Calculator.closingCsm")}</th>
                        <th style={{ padding: "10px", textAlign: "center" }}>{t("hkfrs17Calculator.coveragePercentage")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csmTable.map((row) => (
                        <tr key={row.year} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "10px", textAlign: "center", fontWeight: "600" }}>{row.year}</td>
                          <td style={{ padding: "10px", textAlign: "right" }}>{formatCurrency(row.openingCSM)}</td>
                          <td style={{ padding: "10px", textAlign: "right", color: "#1976d2" }}>{formatCurrency(row.interestAccretion)}</td>
                          <td style={{ padding: "10px", textAlign: "right", color: "#f57c00" }}>{formatCurrency(row.amortization)}</td>
                          <td style={{ padding: "10px", textAlign: "right", fontWeight: "600" }}>{formatCurrency(row.closingCSM)}</td>
                          <td style={{ padding: "10px", textAlign: "center" }}>{row.coverageUnitsPercentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#f8f9fa", borderTop: "2px solid #e8e8e8" }}>
                        <td style={{ padding: "10px", fontWeight: "600" }}>{t("hkfrs17Calculator.total")}</td>
                        <td style={{ padding: "10px", textAlign: "right" }}>-</td>
                        <td style={{ padding: "10px", textAlign: "right", color: "#1976d2" }}>{formatCurrency(csmTable.reduce((sum, r) => sum + r.interestAccretion, 0))}</td>
                        <td style={{ padding: "10px", textAlign: "right", color: "#f57c00" }}>{formatCurrency(csmTable.reduce((sum, r) => sum + r.amortization, 0))}</td>
                        <td style={{ padding: "10px", textAlign: "right" }}>-</td>
                        <td style={{ padding: "10px", textAlign: "center" }}>100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", color: "#1a237e" }}>{t("hkfrs17Calculator.accountingJournalEntries")}</h3>
                <div style={{ overflowX: "auto", maxHeight: "400px", overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", color: "#1a1a1a" }}>
                    <thead>
                      <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e8e8e8", position: "sticky", top: 0 }}>
                        <th style={{ padding: "10px", textAlign: "center" }}>{t("hkfrs17Calculator.year")}</th>
                        <th style={{ padding: "10px", textAlign: "left" }}>{t("hkfrs17Calculator.account")}</th>
                        <th style={{ padding: "10px", textAlign: "right" }}>{t("hkfrs17Calculator.debit")} (HK$)</th>
                        <th style={{ padding: "10px", textAlign: "right" }}>{t("hkfrs17Calculator.credit")} (HK$)</th>
                        <th style={{ padding: "10px", textAlign: "left" }}>{t("hkfrs17Calculator.description")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountingEntries.map((entry, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "10px", textAlign: "center", fontWeight: "600" }}>{entry.year}</td>
                          <td style={{ padding: "10px", fontFamily: "monospace", fontSize: "12px" }}>{entry.account}</td>
                          <td style={{ padding: "10px", textAlign: "right", color: entry.debit > 0 ? "#c62828" : "#666" }}>{entry.debit > 0 ? formatCurrency(entry.debit) : "-"}</td>
                          <td style={{ padding: "10px", textAlign: "right", color: entry.credit > 0 ? "#2e7d32" : "#666" }}>{entry.credit > 0 ? formatCurrency(entry.credit) : "-"}</td>
                          <td style={{ padding: "10px", fontSize: "11px", color: "#666" }}>{entry.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginTop: "24px" }}>
                <div style={{ background: "#e8f5e9", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "#666" }}>{t("hkfrs17Calculator.totalCsmReleased")}</div>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: "#2e7d32" }}>{formatCurrency(csmTable.reduce((sum, r) => sum + r.amortization, 0))}</div>
                </div>
                <div style={{ background: "#e3f2fd", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "#666" }}>{t("hkfrs17Calculator.totalFinanceIncome")}</div>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: "#1976d2" }}>{formatCurrency(csmTable.reduce((sum, r) => sum + r.interestAccretion, 0))}</div>
                </div>
                <div style={{ background: "#fff3e0", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "#666" }}>{t("hkfrs17Calculator.remainingCsm")}</div>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: "#f57c00" }}>{formatCurrency(csmTable[csmTable.length - 1]?.closingCSM || 0)}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Disclosure Notes */}
      <div style={{ marginTop: "24px", background: "white", borderRadius: "12px", padding: "24px", border: "1px solid #e8e8e8" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "#1a1a1a" }}>📝 {t("hkfrs17Calculator.disclosureNotes")}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          <div><div style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "4px" }}>{t("hkfrs17Calculator.measurementApproach")}</div><div style={{ fontSize: "13px", color: "#1a1a1a" }}>{t("hkfrs17Calculator.measurementApproachDesc")}</div></div>
          <div><div style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "4px" }}>{t("hkfrs17Calculator.discountRate")}</div><div style={{ fontSize: "13px", color: "#1a1a1a" }}>{t("hkfrs17Calculator.discountRateDesc")} ({inputs.discountRate}%)</div></div>
          <div><div style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "4px" }}>{t("hkfrs17Calculator.riskAdjustmentTechnique")}</div><div style={{ fontSize: "13px", color: "#1a1a1a" }}>{inputs.riskAdjustmentMethod === "confidence_level" ? t("hkfrs17Calculator.confidenceLevel") : t("hkfrs17Calculator.costOfCapital")} ({inputs.riskAdjustmentPercentage}%)</div></div>
          <div><div style={{ fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "4px" }}>{t("hkfrs17Calculator.coverageUnitsMethod")}</div><div style={{ fontSize: "13px", color: "#1a1a1a" }}>{
            inputs.coverageUnitsMethod === "evenly" ? t("hkfrs17Calculator.evenlyDesc") :
            inputs.coverageUnitsMethod === "weighted_by_sum_assured" ? t("hkfrs17Calculator.weightedBySumAssuredDesc") :
            inputs.coverageUnitsMethod === "expected_claims" ? t("hkfrs17Calculator.expectedClaimsDesc") :
            t("hkfrs17Calculator.customDesc")
          }</div></div>
        </div>
      </div>
    </div>
  );
}