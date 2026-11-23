import {
  Building2,
  BarChart3,
  CircleOff,
  Compass,
  FileText,
  Globe,
  Inbox,
  LayoutDashboard,
  Mail,
  Megaphone,
  Settings,
  UsersRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type NavigationRole = "admin" | "user";
export type NavigationBadgeKey = "leads" | "jobs";

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
    id: "administration",
    label: "Administration",
    items: [
      {
        id: "organization-dashboard",
        label: "Organization dashboard",
        href: "/organization/dashboard",
        icon: LayoutDashboard,
        role: "admin",
      },
      {
        id: "organization",
        label: "Organization",
        href: "/organization",
        icon: Building2,
        role: "admin",
      },
    ],
  },
  {
    id: "overview",
    items: [
      {
        id: "overview",
        label: "Overview",
        href: "/overview",
        icon: LayoutDashboard,
        role: "user",
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
        id: "website-analytics",
        label: "Website analytics",
        href: "/website-analytics",
        icon: BarChart3,
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
        id: "jobs",
        label: "Jobs",
        href: "/jobs",
        icon: Workflow,
        badgeKey: "jobs",
      },
      {
        id: "excluded-domains",
        label: "Excluded domains",
        href: "/excluded-domains",
        icon: CircleOff,
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
