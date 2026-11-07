import { useState, useEffect, useCallback } from "react";
import { 
  Camera, Copy, Trash2, FolderOpen, RefreshCw, 
  ChevronLeft, ChevronRight, X, Loader2, Check
} from "lucide-react";
import { 
  ScreenshotInfo, 
  getInstanceScreenshots, 
  deleteInstanceScreenshot, 
  readInstanceScreenshotDataUrl,
  getErrorMessage 
} from "../../lib/ipc";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { toast } from "../Toast";

interface ScreenshotsTabProps {
  instanceId: string;
}

export default function ScreenshotsTab({ instanceId }: ScreenshotsTabProps) {
  const [screenshots, setScreenshots] = useState<ScreenshotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [copiedFilename, setCopiedFilename] = useState<string | null>(null);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);

  const loadScreenshots = async () => {
    setLoading(true);
    try {
      const list = await getInstanceScreenshots(instanceId);
      setScreenshots(list);
    } catch (e) {
      console.error("Failed to load screenshots:", e);
      toast.error("Не удалось загрузить скриншоты: " + getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScreenshots();
  }, [instanceId]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("ru-RU", { 
      day: "numeric", 
      month: "short", 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const handleCopyImage = async (item: ScreenshotInfo) => {
    try {
      setCopiedFilename(item.filename);
      // Fetch full base64 data url from backend
      const dataUrl = await readInstanceScreenshotDataUrl(instanceId, item.filename);
      
      // Convert data url to Blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      
      // Copy as image/png to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);

      toast.success("Скриншот скопирован! Можно вставить в Discord или Telegram через Ctrl+V");
      setTimeout(() => setCopiedFilename(null), 2500);
    } catch (e) {
      console.error("Clipboard copy error:", e);
      toast.error("Не удалось скопировать картинку: " + getErrorMessage(e));
      setCopiedFilename(null);
    }
  };

  const handleDelete = async (filename: string) => {
    setDeletingFilename(filename);
    try {
      await deleteInstanceScreenshot(instanceId, filename);
      toast.success("Скриншот удалён");
      setScreenshots(prev => prev.filter(s => s.filename !== filename));
      if (lightboxIndex !== null) {
        setLightboxIndex(null);
      }
    } catch (e) {
      toast.error("Ошибка удаления: " + getErrorMessage(e));
    } finally {
      setDeletingFilename(null);
    }
  };

  const handleOpenScreenshotsFolder = async () => {
    try {
      await invoke("open_instance_folder", { id: instanceId });
    } catch (e) {
      toast.error("Не удалось открыть папку: " + e);
    }
  };

  // Lightbox keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (lightboxIndex === null) return;
    if (e.key === "Escape") {
      setLightboxIndex(null);
    } else if (e.key === "ArrowLeft") {
      setLightboxIndex(prev => (prev !== null && prev > 0 ? prev - 1 : screenshots.length - 1));
    } else if (e.key === "ArrowRight") {
      setLightboxIndex(prev => (prev !== null && prev < screenshots.length - 1 ? prev + 1 : 0));
    }
  }, [lightboxIndex, screenshots.length]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const activeLightboxItem = lightboxIndex !== null ? screenshots[lightboxIndex] : null;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center space-x-2">
          <Camera className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg text-text">Галерея скриншотов</h3>
          <span className="px-2 py-0.5 text-xs bg-surface border border-border rounded-full text-text-muted">
            {screenshots.length}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenScreenshotsFolder}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-surface hover:bg-surface-elevated text-text border border-border rounded-lg text-sm transition-colors"
            title="Открыть папку сборки"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Папка</span>
          </button>

          <button
            onClick={loadScreenshots}
            disabled={loading}
            className="p-1.5 bg-surface hover:bg-surface-elevated text-text-muted hover:text-text border border-border rounded-lg transition-colors"
            title="Обновить"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        {loading && screenshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">Загрузка скриншотов...</p>
          </div>
        ) : screenshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 text-text-muted border-2 border-dashed border-border rounded-xl">
            <Camera className="w-12 h-12 stroke-[1.5] text-text-muted/60" />
            <p className="font-medium text-text">Скриншотов пока нет</p>
            <p className="text-xs text-text-muted max-w-sm text-center">
              Нажимайте <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[11px] font-mono">F2</kbd> во время игры, чтобы делать красивые снимки. Они автоматически появятся здесь!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {screenshots.map((item, index) => {
              const imgSrc = convertFileSrc(item.path);
              const isCopied = copiedFilename === item.filename;

              return (
                <div
                  key={item.filename}
                  className="group relative aspect-video bg-black/40 border border-border hover:border-primary rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setLightboxIndex(index)}
                >
                  <img
                    src={imgSrc}
                    alt={item.filename}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2.5">
                    {/* Top action buttons */}
                    <div className="flex items-center justify-end space-x-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleCopyImage(item)}
                        className={`p-1.5 rounded-lg border backdrop-blur-md transition-colors ${
                          isCopied 
                            ? "bg-emerald-500 text-white border-emerald-400" 
                            : "bg-black/60 hover:bg-black/90 text-white border-white/20"
                        }`}
                        title="Скопировать картинку в буфер"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleDelete(item.filename)}
                        disabled={deletingFilename === item.filename}
                        className="p-1.5 bg-black/60 hover:bg-red-500/80 text-white border border-white/20 rounded-lg backdrop-blur-md transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Bottom Metadata */}
                    <div className="text-white text-xs space-y-0.5">
                      <p className="truncate font-medium drop-shadow">{item.filename}</p>
                      <div className="flex items-center justify-between text-[11px] text-white/70">
                        <span>{formatDate(item.created_at)}</span>
                        <span>{formatSize(item.size_bytes)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {lightboxIndex !== null && activeLightboxItem && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Controls Bar */}
          <div 
            className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3 text-white text-sm">
              <span className="font-semibold">{activeLightboxItem.filename}</span>
              <span className="text-white/50">•</span>
              <span className="text-white/70">{formatDate(activeLightboxItem.created_at)}</span>
              <span className="text-white/50">•</span>
              <span className="text-white/70">{formatSize(activeLightboxItem.size_bytes)}</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleCopyImage(activeLightboxItem)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-medium transition-colors"
              >
                {copiedFilename === activeLightboxItem.filename ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Скопировано!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Скопировать в буфер</span>
                  </>
                )}
              </button>

              <button
                onClick={() => handleDelete(activeLightboxItem.filename)}
                className="p-1.5 bg-white/10 hover:bg-red-500 text-white rounded-lg transition-colors"
                title="Удалить скриншот"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => setLightboxIndex(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                title="Закрыть (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation Arrows */}
          {screenshots.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(prev => (prev !== null && prev > 0 ? prev - 1 : screenshots.length - 1));
                }}
                className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-black/90 text-white border border-white/20 rounded-full transition-colors z-10"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(prev => (prev !== null && prev < screenshots.length - 1 ? prev + 1 : 0));
                }}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-black/90 text-white border border-white/20 rounded-full transition-colors z-10"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Main Large Image */}
          <div className="max-w-6xl max-h-[85vh] flex items-center justify-center p-2" onClick={e => e.stopPropagation()}>
            <img
              src={convertFileSrc(activeLightboxItem.path)}
              alt={activeLightboxItem.filename}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
}
