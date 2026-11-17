import type { ReactNode } from "react";

type JsonRecord = Record<string, unknown>;

export function WebsiteHypeStatProfileView({
  payload,
}: {
  payload: Record<string, unknown>;
}) {
  const entry = asRecord(payload.entry) ?? payload;
  const data = asRecord(entry.data) ?? {};
  const domain = asRecord(data.domain) ?? {};
  const site = asRecord(data.site) ?? {};
  const rank = asRecord(data.rank) ?? {};
  const countryRank = asRecord(rank.country) ?? {};
  const traffic = asRecord(data.traffic) ?? {};
  const trafficSources = asRecord(traffic.sources) ?? {};
  const devices = asRecord(traffic.devices) ?? {};
  const trafficChanges = asRecord(traffic.change_vs_previous_month) ?? {};
  const semrush = asRecord(data.semrush) ?? {};
  const backlinks = asRecord(data.backlinks) ?? {};
  const moz = asRecord(data.moz) ?? {};
  const searchIndexes = asRecord(data.search_indexes) ?? {};
  const earnings = asRecord(data.earnings) ?? {};
  const hosting = asRecord(data.hosting) ?? {};
  const location = asRecord(hosting.location) ?? {};
  const server = asRecord(data.server) ?? {};
  const performance = asRecord(data.performance) ?? {};
  const security = asRecord(data.security) ?? {};
  const reputation = asRecord(security.reputation) ?? {};
  const ssl = asRecord(security.ssl) ?? {};
  const headers = asRecord(security.headers) ?? {};
  const email = asRecord(data.email) ?? {};
  const aiCrawlers = asRecord(data.ai_crawlers) ?? {};
  const adsTxt = asRecord(data.ads_txt) ?? {};
  const adExperience = asRecord(data.ad_experience) ?? {};
  const archive = asRecord(data.archive) ?? {};
  const ownerSettings = asRecord(data.owner_settings) ?? {};
  const meta = asRecord(payload.meta) ?? {};
  const technologies = asRecords(data.technologies);
  const dnsRecords = asRecords(data.dns);
  const backlinkCountries = asRecords(backlinks.by_country);
  const backlinkTlds = asRecords(backlinks.by_tld);
  const similarSites = asStrings(data.similar_sites);
  const tags = asStrings(site.tags);
  const domainName = text(domain.name) ?? text(entry.domain) ?? "Website";
  const title = text(site.title);
  const profileUrl = safeHttpUrl(domain.profile_url);
  const screenshotUrl = safeHttpUrl(site.screenshot);

  return (
    <div className="hypestat-profile">
      <header className="hypestat-intro">
        <div>
          <p className="hypestat-eyebrow">WEBSITE SNAPSHOT</p>
          <h3>{title || domainName}</h3>
          {title && <p className="hypestat-domain">{domainName}</p>}
          {text(site.description) && <p>{text(site.description)}</p>}
          {text(site.about) && (
            <details className="hypestat-about">
              <summary>More about this website</summary>
              <p>{text(site.about)}</p>
            </details>
          )}
          {screenshotUrl && (
            <p>
              <a href={screenshotUrl} rel="noreferrer" target="_blank">
                View website screenshot ↗
              </a>
            </p>
          )}
          {tags.length > 0 && (
            <div className="hypestat-chip-list" aria-label="Website topics">
              {tags.map((tag) => (
                <span className="hypestat-chip" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="hypestat-source-meta">
          {profileUrl && (
            <a href={profileUrl} rel="noreferrer" target="_blank">
              View HypeStat profile ↗
            </a>
          )}
          <span>
            Profile updated {formatDate(domain.updated) || "Not reported"}
          </span>
          <span>
            Data source: {humanize(text(traffic.data_source) ?? "unknown")}
          </span>
          {number(meta.requests_left_today) !== null && (
            <span>
              HypeStat requests left today:{" "}
              {formatNumber(meta.requests_left_today)}
            </span>
          )}
        </div>
      </header>

      <ProfileSection title="At a glance">
        <MetricGrid>
          <Metric label="HypeStat global rank" value={formatNumber(rank.hypestat)} />
          <Metric
            label="Estimated monthly visits"
            value={formatNumber(traffic.visits_monthly)}
          />
          <Metric
            label="Estimated daily visits"
            value={formatNumber(traffic.visits_daily)}
          />
          <Metric
            label="Daily page views"
            value={formatNumber(traffic.pageviews_daily)}
          />
          <Metric
            label="Backlinks"
            value={formatNumber(backlinks.total)}
          />
          <Metric
            label="Referring domains"
            value={formatNumber(backlinks.referring_domains)}
          />
        </MetricGrid>
        <InfoGrid
          items={[
            { label: "HypeStat category", value: text(site.category) },
            { label: "HypeStat subcategory", value: text(site.subcategory) },
            { label: "Adult content", value: formatBoolean(domain.adult) },
            {
              label: "Country rank",
              value: formatNumber(countryRank.rank),
            },
            {
              label: "Global rank",
              value: formatNumber(asRecord(data.rank)?.global),
            },
            {
              label: "Category rank",
              value: formatNumber(asRecord(data.rank)?.category),
            },
          ]}
        />
      </ProfileSection>

      <ProfileSection title="Audience and traffic">
        <MetricGrid>
          <Metric
            label="Pages per visit"
            value={formatDecimal(traffic.pages_per_visit)}
          />
          <Metric
            label="Average visit duration"
            value={formatDuration(traffic.visit_duration_seconds)}
          />
          <Metric
            label="Bounce rate"
            value={formatPercent(traffic.bounce_rate)}
          />
          <Metric
            label="Country"
            value={text(countryRank.country) ?? "Not reported"}
            detail={
              [
                number(countryRank.rank) !== null
                  ? `Rank ${formatNumber(countryRank.rank)}`
                  : null,
                text(countryRank.country_code),
              ]
                .filter((part): part is string => part !== null)
                .join(" · ") || undefined
            }
          />
        </MetricGrid>
        <div className="hypestat-columns">
          <BreakdownList
            title="Traffic sources"
            values={trafficSources}
            percent
          />
          <BreakdownList title="Devices" values={devices} percent />
        </div>
        <InfoGrid
          items={[
            {
              label: "Monthly visit change",
              value: formatPercent(trafficChanges.visits),
            },
            {
              label: "Monthly user change",
              value: formatPercent(trafficChanges.users),
            },
            {
              label: "Visit duration change",
              value: formatPercent(trafficChanges.visit_duration),
            },
            {
              label: "Pages per visit change",
              value: formatPercent(trafficChanges.pages_per_visit),
            },
            {
              label: "Bounce rate change",
              value: formatPercent(trafficChanges.bounce_rate),
            },
          ]}
        />
        <div className="hypestat-columns">
          <FlexibleRecordsTable title="Traffic history" value={traffic.history} />
          <FlexibleRecordsTable
            title="Audience countries"
            value={traffic.countries}
          />
          <FlexibleRecordsTable
            title="Incoming referrers"
            value={asRecord(traffic.referrers)?.incoming}
          />
          <FlexibleRecordsTable
            title="Outgoing referrers"
            value={asRecord(traffic.referrers)?.outgoing}
          />
          <FlexibleRecordsTable
            title="AI referrals"
            value={traffic.ai_referrals}
          />
        </div>
      </ProfileSection>

      <ProfileSection title="Search visibility and links">
        <MetricGrid>
          <Metric label="SEMrush rank" value={formatNumber(semrush.rank)} />
          <Metric
            label="Organic keywords"
            value={formatNumber(semrush.organic_keywords)}
          />
          <Metric
            label="Estimated organic traffic"
            value={formatNumber(semrush.organic_traffic)}
          />
          <Metric
            label="Estimated organic traffic value"
            value={formatCurrency(semrush.organic_cost_usd)}
          />
          <Metric
            label="Google indexed pages"
            value={formatNumber(searchIndexes.google)}
          />
          <Metric
            label="Baidu indexed pages"
            value={formatNumber(searchIndexes.baidu)}
          />
          <Metric
            label="Domain authority"
            value={formatNumber(moz.domain_authority)}
            detail={`Page authority ${formatNumber(moz.page_authority)}`}
          />
          <Metric label="Moz rank" value={formatNumber(moz.moz_rank)} />
          <Metric
            label="Follow backlinks"
            value={formatNumber(backlinks.follow)}
          />
          <Metric
            label="Nofollow backlinks"
            value={formatNumber(backlinks.nofollow)}
          />
          <Metric
            label="Referring IP addresses"
            value={formatNumber(backlinks.referring_ips)}
          />
          <Metric
            label="Backlink authority score"
            value={formatNumber(backlinks.authority_score)}
          />
        </MetricGrid>
        <div className="hypestat-columns">
          <DataTable
            title="Referring domains by country"
            columns={["Country", "Domains"]}
            rows={backlinkCountries.map((row) => [
              text(row.country) ?? "Unknown",
              formatNumber(row.domains),
            ])}
          />
          <DataTable
            title="Referring domains by top-level domain"
            columns={["Domain ending", "Domains"]}
            rows={backlinkTlds.map((row) => [
              text(row.tld) ?? "Unknown",
              formatNumber(row.domains),
            ])}
          />
        </div>
      </ProfileSection>

      <ProfileSection title="Technology used">
        {technologies.length ? (
          <div className="hypestat-technology-list">
            {technologies.map((technology, index) => {
              const categories = asStrings(technology.categories);
              const name = text(technology.name) ?? `Technology ${index + 1}`;
              return (
                <article className="hypestat-technology" key={`${name}-${index}`}>
                  <strong>{name}</strong>
                  <span>
                    {categories.length
                      ? categories.map(humanize).join(" · ")
                      : "Category not reported"}
                  </span>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="hypestat-muted">No technologies were reported.</p>
        )}
      </ProfileSection>

      <ProfileSection title="Estimated earnings and advertising">
        <MetricGrid>
          <Metric
            label="Estimated daily ad revenue"
            value={formatCurrency(earnings.ad_revenue_daily_usd)}
          />
          <Metric
            label="Estimated website value"
            value={formatCurrency(earnings.website_worth_usd)}
          />
        </MetricGrid>
        <InfoGrid
          items={[
            { label: "ads.txt entries", value: formatNumber(adsTxt.lines) },
            {
              label: "Direct ads.txt entries",
              value: formatNumber(adsTxt.direct_lines),
            },
            {
              label: "Ad experience (desktop)",
              value: humanize(text(adExperience.desktop) ?? "not reported"),
            },
            {
              label: "Ad experience (mobile)",
              value: humanize(text(adExperience.mobile) ?? "not reported"),
            },
            {
              label: "Abusive ads detected",
              value: formatBoolean(adExperience.abusive),
            },
          ]}
        />
        <StringList
          title="Advertising networks"
          values={asStrings(adsTxt.networks)}
        />
      </ProfileSection>

      <ProfileSection title="Hosting and performance">
        <InfoGrid
          items={[
            { label: "Hosting provider", value: text(hosting.provider) },
            { label: "Provider website", value: text(hosting.provider_website) },
            { label: "IP address", value: text(hosting.ip) },
            { label: "IPv6 address", value: text(hosting.ipv6) },
            { label: "Autonomous system", value: text(hosting.asn) },
            { label: "CDN detected", value: formatBoolean(hosting.cdn) },
            {
              label: "Behind a CDN",
              value: formatBoolean(hosting.hosted_behind_cdn),
            },
            { label: "Location", value: locationLabel(location) },
            {
              label: "Coordinates",
              value:
                number(location.latitude) !== null &&
                number(location.longitude) !== null
                  ? `${formatDecimal(location.latitude)}, ${formatDecimal(location.longitude)}`
                  : null,
            },
            { label: "PageSpeed score (desktop)", value: formatNumber(performance.pagespeed_desktop) },
            { label: "PageSpeed score (mobile)", value: formatNumber(performance.pagespeed_mobile) },
            { label: "HTTP/2 supported", value: formatBoolean(server.http2) },
            { label: "HTTP/3 supported", value: formatBoolean(server.http3) },
            { label: "Compression", value: text(server.compression) },
            {
              label: "Page size",
              value: formatBytes(server.page_size_bytes),
            },
            {
              label: "Compressed page size",
              value: formatBytes(server.page_size_compressed_bytes),
            },
          ]}
        />
      </ProfileSection>

      <ProfileSection title="Security and trust">
        <MetricGrid>
          <Metric
            label="Reputation"
            value={text(reputation.status) ?? "Not reported"}
            detail={
              number(reputation.safety) !== null
                ? `Safety score ${formatNumber(reputation.safety)} / 100`
                : undefined
            }
          />
          <Metric
            label="Safe Browsing"
            value={humanize(text(security.safe_browsing) ?? "not reported")}
          />
          <Metric
            label="Security headers grade"
            value={text(headers.grade) ?? "Not reported"}
          />
          <Metric
            label="SSL certificate"
            value={
              typeof ssl.valid === "boolean"
                ? ssl.valid
                  ? "Valid"
                  : "Invalid"
                : "Not reported"
            }
            detail={
              text(ssl.issuer)
                ? `Issued by ${text(ssl.issuer)}`
                : undefined
            }
          />
          <Metric
            label="SSL expiry"
            value={formatDate(ssl.expires) ?? "Not reported"}
            detail={
              number(ssl.days_left) !== null
                ? `${formatNumber(ssl.days_left)} days remaining`
                : undefined
            }
          />
          <Metric
            label="Safety confidence"
            value={formatPercent(reputation.safety_confidence)}
          />
        </MetricGrid>
        <div className="hypestat-columns">
          <StringList title="Security headers present" values={asStrings(headers.present)} />
          <StringList title="Security headers missing" values={asStrings(headers.missing)} />
        </div>
      </ProfileSection>

      <ProfileSection title="Email and domain setup">
        <InfoGrid
          items={[
            { label: "SPF configured", value: formatBoolean(email.spf) },
            { label: "DKIM configured", value: formatBoolean(email.dkim) },
            { label: "DMARC policy", value: text(email.dmarc_policy) },
            { label: "Email provider", value: text(email.mx_provider) },
            { label: "DNSSEC enabled", value: formatBoolean(email.dnssec) },
            { label: "SPF record", value: text(email.spf_record) },
            { label: "Domain created", value: formatDate(asRecord(data.whois)?.created) },
            { label: "Domain expires", value: formatDate(asRecord(data.whois)?.expires) },
            { label: "Registrar", value: text(asRecord(data.whois)?.registrar) },
            { label: "Last WHOIS update", value: formatDate(asRecord(data.whois)?.updated) },
          ]}
        />
        <DataTable
          title={`DNS records (${dnsRecords.length})`}
          columns={["Type", "Host", "Value", "TTL", "Priority"]}
          rows={dnsRecords.map((record) => [
            text(record.type) ?? "—",
            text(record.host) ?? "—",
            text(record.value) ?? "—",
            formatNumber(record.ttl),
            formatNumber(record.priority),
          ])}
        />
        {text(asRecord(data.whois)?.raw) && (
          <details className="hypestat-raw-details">
            <summary>Original WHOIS record</summary>
            <pre>{text(asRecord(data.whois)?.raw)}</pre>
          </details>
        )}
      </ProfileSection>

      <ProfileSection title="Advertising and AI indexing bots">
        <InfoGrid
          items={[
            {
              label: "AI bots checked",
              value: formatNumber(aiCrawlers.crawlers_checked),
            },
            {
              label: "Blocks all AI bots",
              value: formatBoolean(aiCrawlers.blocks_all),
            },
            {
              label: "llms.txt found",
              value: formatBoolean(aiCrawlers.llms_txt),
            },
            {
              label: "Owner hides WHOIS",
              value: formatBoolean(ownerSettings.whois_hidden),
            },
            {
              label: "Owner hides estimates",
              value: formatBoolean(ownerSettings.estimates_hidden),
            },
            {
              label: "Similar websites",
              value: similarSites.length
                ? similarSites.map(humanize).join(", ")
                : "None reported",
            },
            {
              label: "First Wayback capture",
              value: formatDate(archive.wayback_first_capture),
            },
          ]}
        />
        <div className="hypestat-columns">
          <StringList
            title="AI bots blocked"
            values={Object.keys(asRecord(aiCrawlers.blocked) ?? {})}
          />
          <StringList
            title="AI bots partially blocked"
            values={Object.keys(asRecord(aiCrawlers.partially_blocked) ?? {})}
          />
        </div>
      </ProfileSection>

      <details className="hypestat-raw-details">
        <summary>View complete original HypeStat response</summary>
        <pre>{JSON.stringify(payload, null, 2)}</pre>
      </details>
    </div>
  );
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="hypestat-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="hypestat-metric-grid">{children}</div>;
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="hypestat-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function InfoGrid({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="hypestat-info-grid">
      {items.map(({ label, value }) => (
        <div className="hypestat-info-item" key={label}>
          <dt>{label}</dt>
          <dd>{value ?? "Not reported"}</dd>
        </div>
      ))}
    </dl>
  );
}

function BreakdownList({
  title,
  values,
  percent = false,
}: {
  title: string;
  values: JsonRecord;
  percent?: boolean;
}) {
  const entries = Object.entries(values);
  return (
    <div className="hypestat-breakdown">
      <h5>{title}</h5>
      {entries.length ? (
        entries.map(([label, value]) => (
          <div className="hypestat-breakdown-row" key={label}>
            <span>{humanize(label)}</span>
            <strong>{percent ? formatPercent(value) : formatNumber(value)}</strong>
          </div>
        ))
      ) : (
        <p className="hypestat-muted">No data reported.</p>
      )}
    </div>
  );
}

function StringList({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="hypestat-breakdown">
      <h5>{title}</h5>
      {values.length ? (
        <ul className="hypestat-string-list">
          {values.map((value) => (
            <li key={value}>{humanize(value)}</li>
          ))}
        </ul>
      ) : (
        <p className="hypestat-muted">No data reported.</p>
      )}
    </div>
  );
}

function DataTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <div className="hypestat-table-wrap">
      <h5>{title}</h5>
      {rows.length ? (
        <div className="hypestat-table-scroll">
          <table className="hypestat-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${index}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="hypestat-muted">No data reported.</p>
      )}
    </div>
  );
}

function FlexibleRecordsTable({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  const records = asRecords(value);
  const columns = [...new Set(records.flatMap((record) => Object.keys(record)))];
  if (!records.length) {
    return (
      <div className="hypestat-breakdown">
        <h5>{title}</h5>
        <p className="hypestat-muted">No data reported.</p>
      </div>
    );
  }
  return (
    <DataTable
      title={title}
      columns={columns.map(humanize)}
      rows={records.map((record) =>
        columns.map((column) => formatCell(record[column])),
      )}
    />
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "Not reported";
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "boolean") return formatBoolean(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(formatCell).join(", ");
  }
  const record = asRecord(value);
  return record
    ? Object.entries(record)
        .map(([key, item]) => `${humanize(key)}: ${formatCell(item)}`)
        .join(" · ")
    : "Not reported";
}

function locationLabel(location: JsonRecord) {
  return [
    text(location.city),
    text(location.region),
    text(location.country),
  ]
    .filter((part): part is string => part !== null)
    .join(", ") || null;
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => asRecord(item) !== null)
    : [];
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function safeHttpUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatNumber(value: unknown): string {
  const parsed = number(value);
  return parsed === null
    ? "Not reported"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(parsed);
}

function formatDecimal(value: unknown): string {
  const parsed = number(value);
  return parsed === null
    ? "Not reported"
    : new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }).format(parsed);
}

function formatPercent(value: unknown): string {
  const parsed = number(value);
  return parsed === null ? "Not reported" : `${formatDecimal(parsed)}%`;
}

function formatCurrency(value: unknown): string {
  const parsed = number(value);
  return parsed === null
    ? "Not reported"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(parsed);
}

function formatDuration(value: unknown): string {
  const seconds = number(value);
  if (seconds === null) return "Not reported";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return minutes
    ? `${minutes} min ${remainingSeconds} sec`
    : `${remainingSeconds} sec`;
}

function formatBytes(value: unknown): string {
  let bytes = number(value);
  if (bytes === null) return "Not reported";
  const units = ["bytes", "KB", "MB", "GB"];
  let unitIndex = 0;
  while (bytes >= 1024 && unitIndex < units.length - 1) {
    bytes /= 1024;
    unitIndex += 1;
  }
  return `${formatDecimal(bytes)} ${units[unitIndex]}`;
}

function formatBoolean(value: unknown): string {
  return typeof value === "boolean"
    ? value
      ? "Yes"
      : "No"
    : "Not reported";
}

function formatDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? raw
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
