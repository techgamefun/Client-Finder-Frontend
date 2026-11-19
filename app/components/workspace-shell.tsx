"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Building2,
  ChevronDown,
  ChevronRight,
  Compass,
  Globe,
  LoaderCircle,
  LogOut,
  Menu,
  Megaphone,
  Moon,
  Monitor,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
  type ReactNode,
} from "react";
import {
  ApiError,
  getAuthSession,
  getCompanies,
  getPageSpeedScanJobs,
  getWebsiteCrawlJobs,
  logout,
  type Company,
} from "@/lib/api";
import {
  getThemePreferenceSnapshot,
  getThemeSnapshot,
  persistThemePreference,
  subscribeToTheme,
  type ThemePreference,
} from "@/lib/theme";
import {
  navigationSections,
  type NavigationItem,
  type NavigationRole,
} from "./nav.config";
import { BrandMark } from "./brand-mark";
import { useToast } from "./toast-provider";

const noCompanies: Company[] = [];
const sidebarPreferenceKey = "lead-intelligence-sidebar-collapsed";
const sidebarPreferenceChangedEvent = "lead-intelligence-sidebar-changed";

function subscribeToSidebarPreference(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(sidebarPreferenceChangedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(sidebarPreferenceChangedEvent, onChange);
  };
}

function getSidebarCollapsedSnapshot() {
  return window.localStorage.getItem(sidebarPreferenceKey) === "true";
}

function persistSidebarPreference(collapsed: boolean) {
  window.localStorage.setItem(sidebarPreferenceKey, String(collapsed));
  window.dispatchEvent(new Event(sidebarPreferenceChangedEvent));
}

