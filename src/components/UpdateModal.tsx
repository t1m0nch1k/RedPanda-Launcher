import { useState } from "react";
import { Download, X, Sparkles, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
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
    if (!updateInfo.download_url) {
      const err = "Ссылка для скачивания обновления не найдена.";
      setErrorMessage(err);
      toast.error(err);
      return;
    }
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
      toast.success("Инсталлятор обновления успешно запущен!");
    } catch (e) {
      const message = getErrorMessage(e);
      setErrorMessage(message);
      toast.error("Ошибка установки: " + message);
    } finally {
      setIsDownloading(false);
    }
  };

  const formattedSize = updateInfo.size
    ? `${(updateInfo.size / (1024 * 1024)).toFixed(1)} МБ`
    : null;

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
              <span className="deck-modal-eyebrow">REDPANDA / АВТООБНОВЛЕНИЕ</span>
              <h2 className="deck-modal-title">Доступно обновление RedPanda</h2>
              <p className="text-xs text-[#a69284] font-mono mt-0.5">
                Текущая: <span className="text-white/60">v{updateInfo.current_version}</span> ➔ Новая: <span className="text-[#f55e1d] font-bold">v{updateInfo.latest_version}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isDownloading}
            className="deck-modal-close disabled:opacity-30" 
            title="Закрыть"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body / Release Notes */}
        <div className="p-5 flex flex-col gap-4 max-h-[50vh] overflow-y-auto bg-[#17120e]">
          <div className="text-xs font-mono font-bold text-[#a69284] uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f55e1d]" /> Что нового:
            </span>
            {formattedSize && (
              <span className="text-[#8c786c] font-normal lowercase">Размер: {formattedSize}</span>
            )}
          </div>
          <div className="bg-[#120e0c] border border-[#33241b] rounded p-4 text-xs font-mono text-[#f5ece5] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
            {updateInfo.release_notes || "Список изменений отсутствует."}
          </div>

          {isDownloading && (
            <div className="p-3 bg-[#1e1713] border border-[#f55e1d]/40 rounded text-xs font-mono flex flex-col gap-2">
              <div className="flex items-center justify-between text-[#f5ece5]">
                <span className="flex items-center gap-2">
                  <Loader2 size={15} className="animate-spin text-[#f55e1d]" />
                  <span>Загрузка обновления напрямую...</span>
                </span>
                {formattedSize && <span className="text-[#a69284]">{formattedSize}</span>}
              </div>
              <div className="w-full bg-[#120e0c] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#f55e1d] h-full w-full animate-pulse" />
              </div>
              <div className="text-[10px] text-[#8c786c]">
                Файл обновления скачивается внутри приложения и будет запущен автоматически без перехода в браузер.
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-950/30 border border-red-500/40 rounded text-xs text-red-300 font-mono flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <div>{errorMessage}</div>
            </div>
          )}

          {downloadSuccess && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded text-xs text-emerald-300 font-mono flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <div>
                <div className="font-bold">Инсталлятор успешно запущен!</div>
                <div className="text-[11px] text-emerald-400/80">Завершите обновление в открывшемся окне мастера установки.</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="deck-modal-footer">
          <div className="text-xs text-[#a69284] font-mono">
            {updateInfo.asset_name || `RedPanda_Setup_v${updateInfo.latest_version}.exe`}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isDownloading}
              className="px-4 py-1.5 rounded border border-[#382921] bg-[#201813] hover:bg-[#2b2019] text-xs font-mono text-[#a69284] hover:text-white transition-colors disabled:opacity-40"
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
              ) : downloadSuccess ? (
                <>
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  Запущено
                </>
              ) : (
                <>
                  <Download size={14} />
                  Обновить сейчас
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
