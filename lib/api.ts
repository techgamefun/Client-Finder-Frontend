const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

export interface Company {
  id: string;
  name: string;
  website: string | null;
  domain: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  software_need: string | null;
  lead_score: number | null;
  lead_status: string;
  created_at: string;
  contacts: Contact[];
  sources: LeadSource[];
  search_keywords: SearchKeyword[];
  pagespeed_scans: PageSpeedScanSummary[];
}

export interface SearchKeyword {
  id: string;
  keyword: string;
  searched_at: string;
}

export interface Contact {
  id: string;
  name: string | null;
  role: string | null;
  business_email: string | null;
  business_phone: string | null;
  is_publicly_listed: boolean;
}

export interface LeadSource {
  id: string;
  source_url: string;
  source_type: string | null;
  evidence: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface PageSpeedScanSummary {
  id: string;
  website_url: string;
  strategy: "mobile" | "desktop";
  category_scores: Record<string, number | null>;
  scanned_at: string;
}

export interface PageSpeedAudit {
  title?: string;
  description?: string;
  score: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
}

export interface PageSpeedScanReport extends PageSpeedScanSummary {
  report: {
    analysisUTCTimestamp?: string | null;
    loadingExperience?: Record<string, unknown> | null;
    originLoadingExperience?: Record<string, unknown> | null;
    lighthouseResult: {
      finalUrl?: string;
      fetchTime?: string;
      lighthouseVersion?: string;
      audits?: Record<string, PageSpeedAudit>;
    };
  };
}

export interface CompanyInput {
  name: string;
  website?: string | null;
  domain?: string | null;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  software_need?: string | null;
}

export type CompanyUpdateInput = Partial<CompanyInput> & {
  lead_score?: number | null;
};

export interface DiscoveryInput {
  query: string;
  max_results: number;
}

export interface DiscoveryIngestInput extends DiscoveryInput {
  results: DiscoveryResult[];
  search_id: string;
}

export interface DiscoveryResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface DiscoveryResponse {
  query: string;
  results: DiscoveryResult[];
  search_id: string;
}

export interface IngestResponse {
  query: string;
  results_found: number;
  candidates_created: number;
  sources_added: number;
  results_skipped: number;
  websites_crawled: number;
  companies_enriched: number;
  contacts_added: number;
  pagespeed_scans_saved: number;
  crawl_failures: {
    source_url: string;
    detail: string;
  }[];
  pagespeed_failures: {
    website_url: string;
    strategy: string;
    detail: string;
  }[];
}

export interface WebsiteCrawlInput {
  website_url: string;
}

export interface WebsiteCrawlResponse {
  id: string;
  website_url: string;
  about_page_url: string | null;
  about_content: string | null;
  contact_page_url: string | null;
  contact_content: string | null;
  goals_page_url: string | null;
  goals_content: string | null;
  emails: string[];
  social_links: string[];
  crawled_at: string;
}

export interface ResearchSourceCrawlInput {
  source_url: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? body.detail
        : undefined;
    const message =
      typeof detail === "string"
        ? detail
        : detail === undefined
          ? `API request failed (${response.status})`
          : JSON.stringify(detail);
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getCompanies(): Promise<Company[]> {
  const pageSize = 100;
  const companies: Company[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const page = await request<Company[]>(
      `/companies?limit=${pageSize}&offset=${offset}`,
    );
    companies.push(...page);
    if (page.length < pageSize) return companies;
  }
}

export function createCompany(input: CompanyInput): Promise<Company> {
  return request<Company>("/companies", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getCompany(companyId: string): Promise<Company> {
  return request<Company>(`/companies/${companyId}`);
}

export function getPageSpeedScan(
  companyId: string,
  scanId: string,
): Promise<PageSpeedScanReport> {
  return request<PageSpeedScanReport>(
    `/companies/${companyId}/pagespeed-scans/${scanId}`,
  );
}

export function updateCompany(
  companyId: string,
  input: CompanyUpdateInput,
): Promise<Company> {
  return request<Company>(`/companies/${companyId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function updateLeadStatus(
  companyId: string,
  leadStatus: string,
): Promise<Company> {
  return request<Company>(`/companies/${companyId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ lead_status: leadStatus }),
  });
}

export function deleteCompany(companyId: string): Promise<void> {
  return request<void>(`/companies/${companyId}`, {
    method: "DELETE",
  });
}

export function searchCompanies(
  input: DiscoveryInput,
): Promise<DiscoveryResponse> {
  return request<DiscoveryResponse>("/discovery/search", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getSearchKeywordSuggestions(
  query: string,
): Promise<SearchKeyword[]> {
  return request<SearchKeyword[]>(
    `/discovery/suggestions?query=${encodeURIComponent(query)}`,
  );
}

export function ingestCompanies(
  input: DiscoveryIngestInput,
): Promise<IngestResponse> {
  return request<IngestResponse>("/discovery/ingest", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function crawlWebsite(
  input: WebsiteCrawlInput,
): Promise<WebsiteCrawlResponse> {
  return request<WebsiteCrawlResponse>("/crawler/crawl", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getCompanyWebsiteCrawl(
  companyId: string,
): Promise<WebsiteCrawlResponse | null> {
  return request<WebsiteCrawlResponse | null>(
    `/companies/${companyId}/website-crawl`,
  );
}

export function crawlCompanyWebsite(
  companyId: string,
): Promise<WebsiteCrawlResponse> {
  return request<WebsiteCrawlResponse>(
    `/companies/${companyId}/website-crawl`,
    { method: "POST" },
  );
}

export function crawlResearchSource(
  companyId: string,
  input: ResearchSourceCrawlInput,
): Promise<Company> {
  return request<Company>(`/companies/${companyId}/sources/crawl`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
