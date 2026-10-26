"use client";
/* eslint-disable @next/next/no-img-element */

import { FileText, ExternalLink, Film } from "lucide-react";

export function FilePreview({ url, label = "Attachment", compact = false }: { url?: string | null; label?: string; compact?: boolean }) {
  if (!url) return null;
   const lower = url.toLowerCase(); const isPdf = /\.pdf(\?|$)/.test(lower); const legacyPdf = isPdf && lower.includes("/image/upload/"); const isImage = !isPdf && (/\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/.test(lower) || lower.includes("/image/upload/")); const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/.test(lower) || lower.includes("/video/upload/");
   if (legacyPdf) return <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"><FileText size={16} className="mt-0.5 shrink-0" /><span><span className="font-medium">PDF needs re-upload</span><span className="block text-xs text-amber-700">This file was uploaded as an image. Upload it again so Cloudinary stores it as a document.</span></span></div>;
  if (isImage) return <a href={url} target="_blank" rel="noreferrer" className={compact ? "block" : "block overflow-hidden rounded-xl border border-slate-200"}><img src={url} alt={label} className={compact ? "h-16 w-16 rounded-lg object-cover" : "max-h-64 w-full object-contain"} /></a>;
  if (isVideo) return <div className={compact ? "overflow-hidden rounded-lg" : "overflow-hidden rounded-xl border border-slate-200"}><video controls className={compact ? "h-16 w-28 object-cover" : "max-h-64 w-full"} src={url} /><a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600"><Film size={13} />Open video</a></div>;
   return <a href={url} target="_blank" rel="noreferrer" download className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-blue-700"><FileText size={16} />{label}<span className="ml-auto text-xs text-slate-400">Download</span><ExternalLink size={13} /></a>;
}
