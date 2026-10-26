"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { EduApiClient } from "@edu/api-client";
import { Button } from "./ui/button";
import { FilePreview } from "./file-preview";

type UploadFolder = "students" | "users" | "assignments" | "content" | "documents" | "branding";
type UploadProps = { value: string; onChange: (url: string) => void; folder: UploadFolder; accept?: string; label?: string };
type MultiUploadProps = { values: string[]; onChange: (urls: string[]) => void; folder: UploadFolder; accept?: string; label?: string };

async function uploadToCloudinary(file: File, folder: MultiUploadProps["folder"]) {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const resourceType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "raw";
  const signed = await api.post<{ cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string }>("/uploads/sign", { folder, resourceType });
  const body = new FormData(); body.append("file", file); body.append("api_key", signed.apiKey); body.append("timestamp", String(signed.timestamp)); body.append("signature", signed.signature); body.append("folder", signed.folder);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/${resourceType}/upload`, { method: "POST", body });
  const result = await response.json() as { secure_url?: string; error?: { message?: string } };
  if (!response.ok || !result.secure_url) throw new Error(result.error?.message ?? "Cloudinary upload failed");
  return result.secure_url;
}

export function CloudinaryUpload({ value, onChange, folder, accept, label = "Upload file" }: UploadProps) {
  const inputRef = useRef<HTMLInputElement>(null); const [uploading, setUploading] = useState(false); const [error, setError] = useState("");
  async function upload(file: File) {
    setUploading(true); setError("");
    try {
      const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
      const resourceType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "raw";
      const signed = await api.post<{ cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string; resourceType: string }>("/uploads/sign", { folder, resourceType });
      const body = new FormData(); body.append("file", file); body.append("api_key", signed.apiKey); body.append("timestamp", String(signed.timestamp)); body.append("signature", signed.signature); body.append("folder", signed.folder);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/${resourceType}/upload`, { method: "POST", body }); const result = await response.json() as { secure_url?: string; error?: { message?: string } };
      if (!response.ok || !result.secure_url) throw new Error(result.error?.message ?? "Cloudinary upload failed");
      onChange(result.secure_url);
    } catch (err) { setError(err instanceof Error ? err.message : "Upload failed"); } finally { setUploading(false); }
  }
  return <div className="space-y-2"><input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} /><Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}><Upload size={15} />{uploading ? "Uploading..." : label}</Button>{value && <FilePreview url={value} label="Uploaded file" compact />}{error && <p className="text-xs text-rose-600">{error}</p>}</div>;
}

export function CloudinaryMultiUpload({ values, onChange, folder, accept, label = "Upload files" }: MultiUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null); const [uploading, setUploading] = useState(false); const [error, setError] = useState("");
  async function upload(files: FileList) {
    setUploading(true); setError("");
    try { const urls: string[] = []; for (const file of Array.from(files)) urls.push(await uploadToCloudinary(file, folder)); onChange([...values, ...urls]); } catch (err) { setError(err instanceof Error ? err.message : "Upload failed"); } finally { setUploading(false); }
  }
  return <div className="space-y-3"><input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={(event) => { if (event.target.files?.length) void upload(event.target.files); event.currentTarget.value = ""; }} /><Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}><Upload size={15} />{uploading ? "Uploading..." : label}</Button>{values.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{values.map((url, index) => <div key={`${url}-${index}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2"><div className="min-w-0 flex-1"><FilePreview url={url} label={`Attachment ${index + 1}`} compact /></div><button type="button" className="px-2 text-xs font-semibold text-rose-600" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</div>}{error && <p className="text-xs text-rose-600">{error}</p>}</div>;
}
