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
import { useI18n } from "@/i18n/client";

export interface TaskItem {
  id: string;
  title: string;
  dueAt: string;
  doneAt: string | null;
  assignee: string;
  lead?: { id: string; name: string } | null;
  /** задача создана статусом «Перезвонить» — название показываем на языке пользователя */
  isCallback?: boolean;
}

export function TaskRow({ t: task, showLead }: { t: TaskItem; showLead?: boolean }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [now] = useState(() => Date.now());
  const overdue = !task.doneAt && new Date(task.dueAt).getTime() < now;
  return (
    <div className={cn("group flex items-start gap-3 rounded-lg border px-3 py-2", overdue && "border-red-200 bg-red-50", task.doneAt && "opacity-60")}>
      <input
        type="checkbox"
        className="mt-1"
        checked={!!task.doneAt}
        disabled={pending}
        aria-label={t("tasks.done")}
        onChange={() =>
          start(async () => {
            const res = await toggleTaskAction(task.id);
            if (!res.ok) toast.error(res.error);
          })
        }
      />
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm", task.doneAt && "line-through")}>{task.isCallback ? t("callback.taskTitle") : task.title}</div>
        <div className={cn("flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground", overdue && "text-red-600")}>
          <span className="inline-flex items-center gap-1">
            <AlarmClock className="size-3" />
            {formatDateTime(task.dueAt)}
            {overdue && ` · ${t("tasks.overdueMark")}`}
          </span>
          <span>{task.assignee}</span>
          {showLead && task.lead && (
            <Link href={`/leads/${task.lead.id}`} className="text-primary hover:underline">
              {task.lead.name}
            </Link>
          )}
        </div>
      </div>
      <button
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 cursor-pointer"
        title={t("common.delete")}
        onClick={() =>
          start(async () => {
            const res = await deleteTaskAction(task.id);
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
  const { t } = useI18n();
  const [title, setTitle] = useState(leadId ? t("tasks.defaultTitle") : "");
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
          toast.success(t("tasks.created"));
          setTitle(leadId ? t("tasks.defaultTitle") : "");
        });
      }}
    >
      <Input className="min-w-48 flex-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("tasks.whatToDo")} />
      <Input className="w-52" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
      {assignees && (
        <NativeSelect className="w-44" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">{leadId ? t("tasks.leadOwner") : t("tasks.toMe")}</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
      )}
      <Button type="submit" size="sm" disabled={pending || !title.trim()}>
        <Plus /> {t("common.add")}
      </Button>
    </form>
  );
}
