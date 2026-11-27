import { redirect } from "next/navigation";

type SettingsRouteSearchParams = {
  returnTo?: string | string[];
  section?: string | string[];
};

export default async function SettingsRoute({
  searchParams,
}: {
  searchParams: Promise<SettingsRouteSearchParams>;
}) {
  const params = await searchParams;
  const returnTo = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;
  const destination = returnTo?.startsWith("/")
    ? new URL(returnTo, "http://settings.local")
    : new URL("/overview", "http://settings.local");

  if (
    destination.origin !== "http://settings.local" ||
    destination.pathname === "/" ||
    destination.pathname === "/settings" ||
    destination.pathname === "/login" ||
    destination.pathname === "/signup"
  ) {
    destination.pathname = "/overview";
  }

  const section = Array.isArray(params.section)
    ? params.section[0]
    : params.section;
  destination.searchParams.set("openSettings", "1");
  if (section) destination.searchParams.set("settingsSection", section);
  redirect(`${destination.pathname}${destination.search}${destination.hash}`);
}
