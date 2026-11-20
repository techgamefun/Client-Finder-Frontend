import { redirect } from "next/navigation";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { range } = await searchParams;
  const selectedRange = Array.isArray(range) ? range[0] : range;
  const query = selectedRange
    ? `?range=${encodeURIComponent(selectedRange)}`
    : "";
  redirect(`/organization/dashboard${query}`);
}
