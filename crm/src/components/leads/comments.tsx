"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { addCommentAction, editCommentAction } from "@/app/(app)/leads/actions";
import { useI18n } from "@/i18n/client";

export interface CommentItem {
  id: string;
  text: string;
  author: string;
  authorId: string;
  createdAt: string;
  editedAt: string | null;
}

function CommentView({ c, mine }: { c: CommentItem; mine: boolean }) {
  const { t } = useI18n();
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(c.text);
  const [pending, start] = useTransition();
  return (
    <div className="group flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
        {c.author.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{c.author}</span>
          <span>{formatDateTime(c.createdAt)}</span>
          {c.editedAt && <span title={formatDateTime(c.editedAt)}>{t("comments.edited")}</span>}
          {mine && !edit && (
            <button className="ml-auto opacity-0 group-hover:opacity-100 cursor-pointer" onClick={() => setEdit(true)} title={t("common.edit")}>
              <Pencil className="size-3.5" />
            </button>
          )}
        </div>
        {edit ? (
          <div className="mt-1 space-y-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await editCommentAction(c.id, text);
                    if (!res.ok) return void toast.error(res.error);
                    setEdit(false);
                  })
                }
              >
                {t("common.save")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => (setEdit(false), setText(c.text))}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.text}</p>
        )}
      </div>
    </div>
  );
}

export function Comments({ leadId, comments, currentUserId }: { leadId: string; comments: CommentItem[]; currentUserId: string }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea placeholder={t("comments.placeholder")} value={text} onChange={(e) => setText(e.target.value)} rows={2} />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!text.trim() || pending}
            onClick={() =>
              start(async () => {
                const res = await addCommentAction(leadId, text);
                if (!res.ok) return void toast.error(res.error);
                setText("");
              })
            }
          >
            {t("common.add")}
          </Button>
        </div>
      </div>
      <div className="space-y-4">
        {comments.map((c) => (
          <CommentView key={c.id} c={c} mine={c.authorId === currentUserId} />
        ))}
        {comments.length === 0 && <p className="text-sm text-muted-foreground">{t("comments.empty")}</p>}
      </div>
    </div>
  );
}
