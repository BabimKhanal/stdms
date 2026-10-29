import {
  PDFDocument,
  StandardFonts,
  clip,
  closePath,
  degrees,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import QRCode from "qrcode";
import type { TemplateDesign, TemplateElement, TemplateElementStyle } from "@edu/shared";
import type { DocumentRenderData } from "./document-template-renderer";

const PX_TO_POINT = 0.75;
const HEX = /^#([\da-f]{3}|[\da-f]{6})$/i;

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
};

type PdfDocumentPage = {
  data: DocumentRenderData;
  subjectRows?: Array<Record<string, string>>;
};

function toPoints(value: number) {
  return value * PX_TO_POINT;
}

function parseColor(value: string | undefined, fallback: RGB = rgb(0.06, 0.09, 0.16)): RGB {
  if (!value || !HEX.test(value) || value.toLowerCase() === "transparent") return fallback;
  const hex = value.slice(1);
  const full = hex.length === 3 ? hex.split("").map((character) => character + character).join("") : hex;
  return rgb(
    Number.parseInt(full.slice(0, 2), 16) / 255,
    Number.parseInt(full.slice(2, 4), 16) / 255,
    Number.parseInt(full.slice(4, 6), 16) / 255,
  );
}

function clipRect(page: PDFPage, x: number, y: number, width: number, height: number) {
  page.pushOperators(
    pushGraphicsState(),
    moveTo(x, y),
    lineTo(x + width, y),
    lineTo(x + width, y + height),
    lineTo(x, y + height),
    closePath(),
    clip(),
    endPath(),
  );
}

function fontFor(fonts: Fonts, style: TemplateElementStyle | undefined) {
  const bold = Number(style?.fontWeight ?? 400) >= 600;
  const italic = style?.fontStyle === "italic";
  if (bold && italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  if (italic) return fonts.italic;
  return fonts.regular;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  const measured = (value: string) => font.widthOfTextAtSize(value, size);
  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (measured(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) {
        lines.push(current);
        current = "";
      }
      if (measured(word) <= maxWidth) {
        current = word;
        continue;
      }
      let chunk = "";
      for (const character of word) {
        if (chunk && measured(chunk + character) > maxWidth) {
          lines.push(chunk);
          chunk = character;
        } else {
          chunk += character;
        }
      }
      current = chunk;
    }
    if (current) lines.push(current);
  }
  return lines;
}

function drawTextElement(
  page: PDFPage,
  element: TemplateElement,
  data: DocumentRenderData,
  fonts: Fonts,
) {
  const style = element.style ?? {};
  const value = element.type === "field" ? data[element.field ?? ""] ?? "" : element.text ?? "";
  if (!value) return;

  const size = toPoints(style.fontSize ?? 16);
  const font = fontFor(fonts, style);
  const color = parseColor(style.color);
  const opacity = element.opacity ?? 1;
  const x = toPoints(element.x);
  const top = page.getHeight() - toPoints(element.y);
  const width = toPoints(element.width);
  const height = toPoints(element.height);
  const lineHeight = (style.lineHeight ?? 1.35) * size;
  const padding = toPoints(2);
  const contentWidth = Math.max(1, width - padding * 2);
  const transformed =
    style.textTransform === "uppercase"
      ? value.toUpperCase()
      : style.textTransform === "lowercase"
        ? value.toLowerCase()
        : value;
  const allLines = wrapText(transformed, font, size, contentWidth);
  const maxLines = Math.max(1, Math.floor((height - padding * 2) / lineHeight));
  const lines = allLines.slice(0, maxLines);
  const blockHeight = lines.length * lineHeight;
  const verticalOffset =
    style.verticalAlign === "middle"
      ? Math.max(0, (height - blockHeight) / 2)
      : style.verticalAlign === "bottom"
        ? Math.max(0, height - blockHeight)
        : 0;

  if (!element.rotation) clipRect(page, x, top - height, width, height);
  lines.forEach((line, index) => {
    const lineWidth = font.widthOfTextAtSize(line, size);
    const lineX =
      style.align === "center"
        ? x + padding + (contentWidth - lineWidth) / 2
        : style.align === "right"
          ? x + width - padding - lineWidth
          : x + padding;
    const baseline = top - padding - verticalOffset - size * 0.82 - index * lineHeight;
    page.drawText(line, {
      x: lineX,
      y: baseline,
      size,
      font,
      color,
      opacity,
      rotate: element.rotation ? degrees(-element.rotation) : undefined,
    });
    if (style.underline) {
      const underlineY = baseline - size * 0.1;
      page.drawLine({
        start: { x: lineX, y: underlineY },
        end: { x: lineX + lineWidth, y: underlineY },
        thickness: Math.max(0.5, size * 0.055),
        color,
        opacity,
      });
    }
  });
  if (!element.rotation) page.pushOperators(popGraphicsState());
}

