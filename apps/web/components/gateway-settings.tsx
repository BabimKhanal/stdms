"use client";

import { useEffect, useState } from "react";
import { EduApiClient } from "@edu/api-client";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

type Provider = "esewa" | "khalti" | "fonepay" | "connectips" | "card" | "other";
type Setting = { provider: Provider; enabled: number; merchantCode: string | null; publicKey: string | null; apiUrl: string | null; hasSecret: boolean };
const providers: Array<{ key: Provider; label: string }> = [{ key: "esewa", label: "eSewa" }, { key: "khalti", label: "Khalti" }, { key: "fonepay", label: "Fonepay" }, { key: "connectips", label: "ConnectIPS" }, { key: "card", label: "Card gateway" }, { key: "other", label: "Other provider" }];

export function GatewaySettings() {
  const api = new EduApiClient(undefined, () => localStorage.getItem("edu_access_token"));
  const [settings, setSettings] = useState<Setting[]>([]);
  const [provider, setProvider] = useState<Provider>("esewa");
  const [enabled, setEnabled] = useState(false);
  const [merchantCode, setMerchantCode] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [error, setError] = useState("");
  async function load() { try { const result = await api.get<{ data: Setting[] }>("/fees/gateway-settings"); setSettings(result.data); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load gateway settings"); } }
  useEffect(() => { void api.get<{ data: Setting[] }>("/fees/gateway-settings").then((result) => setSettings(result.data)).catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load gateway settings")); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function select(value: Provider) { const setting = settings.find((item) => item.provider === value); setProvider(value); setEnabled(Boolean(setting?.enabled)); setMerchantCode(setting?.merchantCode ?? ""); setPublicKey(setting?.publicKey ?? ""); setApiUrl(setting?.apiUrl ?? ""); setSecretKey(""); }
  async function save() { try { await api.put(`/fees/gateway-settings/${provider}`, { enabled, merchantCode: merchantCode || null, secretKey: secretKey || null, publicKey: publicKey || null, apiUrl: apiUrl || null }); setSecretKey(""); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save gateway settings"); } }
  return <Card><CardHeader><CardTitle>Tenant payment gateways</CardTitle><p className="text-sm text-slate-500">Each school can configure and enable its own provider credentials. Existing secrets are never displayed.</p></CardHeader><CardContent className="space-y-4">{error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}<div className="flex flex-wrap gap-2">{providers.map((item) => <Button key={item.key} type="button" variant={provider === item.key ? "primary" : "outline"} onClick={() => select(item.key)}>{item.label}{settings.find((setting) => setting.provider === item.key)?.enabled ? " · On" : ""}</Button>)}</div><div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enable {providers.find((item) => item.key === provider)?.label} for this school</label><Input placeholder="Merchant / account code" value={merchantCode} onChange={(event) => setMerchantCode(event.target.value)} /><Input type="password" placeholder="Secret key (leave blank to keep existing)" value={secretKey} onChange={(event) => setSecretKey(event.target.value)} /><Input placeholder="Public key (optional)" value={publicKey} onChange={(event) => setPublicKey(event.target.value)} /><Input placeholder="Provider API or form URL (optional)" value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} /></div><Button onClick={() => void save()}>Save gateway settings</Button></CardContent></Card>;
}
