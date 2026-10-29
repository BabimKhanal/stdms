import QRCode from "qrcode";
import type { TemplateDesign, TemplateElement, TemplateElementStyle } from "@edu/shared";

export type DocumentRenderData = Record<string, string>;

export type DocumentRenderOptions = {
  title: string;
  showPrintButton?: boolean;
  subjectRows?: Array<Record<string, string>>;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character,
  );
}

function px(value: number | undefined) {
  return `${Math.round(value ?? 0)}px`;
}

function textCss(style: TemplateElementStyle | undefined) {
  const font = style ?? {};
  return [
    "display:flex",
    `align-items:${font.verticalAlign === "middle" ? "center" : font.verticalAlign === "bottom" ? "flex-end" : "flex-start"}`,
    `justify-content:${font.align === "center" ? "center" : font.align === "right" ? "flex-end" : "flex-start"}`,
    `text-align:${font.align ?? "left"}`,
    `font-family:${escapeHtml(font.fontFamily ?? "Inter")},Arial,sans-serif`,
    `font-size:${px(font.fontSize ?? 16)}`,
    `font-weight:${font.fontWeight ?? 400}`,
    `font-style:${font.fontStyle ?? "normal"}`,
    `color:${escapeHtml(font.color ?? "#0f172a")}`,
    font.letterSpacing !== undefined ? `letter-spacing:${font.letterSpacing}px` : "",
    `line-height:${font.lineHeight ?? 1.35}`,
    `text-transform:${font.textTransform ?? "none"}`,
    font.underline ? "text-decoration:underline" : "",
    "white-space:pre-wrap",
    "overflow-wrap:anywhere",
    "width:100%",
    "height:100%",
  ]
    .filter(Boolean)
    .join(";");
}

function baseCss(element: TemplateElement) {
  return [
    "position:absolute",
    `left:${px(element.x)}`,
    `top:${px(element.y)}`,
    `width:${px(element.width)}`,
    `height:${px(element.height)}`,
    element.rotation ? `transform:rotate(${element.rotation}deg)` : "",
    `opacity:${element.opacity ?? 1}`,
    element.radius ? `border-radius:${px(element.radius)}` : "",
    "overflow:hidden",
  ]
    .filter(Boolean)
    .join(";");
}

async function qrMarkup(element: TemplateElement, data: DocumentRenderData) {
  const value = data[element.field ?? "qrCode"] || data.qrCode || data.studentId || "verification";
  try {
    const svg = await QRCode.toString(value, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: element.stroke ?? "#0f172a", light: "#ffffff" },
    });
    return `<div style="${baseCss(element)};padding:4px;background:#ffffff;box-sizing:border-box">${svg}</div>`;
  } catch {
    return `<div style="${baseCss(element)};padding:4px;background:#ffffff;display:grid;place-items:center;font:600 10px Arial;color:#0f172a">VERIFY</div>`;
  }
}

