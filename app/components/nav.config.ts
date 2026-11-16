import {
  Building2,
  Compass,
  FileText,
  Gauge,
  Globe,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Mail,
  Megaphone,
  ScanSearch,
  Settings,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type NavigationRole = "admin" | "user";
export type NavigationBadgeKey = "companies" | "leads";

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: NavigationBadgeKey;
  role?: NavigationRole;
  children?: NavigationItem[];
}

export interface NavigationSection {
  id: string;
  label?: string;
  bottom?: boolean;
  items: NavigationItem[];
}

export const navigationSections: NavigationSection[] = [
  {
    id: "overview",
    items: [
      {
        id: "overview",
        label: "Overview",
        href: "/",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: "find",
    label: "Find",
    items: [
      {
        id: "discover",
        label: "Discover",
        href: "/discovery",
        icon: Compass,
      },
      {
        id: "websites",
        label: "Websites",
        href: "/websites",
        icon: Globe,
      },
      {
        id: "crawl",
        label: "Crawl a website",
        href: "/crawler",
        icon: ScanSearch,
      },
    ],
  },
  {
    id: "leads",
    label: "Leads",
    items: [
      {
        id: "companies",
        label: "Companies",
        href: "/companies",
        icon: Building2,
        badgeKey: "companies",
      },
      {
        id: "lead-pipeline",
        label: "Lead pipeline",
        href: "/leads",
        icon: UsersRound,
        badgeKey: "leads",
      },
    ],
  },
  {
    id: "outreach",
    label: "Outreach",
    items: [
      {
        id: "mail",
        label: "Mail",
        href: "/gmail",
        icon: Mail,
        children: [
          {
            id: "inbox",
            label: "Inbox",
            href: "/gmail",
            icon: Inbox,
          },
          {
            id: "templates",
            label: "Templates",
            href: "/templates",
            icon: FileText,
          },
          {
            id: "campaigns",
            label: "Campaigns",
            href: "/campaigns",
            icon: Megaphone,
          },
        ],
      },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    items: [
      {
        id: "crawler-queue",
        label: "Crawler queue",
        href: "/crawler/queue",
        icon: ListChecks,
      },
      {
        id: "pagespeed-queue",
        label: "PageSpeed queue",
        href: "/pagespeed-queue",
        icon: Gauge,
      },
    ],
  },
  {
    id: "settings",
    bottom: true,
    items: [
      {
        id: "settings",
        label: "Settings",
        href: "/settings",
        icon: Settings,
      },
    ],
  },
];
