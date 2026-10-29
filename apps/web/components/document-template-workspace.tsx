"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Download,
  Eye,
  FileText,
  LayoutTemplate,
  Pencil,
  Plus,
  Printer,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
  type TemplateDesign,
} from "@edu/shared";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Modal } from "./ui/modal";
import { TemplatePageView, TemplateThumbnail } from "./template-preview";
import { TemplateBuilder, type TemplateDraft } from "./template-builder";
import {
  PRESET_CATEGORIES,
  TEMPLATE_PRESETS,
  blankDesign,
  normalizeDesign,
  type TemplatePreset,
} from "../lib/template-presets";
import { cn } from "../lib/utils";

type Template = {
  id: string;
  name: string;
  documentType: DocumentType;
  design: unknown;
  isDefault: number;
};

type PreviewState = { name: string; documentType: DocumentType; design: TemplateDesign; id?: string };

export function DocumentTemplateWorkspace() {
  const api = useMemo(() => new EduApiClient(undefined, () => localStorage.getItem("edu_access_token")), []);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [category, setCategory] = useState<DocumentType | "all">("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const result = await api.get<{ data: Template[] }>("/organisation/document-templates");
      setTemplates(result.data);
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Unable to load document templates" });
    }
  }

  useEffect(() => {
    // Loading persisted templates is the external synchronization this effect owns.
    void api
      .get<{ data: Template[] }>("/organisation/document-templates")
      .then((result) => setTemplates(result.data))
      .catch((error: unknown) => setMessage({ kind: "error", text: error instanceof Error ? error.message : "Unable to load document templates" }));
  }, [api]);

  const normalized = useMemo(
    () => templates.map((template) => ({ ...template, design: normalizeDesign(template.design) })),
    [templates],
  );

  const visibleTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return normalized.filter((template) => {
      const matchesCategory = category === "all" || template.documentType === category;
      const matchesSearch = !term || template.name.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [normalized, category, search]);

  const visiblePresets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return TEMPLATE_PRESETS.filter((preset) => {
      const matchesCategory = category === "all" || preset.documentType === category;
      const matchesSearch = !term || preset.name.toLowerCase().includes(term) || preset.description.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [category, search]);

  function openPreset(preset: TemplatePreset) {
    setDraft({ name: preset.name, documentType: preset.documentType, design: structuredClone(preset.design) });
  }

  function openBlank() {
    setDraft({ name: "Untitled template", documentType: category === "all" ? "custom" : category, design: blankDesign() });
  }

  function openTemplate(template: Template, design: TemplateDesign) {
    setDraft({ id: template.id, name: template.name, documentType: template.documentType, design: structuredClone(design), isDefault: Boolean(template.isDefault) });
  }

  async function persist(draftValue: TemplateDraft, makeDefault: boolean) {
    const payload = {
      name: draftValue.name,
      documentType: draftValue.documentType,
      design: draftValue.design,
      isDefault: makeDefault,
    };
    const saved = draftValue.id
      ? await api.put<{ id: string }>(`/organisation/document-templates/${draftValue.id}`, payload)
      : await api.post<{ id: string }>("/organisation/document-templates", payload);
    setMessage({ kind: "info", text: "Template saved." });
    await load();
    return saved.id;
  }

  async function duplicate(template: Template, design: TemplateDesign) {
    try {
      await api.post("/organisation/document-templates", {
        name: `${template.name} copy`.slice(0, 100),
        documentType: template.documentType,
        design,
        isDefault: false,
      });
      setMessage({ kind: "info", text: "Template duplicated." });
      await load();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Unable to duplicate template" });
    }
  }

  async function makeDefault(template: Template, design: TemplateDesign) {
    try {
      await api.put(`/organisation/document-templates/${template.id}`, {
        name: template.name,
        documentType: template.documentType,
        design,
        isDefault: true,
      });
      setMessage({ kind: "info", text: `${template.name} is now the default ${DOCUMENT_TYPE_LABELS[template.documentType].toLowerCase()}.` });
      await load();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Unable to set default template" });
    }
  }

  async function remove(template: Template) {
    if (!window.confirm(`Delete ${template.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/organisation/document-templates/${template.id}`);
      setMessage({ kind: "info", text: "Template deleted." });
      await load();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Unable to delete template" });
    }
  }

  function exportOne(template: Template, design: TemplateDesign) {
    downloadJson(
      `${template.name.replace(/\s+/g, "-").toLowerCase() || "template"}.json`,
      { name: template.name, documentType: template.documentType, design },
    );
  }

  function exportAll() {
    downloadJson("document-templates.json", {
      version: 2,
      exportedAt: new Date().toISOString(),
      templates: normalized.map((template) => ({ name: template.name, documentType: template.documentType, design: template.design })),
    });
  }

  async function importFile(file: File) {
    setImporting(true);
    setMessage(null);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const entries = collectImports(parsed);
      if (!entries.length) throw new Error("No templates found in the file");
      const payload = entries.map((entry, index) => {
        const design = normalizeDesign(entry.design ?? entry);
        const name = typeof entry.name === "string" && entry.name.trim() ? entry.name.trim().slice(0, 100) : `Imported template ${index + 1}`;
        const documentType = DOCUMENT_TYPES.includes(entry.documentType as DocumentType) ? (entry.documentType as DocumentType) : "custom";
        return { name, documentType, design, isDefault: Boolean(entry.isDefault) };
      });
      const result = await api.post<{ imported: number; failed: { name: string; reason: string }[] }>("/organisation/document-templates/import", { templates: payload });
      setMessage({
        kind: result.failed.length ? "error" : "info",
        text: result.failed.length
          ? `Imported ${result.imported} template(s). ${result.failed.length} failed: ${result.failed.map((item) => `${item.name} (${item.reason})`).join("; ")}`
          : `Imported ${result.imported} template(s).`,
      });
      await load();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Unable to import templates" });
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  }

  async function printTemplate(template: Template) {
    try {
      const token = localStorage.getItem("edu_access_token");
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
      const response = await fetch(`${base}/organisation/document-templates/${template.id}/preview`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Unable to open document preview");
      const windowRef = window.open("", "_blank");
      if (!windowRef) throw new Error("Allow pop-ups to print documents");
      windowRef.document.write(await response.text());
      windowRef.document.close();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Unable to open document preview" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-600">Document studio</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Design every document your school issues</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Start from {TEMPLATE_PRESETS.length} professionally designed templates, then customize layouts, typography, colours, fields, tables and verification marks in a canvas editor.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => importRef.current?.click()} disabled={importing}>
            <Upload size={15} />{importing ? "Importing..." : "Import"}
          </Button>
          <Button variant="outline" onClick={exportAll} disabled={!normalized.length}>
            <Download size={15} />Export all
          </Button>
          <Button onClick={openBlank}><Plus size={15} />New template</Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
            }}
          />
        </div>
      </div>

      {message && (
        <div className={cn("flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm", message.kind === "error" ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700")}>
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss"><X size={15} /></button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {PRESET_CATEGORIES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setCategory(item.key)}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600", category === item.key && "bg-white text-slate-900 shadow-sm")}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="relative ml-auto w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search templates" className="h-9 pl-9 text-sm" />
        </label>
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h3 className="text-lg font-semibold">Ready-made templates</h3>
            <p className="text-sm text-slate-500">Click a template to open it in the visual builder.</p>
          </div>
          <span className="text-xs text-slate-400">{visiblePresets.length} templates</span>
        </div>
        {visiblePresets.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visiblePresets.map((preset) => (
              <div key={preset.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg">
                <button type="button" className="block w-full text-left" onClick={() => openPreset(preset)}>
                  <TemplateThumbnail design={preset.design} width={360} />
                </button>
                <div className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{preset.name}</p>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                      {DOCUMENT_TYPE_LABELS[preset.documentType]}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs text-slate-500">{preset.description}</p>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" onClick={() => openPreset(preset)}><Pencil size={13} />Customize</Button>
                    <Button size="sm" variant="outline" onClick={() => setPreview({ name: preset.name, documentType: preset.documentType, design: preset.design })}><Eye size={13} />Preview</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No templates match this filter.</p>
        )}
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Saved templates</CardTitle>
          <span className="text-xs text-slate-400">{visibleTemplates.length} saved</span>
        </CardHeader>
        <CardContent>
          {visibleTemplates.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleTemplates.map((template) => (
                <div key={template.id} className="space-y-2 rounded-2xl border border-slate-200 p-3">
                  <button type="button" className="block w-full" onClick={() => openTemplate(template, template.design)}>
                    <TemplateThumbnail design={template.design} width={260} />
                  </button>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{template.name}</p>
                      <p className="text-xs text-slate-500">{DOCUMENT_TYPE_LABELS[template.documentType]}</p>
                    </div>
                    {template.isDefault ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700"><Star size={10} />Default</span> : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => openTemplate(template, template.design)}><Pencil size={13} />Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => setPreview({ id: template.id, name: template.name, documentType: template.documentType, design: template.design })}><Eye size={13} />View</Button>
                    <Button size="sm" variant="ghost" onClick={() => void printTemplate(template)} title="Print"><Printer size={13} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => void duplicate(template, template.design)} title="Duplicate"><Copy size={13} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => exportOne(template, template.design)} title="Export JSON"><Download size={13} /></Button>
                    {!template.isDefault && <Button size="sm" variant="ghost" onClick={() => void makeDefault(template, template.design)} title="Set as default"><Star size={13} /></Button>}
                    <Button size="sm" variant="ghost" onClick={() => void remove(template)} title="Delete"><Trash2 size={13} /></Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <FileText size={24} className="text-slate-300" />
              <p className="text-sm text-slate-500">No saved templates yet. Customize a ready-made template or start from a blank page.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}><Upload size={13} />Import</Button>
                <Button size="sm" onClick={openBlank}><Plus size={13} />New template</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {draft && (
        <TemplateBuilder
          initial={draft}
          onClose={() => setDraft(null)}
          onSave={persist}
        />
      )}

      {preview && (
        <Modal open title={preview.name} description={`${DOCUMENT_TYPE_LABELS[preview.documentType]} preview`} onClose={() => setPreview(null)}>
          <div className="space-y-4">
            <div className="flex max-h-[70vh] justify-center overflow-auto rounded-xl bg-slate-100 p-4">
              <div className="shadow-lg">
                <TemplatePageView design={preview.design} scale={Math.min(660 / preview.design.page.width, 640 / preview.design.page.height)} />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setPreview(null)}>Close</Button>
              <Button onClick={() => openTemplateFromPreview(preview)}><LayoutTemplate size={15} />Customize</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );

  function openTemplateFromPreview(state: PreviewState) {
    setDraft({ id: state.id, name: state.name, documentType: state.documentType, design: structuredClone(state.design) });
    setPreview(null);
  }
}

function downloadJson(filename: string, payload: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type ImportEntry = Record<string, unknown>;

function collectImports(parsed: unknown): ImportEntry[] {
  if (Array.isArray(parsed)) return parsed.filter((item): item is ImportEntry => Boolean(item) && typeof item === "object");
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.templates)) return record.templates.filter((item): item is ImportEntry => Boolean(item) && typeof item === "object");
    if (record.template && typeof record.template === "object") return [record.template as ImportEntry];
    return [record];
  }
  return [];
}
