import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Download, ExternalLink, X, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "./Toast";
import { command, getErrorMessage, UpdateInfo } from "../lib/ipc";

export type { UpdateInfo };

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
      await command("download_and_install_update", {
        downloadUrl: updateInfo.download_url,
        expectedSha256: updateInfo.sha256,
        expectedSignature: updateInfo.signature,
        expectedAssetName: updateInfo.asset_name,
        expectedSize: updateInfo.size,
        expectedManifest: updateInfo.manifest_json,
      });
      setDownloadSuccess(true);
      toast.success("Инсталлятор успешно запущен!");
    } catch (e) {
      const message = getErrorMessage(e);
      setErrorMessage(message);
      toast.error("Ошибка установки: " + message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="deck-modal-backdrop animate-in fade-in duration-200">
      <div className="deck-modal-window w-full max-w-lg">
        <div className="deck-modal-laser" />
        
        {/* Header */}
        <div className="deck-modal-header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#291b14] border border-[#f55e1d]/40 rounded flex items-center justify-center text-primary shrink-0 shadow-[0_0_12px_rgba(245,94,29,0.2)]">
              <Sparkles size={20} className="text-[#f55e1d]" />
            </div>
            <div>
              <span className="deck-modal-eyebrow">REDPANDA / OTA UPDATER</span>
              <h2 className="deck-modal-title">Доступно обновление RedPanda</h2>
              <p className="text-xs text-[#a69284] font-mono mt-0.5">
                Текущая: <span className="text-white/60">v{updateInfo.current_version}</span> ➔ Новая: <span className="text-[#f55e1d] font-bold">v{updateInfo.latest_version}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="deck-modal-close" title="Закрыть">
            <X size={17} />
          </button>
        </div>

        {/* Body / Release Notes */}
        <div className="p-5 flex flex-col gap-4 max-h-[50vh] overflow-y-auto bg-[#17120e]">
          <div className="text-xs font-mono font-bold text-[#a69284] uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f55e1d]" /> Что нового:
          </div>
          <div className="bg-[#120e0c] border border-[#33241b] rounded p-4 text-xs font-mono text-[#f5ece5] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
            {updateInfo.release_notes || "Список изменений отсутствует."}
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-950/30 border border-red-500/40 rounded text-xs text-red-300 font-mono flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <div>{errorMessage}</div>
            </div>
          )}

          {downloadSuccess && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded text-xs text-emerald-300 font-mono flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <span>Инсталлятор запущен! Завершите установку в открывшемся окне.</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="deck-modal-footer">
          <button
            onClick={() => openUrl(updateInfo.html_url)}
            className="flex items-center gap-1.5 text-xs font-mono text-[#a69284] hover:text-white transition-colors"
          >
            <ExternalLink size={13} /> GitHub Release
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded border border-[#382921] bg-[#201813] hover:bg-[#2b2019] text-xs font-mono text-[#a69284] hover:text-white transition-colors"
            >
              Позже
            </button>
            <button
              onClick={handleInstall}
              disabled={isDownloading || downloadSuccess}
              className="deck-play-btn !py-1.5 !px-5 !text-xs disabled:opacity-40"
            >
              {isDownloading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Download size={14} /> Установить сейчас
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
