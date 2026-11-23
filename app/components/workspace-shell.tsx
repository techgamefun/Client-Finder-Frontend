"use client";

import Link from "next/link";
import Image from "next/image";
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
  getCompanyNavigationSummary,
  getCompanies,
  getPageSpeedJobSummary,
  getWebsiteRegistryPage,
  getWebsiteCrawlJobSummary,
  logout,
  selectOrganization,
  type Company,
  type OrganizationOption,
  type WebsiteRegistryPageParams,
  websiteRegistryPageQueryKey,
} from "@/lib/api";
import {
  getThemePreferenceSnapshot,
  subscribeToTheme,
  type ThemePreference,
} from "@/lib/theme";
import { useUserPreferences } from "@/lib/user-preferences";
import {
  navigationSections,
  type NavigationItem,
  type NavigationRole,
} from "./nav.config";
import { BrandMark } from "./brand-mark";
import { PageLoading, type PageLoadingVariant } from "./page-loading";
import { useToast } from "./toast-provider";

const noCompanies: Company[] = [];
const initialWebsiteRegistryParams: WebsiteRegistryPageParams = {
  limit: 25,
  offset: 0,
  search: "",
};

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const currentLocation = `${pathname}${search ? `?${search}` : ""}`;
  const router = useRouter();
  const queryClient = useQueryClient();
  const showToast = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  const userPreferences = useUserPreferences(
    isPublicPage ? undefined : sessionQuery.data?.user.id,
  );
  useQuery({
    queryKey: websiteRegistryPageQueryKey(initialWebsiteRegistryParams),
    queryFn: () => getWebsiteRegistryPage(initialWebsiteRegistryParams),
    enabled: pathname === "/websites",
    staleTime: 60_000,
    retry: false,
  });
  const saveUserPreferences = userPreferences.save;
  const sidebarCollapsed =
    userPreferences.data?.sidebar_collapsed ?? false;
  const themePreference = useSyncExternalStore(
    subscribeToTheme,
    getThemePreferenceSnapshot,
    (): ThemePreference => "system",
  );
  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
    enabled:
      !isPublicPage &&
      commandPaletteOpen &&
      sessionQuery.data !== undefined,
    staleTime: 120_000,
  });
  const companyNavigationSummaryQuery = useQuery({
    queryKey: ["companies", "navigation-summary"],
    queryFn: getCompanyNavigationSummary,
    enabled: !isPublicPage && sessionQuery.data !== undefined,
    staleTime: 60_000,
    retry: false,
  });
  const crawlerJobSummaryQuery = useQuery({
    queryKey: ["crawler", "queue-summary"],
    queryFn: getWebsiteCrawlJobSummary,
    enabled: !isPublicPage && sessionQuery.data !== undefined,
    staleTime: 60_000,
    retry: false,
  });
  const pageSpeedJobSummaryQuery = useQuery({
    queryKey: ["pagespeed", "queue-summary"],
    queryFn: getPageSpeedJobSummary,
    enabled: !isPublicPage && sessionQuery.data !== undefined,
    staleTime: 60_000,
    retry: false,
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
  const organizationMutation = useMutation({
    mutationFn: selectOrganization,
    onSuccess: async (session) => {
      await queryClient.cancelQueries();
      queryClient.clear();
      queryClient.setQueryData(["auth-session"], session);
    },
    onError: (error: Error) => {
      showToast({
        type: "error",
        title: "Could not switch organization",
        message: error.message,
      });
    },
  });
  const companies = companiesQuery.data ?? noCompanies;
  const leadsNeedingReview =
    companyNavigationSummaryQuery.data?.leads_needing_review ?? 0;
  const runningJobs =
    (crawlerJobSummaryQuery.data?.running_count ?? 0) +
    (pageSpeedJobSummaryQuery.data?.running_count ?? 0);
  const failedJobs =
    (crawlerJobSummaryQuery.data?.failed_count ?? 0) +
    (pageSpeedJobSummaryQuery.data?.failed_count ?? 0);
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
          saveUserPreferences({
            sidebar_collapsed: !sidebarCollapsed,
          });
        }
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [saveUserPreferences, sidebarCollapsed]);

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
    if (!userPreferences.isError) return;
    showToast({
      type: "error",
      title: "Could not load preferences",
      message: userPreferences.error.message,
    });
  }, [showToast, userPreferences.error, userPreferences.isError]);

  useEffect(() => {
    if (
      isPublicAuthPage &&
      sessionQuery.data &&
      !sessionIsUnauthorized &&
      !sessionQuery.isFetching
    ) {
      router.replace(
        sessionQuery.data.user.role === "admin"
          ? "/organization/dashboard"
          : "/overview",
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
  if (
    sessionQuery.isLoading ||
    (!sessionQuery.data && !sessionQuery.isError)
  ) {
    return <WorkspaceLoadingScreen pathname={pathname} />;
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
              sessionQuery.data.user.role === "admin"
                ? "/organization/dashboard"
                : "/overview"
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
            onClick={() =>
              saveUserPreferences({
                sidebar_collapsed: !sidebarCollapsed,
              })
            }
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
          activeOrganizationId={sessionQuery.data.organization_id}
          organizations={sessionQuery.data.organizations}
          organizationSwitchPending={organizationMutation.isPending}
          profilePhotoUrl={sessionQuery.data.user.profile_photo_url}
          logoutPending={logoutMutation.isPending}
          onLogout={() => logoutMutation.mutate()}
          onOrganizationChange={(organizationId) =>
            organizationMutation.mutate(organizationId)
          }
          onNavigate={() => setMobileMenuOpen(false)}
          onThemeChange={(preference) => {
            saveUserPreferences({ theme: preference });
          }}
          organizationLogoUrl={sessionQuery.data.organization_logo_url}
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
  if (pathname === "/organization/dashboard") {
    return [
      { label: "Organization", href: "/organization" },
      { label: "Dashboard" },
    ];
  }
  if (pathname === "/admin") {
    return [{ label: "Organization dashboard" }];
  }
  if (pathname === "/organization") {
    return [{ label: "Organization" }];
  }
  if (pathname === "/organization/settings") {
    return [
      { label: "Organization", href: "/organization" },
      { label: "Settings" },
    ];
  }
  if (pathname === "/organization/members") {
    return [
      { label: "Organization", href: "/organization" },
      { label: "Members" },
    ];
  }
  if (/^\/organization\/members\/[^/]+$/.test(pathname)) {
    return [
      { label: "Organization", href: "/organization" },
      { label: "Member activity" },
    ];
  }
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
          label: "Organization",
          href: "/organization",
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
  "/excluded-domains",
  "/gmail",
  "/companies",
  "/jobs",
  "/jobs/import",
  "/leads",
  "/login",
  "/overview",
  "/organization",
  "/organization/dashboard",
  "/organization/members",
  "/organization/settings",
  "/pagespeed-queue",
  "/settings",
  "/signup",
  "/templates",
  "/website-analytics",
  "/websites",
]);

function isKnownWorkspaceRoute(pathname: string) {
  return (
    workspaceRoutes.has(pathname) ||
    /^\/organization\/members\/[^/]+$/.test(pathname) ||
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
  activeOrganizationId,
  email,
  logoutPending,
  onLogout,
  onOrganizationChange,
  onNavigate,
  onThemeChange,
  organizations,
  organizationLogoUrl,
  organizationName,
  organizationSwitchPending,
  profilePhotoUrl,
  role,
  themePreference,
}: {
  activeOrganizationId: string;
  email: string;
  logoutPending: boolean;
  onLogout: () => void;
  onOrganizationChange: (organizationId: string) => void;
  onNavigate: () => void;
  onThemeChange: (preference: ThemePreference) => void;
  organizations: OrganizationOption[];
  organizationLogoUrl: string | null;
  organizationName: string;
  organizationSwitchPending: boolean;
  profilePhotoUrl: string | null;
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
          {profilePhotoUrl ? (
            <Image
              alt=""
              height={34}
              src={profilePhotoUrl}
              unoptimized
              width={34}
            />
          ) : (
            initials
          )}
        </span>
        <span className="account-trigger-copy">
          <span className="account-trigger-email">{email}</span>
          <span className="account-trigger-organization">
            {organizationLogoUrl ? (
              <Image
                alt=""
                height={14}
                src={organizationLogoUrl}
                unoptimized
                width={14}
              />
            ) : (
              <Building2 aria-hidden="true" size={12} />
            )}
            <span className="account-trigger-organization-name">
              {organizationName}
            </span>
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
          {organizations.length > 1 && (
            <label className="account-organization-switch">
              <span>Organization</span>
              <select
                disabled={organizationSwitchPending}
                onChange={(event) =>
                  onOrganizationChange(event.target.value)
                }
                value={activeOrganizationId}
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name} ·{" "}
                    {organization.role === "admin" ? "Admin" : "Member"}
                  </option>
                ))}
              </select>
            </label>
          )}
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

export function WorkspaceLoadingScreen({
  pathname = "/",
}: {
  pathname?: string;
}) {
  const loadingVariant = getPageLoadingVariant(pathname);
  const isMailRoute =
    pathname === "/gmail" ||
    pathname === "/templates" ||
    pathname === "/campaigns";
  const primarySections = navigationSections.filter((section) => !section.bottom);
  const bottomSections = navigationSections.filter((section) => section.bottom);

  function renderLoadingNavigation(section: (typeof navigationSections)[number]) {
    const items = section.items.flatMap((item) =>
      item.children && isMailRoute ? [item, ...item.children] : [item],
    );
    return (
      <li className="nav-section" key={section.id}>
        {section.label && <div className="sidebar-label">{section.label}</div>}
        <ul className="nav-section-items">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveRoute(pathname, item.href);
            return (
              <li key={item.id}>
                <span
                  aria-current={isActive ? "page" : undefined}
                  className={`nav-link${isActive ? " active" : ""}`}
                >
                  <Icon
                    aria-hidden="true"
                    className="nav-icon"
                    size={18}
                    strokeWidth={2}
                  />
                  <span className="nav-link-label">{item.label}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </li>
    );
  }

  return (
    <div
      aria-busy="true"
      className="app-shell workspace-session-loading"
    >
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
        <nav aria-label="Primary" className="sidebar-navigation">
          <ul className="nav-sections">
            {primarySections.map(renderLoadingNavigation)}
          </ul>
          {bottomSections.map((section) => (
            <ul className="nav-bottom" key={section.id}>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <span className="nav-link">
                      <Icon
                        aria-hidden="true"
                        className="nav-icon"
                        size={18}
                        strokeWidth={2}
                      />
                      <span className="nav-link-label">{item.label}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ))}
        </nav>
        <div className="workspace-skeleton-account">
          <span className="workspace-skeleton-block workspace-skeleton-account-avatar" />
          <span className="workspace-skeleton-block workspace-skeleton-line skeleton-width-1" />
          <span className="workspace-skeleton-block workspace-skeleton-line skeleton-width-2" />
        </div>
      </aside>
      <main className="main-content">
        <div aria-hidden="true" className="workspace-skeleton-topbar">
          <span className="workspace-skeleton-mobile-action" />
          <span className="workspace-skeleton-block workspace-skeleton-line skeleton-width-1" />
          <span className="workspace-skeleton-block workspace-skeleton-mobile-action" />
        </div>
        <div
          className={
            pathname === "/websites"
              ? "content-wrap is-websites-page"
              : "content-wrap"
          }
        >
          <PageLoading
            label={`Loading ${getPageLoadingLabel(pathname)}`}
            variant={loadingVariant}
          />
        </div>
      </main>
    </div>
  );
}

function getPageLoadingLabel(pathname: string) {
  if (pathname === "/organization/dashboard" || pathname === "/admin") {
    return "organization dashboard";
  }
  if (pathname.startsWith("/organization/members/")) return "member activity";
  if (pathname === "/organization/members") return "organization members";
  if (pathname === "/organization/settings") return "organization settings";
  if (pathname === "/organization") return "organization";
  if (pathname === "/overview") return "overview";
  if (pathname === "/website-analytics") return "website analytics";
  if (pathname.startsWith("/company/")) return "company details";
  if (pathname.startsWith("/websites/")) return "website details";
  if (pathname === "/websites") return "websites";
  if (pathname === "/jobs" || pathname.includes("queue")) return "job queue";
  if (pathname === "/settings") return "settings";
  if (pathname === "/leads") return "leads";
  if (pathname === "/companies") return "companies";
  if (pathname === "/campaigns") return "campaigns";
  if (pathname === "/gmail") return "Gmail";
  if (pathname === "/discovery") return "discovery";
  if (pathname === "/excluded-domains") return "excluded domains";
  if (pathname === "/templates") return "email templates";
  return "workspace";
}

function getPageLoadingVariant(pathname: string): PageLoadingVariant {
  if (
    pathname === "/organization/dashboard" ||
    pathname === "/admin"
  ) {
    return "dashboard";
  }
  if (pathname === "/overview") return "overview";
  if (pathname === "/website-analytics") return "website-analytics";
  if (pathname === "/organization") return "organization";
  if (pathname === "/organization/settings") {
    return "organization-settings";
  }
  if (pathname === "/settings") {
    return "settings";
  }
  if (pathname === "/organization/members") return "members";
  if (/^\/organization\/members\/[^/]+$/.test(pathname)) return "activity";
  if (
    pathname.startsWith("/company/") ||
    /^\/websites\/[^/]+$/.test(pathname)
  ) {
    return "detail";
  }
  if (
    pathname === "/jobs" ||
    pathname === "/crawler/queue" ||
    pathname === "/pagespeed-queue" ||
    pathname === "/campaigns" ||
    pathname === "/gmail" ||
    pathname === "/discovery" ||
    pathname === "/excluded-domains" ||
    pathname === "/templates"
  ) {
    return "table";
  }
  if (pathname === "/websites") return "websites";
  if (pathname === "/leads") return "leads";
  if (pathname === "/companies") return "companies";
  return "generic";
}
