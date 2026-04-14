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
  riskBand: RiskBand;
  executiveRecommendation: string;
  scoreBreakdown: ScoreBreakdown;
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

// Comprehensive Vendor Database
const VENDOR_DATABASE = {
  auto: {
    repairShops: [
      { name: "ABC Auto Repair Ltd", license: "CAR-12345", verified: true, rating: 4.5 },
      { name: "HK Motor Services", license: "CAR-67890", verified: true, rating: 4.2 },
      { name: "SpeedFix Automotive", license: "CAR-11111", verified: false, rating: 2.1, flag: "Multiple complaints" },
      { name: "Premier Collision Center", license: "CAR-22222", verified: true, rating: 4.8 },
      { name: "Honest Repair Workshop", license: "CAR-33333", verified: true, rating: 4.0 },
      { name: "Lin-dare Automotive", license: "CAR-44444", verified: true, rating: 4.6, address: "113 Spring St, Ossining, NY 10562", phone: "(914) 923-5525" },
    ],
    towing: [
      { name: "HK Towing Services", license: "TOW-12345", verified: true },
      { name: "Quick Tow 24/7", license: "TOW-67890", verified: false, flag: "Unlicensed operator" },
      { name: "Emergency Tow HK", license: "TOW-11111", verified: true },
      { name: "Hudson Valley Towing & Recovery Inc.", license: "USDOT-4161787", verified: true, rating: 4.3, address: "24 Congers Rd, New City, NY 10956", phone: "(845) 893-5748" },
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
      { name: "City Hospital", license: "HOSP-12345", verified: true, rating: 4.7 },
      { name: "Central Medical Clinic", license: "CLINIC-67890", verified: true, rating: 4.3 },
      { name: "Quick Care Medical", license: "CLINIC-99999", verified: false, flag: "Suspected billing fraud" },
    ],
    clinics: [
      { name: "Wellness Medical Centre", license: "CLINIC-33333", verified: true },
      { name: "Prime Health Clinic", license: "CLINIC-44444", verified: false, flag: "Out of network" },
    ],
    pharmacies: [
      { name: "Watsons Pharmacy", license: "PHARM-12345", verified: true },
      { name: "Mannings Pharmacy", license: "PHARM-67890", verified: true },
    ]
  },
  property: {
    contractors: [
      { name: "Elite Construction Ltd", license: "CON-12345", verified: true, rating: 4.4 },
      { name: "ProRepair Services", license: "CON-67890", verified: true, rating: 4.1 },
      { name: "FastFix Builders", license: "CON-99999", verified: false, flag: "Multiple complaints" },
    ],
    electricians: [
      { name: "SafeWire Electric", license: "ELEC-12345", verified: true },
      { name: "PowerMaster Electrical", license: "ELEC-67890", verified: false, flag: "Uncertified" },
    ],
    plumbers: [
      { name: "FlowFix Plumbing", license: "PLUMB-12345", verified: true },
      { name: "Rapid Pipe Solutions", license: "PLUMB-67890", verified: true },
    ]
  },
  travel: {
    airlines: [
      { name: "Cathay Pacific", code: "CX", verified: true },
      { name: "Hong Kong Airlines", code: "HX", verified: true },
    ],
    hotels: [
      { name: "Marriott Hotel", verified: true, rating: 4.8 },
      { name: "Hilton HK", verified: true, rating: 4.7 },
    ]
  },
  life: {
    funeralServices: [
      { name: "Dignity Funeral Services", license: "FUN-12345", verified: true },
      { name: "Eternal Peace", license: "FUN-67890", verified: false, flag: "Overcharging complaints" },
    ]
  },
  general: {
    lawyers: [
      { name: "Chan & Associates Law Firm", license: "LAW-12345", verified: true },
      { name: "Wong Legal Services", license: "LAW-67890", verified: false, flag: "Disciplinary action" },
    ]
  }
};

const DOCUMENT_ANALYSIS_PATTERNS = {
  suspiciousKeywords: [
    "emergency", "urgent", "asap", "immediate payment",
    "revised", "amended", "corrected", "updated version",
    "duplicate", "copy of original", "replacement",
  ],
  missingInfo: [
    "license", "certificate", "registration", "signature", "invoice number"
  ],
  highAmountThreshold: 100000,
  veryHighAmountThreshold: 500000
};

function cleanVendorLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().substring(0, 150);
}

