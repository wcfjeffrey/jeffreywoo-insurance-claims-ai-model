import { validateVendorOnline, searchGoogle } from './googleSearchService.js';

// ============================================
// Types and Interfaces
// ============================================

export interface VendorValidationResult {
  name: string;
  exists: boolean;
  verified: boolean;
  businessType: string;
  category: string;
  address?: string;
  phone?: string;
  website?: string;
  registrationNumber?: string;
  licenseNumber?: string;
  dotNumber?: string;
  npiNumber?: string;
  googleRating?: number;
  reviewCount?: number;
  yearsInBusiness?: number;
  flags?: string[];
  sourceUrl?: string;
  verificationSources: string[];
  hasReview?: boolean;
  resultCount?: number;
  topResult?: string | null;
  evidenceLinks?: Array<{ title: string; link: string }>;
}

export interface DocumentValidationResult {
  documentName: string;
  isAuthentic: boolean;
  confidence: number;
  issues: string[];
  recommendations: string[];
  sourceReferences: string[];
  extractedVendors: string[];
  extractedAmounts: number[];
  extractedDates: string[];
}

export interface ServiceProvider {
  name: string;
  category: string;
  address?: string;
  phone?: string;
  invoiceNumber?: string;
  amount?: number;
  date?: string;
}

// ============================================
// Vendor Category Definitions
// ============================================

