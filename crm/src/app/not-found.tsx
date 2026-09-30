import Link from "next/link";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-center">
      <div className="text-5xl font-semibold text-slate-300">404</div>
      <h1 className="text-lg font-semibold">{t("errorPage.notFoundTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("errorPage.notFoundText")}</p>
      <Link href="/" className="text-sm text-primary hover:underline">
        {t("common.home")}
      </Link>
    </div>
  );
}
