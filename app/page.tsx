import {
  Building2,
  Compass,
  Mail,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="overview-redesign public-home">
      <header className="public-home-header">
        <Link aria-label="Lead Intelligence home" className="public-home-brand" href="/">
          <span className="brand-mark">BI</span>
          <span>Lead Intelligence</span>
        </Link>
        <div className="public-home-auth">
          <Link className="button button-secondary" href="/login">
            Sign in
          </Link>
          <Link className="button button-primary" href="/signup">
            Create account
          </Link>
        </div>
      </header>

      <main className="public-home-main">
        <section aria-labelledby="public-home-title" className="public-home-hero">
          <div className="public-home-hero-copy">
            <p className="overview-eyebrow">BUSINESS INTELLIGENCE WORKSPACE</p>
            <h1 id="public-home-title">
              Find the right businesses. Turn discovery into leads.
            </h1>
            <p>
              Discover company websites, review useful details, and organize
              your outreach in one workspace.
            </p>
            <div className="public-home-hero-actions">
              <Link className="button button-primary" href="/signup">
                Get started
              </Link>
              <Link className="public-home-text-link" href="/login">
                Already have an account? Sign in
              </Link>
            </div>
          </div>
          <div aria-hidden="true" className="public-home-hero-art">
            <span className="public-home-orbit public-home-orbit-outer" />
            <span className="public-home-orbit public-home-orbit-inner" />
            <span className="public-home-hero-icon">
              <Compass size={39} strokeWidth={1.6} />
            </span>
            <span className="public-home-float-icon public-home-float-companies">
              <Building2 size={20} />
            </span>
            <span className="public-home-float-icon public-home-float-mail">
              <Mail size={20} />
            </span>
          </div>
        </section>

        <section aria-label="Workspace features" className="public-home-features">
          <article>
            <span className="public-home-feature-icon">
              <Compass aria-hidden="true" size={19} />
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
              <Mail aria-hidden="true" size={19} />
            </span>
            <h2>Reach out</h2>
            <p>Prepare and manage email outreach from the same workspace.</p>
          </article>
        </section>
      </main>
      <footer className="public-home-footer">
        Lead Intelligence <span aria-hidden="true">·</span> Business intelligence
        workspace
      </footer>
    </div>
  );
}
