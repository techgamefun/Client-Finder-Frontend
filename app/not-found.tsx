import type { Metadata } from "next";
import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "./components/brand-mark";

export const metadata: Metadata = {
  title: "Page not found | ProspectLoop",
  description:
    "This page could not be found. Return to ProspectLoop to continue.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    <main aria-labelledby="not-found-title" className="not-found-page">
      <header className="not-found-header">
        <Link
          aria-label="ProspectLoop home"
          className="public-home-brand"
          href="/"
        >
          <BrandMark />
          <span>ProspectLoop</span>
        </Link>
      </header>

      <section className="not-found-content">
        <div aria-hidden="true" className="not-found-illustration">
          <span className="not-found-number">404</span>
          <span className="not-found-compass">
            <Compass size={28} strokeWidth={1.7} />
          </span>
        </div>
        <p className="overview-eyebrow">PAGE NOT FOUND</p>
        <h1 id="not-found-title">We couldn’t find that page.</h1>
        <p className="not-found-description">
          The link may be out of date, or the page may have moved. Check the
          address or return to ProspectLoop.
        </p>
        <div className="not-found-actions">
          <Link className="button button-primary" href="/">
            <ArrowLeft aria-hidden="true" size={16} />
            Back to home
          </Link>
        </div>
      </section>

      <footer className="not-found-footer">
        ProspectLoop <span aria-hidden="true">·</span> Business intelligence
        workspace
      </footer>
    </main>
  );
}