export const VENDOR_CATEGORIES: Record<string, {
  name: string;
  keywords: string[];
  verificationMethods: string[];
  validationPriority: 'critical' | 'high' | 'medium' | 'low';
  expectedLicenses: string[];
}> = {
  auto_repair: {
    name: 'Auto Repair Shop',
    keywords: ['auto repair', 'body shop', 'collision center', 'automotive', 'car repair', 'mechanic', 'garage'],
    verificationMethods: ['google_business', 'yelp', 'bbb', 'state_license'],
    validationPriority: 'high',
    expectedLicenses: ['business_license', 'auto_repair_license']
  },
  towing: {
    name: 'Towing & Recovery',
    keywords: ['towing', 'tow truck', 'roadside assistance', 'recovery', 'tow company', 'flatbed', 'wrecker'],
    verificationMethods: ['usdot', 'google_business', 'fmcsa'],
    validationPriority: 'high',
    expectedLicenses: ['dot_number', 'mc_number']
  },
  auto_parts: {
    name: 'Auto Parts Supplier',
    keywords: ['auto parts', 'oem parts', 'replacement parts', 'parts supplier', 'honda parts', 'toyota parts', 'genuine parts'],
    verificationMethods: ['google_business', 'bbb'],
    validationPriority: 'medium',
    expectedLicenses: ['business_license']
  },
  tire_shop: {
    name: 'Tire Shop',
    keywords: ['tire shop', 'tire center', 'wheel repair', 'tire replacement', 'tire service', 'tire rotation'],
    verificationMethods: ['google_business', 'yelp'],
    validationPriority: 'medium',
    expectedLicenses: ['business_license']
  },
  glass_repair: {
    name: 'Glass/Windshield Repair',
    keywords: ['windshield repair', 'auto glass', 'glass replacement', 'windshield replacement', 'auto glass repair'],
    verificationMethods: ['google_business', 'yelp'],
    validationPriority: 'medium',
    expectedLicenses: ['business_license']
  },
  contractor: {
    name: 'General Contractor',
    keywords: ['contractor', 'construction', 'repair', 'renovation', 'remodeling', 'general contractor', 'builders'],
    verificationMethods: ['google_business', 'bbb', 'state_license', 'contractor_license'],
    validationPriority: 'high',
    expectedLicenses: ['contractor_license', 'business_license']
  },
  plumber: {
    name: 'Plumber',
    keywords: ['plumber', 'plumbing', 'pipe repair', 'water damage', 'flood repair', 'drain cleaning'],
    verificationMethods: ['google_business', 'state_license', 'plumbing_license'],
    validationPriority: 'high',
    expectedLicenses: ['plumbing_license', 'business_license']
  },
  electrician: {
    name: 'Electrician',
    keywords: ['electrician', 'electrical repair', 'wiring', 'electrical service', 'circuit repair'],
    verificationMethods: ['google_business', 'state_license', 'electrical_license'],
    validationPriority: 'high',
    expectedLicenses: ['electrical_license', 'business_license']
  },
  roofing: {
    name: 'Roofing Contractor',
    keywords: ['roofing', 'roof repair', 'roof replacement', 'roofer', 'roofing contractor'],
    verificationMethods: ['google_business', 'bbb', 'state_license'],
    validationPriority: 'high',
    expectedLicenses: ['contractor_license', 'roofing_license']
  },
  hvac: {
    name: 'HVAC Contractor',
    keywords: ['hvac', 'heating', 'cooling', 'air conditioning', 'furnace repair', 'ac repair', 'heat pump'],
    verificationMethods: ['google_business', 'state_license', 'hvac_license'],
    validationPriority: 'high',
    expectedLicenses: ['hvac_license', 'business_license']
  },
  hospital: {
    name: 'Hospital',
    keywords: ['hospital', 'medical center', 'emergency room', 'er', 'urgent care', 'clinic', 'healthcare'],
    verificationMethods: ['state_license', 'medicare', 'joint_commission', 'google_business'],
    validationPriority: 'critical',
    expectedLicenses: ['hospital_license', 'medicare_certification']
  },
  clinic: {
    name: 'Medical Clinic',
    keywords: ['clinic', 'medical clinic', 'health center', 'doctor office', 'physician', 'primary care'],
    verificationMethods: ['state_license', 'medicare', 'google_business'],
    validationPriority: 'high',
    expectedLicenses: ['clinic_license', 'medical_license']
  },
  chiropractor: {
    name: 'Chiropractor',
    keywords: ['chiropractor', 'chiropractic', 'back pain', 'spinal adjustment', 'chiropractic care'],
    verificationMethods: ['state_license', 'google_business', 'chiropractic_board'],
    validationPriority: 'medium',
    expectedLicenses: ['chiropractic_license']
  },
  physical_therapy: {
    name: 'Physical Therapy',
    keywords: ['physical therapy', 'physiotherapy', 'rehab', 'rehabilitation', 'sports therapy', 'physical therapist'],
    verificationMethods: ['state_license', 'google_business', 'apta'],
    validationPriority: 'medium',
    expectedLicenses: ['physical_therapy_license']
  },
  pharmacy: {
    name: 'Pharmacy',
    keywords: ['pharmacy', 'drugstore', 'prescription', 'medication', 'chemist', 'cvs', 'walgreens', 'rite aid'],
    verificationMethods: ['state_license', 'npi', 'google_business'],
    validationPriority: 'medium',
    expectedLicenses: ['pharmacy_license', 'npi_number']
  },
  rental_car: {
    name: 'Rental Car Agency',
    keywords: ['rental car', 'car rental', 'hertz', 'enterprise', 'avis', 'budget', 'national', 'thrifty', 'dollar'],
    verificationMethods: ['google_business', 'bbb', 'dot'],
    validationPriority: 'high',
    expectedLicenses: ['business_license', 'dot_number']
  },
  attorney: {
    name: 'Attorney/Law Firm',
    keywords: ['attorney', 'lawyer', 'law firm', 'legal', 'counsel', 'solicitor', 'law office'],
    verificationMethods: ['bar_association', 'google_business', 'avvo'],
    validationPriority: 'high',
    expectedLicenses: ['bar_license']
  },
  storage: {
    name: 'Storage Facility',
    keywords: ['storage', 'self storage', 'warehouse', 'storage unit', 'mini storage', 'public storage'],
    verificationMethods: ['google_business', 'ssa'],
    validationPriority: 'medium',
    expectedLicenses: ['business_license']
  },
  temporary_housing: {
    name: 'Temporary Housing/Hotel',
    keywords: ['hotel', 'motel', 'lodging', 'extended stay', 'temporary housing', 'airbnb', 'vrbo', 'inn'],
    verificationMethods: ['google_business', 'hotel_license', 'health_department'],
    validationPriority: 'high',
    expectedLicenses: ['hotel_license', 'business_license']
  },
  funeral_home: {
    name: 'Funeral Home',
    keywords: ['funeral home', 'mortuary', 'cremation', 'burial', 'memorial', 'funeral services'],
    verificationMethods: ['state_license', 'funeral_board', 'google_business'],
    validationPriority: 'critical',
    expectedLicenses: ['funeral_director_license', 'funeral_home_license']
  },
  veterinary: {
    name: 'Veterinary Clinic',
    keywords: ['vet', 'veterinarian', 'animal hospital', 'pet clinic', 'animal clinic', 'veterinary clinic'],
    verificationMethods: ['state_license', 'avma', 'google_business'],
    validationPriority: 'high',
    expectedLicenses: ['veterinary_license']
  },
  general_service: {
    name: 'General Service Provider',
    keywords: [],
    verificationMethods: ['google_business'],
    validationPriority: 'low',
    expectedLicenses: ['business_license']
  }
};

// ============================================
// Service Provider Extraction
// ============================================

