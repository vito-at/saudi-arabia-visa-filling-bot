import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Empty } from "@/components/ui/empty";
import { formatDateTime } from "@/lib/format";
import type { SyncLog } from "@prisma/client";
import type { TKey } from "@/i18n/core";
import { getI18n } from "@/i18n/server";


export async function SyncLogTable({ logs }: { logs: SyncLog[] }) {
  const { t } = await getI18n();
  if (!logs.length) return <Empty>{t("sync.empty")}</Empty>;
  return (
    <Table>
      <THead>
        <tr>
          <TH>{t("sync.col.time")}</TH>
          <TH>{t("sync.col.trigger")}</TH>
          <TH className="text-right">{t("sync.col.forms")}</TH>
          <TH className="text-right">{t("sync.col.fetched")}</TH>
          <TH className="text-right">{t("sync.col.created")}</TH>
          <TH className="text-right">{t("sync.col.duplicates")}</TH>
          <TH>{t("sync.col.result")}</TH>
        </tr>
      </THead>
      <TBody>
        {logs.map((l) => (
          <TR key={l.id}>
            <TD className="whitespace-nowrap">{formatDateTime(l.startedAt)}</TD>
            <TD>{t(`sync.trigger.${l.trigger}` as TKey)}</TD>
            <TD className="text-right">{l.formsChecked}</TD>
            <TD className="text-right">{l.fetched}</TD>
            <TD className="text-right font-medium">{l.created}</TD>
            <TD className="text-right text-muted-foreground">{l.duplicates}</TD>
            <TD className="max-w-xl">
              {!l.finishedAt ? (
                <Badge className="border-sky-200 bg-sky-50 text-sky-700">{t("sync.running")}</Badge>
              ) : l.ok ? (
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">{t("sync.ok")}</Badge>
              ) : (
                <div>
                  <Badge className="border-red-200 bg-red-50 text-red-700">{t("sync.error")}</Badge>
                  <div className="mt-1 whitespace-pre-wrap text-xs text-red-700">{l.error}</div>
                </div>
              )}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
