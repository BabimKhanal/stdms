"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Palette } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { CloudinaryUpload } from "./cloudinary-upload";

export type OrganisationBranding = {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
};

export function BrandingSettings({
  branding,
  onSaved,
}: {
  branding: OrganisationBranding;
  onSaved: (branding: OrganisationBranding) => void;
}) {
  const [form, setForm] = useState(branding);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const updated = await new EduApiClient(
        undefined,
        () => localStorage.getItem("edu_access_token"),
      ).put<OrganisationBranding>("/organisation/branding", {
        ...form,
        name: form.name.trim(),
        logoUrl: form.logoUrl || null,
      });
      setForm(updated);
      onSaved(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save branding");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-blue-600">Workspace appearance</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Branding</h2>
        <p className="mt-2 text-sm text-slate-500">
          Make this workspace reflect your institution. Changes apply only to your tenant.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette size={18} />
            Institution identity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-6 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Institution name
              </span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                maxLength={120}
                required
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Primary color
              </span>
              <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3">
                <input
                  type="color"
                  aria-label="Choose primary color"
                  value={form.primaryColor}
                  onChange={(event) => setForm({ ...form, primaryColor: event.target.value })}
                  className="h-7 w-10 cursor-pointer border-0 bg-transparent p-0"
                />
                <span className="font-mono text-sm uppercase text-slate-600">
                  {form.primaryColor}
                </span>
              </div>
            </label>

            <div className="space-y-3 md:col-span-2">
              <div>
                <p className="text-sm font-medium text-slate-700">Institution logo</p>
                <p className="mt-1 text-xs text-slate-500">Upload an image to use in the portal navigation.</p>
              </div>
              <CloudinaryUpload
                folder="branding"
                accept="image/*"
                value={form.logoUrl ?? ""}
                onChange={(logoUrl) => setForm({ ...form, logoUrl })}
                label="Upload institution logo"
              />
              {form.logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm({ ...form, logoUrl: null })}
                >
                  Remove logo
                </Button>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Preview
              </p>
              <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-white"
                  style={{ backgroundColor: form.primaryColor }}
                >
                  {form.logoUrl ? (
                    <Image
                      src={form.logoUrl}
                      alt=""
                      width={44}
                      height={44}
                      unoptimized
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Palette size={20} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {form.name || "Institution name"}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">Tenant workspace</span>
                </span>
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2">
                {error}
              </p>
            )}
            {saved && (
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 md:col-span-2">
                <Check size={16} />
                Branding saved.
              </p>
            )}
            <div className="md:col-span-2">
              <Button disabled={saving}>
                {saving ? "Saving..." : "Save branding"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