export function extractServiceProviders(documentText: string): ServiceProvider[] {
  const providers: ServiceProvider[] = [];
  const seenNames = new Set<string>();
  
  console.log('[extractServiceProviders] Scanning document for vendors...');
  
  // Comprehensive patterns for different provider types
  const patterns = [
    { pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+[A-Z][a-z]+)*(?:\s+(?:Towing|Tow|Recovery|Roadside|Wrecker)))/gi, category: 'towing' },
    { pattern: /(Hudson\s+Valley\s+Towing\s+&\s+Recovery\s+Inc\.?)/gi, category: 'towing' },
    { pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Auto|Body|Collision|Repair|Automotive|Garage|Mechanic)))/gi, category: 'auto_repair' },
    { pattern: /(Lin[-]?Dare\s+Automotive)/gi, category: 'auto_repair' },
    { pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Clinic|Hospital|Medical|Health|Urgent Care|Physical Therapy|Chiropractic|Doctor|Physician)))/gi, category: 'clinic' },
    { pattern: /(Hertz|Enterprise|Avis|Budget|National|Thrifty|Dollar)\s+(?:Rent|Car|Rental)/gi, category: 'rental_car' },
    { pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Construction|Contractor|Remodeling|Renovation|Builders)))/gi, category: 'contractor' },
    { pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Hotel|Inn|Lodge|Suites|Residence|Motel)))/gi, category: 'temporary_housing' },
    { pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Storage|Self Storage|Warehouse)))/gi, category: 'storage' },
    { pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Funeral Home|Mortuary|Cremation|Memorial)))/gi, category: 'funeral_home' },
    { pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Veterinary|Animal Hospital|Pet Clinic|Vet)))/gi, category: 'veterinary' }
  ];
  
  // Extract from invoice patterns
  const invoiceMatches = documentText.matchAll(/(?:Invoice|Bill|Receipt|Statement)\s+(?:from|for|#|Number:?\s*)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi);
  for (const match of invoiceMatches) {
    const name = match[1]?.trim();
    if (name && name.length > 3 && !seenNames.has(name.toLowerCase())) {
      seenNames.add(name.toLowerCase());
      console.log(`[extractServiceProviders] Found vendor from invoice: ${name}`);
      providers.push({
        name,
        category: detectVendorCategory(name, documentText)
      });
    }
  }
  
  // Extract from "prepared by" or "issued by" patterns
  const issuerMatches = documentText.matchAll(/(?:prepared|issued|inspected|examined|performed|completed)\s+by\s*:?\s*([^\n]+)/gi);
  for (const match of issuerMatches) {
    let name = match[1]?.trim();
    if (name && name.length > 3 && !seenNames.has(name.toLowerCase())) {
      // Clean up the name
      name = name.replace(/\([^)]*\)/g, '').trim();
      seenNames.add(name.toLowerCase());
      console.log(`[extractServiceProviders] Found vendor from issuer: ${name}`);
      providers.push({
        name,
        category: detectVendorCategory(name, documentText)
      });
    }
  }
  
  // Extract from company names in document
  const companyMatches = documentText.matchAll(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+[A-Z][a-z]+)*(?:\s+(?:Inc|LLC|Corp|Company|Ltd)))/gi);
  for (const match of companyMatches) {
    const name = match[1]?.trim();
    if (name && name.length > 5 && !seenNames.has(name.toLowerCase())) {
      seenNames.add(name.toLowerCase());
      console.log(`[extractServiceProviders] Found potential vendor: ${name}`);
      providers.push({
        name,
        category: detectVendorCategory(name, documentText)
      });
    }
  }
  
  console.log(`[extractServiceProviders] Total vendors found: ${providers.length}`);
  return providers;
}

// ============================================
// Vendor Category Detection
// ============================================

export function detectVendorCategory(vendorName: string, documentText: string = ''): string {
  const lowerName = vendorName.toLowerCase();
  const lowerText = documentText.toLowerCase();
  const combinedText = lowerName + ' ' + lowerText;
  
  for (const [category, config] of Object.entries(VENDOR_CATEGORIES)) {
    for (const keyword of config.keywords) {
      if (combinedText.includes(keyword)) {
        return category;
      }
    }
  }
  
  return 'general_service';
}

// ============================================
// Vendor Validation Functions
// ============================================

