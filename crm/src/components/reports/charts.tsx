"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatMoneyRound, formatNumber, formatPercent } from "@/lib/format";
import { useTheme } from "@/components/layout/theme-toggle";
import { chartColors } from "./palette";

function useChart() {
  const c = chartColors(useTheme());
  return { c, tick: { fontSize: 11, fill: c.axis }, catTick: { fontSize: 12, fill: c.label }, tip: { contentStyle: c.tooltip, labelStyle: { color: c.label }, itemStyle: { color: c.label } } };
}

/** Количество по дням/неделям — один ряд, подпись в заголовке карточки */
export function CountBars({ data, label }: { data: { x: string; value: number }[]; label: string }) {
  const { c, tick, tip } = useChart();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="x" tick={tick} tickLine={false} axisLine={{ stroke: c.grid }} interval="preserveStartEnd" minTickGap={16} />
        <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} width={40} />
        <Tooltip {...tip} cursor={{ fill: c.cursor }} formatter={(v) => [formatNumber(Number(v)), label]} />
        <Bar dataKey="value" name={label} fill={c.single} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Выручка и прибыль по дням/неделям — два ряда одной единицы, одна ось */
export function MoneyBars({ data, currency }: { data: { x: string; revenue: number; profit: number }[]; currency: "UZS" | "USD" }) {
  const { c, tick, tip } = useChart();
  const short = (v: number) => (currency === "UZS" ? `${formatNumber(v / 1_000_000, 1)} млн` : `$${formatNumber(v / 1000, 1)}k`);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap={4}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="x" tick={tick} tickLine={false} axisLine={{ stroke: c.grid }} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tick={tick} tickLine={false} axisLine={false} width={56} tickFormatter={short} />
        <Tooltip {...tip} cursor={{ fill: c.cursor }} formatter={(v, n) => [formatMoney(Number(v), currency), n]} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: c.label }} />
        <Bar dataKey="revenue" name="Выручка" fill={c.series[1]} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="profit" name="Прибыль" fill={c.series[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Воронка: горизонтальные полосы одного цвета, подписи — количество и % от всех */
export function FunnelBars({ data }: { data: { name: string; count: number; ofTotal: number | null }[] }) {
  const { c, catTick, tip } = useChart();
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 110, left: 8, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={190} tick={catTick} tickLine={false} axisLine={false} />
        <Tooltip {...tip} cursor={{ fill: c.cursor }} formatter={(v, _n, p) => [`${formatNumber(Number(v))} (${formatPercent(p.payload.ofTotal)})`, "Дошли до этапа"]} />
        <Bar dataKey="count" fill={c.single} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="count" position="right" formatter={(v) => formatNumber(Number(v))} style={{ fontSize: 12, fill: c.label, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Круговая диаграмма причин отказов: до 7 причин + «Прочие» */
export function LossPie({ data }: { data: { name: string; count: number; share: number | null }[] }) {
  const { c, tip } = useChart();
  const top = data.slice(0, 7);
  const rest = data.slice(7);
  const slices = rest.length ? [...top, { name: "Прочие", count: rest.reduce((s, r) => s + r.count, 0), share: rest.reduce((s, r) => s + (r.share ?? 0), 0) }] : top;
  const color = (i: number, name: string) => (name === "Прочие" ? c.other : c.series[i % c.series.length]);
  return (
    <div className="flex items-center gap-6">
      <div className="h-64 w-64 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="count" nameKey="name" innerRadius="55%" outerRadius="95%" paddingAngle={1} stroke={c.surface} strokeWidth={2} isAnimationActive={false}>
              {slices.map((s, i) => (
                <Cell key={s.name} fill={color(i, s.name)} />
              ))}
            </Pie>
            <Tooltip {...tip} formatter={(v, n, p) => [`${formatNumber(Number(v))} (${formatPercent(p.payload.share)})`, n]} />
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
  const { c, catTick, tip } = useChart();
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 120, left: 8, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={180} tick={catTick} tickLine={false} axisLine={false} />
        <Tooltip {...tip} cursor={{ fill: c.cursor }} formatter={(v) => [formatMoney(Number(v), currency), label]} />
        <Bar dataKey="value" fill={c.single} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="value" position="right" formatter={(v) => formatMoneyRound(Number(v), currency)} style={{ fontSize: 12, fill: c.label }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
