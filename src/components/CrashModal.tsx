import { X, Copy, Terminal } from "lucide-react";

interface CrashModalProps {
  logs: { stream: string; line: string }[];
  onClose: () => void;
}

import { toast } from "./Toast";

export default function CrashModal({ logs, onClose }: CrashModalProps) {
  const handleCopyLogs = () => {
    const text = logs.map(l => `[${l.stream}] ${l.line}`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Логи успешно скопированы!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col h-[80vh]">
        <div className="p-6 border-b border-border flex justify-between items-center bg-background/50 rounded-t-2xl">
          <div className="flex items-center gap-3 text-red-400">
            <Terminal size={24} />
            <div>
              <h2 className="text-lg font-bold text-white">Игра завершилась с ошибкой</h2>
              <p className="text-sm text-red-400/80">Похоже, Minecraft упал. Ниже представлены последние логи консоли.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-muted hover:text-white transition-colors bg-card p-2 rounded-xl border border-border"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 p-6 overflow-hidden flex flex-col bg-background/30">
          <div className="flex-1 bg-[#0d0d0d] border border-border rounded-xl p-4 overflow-y-auto font-mono text-[13px] leading-relaxed">
            {logs.length === 0 ? (
              <div className="text-muted italic">Логов нет. Возможно, игра закрылась до начала инициализации.</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`break-words ${log.stream === "Stderr" ? "text-red-400" : "text-gray-300"}`}>
                  <span className="opacity-50 select-none mr-2">[{log.stream}]</span>
                  {log.line}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-6 border-t border-border bg-background/50 rounded-b-2xl flex justify-end gap-3">
          <button 
            onClick={handleCopyLogs}
            className="px-5 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-card text-white flex items-center gap-2 transition-colors"
          >
            <Copy size={16} /> Копировать логи
          </button>
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
