const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const PENDING_CAMPAIGN_AUDIENCE_KEY =
  "lead-intelligence-pending-campaign-audience";

export function getQueueEventsWebSocketUrl(): string {
  const url = new URL(API_BASE_URL, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/queue/events`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

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
  last_email_sent_at: string | null;
  created_at: string;
  created_by_email: string | null;
  contacts: Contact[];
  pagespeed_scans: PageSpeedScanSummary[];
}

export interface CompanyPipelineFilters {
  view: "companies" | "leads";
  query: string;
  status: string | null;
  email_status: "all" | "contacted" | "not_contacted";
  website: "all" | "with_website" | "without_website";
  page: number;
  page_size: 10 | 25 | 50;
}

export interface CompanyPipelineResponse {
  items: Company[];
  page: number;
  page_count: number;
  page_size: number;
  total_count: number;
  eligible_count: number;
  company_count: number;
  status_counts: Record<string, number>;
  with_website_count: number;
  contacted_count: number;
}

export interface CompanyPipelineSelectionResponse {
  company_ids: string[];
  total_count: number;
}

export interface CompanyNavigationSummary {
  leads_needing_review: number;
}

export interface JobQueueStatusSummary {
  running_count: number;
  failed_count: number;
}

export type OverviewRange = "7d" | "30d" | "90d";

export interface OverviewKpi {
  current: number;
  previous: number;
  absolute_change: number;
  delta_percent: number | null;
  sparkline: number[];
  denominator: number | null;
  percentage: number | null;
}

export interface OverviewCoverageRate {
  count: number;
  total: number;
  percentage: number | null;
}

export interface OverviewQueueHealth {
  queued: number;
  running: number;
  failed: number;
}

export interface OverviewResponse {
  range: OverviewRange;
  previous_range: {
    start: string;
    end: string;
  };
  kpis: {
    websites_discovered: OverviewKpi;
    leads_created: OverviewKpi;
    reachable_leads: OverviewKpi;
    emails_sent: OverviewKpi;
  };
  funnel: {
    stages: {
      key: string;
      label: string;
      count: number;
      conversion_percent: number | null;
    }[];
    biggest_drop: string | null;
  };
  series: {
    date: string;
    websites_discovered: number;
    leads_created: number;
  }[];
  status_breakdown: {
    status: string;
    count: number;
    percentage: number | null;
  }[];
  coverage: {
    companies_total: number;
    with_email: OverviewCoverageRate;
    with_phone: OverviewCoverageRate;
    with_website: OverviewCoverageRate;
    with_industry: OverviewCoverageRate;
    crawl_success: OverviewCoverageRate;
  };
  jobs: {
    crawler: OverviewQueueHealth;
    pagespeed: OverviewQueueHealth;
    failed_badge_count: number;
  };
  attention: {
    id: string;
    count: number;
    message: string;
    href: string;
    metric_key: string;
  }[];
  onboarding: {
    steps: {
      id: string;
      label: string;
      href: string;
      completed: boolean;
    }[];
  } | null;
  recent_leads: {
    id: string;
    name: string;
    domain: string | null;
    contact_count: number;
    source_keyword: string | null;
    lead_status: string;
    created_at: string;
    last_email_sent_at: string | null;
  }[];
}

export interface OverviewUserProgress {
  user_id: string;
  email: string;
  role: "admin" | "user";
  is_active: boolean;
  searches_run: number;
  websites_discovered: number;
  companies_created: number;
  leads_created: number;
  crawls_completed: number;
  emails_sent: number;
}

export interface AdminOverviewResponse extends OverviewResponse {
  user_progress: OverviewUserProgress[];
}

export interface MemberActivitySeriesPoint {
  date: string;
  searches_run: number;
  websites_discovered: number;
  companies_created: number;
  leads_created: number;
  crawls_completed: number;
  emails_sent: number;
}

export interface MemberActivityResponse {
  member: OverviewUserProgress;
  range: OverviewRange;
  timezone: string;
  series: MemberActivitySeriesPoint[];
}

export interface SearchKeyword {
  id: string;
  keyword: string;
  searched_at: string;
}

export interface Contact {
  id: string;
  company_id: string;
  name: string | null;
  role: string | null;
  business_email: string | null;
  business_phone: string | null;
  is_publicly_listed: boolean;
}

export interface ContactInput {
  name: string | null;
  role: string | null;
  business_email: string | null;
  business_phone: string | null;
  is_publicly_listed: boolean;
}

export interface PageSpeedScanSummary {
  id: string;
  website_url: string;
  strategy: "mobile" | "desktop";
  category_scores: Record<string, number | null>;
  scanned_at: string;
}

export interface PageSpeedScanInput {
  strategy: "mobile" | "desktop";
}

export interface PageSpeedAudit {
  title?: string;
  description?: string;
  score: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
}

export interface BatchJobRetryResponse {
  retried_job_ids: string[];
  failures: { job_id: string; message: string }[];
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

export interface PageSpeedScanJob {
  id: string;
  company_ids: string[];
  website_id?: string | null;
  website_url: string;
  strategy: "mobile" | "desktop";
  status: "queued" | "running" | "succeeded" | "failed";
  attempts: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface WebsiteCorpusAnalysisJob {
  id: string;
  website_id: string;
  website_url: string;
  domain: string;
  source_crawled_at: string;
  status: "queued" | "running" | "succeeded" | "failed" | "skipped";
  attempts: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
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

export type DiscoveryProviderId = "tavily" | "octoparse";
export type TavilySearchDepth = "basic" | "fast" | "ultra-fast" | "advanced";
export type TavilyTopic = "general" | "news" | "finance";
export type TavilyTimeRange = "day" | "week" | "month" | "year";
export type DiscoveryToolCategory =
  | "search_engine"
  | "business_listing_website";

export interface DiscoverySearchInput extends DiscoveryInput {
  search_depth?: TavilySearchDepth;
  topic?: TavilyTopic;
  chunks_per_source?: number;
  country?: string;
  time_range?: TavilyTimeRange;
  start_date?: string;
  end_date?: string;
  filter_by_published_date?: boolean;
  include_domains?: string[];
  include_domains_mode?: "restrict" | "prefer";
  exclude_domains?: string[];
  include_answer?: boolean | "basic" | "advanced";
  include_favicon?: boolean;
  auto_parameters?: boolean;
  min_score?: number;
  providers?: DiscoveryProviderId[];
}

export interface OctoparseTemplateConfiguration {
  template_name: string;
  query_field: string;
  additional_parameters: Record<string, unknown>;
  title_field: string;
  url_field: string;
  content_field: string | null;
  score_field: string | null;
}

export interface OctoparseTemplateOption {
  template_name: string;
  slug: string | null;
  execution_mode: string | null;
  description: string | null;
  input_schema: Record<string, unknown>[];
  output_schema: Record<string, unknown>[];
  source_tree: unknown;
  source_summary: unknown;
}

export interface DiscoveryProviderJob {
  id: string;
  provider: DiscoveryProviderId;
  status: "running" | "succeeded" | "failed";
  results: DiscoveryResult[];
  error: string | null;
  warning: string | null;
}

export interface DiscoveryIngestInput extends DiscoveryInput {
  results: DiscoveryResult[];
  search_id: string;
}

export interface DiscoveryWebsiteSaveInput extends DiscoveryInput {
  results: DiscoveryWebsiteInput[];
  search_id: string;
}

export interface DiscoveryWebsiteInput {
  url: string;
  provider: DiscoveryProviderId;
}

export interface DiscoveryResult {
  title: string;
  url: string;
  content: string;
  score: number;
  provider: DiscoveryProviderId;
  favicon: string | null;
  published_date: string | null;
}

export interface DiscoveryResponse {
  query: string;
  results: DiscoveryResult[];
  search_id: string;
  answer: string | null;
  credits_used: number | null;
  provider_jobs: DiscoveryProviderJob[];
  provider_failures: {
    provider: DiscoveryProviderId;
    detail: string;
  }[];
}

export interface IngestResponse {
  query: string;
  results_found: number;
  candidates_created: number;
  results_skipped: number;
  websites_crawled: number;
  companies_enriched: number;
  contacts_added: number;
  pagespeed_scans_queued: number;
  crawl_failures: {
    source_url: string;
    detail: string;
  }[];
  pagespeed_jobs: PageSpeedScanJob[];
}

export interface DiscoveryWebsiteSaveResponse {
  query: string;
  results_found: number;
  websites_saved: number;
  crawl_jobs_enqueued: number;
  crawl_jobs_already_present: number;
  domains_skipped: number;
  hypestat_profiles_requested: number;
  hypestat_profiles_reused: number;
  hypestat_profiles_succeeded: number;
  hypestat_profiles_queued: number;
  hypestat_profiles_failed: number;
}

export interface WebsiteCrawlInput {
  website_url: string;
}

export interface WebsiteCrawlResponse {
  id: string;
  website_url: string;
  site_type: string | null;
  home_page_url: string | null;
  home_content: string | null;
  about_page_url: string | null;
  about_content: string | null;
  blog_page_url: string | null;
  blog_content: string | null;
  service_page_url: string | null;
  service_content: string | null;
  contact_page_url: string | null;
  contact_content: string | null;
  goals_page_url: string | null;
  goals_content: string | null;
  classification_signals: CrawlPageClassification[];
  emails: string[];
  phones: string[];
  social_links: string[];
  crawled_at: string;
}

export interface CrawlPageClassification {
  url: string;
  status_code?: number | null;
  error?: string | null;
  rendering_mode: string | null;
  classification_signals: PageClassificationSignals | null;
}

export interface PageClassificationSignals {
  page_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_type: string | null;
  generator: string | null;
  json_ld_scripts: string[];
  json_ld_schema_types: string[];
  microdata_schema_types: string[];
  heading_texts: string[];
  first_paragraph_text: string | null;
  meta_classification_terms: string[];
  url_classification_terms: string[];
  body_classification_terms: string[];
  article_count: number;
  password_input_count: number;
  shopping_elements: Record<string, number>;
  nav_link_texts: string[];
  footer_link_texts: string[];
  header_link_texts: string[];
  cta_texts: string[];
  url_path_patterns: string[];
}

export interface WebsiteCrawlJobResponse {
  id: string;
  website_url: string;
  status: "queued" | "running" | "succeeded" | "failed" | "skipped";
  attempts: number;
  error: string | null;
  skip_reason: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  result: WebsiteCrawlResponse | null;
}

export interface WebsiteCrawlBatchJobResponse {
  id: string;
  website_url: string;
  status: "queued" | "skipped";
  skip_reason: string | null;
}

export interface WebsiteCrawlBatchResponse {
  jobs: WebsiteCrawlBatchJobResponse[];
}

export interface WebsiteCrawlJobHistory {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "skipped";
  attempts: number;
  error: string | null;
  skip_reason: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export type ExcludedDomainReason =
  | "Big Tech / Social"
  | "Manual Exclusion"
  | "Unreachable"
  | "Blocked (403/429)";

export type ExcludedDomainSource =
  | "system_preset"
  | "user"
  | "auto_crawler";

export interface ExcludedDomainRecord {
  id: string;
  domain: string;
  reason: ExcludedDomainReason;
  note: string | null;
  source: ExcludedDomainSource;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

export interface ExcludedDomainInput {
  domain: string;
  reason: ExcludedDomainReason;
  note?: string;
}

export interface ExcludedDomainBatchResult {
  requested_count: number;
  created_count: number;
  updated_count: number;
  duplicate_count: number;
}

export interface ExcludedDomainCount {
  total_count: number;
}

export interface WebsiteRecord {
  id: string;
  website_url: string;
  domain: string;
  favicon_url: string | null;
  crawl_id: string | null;
  is_crawled: boolean;
  crawl_job_status:
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "skipped"
    | null;
  category: string | null;
  page_type: WebsitePageType | null;
  site_topic: string[];
  language: string | null;
  status: WebsiteStatus;
  discovery_source: string;
  discovery_provider: DiscoveryProviderId | null;
  created_at: string;
  created_by_email: string | null;
  crawled_at: string | null;
  crawl_signals: CrawlPageClassification[];
  hypestat_monthly_visits: number | null;
  hypestat_referring_domains: number | null;
  hypestat_global_rank: number | null;
  hypestat_country: string | null;
  hypestat_referring_domains_by_country: {
    country: string;
    domains: number;
  }[];
  hypestat_audience_countries: string[];
}

export type WebsiteRegistrySortKey =
  | "website"
  | "website_type"
  | "site_topic"
  | "language"
  | "crawled_at"
  | "hypestat_monthly_visits"
  | "hypestat_referring_domains"
  | "hypestat_global_rank"
  | "hypestat_country"
  | "hypestat_backlink_countries"
  | "hypestat_audience_countries";

export interface WebsiteRegistryPageParams {
  limit: number;
  offset: number;
  search: string;
  status?: WebsiteStatus;
  page_type?: string;
  category?: string;
  discovery_source?: string;
  minimum_monthly_visits?: number;
  minimum_referring_domains?: number;
  maximum_global_rank?: number;
  hypestat_country?: string;
  backlink_country?: string;
  audience_country?: string;
  sort_by?: WebsiteRegistrySortKey;
  sort_direction?: "ascending" | "descending";
}

export function websiteRegistryPageQueryKey(
  params: WebsiteRegistryPageParams,
) {
  return ["websites", "registry-page", params] as const;
}

export interface WebsiteRegistryPage {
  items: WebsiteRecord[];
  total_count: number;
  indexed_count: number;
  website_count: number;
}

export interface WebsiteRegistryFacets {
  categories: string[];
  discovery_sources: string[];
  hypestat_countries: string[];
  backlink_countries: string[];
  audience_countries: string[];
}

export interface WebsiteDetailResponse {
  website: WebsiteRecord;
  crawl: WebsiteCrawlResponse | null;
  pagespeed_scans: PageSpeedScanSummary[];
  hypestat_profile: WebsiteHypeStatProfile | null;
  crawl_jobs: WebsiteCrawlJobHistory[];
  discovery_keywords: SearchKeyword[];
}

export interface WebsiteHypeStatProfile {
  status:
    | "pending"
    | "succeeded"
    | "queued"
    | "failed"
    | "invalid_domain"
    | "removed";
  payload: Record<string, unknown> | null;
  error: string | null;
  checked_at: string | null;
  fetched_at: string | null;
}

export interface WebsiteCorpusWordStat {
  word: string;
  score: number;
  is_phrase: boolean;
}

export interface WebsiteCorpusAnalysis {
  website_id: string;
  domain: string;
  words: WebsiteCorpusWordStat[];
  computed_at: string | null;
}

export interface WebsiteCorpusWordsResponse {
  websites: WebsiteCorpusAnalysis[];
  pending_website_ids: string[];
  failed_website_ids: string[];
}

export interface WebsiteReclassificationBatchResult {
  eligible_count: number;
  recomputed_count: number;
  skipped_count: number;
}

export interface WebsiteAddToLeadsResult {
  requested_count: number;
  created_count: number;
  already_existing_count: number;
  status_updated_count: number;
  skipped_listing_count: number;
  skipped_uncrawled_count: number;
  not_found_count: number;
}

export interface WebsiteBatchStatusUpdateResult {
  requested_count: number;
  updated_count: number;
  not_found_count: number;
}

const WEBSITE_ACTION_BATCH_SIZE = 500;

export type WebsiteStatus = "new" | "lead" | "checked";

export type WebsitePageType =
  | "business_site"
  | "business_listing"
  | "article"
  | "blog"
  | "news"
  | "ecommerce"
  | "social_media"
  | "cms"
  | "software_tool"
  | "documentation"
  | "forum"
  | "media"
  | "other";

export interface WebsiteUpdateInput {
  status?: WebsiteStatus;
  page_type?: WebsitePageType | null;
  site_topic?: string[];
  language?: string | null;
}

export interface ApplicationSettings {
  crawl_max_pages: number;
  crawl_max_depth: number;
  tavily_configured: boolean;
  tavily_key_source: "database" | "unset";
  octoparse_configured: boolean;
  octoparse_key_source: "database" | "unset";
  hypestat_configured: boolean;
  hypestat_auto_fetch_enabled: boolean;
  hypestat_service_auth_configured: boolean;
  pagespeed_configured: boolean;
  pagespeed_key_source: "database" | "unset";
  gemini_configured: boolean;
  selected_discovery_tools: DiscoveryProviderId[];
  tavily_default_search_depth: TavilySearchDepth;
  tavily_default_country: string | null;
  tavily_default_exclude_domains: string[];
  octoparse_template: OctoparseTemplateConfiguration | null;
}

export interface TavilyUsage {
  key: {
    usage: number;
    limit: number | null;
    search_usage: number | null;
    extract_usage: number | null;
    crawl_usage: number | null;
    map_usage: number | null;
    research_usage: number | null;
  };
  account: {
    current_plan: string | null;
    plan_usage: number | null;
    plan_limit: number | null;
    paygo_usage: number | null;
    paygo_limit: number | null;
    search_usage: number | null;
    extract_usage: number | null;
    crawl_usage: number | null;
    map_usage: number | null;
    research_usage: number | null;
  } | null;
}

export interface OctoparseUsage {
  period_start: string;
  tasks_started: number;
  tasks_running: number;
  tasks_succeeded: number;
  tasks_failed: number;
  all_time_tasks_started: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let refreshRequest: Promise<boolean> | undefined;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const isMultipartBody =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (!isMultipartBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const sendRequest = () =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });

  let response = await sendRequest();
  if (response.status === 401 && !isAuthEntryPoint(path)) {
    if (await refreshAuthSession()) {
      response = await sendRequest();
    }
  }

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
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function isAuthEntryPoint(path: string): boolean {
  return [
    "/auth/login",
    "/auth/bootstrap",
    "/auth/register-organization",
    "/auth/refresh",
  ].includes(path);
}

function refreshAuthSession(): Promise<boolean> {
  if (!refreshRequest) {
    refreshRequest = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.ok)
      .finally(() => {
        refreshRequest = undefined;
      });
  }
  return refreshRequest;
}

export interface AuthSession {
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: "admin" | "user";
    is_active: boolean;
    created_at: string;
    profile_photo_url: string | null;
  };
  organizations: OrganizationOption[];
  organization_id: string;
  organization_name: string;
  organization_description: string | null;
  organization_logo_url: string | null;
  organization_banner_url: string | null;
}

export interface OrganizationOption {
  id: string;
  name: string;
  role: "admin" | "user";
}

export interface OrganizationUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: "admin" | "user";
  is_active: boolean;
  created_at: string;
  profile_photo_url: string | null;
}

export interface OrganizationInvitation {
  id?: string;
  email: string;
  role: "admin" | "user";
  expires_at: string;
  invitation_url?: string;
  created_at?: string;
}

export interface OrganizationInvitationPreview {
  organization_name: string;
  email: string;
  role: "admin" | "user";
  expires_at: string;
}

export type OrganizationImageAsset = "logo" | "banner";

export interface PushNotificationPreferences {
  website_crawl_enabled: boolean;
  pagespeed_enabled: boolean;
  outreach_enabled: boolean;
}

export interface PushSubscriptionSummary {
  id: string;
  endpoint: string;
  created_at: string;
}

export interface PushNotificationSettings {
  configured: boolean;
  public_key: string | null;
  subscriptions: PushSubscriptionSummary[];
  preferences: PushNotificationPreferences;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function getPushNotificationSettings(): Promise<PushNotificationSettings> {
  return request<PushNotificationSettings>("/notifications/push/settings");
}

export function savePushSubscription(
  subscription: PushSubscriptionInput,
): Promise<PushSubscriptionSummary> {
  return request<PushSubscriptionSummary>("/notifications/push/subscriptions", {
    method: "POST",
    body: JSON.stringify(subscription),
  });
}

export function removePushSubscription(endpoint: string): Promise<{
  removed: boolean;
}> {
  return request<{ removed: boolean }>("/notifications/push/subscriptions", {
    method: "DELETE",
    body: JSON.stringify({ endpoint }),
  });
}

export function updatePushNotificationPreferences(
  preferences: PushNotificationPreferences,
): Promise<PushNotificationPreferences> {
  return request<PushNotificationPreferences>("/notifications/push/preferences", {
    method: "PATCH",
    body: JSON.stringify(preferences),
  });
}

export interface UserTavilySearchPreferences {
  topic?: TavilyTopic | null;
  search_depth?: TavilySearchDepth | null;
  max_results?: 5 | 10 | 15 | 20 | null;
  country?: string | null;
  include_domains?: string[] | null;
  include_domains_mode?: "restrict" | "prefer" | null;
  exclude_domains?: string[] | null;
  date_mode?: "relative" | "custom" | null;
  time_range?: TavilyTimeRange | null;
  start_date?: string | null;
  end_date?: string | null;
  filter_by_published_date?: boolean | null;
  min_score?: number | null;
  include_answer?: boolean | null;
  auto_parameters?: boolean | null;
  auto_find_more?: boolean | null;
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  sidebar_collapsed: boolean;
  search: {
    providers: DiscoveryProviderId[] | null;
    tavily: UserTavilySearchPreferences | null;
  };
}

export type UserPreferencesUpdate = {
  theme?: UserPreferences["theme"];
  sidebar_collapsed?: boolean;
  search?: {
    providers?: DiscoveryProviderId[] | null;
    tavily?: UserTavilySearchPreferences | null;
  };
};

export function getUserPreferences(): Promise<UserPreferences> {
  return request<UserPreferences>("/preferences");
}

export function updateUserPreferences(
  preferences: UserPreferencesUpdate,
): Promise<UserPreferences> {
  return request<UserPreferences>("/preferences", {
    method: "PATCH",
    body: JSON.stringify(preferences),
  });
}

export function uploadProfilePhoto(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  return request<{ url: string }>("/media/profile-photo", {
    method: "POST",
    body: formData,
  });
}

export function deleteProfilePhoto(): Promise<void> {
  return request("/media/profile-photo", { method: "DELETE" });
}

export function uploadOrganizationImage(
  asset: OrganizationImageAsset,
  file: File,
): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  return request<{ url: string }>(`/media/organization/${asset}`, {
    method: "POST",
    body: formData,
  });
}

export function deleteOrganizationImage(
  asset: OrganizationImageAsset,
): Promise<void> {
  return request(`/media/organization/${asset}`, { method: "DELETE" });
}

export interface GmailAccountAssignee {
  assignment_id: string;
  user_id: string;
  email: string;
  assigned_at: string;
}

export interface ConnectedGmailAccount {
  id: string;
  email_address: string;
  google_account_id: string;
  owner_user_id: string | null;
  token_updated_at: string;
  assigned_users: GmailAccountAssignee[];
}

export interface AssignedGmailAccount {
  id: string;
  email_address: string;
}

export interface GmailAccountHealth {
  id: string;
  email_address: string;
  sent_30d: number;
  replies_30d: number;
  bounces_30d: number;
  failures_30d: number;
  unverified_30d: number;
  last_monitor_at: string | null;
  last_monitor_error: string | null;
}

export function getGmailAccountHealth(): Promise<GmailAccountHealth[]> {
  return request<GmailAccountHealth[]>("/gmail/accounts/health");
}

export interface GmailMessageSummary {
  id: string;
  thread_id: string;
  from_address: string;
  subject: string;
  date: string;
  snippet: string;
  is_unread: boolean;
}

export interface GmailMessagesResponse {
  messages: GmailMessageSummary[];
  next_page_token: string | null;
  result_size_estimate: number;
}

export interface GmailMessageDetail extends GmailMessageSummary {
  body_text: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
}

export interface UserGmailAssignment {
  id: string;
  org_id: string;
  user_id: string;
  gmail_account_id: string;
  assigned_by: string;
  created_at: string;
}

export interface EmailTemplate {
  id: string;
  org_id: string;
  name: string;
  subject: string;
  body_content: string;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateVariableMetadata {
  path: string;
  placeholder: string;
  label: string;
  description: string;
}

export interface EmailTemplateInput {
  name: string;
  subject: string;
  body_content: string;
}

export interface EmailTemplateDraftInput {
  prompt: string;
}

export interface EmailTemplatePreview {
  subject: string;
  body_content: string;
}

export interface EmailTemplateSendResult {
  status: string;
  message_id: string;
  thread_id: string;
  recipient_email: string;
}

export type EmailCampaignStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed";

export interface EmailCampaignRecipientCounts {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  cancelled: number;
  replied: number;
  bounced: number;
  sent_messages: number;
  unverified: number;
}

export interface EmailCampaignFollowUpStep {
  template_id: string;
  delay_days: number;
}

export interface EmailCampaign {
  id: string;
  org_id: string;
  created_by: string;
  name: string;
  template_id: string;
  follow_up_steps: EmailCampaignFollowUpStep[];
  verify_mx: boolean;
  gmail_account_ids: string[];
  daily_limit_per_account: number;
  min_delay_seconds: number;
  max_delay_seconds: number;
  send_window_start_hour: number;
  send_window_end_hour: number;
  timezone: string;
  status: EmailCampaignStatus;
  created_at: string;
  updated_at: string;
  recipient_counts: EmailCampaignRecipientCounts;
}

export interface EmailCampaignInput {
  name: string;
  template_id: string;
  follow_up_steps: EmailCampaignFollowUpStep[];
  verify_mx: boolean;
  gmail_account_ids: string[];
  daily_limit_per_account: number;
  min_delay_seconds: number;
  max_delay_seconds: number;
  send_window_start_hour: number;
  send_window_end_hour: number;
  timezone: string;
}

export interface EmailCampaignPreview {
  eligible_contact_count: number;
  skipped_companies_without_email: number;
  skipped_suppressed_contacts: number;
  skipped_company_ids: string[];
  daily_capacity_per_day: number;
  estimated_completion_at: string | null;
}

export interface EmailSuppression {
  id: string;
  target_type: "email" | "domain";
  normalized_value: string;
  reason: "unsubscribe" | "hard_bounce" | "complaint" | "manual_dnc";
  global_dnc: boolean;
  created_at: string;
}

export async function getEmailSuppressions(): Promise<EmailSuppression[]> {
  const response = await request<{ items: EmailSuppression[] }>(
    "/email-suppressions",
  );
  return response.items;
}

export function createEmailSuppression(payload: {
  target_type: EmailSuppression["target_type"];
  value: string;
  reason: EmailSuppression["reason"];
}): Promise<EmailSuppression> {
  return request<EmailSuppression>("/email-suppressions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function verifyEmailUnsubscribe(
  token: string,
): Promise<{ requires_email: boolean }> {
  const url = new URL(`${API_BASE_URL}/unsubscribe`);
  url.searchParams.set("token", token);
  const response = await fetch(url, {
    method: "GET",
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) {
    throw await createPublicApiError(response);
  }
  return (await response.json()) as { requires_email: boolean };
}

export async function confirmEmailUnsubscribe(
  token: string,
  email?: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/unsubscribe`, {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, ...(email ? { email } : {}) }),
  });
  if (!response.ok) {
    throw await createPublicApiError(response);
  }
}

