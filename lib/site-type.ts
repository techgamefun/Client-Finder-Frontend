const siteTypeLabels: Record<string, string> = {
  academic_research_preprints: "Academic research",
  automotive_vehicle_marketplaces: "Automotive marketplace",
  crowdfunding_investor_portals: "Crowdfunding and investor portal",
  directories_listings: "Directory or listings",
  documentation_knowledge_base: "Documentation or knowledge base",
  ecommerce_retail: "E-commerce and retail",
  event_ticketing_platforms: "Event ticketing",
  food_restaurant_menus: "Food and restaurant",
  forums_communities: "Forum or community",
  generic: "Generic",
  government_public_sector: "Government and public sector",
  healthcare_medical_portals: "Healthcare and medical",
  help_centers_support_portals: "Help center or support",
  job_boards_career_portals: "Jobs and careers",
  legal_regulatory_compliance: "Legal and regulatory",
  media_video_podcast_hubs: "Media, video, or podcast",
  news_editorial: "News and editorial",
  real_estate_property_portals: "Real estate",
  saas_corporate_marketing: "SaaS or corporate",
  software_downloads_app_catalogs: "Software catalog",
  travel_hospitality_booking: "Travel and hospitality",
};

export function formatSiteType(siteType: string | null): string {
  if (!siteType) return "Unclassified";

  return (
    siteTypeLabels[siteType] ??
    siteType
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}
