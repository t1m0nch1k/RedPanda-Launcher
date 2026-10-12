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
  return <div className="deck-modal-backdrop" onKeyDown={e => {
    if (e.key === "Escape" && !busy && !loading) onClose();
    if (e.key === "Tab") {
      const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)'));
      if (controls.length === 0) { e.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length-1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }}>
    <section role="dialog" aria-modal="true" aria-labelledby="wardrobe-title" className="deck-modal-window w-full max-w-3xl max-h-[88vh]">
      <div className="deck-modal-laser" />
      <header className="deck-modal-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#291b14] border border-[#f55e1d]/40 rounded flex items-center justify-center text-primary shrink-0 shadow-[0_0_12px_rgba(245,94,29,0.2)]">
            <Shirt size={20} className="text-[#f55e1d]" />
          </div>
          <div className="flex-1">
            <span className="deck-modal-eyebrow">REDPANDA / {account.username}</span>
            <h2 id="wardrobe-title" className="deck-modal-title">{t("wardrobe.title")}</h2>
          </div>
        </div>
        <button ref={closeRef} onClick={onClose} disabled={busy || loading} aria-label={t("common.close")} className="deck-modal-close disabled:opacity-40"><X size={17} /></button>
      </header>
      <div className="grid grid-cols-[280px_1fr] max-[700px]:grid-cols-1 min-h-0 overflow-y-auto custom-scrollbar bg-[#16110e]">
        <div className="bg-[#120e0c] border-r border-[#33241b] flex flex-col items-center justify-center p-4 relative">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "linear-gradient(currentColor 1px, transparent 1px),linear-gradient(90deg,currentColor 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="relative"><SkinViewer skinUrl={currentSkin} model={model} width={240} height={320} /></div>
          <p className="text-xs text-[#a69284] font-mono relative text-center mt-2">{t("wardrobe.rotate")}</p>
          <span className="mt-3 text-[10px] font-mono border border-[#382921] bg-[#1a1410] px-3 py-1 text-[#f5ece5] uppercase tracking-wider relative rounded">{model} / {preview ? `${preview.width} × ${preview.height}` : "3D PREVIEW"}</span>
        </div>
        <div className="p-5 space-y-4">
          <div><h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#f55e1d]" />{t("wardrobe.file")}</h3><button onClick={pick} disabled={busy || loading} className="w-full border border-dashed border-[#f55e1d]/50 bg-[#241710] hover:bg-[#301d14] rounded px-4 py-3 flex items-center gap-3 text-left disabled:opacity-40 transition-colors">{loading ? <Loader2 className="animate-spin text-primary" /> : <ImagePlus className="text-primary" />}<div><p className="text-sm text-white font-semibold">{path ? path.split(/[\\/]/).pop() : t("wardrobe.choose")}</p><p className="text-xs text-[#a69284] font-mono mt-1">PNG · 64×64 / 64×32 · {t("wardrobe.limit")}</p></div></button></div>
          <fieldset disabled={busy || loading}><legend className="text-xs font-mono font-bold text-white uppercase tracking-wider mb-2">{t("wardrobe.model")}</legend><div className="grid grid-cols-2 gap-2">{(["classic", "slim"] as const).map(value => <button key={value} disabled={value === "slim" && preview?.height === 32} aria-pressed={model === value} onClick={() => { setModel(value); setSuccess(false); }} className={`p-2.5 rounded border text-left transition-all disabled:opacity-40 ${model === value ? "border-[#f55e1d] bg-[#2d1b13] text-white shadow-[0_0_12px_rgba(245,94,29,0.2)]" : "border-[#382921] bg-[#1a1410] text-[#a69284] hover:text-white"}`}><span className="text-sm font-semibold block">{value === "classic" ? "Classic" : "Slim"}</span><p className="text-xs mt-1 font-mono">{t(value === "classic" ? "wardrobe.classic" : "wardrobe.slim")}</p></button>)}</div></fieldset>
          <div><label htmlFor="skin-mode" className="text-xs font-mono font-bold text-white uppercase tracking-wider block mb-2">{t("wardrobe.destination")}</label><select id="skin-mode" value={mode} disabled={busy || loading} onChange={e => { setMode(e.target.value); setSuccess(false); }} className="w-full bg-[#120e0c] border border-[#382921] focus:border-[#f55e1d] rounded p-2.5 text-xs font-mono text-white focus:outline-none">{account.account_type === "Microsoft" && <option value="profile">{t("wardrobe.profile")}</option>}<option value="local">{t("wardrobe.local")}</option></select>
          {mode === "local" && <><label htmlFor="skin-instance" className="sr-only">{t("wardrobe.instance")}</label><select id="skin-instance" value={instanceId} disabled={busy || loading} onChange={e => { setInstanceId(e.target.value); setSuccess(false); }} className="w-full mt-2 bg-[#120e0c] border border-[#382921] focus:border-[#f55e1d] rounded p-2.5 text-xs font-mono text-white focus:outline-none">{instances.length === 0 && <option value="">{t("wardrobe.no_instance")}</option>}{instances.map(i => <option key={i.id} value={i.id}>{i.name} · {i.game_version} {i.loader_type}</option>)}</select></>}
          <p className="text-xs text-[#a69284] font-mono leading-relaxed mt-2">{t(mode === "profile" ? "wardrobe.profile_description" : "wardrobe.local_description")}</p></div>
          {error && <p role="alert" className="text-xs font-mono text-red-300 bg-red-950/30 border border-red-500/30 rounded p-3">{error}</p>}
          {success && <p role="status" className="text-xs font-mono text-green-300 bg-emerald-950/30 border border-emerald-500/30 rounded flex items-start gap-2 p-3"><Check size={16} className="shrink-0 text-emerald-400" />{t(mode === "profile" ? "wardrobe.success_profile" : "wardrobe.success_local")}</p>}
        </div>
      </div>
      <footer className="deck-modal-footer">
        <p className="text-xs text-[#a69284] font-mono">{preview ? `${preview.width} × ${preview.height} · ${model === "classic" ? "Classic" : "Slim"}` : t("wardrobe.choose")}</p>
        <button onClick={apply} disabled={!path || busy || loading || (mode === "local" && !instanceId)} className="deck-play-btn disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}{t(busy ? "wardrobe.applying" : "wardrobe.apply")}</button>
      </footer>
    </section>
  </div>;
}
