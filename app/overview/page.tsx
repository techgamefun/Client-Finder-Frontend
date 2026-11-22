import { Suspense } from "react";
import { OverviewPage } from "../components/overview-page";
import { PageLoading } from "../components/page-loading";

export default function PersonalOverview() {
  return (
    <Suspense
      fallback={<PageLoading label="Loading overview" variant="overview" />}
    >
      <OverviewPage />
    </Suspense>
  );
}
