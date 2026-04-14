import axios from 'axios';
import * as cheerio from 'cheerio';

// Note: You'll need a Google Search API key or use other services
// For production, consider using:
// - Google Custom Search API (paid)
// - SerpAPI (paid)
// - Bing Search API (paid)
// - Scraping with rate limiting (free but limited)

interface VendorValidationResult {
  name: string;
  exists: boolean;
  verified: boolean;
  businessType: string;
  address?: string;
  phone?: string;
  website?: string;
  registrationNumber?: string;
  googleRating?: number;
  reviewCount?: number;
  yearsInBusiness?: number;
  flags?: string[];
  sourceUrl?: string;
}

interface DocumentValidationResult {
  documentName: string;
  isAuthentic: boolean;
  confidence: number;
  issues: string[];
  recommendations: string[];
  sourceReferences: string[];
}

// Mock search function - replace with actual API
async function searchGoogle(query: string): Promise<any> {
  // OPTION 1: Google Custom Search API (requires API key)
  // const apiKey = process.env.GOOGLE_API_KEY;
  // const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  // const response = await axios.get(`https://www.googleapis.com/customsearch/v1`, {
  //   params: {
  //     key: apiKey,
  //     cx: searchEngineId,
  //     q: query
  //   }
  // });
  // return response.data;

  // OPTION 2: SerpAPI (paid but reliable)
  // const apiKey = process.env.SERPAPI_KEY;
  // const response = await axios.get(`https://serpapi.com/search`, {
  //   params: {
  //     api_key: apiKey,
  //     q: query,
  //     engine: 'google'
  //   }
  // });
  // return response.data;

  // OPTION 3: Mock for development - Replace with real API
  console.log(`Searching Google for: ${query}`);
  
  // For demo purposes, return mock data based on vendor name
  const mockResults: Record<string, any> = {
    'lin-dare automotive': {
      exists: true,
      verified: true,
      businessType: 'Auto Repair Shop',
      address: '113 Spring St, Ossining, NY 10562',
      phone: '(914) 923-5525',
      website: 'lindareauto.com',
      googleRating: 4.6,
      reviewCount: 127,
      yearsInBusiness: 10,
      sourceUrl: 'https://maps.google.com/place/Lin-dare+Automotive'
    },
    'abc auto repair': {
      exists: true,
      verified: true,
      businessType: 'Auto Repair Shop',
      address: '123 Nathan Rd, Kowloon',
      phone: '+852 2345 6789',
      googleRating: 4.5,
      reviewCount: 89,
      yearsInBusiness: 8
    },
    'quick care medical': {
      exists: true,
      verified: false,
      businessType: 'Medical Clinic',
      flags: ['Suspected billing fraud', 'Multiple complaints'],
      googleRating: 2.1,
      reviewCount: 45
    }
  };
  
  const key = query.toLowerCase();
  return mockResults[key] || {
    exists: false,
    verified: false,
    businessType: 'Unknown',
    flags: ['Business not found in public records']
  };
}

// Validate a business/vendor using Google Search
export async function validateVendor(vendorName: string, address?: string, phone?: string): Promise<VendorValidationResult> {
  try {
    // Build search query
    let searchQuery = vendorName;
    if (address) searchQuery += ` ${address}`;
    if (phone) searchQuery += ` ${phone}`;
    searchQuery += ' business registration';
    
    const searchResults = await searchGoogle(searchQuery);
    
    if (!searchResults.exists) {
      return {
        name: vendorName,
        exists: false,
        verified: false,
        businessType: 'Unknown',
        flags: ['Business not found in public records', 'Unable to verify legitimacy']
      };
    }
    
    return {
      name: vendorName,
      exists: true,
      verified: searchResults.verified !== false,
      businessType: searchResults.businessType || 'Business',
      address: searchResults.address,
      phone: searchResults.phone,
      website: searchResults.website,
      googleRating: searchResults.googleRating,
      reviewCount: searchResults.reviewCount,
      yearsInBusiness: searchResults.yearsInBusiness,
      flags: searchResults.flags || [],
      sourceUrl: searchResults.sourceUrl
    };
  } catch (error) {
    console.error(`Error validating vendor ${vendorName}:`, error);
    return {
      name: vendorName,
      exists: false,
      verified: false,
      businessType: 'Unknown',
      flags: ['Validation service error']
    };
  }
}

