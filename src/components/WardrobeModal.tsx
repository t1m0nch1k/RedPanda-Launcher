import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Shirt, Upload, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { Account, SkinPreview, command, getErrorMessage } from "../lib/ipc";
import SkinViewer from "./SkinViewer";
import { useTranslation } from "react-i18next";

interface SkinInstance { id: string; name: string; game_version: string; loader_type: string }
export default function WardrobeModal({ account, selectedInstance, onClose, onApplied }: {
  account: Account; selectedInstance: string | null; onClose: () => void; onApplied: (skin: SkinPreview) => void;
}) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<SkinPreview | null>(null);
  const [path, setPath] = useState("");
  const [model, setModel] = useState<"classic" | "slim">("classic");
  const [mode, setMode] = useState(account.account_type === "Microsoft" ? "profile" : "local");
  const [instances, setInstances] = useState<SkinInstance[]>([]);
  const [instanceId, setInstanceId] = useState(selectedInstance || "");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const chosen = useRef(false);
  useEffect(() => {
    let disposed = false;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    Promise.all([command<SkinPreview | null>("get_account_skin", { accountId: account.id }), command<SkinInstance[]>("get_instances")]).then(([skin, list]) => {
      if (disposed) return;
      if (!chosen.current) { setPreview(skin); if (skin?.model) setModel(skin.model); }
      const compatible = list.filter(i => i.loader_type !== "Vanilla");
      setInstances(compatible);
      setInstanceId(compatible.some(i => i.id === selectedInstance) ? selectedInstance! : compatible[0]?.id || "");
    }).catch(e => { if (!disposed) setError(getErrorMessage(e)); });
    return () => { disposed = true; previous?.focus(); };
  }, [account.id, selectedInstance]);
  const pick = async () => {
    setError(""); setSuccess(false); setLoading(true);
    try {
      const picked = await open({ multiple: false, filters: [{ name: "Minecraft skin PNG", extensions: ["png"] }] });
      if (!picked || Array.isArray(picked)) return;
      const skin = await command<SkinPreview>("preview_skin", { path: picked });
      chosen.current = true; setPreview(skin); setPath(picked);
      if (skin.height === 32) setModel("classic");
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setLoading(false); }
  };
  const apply = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(""); setSuccess(false);
    try {
      const skin = await command<SkinPreview>("apply_skin", { accountId: account.id, path, expectedSha256: preview?.sha256, model, mode, instanceId: mode === "local" ? instanceId : null });
      setPreview(skin); setSuccess(true); onApplied(skin);
    } catch (e) { setError(getErrorMessage(e)); }
    finally { pending.current = false; setBusy(false); }
  };
  const currentSkin = preview?.data_url || (account.account_type === "ElyBy" ? `https://skinsystem.ely.by/skins/${encodeURIComponent(account.username)}.png` : `https://minotar.net/skin/${account.uuid || encodeURIComponent(account.username)}`);
  return <div className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-6" onKeyDown={e => {
    if (e.key === "Escape" && !busy && !loading) onClose();
    if (e.key === "Tab") {
      const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)'));
      if (controls.length === 0) { e.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length-1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }}>
    <section role="dialog" aria-modal="true" aria-labelledby="wardrobe-title" className="bg-card brutalist-border w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col shadow-2xl">
      <header className="shrink-0 p-5 border-b border-border flex items-center gap-3"><Shirt size={24} className="text-primary" /><div className="flex-1"><p className="text-[10px] text-muted uppercase tracking-[.2em]">REDPANDA / {account.username}</p><h2 id="wardrobe-title" className="text-xl font-bold text-white">{t("wardrobe.title")}</h2></div><button ref={closeRef} onClick={onClose} disabled={busy || loading} aria-label={t("common.close")} className="p-2 text-muted hover:text-white disabled:opacity-40"><X size={20} /></button></header>
      <div className="grid grid-cols-[280px_1fr] max-[700px]:grid-cols-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="bg-background/70 border-r border-border flex flex-col items-center justify-center p-4 relative">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "linear-gradient(currentColor 1px, transparent 1px),linear-gradient(90deg,currentColor 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="relative"><SkinViewer skinUrl={currentSkin} model={model} width={240} height={320} /></div>
          <p className="text-xs text-muted relative text-center">{t("wardrobe.rotate")}</p>
          <span className="mt-3 text-[10px] border border-border px-3 py-1 text-muted uppercase tracking-wider relative">{model} / {preview ? `${preview.width} × ${preview.height}` : "3D PREVIEW"}</span>
        </div>
        <div className="p-5 space-y-4">
          <div><h3 className="text-sm text-white font-semibold mb-2">{t("wardrobe.file")}</h3><button onClick={pick} disabled={busy || loading} className="w-full border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 px-4 py-3 flex items-center gap-3 text-left disabled:opacity-40">{loading ? <Loader2 className="animate-spin text-primary" /> : <ImagePlus className="text-primary" />}<div><p className="text-sm text-white font-semibold">{path ? path.split(/[\\/]/).pop() : t("wardrobe.choose")}</p><p className="text-xs text-muted mt-1">PNG · 64×64 / 64×32 · {t("wardrobe.limit")}</p></div></button></div>
          <fieldset disabled={busy || loading}><legend className="text-sm font-semibold text-white mb-2">{t("wardrobe.model")}</legend><div className="grid grid-cols-2 gap-2">{(["classic", "slim"] as const).map(value => <button key={value} disabled={value === "slim" && preview?.height === 32} aria-pressed={model === value} onClick={() => { setModel(value); setSuccess(false); }} className={`p-2.5 border text-left disabled:opacity-40 ${model === value ? "border-primary bg-primary/10 text-white" : "border-border text-muted hover:text-white"}`}><span className="text-sm font-semibold">{value === "classic" ? "Classic" : "Slim"}</span><p className="text-xs mt-1">{t(value === "classic" ? "wardrobe.classic" : "wardrobe.slim")}</p></button>)}</div></fieldset>
          <div><label htmlFor="skin-mode" className="text-sm text-white font-semibold block mb-2">{t("wardrobe.destination")}</label><select id="skin-mode" value={mode} disabled={busy || loading} onChange={e => { setMode(e.target.value); setSuccess(false); }} className="w-full bg-background border border-border p-2.5 text-sm text-white">{account.account_type === "Microsoft" && <option value="profile">{t("wardrobe.profile")}</option>}<option value="local">{t("wardrobe.local")}</option></select>
          {mode === "local" && <><label htmlFor="skin-instance" className="sr-only">{t("wardrobe.instance")}</label><select id="skin-instance" value={instanceId} disabled={busy || loading} onChange={e => { setInstanceId(e.target.value); setSuccess(false); }} className="w-full mt-2 bg-background border border-border p-2.5 text-sm text-white">{instances.length === 0 && <option value="">{t("wardrobe.no_instance")}</option>}{instances.map(i => <option key={i.id} value={i.id}>{i.name} · {i.game_version} {i.loader_type}</option>)}</select></>}
          <p className="text-xs text-muted leading-relaxed mt-3">{t(mode === "profile" ? "wardrobe.profile_description" : "wardrobe.local_description")}</p></div>
          {error && <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 p-3">{error}</p>}
          {success && <p role="status" className="text-sm text-green-300 flex items-start gap-2"><Check size={18} className="shrink-0" />{t(mode === "profile" ? "wardrobe.success_profile" : "wardrobe.success_local")}</p>}

        </div>
      </div>
      <footer className="shrink-0 p-4 border-t border-border flex justify-between items-center gap-4 bg-background/50">
        <p className="text-xs text-muted">{preview ? `${preview.width} × ${preview.height} · ${model === "classic" ? "Classic" : "Slim"}` : t("wardrobe.choose")}</p>
        <button onClick={apply} disabled={!path || busy || loading || (mode === "local" && !instanceId)} className="bg-primary hover:brightness-110 text-white px-6 py-3 font-semibold text-sm flex justify-center items-center gap-2 disabled:opacity-40">{busy ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}{t(busy ? "wardrobe.applying" : "wardrobe.apply")}</button>
      </footer>
    </section>
  </div>;
}
