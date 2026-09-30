"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { roleLabel } from "@/i18n/labels";
import { useI18n } from "@/i18n/client";
import { formatDate } from "@/lib/format";
import { saveUserAction } from "@/app/(app)/settings/actions";
import { useRun } from "./use-run";

export interface UserView {
  id: string;
  login: string;
  name: string;
  role: "ADMIN" | "MANAGER";
  isActive: boolean;
  createdAt: string;
  activeLeads: number;
}

function UserDialog({ user, onClose }: { user: UserView | null; onClose: () => void }) {
  const { pending, run } = useRun();
  const { t } = useI18n();
  const [f, setF] = useState({ login: user?.login ?? "", name: user?.name ?? "", role: user?.role ?? "MANAGER", password: "", isActive: user?.isActive ?? true });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={user ? t("users.user") : t("users.new")}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveUserAction({ id: user?.id, ...f, role: f.role as "ADMIN" | "MANAGER" }), t("common.saved"), onClose);
          }}
        >
          <Field label={t("users.name")}>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          </Field>
          <Field label={t("users.login")}>
            <Input value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} required autoComplete="off" />
          </Field>
          <Field label={t("users.role")}>
            <NativeSelect value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as "ADMIN" | "MANAGER" })}>
              <option value="MANAGER">{t("users.roleManager")}</option>
              <option value="ADMIN">{t("users.roleAdmin")}</option>
            </NativeSelect>
          </Field>
          <Field label={user ? t("users.newPassword") : t("users.password")} hint={user ? t("users.keepPassword") : t("users.minPassword")}>
            <Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" required={!user} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> {t("users.active")}
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersEditor({ users }: { users: UserView[] }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<UserView | "new" | null>(null);
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus /> {t("users.add")}
        </Button>
      </div>
      <Table>
        <THead>
          <tr>
            <TH>{t("users.name")}</TH>
            <TH>{t("users.login")}</TH>
            <TH>{t("users.role")}</TH>
            <TH className="text-right">{t("users.col.activeLeads")}</TH>
            <TH>{t("users.col.created")}</TH>
            <TH>{t("users.col.status")}</TH>
            <TH />
          </tr>
        </THead>
        <TBody>
          {users.map((u) => (
            <TR key={u.id}>
              <TD className="font-medium">{u.name}</TD>
              <TD>{u.login}</TD>
              <TD>{roleLabel(t, u.role)}</TD>
              <TD className="text-right">{u.activeLeads}</TD>
              <TD>{formatDate(u.createdAt)}</TD>
              <TD>{u.isActive ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">{t("users.statusActive")}</Badge> : <Badge className="bg-slate-100 text-slate-500">{t("users.statusBlocked")}</Badge>}</TD>
              <TD className="text-right">
                <Button size="icon-sm" variant="ghost" onClick={() => setEditing(u)} title={t("common.edit")}>
                  <Pencil />
                </Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {editing && <UserDialog user={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
