import { Suspense } from "react";
import { LeadsPage } from "../components/leads-page";
import { PageLoading } from "../components/page-loading";

export default function CompaniesRoute() {
  return (
    <Suspense
      fallback={<PageLoading label="Loading companies" variant="table" />}
    >
      <LeadsPage view="companies" />
    </Suspense>
  );
}
