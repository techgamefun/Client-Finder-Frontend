import { Suspense } from "react";
import { CompanyDetailPage } from "../../components/company-detail-page";

export default function CompanyRoute({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <section className="company-detail-state" aria-live="polite">
          <strong>Loading company record…</strong>
        </section>
      }
    >
      <CompanyRouteContent params={params} />
    </Suspense>
  );
}

async function CompanyRouteContent({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  return <CompanyDetailPage companyId={companyId} />;
}
