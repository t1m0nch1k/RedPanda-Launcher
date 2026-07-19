import { useState } from "react";
import Home from "./pages/Home";
import AccountSelector from "./components/AccountSelector";
import SettingsModal from "./components/SettingsModal";
import { Settings, Folder, FileText, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from "@tauri-apps/api/core";
import ToastContainer, { toast } from "./components/Toast";

export default function App() {
  const [selectedInstance, setSelectedInstance] = useState<string | null>("forge-1.20");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeUsername, setActiveUsername] = useState<string | null>(null);

  const appWindow = getCurrentWindow();

  const handleOpenFolder = async () => {
    try {
      await invoke("open_launcher_folder");
    } catch (e) {
      toast.error("Ошибка открытия папки: " + e);
    }
  };

  const handleOpenLogs = async () => {
    try {
      await invoke("open_logs_folder");
    } catch (e) {
      toast.error("Ошибка открытия папки логов: " + e);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-white font-sans overflow-hidden rounded-xl border border-border shadow-2xl relative">
      <ToastContainer />
      {/* Topbar / Toolbar (Prism style) */}
      <div 
        className="h-12 bg-background border-b border-border flex items-center justify-between px-4 shrink-0 select-none cursor-default"
        onMouseDown={(e) => {
          if (!(e.target as HTMLElement).closest('button')) {
            appWindow.startDragging();
          }
        }}
      >
        <div className="flex items-center gap-2.5 pointer-events-none pl-1">
          <img src="/logo.png" alt="RedPanda" className="w-5 h-5 object-contain" />
          <span className="font-semibold text-[13px] tracking-wide text-white/80">RedPanda Launcher</span>
        </div>
        
        <div className="flex items-center gap-2 z-10 text-muted" data-tauri-drag-region="false">
          <button 
            onClick={() => appWindow.minimize()}
            className="p-2 hover:bg-card-hover hover:text-white rounded-md transition-colors"
            data-tauri-drag-region="false"
          >
            <Minus size={16} data-tauri-drag-region="false" />
          </button>
          <button 
            onClick={() => appWindow.toggleMaximize()}
            className="p-2 hover:bg-card-hover hover:text-white rounded-md transition-colors"
            data-tauri-drag-region="false"
          >
            <Square size={14} data-tauri-drag-region="false" />
          </button>
          <button 
            onClick={() => appWindow.close()}
            className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-md transition-colors"
            data-tauri-drag-region="false"
          >
            <X size={18} data-tauri-drag-region="false" />
          </button>
        </div>
      </div>

      {/* Main Content (Grid of Instances) */}
      <main className="flex-1 overflow-y-auto bg-background p-8 relative">
        <Home selectedInstance={selectedInstance} onSelectInstance={setSelectedInstance} activeUsername={activeUsername} />
      </main>

      {/* Bottom Launch Bar (Legacy Launcher style) */}
      <div className="h-20 bg-background border-t border-border flex items-center justify-between px-8 shrink-0 relative z-20">
        <div className="flex items-center gap-4 w-1/3">
          <AccountSelector onAccountChange={setActiveUsername} />
        </div>

        <div className="flex items-center justify-center gap-4 w-1/3">
          
        </div>

        <div className="flex items-center justify-end gap-3 w-1/3 text-muted">
          <button 
            className="p-2 hover:text-white hover:bg-card-hover rounded-lg transition-colors" 
            title="Настройки лаунчера"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings size={18} />
          </button>
          <button 
            className="p-2 hover:text-white hover:bg-card-hover rounded-lg transition-colors" 
            title="Папка лаунчера"
            onClick={handleOpenFolder}
          >
            <Folder size={18} />
          </button>
          <button 
            className="p-2 hover:text-white hover:bg-card-hover rounded-lg transition-colors" 
            title="Папка логов"
            onClick={handleOpenLogs}
          >
            <FileText size={18} />
          </button>
        </div>
      </div>

      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
}
