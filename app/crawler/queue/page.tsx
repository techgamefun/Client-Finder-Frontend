import { redirect } from "next/navigation";

export default function CrawlerQueuePage(): never {
  redirect("/jobs?tab=crawler");
}
