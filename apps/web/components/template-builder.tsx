"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Lock,
  Minus,
  Plus,
  QrCode,
  Save,
  Square,
  Table as TableIcon,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  X,
} from "lucide-react";
import {
  DOCUMENT_FIELD_GROUPS,
  DOCUMENT_FIELD_LABELS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  PAGE_PRESETS,
  PAGE_PRESET_KEYS,
  isTemplateDesign,
  type DocumentFieldKey,
  type DocumentType,
  type PagePresetKey,
  type TemplateDesign,
  type TemplateElement,
  type TemplateElementStyle,
} from "@edu/shared";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { TemplatePageView } from "./template-preview";
import { CloudinaryMultiUpload } from "./cloudinary-upload";
import { PRESET_CATEGORIES, SUBJECT_TABLE, TEMPLATE_PRESETS, blankDesign } from "../lib/template-presets";
import { cn } from "../lib/utils";

export type TemplateDraft = {
  id?: string;
  name: string;
  documentType: DocumentType;
  design: TemplateDesign;
  isDefault?: boolean;
};

const FONT_FAMILIES = ["Inter", "Georgia", "Arial", "Times New Roman", "Trebuchet MS", "Courier New"];
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const newId = () => `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

type DragState = {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originW: number;
  originH: number;
};

export function TemplateBuilder({
  initial,
  onClose,
  onSave,
}: {
  initial: TemplateDraft;
  onClose: () => void;
  onSave: (draft: TemplateDraft, makeDefault: boolean) => Promise<string>;
}) {
  const [templateId, setTemplateId] = useState<string | undefined>(initial.id);
  const [name, setName] = useState(initial.name);
  const [documentType, setDocumentType] = useState<DocumentType>(initial.documentType);
  const [design, setDesign] = useState<TemplateDesign>(initial.design);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(() => clamp(640 / initial.design.page.height, 0.35, 1));
  const [tab, setTab] = useState<"templates" | "elements" | "media" | "layers">("elements");
  const [presetCategory, setPresetCategory] = useState<DocumentType | "all">(initial.documentType);
  const [history, setHistory] = useState<TemplateDesign[]>([]);
  const [, setFuture] = useState<TemplateDesign[]>([]);
  const [saving, setSaving] = useState(false);
  const [makeDefault, setMakeDefault] = useState(initial.isDefault ?? false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>(() =>
    initial.design.elements
      .filter((element) => element.type === "image" || element.type === "photo")
      .map((element) => element.src)
      .filter((src): src is string => Boolean(src)),
  );
  const [mediaUrl, setMediaUrl] = useState("");

  const zoomRef = useRef(zoom);
  const pageRef = useRef(design.page);
  const designRef = useRef(design);
  const dragRef = useRef<DragState | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    zoomRef.current = zoom;
    pageRef.current = design.page;
    designRef.current = design;
  });

  const selected = useMemo(() => design.elements.find((element) => element.id === selectedId) ?? null, [design.elements, selectedId]);

  const beginHistory = useCallback(() => {
    setHistory((stack) => [...stack, designRef.current].slice(-60));
    setFuture([]);
  }, []);

  const mutate = useCallback(
    (mutator: (current: TemplateDesign) => TemplateDesign, record = true) => {
      if (record) beginHistory();
      setDesign((current) => mutator(current));
    },
    [beginHistory],
  );

  const undo = useCallback(() => {
    setHistory((stack) => {
      if (!stack.length) return stack;
      const previous = stack[stack.length - 1];
      setFuture((next) => [designRef.current, ...next].slice(0, 60));
      setDesign(previous);
      return stack.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((stack) => {
      if (!stack.length) return stack;
      const [nextDesign, ...rest] = stack;
      setHistory((previous) => [...previous, designRef.current].slice(-60));
      setDesign(nextDesign);
      return rest;
    });
  }, []);

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const scale = zoomRef.current || 1;
      const dx = (event.clientX - drag.startX) / scale;
      const dy = (event.clientY - drag.startY) / scale;
      const page = pageRef.current;
      setDesign((current) => ({
        ...current,
        elements: current.elements.map((element) => {
          if (element.id !== drag.id) return element;
          if (drag.mode === "resize") {
            return {
              ...element,
              width: clamp(drag.originW + dx, 24, page.width - element.x),
              height: clamp(drag.originH + dy, 16, page.height - element.y),
            };
          }
          return {
            ...element,
            x: clamp(drag.originX + dx, 0, page.width - element.width),
            y: clamp(drag.originY + dy, 0, page.height - element.height),
          };
        }),
      }));
    }
    function onPointerUp() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    mutate((current) => ({ ...current, elements: current.elements.filter((element) => element.id !== selectedId) }));
    setSelectedId(null);
  }, [mutate, selectedId]);

  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    const copy: TemplateElement = { ...selected, id: newId(), x: selected.x + 16, y: selected.y + 16, name: `${selected.name ?? selected.type} copy` };
    mutate((current) => ({ ...current, elements: [...current.elements, copy] }));
    setSelectedId(copy.id);
  }, [mutate, selected]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (meta && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!selectedId) return;
        event.preventDefault();
        deleteSelected();
        return;
      }
      if (selectedId && event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        mutate((current) => ({
          ...current,
          elements: current.elements.map((element) =>
            element.id === selectedId
              ? {
                  ...element,
                  x: clamp(element.x + dx, 0, current.page.width - element.width),
                  y: clamp(element.y + dy, 0, current.page.height - element.height),
                }
              : element,
          ),
        }));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected, duplicateSelected, mutate, redo, selectedId, undo]);

  function addElement(partial: Omit<TemplateElement, "id">) {
    const element: TemplateElement = { id: newId(), ...partial };
    mutate((current) => ({ ...current, elements: [...current.elements, element] }));
    setSelectedId(element.id);
  }

  function addText(content = "Your text here", size = 24, weight: number | string = 400) {
    const page = design.page;
    addElement({
      type: "text",
      x: Math.round(page.width / 2 - 180),
      y: Math.round(page.height / 3),
      width: 360,
      height: Math.round(size * 2),
      text: content,
      style: { fontFamily: "Inter", fontSize: size, fontWeight: weight, color: "#0f172a", align: "center" },
    });
  }

  function addField(key: string) {
    const page = design.page;
    if (key === "photoUrl") {
      addElement({
        type: "photo",
        field: "photoUrl",
        x: Math.round(page.width / 2 - 120),
        y: Math.round(page.height / 3),
        width: 240,
        height: 300,
        radius: 6,
        stroke: "#cbd5e1",
        strokeWidth: 2,
      });
      return;
    }
    addElement({
      type: "field",
      field: key,
      x: Math.round(page.width / 2 - 160),
      y: Math.round(page.height / 2),
      width: 320,
      height: 32,
      style: { fontFamily: "Inter", fontSize: 18, fontWeight: 600, color: "#0f172a", align: "center" },
    });
  }

  function updateSelected(patch: Partial<TemplateElement>, record = true) {
    if (!selectedId) return;
    updateElement(selectedId, patch, record);
  }

  function updateElement(id: string, patch: Partial<TemplateElement>, record = true) {
    mutate((current) => ({ ...current, elements: current.elements.map((element) => (element.id === id ? { ...element, ...patch } : element)) }), record);
  }

  function moveLayer(id: string, direction: 1 | -1) {
    mutate((current) => {
      const index = current.elements.findIndex((element) => element.id === id);
      if (index < 0) return current;
      const target = clamp(index + direction, 0, current.elements.length - 1);
      if (target === index) return current;
      const elements = [...current.elements];
      const [element] = elements.splice(index, 1);
      elements.splice(target, 0, element);
      return { ...current, elements };
    });
  }

  function updateStyle(patch: TemplateElementStyle, record = true) {
    if (!selected) return;
    updateSelected({ style: { ...selected.style, ...patch } }, record);
  }

  function changePagePreset(key: PagePresetKey) {
    const preset = PAGE_PRESETS[key];
    const sx = preset.width / design.page.width;
    const sy = preset.height / design.page.height;
    mutate((current) => ({
      version: 2,
      page: { width: preset.width, height: preset.height, background: current.page.background },
      elements: current.elements.map((element) => ({
        ...element,
        x: Math.round(element.x * sx),
        y: Math.round(element.y * sy),
        width: Math.round(element.width * sx),
        height: Math.round(element.height * sy),
        style: element.style?.fontSize ? { ...element.style, fontSize: Math.round(element.style.fontSize * sy) } : element.style,
      })),
      meta: current.meta,
    }));
    setZoom(clamp(640 / preset.height, 0.35, 1));
  }

  function applyPreset(presetDesign: TemplateDesign, ask = true) {
    if (ask && !window.confirm("Replace the current design with this template? This can be undone.")) return;
    mutate(() => JSON.parse(JSON.stringify(presetDesign)) as TemplateDesign);
    setZoom(clamp(640 / presetDesign.page.height, 0.35, 1));
    setSelectedId(null);
  }

  function startDrag(event: ReactPointerEvent, element: TemplateElement) {
    event.stopPropagation();
    setSelectedId(element.id);
    if (element.locked) return;
    beginHistory();
    dragRef.current = {
      id: element.id,
      mode: "move",
      startX: event.clientX,
      startY: event.clientY,
      originX: element.x,
      originY: element.y,
      originW: element.width,
      originH: element.height,
    };
  }

  function startResize(event: ReactPointerEvent, element: TemplateElement) {
    event.stopPropagation();
    setSelectedId(element.id);
    if (element.locked) return;
    beginHistory();
    dragRef.current = {
      id: element.id,
      mode: "resize",
      startX: event.clientX,
      startY: event.clientY,
      originX: element.x,
      originY: element.y,
      originW: element.width,
      originH: element.height,
    };
  }

  async function save() {
    if (!name.trim()) {
      setError("Give the template a name before saving.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const savedId = await onSave({ id: templateId, name: name.trim(), documentType, design, isDefault: makeDefault }, makeDefault);
      setTemplateId(savedId);
      setNotice("Template saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save template");
    } finally {
      setSaving(false);
    }
  }

  function exportJson() {
    const payload = JSON.stringify({ name, documentType, design }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name.replace(/\s+/g, "-").toLowerCase() || "template"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as unknown;
        const candidate = parsed && typeof parsed === "object" && "design" in (parsed as Record<string, unknown>) ? (parsed as { design: unknown }).design : parsed;
        if (!isTemplateDesign(candidate)) throw new Error("File does not contain a valid template design");
        const meta = parsed as { name?: string; documentType?: DocumentType };
        if (meta.name) setName(meta.name);
        if (meta.documentType && DOCUMENT_TYPES.includes(meta.documentType)) setDocumentType(meta.documentType);
        applyPreset(candidate, false);
        setError("");
        setNotice("Design imported. Save to store it.");
      } catch (importError) {
        setError(importError instanceof Error ? importError.message : "Unable to import template");
      }
    };
    reader.readAsText(file);
  }

  const canvasShadow = "0 24px 60px rgba(15,23,42,0.18)";
  const filteredPresets = TEMPLATE_PRESETS.filter((preset) => presetCategory === "all" || preset.documentType === presetCategory);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Close builder">
          <X size={18} />
        </button>
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white"><LayoutTemplate size={18} /></span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-600">Template builder</p>
            <Input value={name} onChange={(event) => setName(event.target.value)} className="h-8 w-64 border-0 px-1 text-base font-semibold focus:ring-0" aria-label="Template name" />
          </div>
        </div>
        <select value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          {DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{DOCUMENT_TYPE_LABELS[type]}</option>)}
        </select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-slate-200 bg-white">
            <button type="button" onClick={undo} disabled={!history.length} className="p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40" aria-label="Undo"><Undo2 size={16} /></button>
            <button type="button" onClick={() => setTab("templates")} className="p-2 text-slate-500 hover:bg-slate-50" aria-label="Templates"><LayoutTemplate size={16} /></button>
            <div className="flex items-center gap-1 px-2 text-xs text-slate-500">
              <button type="button" onClick={() => setZoom((value) => clamp(value - 0.1, 0.25, 1.5))} className="p-1 hover:text-slate-900" aria-label="Zoom out"><Minus size={14} /></button>
              {Math.round(zoom * 100)}%
              <button type="button" onClick={() => setZoom((value) => clamp(value + 0.1, 0.25, 1.5))} className="p-1 hover:text-slate-900" aria-label="Zoom in"><Plus size={14} /></button>
            </div>
          </div>
          <button type="button" onClick={exportJson} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" aria-label="Export JSON"><Download size={16} /></button>
          <button type="button" onClick={() => importRef.current?.click()} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" aria-label="Import JSON"><Upload size={16} /></button>
          <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) importJson(file); event.target.value = ""; }} />
          <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} />Default</label>
          <Button size="sm" onClick={() => void save()} disabled={saving}><Save size={15} />{saving ? "Saving" : "Save"}</Button>
        </div>
      </header>

      {(error || notice) && (
        <div className="border-b border-slate-200 bg-white px-4 py-2 text-sm">
          {error ? <span className="text-rose-600">{error}</span> : <span className="text-emerald-600">{notice}</span>}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="grid grid-cols-3 border-b border-slate-200 text-xs font-medium">
            {([["templates", "Templates", LayoutTemplate], ["elements", "Add", Plus], ["layers", "Layers", Layers]] as const).map(([key, label, Icon]) => (
              <button key={key} type="button" onClick={() => setTab(key)} className={cn("flex flex-col items-center gap-1 py-2.5 text-slate-500", tab === key && "bg-blue-50 text-blue-700")}>
                <Icon size={15} />{label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === "templates" && (
              <div className="space-y-3">
                <select value={presetCategory} onChange={(event) => setPresetCategory(event.target.value as DocumentType | "all")} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs">
                  {PRESET_CATEGORIES.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
                </select>
                <button type="button" onClick={() => applyPreset(blankDesign())} className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-left text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600">Blank A4 page</button>
                {filteredPresets.map((preset) => (
                  <button key={preset.id} type="button" onClick={() => applyPreset(preset.design)} className="w-full overflow-hidden rounded-xl border border-slate-200 text-left transition hover:border-blue-400">
                    <div className="flex h-20 items-center justify-center bg-slate-50 p-1">
                      <TemplatePageView design={preset.design} scale={Math.min(150 / preset.design.page.width, 68 / preset.design.page.height)} />
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs font-semibold text-slate-800">{preset.name}</p>
                      <p className="truncate text-[10px] text-slate-500">{DOCUMENT_TYPE_LABELS[preset.documentType]}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {tab === "elements" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Basic</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <ElementButton label="Heading" icon={<Type size={14} />} onClick={() => addText("Certificate of Achievement", 36, 700)} />
                    <ElementButton label="Text" icon={<Type size={14} />} onClick={() => addText("Your text here", 20)} />
                    <ElementButton label="Box" icon={<Square size={14} />} onClick={() => addElement({ type: "shape", x: 80, y: 80, width: 220, height: 120, fill: "#e2e8f0", radius: 8 })} />
                    <ElementButton label="Line" icon={<Minus size={14} />} onClick={() => addElement({ type: "line", x: 80, y: 240, width: 320, height: 2, stroke: "#94a3b8", strokeWidth: 2 })} />
                    <ElementButton label="Photo" icon={<ImageIcon size={14} />} onClick={() => addElement({ type: "photo", x: 80, y: 120, width: 180, height: 220, radius: 8, stroke: "#cbd5e1", strokeWidth: 2 })} />
                    <ElementButton label="QR code" icon={<QrCode size={14} />} onClick={() => addElement({ type: "qr", x: 640, y: 80, width: 96, height: 96, field: "qrCode" })} />
                    <ElementButton label="Table" icon={<TableIcon size={14} />} onClick={() => addElement({ type: "table", x: 48, y: 380, width: 698, height: 300, table: SUBJECT_TABLE, name: "Subject table" })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Student fields</p>
                  {DOCUMENT_FIELD_GROUPS.map((group) => (
                    <details key={group.label} className="rounded-lg border border-slate-200 p-2" open={group.label === "Student"}>
                      <summary className="cursor-pointer text-xs font-medium text-slate-700">{group.label}</summary>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {group.fields.map((field) => (
                          <button key={field} type="button" onClick={() => addField(field)} className="rounded border border-slate-200 px-1.5 py-1 text-[10px] text-slate-600 hover:border-blue-400 hover:text-blue-600">
                            {DOCUMENT_FIELD_LABELS[field as DocumentFieldKey]}
                          </button>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {tab === "layers" && (
              <div className="space-y-1">
                {[...design.elements].reverse().map((element) => (
                  <div key={element.id} className={cn("flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs", selectedId === element.id ? "border-blue-400 bg-blue-50" : "border-slate-200")}>
                    <button type="button" onClick={() => setSelectedId(element.id)} className="min-w-0 flex-1 truncate text-left">
                      {element.name ?? labelFor(element)}
                    </button>
                    <button type="button" onClick={() => updateElement(element.id, { locked: !element.locked })} className="text-slate-400 hover:text-slate-700" aria-label="Lock layer">
                      {element.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                    <button type="button" onClick={() => updateElement(element.id, { hidden: !element.hidden })} className="text-slate-400 hover:text-slate-700" aria-label="Hide layer">
                      {element.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                ))}
                {!design.elements.length && <p className="text-xs text-slate-500">No elements yet.</p>}
              </div>
            )}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
            <span>Page</span>
            <select
              value={pagePresetFor(design.page.width, design.page.height)}
              onChange={(event) => changePagePreset(event.target.value as PagePresetKey)}
              className="h-8 rounded-lg border border-slate-200 px-2 text-xs"
            >
              {PAGE_PRESET_KEYS.map((key) => <option key={key} value={key}>{PAGE_PRESETS[key].label}</option>)}
            </select>
            <label className="ml-2 flex items-center gap-1">Background
              <input type="color" value={design.page.background} onChange={(event) => mutate((current) => ({ ...current, page: { ...current.page, background: event.target.value } }), false)} />
            </label>
            <span className="ml-auto">{design.page.width} × {design.page.height} px</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_1px_1px,#cbd5e1_1px,transparent_0)] [background-size:16px_16px] p-8" onPointerDown={() => setSelectedId(null)}>
            <div className="mx-auto w-fit" style={{ boxShadow: canvasShadow }}>
              <TemplatePageView design={design} scale={zoom}>
                {design.elements.map((element) => {
                  const isSelected = element.id === selectedId;
                  return (
                    <div
                      key={element.id}
                      onPointerDown={(event) => startDrag(event, element)}
                      style={{
                        position: "absolute",
                        left: element.x,
                        top: element.y,
                        width: element.width,
                        height: element.height,
                        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                        outline: isSelected ? "2px solid #2563eb" : "1px dashed rgba(37,99,235,0.22)",
                        outlineOffset: 1,
                        cursor: element.locked ? "default" : "move",
                        touchAction: "none",
                      }}
                    >
                      {isSelected && !element.locked && (
                        <span
                          onPointerDown={(event) => startResize(event, element)}
                          style={{ position: "absolute", right: -6, bottom: -6, width: 12, height: 12, background: "#2563eb", border: "2px solid #ffffff", borderRadius: 3, cursor: "nwse-resize", touchAction: "none" }}
                        />
                      )}
                    </div>
                  );
                })}
              </TemplatePageView>
            </div>
          </div>
        </main>

        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4 xl:block">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Properties</p>
                <div className="flex gap-1">
                  <IconButton label="Duplicate" onClick={duplicateSelected}><Copy size={13} /></IconButton>
                  <IconButton label="Delete" onClick={deleteSelected}><Trash2 size={13} /></IconButton>
                </div>
              </div>
              <div>
                <Label>Layer name</Label>
                <Input value={selected.name ?? ""} placeholder={labelFor(selected)} onChange={(event) => updateSelected({ name: event.target.value }, false)} className="h-9 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="X" value={selected.x} onChange={(value) => updateSelected({ x: value })} />
                <NumberField label="Y" value={selected.y} onChange={(value) => updateSelected({ y: value })} />
                <NumberField label="Width" value={selected.width} onChange={(value) => updateSelected({ width: Math.max(8, value) })} />
                <NumberField label="Height" value={selected.height} onChange={(value) => updateSelected({ height: Math.max(8, value) })} />
                <NumberField label="Rotation" value={selected.rotation ?? 0} onChange={(value) => updateSelected({ rotation: value })} />
                <NumberField label="Radius" value={selected.radius ?? 0} onChange={(value) => updateSelected({ radius: value })} />
              </div>

              {(selected.type === "text") && (
                <div>
                  <Label>Text</Label>
                  <textarea
                    value={selected.text ?? ""}
                    onFocus={beginHistory}
                    onChange={(event) => updateSelected({ text: event.target.value }, false)}
                    className="min-h-20 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {selected.type === "field" && (
                <div>
                  <Label>Data field</Label>
                  <select value={selected.field ?? "fullName"} onChange={(event) => updateSelected({ field: event.target.value })} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs">
                    {DOCUMENT_FIELD_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.fields.map((field) => <option key={field} value={field}>{DOCUMENT_FIELD_LABELS[field]}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}

              {(selected.type === "image" || selected.type === "photo") && (
                <div>
                  <Label>Image URL</Label>
                  <Input value={selected.src ?? ""} placeholder="https://..." onChange={(event) => updateSelected({ src: event.target.value }, false)} className="h-9 text-xs" />
                </div>
              )}

              {selected.type === "qr" && (
                <div>
                  <Label>QR data field</Label>
                  <select value={selected.field ?? "qrCode"} onChange={(event) => updateSelected({ field: event.target.value })} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs">
                    <option value="qrCode">Verification link</option>
                    <option value="studentId">Student ID</option>
                    <option value="admissionNumber">Admission number</option>
                  </select>
                </div>
              )}

              {(selected.type === "text" || selected.type === "field") && (
                <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Typography</p>
                  <select value={selected.style?.fontFamily ?? "Inter"} onChange={(event) => updateStyle({ fontFamily: event.target.value })} className="h-8 w-full rounded-lg border border-slate-200 px-2 text-xs">
                    {FONT_FAMILIES.map((family) => <option key={family} value={family}>{family}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField label="Size" value={selected.style?.fontSize ?? 16} onChange={(value) => updateStyle({ fontSize: Math.max(6, value) })} />
                    <div>
                      <Label>Weight</Label>
                      <select value={String(selected.style?.fontWeight ?? 400)} onChange={(event) => updateStyle({ fontWeight: event.target.value })} className="h-8 w-full rounded-lg border border-slate-200 px-2 text-xs">
                        {[300, 400, 500, 600, 700, 800].map((weight) => <option key={weight} value={weight}>{weight}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <input type="color" value={selected.style?.color ?? "#0f172a"} onChange={(event) => updateStyle({ color: event.target.value })} aria-label="Text color" />
                    <div className="flex rounded-lg border border-slate-200 bg-white">
                      {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([align, Icon]) => (
                        <button key={align} type="button" onClick={() => updateStyle({ align })} className={cn("p-1.5", (selected.style?.align ?? "left") === align ? "bg-blue-50 text-blue-700" : "text-slate-500")} aria-label={`Align ${align}`}><Icon size={13} /></button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Vertical</Label>
                      <select value={selected.style?.verticalAlign ?? "top"} onChange={(event) => updateStyle({ verticalAlign: event.target.value as TemplateElementStyle["verticalAlign"] })} className="h-8 w-full rounded-lg border border-slate-200 px-2 text-xs">
                        <option value="top">Top</option>
                        <option value="middle">Middle</option>
                        <option value="bottom">Bottom</option>
                      </select>
                    </div>
                    <div>
                      <Label>Case</Label>
                      <select value={selected.style?.textTransform ?? "none"} onChange={(event) => updateStyle({ textTransform: event.target.value as TemplateElementStyle["textTransform"] })} className="h-8 w-full rounded-lg border border-slate-200 px-2 text-xs">
                        <option value="none">Normal</option>
                        <option value="uppercase">UPPER</option>
                        <option value="lowercase">lower</option>
                      </select>
                    </div>
                    <NumberField label="Spacing" value={selected.style?.letterSpacing ?? 0} onChange={(value) => updateStyle({ letterSpacing: value })} />
                    <NumberField label="Line height" value={selected.style?.lineHeight ?? 1.35} step={0.05} onChange={(value) => updateStyle({ lineHeight: value })} />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={selected.style?.underline ?? false} onChange={(event) => updateStyle({ underline: event.target.checked })} />Underline</label>
                </div>
              )}

              {(selected.type === "shape" || selected.type === "line") && (
                <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Appearance</p>
                  {selected.type === "shape" && (
                    <label className="flex items-center justify-between text-xs">Fill <input type="color" value={selected.fill && selected.fill !== "transparent" ? selected.fill : "#e2e8f0"} onChange={(event) => updateSelected({ fill: event.target.value })} /></label>
                  )}
                  <label className="flex items-center justify-between text-xs">Stroke <input type="color" value={selected.stroke ?? "#94a3b8"} onChange={(event) => updateSelected({ stroke: event.target.value })} /></label>
                  <NumberField label="Stroke width" value={selected.strokeWidth ?? 1} onChange={(value) => updateSelected({ strokeWidth: Math.max(0, value) })} />
                  <div>
                    <Label>Border style</Label>
                    <select value={selected.borderStyle ?? "solid"} onChange={(event) => updateSelected({ borderStyle: event.target.value as TemplateElement["borderStyle"] })} className="h-8 w-full rounded-lg border border-slate-200 px-2 text-xs">
                      {["solid", "dashed", "dotted", "double", "none"].map((style) => <option key={style} value={style}>{style}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {selected.type === "table" && selected.table && (
                <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Table</p>
                  <label className="flex items-center justify-between text-xs">Header <input type="color" value={selected.table.headerBackground ?? "#0f766e"} onChange={(event) => updateSelected({ table: { ...selected.table!, headerBackground: event.target.value } })} /></label>
                  <label className="flex items-center justify-between text-xs">Header text <input type="color" value={selected.table.headerColor ?? "#ffffff"} onChange={(event) => updateSelected({ table: { ...selected.table!, headerColor: event.target.value } })} /></label>
                  <NumberField label="Row height" value={selected.table.rowHeight ?? 32} onChange={(value) => updateSelected({ table: { ...selected.table!, rowHeight: value } })} />
                  <NumberField label="Font size" value={selected.table.fontSize ?? 13} onChange={(value) => updateSelected({ table: { ...selected.table!, fontSize: value } })} />
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selected.table.zebra ?? false} onChange={(event) => updateSelected({ table: { ...selected.table!, zebra: event.target.checked } })} />Zebra rows</label>
                  <div>
                    <Label>Rows (pipe separated)</Label>
                    <textarea
                      value={(selected.table.rows ?? []).map((row) => row.join(" | ")).join("\n")}
                      onFocus={beginHistory}
                      onChange={(event) => updateSelected({ table: { ...selected.table!, rows: event.target.value.split("\n").map((line) => line.split("|").map((cell) => cell.trim())).filter((row) => row.some((cell) => cell.length)) } }, false)}
                      className="min-h-24 w-full rounded-lg border border-slate-200 p-2 text-[11px] outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Layer</p>
                <label className="flex items-center justify-between text-xs">Opacity
                  <input type="range" min={0} max={100} value={Math.round((selected.opacity ?? 1) * 100)} onChange={(event) => updateSelected({ opacity: Number(event.target.value) / 100 }, false)} />
                </label>
                <div className="flex items-center justify-between text-xs">
                  <span>Locked</span>
                  <button type="button" onClick={() => updateSelected({ locked: !selected.locked })} className="text-slate-600">{selected.locked ? <Lock size={14} /> : <Unlock size={14} />}</button>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Hidden</span>
                  <button type="button" onClick={() => updateSelected({ hidden: !selected.hidden })} className="text-slate-600">{selected.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => moveLayer(selected.id, 1)}><ChevronUp size={13} />Front</Button>
                  <Button size="sm" variant="outline" onClick={() => moveLayer(selected.id, -1)}><ChevronDown size={13} />Back</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs text-slate-500">
              <p className="text-sm font-semibold text-slate-800">Design your document</p>
              <p>Select an element on the canvas to edit it, or add a new element from the left panel.</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>Drag to move, corner handle to resize.</li>
                <li>Arrow keys nudge; Shift + arrows move faster.</li>
                <li>Ctrl+Z undo, Ctrl+D duplicate, Delete removes.</li>
                <li>Import and export templates as JSON.</li>
              </ul>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="font-medium text-slate-700">Document data</p>
                <p className="mt-1">Fields such as name, class, GPA and QR are filled automatically when a document is generated.</p>
              </div>
            </div>
          )}
        </aside>
      </div>

      <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
        <span>{design.elements.length} elements · {history.length} undo steps</span>
        <div className="flex items-center gap-2 xl:hidden">
          <Button size="sm" variant="outline" onClick={exportJson}><Download size={13} />Export</Button>
          <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}><Upload size={13} />Import</Button>
          <Button size="sm" onClick={() => void save()} disabled={saving}><Save size={13} />Save</Button>
        </div>
      </footer>
    </div>
  );
}

function labelFor(element: TemplateElement) {
  if (element.type === "field") return DOCUMENT_FIELD_LABELS[element.field as DocumentFieldKey] ?? "Field";
  if (element.type === "text") return element.text?.slice(0, 24) || "Text";
  return element.type.charAt(0).toUpperCase() + element.type.slice(1);
}

function pagePresetFor(width: number, height: number): PagePresetKey {
  const match = PAGE_PRESET_KEYS.find((key) => PAGE_PRESETS[key].width === width && PAGE_PRESETS[key].height === height);
  return match ?? "a4-portrait";
}

function ElementButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2 text-left text-[11px] text-slate-600 hover:border-blue-400 hover:text-blue-600">
      {icon}{label}
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} title={label} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">{children}</button>;
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">{children}</p>;
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return (
    <div>
      <Label>{label}</Label>
      <input type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} className="h-8 w-full rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-blue-500" />
    </div>
  );
}