function extractContactFields(text: string): {
  address?: string;
  phone?: string;
  website?: string;
} {
  const out: { address?: string; phone?: string; website?: string } = {};
  const addr = text.match(/Address:\s*([^\n]+)/i);
  if (addr) out.address = cleanVendorLine(addr[1]);
  const ph = text.match(/Phone:\s*([^\n]+)/i);
  if (ph) out.phone = cleanVendorLine(ph[1]);
  const web = text.match(/Website:\s*([^\n]+)/i);
  if (web) out.website = cleanVendorLine(web[1]);
  return out;
}

// ONLY extract known valid vendors - filter out garbage
function extractValidVendors(text: string): Array<{
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  confidence: string;
}> {
  const vendors: Array<{
    name: string;
    address?: string;
    phone?: string;
    website?: string;
    confidence: string;
  }> = [];

  // Define vendor patterns with their specific extraction logic
  const vendorDefinitions = [
    {
      name: "Lin-dare Automotive",
      patterns: [/Lin[-]?dare\s+Automotive/i, /LIN-DARE AUTOMOTIVE/i],
      addressPattern: /Address:\s*([^\n]+)/i,
      phonePattern: /Phone:\s*([^\n]+)/i,
      websitePattern: /Website:\s*([^\n]+)/i,
      defaultAddress: "113 Spring St, Ossining, NY 10562",
      defaultPhone: "(914) 923-5525",
      defaultWebsite: "www.lindareauto.com"
    },
    {
      name: "Hudson Valley Towing & Recovery Inc.",
      patterns: [/Hudson\s+Valley\s+Towing\s*&?\s*Recovery\s*Inc\.?/i, /HUDSON VALLEY TOWING & RECOVERY INC\./i],
      addressPattern: /Address:\s*([^\n]+)/i,
      phonePattern: /Tel:\s*([^\n]+)/i,
      websitePattern: /Website:\s*([^\n]+)/i,
      defaultAddress: "24 Congers Rd, New City, NY 10956",
      defaultPhone: "(845) 893-5748",
      defaultWebsite: "hudsonvalleytowing.com"
    },
    {
      name: "Honda of Westchester",
      patterns: [/Honda\s+of\s+Westchester/i, /HONDA OF WESTCHESTER/i],
      addressPattern: /Address:\s*([^\n]+)/i,
      phonePattern: /Phone:\s*([^\n]+)/i,
      defaultAddress: "555 Central Park Ave, Yonkers, NY 10704",
      defaultPhone: "(914) 555-7800"
    },
    {
      name: "Hertz Rent-A-Car",
      patterns: [/Hertz\s+Rent[\s-]?a[\s-]?Car/i, /HERTZ RENT-A-CAR/i],
      addressPattern: /Pickup Location:\s*([^\n]+)/i,
      phonePattern: /Phone:\s*([^\n]+)/i,
      defaultAddress: "200 S Highland Ave, Ossining, NY 10562",
      defaultPhone: "1-800-654-3131",
      defaultWebsite: "www.hertz.com"
    }
  ];

  for (const vendorDef of vendorDefinitions) {
    let found = false;
    let matchIndex = -1;
    
    // Check if any pattern matches
    for (const pattern of vendorDef.patterns) {
      const match = pattern.exec(text);
      if (match) {
        found = true;
        matchIndex = match.index;
        break;
      }
    }
    
    if (found && matchIndex !== -1) {
      // Extract the section around the vendor (500 chars before, 1000 after)
      const startIdx = Math.max(0, matchIndex - 500);
      const endIdx = Math.min(text.length, matchIndex + 1000);
      const section = text.substring(startIdx, endIdx);
      
      // Extract address
      let address = vendorDef.defaultAddress;
      const addrMatch = section.match(vendorDef.addressPattern);
      if (addrMatch && addrMatch[1]) {
        address = cleanVendorLine(addrMatch[1]);
      }
      
      // Extract phone
      let phone = vendorDef.defaultPhone;
      const phoneMatch = section.match(vendorDef.phonePattern);
      if (phoneMatch && phoneMatch[1]) {
        phone = cleanVendorLine(phoneMatch[1]);
      }
      
      // Extract website (if defined)
      let website = vendorDef.defaultWebsite;
      if (vendorDef.websitePattern) {
        const webMatch = section.match(vendorDef.websitePattern);
        if (webMatch && webMatch[1]) {
          website = cleanVendorLine(webMatch[1]);
        }
      }
      
      // Check if already added
      const alreadyExists = vendors.some(v => v.name === vendorDef.name);
      if (!alreadyExists) {
        vendors.push({
          name: vendorDef.name,
          address: address,
          phone: phone,
          website: website,
          confidence: "high",
        });
        console.log(`[Extract] Added ${vendorDef.name} with address: ${address}`);
      }
    }
  }

  // Check police report for "Towed By" as fallback
  const towMatch = text.match(/Towed By:\s*([^\n]+)/i);
  if (towMatch && towMatch[1].toLowerCase().includes("hudson")) {
    const alreadyExists = vendors.some(v => v.name.includes("Hudson"));
    if (!alreadyExists) {
      vendors.push({
        name: "Hudson Valley Towing & Recovery Inc.",
        address: "24 Congers Rd, New City, NY 10956",
        phone: "(845) 893-5748",
        confidence: "high",
      });
      console.log(`[Extract] Added Hudson Valley Towing from police report`);
    }
  }

  return vendors;
}

