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
  return <div className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-6" onKeyDown={e => {
    if (e.key === "Escape" && !busy) close();
    if (e.key === "Tab") {
      const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled)'));
      if (controls.length === 0) { e.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }}>
    <section role="dialog" aria-modal="true" aria-labelledby="install-preview-title" className="w-full max-w-2xl max-h-[85vh] bg-card brutalist-border flex flex-col shadow-2xl">
      <header className="p-5 border-b border-border flex items-center gap-3">
        <Package className="text-primary" size={24} />
        <div className="flex-1 min-w-0"><p className="text-[10px] uppercase tracking-[.2em] text-muted">{t("install_preview.eyebrow")}</p><h2 id="install-preview-title" className="font-bold text-xl text-white truncate">{title}</h2></div>
        <button ref={closeRef} disabled={busy} onClick={close} aria-label={t("common.close")} className="p-2 text-muted hover:text-white disabled:opacity-40"><X size={20} /></button>
      </header>
      <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">
        <div className="grid grid-cols-3 border border-border divide-x divide-border">
          {[ [t("install_preview.files"), count], [t("install_preview.installed"), plan.items.length-count], [t("install_preview.conflicts"), plan.conflicts.length] ].map(([label,value]) => <div key={label} className="p-3"><div className="text-2xl font-bold text-white">{value}</div><div className="text-xs text-muted">{label}</div></div>)}
        </div>
        <p className="text-xs text-muted">{t("install_preview.description")}</p>
        <div className="border border-border divide-y divide-border">
          {plan.items.map((item,index) => <div key={`${item.task.source}:${item.task.id}`} className="flex gap-3 p-3 items-center">
            {item.action === "installed" ? <Check className="text-green-400 shrink-0" size={18} /> : <Download className="text-primary shrink-0" size={18} />}
            <div className="flex-1 min-w-0"><div className="text-sm font-medium text-white truncate">{item.task.name}</div><div className="text-xs text-muted break-all">{item.task.filename}</div><div className="text-[10px] text-muted mt-1">{item.task.source} · {index === plan.items.length-1 ? t("install_preview.selected") : t("install_preview.required")}</div></div>
            <span className={`text-[11px] shrink-0 px-2 py-1 border ${item.action === "replace" ? "border-amber-500/40 text-amber-300" : "border-border text-muted"}`}>{t(`install_preview.${item.action}`)}</span>
          </div>)}
        </div>
        {plan.optional.length > 0 && <div className="bg-background border border-border p-3"><h3 className="text-sm font-semibold text-white mb-1">{t("install_preview.optional")}</h3><p className="text-xs text-muted">{t("install_preview.optional_description")}</p><ul className="mt-2 space-y-1">{plan.optional.map(name => <li key={name} className="text-xs text-muted">{name}</li>)}</ul></div>}
        {plan.conflicts.map(message => <div key={message} className="flex gap-2 bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300"><AlertTriangle size={18} className="shrink-0" />{message}</div>)}
        {plan.warnings.map(message => <p key={message} className="text-xs text-amber-300 border-l-2 border-amber-500 pl-3">{message}</p>)}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {busy && <div role="status" className="space-y-2"><p className="text-xs text-muted">{progress.filename || t("install_preview.preparing")} · {progress.current}/{progress.total || count}</p><div className="h-1 bg-background"><div className="h-full bg-primary transition-all" style={{ width: `${progress.total ? progress.current/progress.total*100 : 0}%` }} /></div></div>}
      </div>
      <footer className="p-4 border-t border-border flex items-center justify-between gap-4 bg-background/50">
        <p className="text-[11px] text-muted">{t("install_preview.integrity")}</p>
        <button onClick={error ? close : install} disabled={busy || (!error && plan.conflicts.length > 0)} className="bg-primary text-white px-5 py-2.5 text-sm font-semibold flex gap-2 items-center disabled:opacity-40 shrink-0">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}{error ? t("install_preview.reopen") : busy ? t("install_preview.installing") : t("install_preview.confirm")}
        </button>
      </footer>
    </section>
  </div>;
}
