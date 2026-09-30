import type { Theme } from "@/lib/theme";

// Категориальная палитра (проверена на различимость при нарушениях цветового зрения);
// порядок фиксированный, для тёмной темы — те же оттенки, подобранные под тёмный фон
const SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const SERIES_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

export function chartColors(theme: Theme) {
  const dark = theme === "dark";
  const series = dark ? SERIES_DARK : SERIES_LIGHT;
  return {
    series,
    /** одиночный ряд — фирменный оранжевый (слот «orange» палитры) */
    single: series[1],
    other: dark ? "#5f6b7b" : "#a3a29c",
    grid: dark ? "#262e39" : "#e5e7eb",
    axis: dark ? "#97a1b0" : "#64748b",
    label: dark ? "#e6e9ee" : "#11161c",
    surface: dark ? "#161b22" : "#ffffff",
    cursor: dark ? "rgba(255,255,255,.05)" : "rgba(17,22,28,.05)",
    tooltip: {
      borderRadius: 8,
      border: `1px solid ${dark ? "#262e39" : "#e2e8f0"}`,
      background: dark ? "#1e252e" : "#ffffff",
      color: dark ? "#e6e9ee" : "#11161c",
      fontSize: 12,
      boxShadow: "0 4px 12px rgba(0,0,0,.12)",
    },
  };
}
