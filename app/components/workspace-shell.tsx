"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Suspense,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ApiError,
  getAuthSession,
  getCompanies,
  logout,
  type Company,
} from "@/lib/api";

const noCompanies: Company[] = [];

const pages = [
  { href: "/", icon: "◫", label: "Overview" },
  { href: "/companies", icon: "▣", label: "Companies" },
  { href: "/leads", icon: "▤", label: "Lead pipeline" },
  { href: "/discovery", icon: "⌕", label: "Discover leads" },
  { href: "/websites", icon: "↗", label: "Websites" },
  { href: "/gmail", icon: "✉", label: "Gmail" },
  { href: "/templates", icon: "▧", label: "Email templates" },
  { href: "/campaigns", icon: "↗", label: "Drip campaigns" },
  { href: "/crawler", icon: "◎", label: "Crawl a website" },
  { href: "/crawler/queue", icon: "↻", label: "Crawler queue" },
  { href: "/pagespeed-queue", icon: "◷", label: "PageSpeed queue" },
  { href: "/settings", icon: "⚙", label: "Settings" },
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
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isPublicAuthPage = pathname === "/login" || pathname === "/signup";
  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession,
    enabled: !isPublicAuthPage,
    retry: false,
  });
  const isDarkMode = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    () => false,
  );
  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
    enabled: sessionQuery.data !== undefined,
  });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth-session"] });
      router.replace("/login");
    },
  });
  const companies = companiesQuery.data ?? noCompanies;
  const leadCount = companies.filter(
    (company) => company.contacts.length > 0,
  ).length;
  const connectionLabel = companiesQuery.isError
    ? "API unavailable"
    : companiesQuery.isLoading
      ? "Connecting"
      : "API connected";
  const sessionIsUnauthorized =
    sessionQuery.error instanceof ApiError &&
    sessionQuery.error.status === 401;

  useEffect(() => {
    document.documentElement.dataset.theme = isDarkMode ? "dark" : "light";
  }, [isDarkMode]);

  useEffect(() => {
    if (
      !isPublicAuthPage &&
      !sessionQuery.isLoading &&
      sessionIsUnauthorized
    ) {
      router.replace("/login");
    }
  }, [
    isPublicAuthPage,
    router,
    sessionIsUnauthorized,
    sessionQuery.isLoading,
  ]);

  function toggleTheme() {
    window.localStorage.setItem(
      "lead-intelligence-theme",
      isDarkMode ? "light" : "dark",
    );
    window.dispatchEvent(new Event("lead-intelligence-theme-change"));
  }

  if (isPublicAuthPage) return children;
  if (sessionQuery.isLoading || (!sessionQuery.data && !sessionQuery.isError)) {
    return <WorkspaceSessionLoading />;
  }
  if (!sessionQuery.data) {
    if (sessionIsUnauthorized) return null;
    return (
      <main className="main-content">
        <div className="content-wrap">
          <div className="query-error" role="alert">
            <strong>Could not verify your session.</strong>
            <span>
              {sessionQuery.error instanceof Error
                ? sessionQuery.error.message
                : "The API could not be reached."}
            </span>
            <button
              className="button button-secondary"
              onClick={() => void sessionQuery.refetch()}
              type="button"
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    );
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
          <WorkspaceNavigation
            companyCount={companies.length}
            leadCount={leadCount}
          />
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
          <span>
            <strong>{sessionQuery.data.user.email}</strong>
            <small>
              {sessionQuery.data.organization_name} ·{" "}
              {sessionQuery.data.user.role === "admin" ? "Admin" : "User"}
            </small>
          </span>
          <button
            className="button button-secondary"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
            type="button"
          >
            {logoutMutation.isPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
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

function WorkspaceNavigation({
  companyCount,
  leadCount,
}: {
  companyCount: number;
  leadCount: number;
}) {
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
      {(page.href === "/companies" || page.href === "/leads") && (
        <span className="nav-count">
          {page.href === "/companies" ? companyCount : leadCount}
        </span>
      )}
    </Link>
  ));
}

function WorkspaceSessionLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading workspace"
      className="app-shell workspace-session-loading"
      role="status"
    >
      <span className="sr-only">Loading workspace</span>
      <aside aria-hidden="true" className="sidebar">
        <div className="brand">
          <span className="brand-mark">BI</span>
          <span>
            <strong>Lead Intelligence</strong>
            <small>BUSINESS WORKSPACE</small>
          </span>
        </div>
        <div className="sidebar-label">WORKSPACE</div>
        <div className="workspace-skeleton-nav">
          {pages.map((page, index) => (
            <div className="workspace-skeleton-nav-row" key={page.href}>
              <span className="workspace-skeleton-block workspace-skeleton-icon" />
              <span
                className={`workspace-skeleton-block workspace-skeleton-nav-label skeleton-width-${index % 3}`}
              />
            </div>
          ))}
        </div>
        <div className="sidebar-spacer" />
        <div className="workspace-skeleton-account">
          <span className="workspace-skeleton-block workspace-skeleton-line skeleton-width-1" />
          <span className="workspace-skeleton-block workspace-skeleton-line skeleton-width-2" />
        </div>
      </aside>
      <main className="main-content">
        <div className="content-wrap">
          <div className="workspace-skeleton-heading">
            <div className="workspace-skeleton-heading-copy">
              <span className="workspace-skeleton-block workspace-skeleton-line skeleton-width-2" />
              <span className="workspace-skeleton-block workspace-skeleton-title" />
              <span className="workspace-skeleton-block workspace-skeleton-line skeleton-width-1" />
            </div>
            <span className="workspace-skeleton-block workspace-skeleton-button" />
          </div>
          <div className="stats-grid workspace-skeleton-stats">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="stat-card" key={index}>
                <span className="workspace-skeleton-block workspace-skeleton-line skeleton-width-2" />
                <span className="workspace-skeleton-block workspace-skeleton-value" />
                <span className="workspace-skeleton-block workspace-skeleton-line skeleton-width-1" />
              </div>
            ))}
          </div>
          <div className="overview-grid workspace-skeleton-actions">
            {Array.from({ length: 2 }, (_, index) => (
              <div className="overview-action" key={index}>
                <span className="workspace-skeleton-block workspace-skeleton-icon" />
                <span className="workspace-skeleton-block workspace-skeleton-line skeleton-width-1" />
              </div>
            ))}
          </div>
          <section className="panel workspace-skeleton-table">
            <span className="workspace-skeleton-block workspace-skeleton-line skeleton-width-2" />
            <span className="workspace-skeleton-block workspace-skeleton-title skeleton-width-1" />
            <div className="workspace-skeleton-table-rows">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="workspace-skeleton-table-row" key={index}>
                  <span className="workspace-skeleton-block workspace-skeleton-icon" />
                  <span className="workspace-skeleton-block workspace-skeleton-line skeleton-width-1" />
                  <span className="workspace-skeleton-block workspace-skeleton-line skeleton-width-2" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