function drawShapeElement(page: PDFPage, element: TemplateElement) {
  const x = toPoints(element.x);
  const top = page.getHeight() - toPoints(element.y);
  const width = toPoints(element.width);
  const height = toPoints(element.height);
  const y = top - height;
  const fill = element.fill && element.fill !== "transparent" ? parseColor(element.fill) : undefined;
  const stroke = element.stroke ? parseColor(element.stroke) : undefined;
  const borderWidth = toPoints(element.strokeWidth ?? 1);
  const dash =
    element.borderStyle === "dashed"
      ? [4, 3]
      : element.borderStyle === "dotted"
        ? [1.5, 2]
        : undefined;
  const opacity = element.opacity ?? 1;
  const radius = toPoints(Math.min(element.radius ?? 0, Math.min(element.width, element.height) / 2));

  if (radius > 0) {
    const path = [
      `M ${radius} 0`,
      `H ${width - radius}`,
      `A ${radius} ${radius} 0 0 1 ${width} ${radius}`,
      `V ${height - radius}`,
      `A ${radius} ${radius} 0 0 1 ${width - radius} ${height}`,
      `H ${radius}`,
      `A ${radius} ${radius} 0 0 1 0 ${height - radius}`,
      `V ${radius}`,
      `A ${radius} ${radius} 0 0 1 ${radius} 0`,
      "Z",
    ].join(" ");
    page.drawSvgPath(path, {
      x,
      y: top,
      color: fill,
      borderColor: stroke,
      borderWidth: stroke ? borderWidth : 0,
      borderDashArray: dash,
      opacity,
    });
    return;
  }

  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: fill,
    borderColor: stroke,
    borderWidth: stroke ? borderWidth : 0,
    borderDashArray: dash,
    opacity,
    borderOpacity: opacity,
  });
}

function imageBytesFromDataUrl(url: string) {
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(url);
  if (!match) return null;
  const kind = match[1].toLowerCase() === "png" ? "png" : "jpg";
  return { kind, bytes: Uint8Array.from(Buffer.from(match[2], "base64")) };
}

async function embedImage(pdf: PDFDocument, url: string | undefined): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    const inline = imageBytesFromDataUrl(url);
    if (inline) return inline.kind === "png" ? await pdf.embedPng(inline.bytes) : await pdf.embedJpg(inline.bytes);
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    const isPng = type.includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50);
    const isJpg = type.includes("jpeg") || type.includes("jpg") || (bytes[0] === 0xff && bytes[1] === 0xd8);
    if (isPng) return await pdf.embedPng(bytes);
    if (isJpg) return await pdf.embedJpg(bytes);
    return null;
  } catch {
    return null;
  }
}

async function drawImageElement(
  page: PDFPage,
  element: TemplateElement,
  data: DocumentRenderData,
  pdf: PDFDocument,
  cache: Map<string, Promise<PDFImage | null>>,
) {
  const x = toPoints(element.x);
  const top = page.getHeight() - toPoints(element.y);
  const width = toPoints(element.width);
  const height = toPoints(element.height);
  const y = top - height;
  const radius = toPoints(element.radius ?? 0);
  const url =
    element.src ||
    (element.field ? data[element.field] : "") ||
    (element.type === "photo" ? data.photoUrl : "");
  const image = url ? await (cache.get(url) ?? cache.set(url, embedImage(pdf, url)).get(url)!) : null;
  const opacity = element.opacity ?? 1;
  const stroke = element.stroke ? parseColor(element.stroke) : undefined;
  const borderWidth = toPoints(element.strokeWidth ?? 1);

  if (image) {
    const imageScale =
      element.type === "photo"
        ? Math.max(width / image.width, height / image.height)
        : Math.min(width / image.width, height / image.height);
    const drawWidth = image.width * imageScale;
    const drawHeight = image.height * imageScale;
    const drawX = x + (width - drawWidth) / 2;
    const drawY = y + (height - drawHeight) / 2;
    page.drawRectangle({ x, y, width, height, color: rgb(1, 1, 1), opacity });
    clipRect(page, x, y, width, height);
    page.drawImage(image, {
      x: element.type === "photo" ? drawX : x + (width - drawWidth) / 2,
      y: element.type === "photo" ? drawY : y + (height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
      opacity,
    });
    page.pushOperators(popGraphicsState());
    if (stroke) {
      page.drawRectangle({ x, y, width, height, borderColor: stroke, borderWidth, borderOpacity: opacity });
    }
    if (radius > 0) {
      page.drawSvgPath(
        [
          `M ${radius} 0`,
          `H ${width - radius}`,
          `A ${radius} ${radius} 0 0 1 ${width} ${radius}`,
          `V ${height - radius}`,
          `A ${radius} ${radius} 0 0 1 ${width - radius} ${height}`,
          `H ${radius}`,
          `A ${radius} ${radius} 0 0 1 0 ${height - radius}`,
          `V ${radius}`,
          `A ${radius} ${radius} 0 0 1 ${radius} 0`,
          "Z",
        ].join(" "),
        { x, y: top, borderColor: stroke ?? rgb(0.85, 0.89, 0.94), borderWidth: 0.75 },
      );
    }
    return;
  }

  const background = element.type === "photo" ? rgb(0.89, 0.91, 0.94) : rgb(0.97, 0.98, 0.99);
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: background,
    borderColor: stroke ?? rgb(0.58, 0.64, 0.71),
    borderWidth,
    borderDashArray: [3, 2],
    opacity,
  });
  const label = element.type === "photo" ? "PHOTO" : "IMAGE";
  const size = Math.max(6, Math.min(width, height) * 0.12);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const labelWidth = font.widthOfTextAtSize(label, size);
  page.drawText(label, {
    x: x + (width - labelWidth) / 2,
    y: y + height / 2 - size * 0.35,
    size,
    font,
    color: rgb(0.39, 0.45, 0.55),
    opacity,
  });
}

