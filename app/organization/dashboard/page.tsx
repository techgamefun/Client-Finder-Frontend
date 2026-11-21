import { Suspense } from "react";
import { OverviewPage } from "../../components/overview-page";
import { PageLoading } from "../../components/page-loading";

export default function OrganizationDashboardRoute() {
  return (
    <Suspense
      fallback={
        <PageLoading
          label="Loading organization dashboard"
          variant="dashboard"
        />
      }
    >
      <OverviewPage adminDashboard />
    </Suspense>
  );
}
