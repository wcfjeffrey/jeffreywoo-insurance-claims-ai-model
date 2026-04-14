import type { Pool } from "pg";
import {
  buildClaimAnalysisMarkdown,
  collectFraudIndicatorDetails,
  deriveExecutiveRecommendation,
  deriveRiskBand,
  type FraudIndicatorDetail,
  type RiskBand,
  type ScoreBreakdown,
  type VendorForReport,
} from "./claimAnalysisReport.js";
import { validateVendorOnline } from "./googleSearchService.js";

export type FraudResult = {
  score: number;
  flags: string[];
  coverageLikely: boolean;
  coverageStatus: "likely" | "uncertain" | "unlikely";
  claimType: string;
  notes: string;
  recommendation: string;
  vendorAnalysis: {
    totalFound: number;
    verified: Array<{
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
      googleEvidenceLinks?: Array<{ title: string; link: string }>;
      internalVendorListMatch?: boolean;
    }>;
    unverified: Array<{
      name: string;
      type: string;
      category: string;
      document: string;
      flag?: string;
      rating?: number;
      address?: string;
      phone?: string;
      website?: string;
      googleRating?: number;
      googleReviewCount?: number;
      googleEvidenceLinks?: Array<{ title: string; link: string }>;
      internalVendorListMatch?: boolean;
    }>;
    byClaimType: {
      relevant: number;
      irrelevant: number;
    };
    recommendation: string;
    /** Shown when no vendors were parsed from documents (e.g. scanned PDFs or missing labels). */
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
  /** Desk reference band (80+/60+/40+ per underwriting matrix). */
  riskBand: RiskBand;
  executiveRecommendation: string;
  scoreBreakdown: ScoreBreakdown;
  /** Full markdown report for officers / SIU. */
  reportMarkdown: string;
  financialAssessment: {
    claimedAmount: number;
    currency: string;
    benchmarkAmount: number;
    benchmarkLabel: string;
    variancePercent: number | null;
    reasonablenessIndex: number;
    riskIndicatorSummaries: string[];
  };
  fraudIndicatorsDetailed: FraudIndicatorDetail[];
};

// Comprehensive Vendor Database for All Insurance Types
const VENDOR_DATABASE = {
  auto: {
    repairShops: [
      { name: "ABC Auto Repair Ltd", license: "CAR-12345", verified: true, rating: 4.5, yearsInBusiness: 8 },
      { name: "HK Motor Services", license: "CAR-67890", verified: true, rating: 4.2, yearsInBusiness: 12 },
      { name: "SpeedFix Automotive", license: "CAR-11111", verified: false, rating: 2.1, yearsInBusiness: 1, flag: "Multiple complaints" },
      { name: "Premier Collision Center", license: "CAR-22222", verified: true, rating: 4.8, yearsInBusiness: 15 },
      { name: "Honest Repair Workshop", license: "CAR-33333", verified: true, rating: 4.0, yearsInBusiness: 5 },
      { name: "Lin-dare Automotive", license: "CAR-44444", verified: true, rating: 4.6, yearsInBusiness: 10, address: "113 Spring St, Ossining, NY 10562", phone: "(914) 923-5525" },
    ],
    towing: [
      { name: "HK Towing Services", license: "TOW-12345", verified: true },
      { name: "Quick Tow 24/7", license: "TOW-67890", verified: false, flag: "Unlicensed operator" },
      { name: "Emergency Tow HK", license: "TOW-11111", verified: true },
    ],
    glassReplacement: [
      { name: "GlassFix Pro", license: "GLASS-12345", verified: true },
      { name: "Windshield Experts", license: "GLASS-67890", verified: true },
      { name: "AutoGlass HK", license: "GLASS-99999", verified: false, flag: "No business license" },
    ],
    rental: [
      { name: "Avis Rent-a-Car", license: "RENT-12345", verified: true },
      { name: "Hertz Car Rental", license: "RENT-67890", verified: true },
      { name: "Budget Rental", license: "RENT-11111", verified: true },
    ]
  },
  
  health: {
    hospitals: [
      { name: "City Hospital", license: "HOSP-12345", verified: true, accreditation: "JCI", rating: 4.7 },
      { name: "Central Medical Clinic", license: "CLINIC-67890", verified: true, accreditation: "ISO", rating: 4.3 },
      { name: "Quick Care Medical", license: "CLINIC-99999", verified: false, flag: "Suspected billing fraud" },
      { name: "Hong Kong Sanatorium", license: "HOSP-11111", verified: true, accreditation: "JCI", rating: 4.9 },
      { name: "St. Teresa's Hospital", license: "HOSP-22222", verified: true, rating: 4.6 },
      { name: "Adventist Hospital", license: "HOSP-33333", verified: true, rating: 4.8 },
    ],
    clinics: [
      { name: "Wellness Medical Centre", license: "CLINIC-33333", verified: true },
      { name: "Prime Health Clinic", license: "CLINIC-44444", verified: false, flag: "Out of network" },
      { name: "Family Care Clinic", license: "CLINIC-55555", verified: true },
    ],
    pharmacies: [
      { name: "Watsons Pharmacy", license: "PHARM-12345", verified: true },
      { name: "Mannings Pharmacy", license: "PHARM-67890", verified: true },
      { name: "MediQuick Pharmacy", license: "PHARM-99999", verified: false, flag: "Suspected counterfeit drugs" },
    ],
    specialists: [
      { name: "Dr. Chan Orthopedics", license: "DOC-12345", verified: true, specialty: "Orthopedics" },
      { name: "Dr. Wong Cardiology", license: "DOC-67890", verified: true, specialty: "Cardiology" },
      { name: "Dr. Lee Neurology", license: "DOC-11111", verified: false, flag: "License expired" },
      { name: "Dr. Tam Dermatology", license: "DOC-22222", verified: true, specialty: "Dermatology" },
    ],
    dentists: [
      { name: "Smile Dental Clinic", license: "DENT-12345", verified: true },
      { name: "Perfect Teeth Center", license: "DENT-67890", verified: false, flag: "Overcharging complaints" },
    ]
  },
  
  property: {
    contractors: [
      { name: "Elite Construction Ltd", license: "CON-12345", verified: true, rating: 4.4 },
      { name: "ProRepair Services", license: "CON-67890", verified: true, rating: 4.1 },
      { name: "FastFix Builders", license: "CON-99999", verified: false, flag: "Multiple complaints about quality" },
      { name: "Premier Renovation", license: "CON-11111", verified: true, rating: 4.6 },
      { name: "TrustHome Repairs", license: "CON-22222", verified: true, rating: 4.3 },
    ],
    electricians: [
      { name: "SafeWire Electric", license: "ELEC-12345", verified: true },
      { name: "PowerMaster Electrical", license: "ELEC-67890", verified: false, flag: "Uncertified electrician" },
    ],
    plumbers: [
      { name: "FlowFix Plumbing", license: "PLUMB-12345", verified: true },
      { name: "Rapid Pipe Solutions", license: "PLUMB-67890", verified: true },
      { name: "Drain Pro HK", license: "PLUMB-99999", verified: true },
    ],
    restoration: [
      { name: "Disaster Recovery HK", license: "REST-12345", verified: true },
      { name: "Water Damage Pro", license: "REST-67890", verified: false, flag: "Inflated estimates reported" },
    ],
    roofers: [
      { name: "Top Roof Construction", license: "ROOF-12345", verified: true },
      { name: "Leak Proof Roofing", license: "ROOF-67890", verified: false, flag: "No valid insurance" },
    ]
  },
  
  travel: {
    airlines: [
      { name: "Cathay Pacific", code: "CX", verified: true },
      { name: "Hong Kong Airlines", code: "HX", verified: true },
      { name: "Budget Air", code: "BA", verified: false, flag: "High complaint rate" },
      { name: "Singapore Airlines", code: "SQ", verified: true },
    ],
    hotels: [
      { name: "Marriott Hotel", verified: true, rating: 4.8 },
      { name: "Hilton HK", verified: true, rating: 4.7 },
      { name: "Budget Inn", verified: false, flag: "No business license" },
      { name: "Four Seasons Hotel", verified: true, rating: 4.9 },
    ],
    travelAgencies: [
      { name: "WWPKG Travel", license: "TRAV-12345", verified: true },
      { name: "EGL Tours", license: "TRAV-67890", verified: true },
      { name: "Travel Expert", license: "TRAV-11111", verified: false, flag: "Customer complaints" },
    ],
    tourOperators: [
      { name: "Local Tour HK", license: "TOUR-12345", verified: true },
      { name: "Adventure Asia", license: "TOUR-67890", verified: true },
    ]
  },
  
  life: {
    funeralServices: [
      { name: "Dignity Funeral Services", license: "FUN-12345", verified: true },
      { name: "Eternal Peace", license: "FUN-67890", verified: false, flag: "Overcharging complaints" },
      { name: "Heavenly Care", license: "FUN-11111", verified: true },
    ],
    medicalExaminers: [
      { name: "Dr. Smith Medical Examiner", license: "ME-12345", verified: true },
      { name: "Dr. Jones Forensic Services", license: "ME-67890", verified: true },
      { name: "HK Medical Examiner Office", license: "ME-99999", verified: true },
    ],
    crematoriums: [
      { name: "Cape Collinson Crematorium", license: "CREM-12345", verified: true },
      { name: "Peaceful Gardens", license: "CREM-67890", verified: false, flag: "Unlicensed facility" },
    ]
  },
  
  general: {
    lawyers: [
      { name: "Chan & Associates Law Firm", license: "LAW-12345", verified: true },
      { name: "Wong Legal Services", license: "LAW-67890", verified: false, flag: "Disciplinary action pending" },
      { name: "Lee & Co Solicitors", license: "LAW-11111", verified: true },
    ],
    adjusters: [
      { name: "ClaimsPro Adjusters", license: "ADJ-12345", verified: true },
      { name: "Precision Claims Services", license: "ADJ-67890", verified: true },
      { name: "FastClaim Adjusting", license: "ADJ-99999", verified: false, flag: "Complaints about delays" },
    ],
    investigators: [
      { name: "Elite Investigation Agency", license: "INV-12345", verified: true },
      { name: "Quick Intel Services", license: "INV-67890", verified: false, flag: "Complaints about unprofessional conduct" },
    ],
    appraisers: [
      { name: "HK Appraisal Services", license: "APP-12345", verified: true },
      { name: "ValuePro Appraisals", license: "APP-67890", verified: true },
    ]
  }
};

const DOCUMENT_ANALYSIS_PATTERNS = {
  suspiciousKeywords: [
    "emergency", "urgent", "asap", "immediate payment",
    "revised", "amended", "corrected", "updated version",
    "duplicate", "copy of original", "replacement",
    "estimate", "quote", "proposal", "bid"
  ],
  
  missingInfo: [
    "license", "certificate", "registration", "tax id",
    "signature", "stamp", "seal", "authorized",
    "invoice number", "date", "amount"
  ],
  
  unreasonablePatterns: [
    { pattern: /(\d+[\.,]\d{2})\s*-\s*(\d+[\.,]\d{2})/g, description: "Price range too wide", severity: "medium" },
    { pattern: /same\s+day|24\s*hours?/gi, description: "Unrealistic turnaround time", severity: "high" },
    { pattern: /100%\s+(?:covered|paid)/gi, description: "Guaranteed full coverage claim", severity: "high" },
    { pattern: /no\s+(?:deductible|excess)/gi, description: "Claims of no deductible - verify", severity: "medium" },
    { pattern: /waiver\s+of\s+(?:deductible|excess)/gi, description: "Deductible waiver claimed", severity: "medium" },
  ],
  
  highAmountThreshold: 100000,
  veryHighAmountThreshold: 500000
};

function cleanVendorLine(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,;|]+$/, "")
    .replace(/^\s*[-–—]\s*/, "")
    .substring(0, 150);
}