async function drawQrElement(page: PDFPage, element: TemplateElement, data: DocumentRenderData, pdf: PDFDocument) {
  const x = toPoints(element.x);
  const top = page.getHeight() - toPoints(element.y);
  const width = toPoints(element.width);
  const height = toPoints(element.height);
  const y = top - height;
  const padding = toPoints(4);
  const value = data[element.field ?? "qrCode"] || data.qrCode || data.studentId || "verification";
  page.drawRectangle({ x, y, width, height, color: rgb(1, 1, 1), opacity: element.opacity ?? 1 });
  try {
    const buffer = await QRCode.toBuffer(value, {
      type: "png",
      margin: 1,
      width: 512,
      errorCorrectionLevel: "M",
      color: { dark: element.stroke ?? "#0f172a", light: "#ffffff" },
    });
    const image = await pdf.embedPng(buffer);
    page.drawImage(image, {
      x: x + padding,
      y: y + padding,
      width: Math.max(1, width - padding * 2),
      height: Math.max(1, height - padding * 2),
      opacity: element.opacity ?? 1,
    });
  } catch {
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const size = Math.max(6, Math.min(width, height) * 0.12);
    page.drawText("VERIFY", {
      x: x + padding,
      y: y + height / 2 - size / 2,
      size,
      font,
      color: rgb(0.06, 0.09, 0.16),
    });
  }
}

