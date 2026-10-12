import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Download, Loader2, Package, X } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { InstallPlan, executeModInstall, discardModInstall, getErrorMessage } from "../lib/ipc";
import { useTranslation } from "react-i18next";

export default function InstallPreviewModal({ plan, title, onClose, onInstalled }: {
  plan: InstallPlan; title: string; onClose: () => void; onInstalled: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0, filename: "" });
  const closeRef = useRef<HTMLButtonElement>(null);
  const starting = useRef(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    listen<{ plan_id: string; current: number; total: number; filename: string }>("mod-install-progress", event => {
      if (event.payload.plan_id === plan.id) setProgress(event.payload);
    }).then(unlisten => { if (disposed) unlisten(); else cleanup = unlisten; }).catch(() => {});
    return () => { disposed = true; cleanup?.(); };
  }, [plan.id]);
  const close = () => { discardModInstall(plan.id).catch(() => {}); onClose(); };
  const install = async () => {
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    try { await executeModInstall(plan.id); onInstalled(); }
    catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(false); }
  };
  const count = plan.items.filter(i => i.action !== "installed").length;
  return <div className="deck-modal-backdrop" onKeyDown={e => {
    if (e.key === "Escape" && !busy) close();
    if (e.key === "Tab") {
      const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled)'));
      if (controls.length === 0) { e.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }}>
    <section role="dialog" aria-modal="true" aria-labelledby="install-preview-title" className="deck-modal-window w-full max-w-2xl max-h-[85vh]">
      <div className="deck-modal-laser" />
      <header className="deck-modal-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#291b14] border border-[#f55e1d]/40 rounded flex items-center justify-center text-primary shrink-0 shadow-[0_0_12px_rgba(245,94,29,0.2)]">
            <Package className="text-[#f55e1d]" size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="deck-modal-eyebrow">{t("install_preview.eyebrow")}</span>
            <h2 id="install-preview-title" className="deck-modal-title truncate">{title}</h2>
          </div>
        </div>
        <button ref={closeRef} disabled={busy} onClick={close} aria-label={t("common.close")} className="deck-modal-close disabled:opacity-40"><X size={17} /></button>
      </header>
      <div className="p-5 overflow-y-auto custom-scrollbar space-y-4 bg-[#17120e]">
        <div className="grid grid-cols-3 border border-[#33241b] rounded overflow-hidden divide-x divide-[#33241b] bg-[#120e0c]">
          {[ [t("install_preview.files"), count], [t("install_preview.installed"), plan.items.length-count], [t("install_preview.conflicts"), plan.conflicts.length] ].map(([label,value]) => <div key={label} className="p-3 text-center"><div className="text-2xl font-bold font-sans text-white">{value}</div><div className="text-xs font-mono text-[#a69284]">{label}</div></div>)}
        </div>
        <p className="text-xs font-mono text-[#a69284]">{t("install_preview.description")}</p>
        <div className="border border-[#33241b] rounded overflow-hidden divide-y divide-[#33241b] bg-[#1a1410]">
          {plan.items.map((item,index) => <div key={`${item.task.source}:${item.task.id}`} className="flex gap-3 p-3 items-center">
            {item.action === "installed" ? <Check className="text-emerald-400 shrink-0" size={16} /> : <Download className="text-[#f55e1d] shrink-0" size={16} />}
            <div className="flex-1 min-w-0"><div className="text-xs font-mono font-bold text-white truncate">{item.task.name}</div><div className="text-[11px] font-mono text-[#a69284] break-all">{item.task.filename}</div><div className="text-[10px] font-mono text-[#78675c] mt-0.5">{item.task.source} · {index === plan.items.length-1 ? t("install_preview.selected") : t("install_preview.required")}</div></div>
            <span className={`text-[10px] font-mono shrink-0 px-2 py-0.5 rounded border ${item.action === "replace" ? "border-amber-500/40 text-amber-300 bg-amber-950/20" : "border-[#382921] text-[#a69284] bg-[#140f0c]"}`}>{t(`install_preview.${item.action}`)}</span>
          </div>)}
        </div>
        {plan.optional.length > 0 && <div className="bg-[#120e0c] border border-[#33241b] rounded p-3"><h3 className="text-xs font-mono font-bold text-white mb-1">{t("install_preview.optional")}</h3><p className="text-xs text-[#a69284] font-mono">{t("install_preview.optional_description")}</p><ul className="mt-2 space-y-1">{plan.optional.map(name => <li key={name} className="text-xs font-mono text-[#a69284]">• {name}</li>)}</ul></div>}
        {plan.conflicts.map(message => <div key={message} className="flex gap-2 bg-red-950/30 border border-red-500/40 rounded p-3 text-xs font-mono text-red-300"><AlertTriangle size={16} className="shrink-0 text-red-400" />{message}</div>)}
        {plan.warnings.map(message => <p key={message} className="text-xs font-mono text-amber-300 border-l-2 border-amber-500 pl-3 bg-amber-950/20 p-2 rounded-r">{message}</p>)}
        {error && <p role="alert" className="text-xs font-mono text-red-300 bg-red-950/30 border border-red-500/40 rounded p-3">{error}</p>}
        {busy && <div role="status" className="space-y-2"><p className="text-xs font-mono text-[#a69284]">{progress.filename || t("install_preview.preparing")} · {progress.current}/{progress.total || count}</p><div className="h-1.5 bg-[#120e0c] rounded overflow-hidden"><div className="h-full bg-gradient-to-r from-[#f55e1d] to-[#ff7537] transition-all" style={{ width: `${progress.total ? progress.current/progress.total*100 : 0}%` }} /></div></div>}
      </div>
      <footer className="deck-modal-footer">
        <p className="text-[11px] font-mono text-[#a69284]">{t("install_preview.integrity")}</p>
        <button onClick={error ? close : install} disabled={busy || (!error && plan.conflicts.length > 0)} className="deck-play-btn disabled:opacity-40 shrink-0">
          {busy ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}{error ? t("install_preview.reopen") : busy ? t("install_preview.installing") : t("install_preview.confirm")}
        </button>
      </footer>
    </section>
  </div>;
}
