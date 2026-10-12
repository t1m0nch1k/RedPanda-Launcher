import { useState, useMemo } from "react";
import { 
  X, 
  Copy, 
  Terminal, 
  AlertTriangle, 
  Cpu, 
  Puzzle, 
  Folder, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Wrench,
  Flame,
  Search
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "./Toast";
import { analyzeCrashLogs, CrashDiagnostic } from "../utils/crashDiagnostics";

interface CrashModalProps {
  logs: { stream: string; line: string }[];
  exitCode?: number | null;
  instanceId?: string | null;
  onClose: () => void;
  onOpenMods?: () => void;
  onOpenSettings?: () => void;
  onOpenLauncherSettings?: () => void;
}

export default function CrashModal({ 
  logs, 
  exitCode, 
  instanceId, 
  onClose,
  onOpenMods,
  onOpenSettings,
  onOpenLauncherSettings
}: CrashModalProps) {
  const [filterStream, setFilterStream] = useState<"all" | "stderr">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetails, setShowDetails] = useState(true);
  const [copied, setCopied] = useState(false);

  const diagnostic: CrashDiagnostic = useMemo(() => {
    return analyzeCrashLogs(logs, exitCode);
  }, [logs, exitCode]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (filterStream === "stderr" && log.stream !== "Stderr") {
        return false;
      }
      if (searchQuery.trim()) {
        return log.line.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [logs, filterStream, searchQuery]);

  const handleCopyLogs = async () => {
    const header = `=== RedPanda Crash Diagnostic ===\n` +
      `Type: ${diagnostic.type}\n` +
      `Severity: ${diagnostic.severity}\n` +
      `Title: ${diagnostic.title}\n` +
      `Message: ${diagnostic.message}\n` +
      `Exit Code: ${exitCode ?? "Unknown"}\n` +
      `=================================\n\n`;
    const text = header + logs.map(l => `[${l.stream}] ${l.line}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Логи скопированы в буфер обмена!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenFolder = async () => {
    if (!instanceId) return;
    try {
      await invoke("open_instance_folder", { id: instanceId });
      toast.success("Папка сборки открыта");
    } catch (e) {
      toast.error("Не удалось открыть папку: " + e);
    }
  };

  const handleAction = async () => {
    if (!diagnostic.action) return;

    switch (diagnostic.action.type) {
      case "open_settings_memory":
      case "open_settings_java":
        if (onOpenLauncherSettings) {
          onOpenLauncherSettings();
        } else if (onOpenSettings) {
          onOpenSettings();
        }
        break;
      case "open_mods":
        if (onOpenMods) {
          onOpenMods();
        }
        break;
      case "open_folder":
        await handleOpenFolder();
        break;
      case "open_url":
        if (diagnostic.action.url) {
          await openUrl(diagnostic.action.url);
        }
        break;
    }
  };

  const getBadgeColor = () => {
    switch (diagnostic.type) {
      case "java_version":
        return "border-amber-500/40 bg-amber-500/10 text-amber-400";
      case "out_of_memory":
        return "border-red-500/40 bg-red-500/10 text-red-400";
      case "missing_fabric_deps":
      case "mod_conflict":
      case "mixin_error":
        return "border-orange-500/40 bg-orange-500/10 text-orange-400";
      case "graphics_driver":
      case "native_library":
        return "border-cyan-500/40 bg-cyan-500/10 text-cyan-400";
      default:
        return "border-red-500/40 bg-red-500/10 text-red-400";
    }
  };

  const getActionIcon = () => {
    switch (diagnostic.action?.type) {
      case "open_settings_memory":
        return <Cpu size={15} />;
      case "open_settings_java":
        return <Wrench size={15} />;
      case "open_mods":
        return <Puzzle size={15} />;
      case "open_folder":
        return <Folder size={15} />;
      case "open_url":
        return <ExternalLink size={15} />;
      default:
        return null;
    }
  };

  return (
    <div className="deck-modal-backdrop animate-in fade-in duration-200">
      <div className="deck-modal-window w-full max-w-5xl flex flex-col h-[88vh]">
        <div className="deck-modal-laser" />
        
        {/* Modal Header */}
        <div className="deck-modal-header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-950/40 border border-red-500/40 rounded flex items-center justify-center text-red-400 shrink-0 shadow-[0_0_12px_rgba(239,68,68,0.2)]">
              <Flame size={20} className="text-red-400" />
            </div>
            <div>
              <span className="deck-modal-eyebrow !text-red-400">REDPANDA / CRASH TELEMETRY</span>
              <div className="flex items-center gap-2">
                <h2 className="deck-modal-title">Игра завершилась с ошибкой</h2>
                {exitCode !== undefined && exitCode !== null && (
                  <span className="text-xs font-mono px-2 py-0.5 bg-[#261513] border border-red-500/30 text-red-300 rounded">
                    Exit code: {exitCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#a69284] mt-0.5 font-mono">
                Автоматическая диагностика сборок RedPanda проанализировала журнал игры.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="deck-modal-close"
            title="Закрыть"
          >
            <X size={17} />
          </button>
        </div>

        {/* Diagnostic Banner */}
        <div className="p-4 sm:p-5 border-b border-border bg-[#18181b]/50 shrink-0">
          <div className={`p-4 brutalist-border ${getBadgeColor()} flex flex-col gap-3 transition-all`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2.5">
                <AlertTriangle size={18} className="shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    {diagnostic.title}
                  </h3>
                  <p className="text-xs opacity-90 mt-0.5 leading-relaxed">
                    {diagnostic.message}
                  </p>
                </div>
              </div>

              {diagnostic.action && (
                <button
                  onClick={handleAction}
                  className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-background text-xs font-bold brutalist-border transition-colors flex items-center justify-center gap-2 shrink-0 self-start sm:self-center"
                >
                  {getActionIcon()}
                  <span>{diagnostic.action.label}</span>
                </button>
              )}
            </div>

            {/* Suggested Solution */}
            <div className="pt-2 border-t border-white/10 flex items-start gap-2 text-xs">
              <span className="font-bold text-primary shrink-0 uppercase tracking-wider text-[11px]">Решение:</span>
              <span className="text-gray-300 leading-relaxed">{diagnostic.solution}</span>
            </div>

            {/* Diagnostic Details (if any) */}
            {diagnostic.details && diagnostic.details.length > 0 && (
              <div className="mt-1">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-[11px] font-mono text-muted hover:text-white flex items-center gap-1 transition-colors"
                >
                  {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  <span>Детали анализа ({diagnostic.details.length})</span>
                </button>

                {showDetails && (
                  <div className="mt-2 p-2.5 bg-black/40 brutalist-border font-mono text-xs space-y-1 text-gray-300 max-h-32 overflow-y-auto">
                    {diagnostic.details.map((detail, idx) => (
                      <div key={idx} className="break-all flex items-start gap-1.5">
                        <span className="text-primary font-bold">›</span>
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Logs Explorer Area */}
        {/* Logs Explorer Area */}
        <div className="flex-1 p-4 sm:p-5 overflow-hidden flex flex-col bg-[#140f0c] gap-3">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#a69284] font-mono font-bold flex items-center gap-1.5">
                <Terminal size={14} className="text-[#f55e1d]" /> Журнал консоли ({filteredLogs.length})
              </span>
              <div className="deck-segment-bar">
                <button
                  onClick={() => setFilterStream("all")}
                  className={`deck-segment-btn ${filterStream === "all" ? "is-active" : ""}`}
                >
                  Все ({logs.length})
                </button>
                <button
                  onClick={() => setFilterStream("stderr")}
                  className={`deck-segment-btn ${filterStream === "stderr" ? "!bg-red-900/60 !text-red-200" : ""}`}
                >
                  Только ошибки
                </button>
              </div>
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#78675c]" />
              <input
                type="text"
                placeholder="Поиск в логах..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-[#120e0c] border border-[#382921] focus:border-[#f55e1d] rounded text-xs text-white placeholder-[#78675c] focus:outline-none font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#78675c] hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Console Text Window */}
          <div className="flex-1 bg-[#0f0b09] border border-[#2b2019] rounded p-3.5 overflow-y-auto font-mono text-[12px] leading-relaxed select-text custom-scrollbar">
            {filteredLogs.length === 0 ? (
              <div className="text-[#78675c] italic p-4 text-center font-mono">
                {logs.length === 0
                  ? "Логов нет. Возможно, игра была прервана до инициализации JVM."
                  : "По вашему запросу строк не найдено."}
              </div>
            ) : (
              filteredLogs.map((log, i) => (
                <div 
                  key={i} 
                  className={`break-words py-0.5 px-1 rounded ${
                    log.stream === "Stderr" || /error|exception|critical|fatal/i.test(log.line) 
                      ? "text-red-400 bg-red-950/20" 
                      : /warn/i.test(log.line) 
                        ? "text-amber-300" 
                        : "text-[#d1c2b6]"
                  }`}
                >
                  <span className="opacity-40 select-none mr-2 text-[10px]">
                    [{log.stream}]
                  </span>
                  {log.line}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="deck-modal-footer">
          <div className="flex items-center gap-2">
            {instanceId && (
              <button
                onClick={handleOpenFolder}
                className="px-3 py-1.5 text-xs font-mono rounded border border-[#382921] bg-[#201813] hover:bg-[#2b2019] text-[#a69284] hover:text-white transition-colors flex items-center gap-1.5"
              >
                <Folder size={14} /> Папка сборки
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleCopyLogs}
              className="px-4 py-1.5 text-xs font-mono font-bold border border-[#382921] bg-[#201813] hover:bg-[#2b2019] text-white rounded flex items-center gap-2 transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? "Скопировано!" : "Копировать логи"}</span>
            </button>
            <button 
              onClick={onClose}
              className="deck-play-btn !py-1.5 !px-6 !text-xs"
            >
              Закрыть
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