function normalizeExtractedWebsite(raw: string): string {
  let w = raw.trim().replace(/^[<\[(]+|[\])>.,;]+$/g, "");
  if (!w) return w;
  if (!/^https?:\/\//i.test(w)) w = `https://${w}`;
  return w;
}

/** True if URL is likely boilerplate from Office/XML, not a vendor site. */
function isNoiseWebsiteUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    /schemas\.microsoft\.com|office\.com|w3\.org|openxmlformats|purl\.org|xmlns/i.test(
      u,
    ) || u.length < 12
  );
}

/** Pull address / phone / website from common inspection-report labels (mixed case). */
function extractContactFields(text: string): {
  address?: string;
  phone?: string;
  website?: string;
} {
  const out: { address?: string; phone?: string; website?: string } = {};
  const addr = text.match(
    /(?:address|location|營業地址|地址)\s*[:\-=]\s*([^\n\r]{5,220})/i,
  );
  if (addr) out.address = cleanVendorLine(addr[1]);

  const ph = text.match(
    /(?:phone|tel|mobile|fax|contact|hotline|電話|聯絡電話)\s*[:\-=]\s*([+()\d][\d\s\-().]{6,32})/i,
  );
  if (ph) out.phone = ph[1].replace(/\s+/g, " ").trim();

  if (!out.phone) {
    const hk = text.match(/\+852[\s\-]?(\d{4}[\s\-]?\d{4})/);
    if (hk) out.phone = `+852 ${hk[1].replace(/\D/g, "")}`;
  }

  const trySetWebsite = (candidate: string | undefined) => {
    if (!candidate) return;
    const n = normalizeExtractedWebsite(candidate);
    if (n && !isNoiseWebsiteUrl(n)) out.website = n;
  };

  // 1) Explicit labels (optional colon; allow bare domain after label)
  const labeled = text.match(
    /(?:website|web\s*site|web\s*page|company\s*website|homepage|home\s*page|internet|online|url|網址|網站|公司網頁)\s*[:\-=]?\s*(https?:\/\/[^\s<>"')\],]{4,220}|www\.[^\s<>"')\],]{4,220}|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:\/[^\s<>"')\],]*)?)/i,
  );
  if (labeled?.[1]) trySetWebsite(labeled[1]);

  // 2) Markdown / Word-style link targets
  if (!out.website) {
    const md = text.match(/\]\(\s*(https?:\/\/[^)\s]+)\s*\)/i);
    if (md?.[1]) trySetWebsite(md[1]);
  }
  if (!out.website) {
    const h = text.match(/HYPERLINK\s+"?(https?:\/\/[^"\s]+)"?/i);
    if (h?.[1]) trySetWebsite(h[1]);
  }

  // 3) First substantive https URL in body (skip Office/schema noise)
  if (!out.website) {
    const urls = text.matchAll(/\b(https?:\/\/[^\s<>"')\],]{6,220})/gi);
    for (const m of urls) {
      if (m[1] && !isNoiseWebsiteUrl(m[1])) {
        trySetWebsite(m[1]);
        break;
      }
    }
  }

  // 4) www. domain
  if (!out.website) {
    const www = text.match(
      /\b(www\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:\/[^\s<>"')\],]*)?)\b/i,
    );
    if (www?.[1]) trySetWebsite(www[1]);
  }

  // 5) Bare corporate domain on its own line (e.g. "lindareauto.com")
  if (!out.website) {
    const bare = text.match(
      /(?:^|[\s:：])([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?){1,4}\.(?:com|net|org|hk|io|co|biz|info|edu|gov)(?:\/[^\s)\]>"',]*)?)(?:\s|$|[,;])/im,
    );
    if (bare?.[1] && !/^www\./i.test(bare[1]) && bare[1].includes(".")) {
      trySetWebsite(bare[1]);
    }
  }

  return out;
}

function extractVendorNamesFromLabels(text: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const patterns = [
    /(?:vendor|service\s*provider|inspection\s*(?:cent(?:er|re)|company|agency)|repair(?:er|s)?|garage|workshop|body\s*shop|motor\s*vehicle|auto\s*shop|vehicle\s*repair|authorised\s*repairer|authorized\s*repairer|測試中心|維修中心)\s*(?:name|details)?\s*[:\-=]\s*([^\n\r]{2,150})/gi,
    /(?:company|business|firm)\s*name\s*[:\-=]\s*([^\n\r]{2,150})/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const n = cleanVendorLine(m[1]);
      if (n.length < 2 || /^n\/?a$/i.test(n)) continue;
      const k = n.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        names.push(n);
      }
    }
  }
  return names;
}

// Extract business information from document text (pass original casing — not lowercased).
function extractBusinessInfo(text: string): Array<{
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  confidence: string;
}> {
  const raw = text || "";
  if (raw.trim().length < 3) return [];

  const contacts = extractContactFields(raw);
  const fromLabels = extractVendorNamesFromLabels(raw);
  const businesses: Array<{
    name: string;
    address?: string;
    phone?: string;
    website?: string;
    confidence: string;
  }> = [];

  for (const name of fromLabels) {
    businesses.push({
      name,
      ...contacts,
      confidence: "high",
    });
  }

  if (businesses.length === 0) {
    const businessPatterns = [
      /([A-Za-z0-9\u4e00-\u9fff][A-Za-z0-9\u4e00-\u9fff\s&'.,\-]{1,80})\s+(?:Auto|Repair|Automotive|Service|Motors?|Garage|Workshop|Clinic|Hospital|Medical|Construction|Electric|Plumbing)/gi,
      /^([A-Za-z0-9\u4e00-\u9fff][A-Za-z0-9\u4e00-\u9fff\s&'.-]+)\s+(?:LTD|LLC|INC|CORP)\b/gim,
      /^([A-Z][A-Z0-9\s&\-]{2,50})\s+(?:AUTO|REPAIR|SERVICE|MOTORS)/gm,
      /([A-Za-z0-9\u4e00-\u9fff][A-Za-z0-9\u4e00-\u9fff\s&'.,\-]{1,80})\s+(?:Company|Corporation|Inc|Ltd)\b/gi,
    ];

    for (const bp of businessPatterns) {
      const matches = raw.match(bp);
      if (matches) {
        for (const match of matches.slice(0, 3)) {
          const name = cleanVendorLine(match);
          if (name.length > 3) {
            businesses.push({
              name,
              ...contacts,
              confidence: "high",
            });
          }
        }
        if (businesses.length > 0) break;
      }
    }
  }

  if (businesses.length === 0 && (contacts.website || contacts.phone) && contacts.address) {
    const host = contacts.website
      ? (() => {
          try {
            const u = contacts.website!.replace(/^www\./i, "https://");
            const h = new URL(
              /^https?:/i.test(u) ? u : `https://${u}`,
            ).hostname.replace(/^www\./i, "");
            const brand = h.split(".")[0] || "";
            const block = new Set(["gmail", "yahoo", "hotmail", "outlook", "icloud"]);
            if (brand.length >= 3 && !block.has(brand.toLowerCase())) {
              return brand.replace(/-/g, " ");
            }
          } catch {
            /* ignore */
          }
          return "";
        })()
      : "";
    if (host) {
      businesses.push({
        name: host,
        ...contacts,
        confidence: "low",
      });
    }
  }

  const unique: typeof businesses = [];
  const keys = new Set<string>();
  for (const b of businesses) {
    const k = b.name.toLowerCase();
    if (!keys.has(k)) {
      keys.add(k);
      unique.push(b);
    }
  }
  return unique;
}

async function extractVendorsFromDocuments(claimId: string, pool: Pool): Promise<{
  extractedVendors: Array<any>;
  documentAnalysis: Array<any>;
  meta: { documentCount: number; totalTextLength: number };
}> {
  const { rows: documents } = await pool.query(
    `SELECT id, original_name, storage_path, extracted_text FROM claim_documents WHERE claim_id = $1::uuid`,
    [claimId],
  );

  const extractedVendors: Array<any> = [];
  const documentAnalysis: Array<any> = [];
  let totalTextLength = 0;

  for (const doc of documents) {
    const rawText = doc.extracted_text || "";
    totalTextLength += rawText.length;
    const docName = doc.original_name.toLowerCase();
    const docText = rawText.toLowerCase();
    const contacts = extractContactFields(rawText);

    const contentIssues = analyzeDocumentContent(docName, docText);
    if (contentIssues.length > 0) {
      documentAnalysis.push({
        document: doc.original_name,
        issues: contentIssues,
      });
    }

    const extractedBusinesses = extractBusinessInfo(rawText);

    for (const business of extractedBusinesses) {
      let matched = false;

      for (const [insuranceType, categories] of Object.entries(VENDOR_DATABASE)) {
        for (const [category, vendors] of Object.entries(
          categories as Record<string, any[]>,
        )) {
          for (const vendor of vendors) {
            if (
              docText.includes(vendor.name.toLowerCase()) ||
              business.name.toLowerCase().includes(vendor.name.toLowerCase()) ||
              vendor.name
                .toLowerCase()
                .includes(business.name.toLowerCase().substring(0, 15))
            ) {
              extractedVendors.push({
                name: vendor.name,
                type: `${insuranceType}.${category}`,
                category: category,
                insuranceType: insuranceType,
                verified: vendor.verified,
                flag: vendor.flag || null,
                rating: vendor.rating || null,
                address: vendor.address || business.address || contacts.address,
                phone: vendor.phone || business.phone || contacts.phone,
                website: vendor.website || business.website || contacts.website,
                document: doc.original_name,
                confidence: "high",
                internalVendorListMatch: true,
              });
              matched = true;
              break;
            }
          }
          if (matched) break;
        }
        if (matched) break;
      }

      if (!matched && business.name && business.name.length > 3) {
        extractedVendors.push({
          name: business.name,
          type: "unknown",
          category: "unknown",
          insuranceType: "unknown",
          verified: false,
          flag: "Vendor not in approved database - requires verification",
          address: business.address || contacts.address,
          phone: business.phone || contacts.phone,
          website: business.website || contacts.website,
          document: doc.original_name,
          confidence: business.confidence,
          internalVendorListMatch: false,
        });
      }
    }

    for (const [insuranceType, categories] of Object.entries(VENDOR_DATABASE)) {
      for (const [category, vendors] of Object.entries(
        categories as Record<string, any[]>,
      )) {
        for (const vendor of vendors) {
          if (docText.includes(vendor.name.toLowerCase())) {
            const alreadyAdded = extractedVendors.some((v) => v.name === vendor.name);
            if (!alreadyAdded) {
              extractedVendors.push({
                name: vendor.name,
                type: `${insuranceType}.${category}`,
                category: category,
                insuranceType: insuranceType,
                verified: vendor.verified,
                flag: vendor.flag || null,
                rating: vendor.rating || null,
                address: vendor.address || contacts.address,
                phone: vendor.phone || contacts.phone,
                website: vendor.website || contacts.website,
                document: doc.original_name,
                confidence: "high",
                internalVendorListMatch: true,
              });
            }
          }
        }
      }
    }
  }

  const uniqueVendors = [];
  const vendorNames = new Set();
  for (const vendor of extractedVendors) {
    if (!vendorNames.has(vendor.name)) {
      vendorNames.add(vendor.name);
      uniqueVendors.push(vendor);
    }
  }

  return {
    extractedVendors: uniqueVendors,
    documentAnalysis,
    meta: {
      documentCount: documents.length,
      totalTextLength,
    },
  };
}

function analyzeDocumentContent(fileName: string, documentText: string): Array<{
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  recommendation: string;
}> {
  const issues: Array<any> = [];
  
  for (const keyword of DOCUMENT_ANALYSIS_PATTERNS.suspiciousKeywords) {
    if (documentText.includes(keyword.toLowerCase())) {
      issues.push({
        type: "suspicious_keyword",
        severity: "medium",
        description: `Document contains suspicious keyword: "${keyword}"`,
        recommendation: "Verify the context and authenticity of this document"
      });
    }
  }
  
  for (const missing of DOCUMENT_ANALYSIS_PATTERNS.missingInfo) {
    if (!documentText.includes(missing.toLowerCase())) {
      issues.push({
        type: "missing_information",
        severity: "low",
        description: `Document may be missing: "${missing}"`,
        recommendation: "Request complete documentation with all required information"
      });
    }
  }
  
  for (const pattern of DOCUMENT_ANALYSIS_PATTERNS.unreasonablePatterns) {
    if (pattern.pattern.test(documentText)) {
      issues.push({
        type: "unreasonable_content",
        severity: pattern.severity as "low" | "medium" | "high",
        description: pattern.description,
        recommendation: "Review this document carefully for potential fraud indicators"
      });
    }
  }
  
  const amountMatches = documentText.match(/(\d+[\.,]\d{2})/g) || [];
  for (const amountStr of amountMatches) {
    const amount = parseFloat(amountStr.replace(/,/g, ''));
    if (amount > DOCUMENT_ANALYSIS_PATTERNS.veryHighAmountThreshold) {
      issues.push({
        type: "very_high_amount",
        severity: "high",
        description: `Exceptionally high amount detected: ${amountStr}`,
        recommendation: "Verify the reason for this amount and request supporting documentation"
      });
      break;
    } else if (amount > DOCUMENT_ANALYSIS_PATTERNS.highAmountThreshold) {
      issues.push({
        type: "high_amount",
        severity: "medium",
        description: `High amount detected: ${amountStr}`,
        recommendation: "Verify this amount against market rates"
      });
      break;
    }
  }
  
  const tamperingIndicators = [
    "revised", "amended", "corrected", "updated version",
    "replacement", "duplicate", "copy of original", "modified"
  ];
  
  for (const indicator of tamperingIndicators) {
    if (documentText.includes(indicator)) {
      issues.push({
        type: "tampering_indicator",
        severity: "high",
        description: `Document may be a revised/corrected version - indicator: "${indicator}"`,
        recommendation: "Request original version and verify all changes"
      });
      break;
    }
  }
  
  const datePattern = /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/gi;
  const dates = documentText.match(datePattern) || [];
  const today = new Date();
  
  for (const dateStr of dates) {
    const docDate = new Date(dateStr);
    if (!isNaN(docDate.getTime())) {
      if (docDate > today) {
        issues.push({
          type: "future_date",
          severity: "critical",
          description: `Document has future date: ${dateStr}`,
          recommendation: "This is a clear fraud indicator - investigate immediately"
        });
      }
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      if (docDate < twoYearsAgo) {
        issues.push({
          type: "old_date",
          severity: "medium",
          description: `Document is over 2 years old: ${dateStr}`,
          recommendation: "Verify if this document is still valid for this claim"
        });
      }
    }
  }
  
  return issues;
}

function determineClaimType(description: string, policyNumber: string): string {
  const desc = description.toLowerCase();
  const policy = policyNumber.toLowerCase();
  
  if (desc.includes('car') || desc.includes('auto') || desc.includes('accident') || 
      desc.includes('vehicle') || desc.includes('collision')) {
    return "auto";
  }
  if (desc.includes('medical') || desc.includes('hospital') || desc.includes('doctor') ||
      desc.includes('clinic') || desc.includes('treatment') || desc.includes('surgery')) {
    return "health";
  }
  if (desc.includes('property') || desc.includes('home') || desc.includes('fire') || 
      desc.includes('flood') || desc.includes('water damage') || desc.includes('theft')) {
    return "property";
  }
  if (desc.includes('travel') || desc.includes('flight') || desc.includes('hotel') ||
      desc.includes('luggage') || desc.includes('trip')) {
    return "travel";
  }
  if (desc.includes('life') || desc.includes('death') || desc.includes('funeral') ||
      desc.includes('cremation') || desc.includes('burial')) {
    return "life";
  }
  if (policy.includes('life')) {
    return "life";
  }
  if (policy.includes('travel')) {
    return "travel";
  }
  if (policy.includes('auto') || policy.includes('car')) {
    return "auto";
  }
  if (policy.includes('health') || policy.includes('medical')) {
    return "health";
  }
  if (policy.includes('property') || policy.includes('home')) {
    return "property";
  }
  
  return "general";
}

export async function analyzeClaimFraud(
  pool: Pool,
  claimId: string,
): Promise<FraudResult> {
  try {
    const { rows } = await pool.query<{
      claimed_amount: string;
      incident_description: string;
      policy_number: string;
      incident_date: Date;
      status: string;
      reference_number: string;
      currency: string;
    }>(
      `SELECT claimed_amount, incident_description, policy_number, incident_date, status, reference_number, currency
       FROM claims WHERE id = $1::uuid`,
      [claimId],
    );

    if (!rows.length) {
      const emptyBreakdown: ScoreBreakdown = {
        base: 0,
        amountRisk: 0,
        vendorRisk: 0,
        documentRisk: 0,
        patternRisk: 0,
        finalScore: 0,
      };
      return {
        score: 0,
        flags: [],
        coverageLikely: false,
        coverageStatus: "uncertain",
        claimType: "unknown",
        notes: "Claim not found",
        recommendation: "Unable to analyze - claim not found",
        vendorAnalysis: {
          totalFound: 0,
          verified: [],
          unverified: [],
          byClaimType: { relevant: 0, irrelevant: 0 },
          recommendation: "No vendors found",
        },
        documentAnalysis: [],
        riskBand: "Low",
        executiveRecommendation: deriveExecutiveRecommendation(0),
        scoreBreakdown: emptyBreakdown,
        reportMarkdown:
          "# INSURANCE CLAIM ANALYSIS REPORT\n\n## ERROR\n\n**Claim not found.** No analysis could be generated.\n",
        financialAssessment: {
          claimedAmount: 0,
          currency: "HKD",
          benchmarkAmount: 0,
          benchmarkLabel: "N/A",
          variancePercent: null,
          reasonablenessIndex: 100,
          riskIndicatorSummaries: [],
        },
        fraudIndicatorsDetailed: [],
      };
    }

    const claim = rows[0];
    const { rows: docNameRows } = await pool.query<{ original_name: string }>(
      `SELECT original_name FROM claim_documents WHERE claim_id = $1::uuid ORDER BY created_at ASC`,
      [claimId],
    );
    const allDocumentNames = docNameRows.map((r) => r.original_name);

    const amount = Number(claim.claimed_amount);
    const description = claim.incident_description || "";
    const descLower = description.toLowerCase();
    const flags: string[] = [];

    const bd = {
      base: 10,
      amountRisk: 0,
      vendorRisk: 0,
      documentRisk: 0,
      patternRisk: 0,
    };
    let score = bd.base;
    const addAmount = (n: number) => {
      bd.amountRisk += n;
      score += n;
    };
    const addVendor = (n: number) => {
      bd.vendorRisk += n;
      score += n;
    };
    const addDocument = (n: number) => {
      bd.documentRisk += n;
      score += n;
    };
    const addPattern = (n: number) => {
      bd.patternRisk += n;
      score += n;
    };
    
    const claimType = determineClaimType(description, claim.policy_number);
    const { extractedVendors, documentAnalysis, meta: docMeta } =
      await extractVendorsFromDocuments(claimId, pool);

    let extractionNote: string | undefined;
    if (extractedVendors.length === 0) {
      if (docMeta.documentCount === 0) {
        extractionNote =
          "No documents are attached to this claim yet. Upload an inspection or repair document that includes the vendor or garage name.";
      } else if (docMeta.totalTextLength < 20) {
        extractionNote =
          "Attached files contain almost no extractable text (typical for scanned PDFs or photos). The system cannot read vendor details until there is selectable text—try exporting a text-based PDF from the garage, or add a short text note with Vendor Name, Address, Phone, and Website.";
      } else {
        extractionNote =
          "No vendor or garage name was detected in the extracted text. Use clear labels such as Vendor Name:, Garage:, Repairer:, or Company Name: followed by the business name, or include a recognizable name with words like Auto, Repair, or Garage.";
      }
    }

    // Google Search Validation for each vendor
    const googleSearchSummary = {
      searchesPerformed: 0,
      resultsFound: 0,
      vendorsVerified: [] as string[]
    };
    
    for (const vendor of extractedVendors) {
      vendor.googleEvidenceLinks = [];
      try {
        console.log(`[Google Search] Validating vendor: ${vendor.name}`);
        const validation = await validateVendorOnline(vendor.name, vendor.address, {
          website: vendor.website,
          phone: vendor.phone,
        });
        googleSearchSummary.searchesPerformed++;
        vendor.googleEvidenceLinks = validation.evidenceLinks ?? [];

        const kgWeb = validation.website;
        if (kgWeb && !vendor.website) {
          vendor.website =
            typeof kgWeb === "string" ? kgWeb.trim() : String(kgWeb);
        }

        if (validation.exists && validation.verified) {
          vendor.verified = true;
          if (
            vendor.flag ===
            "Vendor not in approved database - requires verification"
          ) {
            vendor.flag = null;
          }
          vendor.googleRating = validation.rating;
          vendor.googleReviewCount = validation.reviewCount;
          if (validation.address) vendor.address = validation.address;
          if (validation.phone) vendor.phone = validation.phone;
          if (!vendor.flag && validation.rating && validation.rating < 3) {
            vendor.flag = `Low Google rating: ${validation.rating}/5 (${validation.reviewCount || 0} reviews)`;
          }
          googleSearchSummary.resultsFound++;
          googleSearchSummary.vendorsVerified.push(vendor.name);
        } else if (!validation.exists) {
          vendor.verified = false;
          vendor.flag = vendor.flag || "Business not found in Google search results";
          addVendor(10);
          flags.push(`google_not_found_${vendor.name.replace(/\s/g, "_")}`);
        }
        
        if (validation.requiresManualVerification) {
          vendor.flag = vendor.flag || "Manual verification required - Google search unavailable";
        }
      } catch (error) {
        console.error(`Google search failed for ${vendor.name}:`, error);
        vendor.flag = vendor.flag || "Google verification temporarily unavailable";
      }
    }
    
    const amountThresholds: Record<string, number> = {
      auto: 100000,
      health: 50000,
      property: 200000,
      travel: 20000,
      life: 500000,
      general: 100000
    };
    const threshold = amountThresholds[claimType] || amountThresholds.general;
    
    if (amount > threshold) {
      addAmount(15);
      flags.push(`high_value_claim_${claimType}`);
    }
    if (amount > threshold * 3) {
      addAmount(15);
      flags.push("exceptionally_high_value");
    }

    if (claim.incident_date) {
      const daysSinceIncident = Math.floor(
        (Date.now() - new Date(claim.incident_date).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysSinceIncident > 30) {
        addPattern(10);
        flags.push(`delayed_reporting_${daysSinceIncident}_days`);
      }
      if (daysSinceIncident > 90) {
        addPattern(10);
        flags.push("significant_delay");
      }
    }

    const dup = await pool.query(
      `SELECT count(*)::int AS c FROM claims WHERE policy_number = $1 AND id <> $2::uuid AND created_at > NOW() - INTERVAL '90 days'`,
      [claim.policy_number, claimId],
    );
    if (dup.rows[0].c > 2) {
      addPattern(20);
      flags.push(`frequent_claims_${dup.rows[0].c}_in_90days`);
    } else if (dup.rows[0].c > 0) {
      addPattern(10);
      flags.push(`multiple_claims_${dup.rows[0].c}_recent`);
    }

    const suspiciousPhrases = [
      "cash",
      "urgent",
      "today",
      "wire me",
      "immediate",
      "asap",
      "emergency",
    ];
    let hasSuspiciousLang = false;
    for (const phrase of suspiciousPhrases) {
      if (descLower.includes(phrase)) {
        hasSuspiciousLang = true;
        break;
      }
    }
    if (hasSuspiciousLang) {
      addPattern(15);
      flags.push("pressure_language_detected");
    }

    if (!claim.policy_number?.startsWith("POL-")) {
      addPattern(5);
      flags.push("nonstandard_policy_format");
    }

    const verifiedVendors = extractedVendors.filter((v) => v.verified);
    const unverifiedVendors = extractedVendors.filter((v) => !v.verified);

    if (unverifiedVendors.length > 0) {
      addVendor(25);
      for (const vendor of unverifiedVendors) {
        flags.push(
          `unverified_vendor_${vendor.name.replace(/\s/g, "_")}_${vendor.category}`,
        );
      }
    }

    if (extractedVendors.length === 0) {
      addVendor(20);
      flags.push("no_vendor_documents");
    }
    
    let criticalIssues = 0;
    let highIssues = 0;
    for (const docAnalysis of documentAnalysis) {
      for (const issue of docAnalysis.issues) {
        if (issue.severity === "critical") {
          criticalIssues++;
          addDocument(20);
        } else if (issue.severity === "high") {
          highIssues++;
          addDocument(15);
        } else if (issue.severity === "medium") {
          addDocument(10);
        } else {
          addDocument(5);
        }
        flags.push(
          `document_issue_${issue.type}_${docAnalysis.document.replace(/[^a-zA-Z0-9]/g, "_")}`,
        );
      }
    }
    
    const relevantVendors = extractedVendors.filter(v => v.insuranceType === claimType);
    const irrelevantVendors = extractedVendors.filter(v => v.insuranceType !== claimType && v.insuranceType !== "unknown");
    
    if (irrelevantVendors.length > 0) {
      addPattern(15);
      for (const vendor of irrelevantVendors) {
        flags.push(
          `vendor_type_mismatch_${vendor.name.replace(/\s/g, "_")}_${vendor.insuranceType}_vs_${claimType}`,
        );
      }
    }

    const lowRatedVendors = extractedVendors.filter(
      (v) =>
        (v.rating && v.rating < 3) ||
        (v.googleRating && v.googleRating < 3),
    );
    if (lowRatedVendors.length > 0) {
      addVendor(10);
      for (const vendor of lowRatedVendors) {
        const rating = vendor.googleRating || vendor.rating;
        flags.push(
          `low_rated_vendor_${vendor.name.replace(/\s/g, "_")}_rating_${rating}`,
        );
      }
    }

    score = Math.min(100, Math.round(score));
    const scoreBreakdown: ScoreBreakdown = {
      base: bd.base,
      amountRisk: bd.amountRisk,
      vendorRisk: bd.vendorRisk,
      documentRisk: bd.documentRisk,
      patternRisk: bd.patternRisk,
      finalScore: score,
    };

    let coverageStatus: "likely" | "uncertain" | "unlikely";
    let coverageLikely: boolean;
    let recommendation: string;

    if (score >= 80) {
      coverageStatus = "unlikely";
      coverageLikely = false;
      recommendation =
        "CRITICAL RISK (80+) — **SIU referral**; do not process payment pending investigation.";
    } else if (score >= 60) {
      coverageStatus = "unlikely";
      coverageLikely = false;
      recommendation =
        "HIGH RISK (60–79) — **Enhanced due diligence** and **manager approval** required.";
    } else if (score >= 40) {
      coverageStatus = "uncertain";
      coverageLikely = false;
      recommendation =
        "MEDIUM RISK (40–59) — **Additional documentation** and targeted verification before approval.";
    } else {
      coverageStatus = "likely";
      coverageLikely = true;
      recommendation =
        "LOW RISK (0–39) — **Standard verification**; proceed per desk guide.";
    }

    if (unverifiedVendors.length > 0) {
      recommendation += " Verify all unverified vendors before processing.";
    }

    if (documentAnalysis.length > 0) {
      recommendation += " Review flagged document issues carefully.";
    }

    if (criticalIssues > 0) {
      recommendation =
        "CRITICAL DOCUMENT ISSUES — Immediate fraud investigation required. " + recommendation;
    }

    let notes = "";
    if (score >= 80) {
      notes = "Critical modeled risk band — SIU / fraud unit engagement recommended.";
    } else if (score >= 60) {
      notes = "High modeled risk — senior review and enhanced verification recommended.";
    } else if (score >= 40) {
      notes = "Moderate risk indicators — additional verification suggested.";
    } else {
      notes = "Within typical parameters for automated triage.";
    }

    const riskBand = deriveRiskBand(score);
    const executiveRecommendation = deriveExecutiveRecommendation(score);
    const variancePercent =
      threshold > 0 ? ((amount - threshold) / threshold) * 100 : null;
    const reasonablenessIndex = Math.max(0, Math.min(100, 100 - score));
    const financialRiskSummaries: string[] = [];
    if (variancePercent != null && variancePercent > 50) {
      financialRiskSummaries.push(
        "Claimed amount materially exceeds internal triage reference for this line.",
      );
    }
    if (variancePercent != null && variancePercent < -30) {
      financialRiskSummaries.push(
        "Claimed amount is well below reference — confirm scope and currency.",
      );
    }
    if (!financialRiskSummaries.length) {
      financialRiskSummaries.push(
        "No standalone financial anomaly flags beyond overall risk score.",
      );
    }

    const financialAssessment = {
      claimedAmount: amount,
      currency: claim.currency || "HKD",
      benchmarkAmount: threshold,
      benchmarkLabel: `Internal triage reference (${claimType})`,
      variancePercent,
      reasonablenessIndex,
      riskIndicatorSummaries: financialRiskSummaries,
    };

    const vendorsForReport: VendorForReport[] = extractedVendors.map((v) => ({
      name: v.name,
      type: v.type,
      category: v.category,
      document: v.document,
      rating: v.rating,
      address: v.address,
      phone: v.phone,
      website: v.website,
      googleRating: v.googleRating,
      googleReviewCount: v.googleReviewCount,
      flag: v.flag,
      verified: !!v.verified,
      internalVendorListMatch: !!v.internalVendorListMatch,
      googleEvidenceLinks: v.googleEvidenceLinks,
    }));

    const fraudIndicatorsDetailed = collectFraudIndicatorDetails(
      flags,
      documentAnalysis,
    );

    const reportMarkdown = buildClaimAnalysisMarkdown({
      referenceNumber: claim.reference_number,
      assessmentDateIso: new Date().toISOString(),
      currency: financialAssessment.currency,
      claimedAmount: amount,
      policyNumber: claim.policy_number,
      incidentDescription: description,
      claimStatus: String(claim.status),
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
      vendors: vendorsForReport,
      extractionNote,
      googleSearchSummary,
      financial: {
        benchmarkAmount: threshold,
        benchmarkLabel: financialAssessment.benchmarkLabel,
        variancePercent,
        reasonablenessIndex,
      },
    });
    
    return {
      score,
      flags,
      coverageLikely,
      coverageStatus,
      claimType,
      notes,
      recommendation,
      vendorAnalysis: {
        totalFound: extractedVendors.length,
        verified: verifiedVendors.map((v) => ({
          name: v.name,
          type: v.type,
          category: v.category,
          document: v.document,
          rating: v.rating,
          address: v.address,
          phone: v.phone,
          website: v.website,
          googleRating: v.googleRating,
          googleReviewCount: v.googleReviewCount,
          googleEvidenceLinks: v.googleEvidenceLinks,
          internalVendorListMatch: v.internalVendorListMatch,
        })),
        unverified: unverifiedVendors.map((v) => ({
          name: v.name,
          type: v.type,
          category: v.category,
          document: v.document,
          flag: v.flag,
          rating: v.rating,
          address: v.address,
          phone: v.phone,
          website: v.website,
          googleRating: v.googleRating,
          googleReviewCount: v.googleReviewCount,
          googleEvidenceLinks: v.googleEvidenceLinks,
          internalVendorListMatch: v.internalVendorListMatch,
        })),
        byClaimType: {
          relevant: relevantVendors.length,
          irrelevant: irrelevantVendors.length,
        },
        recommendation:
          unverifiedVendors.length > 0
            ? "Please verify all unverified vendors before approval"
            : extractedVendors.length === 0
              ? "Please attach vendor/service provider documents for verification"
              : "All vendors verified",
        extractionNote,
      },
      documentAnalysis: documentAnalysis,
      googleSearchSummary,
      riskBand,
      executiveRecommendation,
      scoreBreakdown,
      reportMarkdown,
      financialAssessment,
      fraudIndicatorsDetailed,
    };
  } catch (error) {
    console.error("Fraud analysis error:", error);
    const errBreakdown: ScoreBreakdown = {
      base: 0,
      amountRisk: 0,
      vendorRisk: 0,
      documentRisk: 0,
      patternRisk: 0,
      finalScore: 0,
    };
    return {
      score: 0,
      flags: ["analysis_failed"],
      coverageLikely: false,
      coverageStatus: "uncertain",
      claimType: "unknown",
      notes: "AI analysis failed - please check system logs",
      recommendation: "System error during analysis. Please try again or contact support.",
      vendorAnalysis: {
        totalFound: 0,
        verified: [],
        unverified: [],
        byClaimType: { relevant: 0, irrelevant: 0 },
        recommendation: "Unable to analyze vendors due to system error",
      },
      documentAnalysis: [],
      riskBand: "Low",
      executiveRecommendation: deriveExecutiveRecommendation(0),
      scoreBreakdown: errBreakdown,
      reportMarkdown:
        "# INSURANCE CLAIM ANALYSIS REPORT\n\n## SYSTEM ERROR\n\nAnalysis failed. Please retry or contact support.\n",
      financialAssessment: {
        claimedAmount: 0,
        currency: "HKD",
        benchmarkAmount: 0,
        benchmarkLabel: "N/A",
        variancePercent: null,
        reasonablenessIndex: 100,
        riskIndicatorSummaries: [],
      },
      fraudIndicatorsDetailed: [],
    };
  }
}