// backend/src/services/googleSearchService.ts
import axios from 'axios';

// Free tier: 250 searches/month — https://serpapi.com
// Read at call time so dotenv in `index.ts` has run before first search.
function serpApiKey(): string | undefined {
  return process.env.SERPAPI_KEY;
}

type SerpOrganicResult = {
  title?: string;
  snippet?: string;
  link?: string;
  displayed_link?: string;
};

/** SerpAPI `knowledge_graph` shape (partial). */
type SerpKnowledgeGraph = {
  title?: string;
  website?: string;
  address?: string;
  phone?: string;
  rating?: { value?: number; count?: number };
};

export async function searchGoogle(query: string): Promise<{
  success: boolean;
  error?: string;
  results: SerpOrganicResult[];
  knowledgeGraph?: SerpKnowledgeGraph;
  totalResults?: unknown;
}> {
  const key = serpApiKey();
  if (!key) {
    console.error("SERPAPI_KEY not configured in environment variables");
    return {
      success: false,
      error: "Search service not configured",
      results: [],
    };
  }

  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        api_key: key,
        q: query,
        engine: 'google',
        num: 10
      },
      timeout: 10000
    });
    
    const organic: SerpOrganicResult[] = Array.isArray(
      response.data.organic_results,
    )
      ? response.data.organic_results
      : [];
    return {
      success: true,
      results: organic,
      knowledgeGraph: response.data.knowledge_graph as
        | SerpKnowledgeGraph
        | undefined,
      totalResults: response.data.search_information?.total_results,
    };
  } catch (error) {
    console.error('Google search error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Search failed',
      results: [] 
    };
  }
}

const NAME_STOPWORDS = new Set([
  "ltd",
  "limited",
  "inc",
  "llc",
  "corp",
  "corporation",
  "co",
  "company",
  "the",
  "and",
  "&",
]);

function hostnameFromWebsite(raw?: string): string | null {
  if (!raw?.trim()) return null;
  let s = raw.trim();
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    return new URL(s).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function significantNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .filter((t) => t.length > 1 && !NAME_STOPWORDS.has(t));
}

export type VendorSearchHints = {
  website?: string;
  phone?: string;
};

export type VendorEvidenceLink = { title: string; link: string };

function organicEvidenceLinks(
  results: SerpOrganicResult[],
): VendorEvidenceLink[] {
  return results
    .slice(0, 5)
    .map((r) => ({
      title: (r.title || "Search result").trim(),
      link: (r.link || "").trim(),
    }))
    .filter((x) => x.link.length > 0);
}

export async function validateVendorOnline(
  vendorName: string,
  address?: string,
  hints?: VendorSearchHints,
) {
  if (!serpApiKey()) {
    return {
      exists: false,
      verified: false,
      message: "Search service not configured. Please set SERPAPI_KEY in .env file.",
      requiresManualVerification: true,
      evidenceLinks: [] as VendorEvidenceLink[],
    };
  }

  const host = hostnameFromWebsite(hints?.website);
  const phoneDigits = (hints?.phone || "").replace(/\D/g, "");
  const queryParts = [vendorName, address, host, hints?.phone].filter(
    (p): p is string => !!p && String(p).trim().length > 0,
  );
  const searchQuery = `${queryParts.join(" ")}`.trim();
  const result = await searchGoogle(searchQuery);

  if (!result.success) {
    return {
      exists: false,
      verified: false,
      message: result.error || "Unable to verify",
      requiresManualVerification: true,
      evidenceLinks: [] as VendorEvidenceLink[],
    };
  }

  const nameLower = vendorName.toLowerCase();
  const tokens = significantNameTokens(vendorName);

  const blobFor = (r: { title?: string; snippet?: string; link?: string; displayed_link?: string }) =>
    `${r.title || ""} ${r.snippet || ""} ${r.link || ""} ${r.displayed_link || ""}`.toLowerCase();

  const organicMatchesName = result.results.some((r) => {
    const b = blobFor(r);
    if (b.includes(nameLower)) return true;
    if (tokens.length === 0) return false;
    return tokens.every((t) => b.includes(t));
  });

  const domainInOrganic =
    !!host &&
    result.results.some((r) => {
      const b = blobFor(r);
      return b.includes(host);
    });

  const kg = result.knowledgeGraph;
  const kgTitle = String(kg?.title || "").toLowerCase();
  const kgWeb = String(kg?.website || "").toLowerCase();
  const kgMatches =
    (!!kg && kgTitle.includes(nameLower)) ||
    (!!host && kgWeb.includes(host)) ||
    (!!kg && tokens.length > 0 && tokens.every((t) => kgTitle.includes(t)));

  const phoneInOrganic =
    phoneDigits.length >= 7 &&
    result.results.some((r) => {
      const d = `${r.title || ""} ${r.snippet || ""}`.replace(/\D/g, "");
      return d.includes(phoneDigits) || d.includes(phoneDigits.slice(-8));
    });

  const hasBusinessListing =
    organicMatchesName || domainInOrganic || kgMatches || (!!host && phoneInOrganic);

  const hasReview = result.results.some(
    (r) =>
      r.snippet?.toLowerCase().includes("review") ||
      r.snippet?.toLowerCase().includes("rating"),
  );

  return {
    exists: hasBusinessListing,
    verified: hasBusinessListing,
    hasReview,
    resultCount: result.results.length,
    rating: kg?.rating?.value,
    reviewCount: kg?.rating?.count,
    address: kg?.address,
    phone: kg?.phone,
    website: kg?.website,
    topResult: result.results[0]?.title || null,
    requiresManualVerification: false,
    evidenceLinks: organicEvidenceLinks(result.results),
  };
}