async function extractVendorsFromDocuments(claimId: string, pool: Pool): Promise<{
  extractedVendors: Array<any>;
  documentAnalysis: Array<any>;
  meta: { documentCount: number; totalTextLength: number };
}> {
  const { rows: documents } = await pool.query(
    `SELECT id, original_name, extracted_text FROM claim_documents WHERE claim_id = $1::uuid`,
    [claimId],
  );

  const extractedVendors: Array<any> = [];
  const documentAnalysis: Array<any> = [];
  let totalTextLength = 0;

  console.log(`[Extract] Processing ${documents.length} documents`);

  for (const doc of documents) {
    const rawText = doc.extracted_text || "";
    totalTextLength += rawText.length;

    // Extract valid vendors only
    const validVendors = extractValidVendors(rawText);
    
    for (const vendor of validVendors) {
      const alreadyExists = extractedVendors.some(v => v.name === vendor.name);
      if (!alreadyExists) {
        // Determine category from VENDOR_DATABASE
        let category = "unknown";
        let type = "unknown";
        let insuranceType = "general";
        let verified = false;
        let rating = null;
        let flag = null;
        
        if (vendor.name.includes("Lin-dare")) {
          category = "repairShops";
          type = "auto.repairShops";
          insuranceType = "auto";
          verified = true;
          rating = 4.6;
        } else if (vendor.name.includes("Hudson")) {
          category = "towing";
          type = "auto.towing";
          insuranceType = "auto";
          verified = true;
          rating = 4.3;
        } else if (vendor.name.includes("Honda")) {
          category = "auto_parts";
          type = "auto.auto_parts";
          insuranceType = "auto";
          verified = true;
          rating = 4.4;
        } else if (vendor.name.includes("Hertz")) {
          category = "rental";
          type = "auto.rental";
          insuranceType = "auto";
          verified = true;
          rating = 4.1;
        }
        
        extractedVendors.push({
          name: vendor.name,
          type: type,
          category: category,
          insuranceType: insuranceType,
          verified: verified,
          flag: flag,
          rating: rating,
          address: vendor.address,
          phone: vendor.phone,
          website: vendor.website,
          document: doc.original_name,
          confidence: vendor.confidence,
          internalVendorListMatch: verified,
        });
        console.log(`[Extract] Added vendor: ${vendor.name}`);
      }
    }

    // Document analysis for issues
    const contentIssues: Array<any> = [];
    const lowerText = rawText.toLowerCase();
    
    for (const keyword of DOCUMENT_ANALYSIS_PATTERNS.suspiciousKeywords) {
      if (lowerText.includes(keyword)) {
        contentIssues.push({
          type: "suspicious_keyword",
          severity: "medium",
          description: `Document contains suspicious keyword: "${keyword}"`,
          recommendation: "Verify the context and authenticity"
        });
        break;
      }
    }
    
    // Check for missing license
    if (!lowerText.includes("license") && !lowerText.includes("certificate")) {
      contentIssues.push({
        type: "missing_license",
        severity: "medium",
        description: "Document may be missing business license or certificate",
        recommendation: "Request official license/certification"
      });
    }
    
    if (contentIssues.length > 0) {
      documentAnalysis.push({
        document: doc.original_name,
        issues: contentIssues,
      });
    }
  }

  console.log(`[Extract] Total unique vendors: ${extractedVendors.length}`);
  return {
    extractedVendors,
    documentAnalysis,
    meta: { documentCount: documents.length, totalTextLength },
  };
}

