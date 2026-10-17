"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { deleteQuestionAction, moveQuestionAction, saveQuestionAction } from "@/app/(app)/settings/actions";
import { useRun } from "./use-run";
import { useI18n } from "@/i18n/client";

export interface QuestionView {
  id: string;
  label: string;
  type: "TEXT" | "NUMBER" | "DATE" | "SELECT";
  options: string[];
  role: "DEPART_DATE" | "RETURN_DATE" | null;
  isActive: boolean;
}

const TYPES = ["TEXT", "NUMBER", "DATE", "SELECT"] as const;

function TypeSelect({ value, onChange, disabled }: { value: QuestionView["type"]; onChange: (v: QuestionView["type"]) => void; disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <NativeSelect value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as QuestionView["type"])} className="w-full sm:w-36">
      {TYPES.map((x) => (
        <option key={x} value={x}>
          {t(`questions.type${x}`)}
        </option>
      ))}
    </NativeSelect>
  );
}

function Row({ q, first, last }: { q: QuestionView; first: boolean; last: boolean }) {
  const { pending, run } = useRun();
  const { t } = useI18n();
  const [label, setLabel] = useState(q.label);
  const [type, setType] = useState(q.type);
  const [options, setOptions] = useState(q.options.join(", "));
  const dirty = label !== q.label || type !== q.type || options !== q.options.join(", ");
  return (
    <div className={cn("space-y-2 rounded-lg border bg-card p-2", !q.isActive && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <div className="flex flex-col">
          <button className="cursor-pointer text-muted-foreground disabled:opacity-30" disabled={first || pending} onClick={() => run(() => moveQuestionAction(q.id, -1))} title={t("editor.up")}>
            <ArrowUp className="size-3.5" />
          </button>
          <button className="cursor-pointer text-muted-foreground disabled:opacity-30" disabled={last || pending} onClick={() => run(() => moveQuestionAction(q.id, 1))} title={t("editor.down")}>
            <ArrowDown className="size-3.5" />
          </button>
        </div>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} className="min-w-0 flex-1" />
        <TypeSelect value={type} onChange={setType} disabled={!!q.role} />
        <Button size="sm" disabled={!dirty || pending} onClick={() => run(() => saveQuestionAction({ id: q.id, label, type, options, isActive: q.isActive }), t("common.saved"))}>
          {t("common.save")}
        </Button>
        <Button size="icon-sm" variant="ghost" title={q.isActive ? t("editor.hide") : t("editor.show")} onClick={() => run(() => saveQuestionAction({ id: q.id, label: q.label, type: q.type, options: q.options.join(","), isActive: !q.isActive }))}>
          {q.isActive ? <Eye /> : <EyeOff />}
        </Button>
        {q.role ? (
          <span className="px-2 text-muted-foreground" title={t("questions.roleHint")}>
            <Lock className="size-4" />
          </span>
        ) : (
          <Button size="icon-sm" variant="ghost" title={t("common.delete")} onClick={() => run(() => deleteQuestionAction(q.id))}>
            <Trash2 className="text-red-600" />
          </Button>
        )}
      </div>
      {type === "SELECT" && <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder={t("questions.optionsPh")} className="text-sm" />}
      {q.role && <p className="pl-6 text-xs text-muted-foreground">{t(q.role === "RETURN_DATE" ? "questions.roleReturn" : "questions.roleDepart")}</p>}
    </div>
  );
}

export function QuestionsEditor({ questions }: { questions: QuestionView[] }) {
  const { pending, run } = useRun();
  const { t } = useI18n();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<QuestionView["type"]>("TEXT");
  const [options, setOptions] = useState("");
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t("questions.hint")}</p>
      {questions.map((q, i) => (
        <Row key={`${q.id}-${q.label}-${q.type}-${q.isActive}-${q.options.join()}`} q={q} first={i === 0} last={i === questions.length - 1} />
      ))}
      <div className="space-y-2 rounded-lg border border-dashed p-2">
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("questions.newPh")} className="min-w-0 flex-1" />
          <TypeSelect value={type} onChange={setType} />
          <Button
            disabled={!label.trim() || pending}
            onClick={() =>
              run(() => saveQuestionAction({ label, type, options, isActive: true }), t("editor.added"), () => {
                setLabel("");
                setOptions("");
              })
            }
          >
            <Plus /> {t("common.add")}
          </Button>
        </div>
        {type === "SELECT" && <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder={t("questions.optionsPh")} className="text-sm" />}
      </div>
    </div>
  );
}