// Validate document authenticity
export async function validateDocument(documentName: string, documentContent: string): Promise<DocumentValidationResult> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const sourceReferences: string[] = [];
  
  // Extract key information from document
  const businessNameMatch = documentContent.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Auto|Repair|Automotive|Service|Clinic|Hospital)/i);
  const licenseMatch = documentContent.match(/(?:license|certificate|registration)#?\s*:?\s*([A-Z0-9\-]+)/i);
  const dateMatch = documentContent.match(/(?:date|issued):\s*(\d{4}[-/]\d{2}[-/]\d{2})/i);
  const signatureMatch = documentContent.match(/(?:signature|authorized by):/i);
  
  // Check for business license
  if (businessNameMatch) {
    const businessName = businessNameMatch[0];
    const validation = await validateVendor(businessName);
    
    if (validation.exists) {
      sourceReferences.push(`Business found: ${businessName} - Rating: ${validation.googleRating || 'N/A'}`);
      if (!validation.verified) {
        issues.push(`Business "${businessName}" may not be properly licensed`);
        recommendations.push(`Verify business license for ${businessName} with local authorities`);
      }
      if (validation.googleRating && validation.googleRating < 3) {
        issues.push(`Business has low rating (${validation.googleRating}/5) with ${validation.reviewCount} reviews`);
        recommendations.push(`Consider using alternative service provider`);
      }
    } else {
      issues.push(`Business "${businessName}" not found in public records`);
      recommendations.push(`Request official business registration certificate`);
    }
  }
  
  // Check for proper licensing
  if (!licenseMatch) {
    issues.push('Missing business license or registration number');
    recommendations.push('Request official license/certification document');
  } else {
    sourceReferences.push(`License number found: ${licenseMatch[1]}`);
  }
  
  // Check for date validity
  if (dateMatch) {
    const docDate = new Date(dateMatch[1]);
    const today = new Date();
    if (docDate > today) {
      issues.push(`Document has future date: ${dateMatch[1]}`);
      recommendations.push('This is a potential fraud indicator - investigate immediately');
    } else if (docDate < new Date(today.setFullYear(today.getFullYear() - 2))) {
      issues.push(`Document is over 2 years old: ${dateMatch[1]}`);
      recommendations.push('Request updated documentation');
    }
  } else {
    issues.push('No date found on document');
    recommendations.push('Request dated documentation');
  }
  
  // Check for signature
  if (!signatureMatch) {
    issues.push('Missing authorized signature or stamp');
    recommendations.push('Request signed and stamped document');
  }
  
  // Search for document template online to verify authenticity
  const templateCheck = await searchGoogle(`"${documentName.substring(0, 30)}" template sample`);
  if (templateCheck.exists) {
    issues.push('Document appears to be from a common template');
    recommendations.push('Verify document authenticity with issuing authority');
  }
  
  const confidence = Math.max(0, 100 - (issues.length * 15));
  
  return {
    documentName,
    isAuthentic: issues.length === 0,
    confidence,
    issues,
    recommendations,
    sourceReferences
  };
}

// Bulk validate all vendors in a claim
export async function validateAllVendors(claimId: string, pool: any): Promise<VendorValidationResult[]> {
  // Get all documents for the claim
  const { rows: documents } = await pool.query(
    `SELECT id, original_name, extracted_text FROM claim_documents WHERE claim_id = $1::uuid`,
    [claimId]
  );
  
  const vendorNames = new Set<string>();
  
  // Extract potential vendor names from documents
  for (const doc of documents) {
    const text = (doc.extracted_text || '').toLowerCase();
    
    // Look for company/business names
    const businessMatches = text.match(/([a-z][a-z\s]+(?:auto|repair|automotive|service|clinic|hospital|medical|construction|electric|plumbing))/gi);
    if (businessMatches) {
      businessMatches.forEach((name: string) => {
        vendorNames.add(name.trim());
      });
    }
    
    // Look for "prepared by" or "issued by"
    const issuerMatches = text.match(/(?:prepared|issued|inspected|examined)\s+by\s*:?\s*([^\n]+)/gi);
    if (issuerMatches) {
      issuerMatches.forEach((name: string) => {
        vendorNames.add(name.replace(/^(prepared|issued|inspected|examined)\s+by\s*:?\s*/i, '').trim());
      });
    }
  }
  
  // Validate each vendor
  const results: VendorValidationResult[] = [];
  for (const vendorName of vendorNames) {
    const result = await validateVendor(vendorName);
    results.push(result);
  }
  
  return results;
}