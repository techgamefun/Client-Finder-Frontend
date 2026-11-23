import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/campaigns",
        "/companies",
        "/company/",
        "/crawler",
        "/discovery",
        "/gmail",
        "/jobs",
        "/leads",
        "/login",
        "/overview",
        "/organization/dashboard",
        "/pagespeed-queue",
        "/settings",
        "/signup",
        "/templates",
        "/unsubscribe",
        "/website-analytics",
        "/websites",
        "/api/",
      ],
    },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
