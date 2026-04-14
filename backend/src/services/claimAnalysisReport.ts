/**
 * Professional markdown claim analysis reports for underwriters, claims officers, and SIU.
 */

export type RiskBand = "Critical" | "High" | "Medium" | "Low";

export type DocumentIssueRow = {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  recommendation: string;
};

export type DocumentAnalysisRow = {
  document: string;
  issues: DocumentIssueRow[];
};

export type GoogleSearchSummaryRow = {
  searchesPerformed: number;
  resultsFound: number;
  vendorsVerified: string[];
};

export type ScoreBreakdown = {
  base: number;
  amountRisk: number;
  vendorRisk: number;
  documentRisk: number;
  patternRisk: number;
  finalScore: number;
};

export type FraudIndicatorDetail = {
  indicatorType: string;
  severity: RiskBand | "Informational";
  description: string;
  evidenceSource: string;
};

export type VendorEvidenceLink = { title: string; link: string };

export type VendorForReport = {
  name: string;
  type: string;
  category: string;
  document: string;
  rating?: number;
  address?: string;
  phone?: string;
  website?: string;
  googleRating?: number;
  googleReviewCount?: number;
  flag?: string | null;
  verified: boolean;
  internalVendorListMatch?: boolean;
  googleEvidenceLinks?: VendorEvidenceLink[];
};

export type ClaimReportInput = {
  referenceNumber: string;
  assessmentDateIso: string;
  currency: string;
  claimedAmount: number;
  policyNumber: string;
  incidentDescription: string;
  claimStatus: string;
  claimType: string;
  score: number;
  riskBand: RiskBand;
  scoreBreakdown: ScoreBreakdown;
  executiveRecommendation: string;
  notes: string;
  recommendation: string;
  coverageStatus: string;
  flags: string[];
  documentAnalysis: DocumentAnalysisRow[];
  allDocumentNames: string[];
  vendors: VendorForReport[];
  extractionNote?: string;
  googleSearchSummary?: GoogleSearchSummaryRow;
  financial: {
    benchmarkAmount: number;
    benchmarkLabel: string;
    variancePercent: number | null;
    reasonablenessIndex: number;
  };
};

