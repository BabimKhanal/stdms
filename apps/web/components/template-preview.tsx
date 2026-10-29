"use client";

import { DOCUMENT_SAMPLE_VALUES, type TemplateDesign, type TemplateElement } from "@edu/shared";
import type { CSSProperties, ReactNode } from "react";

export type FieldOverrides = Record<string, string>;

export function resolveFieldValue(field: string | undefined, overrides?: FieldOverrides) {
  if (!field) return "";
  if (overrides && field in overrides) return overrides[field];
  return DOCUMENT_SAMPLE_VALUES[field as keyof typeof DOCUMENT_SAMPLE_VALUES] ?? "";
}

function elementStyle(element: TemplateElement): CSSProperties {
  return {
    position: "absolute",
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    opacity: element.hidden ? 0 : element.opacity ?? 1,
    display: element.hidden ? "none" : undefined,
  };
}

function textStyle(element: TemplateElement): CSSProperties {
  const style = element.style ?? {};
  return {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: style.verticalAlign === "middle" ? "center" : style.verticalAlign === "bottom" ? "flex-end" : "flex-start",
    justifyContent: style.align === "center" ? "center" : style.align === "right" ? "flex-end" : "flex-start",
    textAlign: style.align ?? "left",
    fontFamily: style.fontFamily ?? "Inter",
    fontSize: style.fontSize ?? 16,
    fontWeight: style.fontWeight ?? 400,
    fontStyle: style.fontStyle ?? "normal",
    color: style.color ?? "#0f172a",
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
    lineHeight: style.lineHeight ?? 1.35,
    textTransform: style.textTransform ?? "none",
    textDecoration: style.underline ? "underline" : undefined,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  };
}

function qrCells(value: string, color: string) {
  const size = 21;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const random = () => {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    return (hash >>> 0) / 4294967296;
  };
  const isFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
  const cells: ReactNode[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (isFinder(x, y)) continue;
      if (random() > 0.52) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />);
    }
  }
  return cells;
}

function QrGraphic({ value, color = "#0f172a" }: { value: string; color?: string }) {
  const size = 21;
  const cells = qrCells(value, color);
  const finder = (x: number, y: number) => (
    <g key={`f-${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} fill={color} />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#ffffff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill={color} />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" role="img" aria-label="Verification QR code" shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#ffffff" />
      {cells}
      {finder(0, 0)}
      {finder(size - 7, 0)}
      {finder(0, size - 7)}
    </svg>
  );
}

export function TemplateElementView({ element, overrides }: { element: TemplateElement; overrides?: FieldOverrides }) {
  if (element.hidden) return null;
  const style = elementStyle(element);
  const radius = element.radius ? `${element.radius}px` : undefined;

  if (element.type === "text" || element.type === "field") {
    const value = element.type === "field" ? resolveFieldValue(element.field, overrides) : element.text ?? "";
    return <div style={{ ...style, overflow: "hidden" }}><div style={textStyle(element)}>{value}</div></div>;
  }

  if (element.type === "shape") {
    return (
      <div
        style={{
          ...style,
          background: element.fill && element.fill !== "transparent" ? element.fill : undefined,
          border: element.stroke ? `${element.strokeWidth ?? 1}px ${element.borderStyle ?? "solid"} ${element.stroke}` : undefined,
          borderRadius: radius,
        }}
      />
    );
  }

  if (element.type === "line") {
    return (
      <div style={{ ...style, borderTop: `${element.strokeWidth ?? 1}px ${element.borderStyle ?? "solid"} ${element.stroke ?? "#cbd5e1"}` }} />
    );
  }

  if (element.type === "image" || element.type === "photo") {
    const imageSource = element.src || (element.field ? resolveFieldValue(element.field, overrides) : "") || (element.type === "photo" ? resolveFieldValue("photoUrl", overrides) : "");
    if (imageSource) {
      return (
        <div style={{ ...style, overflow: "hidden", borderRadius: radius, border: element.stroke ? `${element.strokeWidth ?? 1}px solid ${element.stroke}` : undefined }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSource} alt={element.name ?? "Template image"} style={{ width: "100%", height: "100%", objectFit: element.type === "photo" ? "cover" : "contain" }} />
        </div>
      );
    }
    return (
      <div
        style={{
          ...style,
          borderRadius: radius,
          border: `${element.strokeWidth ?? 1}px dashed ${element.stroke ?? "#94a3b8"}`,
          background: element.type === "photo" ? "#e2e8f0" : "#f8fafc",
          display: "grid",
          placeItems: "center",
          color: "#64748b",
          fontSize: Math.max(10, Math.min(element.width, element.height) * 0.14),
          fontWeight: 600,
        }}
      >
        {element.type === "photo" ? "PHOTO" : "IMAGE"}
      </div>
    );
  }

  if (element.type === "qr") {
    return (
      <div style={{ ...style, padding: 4, background: "#ffffff", borderRadius: radius }}>
        <QrGraphic value={resolveFieldValue(element.field ?? "qrCode", overrides) || "verify"} color={element.stroke ?? "#0f172a"} />
      </div>
    );
  }

  if (element.type === "table") {
    const config = element.table;
    if (!config) return null;
    const rows = config.rows ?? [];
    const totalWeight = config.columns.reduce((sum, column) => sum + column.width, 0) || 1;
    const fontSize = config.fontSize ?? 13;
    return (
      <div style={{ ...style, overflow: "hidden", borderRadius: radius, border: `1px solid ${element.stroke ?? "#e2e8f0"}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize, fontFamily: element.style?.fontFamily ?? "Inter" }}>
          <thead>
            <tr>
              {config.columns.map((column) => (
                <th
                  key={column.key}
                  style={{
                    width: `${(column.width / totalWeight) * 100}%`,
                    background: config.headerBackground ?? "#0f766e",
                    color: config.headerColor ?? "#ffffff",
                    padding: "8px 10px",
                    textAlign: column.align ?? "left",
                    fontWeight: 700,
                    fontSize: fontSize - 1,
                    letterSpacing: 0.4,
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} style={{ background: config.zebra && rowIndex % 2 === 1 ? "#f8fafc" : "#ffffff" }}>
                {config.columns.map((column, columnIndex) => (
                  <td
                    key={column.key}
                    style={{
                      height: config.rowHeight ?? 32,
                      padding: "6px 10px",
                      textAlign: column.align ?? "left",
                      color: "#1e293b",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    {row[columnIndex] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}

export function TemplatePageView({
  design,
  overrides,
  scale = 1,
  className,
  children,
}: {
  design: TemplateDesign;
  overrides?: FieldOverrides;
  scale?: number;
  className?: string;
  children?: ReactNode;
}) {
  const { page, elements } = design;
  return (
    <div
      className={className}
      style={{ width: page.width * scale, height: page.height * scale, flexShrink: 0, overflow: "hidden" }}
    >
      <div
        style={{
          width: page.width,
          height: page.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "relative",
          background: page.background,
          overflow: "hidden",
        }}
      >
        {elements.map((element) => (
          <TemplateElementView key={element.id} element={element} overrides={overrides} />
        ))}
        {children}
      </div>
    </div>
  );
}

export function TemplateThumbnail({ design, width = 320 }: { design: TemplateDesign; width?: number }) {
  const scale = Math.min(width / design.page.width, (width * 0.78) / design.page.height);
  return (
    <div className="flex items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100" style={{ height: width * 0.72 }}>
      <div className="shadow-sm">
        <TemplatePageView design={design} scale={scale} />
      </div>
    </div>
  );
}
