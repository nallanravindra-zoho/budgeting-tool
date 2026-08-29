/**
 * "Export to PPT" — a board-ready deck built from data already computed
 * elsewhere in the app (Overview's kpis/monthlyData, Vendors'/Regions'
 * enriched rows). This module only builds and downloads the file — it
 * takes plain data in, no Firestore/React here, same separation-of-
 * concerns pattern as exportUtils.js (CSV/Excel).
 *
 * Uses pptxgenjs — native (editable-in-PowerPoint) charts and tables,
 * not static images, per the confirmed design choice.
 */
import pptxgen from "pptxgenjs";

const BRAND_RED = "C00000";
const TEXT_DARK = "111111";
const GREY = "6B6B6B";
const LIGHT_ROW = "F7F7F5";
const BORDER = "E0E0E0";
const FONT = "Calibri";

// Kept in sync with vendorPerformance.js's STATUS_COLORS/STATUS_LABELS —
// duplicated here (not imported) since pptxgenjs wants hex WITHOUT the
// leading "#", and this module intentionally has no React/app-state
// dependencies of its own.
const STATUS_COLORS_PPT = {
  needs_attention: "C00000",
  margin_risk: "C97A2B",
  watch: "8A6D1A",
  ahead: "2E5FA3",
  on_track: "1B8A3A",
};
const STATUS_LABELS_PPT = {
  needs_attention: "Needs Attention",
  margin_risk: "Margin Risk",
  watch: "Watch",
  ahead: "Ahead",
  on_track: "On Track",
};

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addTitleSlide(pptx, year, scenario) {
  const slide = pptx.addSlide();
  slide.background = { color: BRAND_RED };
  slide.addText("Cyberknight Budget Desk", { x: 0.5, y: 2.0, w: 9, h: 0.8, fontSize: 36, bold: true, color: "FFFFFF", align: "center", fontFace: FONT });
  slide.addText(`${year} Performance Review${scenario === "SKO" ? " — SKO Scenario" : ""}`, { x: 0.5, y: 2.85, w: 9, h: 0.5, fontSize: 20, color: "FFFFFF", align: "center", fontFace: FONT });
  slide.addText(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), { x: 0.5, y: 3.5, w: 9, h: 0.4, fontSize: 12, color: "F5C9C9", align: "center", fontFace: FONT });
}

function newSlide(pptx, title) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.7, fill: { color: BRAND_RED }, line: { type: "none" } });
  slide.addText(title, { x: 0.4, y: 0.12, w: 9.2, h: 0.5, fontSize: 22, bold: true, color: "FFFFFF", fontFace: FONT });
  slide.addText("Cyberknight Technologies", { x: 0.3, y: 5.35, w: 5, h: 0.25, fontSize: 8, color: "999999", fontFace: FONT });
  return slide;
}

function addExecSummarySlide(pptx, { kpis, fmtN, fmtPct, fmtSignedPct, year }) {
  const slide = newSlide(pptx, `Executive Summary — ${year}`);
  const cards = [
    { label: "YTD Revenue (Actual)", value: fmtN(kpis.totalActualYtd), sub: `${fmtSignedPct(kpis.varPct)} vs YTD Plan (${fmtN(kpis.totalYtdBudget)})` },
    { label: "FY Revenue Forecast", value: fmtN(kpis.totalFyForecastRev), sub: `${fmtSignedPct(kpis.forecastVarPct)} vs FY Budget (${fmtN(kpis.totalBudgetRev)})` },
    { label: "YTD Gross Profit (Actual)", value: fmtN(kpis.totalActualGpYtd), sub: `${fmtPct(kpis.actualGpPct)} GP% vs ${fmtPct(kpis.blendedGpPct)} plan` },
    { label: "FY GP Forecast", value: fmtN(kpis.totalFyForecastGp), sub: `${fmtPct(kpis.forecastGpPct)} FY GP%` },
  ];
  const positions = [[0.4, 1.05], [5.1, 1.05], [0.4, 2.95], [5.1, 2.95]];
  cards.forEach((c, i) => {
    const [x, y] = positions[i];
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w: 4.5, h: 1.7, fill: { color: LIGHT_ROW }, line: { color: BORDER, width: 1 }, rectRadius: 0.08 });
    slide.addText(c.label.toUpperCase(), { x: x + 0.2, y: y + 0.15, w: 4.1, h: 0.3, fontSize: 10, bold: true, color: GREY, fontFace: FONT });
    slide.addText(c.value, { x: x + 0.2, y: y + 0.45, w: 4.1, h: 0.6, fontSize: 24, bold: true, color: TEXT_DARK, fontFace: FONT });
    slide.addText(c.sub, { x: x + 0.2, y: y + 1.08, w: 4.1, h: 0.4, fontSize: 10.5, color: GREY, fontFace: FONT });
  });
}

// One line-chart slide per metric (Revenue, GP) — Budget/Actual/Forecast,
// same three series and colors as the app's own Overview charts.
function addTrendSlide(pptx, { title, data, periodLabel }) {
  const slide = newSlide(pptx, title);
  const labels = data.map(d => String(d.month));
  const series = [
    { name: "Budget", labels, values: data.map(d => d.Budget ?? null) },
    { name: "Actual", labels, values: data.map(d => d.Actual ?? null) },
    { name: "Forecast", labels, values: data.map(d => d.Forecast ?? null) },
  ];
  slide.addChart(pptx.ChartType.line, series, {
    x: 0.4, y: 1.0, w: 9.2, h: 4.15,
    showLegend: true, legendPos: "b", legendFontSize: 10, legendColor: GREY,
    chartColors: ["999999", BRAND_RED, "2E5FA3"], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 5,
    valAxisLabelFontSize: 9, valAxisLabelColor: GREY, catAxisLabelFontSize: 9, catAxisLabelColor: GREY,
    catAxisTitle: periodLabel, showTitle: false,
  });
}

