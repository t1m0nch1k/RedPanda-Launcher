import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Download, ExternalLink, X, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "./Toast";

export interface UpdateInfo {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  release_notes: string;
  download_url: string;
  html_url: string;
}

interface UpdateModalProps {
  updateInfo: UpdateInfo;
  onClose: () => void;
}

export default function UpdateModal({ updateInfo, onClose }: UpdateModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleInstall = async () => {
    setIsDownloading(true);
    setErrorMessage(null);
    try {
      await invoke("download_and_install_update", { downloadUrl: updateInfo.download_url });
      setDownloadSuccess(true);
      toast.success("Инсталлятор успешно запущен!");
    } catch (e) {
      console.error("Failed to install update", e);
      setErrorMessage(String(e));
      toast.error(" Ошибка установки: " + e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card brutalist-border rounded-none w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-background/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary border border-primary/30">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Доступно обновление RedPanda</h2>
              <p className="text-xs text-muted font-mono mt-0.5">
                Текущая: <span className="text-white/60">v{updateInfo.current_version}</span> ➔ Новая: <span className="text-primary font-bold">v{updateInfo.latest_version}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-muted hover:text-white hover:bg-card rounded-none transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body / Release Notes */}
        <div className="p-5 flex flex-col gap-4 max-h-[50vh] overflow-y-auto">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider">Что нового:</div>
          <div className="bg-background brutalist-border p-4 text-xs font-mono text-white/90 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {updateInfo.release_notes || "Список изменений отсутствует."}
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          {downloadSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>Инсталлятор запущен! Завершите установку в появившемся окне.</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-border bg-background/50 flex items-center justify-between gap-3">
          <button
            onClick={() => openUrl(updateInfo.html_url)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
          >
            <ExternalLink size={14} /> Открыть на GitHub
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border text-xs font-semibold text-muted hover:text-white hover:bg-card transition-colors"
            >
              Позже
            </button>
            <button
              onClick={handleInstall}
              disabled={isDownloading || downloadSuccess}
              className="px-5 py-2 bg-primary text-background font-bold text-xs brutalist-border hover:bg-primary-hover disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isDownloading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-background border-t-transparent animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Download size={15} /> Установить сейчас
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
