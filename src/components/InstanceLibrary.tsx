import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Check, Plus, X, Box } from "lucide-react";

export interface LauncherInstance {
  id: string;
  name: string;
  game_version: string;
  loader_type: "Vanilla" | "Forge" | "Fabric" | "Quilt" | "NeoForge";
  loader_version: string;
  last_played: number | null;
  icon_path?: string;
  total_play_time_seconds?: number;
}

export default function InstanceLibrary({ instances, selectedId, onSelect, onClose, onCreate, onContextMenu }: {
  instances: LauncherInstance[]; selectedId?: string; onSelect: (id: string) => void;
  onClose: () => void; onCreate: () => void;
  onContextMenu: (event: React.MouseEvent, id: string) => void;
}) {
  const { t } = useTranslation();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { previous?.focus(); };
  }, []);
  return <div className="lobby-dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="instance-library-title" className="lobby-library" onKeyDown={e => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "Tab") {
        const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }}>
      <header><div><span className="lobby-eyebrow">REDPANDA / LIBRARY</span><h2 id="instance-library-title">{t("home.lobby.library")}</h2></div><button className="lobby-icon-button" aria-label={t("common.close")} onClick={onClose}><X size={20} /></button></header>
      <div className="lobby-library__list custom-scrollbar">
        {instances.map(instance => <button key={instance.id} className={`lobby-library__item ${selectedId === instance.id ? "is-selected" : ""}`} onClick={() => { onSelect(instance.id); onClose(); }} onContextMenu={event => onContextMenu(event, instance.id)}>
          <span className="lobby-library__icon"><Box size={24} /></span><span><strong>{instance.name}</strong><small>{instance.game_version} · {instance.loader_type}</small></span>{selectedId === instance.id && <Check size={20} />}
        </button>)}
        {!instances.length && <p className="lobby-library__empty">{t("home.lobby.empty")}</p>}
      </div>
      <button className="lobby-library__create" onClick={() => { onClose(); onCreate(); }}><Plus size={18} />{t("home.add_instance")}</button>
    </div>
  </div>;
}