function toggleSidebarPreference() {
  persistSidebarPreference(!getSidebarCollapsedSnapshot());
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const currentLocation = `${pathname}${search ? `?${search}` : ""}`;
  const router = useRouter();
  const queryClient = useQueryClient();
  const showToast = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sidebarCollapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarCollapsedSnapshot,
    () => false,
  );
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const isPublicAuthPage = pathname === "/login" || pathname === "/signup";
  const isPublicNotFoundPage = !isKnownWorkspaceRoute(pathname);
  const isPublicPage =
    pathname === "/" || isPublicAuthPage || isPublicNotFoundPage;
  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession,
    enabled: !isPublicNotFoundPage,
    retry: false,
  });
  const themePreference = useSyncExternalStore(
    subscribeToTheme,
    getThemePreferenceSnapshot,
    (): ThemePreference => "system",
  );
  const isDarkMode = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    () => false,
  );
  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
    enabled: !isPublicPage && sessionQuery.data !== undefined,
  });
  const crawlerJobsQuery = useQuery({
    queryKey: ["crawler", "queue-jobs"],
    queryFn: getWebsiteCrawlJobs,
    enabled: !isPublicPage && sessionQuery.data !== undefined,
  });
  const pageSpeedJobsQuery = useQuery({
    queryKey: ["pagespeed", "queue-jobs"],
    queryFn: getPageSpeedScanJobs,
    enabled: !isPublicPage && sessionQuery.data !== undefined,
  });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth-session"] });
      router.replace("/login");
    },
    onError: (error: Error) => {
      showToast({
        type: "error",
        title: "Could not sign out",
        message: error.message,
      });
    },
  });
  const companies = companiesQuery.data ?? noCompanies;
  const leadsNeedingReview = companies.filter(
    (company) =>
      company.contacts.length > 0 && company.lead_status === "needs_review",
  ).length;
  const jobs = [
    ...(crawlerJobsQuery.data ?? []),
    ...(pageSpeedJobsQuery.data ?? []),
  ];
  const runningJobs = jobs.filter((job) => job.status === "running").length;
  const failedJobs = jobs.filter((job) => job.status === "failed").length;
  const sessionIsUnauthorized =
    sessionQuery.error instanceof ApiError && sessionQuery.error.status === 401;

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMobileMenuOpen(false);
        setCommandPaletteOpen(true);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        if (window.matchMedia("(max-width: 1023px)").matches) {
          setMobileMenuOpen((open) => !open);
        } else {
          toggleSidebarPreference();
        }
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    if (!sidebarRef.current) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = () => {
      const drawer = sidebarRef.current;
      if (!drawer) return [];
      return Array.from(
        drawer.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.getClientRects().length > 0);
    };
    const frame = window.requestAnimationFrame(() => {
      focusableElements()[0]?.focus();
    });

    function handleDrawerKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (sidebarRef.current?.querySelector(".account-popover")) return;
        event.preventDefault();
        setMobileMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusableElements();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDrawerKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDrawerKeyDown);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    document.documentElement.dataset.theme = isDarkMode ? "dark" : "light";
    document.documentElement.style.colorScheme = isDarkMode ? "dark" : "light";
  }, [isDarkMode]);

  useEffect(() => {
    if (
      isPublicAuthPage &&
      sessionQuery.data &&
      !sessionIsUnauthorized &&
      !sessionQuery.isFetching
    ) {
      router.replace(
        sessionQuery.data.user.role === "admin" ? "/admin" : "/overview",
      );
    }
  }, [
    isPublicAuthPage,
    router,
    sessionIsUnauthorized,
    sessionQuery.data,
    sessionQuery.isFetching,
  ]);

  useEffect(() => {
    if (!isPublicPage && !sessionQuery.isLoading && sessionIsUnauthorized) {
      router.replace("/login");
    }
  }, [isPublicPage, router, sessionIsUnauthorized, sessionQuery.isLoading]);

  if (pathname === "/") return children;
  if (isPublicNotFoundPage) return children;
  if (isPublicAuthPage) {
    if (sessionQuery.data && !sessionIsUnauthorized) {
      return <PublicAuthChecking />;
    }
    return children;
  }
  if (sessionQuery.isLoading || (!sessionQuery.data && !sessionQuery.isError)) {
    return <WorkspaceSessionLoading />;
  }
  if (!sessionQuery.data) {
    if (sessionIsUnauthorized) return null;
    return (
      <main className="main-content">
        <div
          className={
            pathname === "/websites"
              ? "content-wrap is-websites-page"
              : "content-wrap"
          }
        >
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
    <div
      className={`app-shell${sidebarCollapsed ? " is-sidebar-collapsed" : ""}${/^\/websites\/[^/]+$/.test(pathname) ? " is-website-profile" : ""}`}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <button
        aria-hidden={!mobileMenuOpen}
        aria-label="Close navigation"
        className={`sidebar-backdrop${mobileMenuOpen ? " is-open" : ""}`}
        disabled={!mobileMenuOpen}
        onClick={() => {
          setMobileMenuOpen(false);
          mobileMenuButtonRef.current?.focus();
        }}
        tabIndex={-1}
        type="button"
      />
      <aside
        className={`sidebar${mobileMenuOpen ? " is-open" : ""}`}
        ref={sidebarRef}
      >
        <div className="sidebar-header">
          <Link
            aria-label="ProspectLoop home"
            className="brand"
            href={
              sessionQuery.data.user.role === "admin" ? "/admin" : "/overview"
            }
            title="ProspectLoop"
          >
            <BrandMark />
            <span>
              <strong>ProspectLoop</strong>
              <small>BUSINESS INTELLIGENCE</small>
            </span>
          </Link>
          <button
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            className="sidebar-collapse-toggle"
            onClick={() => persistSidebarPreference(!sidebarCollapsed)}
            title={`${sidebarCollapsed ? "Expand" : "Collapse"} sidebar (Ctrl/Cmd+B)`}
            type="button"
          >
            {sidebarCollapsed ? (
              <PanelLeft aria-hidden="true" size={18} strokeWidth={2} />
            ) : (
              <PanelLeftClose aria-hidden="true" size={18} strokeWidth={2} />
            )}
          </button>
          <button
            aria-label="Close navigation"
            className="mobile-drawer-close"
            onClick={() => {
              setMobileMenuOpen(false);
              mobileMenuButtonRef.current?.focus();
            }}
            type="button"
          >
            <X aria-hidden="true" size={18} strokeWidth={2} />
          </button>
        </div>
        <nav
          aria-label="Primary"
          className="sidebar-navigation"
          id="primary-navigation"
        >
          <Suspense fallback={<div className="sidebar-nav-loading" />}>
            <WorkspaceNavigation
              failedJobs={failedJobs}
              key={pathname}
              leadsNeedingReview={leadsNeedingReview}
              location={currentLocation}
              onNavigate={() => setMobileMenuOpen(false)}
              runningJobs={runningJobs}
              role={sessionQuery.data.user.role}
            />
          </Suspense>
        </nav>
        <AccountMenu
          email={sessionQuery.data.user.email}
          logoutPending={logoutMutation.isPending}
          onLogout={() => logoutMutation.mutate()}
          onNavigate={() => setMobileMenuOpen(false)}
          onThemeChange={persistThemePreference}
          organizationName={sessionQuery.data.organization_name}
          role={sessionQuery.data.user.role}
          themePreference={themePreference}
        />
      </aside>

      <main className="main-content" id="main-content" tabIndex={-1}>
        <WorkspaceTopBar
          companies={companies}
          location={currentLocation}
          mobileMenuOpen={mobileMenuOpen}
          mobileMenuButtonRef={mobileMenuButtonRef}
          onCommandPaletteOpen={() => setCommandPaletteOpen(true)}
          onMobileMenuOpen={() => setMobileMenuOpen(true)}
          pathname={pathname}
          role={sessionQuery.data.user.role}
        />
        <div
          className={`content-wrap${pathname === "/templates" ? " is-templates-page" : ""}`}
        >
          {children}
          <footer className="page-footer">
            ProspectLoop <span>·</span> Your company data stays in your
            connected backend.
          </footer>
        </div>
      </main>
      <CommandPalette
        companies={companies}
        onClose={() => setCommandPaletteOpen(false)}
        open={commandPaletteOpen}
        role={sessionQuery.data.user.role}
      />
    </div>
  );
}

