import { Suspense } from "react";
import { OrganizationPage } from "../components/organization-page";
import { PageLoading } from "../components/page-loading";

export default function OrganizationRoute() {
  return (
    <Suspense
      fallback={<PageLoading label="Loading organization" variant="organization" />}
    >
      <OrganizationPage />
    </Suspense>
  );
}