export function deriveRiskBand(score: number): RiskBand {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

export function deriveExecutiveRecommendation(score: number): string {
  if (score >= 80) {
    return "**Decline / investigate** — Immediate **SIU referral**; do not process payment pending investigation.";
  }
  if (score >= 60) {
    return "**Enhanced due diligence** — **Manager review** required; obtain supplemental verification before approval.";
  }
  if (score >= 40) {
    return "**Conditional review** — Request **additional documentation** and complete outstanding verification steps.";
  }
  return "**Standard path** — Proceed with **routine underwriting / claims verification** per desk guide.";
}

function riskEmoji(band: RiskBand): string {
  switch (band) {
    case "Critical":
      return "🔴";
    case "High":
      return "🟠";
    case "Medium":
      return "🟡";
    default:
      return "🟢";
  }
}

function mdCell(s: string): string {
  return String(s || "—").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** Human-readable issue type for reports (e.g. suspicious_keyword → Suspicious keyword). */
export function formatIssueTypeLabel(type: string): string {
  const t = type.trim().toLowerCase();
  const map: Record<string, string> = {
    suspicious_keyword: "Suspicious keyword",
    missing_information: "Missing information",
  };
  if (map[t]) return map[t];
  return t
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function googleBusinessSearchUrl(name: string, address?: string): string {
  const q = [name, address].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function flagToIndicator(flag: string): FraudIndicatorDetail {
  const f = flag.toLowerCase();
  let severity: FraudIndicatorDetail["severity"] = "Medium";
  if (
    f.includes("critical") ||
    f.includes("future_date") ||
    f.includes("frequent_claims") ||
    f.includes("siu")
  ) {
    severity = "Critical";
  } else if (
    f.includes("google_not_found") ||
    f.includes("unverified_vendor") ||
    f.includes("high_value") ||
    f.includes("exceptionally") ||
    f.includes("pressure") ||
    f.includes("document_issue_tampering")
  ) {
    severity = "High";
  } else if (
    f.includes("delayed") ||
    f.includes("multiple_claims") ||
    f.includes("nonstandard") ||
    f.includes("vendor_type_mismatch") ||
    f.includes("low_rated")
  ) {
    severity = "Medium";
  } else if (f.includes("document_issue_missing") || f.includes("low")) {
    severity = "Low";
  }

  const readable = flag
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return {
    indicatorType: "Rules engine signal",
    severity,
    description: readable,
    evidenceSource: "Automated fraud rules + claim / document metadata",
  };
}

function docAuthStatus(issues: DocumentIssueRow[]): { status: string; risk: string } {
  if (!issues.length) {
    return { status: "✅ **No automated authenticity concerns**", risk: "Low" };
  }
  const hasCrit = issues.some((i) => i.severity === "critical");
  const hasHigh = issues.some((i) => i.severity === "high");
  if (hasCrit) {
    return {
      status: "❌ **Failed / high concern** — critical findings",
      risk: "Critical",
    };
  }
  if (hasHigh) {
    return {
      status: "⚠️ **Suspicious** — material irregularities detected",
      risk: "High",
    };
  }
  return {
    status: "⚠️ **Review** — minor or moderate findings",
    risk: "Medium",
  };
}

function severityToBand(
  sev: DocumentIssueRow["severity"],
): FraudIndicatorDetail["severity"] {
  if (sev === "critical") return "Critical";
  if (sev === "high") return "High";
  if (sev === "medium") return "Medium";
  return "Low";
}

/** One row per issue type + severity, with documents rolled up (avoids duplicate lines per file). */
function summarizeDocumentIssues(
  documentAnalysis: DocumentAnalysisRow[],
): FraudIndicatorDetail[] {
  const groups = new Map<
    string,
    {
      severity: FraudIndicatorDetail["severity"];
      typeKey: string;
      docs: Set<string>;
      descriptions: string[];
    }
  >();

  for (const doc of documentAnalysis) {
    for (const issue of doc.issues) {
      const key = `${issue.severity}::${issue.type}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          severity: severityToBand(issue.severity),
          typeKey: issue.type,
          docs: new Set(),
          descriptions: [],
        };
        groups.set(key, g);
      }
      g.docs.add(doc.document);
      if (!g.descriptions.includes(issue.description)) {
        g.descriptions.push(issue.description);
      }
    }
  }

  const out: FraudIndicatorDetail[] = [];
  for (const g of groups.values()) {
    const label = formatIssueTypeLabel(g.typeKey);
    const docList = [...g.docs].join(", ");
    const n = g.descriptions.length;
    const desc =
      n <= 2
        ? g.descriptions.join(" ")
        : `${g.descriptions[0]} *(${n} total findings in this category; Section A lists all ${n}.)*`;
    out.push({
      indicatorType: label,
      severity: g.severity,
      description: desc,
      evidenceSource: `Documents: ${docList}`,
    });
  }
  return out;
}

function engineFlagSummarized(flag: string): boolean {
  const exact = new Set([
    "exceptionally_high_value",
    "significant_delay",
    "pressure_language_detected",
    "nonstandard_policy_format",
    "no_vendor_documents",
    "analysis_failed",
  ]);
  if (exact.has(flag)) return true;
  const prefixes = [
    "high_value_claim_",
    "delayed_reporting_",
    "frequent_claims_",
    "multiple_claims_",
    "google_not_found_",
    "unverified_vendor_",
    "low_rated_vendor_",
    "vendor_type_mismatch_",
  ];
  return prefixes.some((p) => flag.startsWith(p));
}

/** Roll up rules-engine flags so Section D does not repeat every document_issue_* line. */
function summarizeEngineFlags(flags: string[]): FraudIndicatorDetail[] {
  const out: FraudIndicatorDetail[] = [];
  const f = flags.filter((x) => !x.startsWith("document_issue_"));

  const hv = f.filter((x) => x.startsWith("high_value_claim_"));
  const ex = f.includes("exceptionally_high_value");
  if (hv.length || ex) {
    const lines: string[] = [];
    if (ex) {
      lines.push("Value is in the exceptionally high band vs. internal reference.");
    }
    if (hv.length) {
      lines.push(
        `Claimed amount exceeds the internal triage reference for: ${hv.map((x) => x.replace(/^high_value_claim_/, "")).join(", ")}.`,
      );
    }
    out.push({
      indicatorType: "Claim amount vs. reference",
      severity: ex ? "High" : "Medium",
      description: lines.join(" "),
      evidenceSource: "Claim amount + line benchmark (rules engine)",
    });
  }

  const delayed = f.filter((x) => x.startsWith("delayed_reporting_"));
  const sigDelay = f.includes("significant_delay");
  if (delayed.length || sigDelay) {
    out.push({
      indicatorType: "Reporting timing",
      severity: sigDelay ? "High" : "Medium",
      description:
        "Reporting delay relative to incident date exceeds typical thresholds.",
      evidenceSource: "Incident date vs. system timeline",
    });
  }

  const fq = f.some((x) => x.startsWith("frequent_claims_"));
  const mq = f.some((x) => x.startsWith("multiple_claims_"));
  if (fq || mq) {
    out.push({
      indicatorType: "Claim frequency (policy)",
      severity: fq ? "High" : "Medium",
      description:
        "Elevated claim count on this policy number within the 90-day lookback window.",
      evidenceSource: "Policy-level history (automated)",
    });
  }

  if (f.includes("pressure_language_detected")) {
    out.push({
      indicatorType: "Narrative tone",
      severity: "High",
      description:
        "Incident narrative contains urgency or pressure phrases flagged by rules.",
      evidenceSource: "Incident description text",
    });
  }

  if (f.includes("nonstandard_policy_format")) {
    out.push({
      indicatorType: "Policy number format",
      severity: "Low",
      description: "Policy number does not match the expected reference pattern.",
      evidenceSource: "Policy metadata",
    });
  }

  const gn = f.filter((x) => x.startsWith("google_not_found_")).length;
  const uv = f.filter((x) => x.startsWith("unverified_vendor_")).length;
  const lr = f.filter((x) => x.startsWith("low_rated_vendor_")).length;
  const vm = f.filter((x) => x.startsWith("vendor_type_mismatch_")).length;
  const noVendor = f.includes("no_vendor_documents");
  if (noVendor || gn || uv || lr || vm) {
    const parts: string[] = [];
    if (noVendor) {
      parts.push(
        "No vendor/service provider could be identified from extractable document text.",
      );
    }
    if (uv) {
      parts.push(`${uv} vendor rule hit(s) for unverified status.`);
    }
    if (gn) {
      parts.push(
        `${gn} vendor(s) without corroborating Google/SerpAPI online match.`,
      );
    }
    if (lr) {
      parts.push(`${lr} low-rating vendor signal(s).`);
    }
    if (vm) {
      parts.push(`${vm} vendor type vs. claim-type mismatch signal(s).`);
    }
    out.push({
      indicatorType: "Vendor / provider (rules summary)",
      severity: gn || uv || noVendor ? "High" : "Medium",
      description: parts.join(" "),
      evidenceSource:
        "Section B + SerpAPI / internal vendor reference (see vendor rows for names)",
    });
  }

  if (f.includes("analysis_failed")) {
    out.push({
      indicatorType: "System",
      severity: "Critical",
      description: "Analysis pipeline error — repeat run or check logs.",
      evidenceSource: "API / service layer",
    });
  }

  const rest = f.filter((x) => !engineFlagSummarized(x));
  const seen = new Set<string>();
  for (const fl of rest) {
    if (seen.has(fl)) continue;
    seen.add(fl);
    out.push(flagToIndicator(fl));
  }

  return out;
}

export function collectFraudIndicatorDetails(
  flags: string[],
  documentAnalysis: DocumentAnalysisRow[],
): FraudIndicatorDetail[] {
  return [
    ...summarizeDocumentIssues(documentAnalysis),
    ...summarizeEngineFlags(flags),
  ];
}

export function buildClaimAnalysisMarkdown(input: ClaimReportInput): string {
  const {
    referenceNumber,
    assessmentDateIso,
    currency,
    claimedAmount,
    policyNumber,
    incidentDescription,
    claimStatus,
    claimType,
    score,
    riskBand,
    scoreBreakdown,
    executiveRecommendation,
    notes,
    recommendation,
    coverageStatus,
    flags,
    documentAnalysis,
    allDocumentNames,
    vendors,
    extractionNote,
    googleSearchSummary,
    financial,
  } = input;

  const assessmentDate = assessmentDateIso.slice(0, 10);
  const fmt = new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: currency || "HKD",
    minimumFractionDigits: 2,
  });
  const claimedStr = fmt.format(claimedAmount);
  const benchStr = fmt.format(financial.benchmarkAmount);
  const varianceStr =
    financial.variancePercent == null
      ? "N/A"
      : `${financial.variancePercent > 0 ? "+" : ""}${financial.variancePercent.toFixed(1)}%`;

  const fraudRows = collectFraudIndicatorDetails(flags, documentAnalysis);
  const docByName = new Map(documentAnalysis.map((d) => [d.document, d.issues]));

  const docSections = allDocumentNames.length
    ? allDocumentNames
    : documentAnalysis.map((d) => d.document);

  let docMd = "";
  for (const name of docSections.length ? docSections : ["(No documents on file)"]) {
    const issues = docByName.get(name) || [];
    const { status, risk } = docAuthStatus(issues);
    docMd += `\n#### ${mdCell(name)}\n\n`;
    docMd += `- **Authentication (automated):** ${status}\n`;
    docMd += `- **Document risk level:** **${risk}**\n`;
    if (issues.length) {
      docMd += `- **Findings:**\n`;
      for (const issue of issues) {
        docMd += `  - **${issue.severity.toUpperCase()}** (${formatIssueTypeLabel(issue.type)}): ${issue.description}\n`;
        docMd += `    - *Recommended action:* ${issue.recommendation}\n`;
      }
    } else {
      docMd += `- **Findings:** No keyword / consistency rules triggered for this file.\n`;
    }
    docMd += `- **Source:** Uploaded claim document (text extraction)\n\n`;
  }

  let vendorMd = "";
  if (!vendors.length) {
    vendorMd =
      extractionNote ||
      "_No vendor or service provider could be identified from extractable document text._\n";
  } else {
    for (const v of vendors) {
      const verified =
        v.verified && !v.flag?.includes("Low Google");
      const statusLabel = v.verified
        ? verified
          ? "✅ **Verified (online corroboration)**"
          : "⚠️ **Verified with caveats**"
        : "❌ **Unverified / failed online check**";
      const internal = v.internalVendorListMatch
        ? "Listed in **internal reference vendor dataset**"
        : "Not matched to internal reference vendor list — **external verification required**";

      const gRating =
        v.googleRating != null
          ? `${v.googleRating}/5${v.googleReviewCount != null ? ` (${v.googleReviewCount} reviews)` : ""}`
          : v.rating != null
            ? `${v.rating}/5 (internal reference rating)`
            : "Not available";

      const maps = mapsSearchUrl(v.address || v.name);
      const bizSearch = googleBusinessSearchUrl(v.name, v.address);

      vendorMd += `\n#### ${mdCell(v.name)}\n\n`;
      vendorMd += `- **Verification status:** ${statusLabel}\n`;
      vendorMd += `- **Internal cross-reference:** ${internal}\n`;
      vendorMd += `- **Google rating (where available):** ${gRating}\n`;
      vendorMd += `- **Address (as extracted / enriched):** ${mdCell(v.address || "—")}\n`;
      vendorMd += `- **Phone:** ${mdCell(v.phone || "—")}\n`;
      vendorMd += `- **Website:** ${
        v.website
          ? `[Link](${v.website.startsWith("http") ? v.website : `https://${v.website}`})`
          : "—"
      }\n`;
      vendorMd += `- **Source document:** ${mdCell(v.document)}\n`;
      if (v.flag) {
        vendorMd += `- **Red flags / notes:** **${mdCell(v.flag)}**\n`;
      }
      vendorMd += `- **Sources:**\n`;
      vendorMd += `  - [Google Maps (search)](${maps})\n`;
      vendorMd += `  - [Google search (business)](${bizSearch})\n`;
      for (const ev of v.googleEvidenceLinks || []) {
        if (ev.link) {
          vendorMd += `  - [${mdCell(ev.title)}](${ev.link})\n`;
        }
      }
      vendorMd += "\n";
    }
  }

  const severityEmoji = (s: string) =>
    s === "Critical"
      ? riskEmoji("Critical")
      : s === "High"
        ? riskEmoji("High")
        : s === "Medium"
          ? riskEmoji("Medium")
          : s === "Low"
            ? riskEmoji("Low")
            : "ℹ️";

  let fraudListMd = "";
  fraudRows.forEach((row, i) => {
    fraudListMd += `${i + 1}. **${mdCell(row.indicatorType)}** (${severityEmoji(row.severity)} **${row.severity}**)\n`;
    fraudListMd += `   - **Description:** ${row.description}\n`;
    fraudListMd += `   - **Evidence:** ${row.evidenceSource}\n\n`;
  });
  if (!fraudListMd) {
    fraudListMd = "_No structured fraud indicators beyond base triage._\n";
  }

  let serpMd = "";
  if (googleSearchSummary && googleSearchSummary.searchesPerformed > 0) {
    serpMd = `\n| Metric | Value |\n|--------|-------|\n`;
    serpMd += `| Searches performed | ${googleSearchSummary.searchesPerformed} |\n`;
    serpMd += `| Vendors with positive online match | ${googleSearchSummary.resultsFound} |\n`;
    serpMd += `| Names corroborated | ${googleSearchSummary.vendorsVerified.join(", ") || "—"} |\n`;
  } else {
    serpMd =
      "\n_Online search evidence was not collected (no SerpAPI key, no vendors to search, or search failed)._ \n";
  }

  const financialRisks: string[] = [];
  if (financial.variancePercent != null && financial.variancePercent > 50) {
    financialRisks.push("Claimed amount materially exceeds internal triage reference for this line.");
  }
  if (financial.variancePercent != null && financial.variancePercent < -30) {
    financialRisks.push("Claimed amount is well below reference — confirm scope and currency.");
  }
  if (!financialRisks.length) {
    financialRisks.push("No standalone financial anomaly flags beyond overall risk score.");
  }

  return `## Executive summary

| Metric | Value |
|--------|-------|
| **Claim reference** | **${mdCell(referenceNumber)}** |
| **Assessment date** | ${assessmentDate} |
| **Claim status** | ${mdCell(claimStatus)} |
| **Policy number** | ${mdCell(policyNumber)} |
| **Claim type (model)** | ${mdCell(claimType)} |
| **Overall risk** | ${riskEmoji(riskBand)} **${riskBand}** (**${score}/100**) |
| **Coverage posture (model)** | ${mdCell(coverageStatus)} |
| **Executive recommendation** | ${executiveRecommendation} |

**Key findings (narrative):** ${mdCell(notes)} ${mdCell(recommendation)}

---

## Risk assessment matrix (desk reference)

| Risk level | Score range | Action required |
|------------|-------------|-----------------|
| 🔴 **Critical** | 80–100 | Immediate **SIU** referral; **do not process** payment |
| 🟠 **High** | 60–79 | **Enhanced due diligence**; **manager sign-off** |
| 🟡 **Medium** | 40–59 | **Additional documentation**; targeted verification |
| 🟢 **Low** | 0–39 | **Standard verification**; normal processing |

_Current modeled score: **${score}/100** → **${riskBand}**._

---

## Detailed findings

### 📄 A. Document authentication & verification

${docMd}

### 🏢 B. Vendor / service provider due diligence

${vendorMd}

### 💰 C. Financial assessment

| Item | Value |
|------|-------|
| **Claimed amount** | ${claimedStr} |
| **Internal triage reference** | ${benchStr} (${mdCell(financial.benchmarkLabel)}) |
| **Variance vs. reference** | ${varianceStr} |
| **Reasonableness index (model)** | **${financial.reasonablenessIndex}/100** *(higher = lower modeled risk; not a guarantee of accuracy)* |

**Financial risk indicators (automated):**

${financialRisks.map((r) => `- ${r}`).join("\n")}

### 🚩 D. Fraud indicators (summarized)

${fraudListMd}

---

## Risk score breakdown

| Component | Points |
|-----------|--------|
| Base score | ${scoreBreakdown.base} |
| Amount risk | +${scoreBreakdown.amountRisk} |
| Vendor / provider risk | +${scoreBreakdown.vendorRisk} |
| Document risk | +${scoreBreakdown.documentRisk} |
| Pattern / behaviour risk | +${scoreBreakdown.patternRisk} |
| **Final modeled score (capped)** | **${scoreBreakdown.finalScore}/100** |

---

## Actionable recommendations

1. **Immediate actions:** Address any **Critical** document or vendor findings before payment authority.
2. **Documentation:** Obtain missing **licences, stamps, signed invoices**, or final repair orders where only estimates were detected.
3. **Verification:** Confirm key vendor contact details **out-of-band** (published phone / official website), especially if not corroborated online.
4. **Approval conditions:** Manager review required for **High** and **Critical** bands; SIU referral per carrier protocol for **Critical**.

---

## Supporting evidence & data sources

${serpMd}

**Note:** Business registration, BBB, and government registry links are **not automated** in this build — investigators should follow jurisdictional lookup procedures. Hyperlinks above are **assistant search entry points** (Google Maps / Google Search / SerpAPI snippets) and must be validated manually.

---

## Incident narrative (as filed)

> ${mdCell(incidentDescription.slice(0, 2000))}${incidentDescription.length > 2000 ? "…" : ""}

---

*Report generated by automated rules engine. **Not legal or coverage advice.** Underwriters must apply policy wording, jurisdiction, and carrier standards.*
`;
}
