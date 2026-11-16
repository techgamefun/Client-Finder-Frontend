export const metrics = {
  websites_discovered: {
    label: "Websites discovered",
    definition:
      "Websites whose registry record was created during the selected interval. The comparison uses the immediately preceding interval of equal duration.",
    source: "websites.created_at",
    timeField: "Website creation time",
    orgScope: "The active organization",
  },
  leads_created: {
    label: "Leads created",
    definition:
      "Companies created during the selected interval that currently have at least one contact. A contact added later can therefore qualify an older company.",
    source: "companies.created_at; contacts.company_id",
    timeField: "Company creation time",
    orgScope: "Companies and contacts in the active organization",
  },
  reachable_leads: {
    label: "Reachable leads",
    definition:
      "Leads created during the selected interval with at least one contact that has a nonblank business email or phone. The card shows the count out of all companies created in that interval.",
    source:
      "companies.created_at; contacts.business_email; contacts.business_phone",
    timeField: "Company creation time",
    orgScope: "Companies and contacts in the active organization",
  },
  emails_sent: {
    label: "Emails sent",
    definition:
      "Campaign-recipient records with status Sent and a sent timestamp during the selected interval. Direct Gmail sends outside campaigns are not represented in this metric.",
    source: "email_campaign_recipients.status; sent_at",
    timeField: "Successful campaign send time",
    orgScope: "Campaign recipients in the active organization",
  },
  funnel_discovered: {
    label: "Discovered websites",
    definition:
      "Website records created in the selected interval. Subsequent funnel stages show the current state of this same Website cohort.",
    source: "websites.created_at",
    timeField: "Website creation time",
    orgScope: "Websites in the active organization",
  },
  funnel_crawled: {
    label: "Crawled websites",
    definition:
      "Discovered websites with a linked successful WebsiteCrawl record.",
    source: "websites.crawl_id",
    timeField: "Website creation time defines the cohort",
    orgScope: "Websites and crawls in the active organization",
  },
  funnel_added: {
    label: "Websites added to leads",
    definition:
      "Crawled websites whose registry status is Lead.",
    source: "websites.status",
    timeField: "Website creation time defines the cohort",
    orgScope: "Websites in the active organization",
  },
  funnel_has_contact: {
    label: "Leads with a contact",
    definition:
      "Websites in the cohort that are added to Leads and have a domain-matched company with at least one contact.",
    source: "websites.domain; companies.domain; contacts.company_id",
    timeField: "Website creation time defines the cohort",
    orgScope: "Websites, companies, and contacts in the active organization",
  },
  funnel_emailed: {
    label: "Leads emailed",
    definition:
      "Leads in the cohort with at least one successful campaign-recipient record, regardless of when that send occurred.",
    source: "email_campaign_recipients.company_id; status",
    timeField: "Current state; successful send can be from any date",
    orgScope: "Websites, companies, contacts, and recipients in the active organization",
  },
  pipeline_status: {
    label: "Lead status",
    definition:
      "Current count and share of companies that have at least one contact, grouped by the stored lead_status value.",
    source: "companies.lead_status; contacts.company_id",
    timeField: "Current state; no time filter",
    orgScope: "Companies and contacts in the active organization",
  },
  with_email: {
    label: "Companies with email",
    definition:
      "Companies with at least one contact whose business email is nonblank, shown out of all current companies.",
    source: "contacts.business_email",
    timeField: "Current state; no time filter",
    orgScope: "Companies and contacts in the active organization",
  },
  with_phone: {
    label: "Companies with phone",
    definition:
      "Companies with at least one contact whose business phone is nonblank, shown out of all current companies.",
    source: "contacts.business_phone",
    timeField: "Current state; no time filter",
    orgScope: "Companies and contacts in the active organization",
  },
  with_website: {
    label: "Companies with website",
    definition:
      "Companies with a nonblank website URL or domain, shown out of all current companies.",
    source: "companies.website; companies.domain",
    timeField: "Current state; no time filter",
    orgScope: "Companies in the active organization",
  },
  with_industry: {
    label: "Companies with industry",
    definition:
      "Companies with a nonblank industry value, shown out of all current companies.",
    source: "companies.industry",
    timeField: "Current state; no time filter",
    orgScope: "Companies in the active organization",
  },
  crawl_success: {
    label: "Crawl success rate",
    definition:
      "Succeeded crawl jobs divided by succeeded plus failed crawl jobs completed during the selected interval. Queued and running jobs are excluded.",
    source: "website_crawl_jobs.status; completed_at",
    timeField: "Job completion time",
    orgScope: "Crawl jobs in the active organization",
  },
  jobs_queued: {
    label: "Queued jobs",
    definition:
      "Crawler and PageSpeed jobs created in the last 24 hours whose current status is Queued.",
    source: "website_crawl_jobs.status; pagespeed_scan_jobs.status; created_at",
    timeField: "Job creation time, last 24 hours",
    orgScope: "Jobs in the active organization",
  },
  jobs_running: {
    label: "Running jobs",
    definition:
      "Crawler and PageSpeed jobs created in the last 24 hours whose current status is Running.",
    source: "website_crawl_jobs.status; pagespeed_scan_jobs.status; created_at",
    timeField: "Job creation time, last 24 hours",
    orgScope: "Jobs in the active organization",
  },
  jobs_failed: {
    label: "Failed jobs in the last 24 hours",
    definition:
      "Crawler and PageSpeed jobs created in the last 24 hours whose current status is Failed.",
    source: "website_crawl_jobs.status; pagespeed_scan_jobs.status; created_at",
    timeField: "Job creation time, last 24 hours",
    orgScope: "Jobs in the active organization",
  },
  failed_jobs_badge: {
    label: "Failed jobs needing attention",
    definition:
      "Failed jobs among the newest 100 crawler jobs plus the newest 100 PageSpeed jobs. This intentionally matches the current Jobs sidebar badge.",
    source: "website_crawl_jobs.status; pagespeed_scan_jobs.status; created_at",
    timeField: "Newest 100 jobs per queue",
    orgScope: "Jobs in the active organization",
  },
  failed_campaign_sends: {
    label: "Failed campaign sends",
    definition:
      "Campaign-recipient records whose current status is Failed.",
    source: "email_campaign_recipients.status",
    timeField: "Current state; no time filter",
    orgScope: "Campaign recipients in the active organization",
  },
  paused_campaigns: {
    label: "Paused campaigns",
    definition: "Email campaigns whose current status is Paused.",
    source: "email_campaigns.status",
    timeField: "Current state; no time filter",
    orgScope: "Campaigns in the active organization",
  },
  crawled_websites_not_added: {
    label: "Crawled websites not added to leads",
    definition:
      "Crawled non-listing websites whose current registry status is not Lead.",
    source: "websites.crawl_id; websites.status; websites.page_type",
    timeField: "Current state; no time filter",
    orgScope: "Websites in the active organization",
  },
  gmail_connection: {
    label: "Gmail setup",
    definition:
      "One setup action is shown when the signed-in user has no Gmail account assigned in this organization.",
    source: "user_gmail_assignments.user_id; gmail_account_id",
    timeField: "Current assignment state",
    orgScope: "The signed-in user and active organization",
  },
  tavily_credits: {
    label: "Tavily credits used",
    definition:
      "Current key usage from Tavily. The low-credit alert appears when a limited key has used at least 80% of its reported credit limit.",
    source: "Tavily usage response: key.usage; key.limit",
    timeField: "Current provider usage snapshot",
    orgScope: "The signed-in user's configured Tavily key",
  },
  leads_without_contact_details: {
    label: "Leads without contact details",
    definition:
      "Companies with at least one contact, but no contact with a nonblank business email or phone.",
    source: "contacts.business_email; contacts.business_phone",
    timeField: "Current state; no time filter",
    orgScope: "Companies and contacts in the active organization",
  },
  recent_leads: {
    label: "Recent leads",
    definition:
      "The five newest companies that currently have at least one contact. Search keyword is shown only when linked through a Website record.",
    source: "companies.created_at; contacts.company_id; website_search_keywords",
    timeField: "Company creation time",
    orgScope: "All joined records in the active organization",
  },
  trend_websites: {
    label: "Websites discovered per day",
    definition:
      "Website records created on each local calendar day in the selected interval.",
    source: "websites.created_at",
    timeField: "Website creation time, grouped in the selected timezone",
    orgScope: "Websites in the active organization",
  },
  trend_leads: {
    label: "Leads created per day",
    definition:
      "Companies created on each local calendar day in the selected interval that currently have at least one contact.",
    source: "companies.created_at; contacts.company_id",
    timeField: "Company creation time, grouped in the selected timezone",
    orgScope: "Companies and contacts in the active organization",
  },
} as const;

export type OverviewMetricKey = keyof typeof metrics;
