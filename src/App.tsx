import { useState, useEffect } from "react";
import Home from "./pages/Home";
import AccountSelector from "./components/AccountSelector";
import SettingsModal from "./components/SettingsModal";
import UpdateModal, { UpdateInfo } from "./components/UpdateModal";
import { Settings, Folder, FileText, Minus, Square, X, MessageCircle, GitBranch, Sparkles, Heart, Send } from "lucide-react";
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { openUrl } from '@tauri-apps/plugin-opener';
import ToastContainer, { toast } from "./components/Toast";
import packageInfo from "../package.json";
import { useTranslation } from "react-i18next";

export default function App() {
  const { t } = useTranslation();
  const [selectedInstance, setSelectedInstance] = useState<string | null>("forge-1.20");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
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
      .then((s) => {
        applyCustomSettings(s);
        if (s.discord_rpc) {
          invoke("init_discord", { enabled: true }).catch(console.error);
        }
      })
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
    <div className={`launcher-shell flex flex-col h-screen w-screen bg-background text-text font-sans overflow-hidden relative ${bgStyle.url ? "has-custom-background" : ""}`}>
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
      <header className="lobby-header" onMouseDown={event => { if (!(event.target as HTMLElement).closest('button, a')) appWindow.startDragging(); }}>
        <div className="lobby-brand"><img src="/logo.png" alt="" /><div><strong>REDPANDA</strong><span>LAUNCHER</span></div></div>
        <div className="lobby-header__actions">
          <AccountSelector variant="lobby" onAccountChange={(username, id) => { setActiveUsername(username); setActiveAccountId(id); }} />
          {updateInfo?.has_update && <button className="lobby-icon-button lobby-update-button" onClick={() => setShowUpdateModal(true)} title={t("home.lobby.update")} aria-label={t("home.lobby.update")}><Sparkles size={21} /></button>}
          <button className="lobby-icon-button" onClick={handleOpenFolder} title={t("app.launcher_folder")} aria-label={t("app.launcher_folder")}><Folder size={21} /></button>
          <button className="lobby-icon-button" onClick={handleOpenLogs} title={t("app.logs_folder")} aria-label={t("app.logs_folder")}><FileText size={21} /></button>
          <button className="lobby-icon-button lobby-header-settings" onClick={() => setIsSettingsOpen(true)} title={t("app.launcher_settings")} aria-label={t("app.launcher_settings")}><Settings size={23} /></button>
        </div>
        <div className="lobby-window-controls">
          <button onClick={() => appWindow.minimize()} aria-label={t("home.lobby.minimize")}><Minus size={15} /></button>
          <button onClick={() => appWindow.toggleMaximize()} aria-label={t("home.lobby.maximize")}><Square size={13} /></button>
          <button onClick={() => appWindow.close()} aria-label={t("common.close")}><X size={16} /></button>
        </div>
      </header>

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
      <div className="flex-1 overflow-hidden relative flex flex-col">
        <Home selectedInstance={selectedInstance} onSelectInstance={setSelectedInstance} activeUsername={activeUsername} activeAccountId={activeAccountId} onOpenLauncherSettings={() => setIsSettingsOpen(true)} />
      </div>

      <footer className="lobby-footer"><span><i className="lobby-status-dot" />v{packageInfo.version}</span><div>
        <button onClick={() => openUrl("https://discord.gg/dFv6YvYy5p")}><MessageCircle size={13} />Discord</button>
        <button onClick={() => openUrl("https://t.me/redpanda_launcher")}><Send size={13} />Telegram</button>
        <button onClick={() => openUrl("https://github.com/t1m0nch1k/RedPanda-Launcher")}><GitBranch size={13} />GitHub</button>
        <button onClick={() => openUrl("https://boosty.to/redpanda_launcher")} className="lobby-support"><Heart size={13} />{t("home.lobby.support")}</button>
      </div><span>REDPANDA / MINECRAFT JAVA</span></footer>

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
