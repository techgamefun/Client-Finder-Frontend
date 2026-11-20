import { Suspense } from "react";
import { OrganizationPage } from "../components/organization-page";

export default function OrganizationRoute() {
  return (
    <Suspense fallback={<div aria-busy="true" className="overview-page-loading" />}>
      <OrganizationPage />
    </Suspense>
  );
}
