import { useState, useEffect } from "react";
import Home from "./pages/Home";
import AccountSelector from "./components/AccountSelector";
import SettingsModal from "./components/SettingsModal";
import UpdateModal, { UpdateInfo } from "./components/UpdateModal";
import { Settings, Folder, FileText, Minus, Square, X, MessageCircle, Music, GitBranch, Sparkles } from "lucide-react";
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { openUrl } from '@tauri-apps/plugin-opener';
import ToastContainer, { toast } from "./components/Toast";
import { useTranslation } from "react-i18next";

export default function App() {
  const { t } = useTranslation();
  const [selectedInstance, setSelectedInstance] = useState<string | null>("forge-1.20");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeUsername, setActiveUsername] = useState<string | null>(null);
  const [bgStyle, setBgStyle] = useState<{ url?: string; opacity?: number; blur?: number }>({});
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const applyCustomSettings = (s: any) => {
    if (!s) return;
    if (s.theme) {
      document.documentElement.setAttribute("data-theme", s.theme);
    }
    if (s.accent_color) {
      document.documentElement.style.setProperty("--color-primary", s.accent_color);
    }
    if (s.custom_bg_path) {
      setBgStyle({
        url: convertFileSrc(s.custom_bg_path),
        opacity: (s.custom_bg_opacity ?? 50) / 100,
        blur: s.custom_bg_blur ?? 0,
      });
    } else {
      setBgStyle({});
    }
  };

  useEffect(() => {
    invoke<any>("get_settings")
      .then(applyCustomSettings)
      .catch(console.error);

    // Auto check updates on launch
    invoke<UpdateInfo>("check_for_updates")
      .then((info) => {
        if (info && info.has_update) {
          setUpdateInfo(info);
          setShowUpdateBanner(true);
        }
      })
      .catch((err) => console.log("Update check failed/skipped:", err));
  }, []);

  const appWindow = getCurrentWindow();

  const handleOpenFolder = async () => {
    try {
      await invoke("open_launcher_folder");
    } catch (e) {
      toast.error(t("common.error") + ": " + e);
    }
  };

  const handleOpenLogs = async () => {
    try {
      await invoke("open_logs_folder");
    } catch (e) {
      toast.error(t("common.error") + ": " + e);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-text font-sans overflow-hidden rounded-none brutalist-border relative">
      {bgStyle.url && (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none transition-all duration-300"
          style={{
            backgroundImage: `url("${bgStyle.url}")`,
            opacity: bgStyle.opacity ?? 0.5,
            filter: `blur(${bgStyle.blur ?? 0}px)`,
          }}
        />
      )}
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
          <span className="font-semibold text-[13px] tracking-wide text-text/80">RedPanda Launcher</span>
        </div>
        
        <div className="flex items-center gap-2 z-10 text-muted" data-tauri-drag-region="false">
          {updateInfo && updateInfo.has_update && (
            <button
              onClick={() => setShowUpdateModal(true)}
              className="mr-2 px-2.5 py-1 bg-primary text-background text-xs font-bold brutalist-border hover:bg-primary-hover transition-colors flex items-center gap-1.5 animate-pulse"
              title="Доступно новое обновление"
            >
              <Sparkles size={13} /> v{updateInfo.latest_version}
            </button>
          )}
          <button 
            onClick={() => appWindow.minimize()}
            className="p-2 hover:bg-card-hover hover:text-text rounded-none transition-colors"
            data-tauri-drag-region="false"
          >
            <Minus size={16} data-tauri-drag-region="false" />
          </button>
          <button 
            onClick={() => appWindow.toggleMaximize()}
            className="p-2 hover:bg-card-hover hover:text-text rounded-none transition-colors"
            data-tauri-drag-region="false"
          >
            <Square size={14} data-tauri-drag-region="false" />
          </button>
          <button 
            onClick={() => appWindow.close()}
            className="p-2 hover:bg-red-500 hover:text-white rounded-none transition-colors"
            data-tauri-drag-region="false"
          >
            <X size={16} data-tauri-drag-region="false" />
          </button>
        </div>
      </div>

      {showUpdateBanner && updateInfo && (
        <div className="bg-primary text-background px-4 py-2 flex items-center justify-between text-xs font-bold shrink-0 z-20 brutalist-border-b">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="animate-spin" />
            <span>Доступно новое обновление RedPanda Launcher v{updateInfo.latest_version}!</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUpdateModal(true)}
              className="px-3 py-1 bg-background text-primary text-xs font-bold brutalist-border hover:bg-card transition-colors"
            >
              Установить сейчас
            </button>
            <button
              onClick={() => setShowUpdateBanner(false)}
              className="p-1 text-background/80 hover:text-background"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col z-10">
        <Home selectedInstance={selectedInstance} onSelectInstance={setSelectedInstance} activeUsername={activeUsername} />
      </div>

      {/* Bottom status bar */}
      <div className="h-11 bg-background border-t border-border flex items-center justify-between px-4 text-xs font-mono shrink-0 z-20">
        <div className="flex items-center gap-3 text-muted shrink-0">
          <span className="flex items-center gap-1.5 text-text/80 whitespace-nowrap font-medium">
            <span className="w-2 h-2 rounded-none bg-emerald-500 inline-block shrink-0"></span>
            v0.1.3 Stable
          </span>
          <AccountSelector onAccountChange={(username) => setActiveUsername(username)} />
        </div>

        <div className="flex items-center justify-center gap-4 w-1/3 text-muted">
          <button onClick={() => openUrl("https://discord.gg/minecraft")} className="hover:text-primary transition-colors flex items-center gap-1.5" title="Discord">
             <MessageCircle size={14} /> Discord
          </button>
          <button onClick={() => openUrl("https://tiktok.com")} className="hover:text-primary transition-colors flex items-center gap-1.5" title="TikTok">
             <Music size={14} /> TikTok
          </button>
          <button onClick={() => openUrl("https://github.com/t1m0nch1k/RedPanda-Launcher")} className="hover:text-primary transition-colors flex items-center gap-1.5" title="GitHub">
             <GitBranch size={14} /> GitHub
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 w-1/3 text-muted">
          <button 
            className="p-2 hover:text-text hover:bg-card-hover rounded-none transition-colors" 
            title={t("app.launcher_settings", "Launcher Settings")}
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings size={18} />
          </button>
          <button 
            className="p-2 hover:text-text hover:bg-card-hover rounded-none transition-colors" 
            title={t("app.launcher_folder", "Launcher Folder")}
            onClick={handleOpenFolder}
          >
            <Folder size={18} />
          </button>
          <button 
            className="p-2 hover:text-text hover:bg-card-hover rounded-none transition-colors" 
            title={t("app.logs_folder", "Logs Folder")}
            onClick={handleOpenLogs}
          >
            <FileText size={18} />
          </button>
        </div>
      </div>

      {isSettingsOpen && (
        <SettingsModal 
          onClose={() => setIsSettingsOpen(false)} 
          onSettingsChanged={() => invoke<any>("get_settings").then(applyCustomSettings).catch(console.error)}
        />
      )}

      {showUpdateModal && updateInfo && (
        <UpdateModal
          updateInfo={updateInfo}
          onClose={() => setShowUpdateModal(false)}
        />
      )}
    </div>
  );
}