// Vendor-wise / Region-wise performance table — top N by budget, same
// Status taxonomy/colors as the live app.
function addPerformanceTableSlide(pptx, { title, rows, nameKey, totalCount, cap, fmtN, fmtSignedPct }) {
  const slide = newSlide(pptx, title);
  const headerCells = ["Name", "Status", "FY Budget", "YTD Actual", "YTD Var %"].map(h => ({
    text: h, options: { bold: true, color: "FFFFFF", fill: { color: BRAND_RED }, fontSize: 10, fontFace: FONT, align: h === "Name" || h === "Status" ? "left" : "right" },
  }));
  const bodyRows = rows.map((r, i) => [
    { text: r[nameKey], options: { fontSize: 9.5, color: TEXT_DARK, fontFace: FONT, align: "left", fill: { color: i % 2 ? "FFFFFF" : LIGHT_ROW } } },
    { text: STATUS_LABELS_PPT[r.status] || "—", options: { fontSize: 9, bold: true, color: "FFFFFF", fontFace: FONT, align: "left", fill: { color: STATUS_COLORS_PPT[r.status] || "999999" } } },
    { text: fmtN(r.budget_revenue), options: { fontSize: 9.5, color: TEXT_DARK, fontFace: FONT, align: "right", fill: { color: i % 2 ? "FFFFFF" : LIGHT_ROW } } },
    { text: fmtN(r.actual_revenue_ytd), options: { fontSize: 9.5, color: TEXT_DARK, fontFace: FONT, align: "right", fill: { color: i % 2 ? "FFFFFF" : LIGHT_ROW } } },
    { text: fmtSignedPct(r.ytd_budget_revenue ? (r.actual_revenue_ytd - r.ytd_budget_revenue) / r.ytd_budget_revenue : 0), options: { fontSize: 9.5, color: TEXT_DARK, fontFace: FONT, align: "right", fill: { color: i % 2 ? "FFFFFF" : LIGHT_ROW } } },
  ]);
  slide.addTable([headerCells, ...bodyRows], {
    x: 0.4, y: 1.0, w: 9.2, colW: [3.0, 1.8, 1.5, 1.5, 1.4],
    fontFace: FONT, border: { type: "solid", color: BORDER, pt: 0.5 }, autoPage: false, valign: "middle",
  });
  if (totalCount > cap) {
    slide.addText(`Showing top ${cap} of ${totalCount} by FY Budget — see the full list in the app.`, { x: 0.4, y: 5.05, w: 9, h: 0.3, fontSize: 9, italic: true, color: "8A8A8A", fontFace: FONT });
  }
}

/**
 * Builds and downloads the deck. `sections` = { execSummary, vendorWise,
 * regionWise, monthlyTrend, quarterlyTrend } booleans. `vendors`/`regions`
 * are the full enriched row arrays (status/budget_revenue/actual_revenue_ytd/
 * ytd_budget_revenue already present) — only fetched/passed when their
 * section is selected; ranking (top 15 by budget) happens here, not by the
 * caller, so the cap is defined in one place.
 */
export async function exportOverviewToPpt({
  year, scenario, kpis, monthlyData, monthlyGpData, quarterlyData, quarterlyGpData,
  vendors, regions, sections, fmtN, fmtPct, fmtSignedPct,
}) {
  const CAP = 15;
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Cyberknight Budget Desk";
  pptx.company = "Cyberknight Technologies";
  pptx.title = `${year} Performance Review`;

  addTitleSlide(pptx, year, scenario);

  if (sections.execSummary) {
    addExecSummarySlide(pptx, { kpis, fmtN, fmtPct, fmtSignedPct, year });
  }
  if (sections.monthlyTrend) {
    addTrendSlide(pptx, { title: `Monthly Revenue — ${year}`, data: monthlyData, periodLabel: "Month" });
    addTrendSlide(pptx, { title: `Monthly Gross Profit — ${year}`, data: monthlyGpData, periodLabel: "Month" });
  }
  if (sections.quarterlyTrend) {
    addTrendSlide(pptx, { title: `Quarterly Revenue — ${year}`, data: quarterlyData, periodLabel: "Quarter" });
    addTrendSlide(pptx, { title: `Quarterly Gross Profit — ${year}`, data: quarterlyGpData, periodLabel: "Quarter" });
  }
  if (sections.vendorWise && vendors) {
    const ranked = [...vendors].sort((a, b) => b.budget_revenue - a.budget_revenue).slice(0, CAP);
    addPerformanceTableSlide(pptx, { title: `Vendor-wise Performance — ${year}`, rows: ranked, nameKey: "vendor", totalCount: vendors.length, cap: CAP, fmtN, fmtSignedPct });
  }
  if (sections.regionWise && regions) {
    const ranked = [...regions].sort((a, b) => b.budget_revenue - a.budget_revenue).slice(0, CAP);
    addPerformanceTableSlide(pptx, { title: `Region-wise Performance — ${year}`, rows: ranked, nameKey: "name", totalCount: regions.length, cap: CAP, fmtN, fmtSignedPct });
  }

  await pptx.writeFile({ fileName: `cyberknight-${year}-performance-review-${dateStamp()}.pptx` });
}
