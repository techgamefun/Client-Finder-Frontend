"use client";

import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Compass,
  Gauge,
  Globe,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { ApiError, getAuthSession } from "@/lib/api";
import { PUBLIC_PAGE_LINKS } from "@/lib/site";
import { BrandMark } from "./components/brand-mark";
import { PublicThemeToggle } from "./components/public-theme-toggle";

type ProductScreen =
  | "website-registry"
  | "website-detail"
  | "website-analytics"
  | "organization-dashboard";

const productScreens: Record<
  ProductScreen,
  { title: string; width: number; height: number }
> = {
  "website-registry": {
    title: "Website registry",
    width: 3000,
    height: 1500,
  },
  "website-detail": {
    title: "Website research profile",
    width: 1920,
    height: 2500,
  },
  "website-analytics": {
    title: "Website analytics",
    width: 1920,
    height: 1380,
  },
  "organization-dashboard": {
    title: "Organization dashboard",
    width: 1920,
    height: 1500,
  },
};

function ProductScreenshot({
  screen,
  alt,
  priority = false,
}: {
  screen: ProductScreen;
  alt: string;
  priority?: boolean;
}) {
  const image = productScreens[screen];
  const loadingProps = priority ? { priority: true as const } : {};

  return (
    <figure className={`public-home-screenshot is-${screen}`}>
      <div aria-hidden="true" className="public-home-screenshot-chrome">
        <span className="public-home-window-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="public-home-window-title">{image.title}</span>
        <span className="public-home-window-label">
          <span />
          PRODUCT PREVIEW
        </span>
      </div>
      <div className="public-home-screenshot-viewport">
        <Image
          alt={alt}
          className="public-home-screenshot-image is-light"
          height={image.height}
          loading={priority ? "eager" : "lazy"}
          sizes="(max-width: 760px) 100vw, 58vw"
          src={`/product-tour/${screen}-light.jpg`}
          width={image.width}
          {...loadingProps}
        />
        <Image
          alt=""
          aria-hidden="true"
          className="public-home-screenshot-image is-dark"
          height={image.height}
          loading={priority ? "eager" : "lazy"}
          sizes="(max-width: 760px) 100vw, 58vw"
          src={`/product-tour/${screen}-dark.jpg`}
          width={image.width}
          {...loadingProps}
        />
      </div>
    </figure>
  );
}

