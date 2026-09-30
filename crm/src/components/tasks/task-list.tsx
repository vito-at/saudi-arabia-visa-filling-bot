"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlarmClock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDateTime, toInputDateTime } from "@/lib/format";
import { createTaskAction, deleteTaskAction, toggleTaskAction } from "@/app/(app)/leads/actions";

export interface TaskItem {
  id: string;
  title: string;
  dueAt: string;
  doneAt: string | null;
  assignee: string;
  lead?: { id: string; name: string } | null;
}

export function TaskRow({ t, showLead }: { t: TaskItem; showLead?: boolean }) {
  const [pending, start] = useTransition();
  const [now] = useState(() => Date.now());
  const overdue = !t.doneAt && new Date(t.dueAt).getTime() < now;
  return (
    <div className={cn("group flex items-start gap-3 rounded-lg border px-3 py-2", overdue && "border-red-200 bg-red-50", t.doneAt && "opacity-60")}>
      <input
        type="checkbox"
        className="mt-1"
        checked={!!t.doneAt}
        disabled={pending}
        aria-label="Выполнено"
        onChange={() =>
          start(async () => {
            const res = await toggleTaskAction(t.id);
            if (!res.ok) toast.error(res.error);
          })
        }
      />
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm", t.doneAt && "line-through")}>{t.title}</div>
        <div className={cn("flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground", overdue && "text-red-600")}>
          <span className="inline-flex items-center gap-1">
            <AlarmClock className="size-3" />
            {formatDateTime(t.dueAt)}
            {overdue && " · просрочена"}
          </span>
          <span>{t.assignee}</span>
          {showLead && t.lead && (
            <Link href={`/leads/${t.lead.id}`} className="text-primary hover:underline">
              {t.lead.name}
            </Link>
          )}
        </div>
      </div>
      <button
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 cursor-pointer"
        title="Удалить"
        onClick={() =>
          start(async () => {
            const res = await deleteTaskAction(t.id);
            if (!res.ok) toast.error(res.error);
          })
        }
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

export function NewTaskForm({ leadId, assignees }: { leadId?: string; assignees?: { id: string; name: string }[] }) {
  const [title, setTitle] = useState(leadId ? "Перезвонить" : "");
  const [dueAt, setDueAt] = useState(() => toInputDateTime(new Date(Date.now() + 60 * 60 * 1000)));
  const [assigneeId, setAssigneeId] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createTaskAction({ leadId, title, dueAt, assigneeId: assigneeId || null });
          if (!res.ok) return void toast.error(res.error);
          toast.success("Задача создана");
          setTitle(leadId ? "Перезвонить" : "");
        });
      }}
    >
      <Input className="min-w-48 flex-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Что сделать" />
      <Input className="w-52" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
      {assignees && (
        <NativeSelect className="w-44" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">{leadId ? "Ответственный лида" : "Мне"}</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
      )}
      <Button type="submit" size="sm" disabled={pending || !title.trim()}>
        <Plus /> Добавить
      </Button>
    </form>
  );
}
