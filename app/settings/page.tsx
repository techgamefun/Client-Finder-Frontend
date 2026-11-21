import { Suspense } from "react";
import { SettingsPage } from "../components/settings-page";
import { PageLoading } from "../components/page-loading";

export default function SettingsRoute() {
  return (
    <Suspense
      fallback={<PageLoading label="Loading settings" variant="settings" />}
    >
      <SettingsPage />
    </Suspense>
  );
}