function tableMarkup(element: TemplateElement, subjectRows?: Array<Record<string, string>>) {
  const config = element.table;
  if (!config) return "";
  const rows =
    config.source === "subjects" && subjectRows?.length
      ? subjectRows.map((subject) => config.columns.map((column) => subject[column.key] ?? ""))
      : config.rows ?? [];
  const totalWeight = config.columns.reduce((sum, column) => sum + column.width, 0) || 1;
  const fontSize = config.fontSize ?? 13;
  const head = config.columns
    .map(
      (column) =>
        `<th style="width:${(column.width / totalWeight) * 100}%;background:${escapeHtml(config.headerBackground ?? "#0f766e")};color:${escapeHtml(config.headerColor ?? "#ffffff")};padding:8px 10px;text-align:${column.align ?? "left"};font-weight:700;font-size:${fontSize - 1}px;letter-spacing:.4px;border:1px solid rgba(255,255,255,.18)">${escapeHtml(column.label)}</th>`,
    )
    .join("");
  const body = rows
    .map(
      (row, rowIndex) =>
        `<tr style="background:${config.zebra && rowIndex % 2 === 1 ? "#f8fafc" : "#ffffff"}">${config.columns
          .map(
            (column, columnIndex) =>
              `<td style="height:${px(config.rowHeight ?? 32)};padding:6px 10px;text-align:${column.align ?? "left"};color:#1e293b;border-bottom:1px solid #e2e8f0">${escapeHtml(row[columnIndex] ?? "")}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<div style="${baseCss(element)};border:1px solid ${escapeHtml(element.stroke ?? "#e2e8f0")};box-sizing:border-box"><table style="width:100%;border-collapse:collapse;font-size:${fontSize}px;font-family:${escapeHtml(element.style?.fontFamily ?? "Inter")},Arial,sans-serif"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

async function renderElement(
  element: TemplateElement,
  data: DocumentRenderData,
  options: DocumentRenderOptions,
) {
  if (element.hidden) return "";
  if (element.type === "text" || element.type === "field") {
    const value = element.type === "field" ? data[element.field ?? ""] ?? "" : element.text ?? "";
    return `<div style="${baseCss(element)}"><div style="${textCss(element.style)}">${escapeHtml(value)}</div></div>`;
  }
  if (element.type === "shape") {
    return `<div style="${baseCss(element)};background:${element.fill && element.fill !== "transparent" ? escapeHtml(element.fill) : "transparent"};border:${element.stroke ? `${element.strokeWidth ?? 1}px ${element.borderStyle ?? "solid"} ${escapeHtml(element.stroke)}` : "none"};box-sizing:border-box"></div>`;
  }
  if (element.type === "line") {
    return `<div style="${baseCss(element)};border-top:${element.strokeWidth ?? 1}px ${element.borderStyle ?? "solid"} ${escapeHtml(element.stroke ?? "#cbd5e1")};height:0"></div>`;
  }
  if (element.type === "image" || element.type === "photo") {
    const imageSource = element.src || (element.field ? data[element.field] : "") || (element.type === "photo" ? data.photoUrl : "");
    if (imageSource) {
      return `<div style="${baseCss(element)};border:${element.stroke ? `${element.strokeWidth ?? 1}px solid ${escapeHtml(element.stroke)}` : "none"};box-sizing:border-box"><img src="${escapeHtml(imageSource)}" alt="" style="width:100%;height:100%;object-fit:${element.type === "photo" ? "cover" : "contain"}"></div>`;
    }
    return `<div style="${baseCss(element)};border:${element.strokeWidth ?? 1}px dashed ${escapeHtml(element.stroke ?? "#94a3b8")};background:${element.type === "photo" ? "#e2e8f0" : "#f8fafc"};display:grid;place-items:center;color:#64748b;font:600 ${Math.max(10, Math.min(element.width, element.height) * 0.14)}px Arial;box-sizing:border-box">${element.type === "photo" ? "PHOTO" : "IMAGE"}</div>`;
  }
  if (element.type === "qr") return qrMarkup(element, data);
  if (element.type === "table") return tableMarkup(element, options.subjectRows);
  return "";
}

export async function renderTemplateHtml(
  design: TemplateDesign,
  data: DocumentRenderData,
  options: DocumentRenderOptions,
) {
  const elements = await Promise.all(
    design.elements.map((element) => renderElement(element, data, options)),
  );
  const { width, height, background } = design.page;
  const pageSize = `${Math.round((width * 25.4) / 96)}mm ${Math.round((height * 25.4) / 96)}mm`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(options.title)}</title><style>
@page{size:${pageSize};margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:#eef2f7;font-family:Inter,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar{display:flex;gap:8px;justify-content:center;padding:16px}
.toolbar button{border:0;border-radius:8px;background:#0f172a;color:#fff;padding:10px 16px;font-size:14px;cursor:pointer}
.page{width:${px(width)};height:${px(height)};background:${escapeHtml(background)};position:relative;overflow:hidden;margin:0 auto 24px;box-shadow:0 18px 48px rgba(15,23,42,.18)}
@media print{
  body{background:#fff}
  .toolbar{display:none}
  .page{margin:0;box-shadow:none;break-after:page;page-break-after:always}
  .page:last-child{break-after:auto;page-break-after:auto}
}
</style></head><body>${options.showPrintButton === false ? "" : '<div class="toolbar"><button onclick="window.print()">Print document</button></div>'}<section class="page">${elements.join("")}</section></body></html>`;
}
