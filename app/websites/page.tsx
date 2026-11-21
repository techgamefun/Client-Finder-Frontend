import { Suspense } from "react";
import { WebsitesPage } from "../components/websites-page";
import { PageLoading } from "../components/page-loading";

export default function WebsitesRoute() {
  return (
    <Suspense
      fallback={<PageLoading label="Loading websites" variant="table" />}
    >
      <WebsitesPage />
    </Suspense>
  );
}
