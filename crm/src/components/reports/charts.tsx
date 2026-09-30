"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatMoneyRound, formatNumber, formatPercent } from "@/lib/format";
import { AXIS, GRID, OTHER, SERIES } from "./palette";

const tooltipStyle = { borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 12px rgba(15,23,42,.08)" };
const axisTick = { fontSize: 11, fill: AXIS };

/** Количество по дням/неделям — один ряд, подпись в заголовке карточки */
export function CountBars({ data, label }: { data: { x: string; value: number }[]; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="x" tick={axisTick} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={16} />
        <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={40} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(42,120,214,.08)" }} formatter={(v) => [formatNumber(Number(v)), label]} />
        <Bar dataKey="value" name={label} fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Выручка и прибыль по дням/неделям — два ряда одной единицы, одна ось */
export function MoneyBars({ data, currency }: { data: { x: string; revenue: number; profit: number }[]; currency: "UZS" | "USD" }) {
  const short = (v: number) => (currency === "UZS" ? `${formatNumber(v / 1_000_000, 1)} млн` : `$${formatNumber(v / 1000, 1)}k`);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap={4}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="x" tick={axisTick} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={56} tickFormatter={short} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(42,120,214,.08)" }} formatter={(v, n) => [formatMoney(Number(v), currency), n]} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#334155" }} />
        <Bar dataKey="revenue" name="Выручка" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="profit" name="Прибыль" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Воронка: горизонтальные полосы одного цвета, подписи — количество и % от всех */
export function FunnelBars({ data }: { data: { name: string; count: number; ofTotal: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 110, left: 8, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 12, fill: "#334155" }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(42,120,214,.06)" }} formatter={(v, _n, p) => [`${formatNumber(Number(v))} (${formatPercent(p.payload.ofTotal)})`, "Дошли до этапа"]} />
        <Bar dataKey="count" fill={SERIES[0]} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="count" position="right" formatter={(v) => formatNumber(Number(v))} style={{ fontSize: 12, fill: "#0f172a", fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Круговая диаграмма причин отказов: до 7 причин + «Прочие» */
export function LossPie({ data }: { data: { name: string; count: number; share: number | null }[] }) {
  const top = data.slice(0, 7);
  const rest = data.slice(7);
  const slices = rest.length ? [...top, { name: "Прочие", count: rest.reduce((s, r) => s + r.count, 0), share: rest.reduce((s, r) => s + (r.share ?? 0), 0) }] : top;
  const color = (i: number, name: string) => (name === "Прочие" ? OTHER : SERIES[i % SERIES.length]);
  return (
    <div className="flex items-center gap-6">
      <div className="h-64 w-64 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="count" nameKey="name" innerRadius="55%" outerRadius="95%" paddingAngle={1} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {slices.map((s, i) => (
                <Cell key={s.name} fill={color(i, s.name)} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v, n, p) => [`${formatNumber(Number(v))} (${formatPercent(p.payload.share)})`, n]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color(i, s.name) }} />
            <span className="flex-1">{s.name}</span>
            <span className="w-10 text-right tabular-nums font-medium">{s.count}</span>
            <span className="w-14 text-right tabular-nums text-muted-foreground">{formatPercent(s.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Горизонтальные полосы одного показателя (прибыль по менеджерам, выручка по услугам) */
export function HBars({ data, currency, label }: { data: { name: string; value: number }[]; currency: "UZS" | "USD"; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 120, left: 8, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 12, fill: "#334155" }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(42,120,214,.06)" }} formatter={(v) => [formatMoney(Number(v), currency), label]} />
        <Bar dataKey="value" fill={SERIES[0]} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="value" position="right" formatter={(v) => formatMoneyRound(Number(v), currency)} style={{ fontSize: 12, fill: "#0f172a" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