export async function validateVendor(
  vendorName: string, 
  address?: string, 
  phone?: string,
  website?: string
): Promise<VendorValidationResult> {
  console.log(`[validateVendor] Validating: ${vendorName}`);
  
  try {
    // Use the existing googleSearchService
    const result = await validateVendorOnline(vendorName, address, { website, phone });
    
    const category = detectVendorCategory(vendorName);
    const categoryConfig = VENDOR_CATEGORIES[category] || VENDOR_CATEGORIES.general_service;
    
    const flags: string[] = [];
    if (result.exists && result.rating && result.rating < 3) {
      flags.push(`Low Google rating (${result.rating}/5) with ${result.reviewCount || 0} reviews`);
    }
    
    if (!result.exists) {
      flags.push('Business not found in public records');
    }
    
    return {
      name: vendorName,
      exists: result.exists,
      verified: result.verified,
      businessType: categoryConfig.name,
      category: category,
      address: result.address,
      phone: result.phone,
      website: result.website,
      googleRating: result.rating,
      reviewCount: result.reviewCount,
      flags,
      hasReview: result.hasReview,
      resultCount: result.resultCount,
      topResult: result.topResult,
      evidenceLinks: result.evidenceLinks,
      verificationSources: result.evidenceLinks?.map(l => l.title) || ['google_search']
    };
  } catch (error) {
    console.error(`Error validating vendor ${vendorName}:`, error);
    return {
      name: vendorName,
      exists: false,
      verified: false,
      businessType: 'Unknown',
      category: 'general_service',
      flags: ['Validation service error'],
      verificationSources: []
    };
  }
}

// ============================================
// Document Validation
// ============================================

export async function validateDocument(documentName: string, documentContent: string): Promise<DocumentValidationResult> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const sourceReferences: string[] = [];
  const extractedVendors: string[] = [];
  const extractedAmounts: number[] = [];
  const extractedDates: string[] = [];
  
  console.log(`[validateDocument] Processing: ${documentName}`);
  
  // Extract service providers
  const providers = extractServiceProviders(documentContent);
  
  for (const provider of providers) {
    extractedVendors.push(provider.name);
    console.log(`[validateDocument] Validating provider: ${provider.name}`);
    
    const validation = await validateVendor(provider.name);
    
    if (validation.exists) {
      sourceReferences.push(`Provider found: ${provider.name} (${validation.businessType}) - Rating: ${validation.googleRating || 'N/A'}`);
      
      if (!validation.verified) {
        issues.push(`Provider "${provider.name}" may not be properly licensed`);
        recommendations.push(`Verify business license for ${provider.name} with local authorities`);
      }
      
      if (validation.flags && validation.flags.length > 0) {
        issues.push(...validation.flags.map(f => `${provider.name}: ${f}`));
      }
    } else {
      issues.push(`Provider "${provider.name}" not found in public records`);
      recommendations.push(`Request official business registration certificate from ${provider.name}`);
    }
  }
  
  // Check for invoice number
  const invoiceMatch = documentContent.match(/(?:invoice|bill|receipt|work order)[:\s]*(?:#|number)?[:\s]*([A-Z0-9\-]+)/i);
  if (!invoiceMatch) {
    issues.push('Missing invoice or work order number');
    recommendations.push('Request document with unique invoice/reference number');
  } else {
    sourceReferences.push(`Invoice number: ${invoiceMatch[1]}`);
  }
  
  // Check for date validity
  const dateMatch = documentContent.match(/(?:date|service date|date of service|issued)[:\s]*(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/i);
  if (dateMatch) {
    const docDate = new Date(dateMatch[1]);
    const today = new Date();
    
    if (isNaN(docDate.getTime())) {
      issues.push(`Invalid date format: ${dateMatch[1]}`);
      recommendations.push('Request document with valid date format');
    } else if (docDate > today) {
      issues.push(`Document has future date: ${dateMatch[1]}`);
      recommendations.push('Potential fraud indicator - investigate immediately');
    } else {
      extractedDates.push(dateMatch[1]);
    }
  } else {
    issues.push('No date found on document');
    recommendations.push('Request dated documentation');
  }
  
  // Calculate confidence score
  const confidence = Math.max(0, Math.min(100, 100 - (issues.length * 15)));
  
  return {
    documentName,
    isAuthentic: issues.length === 0,
    confidence,
    issues,
    recommendations,
    sourceReferences,
    extractedVendors,
    extractedAmounts,
    extractedDates
  };
}

// ============================================
// Bulk Validation Functions
// ============================================

export async function validateAllVendors(claimId: string, pool: any): Promise<VendorValidationResult[]> {
  try {
    const { rows: documents } = await pool.query(
      `SELECT id, original_name, extracted_text FROM claim_documents WHERE claim_id = $1::uuid`,
      [claimId]
    );
    
    const allProviders: ServiceProvider[] = [];
    const seenVendors = new Set<string>();
    
    for (const doc of documents) {
      const text = doc.extracted_text || '';
      const providers = extractServiceProviders(text);
      
      for (const provider of providers) {
        if (!seenVendors.has(provider.name.toLowerCase())) {
          seenVendors.add(provider.name.toLowerCase());
          allProviders.push(provider);
        }
      }
    }
    
    const results: VendorValidationResult[] = [];
    for (const provider of allProviders) {
      const result = await validateVendor(provider.name);
      results.push(result);
    }
    
    return results;
  } catch (error) {
    console.error('Error validating all vendors:', error);
    return [];
  }
}
