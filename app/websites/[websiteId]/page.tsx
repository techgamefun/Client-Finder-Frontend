import { Suspense } from "react";
import { WebsiteDetailPage } from "../../components/website-detail-page";

export default function WebsiteRoute({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <section className="company-detail-state" aria-live="polite">
          <strong>Loading website record…</strong>
        </section>
      }
    >
      <WebsiteRouteContent params={params} />
    </Suspense>
  );
}

async function WebsiteRouteContent({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  return <WebsiteDetailPage websiteId={websiteId} />;
}