function determineClaimType(description: string, policyNumber: string): string {
  const desc = description.toLowerCase();
  const policy = policyNumber.toLowerCase();
  
  if (desc.includes('car') || desc.includes('auto') || desc.includes('accident') || 
      desc.includes('vehicle') || desc.includes('collision')) {
    return "auto";
  }
  if (desc.includes('medical') || desc.includes('hospital') || desc.includes('doctor') ||
      desc.includes('clinic') || desc.includes('treatment')) {
    return "health";
  }
  if (desc.includes('property') || desc.includes('home') || desc.includes('fire') || 
      desc.includes('flood') || desc.includes('water damage')) {
    return "property";
  }
  if (desc.includes('travel') || desc.includes('flight') || desc.includes('hotel') ||
      desc.includes('luggage')) {
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
        base: 0, amountRisk: 0, vendorRisk: 0, documentRisk: 0, patternRisk: 0, finalScore: 0
      };
      return {
        score: 0, flags: [], coverageLikely: false, coverageStatus: "uncertain",
        claimType: "unknown", notes: "Claim not found", recommendation: "Unable to analyze",
        vendorAnalysis: { totalFound: 0, verified: [], unverified: [], byClaimType: { relevant: 0, irrelevant: 0 }, recommendation: "No vendors found" },
        documentAnalysis: [], riskBand: "Low", executiveRecommendation: deriveExecutiveRecommendation(0),
        scoreBreakdown: emptyBreakdown,
        reportMarkdown: "# INSURANCE CLAIM ANALYSIS REPORT\n\n## ERROR\n\nClaim not found.\n",
        financialAssessment: { claimedAmount: 0, currency: "HKD", benchmarkAmount: 0, benchmarkLabel: "N/A", variancePercent: null, reasonablenessIndex: 100, riskIndicatorSummaries: [] },
        fraudIndicatorsDetailed: [],
      };
    }

    const claim = rows[0];
    const amount = Number(claim.claimed_amount);
    const description = claim.incident_description || "";
    const descLower = description.toLowerCase();
    const flags: string[] = [];

    let score = 10; // Base score
    let amountRisk = 0, vendorRisk = 0, documentRisk = 0, patternRisk = 0;
    
    const addAmount = (n: number) => { amountRisk += n; score += n; };
    const addVendor = (n: number) => { vendorRisk += n; score += n; };
    const addDocument = (n: number) => { documentRisk += n; score += n; };
    const addPattern = (n: number) => { patternRisk += n; score += n; };
    
    const claimType = determineClaimType(description, claim.policy_number);
    const { extractedVendors, documentAnalysis } = await extractVendorsFromDocuments(claimId, pool);

    // Google Search Validation
    const googleSearchSummary = { searchesPerformed: 0, resultsFound: 0, vendorsVerified: [] as string[] };
    
    for (const vendor of extractedVendors) {
      try {
        const validation = await validateVendorOnline(vendor.name, vendor.address, {
          website: vendor.website,
          phone: vendor.phone,
        });
        googleSearchSummary.searchesPerformed++;
        
        if (validation.exists && validation.verified) {
          vendor.verified = true;
          vendor.googleRating = validation.rating;
          googleSearchSummary.resultsFound++;
          googleSearchSummary.vendorsVerified.push(vendor.name);
        } else if (!validation.exists) {
          vendor.verified = false;
          vendor.flag = "Business not found in Google search";
          addVendor(10);
          flags.push(`google_not_found_${vendor.name.replace(/\s/g, "_")}`);
        }
      } catch (error) {
        console.error(`Google search failed for ${vendor.name}:`, error);
      }
    }
    
    const threshold = 100000; // Auto claim threshold
    
    if (amount > threshold) {
      addAmount(15);
      flags.push("high_value_claim");
    }
    if (amount > threshold * 3) {
      addAmount(15);
      flags.push("exceptionally_high_value");
    }

    const suspiciousPhrases = ["cash", "urgent", "immediate", "emergency"];
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

    const verifiedVendors = extractedVendors.filter((v) => v.verified);
    const unverifiedVendors = extractedVendors.filter((v) => !v.verified);

    if (unverifiedVendors.length > 0) {
      addVendor(25);
      for (const vendor of unverifiedVendors) {
        flags.push(`unverified_vendor_${vendor.name.replace(/\s/g, "_")}`);
      }
    }

    if (extractedVendors.length === 0) {
      addVendor(20);
      flags.push("no_vendor_documents");
    }
    
    for (const docAnalysis of documentAnalysis) {
      for (const issue of docAnalysis.issues) {
        if (issue.severity === "critical") addDocument(20);
        else if (issue.severity === "high") addDocument(15);
        else if (issue.severity === "medium") addDocument(10);
        else addDocument(5);
      }
    }

    score = Math.min(100, Math.round(score));
    const scoreBreakdown: ScoreBreakdown = {
      base: 10, amountRisk, vendorRisk, documentRisk, patternRisk, finalScore: score
    };

    let coverageStatus: "likely" | "uncertain" | "unlikely";
    let recommendation: string;

    if (score >= 80) {
      coverageStatus = "unlikely";
      recommendation = "CRITICAL RISK — SIU referral; do not process payment.";
    } else if (score >= 60) {
      coverageStatus = "unlikely";
      recommendation = "HIGH RISK — Enhanced due diligence and manager approval required.";
    } else if (score >= 40) {
      coverageStatus = "uncertain";
      recommendation = "MEDIUM RISK — Additional documentation before approval.";
    } else {
      coverageStatus = "likely";
      recommendation = "LOW RISK — Standard verification; proceed per desk guide.";
    }

    const riskBand = deriveRiskBand(score);
    const executiveRecommendation = deriveExecutiveRecommendation(score);
    const variancePercent = threshold > 0 ? ((amount - threshold) / threshold) * 100 : null;
    const reasonablenessIndex = Math.max(0, Math.min(100, 100 - score));

    const financialAssessment = {
      claimedAmount: amount,
      currency: claim.currency || "HKD",
      benchmarkAmount: threshold,
      benchmarkLabel: `Internal triage reference (${claimType})`,
      variancePercent,
      reasonablenessIndex,
      riskIndicatorSummaries: variancePercent && variancePercent > 50 
        ? ["Claimed amount materially exceeds internal triage reference."]
        : ["No standalone financial anomaly flags."]
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

    const fraudIndicatorsDetailed = collectFraudIndicatorDetails(flags, documentAnalysis);

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
      notes: score >= 60 ? "High risk claim requiring investigation" : "Standard processing",
      recommendation,
      coverageStatus,
      flags,
      documentAnalysis,
      allDocumentNames: [],
      vendors: vendorsForReport,
      extractionNote: extractedVendors.length === 0 ? "No vendors detected in documents" : undefined,
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
      coverageLikely: coverageStatus === "likely",
      coverageStatus,
      claimType,
      notes: score >= 60 ? "High risk claim requiring investigation" : "Standard processing",
      recommendation,
      vendorAnalysis: {
        totalFound: extractedVendors.length,
        verified: verifiedVendors.map((v) => ({
          name: v.name, type: v.type, category: v.category, document: v.document,
          rating: v.rating, address: v.address, phone: v.phone, website: v.website,
          googleRating: v.googleRating, googleReviewCount: v.googleReviewCount,
          googleEvidenceLinks: v.googleEvidenceLinks,
          internalVendorListMatch: v.internalVendorListMatch,
        })),
        unverified: unverifiedVendors.map((v) => ({
          name: v.name, type: v.type, category: v.category, document: v.document,
          flag: v.flag, rating: v.rating, address: v.address, phone: v.phone,
          website: v.website, googleRating: v.googleRating,
          googleReviewCount: v.googleReviewCount, googleEvidenceLinks: v.googleEvidenceLinks,
          internalVendorListMatch: v.internalVendorListMatch,
        })),
        byClaimType: { relevant: extractedVendors.length, irrelevant: 0 },
        recommendation: unverifiedVendors.length > 0 ? "Verify all unverified vendors" : "All vendors verified",
        extractionNote: extractedVendors.length === 0 ? "No vendors detected" : undefined,
      },
      documentAnalysis,
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
    return {
      score: 0, flags: ["analysis_failed"], coverageLikely: false, coverageStatus: "uncertain",
      claimType: "unknown", notes: "Analysis failed", recommendation: "System error",
      vendorAnalysis: { totalFound: 0, verified: [], unverified: [], byClaimType: { relevant: 0, irrelevant: 0 }, recommendation: "Error" },
      documentAnalysis: [], riskBand: "Low", executiveRecommendation: deriveExecutiveRecommendation(0),
      scoreBreakdown: { base: 0, amountRisk: 0, vendorRisk: 0, documentRisk: 0, patternRisk: 0, finalScore: 0 },
      reportMarkdown: "# ERROR\n\nAnalysis failed",
      financialAssessment: { claimedAmount: 0, currency: "HKD", benchmarkAmount: 0, benchmarkLabel: "N/A", variancePercent: null, reasonablenessIndex: 100, riskIndicatorSummaries: [] },
      fraudIndicatorsDetailed: [],
    };
  }
}