async function createPublicApiError(response: Response): Promise<Error> {
  const body: unknown = await response.json().catch(() => null);
  const detail =
    typeof body === "object" && body !== null && "detail" in body
      ? body.detail
      : undefined;
  return new Error(
    typeof detail === "string"
      ? detail
      : `Could not complete the request (${response.status}).`,
  );
}

export function getBootstrapStatus(): Promise<{ required: boolean }> {
  return request<{ required: boolean }>("/auth/bootstrap-status");
}

export function getAuthSession(): Promise<AuthSession> {
  return request<AuthSession>("/auth/me");
}

export function bootstrapAdmin(input: {
  organization_name: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}): Promise<AuthSession> {
  return request<AuthSession>("/auth/bootstrap", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function registerOrganization(input: {
  organization_name: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}): Promise<AuthSession> {
  return request<AuthSession>("/auth/register-organization", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function login(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  return request<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAccountProfile(input: {
  first_name: string;
  last_name: string;
}): Promise<AuthSession> {
  return request<AuthSession>("/auth/me/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function logout(): Promise<void> {
  return request("/auth/logout", { method: "POST" });
}

export function changePassword(input: {
  current_password: string;
  new_password: string;
}): Promise<AuthSession> {
  return request<AuthSession>("/auth/password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getOrganizationUsers(): Promise<{ users: OrganizationUser[] }> {
  return request<{ users: OrganizationUser[] }>("/auth/users");
}

export function getOrganizationInvitations(): Promise<OrganizationInvitation[]> {
  return request<OrganizationInvitation[]>("/auth/invitations");
}

export function createOrganizationInvitation(input: {
  email: string;
  role: "admin" | "user";
}): Promise<OrganizationInvitation> {
  return request<OrganizationInvitation>("/auth/invitations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function revokeOrganizationInvitation(invitationId: string): Promise<void> {
  return request<void>(`/auth/invitations/${encodeURIComponent(invitationId)}`, {
    method: "DELETE",
  });
}

export function getOrganizationInvitation(
  token: string,
): Promise<OrganizationInvitationPreview> {
  return request<OrganizationInvitationPreview>(
    `/auth/invitations/${encodeURIComponent(token)}`,
  );
}

export function acceptOrganizationInvitation(
  token: string,
  input: {
    password: string;
    first_name?: string;
    last_name?: string;
  },
): Promise<AuthSession> {
  return request<AuthSession>(
    `/auth/invitations/${encodeURIComponent(token)}/accept`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function selectOrganization(organizationId: string): Promise<AuthSession> {
  return request<AuthSession>("/auth/select-organization", {
    method: "POST",
    body: JSON.stringify({ organization_id: organizationId }),
  });
}

export function updateOrganizationUserRole(
  userId: string,
  role: "admin" | "user",
): Promise<OrganizationUser> {
  return request<OrganizationUser>(
    `/auth/users/${encodeURIComponent(userId)}/role`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    },
  );
}

export function updateOrganizationDescription(
  description: string | null,
): Promise<{ description: string | null }> {
  return request<{ description: string | null }>("/auth/organization", {
    method: "PATCH",
    body: JSON.stringify({ description }),
  });
}

export function getConnectedGmailAccounts(): Promise<ConnectedGmailAccount[]> {
  return request<ConnectedGmailAccount[]>("/gmail/accounts");
}

export function getAssignedGmailAccounts(): Promise<AssignedGmailAccount[]> {
  return request<AssignedGmailAccount[]>("/gmail/accounts/assigned");
}

export function getGmailLabels(
  gmailAccountId: string,
): Promise<GmailLabel[]> {
  return request<GmailLabel[]>(
    `/gmail/accounts/${encodeURIComponent(gmailAccountId)}/labels`,
  );
}

export function getGmailMessages(
  gmailAccountId: string,
  options: {
    label_id?: string;
    q?: string;
    page_token?: string;
    max_results?: number;
  } = {},
): Promise<GmailMessagesResponse> {
  const query = new URLSearchParams();
  if (options.label_id) query.set("label_id", options.label_id);
  if (options.q) query.set("q", options.q);
  if (options.page_token) query.set("page_token", options.page_token);
  if (options.max_results !== undefined) {
    query.set("max_results", String(options.max_results));
  }
  const search = query.size > 0 ? `?${query.toString()}` : "";
  return request<GmailMessagesResponse>(
    `/gmail/accounts/${encodeURIComponent(gmailAccountId)}/messages${search}`,
  );
}

export function composeGmailMessage(
  gmailAccountId: string,
  input: {
    to: string[];
    cc: string[];
    bcc: string[];
    subject: string;
    body_text: string;
  },
): Promise<{ id: string; thread_id: string }> {
  return request<{ id: string; thread_id: string }>(
    `/gmail/accounts/${encodeURIComponent(gmailAccountId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function getGmailMessage(
  gmailAccountId: string,
  messageId: string,
): Promise<GmailMessageDetail> {
  return request<GmailMessageDetail>(
    `/gmail/accounts/${encodeURIComponent(gmailAccountId)}/messages/${encodeURIComponent(messageId)}`,
  );
}

export function replyToGmailMessage(
  gmailAccountId: string,
  messageId: string,
  bodyText: string,
): Promise<{ id: string; thread_id: string }> {
  return request<{ id: string; thread_id: string }>(
    `/gmail/accounts/${encodeURIComponent(gmailAccountId)}/messages/${encodeURIComponent(messageId)}/reply`,
    {
      method: "POST",
      body: JSON.stringify({ body_text: bodyText }),
    },
  );
}

export function getGoogleGmailAuthorizationUrl(orgId: string): string {
  const url = new URL(
    `${API_BASE_URL.replace(/\/+$/, "")}/auth/google/login`,
    window.location.origin,
  );
  url.searchParams.set("org_id", orgId);
  return url.toString();
}

export function assignGmailAccount(
  gmailAccountId: string,
  userId: string,
): Promise<UserGmailAssignment> {
  return request<UserGmailAssignment>(
    `/gmail/accounts/${encodeURIComponent(gmailAccountId)}/assignments`,
    {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    },
  );
}

export function removeGmailAssignment(assignmentId: string): Promise<void> {
  return request<void>(
    `/gmail/assignments/${encodeURIComponent(assignmentId)}`,
    { method: "DELETE" },
  );
}

export function getApplicationSettings(): Promise<ApplicationSettings> {
  return request<ApplicationSettings>("/settings");
}

export function updateApplicationSettings(
  input: {
    crawl_max_pages?: number;
    crawl_max_depth?: number;
    tavily_api_key?: string | null;
    octoparse_api_key?: string | null;
    hypestat_api_key?: string | null;
    pagespeed_api_key?: string | null;
    gemini_api_key?: string | null;
    hypestat_auto_fetch_enabled?: boolean;
    selected_discovery_tools?: DiscoveryProviderId[];
    tavily_default_search_depth?: TavilySearchDepth;
    tavily_default_country?: string | null;
    tavily_default_exclude_domains?: string[];
    octoparse_template?: OctoparseTemplateConfiguration | null;
  },
): Promise<ApplicationSettings> {
  return request<ApplicationSettings>("/settings", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function getTavilyUsage(): Promise<TavilyUsage> {
  return request<TavilyUsage>("/settings/tavily/usage");
}

export function getOctoparseUsage(): Promise<OctoparseUsage> {
  return request<OctoparseUsage>("/settings/octoparse/usage");
}

export function getOctoparseTemplates(
  keyword: string,
): Promise<{
  recommended_template_name: string | null;
  templates: OctoparseTemplateOption[];
}> {
  return request(
    `/settings/octoparse/templates?keyword=${encodeURIComponent(keyword)}`,
  );
}

function companyPipelineSearchParams(
  filters: Omit<CompanyPipelineFilters, "page" | "page_size">,
): URLSearchParams {
  const search = new URLSearchParams({
    view: filters.view,
    email_status: filters.email_status,
    website: filters.website,
  });
  if (filters.query) search.set("query", filters.query);
  if (filters.status) search.set("status", filters.status);
  return search;
}

export async function getCompanies(): Promise<Company[]> {
  const pageSize = 100;
  const companies: Company[] = [];
  let offset = 0;
  while (true) {
    const page = await request<Company[]>(
      `/companies?limit=${pageSize}&offset=${offset}`,
    );
    companies.push(...page);
    if (page.length < pageSize) return companies;
    offset += pageSize;
  }
}

export function getCompanyPipeline(
  filters: CompanyPipelineFilters,
): Promise<CompanyPipelineResponse> {
  const search = companyPipelineSearchParams(filters);
  search.set("page", String(filters.page));
  search.set("page_size", String(filters.page_size));
  return request<CompanyPipelineResponse>(
    `/companies/pipeline?${search.toString()}`,
  );
}

export function getCompanyPipelineSelection(
  filters: Omit<CompanyPipelineFilters, "page" | "page_size">,
): Promise<CompanyPipelineSelectionResponse> {
  const search = companyPipelineSearchParams(filters);
  return request<CompanyPipelineSelectionResponse>(
    `/companies/pipeline/selection?${search.toString()}`,
  );
}

export function getOverview(
  range: OverviewRange,
  timezone: string,
): Promise<OverviewResponse> {
  const search = new URLSearchParams({
    range,
    tz: timezone,
  });
  return request<OverviewResponse>(`/overview?${search.toString()}`);
}

export function getAdminOverview(
  range: OverviewRange,
  timezone: string,
): Promise<AdminOverviewResponse> {
  const search = new URLSearchParams({
    range,
    tz: timezone,
  });
  return request<AdminOverviewResponse>(
    `/overview/admin?${search.toString()}`,
  );
}

export function getOrganizationMemberActivity(
  memberId: string,
  range: OverviewRange,
  timezone: string,
): Promise<MemberActivityResponse> {
  const search = new URLSearchParams({ range, tz: timezone });
  return request<MemberActivityResponse>(
    `/overview/admin/users/${encodeURIComponent(memberId)}/activity?${search.toString()}`,
  );
}

export function getEmailTemplates(
  orgId: string,
): Promise<EmailTemplate[]> {
  return request<EmailTemplate[]>(
    `/orgs/${encodeURIComponent(orgId)}/templates`,
  );
}

export function getEmailTemplateVariables(
  orgId: string,
): Promise<EmailTemplateVariableMetadata[]> {
  return request<EmailTemplateVariableMetadata[]>(
    `/orgs/${encodeURIComponent(orgId)}/templates/variables`,
  );
}

export function createEmailTemplate(
  orgId: string,
  input: EmailTemplateInput,
): Promise<EmailTemplate> {
  return request<EmailTemplate>(
    `/orgs/${encodeURIComponent(orgId)}/templates`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function generateEmailTemplateDraft(
  orgId: string,
  input: EmailTemplateDraftInput,
): Promise<EmailTemplateInput> {
  return request<EmailTemplateInput>(
    `/orgs/${encodeURIComponent(orgId)}/templates/generate-draft`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateEmailTemplate(
  orgId: string,
  templateId: string,
  input: EmailTemplateInput,
): Promise<EmailTemplate> {
  return request<EmailTemplate>(
    `/orgs/${encodeURIComponent(orgId)}/templates/${encodeURIComponent(templateId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deleteEmailTemplate(
  orgId: string,
  templateId: string,
): Promise<void> {
  return request<void>(
    `/orgs/${encodeURIComponent(orgId)}/templates/${encodeURIComponent(templateId)}`,
    { method: "DELETE" },
  );
}

export function previewEmailTemplate(
  orgId: string,
  templateId: string,
  input: {
    company_id: string;
    contact_id?: string;
    gmail_account_id?: string;
  },
): Promise<EmailTemplatePreview> {
  return request<EmailTemplatePreview>(
    `/orgs/${encodeURIComponent(orgId)}/templates/${encodeURIComponent(templateId)}/preview`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function sendEmailTemplate(
  orgId: string,
  templateId: string,
  input: {
    company_id: string;
    contact_id: string;
    gmail_account_id: string;
  },
): Promise<EmailTemplateSendResult> {
  return request<EmailTemplateSendResult>(
    `/orgs/${encodeURIComponent(orgId)}/templates/${encodeURIComponent(templateId)}/send`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function getEmailCampaigns(
  orgId: string,
): Promise<EmailCampaign[]> {
  const pageSize = 100;
  const campaigns: EmailCampaign[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const page = await request<EmailCampaign[]>(
      `/orgs/${encodeURIComponent(orgId)}/campaigns?limit=${pageSize}&offset=${offset}`,
    );
    campaigns.push(...page);
    if (page.length < pageSize) return campaigns;
  }
}

export function getEmailCampaign(
  orgId: string,
  campaignId: string,
): Promise<EmailCampaign> {
  return request<EmailCampaign>(
    `/orgs/${encodeURIComponent(orgId)}/campaigns/${encodeURIComponent(campaignId)}`,
  );
}

export function createEmailCampaign(
  orgId: string,
  input: EmailCampaignInput,
): Promise<EmailCampaign> {
  return request<EmailCampaign>(
    `/orgs/${encodeURIComponent(orgId)}/campaigns`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function previewEmailCampaign(
  orgId: string,
  campaignId: string,
  companyIds: string[],
): Promise<EmailCampaignPreview> {
  return request<EmailCampaignPreview>(
    `/orgs/${encodeURIComponent(orgId)}/campaigns/${encodeURIComponent(campaignId)}/preview`,
    {
      method: "POST",
      body: JSON.stringify({ company_ids: companyIds }),
    },
  );
}

export function startEmailCampaign(
  orgId: string,
  campaignId: string,
  companyIds: string[],
): Promise<EmailCampaign> {
  return request<EmailCampaign>(
    `/orgs/${encodeURIComponent(orgId)}/campaigns/${encodeURIComponent(campaignId)}/start`,
    {
      method: "POST",
      body: JSON.stringify({ company_ids: companyIds }),
    },
  );
}

export function pauseEmailCampaign(
  orgId: string,
  campaignId: string,
): Promise<EmailCampaign> {
  return request<EmailCampaign>(
    `/orgs/${encodeURIComponent(orgId)}/campaigns/${encodeURIComponent(campaignId)}/pause`,
    { method: "POST" },
  );
}

export function resumeEmailCampaign(
  orgId: string,
  campaignId: string,
): Promise<EmailCampaign> {
  return request<EmailCampaign>(
    `/orgs/${encodeURIComponent(orgId)}/campaigns/${encodeURIComponent(campaignId)}/resume`,
    { method: "POST" },
  );
}

export function deleteEmailCampaign(
  orgId: string,
  campaignId: string,
): Promise<void> {
  return request<void>(
    `/orgs/${encodeURIComponent(orgId)}/campaigns/${encodeURIComponent(campaignId)}`,
    { method: "DELETE" },
  );
}

export function createCompany(input: CompanyInput): Promise<Company> {
  return request<Company>("/companies", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getCompanyContacts(companyId: string): Promise<Contact[]> {
  return request<Contact[]>(
    `/companies/${encodeURIComponent(companyId)}/contacts`,
  );
}

export function getCompanyContact(
  companyId: string,
  contactId: string,
): Promise<Contact> {
  return request<Contact>(
    `/companies/${encodeURIComponent(companyId)}/contacts/${encodeURIComponent(contactId)}`,
  );
}

export function createCompanyContact(
  companyId: string,
  input: ContactInput,
): Promise<Contact> {
  return request<Contact>(
    `/companies/${encodeURIComponent(companyId)}/contacts`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateCompanyContact(
  companyId: string,
  contactId: string,
  input: ContactInput,
): Promise<Contact> {
  return request<Contact>(
    `/companies/${encodeURIComponent(companyId)}/contacts/${encodeURIComponent(contactId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deleteCompanyContact(
  companyId: string,
  contactId: string,
): Promise<void> {
  return request<void>(
    `/companies/${encodeURIComponent(companyId)}/contacts/${encodeURIComponent(contactId)}`,
    { method: "DELETE" },
  );
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

export function getWebsitePageSpeedScan(
  websiteId: string,
  scanId: string,
): Promise<PageSpeedScanReport> {
  return request<PageSpeedScanReport>(
    `/websites/${encodeURIComponent(websiteId)}/pagespeed-scans/${encodeURIComponent(scanId)}`,
  );
}

export function getPageSpeedScanJob(
  companyId: string,
  jobId: string,
): Promise<PageSpeedScanJob> {
  return request<PageSpeedScanJob>(
    `/companies/${companyId}/pagespeed-jobs/${jobId}`,
  );
}

export function createPageSpeedScan(
  companyId: string,
  input: PageSpeedScanInput,
): Promise<PageSpeedScanSummary> {
  return request<PageSpeedScanSummary>(
    `/companies/${companyId}/pagespeed-scans`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
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
  input: DiscoverySearchInput,
): Promise<DiscoveryResponse> {
  return request<DiscoveryResponse>("/discovery/search", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getDiscoveryProviderJob(
  jobId: string,
): Promise<DiscoveryProviderJob> {
  return request<DiscoveryProviderJob>(`/discovery/jobs/${jobId}`);
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

export function saveDiscoveryWebsites(
  input: DiscoveryWebsiteSaveInput,
): Promise<DiscoveryWebsiteSaveResponse> {
  return request<DiscoveryWebsiteSaveResponse>("/discovery/save-websites", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateWebsite(
  websiteId: string,
  input: WebsiteUpdateInput,
): Promise<WebsiteRecord> {
  return request<WebsiteRecord>(`/websites/${websiteId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function addWebsitesToLeads(
  websiteIds: string[],
): Promise<WebsiteAddToLeadsResult> {
  const result: WebsiteAddToLeadsResult = {
    requested_count: 0,
    created_count: 0,
    already_existing_count: 0,
    status_updated_count: 0,
    skipped_listing_count: 0,
    skipped_uncrawled_count: 0,
    not_found_count: 0,
  };
  for (
    let offset = 0;
    offset < websiteIds.length;
    offset += WEBSITE_ACTION_BATCH_SIZE
  ) {
    const batch = await request<WebsiteAddToLeadsResult>(
      "/websites/add-to-leads",
      {
        method: "POST",
        body: JSON.stringify({
          website_ids: websiteIds.slice(
            offset,
            offset + WEBSITE_ACTION_BATCH_SIZE,
          ),
        }),
      },
    );
    result.requested_count += batch.requested_count;
    result.created_count += batch.created_count;
    result.already_existing_count += batch.already_existing_count;
    result.status_updated_count += batch.status_updated_count;
    result.skipped_listing_count += batch.skipped_listing_count;
    result.skipped_uncrawled_count += batch.skipped_uncrawled_count;
    result.not_found_count += batch.not_found_count;
  }
  return result;
}

export async function updateWebsitesStatus(
  website_ids: string[],
  status: WebsiteStatus,
): Promise<WebsiteBatchStatusUpdateResult> {
  const result: WebsiteBatchStatusUpdateResult = {
    requested_count: 0,
    updated_count: 0,
    not_found_count: 0,
  };
  for (
    let offset = 0;
    offset < website_ids.length;
    offset += WEBSITE_ACTION_BATCH_SIZE
  ) {
    const batch = await request<WebsiteBatchStatusUpdateResult>(
      "/websites/batch-status",
      {
        method: "PATCH",
        body: JSON.stringify({
          website_ids: website_ids.slice(
            offset,
            offset + WEBSITE_ACTION_BATCH_SIZE,
          ),
          status,
        }),
      },
    );
    result.requested_count += batch.requested_count;
    result.updated_count += batch.updated_count;
    result.not_found_count += batch.not_found_count;
  }
  return result;
}

export function reclassifyWebsite(websiteId: string): Promise<WebsiteRecord> {
  return request<WebsiteRecord>(`/websites/${websiteId}/reclassify`, {
    method: "POST",
  });
}

export function reclassifyUnclassifiedWebsites(): Promise<WebsiteReclassificationBatchResult> {
  return request<WebsiteReclassificationBatchResult>(
    "/websites/reclassify-unclassified",
    { method: "POST" },
  );
}

export function getWebsiteDetail(
  websiteId: string,
): Promise<WebsiteDetailResponse> {
  return request<WebsiteDetailResponse>(`/websites/${websiteId}`);
}

export function refetchWebsiteHypeStat(
  websiteId: string,
): Promise<WebsiteHypeStatProfile> {
  return request<WebsiteHypeStatProfile>(
    `/websites/${websiteId}/hypestat/refetch`,
    { method: "POST" },
  );
}

export function getWebsiteCorpusWords(
  websiteIds: string[],
): Promise<WebsiteCorpusWordsResponse> {
  const search = new URLSearchParams();
  for (const websiteId of websiteIds) {
    search.append("website_ids", websiteId);
  }
  return request<WebsiteCorpusWordsResponse>(
    `/websites/corpus-words?${search.toString()}`,
  );
}

export function getWebsiteCorpusAnalysisJobs(): Promise<
  WebsiteCorpusAnalysisJob[]
> {
  return request<WebsiteCorpusAnalysisJob[]>(
    "/websites/corpus-words/jobs",
  );
}

export function retryWebsiteCorpusAnalysisJob(
  jobId: string,
): Promise<WebsiteCorpusAnalysisJob> {
  return request<WebsiteCorpusAnalysisJob>(
    `/websites/corpus-words/jobs/${jobId}/retry`,
    { method: "POST" },
  );
}

export function retryWebsiteCorpusAnalysisJobs(
  jobIds: string[],
): Promise<BatchJobRetryResponse> {
  return request<BatchJobRetryResponse>(
    "/websites/corpus-words/jobs/retry-batch",
    {
      method: "POST",
      body: JSON.stringify({ job_ids: jobIds }),
    },
  );
}

export function crawlWebsite(
  input: WebsiteCrawlInput,
): Promise<WebsiteCrawlJobResponse> {
  return request<WebsiteCrawlJobResponse>("/crawler/crawl", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function crawlWebsites(
  website_urls: string[],
): Promise<WebsiteCrawlBatchResponse> {
  return request<WebsiteCrawlBatchResponse>("/crawler/crawl/batch", {
    method: "POST",
    body: JSON.stringify({ website_urls }),
  });
}

export function getWebsiteCrawlJob(
  jobId: string,
): Promise<WebsiteCrawlJobResponse> {
  return request<WebsiteCrawlJobResponse>(`/crawler/jobs/${jobId}`);
}

export function getWebsiteCrawlJobs(): Promise<WebsiteCrawlJobResponse[]> {
  return request<WebsiteCrawlJobResponse[]>("/crawler/jobs?limit=100");
}

export function getWebsiteCrawlJobSummary(): Promise<JobQueueStatusSummary> {
  return request<JobQueueStatusSummary>("/crawler/jobs/summary");
}

export function getExcludedDomains(
  search = "",
  reason?: ExcludedDomainReason,
  limit = 25,
  offset = 0,
): Promise<ExcludedDomainRecord[]> {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (search.trim()) query.set("search", search.trim());
  if (reason) query.set("reason", reason);
  return request<ExcludedDomainRecord[]>(
    `/excluded-domains?${query.toString()}`,
  );
}

export function getExcludedDomainCount(
  search = "",
  reason?: ExcludedDomainReason,
): Promise<ExcludedDomainCount> {
  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  if (reason) query.set("reason", reason);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return request<ExcludedDomainCount>(`/excluded-domains/count${suffix}`);
}

export function addExcludedDomain(
  input: ExcludedDomainInput,
): Promise<ExcludedDomainRecord> {
  return request<ExcludedDomainRecord>("/excluded-domains", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function addExcludedDomainsBatch(
  domains: ExcludedDomainInput[],
): Promise<ExcludedDomainBatchResult> {
  return request<ExcludedDomainBatchResult>("/excluded-domains/batch", {
    method: "POST",
    body: JSON.stringify({ domains }),
  });
}

export function deleteExcludedDomain(domainId: string): Promise<void> {
  return request<void>(`/excluded-domains/${domainId}`, {
    method: "DELETE",
  });
}

export async function getWebsites(): Promise<WebsiteRecord[]> {
  const pageSize = 500;
  const websites: WebsiteRecord[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const page = await request<WebsiteRecord[]>(
      `/websites?limit=${pageSize}&offset=${offset}`,
    );
    websites.push(...page);
    if (page.length < pageSize) return websites;
  }
}

export function getWebsiteRegistryPage(
  params: WebsiteRegistryPageParams,
): Promise<WebsiteRegistryPage> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  return request<WebsiteRegistryPage>(
    `/websites/registry-page?${searchParams.toString()}`,
  );
}

export function getWebsiteRegistryFacets(): Promise<WebsiteRegistryFacets> {
  return request<WebsiteRegistryFacets>("/websites/registry-facets");
}

export function getPageSpeedScanJobs(): Promise<PageSpeedScanJob[]> {
  return request<PageSpeedScanJob[]>("/pagespeed/jobs?limit=100");
}

export function getPageSpeedJobSummary(): Promise<JobQueueStatusSummary> {
  return request<JobQueueStatusSummary>("/pagespeed/jobs/summary");
}

export function getCompanyNavigationSummary(): Promise<CompanyNavigationSummary> {
  return request<CompanyNavigationSummary>("/companies/navigation-summary");
}

export function retryWebsiteCrawlJob(
  jobId: string,
): Promise<WebsiteCrawlJobResponse> {
  return request<WebsiteCrawlJobResponse>(
    `/crawler/jobs/${jobId}/retry`,
    { method: "POST" },
  );
}

export function retryWebsiteCrawlJobs(
  jobIds: string[],
): Promise<BatchJobRetryResponse> {
  return request<BatchJobRetryResponse>("/crawler/jobs/retry-batch", {
    method: "POST",
    body: JSON.stringify({ job_ids: jobIds }),
  });
}

export function retryPageSpeedScanJob(
  jobId: string,
): Promise<PageSpeedScanJob> {
  return request<PageSpeedScanJob>(`/pagespeed/jobs/${jobId}/retry`, {
    method: "POST",
  });
}

export function retryPageSpeedScanJobs(
  jobIds: string[],
): Promise<BatchJobRetryResponse> {
  return request<BatchJobRetryResponse>("/pagespeed/jobs/retry-batch", {
    method: "POST",
    body: JSON.stringify({ job_ids: jobIds }),
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
): Promise<WebsiteCrawlJobResponse> {
  return request<WebsiteCrawlJobResponse>(
    `/companies/${companyId}/website-crawl`,
    { method: "POST" },
  );
}

