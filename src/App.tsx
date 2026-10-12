import { useState, useEffect } from "react";
import Home from "./pages/Home";
import SettingsModal from "./components/SettingsModal";
import UpdateModal, { UpdateInfo } from "./components/UpdateModal";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import ToastContainer, { toast } from "./components/Toast";
import { useTranslation } from "react-i18next";

export default function App() {
  const { t } = useTranslation();
  const [selectedInstance, setSelectedInstance] = useState<string | null>("forge-1.20");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeUsername, setActiveUsername] = useState<string | null>(null);
  const [bgStyle, setBgStyle] = useState<{ url?: string; opacity?: number; blur?: number }>({});
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
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
        }
      })
      .catch((err) => console.log("Update check failed/skipped:", err));
  }, []);

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
    <div className={`launcher-shell flex h-screen w-screen bg-[#0d0b09] text-[#f5ece5] font-sans overflow-hidden select-none relative ${bgStyle.url ? "has-custom-background" : ""}`}>
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

      {/* Main Game Hub Canvas */}
      <Home 
        selectedInstance={selectedInstance}
        onSelectInstance={setSelectedInstance}
        activeUsername={activeUsername}
        activeAccountId={activeAccountId}
        onAccountChange={(username, id) => {
          setActiveUsername(username);
          setActiveAccountId(id);
        }}
        onOpenLauncherSettings={() => setIsSettingsOpen(true)}
        onOpenFolder={handleOpenFolder}
        onOpenLogs={handleOpenLogs}
        updateInfo={updateInfo}
        onOpenUpdateModal={() => setShowUpdateModal(true)}
      />

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
