import type { MetadataRoute } from "next";
import { SITE_ORIGIN, siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_ORIGIN, priority: 1 },
    { url: siteUrl("/about"), priority: 0.8 },
    { url: siteUrl("/contact"), priority: 0.7 },
    { url: siteUrl("/privacy-policy"), priority: 0.4 },
    { url: siteUrl("/terms"), priority: 0.4 },
  ];
}
