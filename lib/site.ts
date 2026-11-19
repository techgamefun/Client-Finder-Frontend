export const SITE_NAME = "ProspectLoop";
export const SITE_ORIGIN = "https://prospectloop.com";
export const PUBLIC_CONTACT_EMAIL = "samparkerworld@gmail.com";
export const PUBLIC_LOCATION = "Kolkata, West Bengal, India";

export const PUBLIC_PAGE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy-policy", label: "Privacy policy" },
  { href: "/terms", label: "Terms" },
] as const;

export function siteUrl(path: string): string {
  return new URL(path, SITE_ORIGIN).toString();
}
