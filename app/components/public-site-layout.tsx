import Link from "next/link";
import type { ReactNode } from "react";
import { PUBLIC_PAGE_LINKS } from "@/lib/site";
import { BrandMark } from "./brand-mark";
import { PublicThemeToggle } from "./public-theme-toggle";

const publicNavigation = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function PublicSiteLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="public-site">
      <header className="public-site-header">
        <div className="public-site-header-inner">
          <Link
            aria-label="ProspectLoop home"
            className="public-site-brand"
            href="/"
          >
            <BrandMark />
            <span>ProspectLoop</span>
          </Link>
          <nav aria-label="Main navigation" className="public-site-navigation">
            {publicNavigation.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="public-site-header-actions">
            <Link className="public-site-sign-in" href="/login">
              Sign in
            </Link>
            <PublicThemeToggle />
          </div>
        </div>
      </header>
      <main className="public-site-main">{children}</main>
      <footer className="public-site-footer">
        <span>Copyright ProspectLoop</span>
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

export function PublicPageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="public-page-heading">
      <p className="overview-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

export function LegalOperatorNotice() {
  return (
    <aside className="public-legal-notice" role="note">
      <strong>Publication detail to confirm</strong>
      <p>
        The registered legal name of the service operator and its full postal
        address were not provided. Add these details before treating this page
        as final legal documentation.
      </p>
    </aside>
  );
}
