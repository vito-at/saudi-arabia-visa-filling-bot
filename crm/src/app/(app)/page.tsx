import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/session";

export default async function DashboardPage() {
  const user = await requireUser();
  return <PageHeader title="Дашборд" description={`Здравствуйте, ${user.name}!`} />;
}
