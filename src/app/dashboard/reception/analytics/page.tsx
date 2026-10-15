import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import AIAnalyticsPage from "@/components/analytics/ai-analytics-page";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <AIAnalyticsPage hotelId={session.hotelId} />;
}