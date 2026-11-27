export const metrics = {
  websites_discovered: {
    label: "Websites discovered",
    definition:
      "Websites whose registry record was created during the selected interval. The comparison uses the immediately preceding interval of equal duration.",
    source: "websites.created_at",
    timeField: "Website creation time",
    orgScope: "The active organization",
  },
  websites_created: {
    label: "Websites created",
    definition:
      "Website records created during the selected interval. The comparison uses the immediately preceding interval of equal duration.",
    source: "websites.created_at",
    timeField: "Website creation time",
    orgScope: "Websites in the active organization",
  },
  reachable_websites: {
    label: "Websites with contact details",
    definition:
      "Websites created during the selected interval with at least one contact that has a nonblank business email or phone. The card shows the count out of websites created in that interval.",
    source: "websites.created_at; contacts.website_id; contact details",
    timeField: "Website creation time",
    orgScope: "Websites and contacts in the active organization",
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
    label: "Indexed websites",
    definition:
      "Discovered websites with a linked successful indexing record.",
    source: "websites.crawl_id",
    timeField: "Website creation time defines the cohort",
    orgScope: "Websites and indexing jobs in the active organization",
  },
  funnel_added: {
    label: "Qualified websites",
    definition:
      "Discovered websites whose registry status is qualified or later in the workflow.",
    source: "websites.status",
    timeField: "Website creation time defines the cohort",
    orgScope: "Websites in the active organization",
  },
  funnel_has_contact: {
    label: "Websites with a contact",
    definition:
      "Qualified websites in the cohort that have at least one saved contact.",
    source: "websites.id; contacts.website_id",
    timeField: "Website creation time defines the cohort",
    orgScope: "Websites and contacts in the active organization",
  },
  funnel_emailed: {
    label: "Websites emailed",
    definition:
      "Websites in the cohort with at least one successful campaign recipient, regardless of when that send occurred.",
    source: "email_campaign_recipients.website_id; status",
    timeField: "Current state; successful send can be from any date",
    orgScope: "Websites, contacts, and recipients in the active organization",
  },
  pipeline_status: {
    label: "Website status",
    definition:
      "Current count and share of websites, grouped by their stored workflow status.",
    source: "websites.status",
    timeField: "Current state; no time filter",
    orgScope: "Websites in the active organization",
  },
  with_email: {
    label: "Websites with email",
    definition:
      "Websites with at least one contact whose business email is nonblank, shown out of all current websites.",
    source: "contacts.website_id; contacts.business_email",
    timeField: "Current state; no time filter",
    orgScope: "Websites and contacts in the active organization",
  },
  with_phone: {
    label: "Websites with phone",
    definition:
      "Websites with at least one contact whose business phone is nonblank, shown out of all current websites.",
    source: "contacts.website_id; contacts.business_phone",
    timeField: "Current state; no time filter",
    orgScope: "Websites and contacts in the active organization",
  },
  with_website: {
    label: "Websites with a URL",
    definition:
      "Websites with a nonblank URL or domain, shown out of all current websites.",
    source: "websites.website_url; websites.domain",
    timeField: "Current state; no time filter",
    orgScope: "Websites in the active organization",
  },
  with_industry: {
    label: "Websites with industry",
    definition:
      "Websites with a nonblank industry value, shown out of all current websites.",
    source: "websites.industry",
    timeField: "Current state; no time filter",
    orgScope: "Websites in the active organization",
  },
  crawl_success: {
    label: "Indexing success rate",
    definition:
      "Succeeded indexing jobs divided by succeeded plus failed indexing jobs completed during the selected interval. Queued and running jobs are excluded.",
    source: "website_crawl_jobs.status; completed_at",
    timeField: "Job completion time",
    orgScope: "Indexing jobs in the active organization",
  },
  jobs_queued: {
    label: "Queued jobs",
    definition:
      "Website indexing and PageSpeed jobs created in the last 24 hours whose current status is Queued.",
    source: "website_crawl_jobs.status; pagespeed_scan_jobs.status; created_at",
    timeField: "Job creation time, last 24 hours",
    orgScope: "Jobs in the active organization",
  },
  jobs_running: {
    label: "Running jobs",
    definition:
      "Website indexing and PageSpeed jobs created in the last 24 hours whose current status is Running.",
    source: "website_crawl_jobs.status; pagespeed_scan_jobs.status; created_at",
    timeField: "Job creation time, last 24 hours",
    orgScope: "Jobs in the active organization",
  },
  jobs_failed: {
    label: "Failed jobs in the last 24 hours",
    definition:
      "Website indexing and PageSpeed jobs created in the last 24 hours whose current status is Failed.",
    source: "website_crawl_jobs.status; pagespeed_scan_jobs.status; created_at",
    timeField: "Job creation time, last 24 hours",
    orgScope: "Jobs in the active organization",
  },
  failed_jobs_badge: {
    label: "Failed jobs needing attention",
    definition:
      "Failed jobs among the newest 100 website indexing jobs plus the newest 100 PageSpeed jobs. This intentionally matches the current Jobs sidebar badge.",
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
    label: "Indexed websites needing qualification",
    definition:
      "Indexed non-listing websites whose current registry status is not qualified.",
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
  websites_without_contact_details: {
    label: "Websites without contact details",
    definition:
      "Websites with at least one contact, but no contact with a nonblank business email or phone.",
    source: "contacts.website_id; contacts.business_email; contacts.business_phone",
    timeField: "Current state; no time filter",
    orgScope: "Websites and contacts in the active organization",
  },
  recent_websites: {
    label: "Recent websites",
    definition:
      "The five newest websites that currently have at least one contact. Search keyword is shown when a Website is linked to a search.",
    source: "websites.created_at; contacts.website_id; website_search_keywords",
    timeField: "Website creation time",
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
  trend_websites_created: {
    label: "Websites created per day",
    definition:
      "Website records created on each local calendar day in the selected interval.",
    source: "websites.created_at",
    timeField: "Website creation time, grouped in the selected timezone",
    orgScope: "Websites in the active organization",
  },
  team_websites: {
    label: "Websites discovered by user",
    definition:
      "Website registry records created by the user during the selected period.",
    source: "websites.created_by_user_id; websites.created_at",
    timeField: "Website creation time",
    orgScope: "Users and websites in the active organization",
  },
  team_websites_created: {
    label: "Websites created by user",
    definition:
      "Website records created by the user during the selected period.",
    source: "websites.created_by_user_id; websites.created_at",
    timeField: "Website creation time",
    orgScope: "Users and websites in the active organization",
  },
  team_crawls: {
    label: "Indexing jobs completed by user",
    definition:
      "Successful website indexing jobs created by the user and completed during the selected period.",
    source:
      "website_crawl_jobs.created_by_user_id; website_crawl_jobs.status; completed_at",
    timeField: "Job completion time",
    orgScope: "Users and indexing jobs in the active organization",
  },
  team_emails: {
    label: "Emails sent by user",
    definition:
      "Campaign-recipient records marked sent during the selected period for campaigns created by the user.",
    source:
      "email_campaigns.created_by; email_campaign_recipients.status; sent_at",
    timeField: "Successful campaign send time",
    orgScope: "Users, campaigns, and recipients in the active organization",
  },
} as const;

export type OverviewMetricKey = keyof typeof metrics;
