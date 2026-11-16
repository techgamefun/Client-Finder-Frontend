"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, Compass, Globe, Mail } from "lucide-react";
import Link from "next/link";
import { ApiError, getAuthSession } from "@/lib/api";

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
    sessionQuery.data?.user.role === "admin" ? "/admin" : "/overview";

  return (
    <div className="overview-redesign public-home">
      <header className="public-home-header">
        <div className="public-home-header-inner">
          <Link
            aria-label="Lead Intelligence home"
            className="public-home-brand"
            href="/"
          >
            <span className="brand-mark">BI</span>
            <span>Lead Intelligence</span>
          </Link>

          <nav aria-label="Page sections" className="public-home-nav">
            <Link href="#how-it-works">How it works</Link>
            <Link href="#features">Features</Link>
          </nav>

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
            <span aria-hidden="true" className="public-home-auth-placeholder" />
          )}
        </div>
      </header>

      <main className="public-home-main">
        <section
          id="how-it-works"
          aria-labelledby="public-home-title"
          className="public-home-hero"
        >
          <div className="public-home-hero-copy">
            <p className="overview-eyebrow">
              RESEARCH-DRIVEN LEAD GENERATION
            </p>
            <h1 id="public-home-title">
              Find better-fit companies. Build stronger outreach.
            </h1>
            <p>
              Discover companies, understand what they do, and keep every
              opportunity moving in one focused workspace.
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
                  <Link className="public-home-text-link" href="/login">
                    Sign in to your account
                  </Link>
                </>
              ) : null}
            </div>
          </div>
          <div aria-hidden="true" className="public-home-preview">
            <div className="public-home-preview-window">
              <div className="public-home-preview-bar">
                <span>YOUR WORKFLOW</span>
              </div>
              <div className="public-home-preview-content">
                <p>From discovery to outreach</p>
                <div className="public-home-preview-step">
                  <span className="public-home-preview-icon">
                    <Compass aria-hidden="true" size={17} />
                  </span>
                  <span>
                    <strong>Discover</strong>
                    <small>Find relevant businesses</small>
                  </span>
                  <span className="public-home-preview-number">01</span>
                </div>
                <div className="public-home-preview-connector" />
                <div className="public-home-preview-step">
                  <span className="public-home-preview-icon">
                    <Building2 aria-hidden="true" size={17} />
                  </span>
                  <span>
                    <strong>Understand</strong>
                    <small>Review company websites</small>
                  </span>
                  <span className="public-home-preview-number">02</span>
                </div>
                <div className="public-home-preview-connector" />
                <div className="public-home-preview-step">
                  <span className="public-home-preview-icon">
                    <Mail aria-hidden="true" size={17} />
                  </span>
                  <span>
                    <strong>Connect</strong>
                    <small>Organize thoughtful outreach</small>
                  </span>
                  <span className="public-home-preview-number">03</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="public-home-features-title"
          className="public-home-features-section"
          id="features"
        >
          <div className="public-home-features-heading">
            <p className="overview-eyebrow">A CLEARER WAY TO WORK</p>
            <h2 id="public-home-features-title">
              From first search to first conversation.
            </h2>
          </div>
          <div className="public-home-features">
          <article>
            <span className="public-home-feature-icon">
              <Compass aria-hidden="true" size={18} />
            </span>
            <h2>Discover</h2>
            <p>Find relevant businesses and explore their websites.</p>
          </article>
          <article>
            <span className="public-home-feature-icon">
              <Building2 aria-hidden="true" size={19} />
            </span>
            <h2>Organize</h2>
            <p>Keep company and contact details together in your pipeline.</p>
          </article>
          <article>
            <span className="public-home-feature-icon">
              <Globe aria-hidden="true" size={18} />
            </span>
            <h2>Work with context</h2>
            <p>Use website research to make better-informed decisions.</p>
          </article>
          </div>
        </section>
      </main>
      <footer className="public-home-footer">
        Lead Intelligence <span aria-hidden="true">·</span> Business intelligence
        workspace
      </footer>
    </div>
  );
}
