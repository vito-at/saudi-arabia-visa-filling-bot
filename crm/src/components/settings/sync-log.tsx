import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Empty } from "@/components/ui/empty";
import { formatDateTime } from "@/lib/format";
import type { SyncLog } from "@prisma/client";

const TRIGGER: Record<string, string> = { CRON: "По расписанию", MANUAL: "Вручную", WEBHOOK: "Вебхук" };

export function SyncLogTable({ logs }: { logs: SyncLog[] }) {
  if (!logs.length) return <Empty>Синхронизаций ещё не было</Empty>;
  return (
    <Table>
      <THead>
        <tr>
          <TH>Время</TH>
          <TH>Запуск</TH>
          <TH className="text-right">Форм</TH>
          <TH className="text-right">Получено</TH>
          <TH className="text-right">Новых</TH>
          <TH className="text-right">Дублей</TH>
          <TH>Результат</TH>
        </tr>
      </THead>
      <TBody>
        {logs.map((l) => (
          <TR key={l.id}>
            <TD className="whitespace-nowrap">{formatDateTime(l.startedAt)}</TD>
            <TD>{TRIGGER[l.trigger]}</TD>
            <TD className="text-right">{l.formsChecked}</TD>
            <TD className="text-right">{l.fetched}</TD>
            <TD className="text-right font-medium">{l.created}</TD>
            <TD className="text-right text-muted-foreground">{l.duplicates}</TD>
            <TD className="max-w-xl">
              {!l.finishedAt ? (
                <Badge className="border-sky-200 bg-sky-50 text-sky-700">Выполняется…</Badge>
              ) : l.ok ? (
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Успешно</Badge>
              ) : (
                <div>
                  <Badge className="border-red-200 bg-red-50 text-red-700">Ошибка</Badge>
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