function drawTableElement(
  page: PDFPage,
  element: TemplateElement,
  subjectRows: Array<Record<string, string>> | undefined,
  fonts: Fonts,
) {
  const config = element.table;
  if (!config) return;
  const x = toPoints(element.x);
  const top = page.getHeight() - toPoints(element.y);
  const width = toPoints(element.width);
  const height = toPoints(element.height);
  const y = top - height;
  const rows =
    config.source === "subjects" && subjectRows?.length
      ? subjectRows.map((subject) => config.columns.map((column) => subject[column.key] ?? ""))
      : config.rows ?? [];
  const totalWeight = config.columns.reduce((sum, column) => sum + column.width, 0) || 1;
  const fontSize = toPoints(config.fontSize ?? 13);
  const headerSize = Math.max(5, fontSize - toPoints(1));
  const rowHeight = toPoints(config.rowHeight ?? 32);
  const headerHeight = Math.max(rowHeight, fontSize + toPoints(14));
  const padding = toPoints(5);
  const font = fonts.regular;
  const bold = fonts.bold;
  const headerColor = parseColor(config.headerColor, rgb(1, 1, 1));
  const headerBackground = parseColor(config.headerBackground, rgb(0.06, 0.46, 0.43));
  const border = rgb(0.89, 0.91, 0.94);
  const textColor = rgb(0.12, 0.16, 0.22);

  clipRect(page, x, y, width, height);
  let cursorTop = top;
  let columnX = x;
  config.columns.forEach((column, index) => {
    const columnWidth = (column.width / totalWeight) * width;
    page.drawRectangle({ x: columnX, y: cursorTop - headerHeight, width: columnWidth, height: headerHeight, color: headerBackground });
    const lines = wrapText(column.label, bold, headerSize, Math.max(1, columnWidth - padding * 2)).slice(0, 1);
    const line = lines[0] ?? "";
    const lineWidth = bold.widthOfTextAtSize(line, headerSize);
    page.drawText(line, {
      x:
        column.align === "center"
          ? columnX + (columnWidth - lineWidth) / 2
          : column.align === "right"
            ? columnX + columnWidth - padding - lineWidth
            : columnX + padding,
      y: cursorTop - headerHeight / 2 - headerSize * 0.35,
      size: headerSize,
      font: bold,
      color: headerColor,
    });
    if (index > 0) {
      page.drawLine({
        start: { x: columnX, y: cursorTop },
        end: { x: columnX, y: cursorTop - headerHeight },
        thickness: 0.5,
        color: headerColor,
        opacity: 0.3,
      });
    }
    columnX += columnWidth;
  });
  cursorTop -= headerHeight;

  rows.forEach((row, rowIndex) => {
    if (cursorTop - rowHeight < y) return;
    columnX = x;
    if (config.zebra && rowIndex % 2 === 1) {
      page.drawRectangle({ x, y: cursorTop - rowHeight, width, height: rowHeight, color: rgb(0.97, 0.98, 0.99) });
    }
    config.columns.forEach((column) => {
      const columnWidth = (column.width / totalWeight) * width;
      const value = row[config.columns.indexOf(column)] ?? "";
      const lines = wrapText(value, font, fontSize, Math.max(1, columnWidth - padding * 2)).slice(0, 2);
      const lineHeight = fontSize * 1.25;
      const blockHeight = lines.length * lineHeight;
      lines.forEach((line, lineIndex) => {
        const lineWidth = font.widthOfTextAtSize(line, fontSize);
        page.drawText(line, {
          x:
            column.align === "center"
              ? columnX + (columnWidth - lineWidth) / 2
              : column.align === "right"
                ? columnX + columnWidth - padding - lineWidth
                : columnX + padding,
          y: cursorTop - (rowHeight - blockHeight) / 2 - fontSize * 0.82 - lineIndex * lineHeight,
          size: fontSize,
          font,
          color: textColor,
        });
      });
      page.drawLine({
        start: { x: columnX, y: cursorTop - rowHeight },
        end: { x: columnX + columnWidth, y: cursorTop - rowHeight },
        thickness: 0.5,
        color: border,
      });
      columnX += columnWidth;
    });
    cursorTop -= rowHeight;
  });
  page.pushOperators(popGraphicsState());
}

async function drawElement(
  page: PDFPage,
  element: TemplateElement,
  documentPage: PdfDocumentPage,
  pdf: PDFDocument,
  fonts: Fonts,
  cache: Map<string, Promise<PDFImage | null>>,
) {
  if (element.hidden) return;
  if (element.type === "text" || element.type === "field") {
    drawTextElement(page, element, documentPage.data, fonts);
    return;
  }
  if (element.type === "shape") {
    drawShapeElement(page, element);
    return;
  }
  if (element.type === "line") {
    const x = toPoints(element.x);
    const top = page.getHeight() - toPoints(element.y);
    page.drawLine({
      start: { x, y: top },
      end: { x: x + toPoints(element.width), y: top },
      thickness: toPoints(element.strokeWidth ?? 1),
      color: parseColor(element.stroke, rgb(0.8, 0.84, 0.88)),
      dashArray:
        element.borderStyle === "dashed"
          ? [4, 3]
          : element.borderStyle === "dotted"
            ? [1.5, 2]
            : undefined,
      opacity: element.opacity ?? 1,
    });
    return;
  }
  if (element.type === "image" || element.type === "photo") {
    await drawImageElement(page, element, documentPage.data, pdf, cache);
    return;
  }
  if (element.type === "qr") {
    await drawQrElement(page, element, documentPage.data, pdf);
    return;
  }
  if (element.type === "table") {
    drawTableElement(page, element, documentPage.subjectRows, fonts);
  }
}

export async function renderTemplatePdf(
  design: TemplateDesign,
  documents: PdfDocumentPage[],
  options: { title: string },
) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(options.title);
  pdf.setProducer("Nucleus school ERP");
  pdf.setCreator("Nucleus school ERP");
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const cache = new Map<string, Promise<PDFImage | null>>();
  const pageWidth = toPoints(design.page.width);
  const pageHeight = toPoints(design.page.height);

  for (const documentPage of documents) {
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: parseColor(design.page.background, rgb(1, 1, 1)),
    });
    for (const element of design.elements) {
      await drawElement(page, element, documentPage, pdf, fonts, cache);
    }
  }

  return pdf.save();
}