interface WorkspaceBreadcrumb {
  label: string;
  href?: string;
}

interface WorkspaceAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

function WorkspaceTopBar({
  companies,
  location,
  mobileMenuOpen,
  mobileMenuButtonRef,
  onCommandPaletteOpen,
  onMobileMenuOpen,
  pathname,
  role,
}: {
  companies: Company[];
  location: string;
  mobileMenuOpen: boolean;
  mobileMenuButtonRef: RefObject<HTMLButtonElement | null>;
  onCommandPaletteOpen: () => void;
  onMobileMenuOpen: () => void;
  pathname: string;
  role: NavigationRole;
}) {
  const breadcrumbs = getWorkspaceBreadcrumbs(location, companies);
  const action = getWorkspaceAction(pathname, role);

  return (
    <header className="workspace-topbar">
      <div className="workspace-topbar-inner">
        <button
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
          aria-controls="primary-navigation"
          className="topbar-menu-button"
          onClick={onMobileMenuOpen}
          ref={mobileMenuButtonRef}
          type="button"
        >
          <Menu aria-hidden="true" size={19} strokeWidth={2} />
        </button>
        <nav aria-label="Breadcrumb" className="workspace-breadcrumbs">
          <ol>
            {breadcrumbs.map((breadcrumb, index) => {
              const isCurrent = index === breadcrumbs.length - 1;
              return (
                <li key={`${breadcrumb.label}-${index}`}>
                  {index > 0 && (
                    <ChevronRight
                      aria-hidden="true"
                      className="breadcrumb-separator"
                      size={15}
                      strokeWidth={2}
                    />
                  )}
                  {breadcrumb.href && !isCurrent ? (
                    <Link href={breadcrumb.href}>{breadcrumb.label}</Link>
                  ) : (
                    <span aria-current={isCurrent ? "page" : undefined}>
                      {breadcrumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="workspace-topbar-actions">
          {action && (
            <Link
              aria-label={action.label}
              className="topbar-context-action"
              href={action.href}
            >
              <action.icon aria-hidden="true" size={17} strokeWidth={2} />
              <span>{action.label}</span>
            </Link>
          )}
          <button
            aria-label="Search pages and companies (Ctrl or Command+K)"
            className="command-palette-trigger"
            onClick={onCommandPaletteOpen}
            type="button"
          >
            <Search aria-hidden="true" size={17} strokeWidth={2} />
            <span>Search</span>
            <kbd>Ctrl K</kbd>
          </button>
        </div>
      </div>
    </header>
  );
}

function getWorkspaceBreadcrumbs(
  location: string,
  companies: Company[],
): WorkspaceBreadcrumb[] {
  const pathname = location.split("?")[0] ?? "/";
  const companyDetailMatch = pathname.match(/^\/company\/([^/]+)$/);
  if (companyDetailMatch) {
    const company = companies.find(
      (candidate) => candidate.id === companyDetailMatch[1],
    );
    return [
      { label: "Companies", href: "/companies" },
      { label: company?.name ?? "Company details" },
    ];
  }
  if (/^\/websites\/[^/]+$/.test(pathname)) {
    return [
      { label: "Websites", href: "/websites" },
      { label: "Website details" },
    ];
  }

  const route = navigationSections
    .flatMap((section) =>
      section.items.flatMap((item) =>
        (item.children ?? [item]).map((entry) => ({
          section,
          entry,
        })),
      ),
    )
    .filter(({ entry }) => isActiveRoute(location, entry.href))
    .sort((left, right) => right.entry.href.length - left.entry.href.length)[0];
  if (!route) return [{ label: "Workspace", href: "/" }, { label: "Page" }];

  const sectionHref = route.section.items[0]?.href.split("?")[0];
  const parent =
    route.section.label && route.section.label !== route.entry.label
      ? [{ label: route.section.label, href: sectionHref }]
      : [];
  return [...parent, { label: route.entry.label }];
}

function getWorkspaceAction(
  pathname: string,
  role: NavigationRole,
): WorkspaceAction | null {
  if (pathname === "/") {
    return { label: "Discover websites", href: "/discovery", icon: Compass };
  }
  if (pathname === "/discovery") {
    return { label: "Open website registry", href: "/websites", icon: Globe };
  }
  if (pathname === "/websites" || pathname.startsWith("/websites/")) {
    return {
      label: "Index website",
      href: "/websites?crawl=1",
      icon: Plus,
    };
  }
  if (pathname === "/companies") {
    return {
      label: "Add company",
      href: "/companies?add=1",
      icon: Plus,
    };
  }
  if (pathname === "/leads") {
    return role === "admin"
      ? {
          label: "New campaign",
          href: "/campaigns?create=1",
          icon: Megaphone,
        }
      : {
          label: "Manage companies",
          href: "/companies",
          icon: Building2,
        };
  }
  if (pathname === "/jobs") {
    return { label: "Start indexing", href: "/websites?crawl=1", icon: Plus };
  }
  if (pathname === "/gmail") {
    return {
      label: "Compose email",
      href: "/gmail?compose=1",
      icon: Plus,
    };
  }
  if (pathname === "/campaigns") {
    return role === "admin"
      ? null
      : {
          label: "View lead pipeline",
          href: "/leads",
          icon: Building2,
        };
  }
  if (pathname === "/settings") {
    return role === "admin"
      ? {
          label: "Organization users",
          href: "/settings?section=organization",
          icon: Settings,
        }
      : {
          label: "My account",
          href: "/settings?section=account",
          icon: Settings,
        };
  }
  if (pathname.startsWith("/company/")) {
    return { label: "Start indexing", href: "/websites?crawl=1", icon: Plus };
  }
  return null;
}

const workspaceRoutes = new Set([
  "/",
  "/admin",
  "/campaigns",
  "/crawler",
  "/crawler/queue",
  "/discovery",
  "/gmail",
  "/companies",
  "/jobs",
  "/jobs/import",
  "/leads",
  "/login",
  "/overview",
  "/pagespeed-queue",
  "/settings",
  "/signup",
  "/templates",
  "/websites",
]);

function isKnownWorkspaceRoute(pathname: string) {
  return (
    workspaceRoutes.has(pathname) ||
    /^\/company\/[^/]+$/.test(pathname) ||
    /^\/websites\/[^/]+$/.test(pathname)
  );
}

interface CommandEntry {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  keywords: string;
}

function CommandPalette({
  companies,
  onClose,
  open,
  role,
}: {
  companies: Company[];
  onClose: () => void;
  open: boolean;
  role: NavigationRole;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setQuery("");
      dialog.showModal();
      window.requestAnimationFrame(() => searchInputRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const entries = navigationSections.flatMap((section) =>
    section.items.flatMap((item) =>
      (item.children ?? [item])
        .filter((entry) => !entry.role || entry.role === role)
        .map((entry) => ({
          id: entry.id,
          label: entry.label,
          description: section.label ?? "Workspace",
          href: entry.href,
          icon: entry.icon,
          keywords: `${section.label ?? ""} ${entry.label} ${entry.href}`,
        })),
    ),
  );
  const quickActions: CommandEntry[] = [
    {
      id: "add-company",
      label: "Add company",
      description: "Create a company record",
      href: "/companies?add=1",
      icon: Building2,
      keywords: "company create new add",
    },
    {
      id: "start-index",
      label: "Start indexing",
      description: "Index a website and extract business details",
      href: "/websites?crawl=1",
      icon: Globe,
      keywords: "index website research",
    },
    ...(role === "admin"
      ? [
          {
            id: "new-campaign",
            label: "New campaign",
            description: "Set up an email campaign",
            href: "/campaigns?create=1",
            icon: Megaphone,
            keywords: "email outreach create",
          },
        ]
      : []),
  ];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = (entry: CommandEntry) =>
    !normalizedQuery ||
    `${entry.label} ${entry.description} ${entry.keywords}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  const matchingPages = entries.filter(matches).slice(0, 6);
  const matchingActions = quickActions.filter(matches);
  const matchingCompanies = normalizedQuery
    ? companies
        .filter((company) =>
          [company.name, company.domain, company.website]
            .filter(Boolean)
            .some((value) =>
              value?.toLocaleLowerCase().includes(normalizedQuery),
            ),
        )
        .slice(0, 5)
    : [];

  function navigateTo(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <dialog
      aria-labelledby="command-palette-title"
      className="command-palette-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      ref={dialogRef}
    >
      <h2 className="sr-only" id="command-palette-title">
        Command palette
      </h2>
      <label className="command-palette-search">
        <Search aria-hidden="true" size={20} strokeWidth={2} />
        <span className="sr-only">Search pages, companies, and actions</span>
        <input
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pages, companies, and actions..."
          ref={searchInputRef}
          type="search"
          value={query}
        />
        <kbd>Esc</kbd>
      </label>
      <div className="command-palette-results">
        {matchingActions.length > 0 && (
          <section aria-label="Quick actions">
            <h3>Quick actions</h3>
            {matchingActions.map((entry) => (
              <CommandPaletteButton
                entry={entry}
                key={entry.id}
                onSelect={navigateTo}
              />
            ))}
          </section>
        )}
        {matchingPages.length > 0 && (
          <section aria-label="Pages">
            <h3>Pages</h3>
            {matchingPages.map((entry) => (
              <CommandPaletteButton
                entry={entry}
                key={entry.id}
                onSelect={navigateTo}
              />
            ))}
          </section>
        )}
        {matchingCompanies.length > 0 && (
          <section aria-label="Companies">
            <h3>Companies</h3>
            {matchingCompanies.map((company) => (
              <button
                className="command-palette-result"
                key={company.id}
                onClick={() => navigateTo(`/company/${company.id}`)}
                type="button"
              >
                <Building2 aria-hidden="true" size={18} strokeWidth={2} />
                <span>
                  <strong>{company.name}</strong>
                  <small>
                    {company.domain || company.website || "Company record"}
                  </small>
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="command-palette-result-tail"
                  size={16}
                  strokeWidth={2}
                />
              </button>
            ))}
          </section>
        )}
        {matchingActions.length === 0 &&
          matchingPages.length === 0 &&
          matchingCompanies.length === 0 && (
            <p className="command-palette-empty">No matching results.</p>
          )}
      </div>
    </dialog>
  );
}

function CommandPaletteButton({
  entry,
  onSelect,
}: {
  entry: CommandEntry;
  onSelect: (href: string) => void;
}) {
  const Icon = entry.icon;
  return (
    <button
      className="command-palette-result"
      onClick={() => onSelect(entry.href)}
      type="button"
    >
      <Icon aria-hidden="true" size={18} strokeWidth={2} />
      <span>
        <strong>{entry.label}</strong>
        <small>{entry.description}</small>
      </span>
      <ArrowUpRight
        aria-hidden="true"
        className="command-palette-result-tail"
        size={16}
        strokeWidth={2}
      />
    </button>
  );
}

function WorkspaceNavigation({
  failedJobs,
  leadsNeedingReview,
  location,
  onNavigate,
  runningJobs,
  role,
}: {
  failedJobs: number;
  leadsNeedingReview: number;
  location: string;
  onNavigate: () => void;
  runningJobs: number;
  role: NavigationRole;
}) {
  const pathname = location;
  const badgeCounts = { leads: leadsNeedingReview, jobs: failedJobs };
  const visibleSections = navigationSections
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => filterNavigationItem(item, role))
        .filter((item): item is NavigationItem => item !== null),
    }))
    .filter((section) => section.items.length > 0);
  const primarySections = visibleSections.filter((section) => !section.bottom);
  const bottomSections = visibleSections.filter((section) => section.bottom);

  return (
    <>
      <ul className="nav-sections">
        {primarySections.map((section) => (
          <li className="nav-section" key={section.id}>
            {section.label && (
              <div className="sidebar-label">{section.label}</div>
            )}
            <ul className="nav-section-items">
              {section.items.map((item) => (
                <NavigationEntry
                  badgeCount={
                    item.badgeKey ? badgeCounts[item.badgeKey] : undefined
                  }
                  item={item}
                  key={item.id}
                  onNavigate={onNavigate}
                  pathname={pathname}
                  runningJobs={item.badgeKey === "jobs" ? runningJobs : 0}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {bottomSections.map((section) => (
        <ul className="nav-bottom" key={section.id}>
          {section.items.map((item) => (
            <NavigationEntry
              badgeCount={
                item.badgeKey ? badgeCounts[item.badgeKey] : undefined
              }
              item={item}
              key={item.id}
              onNavigate={onNavigate}
              pathname={pathname}
              runningJobs={item.badgeKey === "jobs" ? runningJobs : 0}
            />
          ))}
        </ul>
      ))}
    </>
  );
}

function filterNavigationItem(
  item: NavigationItem,
  role: NavigationRole,
): NavigationItem | null {
  if (item.role && item.role !== role) return null;
  if (!item.children) return item;

  const children = item.children
    .map((child) => filterNavigationItem(child, role))
    .filter((child): child is NavigationItem => child !== null);
  return children.length > 0 ? { ...item, children } : null;
}

function NavigationEntry({
  badgeCount,
  item,
  onNavigate,
  pathname,
  runningJobs,
}: {
  badgeCount?: number;
  item: NavigationItem;
  onNavigate: () => void;
  pathname: string;
  runningJobs: number;
}) {
  const Icon = item.icon;
  if (item.children?.length) {
    return (
      <MailNavigationGroup
        badgeCount={badgeCount}
        item={item}
        onNavigate={onNavigate}
        pathname={pathname}
      />
    );
  }

  const isActive = isActiveRoute(pathname, item.href);
  return (
    <li>
      <Link
        aria-label={item.label}
        data-tooltip={item.label}
        aria-current={isActive ? "page" : undefined}
        className={`nav-link${isActive ? " active" : ""}`}
        href={item.href}
        onClick={onNavigate}
        title={item.label}
      >
        <Icon
          aria-hidden="true"
          className="nav-icon"
          size={18}
          strokeWidth={2}
        />
        <span className="nav-link-label">{item.label}</span>
        {item.badgeKey === "jobs" ? (
          <JobNavigationStatus
            failedCount={badgeCount ?? 0}
            runningCount={runningJobs}
          />
        ) : (
          badgeCount !== undefined && (
            <NavigationBadge count={badgeCount} itemLabel={item.label} />
          )
        )}
      </Link>
    </li>
  );
}

function MailNavigationGroup({
  badgeCount,
  item,
  onNavigate,
  pathname,
}: {
  badgeCount?: number;
  item: NavigationItem;
  onNavigate: () => void;
  pathname: string;
}) {
  const isActive =
    item.children?.some((child) => isActiveRoute(pathname, child.href)) ??
    false;
  const [expanded, setExpanded] = useState(isActive);
  const Icon = item.icon;
  const childrenId = `${item.id}-navigation`;

  return (
    <li className="nav-group">
      <button
        aria-label={item.label}
        aria-controls={childrenId}
        aria-expanded={expanded}
        className={`nav-link nav-group-toggle${isActive ? " is-parent-active" : ""}`}
        onClick={() => setExpanded((current) => !current)}
        data-tooltip={item.label}
        title={item.label}
        type="button"
      >
        <Icon
          aria-hidden="true"
          className="nav-icon"
          size={18}
          strokeWidth={2}
        />
        <span className="nav-link-label">{item.label}</span>
        {badgeCount !== undefined && (
          <NavigationBadge count={badgeCount} itemLabel={item.label} />
        )}
        <ChevronDown
          aria-hidden="true"
          className={`nav-group-chevron${expanded ? " is-expanded" : ""}`}
          size={16}
          strokeWidth={2}
        />
      </button>
      <ul className="nav-group-children" hidden={!expanded} id={childrenId}>
        {item.children?.map((child) => {
          const ChildIcon = child.icon;
          const childIsActive = isActiveRoute(pathname, child.href);
          return (
            <li key={child.id}>
              <Link
                aria-label={child.label}
                data-tooltip={child.label}
                aria-current={childIsActive ? "page" : undefined}
                className={`nav-link${childIsActive ? " active" : ""}`}
                href={child.href}
                onClick={onNavigate}
                title={child.label}
              >
                <ChildIcon
                  aria-hidden="true"
                  className="nav-icon"
                  size={18}
                  strokeWidth={2}
                />
                <span className="nav-link-label">{child.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

function NavigationBadge({
  count,
  itemLabel,
}: {
  count: number;
  itemLabel: string;
}) {
  if (count < 1) return null;

  const badgeLabel =
    itemLabel === "Lead pipeline"
      ? "leads needing review"
      : itemLabel.toLowerCase();
  // TODO: Move actionable counts to an aggregated API endpoint when available.
  return (
    <span
      aria-label={`${count} ${badgeLabel}`}
      className="nav-count"
      role="img"
      title={`${count} ${badgeLabel}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function JobNavigationStatus({
  failedCount,
  runningCount,
}: {
  failedCount: number;
  runningCount: number;
}) {
  if (failedCount === 0 && runningCount === 0) return null;

  return (
    <span className="nav-job-status">
      {runningCount > 0 && (
        <span
          aria-label={`${runningCount} jobs running`}
          className="nav-job-running"
          role="img"
        >
          <LoaderCircle aria-hidden="true" size={17} strokeWidth={2} />
        </span>
      )}
      {failedCount > 0 && (
        <span
          aria-label={`${failedCount} failed jobs`}
          className="nav-count nav-count-error"
          role="img"
          title={`${failedCount} failed jobs`}
        >
          {failedCount > 99 ? "99+" : failedCount}
        </span>
      )}
    </span>
  );
}

function isActiveRoute(location: string, href: string) {
  const currentUrl = new URL(location, "http://lead-intelligence.local");
  const targetUrl = new URL(href, "http://lead-intelligence.local");
  if (targetUrl.searchParams.size > 0) {
    for (const [key, value] of targetUrl.searchParams) {
      if (currentUrl.searchParams.get(key) !== value) return false;
    }
  }
  if (currentUrl.pathname === targetUrl.pathname) {
    if (targetUrl.searchParams.size > 0) return true;
    const querySpecificRouteIsActive = navigationSections.some((section) =>
      section.items.some((item) =>
        [item, ...(item.children ?? [])].some((candidate) => {
          const candidateUrl = new URL(
            candidate.href,
            "http://lead-intelligence.local",
          );
          return (
            candidateUrl.pathname === currentUrl.pathname &&
            candidateUrl.searchParams.size > 0 &&
            [...candidateUrl.searchParams].every(
              ([key, value]) => currentUrl.searchParams.get(key) === value,
            )
          );
        }),
      ),
    );
    return !querySpecificRouteIsActive;
  }
  if (
    targetUrl.pathname === "/" ||
    !currentUrl.pathname.startsWith(`${targetUrl.pathname}/`)
  ) {
    return false;
  }

  const moreSpecificRouteIsActive = navigationSections.some((section) =>
    section.items.some((item) =>
      [item, ...(item.children ?? [])].some((candidate) => {
        const candidateUrl = new URL(
          candidate.href,
          "http://lead-intelligence.local",
        );
        return (
          candidateUrl.pathname.startsWith(`${targetUrl.pathname}/`) &&
          (currentUrl.pathname === candidateUrl.pathname ||
            currentUrl.pathname.startsWith(`${candidateUrl.pathname}/`)) &&
          [...candidateUrl.searchParams].every(
            ([key, value]) => currentUrl.searchParams.get(key) === value,
          )
        );
      }),
    ),
  );
  return !moreSpecificRouteIsActive;
}

function AccountMenu({
  email,
  logoutPending,
  onLogout,
  onNavigate,
  onThemeChange,
  organizationName,
  role,
  themePreference,
}: {
  email: string;
  logoutPending: boolean;
  onLogout: () => void;
  onNavigate: () => void;
  onThemeChange: (preference: ThemePreference) => void;
  organizationName: string;
  role: NavigationRole;
  themePreference: ThemePreference;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const initials = getAccountInitials(email);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function closeMenu() {
    setIsOpen(false);
    onNavigate();
  }

  return (
    <div className="sidebar-account">
      <button
        aria-label={`${email}, ${organizationName}`}
        aria-controls="account-popover"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="account-trigger"
        onClick={() => setIsOpen((open) => !open)}
        ref={triggerRef}
        title={email}
        type="button"
      >
        <span aria-hidden="true" className="avatar account-avatar">
          {initials}
        </span>
        <span className="account-trigger-copy">
          <span className="account-trigger-email">{email}</span>
          <span className="account-trigger-organization">
            {organizationName}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`account-trigger-chevron${isOpen ? " is-open" : ""}`}
          size={16}
          strokeWidth={2}
        />
      </button>
      {isOpen && (
        <div
          aria-label="Account menu"
          className="account-popover"
          id="account-popover"
          ref={popoverRef}
          role="dialog"
        >
          <div className="account-popover-identity">
            <strong>{email}</strong>
            <span>{role === "admin" ? "Administrator" : "Member"}</span>
          </div>
          <fieldset className="account-theme-options">
            <legend>Theme</legend>
            <div className="account-theme-buttons">
              <ThemeOption
                icon={Sun}
                label="Light"
                onSelect={() => onThemeChange("light")}
                selected={themePreference === "light"}
              />
              <ThemeOption
                icon={Moon}
                label="Dark"
                onSelect={() => onThemeChange("dark")}
                selected={themePreference === "dark"}
              />
              <ThemeOption
                icon={Monitor}
                label="System"
                onSelect={() => onThemeChange("system")}
                selected={themePreference === "system"}
              />
            </div>
          </fieldset>
          <Link
            className="account-menu-link"
            href="/settings"
            onClick={closeMenu}
          >
            <Settings aria-hidden="true" size={18} strokeWidth={2} />
            Settings
          </Link>
          <div aria-hidden="true" className="account-menu-divider" />
          <button
            className="account-sign-out"
            disabled={logoutPending}
            onClick={() => {
              closeMenu();
              onLogout();
            }}
            type="button"
          >
            <LogOut aria-hidden="true" size={18} strokeWidth={2} />
            {logoutPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

function ThemeOption({
  icon: Icon,
  label,
  onSelect,
  selected,
}: {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <button
      aria-pressed={selected}
      className={`account-theme-option${selected ? " is-selected" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <Icon aria-hidden="true" size={16} strokeWidth={2} />
      {label}
    </button>
  );
}

function getAccountInitials(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const words = localPart.split(/[._-]+/).filter(Boolean);
  const initials = words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("");
  return (initials || localPart.slice(0, 2) || "?").toUpperCase();
}

function PublicAuthChecking() {
  return (
    <main className="public-auth-checking" role="status">
      <span aria-hidden="true" className="auth-spinner" />
      Checking your session…
    </main>
  );
}

function WorkspaceSessionLoading() {
  const skeletonItems = navigationSections.flatMap((section) =>
    section.items.flatMap((item) => item.children ?? [item]),
  );

  return (
    <div
      aria-busy="true"
      aria-label="Loading workspace"
      className="app-shell workspace-session-loading"
      role="status"
    >
      <span className="sr-only">Loading workspace</span>
      <aside aria-hidden="true" className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <BrandMark />
            <span>
              <strong>ProspectLoop</strong>
              <small>BUSINESS INTELLIGENCE</small>
            </span>
          </div>
          <span className="workspace-skeleton-mobile-action" />
          <span className="workspace-skeleton-mobile-action" />
        </div>
        <nav
          aria-label="Primary"
          className="sidebar-navigation workspace-skeleton-nav"
        >
          <ul className="nav-sections">
            {skeletonItems.map((item, index) => (
              <li className="workspace-skeleton-nav-row" key={item.id}>
                <span className="workspace-skeleton-block workspace-skeleton-icon" />
                <span
                  className={`workspace-skeleton-block workspace-skeleton-nav-label skeleton-width-${index % 3}`}
                />
              </li>
            ))}
          </ul>
        </nav>
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
