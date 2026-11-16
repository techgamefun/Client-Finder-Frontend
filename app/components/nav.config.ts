import {
  Building2,
  Compass,
  FileText,
  Globe,
  Inbox,
  LayoutDashboard,
  Mail,
  Megaphone,
  Settings,
  ShieldCheck,
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
    ],
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      {
        id: "admin-dashboard",
        label: "Admin dashboard",
        href: "/admin",
        icon: ShieldCheck,
        role: "admin",
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
      {
        id: "organization-users",
        label: "Organization users",
        href: "/settings?section=organization",
        icon: UsersRound,
        role: "admin",
      },
    ],
  },
];
