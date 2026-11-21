import { Suspense } from "react";
import { LeadsPage } from "../components/leads-page";
import { PageLoading } from "../components/page-loading";

export default function LeadsRoute() {
  return (
    <Suspense fallback={<PageLoading label="Loading leads" variant="table" />}>
      <LeadsPage />
    </Suspense>
  );
}
