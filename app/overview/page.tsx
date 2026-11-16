import { Suspense } from "react";
import { OverviewPage } from "../components/overview-page";

export default function PersonalOverview() {
  return (
    <Suspense
      fallback={<div aria-busy="true" className="overview-page-loading" />}
    >
      <OverviewPage />
    </Suspense>
  );
}
