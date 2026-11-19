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
        "/pagespeed-queue",
        "/settings",
        "/signup",
        "/templates",
        "/unsubscribe",
        "/websites",
        "/api/",
      ],
    },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
