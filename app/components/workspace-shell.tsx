"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Monitor,
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
  type ReactNode,
} from "react";
import {
  ApiError,
  getAuthSession,
  getCompanies,
  logout,
  type Company,
} from "@/lib/api";
import {
  navigationSections,
  type NavigationItem,
  type NavigationRole,
} from "./nav.config";

const noCompanies: Company[] = [];
type ThemePreference = "light" | "dark" | "system";

function subscribeToTheme(onChange: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", onChange);
  window.addEventListener("lead-intelligence-theme-change", onChange);
  mediaQuery.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("lead-intelligence-theme-change", onChange);
    mediaQuery.removeEventListener("change", onChange);
  };
}

function getThemePreferenceSnapshot(): ThemePreference {
  const savedTheme = window.localStorage.getItem("lead-intelligence-theme");
  return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "system";
}

function getThemeSnapshot() {
  const preference = getThemePreferenceSnapshot();
  return (
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

function persistThemePreference(preference: ThemePreference) {
  if (preference === "system") {
    window.localStorage.removeItem("lead-intelligence-theme");
  } else {
    window.localStorage.setItem("lead-intelligence-theme", preference);
  }
  window.dispatchEvent(new Event("lead-intelligence-theme-change"));
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isPublicAuthPage = pathname === "/login" || pathname === "/signup";
  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession,
    enabled: !isPublicAuthPage,
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
  const sessionIsUnauthorized =
    sessionQuery.error instanceof ApiError &&
    sessionQuery.error.status === 401;

  useEffect(() => {
    document.documentElement.dataset.theme = isDarkMode ? "dark" : "light";
    document.documentElement.style.colorScheme = isDarkMode ? "dark" : "light";
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
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className={`sidebar${mobileMenuOpen ? " is-open" : ""}`}>
        <div className="sidebar-header">
          <Link className="brand" href="/" aria-label="Lead Intelligence home">
            <span className="brand-mark">BI</span>
            <span>
              <strong>Lead Intelligence</strong>
              <small>BUSINESS WORKSPACE</small>
            </span>
          </Link>
          <button
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            aria-controls="primary-navigation"
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen((open) => !open)}
            type="button"
          >
            {mobileMenuOpen ? (
              <X aria-hidden="true" size={18} strokeWidth={2} />
            ) : (
              <Menu aria-hidden="true" size={18} strokeWidth={2} />
            )}
            <span>{mobileMenuOpen ? "Close" : "Menu"}</span>
          </button>
        </div>
        <nav
          aria-label="Primary"
          className="sidebar-navigation"
          id="primary-navigation"
        >
          <Suspense fallback={<div className="sidebar-nav-loading" />}>
            <WorkspaceNavigation
              companyCount={companies.length}
              leadCount={leadCount}
              key={pathname}
              onNavigate={() => setMobileMenuOpen(false)}
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
  onNavigate,
  role,
}: {
  companyCount: number;
  leadCount: number;
  onNavigate: () => void;
  role: NavigationRole;
}) {
  const pathname = usePathname();
  const badgeCounts = { companies: companyCount, leads: leadCount };
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
}: {
  badgeCount?: number;
  item: NavigationItem;
  onNavigate: () => void;
  pathname: string;
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
        aria-current={isActive ? "page" : undefined}
        className={`nav-link${isActive ? " active" : ""}`}
        href={item.href}
        onClick={onNavigate}
      >
        <Icon aria-hidden="true" className="nav-icon" size={18} strokeWidth={2} />
        <span className="nav-link-label">{item.label}</span>
        {badgeCount !== undefined && (
          <NavigationBadge count={badgeCount} itemLabel={item.label} />
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
  const isActive = item.children?.some((child) =>
    isActiveRoute(pathname, child.href),
  ) ?? false;
  const [expanded, setExpanded] = useState(isActive);
  const Icon = item.icon;
  const childrenId = `${item.id}-navigation`;

  return (
    <li className="nav-group">
      <button
        aria-controls={childrenId}
        aria-expanded={expanded}
        className={`nav-link nav-group-toggle${isActive ? " is-parent-active" : ""}`}
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <Icon aria-hidden="true" className="nav-icon" size={18} strokeWidth={2} />
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
      <ul
        className="nav-group-children"
        hidden={!expanded}
        id={childrenId}
      >
        {item.children?.map((child) => {
          const ChildIcon = child.icon;
          const childIsActive = isActiveRoute(pathname, child.href);
          return (
            <li key={child.id}>
              <Link
                aria-current={childIsActive ? "page" : undefined}
                className={`nav-link${childIsActive ? " active" : ""}`}
                href={child.href}
                onClick={onNavigate}
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

  const pluralLabel = itemLabel === "Companies" ? "companies" : "leads";
  // TODO(Phase 2): Replace entity totals with actionable "needs attention" counts.
  return (
    <span
      aria-label={`${count} ${pluralLabel}`}
      className="nav-count"
      title={`${count} ${pluralLabel}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function isActiveRoute(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/" || !pathname.startsWith(`${href}/`)) return false;

  const moreSpecificRouteIsActive = navigationSections.some((section) =>
    section.items.some((item) =>
      [item, ...(item.children ?? [])].some(
        (candidate) =>
          candidate.href.startsWith(`${href}/`) &&
          (pathname === candidate.href ||
            pathname.startsWith(`${candidate.href}/`)),
      ),
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
        aria-controls="account-popover"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="account-trigger"
        onClick={() => setIsOpen((open) => !open)}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true" className="avatar account-avatar">
          {initials}
        </span>
        <span className="account-trigger-copy">
          <span className="account-trigger-email">{email}</span>
          <span className="account-trigger-organization">{organizationName}</span>
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
          <Link className="account-menu-link" href="/settings" onClick={closeMenu}>
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
            <span className="brand-mark">BI</span>
            <span>
              <strong>Lead Intelligence</strong>
              <small>BUSINESS WORKSPACE</small>
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