function FeatureList({
  items,
}: {
  items: string[];
}) {
  return (
    <ul className="public-home-feature-list">
      {items.map((item) => (
        <li key={item}>
          <CheckCircle2 aria-hidden="true" size={16} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function DataSourceCard({
  icon: Icon,
  title,
  description,
  note,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  note: string;
}) {
  return (
    <article className="public-home-data-card">
      <span className="public-home-data-icon">
        <Icon aria-hidden="true" size={18} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      <small>{note}</small>
    </article>
  );
}

export default function Home() {
  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession,
    retry: false,
  });
  const hasSession =
    sessionQuery.data !== undefined &&
    !(
      sessionQuery.error instanceof ApiError &&
      sessionQuery.error.status === 401
    );
  const showPublicActions = !sessionQuery.isLoading && !hasSession;
  const workspaceHref =
    sessionQuery.data?.user.role === "admin"
      ? "/organization/dashboard"
      : "/overview";

  return (
    <div className="overview-redesign public-home">
      <header className="public-home-header">
        <div className="public-home-header-inner">
          <Link
            aria-label="ProspectLoop home"
            className="public-home-brand"
            href="/"
          >
            <BrandMark />
            <span>ProspectLoop</span>
          </Link>

          <nav aria-label="Page sections" className="public-home-nav">
            <Link href="#product-tour">Product tour</Link>
            <Link href="#how-it-works">How it works</Link>
            <Link href="#data-sources">Data sources</Link>
          </nav>

          <div className="public-home-header-actions">
            <PublicThemeToggle />
            {hasSession ? (
              <Link className="button button-primary" href={workspaceHref}>
                Open workspace <ArrowRight aria-hidden="true" size={16} />
              </Link>
            ) : showPublicActions ? (
              <div className="public-home-auth">
                <Link className="public-home-login" href="/login">
                  Sign in
                </Link>
                <Link className="button button-primary" href="/signup">
                  Get started <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </div>
            ) : (
              <span
                aria-hidden="true"
                className="public-home-auth-placeholder"
              />
            )}
          </div>
        </div>
      </header>

      <main className="public-home-main">
        <section
          aria-labelledby="public-home-title"
          className="public-home-hero"
        >
          <div className="public-home-hero-copy">
            <p className="public-home-hero-eyebrow">
              <Sparkles aria-hidden="true" size={14} />
              <span>WEBSITE RESEARCH FOR OUTREACH</span>
            </p>
            <h1 id="public-home-title">
              Know the website{" "}
              <span>before you reach out.</span>
            </h1>
            <p className="public-home-hero-description">
              Find relevant websites, understand what they reveal, and
              organize the strongest fits for thoughtful outreach—all in one
              research workspace.
            </p>
            <div className="public-home-hero-actions">
              {hasSession ? (
                <Link className="button button-primary" href={workspaceHref}>
                  Go to your workspace
                  <ArrowRight aria-hidden="true" size={16} />
                </Link>
              ) : showPublicActions ? (
                <>
                  <Link className="button button-primary" href="/signup">
                    Create your workspace
                    <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                  <Link className="public-home-text-link" href="#product-tour">
                    Explore the product
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </>
              ) : null}
            </div>
            <div aria-label="Workflow summary" className="public-home-proof">
              <span>
                <Compass aria-hidden="true" size={15} />
                Discover
              </span>
              <i aria-hidden="true" />
              <span>
                <Globe aria-hidden="true" size={15} />
                Research
              </span>
              <i aria-hidden="true" />
              <span>
                <Building2 aria-hidden="true" size={15} />
                Organize
              </span>
            </div>
          </div>
          <div className="public-home-hero-visual">
            <div aria-hidden="true" className="public-home-hero-orbit" />
            <ProductScreenshot
              alt="Organization dashboard showing website workflow, research coverage and team activity."
              priority
              screen="organization-dashboard"
            />
            <div className="public-home-hero-note">
              <span className="public-home-hero-note-icon">
                <BarChart3 aria-hidden="true" size={17} />
              </span>
              <span>
                <strong>See the whole pipeline</strong>
                <small>From discovered website to outreach</small>
              </span>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="public-home-tour-title"
          className="public-home-tour"
          id="product-tour"
        >
          <div className="public-home-section-intro">
            <p className="overview-eyebrow">A WORKFLOW, NOT ANOTHER SPREADSHEET</p>
            <h2 id="public-home-tour-title">
              Every website gets a clearer next step.
            </h2>
            <p>
              Move from a promising domain to a researched, organized website.
              Each view answers a different question—and keeps the evidence
              close to the decision.
            </p>
          </div>

          <article className="public-home-showcase">
            <div className="public-home-showcase-copy">
              <p className="public-home-step-label">
                <span>01</span> FIND YOUR CANDIDATES
              </p>
              <h3>Start with a market. Build a shortlist.</h3>
              <p>
                Search discovered websites in one registry instead of
                bouncing between tabs. Narrow the list by what you know, then
                inspect the candidates that match your target.
              </p>
              <FeatureList
                items={[
                  "Filter and sort websites by type, topic, status and available metrics.",
                  "See crawl, Ahrefs DR, HypeStat and PageSpeed data alongside each domain.",
                  "Select promising websites and add them to a named website group.",
                ]}
              />
              <p className="public-home-usage-tip">
                <Search aria-hidden="true" size={15} />
                <span>
                  <strong>Try this:</strong> filter to your target website type,
                  review the available signals, then save a focused shortlist.
                </span>
              </p>
            </div>
            <ProductScreenshot
              alt="Website registry with discovered domains, classifications and enrichment columns."
              screen="website-registry"
            />
          </article>

          <article className="public-home-showcase is-reversed">
            <div className="public-home-showcase-copy">
              <p className="public-home-step-label">
                <span>02</span> UNDERSTAND THE BUSINESS
              </p>
              <h3>Open a domain. See the evidence behind it.</h3>
              <p>
                A website profile brings crawl findings and available
                enrichment together, so you can judge fit before it becomes
                another row in your pipeline.
              </p>
              <FeatureList
                items={[
                  "Review page classifications, topics, extracted content and crawl signals.",
                  "Find public contact details and social links surfaced from the site.",
                  "Check Ahrefs Domain Rating, HypeStat estimates and mobile/desktop PageSpeed when available.",
                ]}
              />
              <p className="public-home-usage-tip">
                <ShieldCheck aria-hidden="true" size={15} />
                <span>
                  <strong>Use the context:</strong> verify important details
                  on the original website before reaching out.
                </span>
              </p>
            </div>
            <ProductScreenshot
              alt="Website research profile with traffic estimates, Ahrefs Domain Rating, PageSpeed scans and extracted website content."
              screen="website-detail"
            />
          </article>

          <article className="public-home-showcase">
            <div className="public-home-showcase-copy">
              <p className="public-home-step-label">
                <span>03</span> SPOT PORTFOLIO PATTERNS
              </p>
              <h3>See what is complete—and what still needs work.</h3>
              <p>
                Portfolio analytics turn a large website list into a view of
                research coverage. Understand where your crawl and enrichment
                data is strong, where it is missing, and which topics appear
                across your saved sites.
              </p>
              <FeatureList
                items={[
                  "Compare desktop and mobile PageSpeed coverage and scores.",
                  "Explore crawl-derived words and phrases separately from discovery searches.",
                  "Review site types, Domain Rating distribution and data coverage.",
                ]}
              />
              <p className="public-home-usage-tip">
                <Gauge aria-hidden="true" size={15} />
                <span>
                  <strong>Use it to prioritize:</strong> find websites with
                  missing research or compare the signals you care about.
                </span>
              </p>
            </div>
            <ProductScreenshot
              alt="Website analytics portfolio with PageSpeed scores, crawl-derived keyword analytics, site types and data coverage."
              screen="website-analytics"
            />
          </article>

          <article className="public-home-showcase is-reversed">
            <div className="public-home-showcase-copy">
              <p className="public-home-step-label">
                <span>04</span> KEEP THE TEAM MOVING
              </p>
              <h3>Turn research into coordinated action.</h3>
              <p>
                The organization dashboard connects the work: follow
                discoveries through indexing, contacts and email activity.
                Team activity and job health help admins see where progress is
                happening and where attention may be needed.
              </p>
              <FeatureList
                items={[
                  "Track organization-wide performance over 7, 30 or 90 days.",
                  "See conversion between stages and compare daily website activity.",
                  "Check member activity, data coverage and background job status.",
                ]}
              />
              <p className="public-home-usage-tip">
                <Users aria-hidden="true" size={15} />
                <span>
                  <strong>For admins:</strong> use the dashboard to spot
                  bottlenecks, then open the related list or job queue.
                </span>
              </p>
            </div>
            <ProductScreenshot
              alt="Organization dashboard with performance cards, website funnel, team activity and recent websites."
              screen="organization-dashboard"
            />
          </article>
        </section>

        <section
          aria-labelledby="public-home-how-title"
          className="public-home-how"
          id="how-it-works"
        >
          <div className="public-home-section-intro">
            <p className="overview-eyebrow">HOW TO USE PROSPECTLOOP</p>
            <h2 id="public-home-how-title">
              A practical loop from research to outreach.
            </h2>
            <p>
              You control which websites are qualified. Enrichment runs in the
              background, so you can keep working while provider results are
              collected.
            </p>
          </div>
          <ol className="public-home-how-steps">
            <li>
              <span className="public-home-how-icon">
                <Compass aria-hidden="true" size={18} />
              </span>
              <span className="public-home-how-number">STEP 01</span>
              <h3>Discover websites</h3>
              <p>
                Search for relevant websites or bring in sites you
                already know. Keep early candidates in the website registry.
              </p>
            </li>
            <li>
              <span className="public-home-how-icon">
                <Globe aria-hidden="true" size={18} />
              </span>
              <span className="public-home-how-number">STEP 02</span>
              <h3>Index and enrich</h3>
              <p>
                Crawl public pages for site context. Queue available
                PageSpeed, Ahrefs and HypeStat lookups without waiting on
                every provider.
              </p>
            </li>
            <li>
              <span className="public-home-how-icon">
                <Layers3 aria-hidden="true" size={18} />
              </span>
              <span className="public-home-how-number">STEP 03</span>
              <h3>Qualify and group</h3>
              <p>
                Review the website profile, decide whether it fits, then add
                selected sites to a website group you can revisit.
              </p>
            </li>
            <li>
              <span className="public-home-how-icon">
                <ArrowRight aria-hidden="true" size={18} />
              </span>
              <span className="public-home-how-number">STEP 04</span>
              <h3>Work your pipeline</h3>
              <p>
                Review website and contact details, manage website status, and
                move qualified sites toward thoughtful outreach.
              </p>
            </li>
          </ol>
        </section>

        <section
          aria-labelledby="public-home-data-title"
          className="public-home-data"
          id="data-sources"
        >
          <div className="public-home-section-intro">
            <p className="overview-eyebrow">READ THE SIGNALS CORRECTLY</p>
            <h2 id="public-home-data-title">
              Useful context, with clear limits.
            </h2>
            <p>
              Different fields come from different sources. Treat them as
              research signals—not guarantees or substitutes for checking the
              business directly.
            </p>
          </div>
          <div className="public-home-data-grid">
            <DataSourceCard
              description="The crawler reads a bounded set of accessible public pages and extracts site content, language, contact links and classification signals."
              icon={Globe}
              note="Coverage depends on what the site makes accessible at crawl time."
              title="Website crawl"
            />
            <DataSourceCard
              description="Domain Rating is an Ahrefs metric. HypeStat provides estimated traffic and related profile data when available."
              icon={BarChart3}
              note="Provider availability, estimates and update times can vary."
              title="Ahrefs and HypeStat"
            />
            <DataSourceCard
              description="PageSpeed uses Google Lighthouse results, tracked separately for mobile and desktop scans."
              icon={Gauge}
              note="Scores can change between runs and are not a guarantee of real-user performance."
              title="PageSpeed"
            />
            <DataSourceCard
              description="On-site words and phrases come from crawled content. Discovery searches are tracked as separate data."
              icon={Search}
              note="Crawl-derived terms are not organic rankings, search volume or keyword positions."
              title="Keywords and searches"
            />
          </div>
        </section>

        <section aria-labelledby="public-home-cta-title" className="public-home-cta">
          <div className="public-home-cta-icon">
            <Building2 aria-hidden="true" size={20} />
          </div>
          <div>
            <p className="overview-eyebrow">MAKE YOUR NEXT DECISION WITH CONTEXT</p>
            <h2 id="public-home-cta-title">
              Bring your website research into one workspace.
            </h2>
            <p>
              Start with discovery, build a researched shortlist, and keep
              qualified opportunities moving.
            </p>
          </div>
          {hasSession ? (
            <Link className="button button-primary" href={workspaceHref}>
              Open your workspace <ArrowRight aria-hidden="true" size={16} />
            </Link>
          ) : showPublicActions ? (
            <Link className="button button-primary" href="/signup">
              Create your workspace <ArrowRight aria-hidden="true" size={16} />
            </Link>
          ) : null}
        </section>
      </main>
      <footer className="public-home-footer">
        <span>
          ProspectLoop <span aria-hidden="true">·</span> Business intelligence
          workspace
        </span>
        <nav aria-label="Public pages">
          {PUBLIC_PAGE_LINKS.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
