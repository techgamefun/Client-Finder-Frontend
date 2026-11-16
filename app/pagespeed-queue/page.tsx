import { redirect } from "next/navigation";

export default function PageSpeedQueuePage(): never {
  redirect("/jobs?tab=pagespeed");
}
