"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Suspense,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { getCompanies } from "@/lib/api";
import type { Company } from "@/lib/api";

const noCompanies: Company[] = [];

const pages = [
  { href: "/", icon: "◫", label: "Overview" },
  { href: "/leads", icon: "▤", label: "Lead pipeline" },
  { href: "/discovery", icon: "⌕", label: "Discover leads" },
  { href: "/crawler", icon: "◎", label: "Crawl a website" },
  { href: "/crawler/queue", icon: "↻", label: "Crawler queue" },
  { href: "/pagespeed-queue", icon: "◷", label: "PageSpeed queue" },
];

function subscribeToTheme(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("lead-intelligence-theme-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("lead-intelligence-theme-change", onChange);
  };
}

function getThemeSnapshot() {
  const savedTheme = window.localStorage.getItem("lead-intelligence-theme");
  return (
    savedTheme === "dark" ||
    (savedTheme !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const isDarkMode = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    () => false,
  );
  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
  });
  const companies = companiesQuery.data ?? noCompanies;
  const connectionLabel = companiesQuery.isError
    ? "API unavailable"
    : companiesQuery.isLoading
      ? "Connecting"
      : "API connected";

  useEffect(() => {
    document.documentElement.dataset.theme = isDarkMode ? "dark" : "light";
  }, [isDarkMode]);

  function toggleTheme() {
    window.localStorage.setItem(
      "lead-intelligence-theme",
      isDarkMode ? "light" : "dark",
    );
    window.dispatchEvent(new Event("lead-intelligence-theme-change"));
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Lead Intelligence home">
          <span className="brand-mark">BI</span>
          <span>
            <strong>Lead Intelligence</strong>
            <small>BUSINESS WORKSPACE</small>
          </span>
        </Link>

        <div className="sidebar-label">WORKSPACE</div>
        <Suspense fallback={<div className="sidebar-nav-loading" />}>
          <WorkspaceNavigation companyCount={companies.length} />
        </Suspense>

        <button
          aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
          aria-pressed={isDarkMode}
          className="theme-toggle"
          onClick={toggleTheme}
          type="button"
        >
          <span aria-hidden="true">{isDarkMode ? "☀" : "☾"}</span>
          {isDarkMode ? "Light mode" : "Dark mode"}
        </button>

        <div className="sidebar-spacer" />
        <div className="sidebar-note">
          <span className="note-dot" />
          <span>
            <strong>API workspace</strong>
            <small>{connectionLabel}</small>
          </span>
        </div>
      </aside>

      <main className="main-content">
        <div className="content-wrap">
          {children}
          <footer className="page-footer">
            Lead Intelligence <span>·</span> Your company data stays in your
            connected backend.
          </footer>
        </div>
      </main>
    </div>
  );
}

function WorkspaceNavigation({ companyCount }: { companyCount: number }) {
  const pathname = usePathname();

  return pages.map((page) => (
    <Link
      aria-current={pathname === page.href ? "page" : undefined}
      className={`nav-link${pathname === page.href ? " active" : ""}`}
      href={page.href}
      key={page.href}
    >
      <span className="nav-icon">{page.icon}</span>
      {page.label}
      {page.href === "/leads" && (
        <span className="nav-count">{companyCount}</span>
      )}
    </Link>
  ));
}
