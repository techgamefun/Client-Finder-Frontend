import { Suspense } from "react";
import { SettingsPage } from "../components/settings-page";

export default function SettingsRoute() {
  return (
    <Suspense fallback={<div className="workspace-route-loading">Loading settings…</div>}>
      <SettingsPage />
    </Suspense>
  );
}
