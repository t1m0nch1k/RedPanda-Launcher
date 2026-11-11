import { useState, useEffect } from "react";
import Home from "./pages/Home";
import SettingsModal from "./components/SettingsModal";
import UpdateModal, { UpdateInfo } from "./components/UpdateModal";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import ToastContainer, { toast } from "./components/Toast";
import { useTranslation } from "react-i18next";
import { applyFullTheme } from "./lib/theme";
import { updateSoundConfig } from "./lib/audio";

export default function App() {
  const { t } = useTranslation();
  const [selectedInstance, setSelectedInstance] = useState<string | null>("forge-1.20");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeUsername, setActiveUsername] = useState<string | null>(null);
  const [bgStyle, setBgStyle] = useState<{ url?: string; opacity?: number; blur?: number; dim?: number; effect?: string }>({});
  const [mascotSrc, setMascotSrc] = useState<string>("/pandas_png/clasped.png");
  const [mascotMode, setMascotMode] = useState<string>("full");
  const [mascotQuote, setMascotQuote] = useState<string>("Больше, чем просто игра");
  const [mascotBounce, setMascotBounce] = useState<boolean>(true);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const applyCustomSettings = (s: any) => {
    if (!s) return;

    // Apply full visual theme tokens (theme, accent, glow, radius, glass, font, button style)
    applyFullTheme(s);

    // Apply procedural sound engine configuration
    if (s.sound_effects !== undefined) {
      updateSoundConfig({
        enabled: s.sound_effects,
        volume: s.sound_volume ?? 70,
      });
    }

    // Background calculation
    let bgUrl = "";
    if (s.custom_bg_path) {
      if (s.custom_bg_path.startsWith("gradient:") || s.custom_bg_path.startsWith("/")) {
        bgUrl = s.custom_bg_path;
      } else {
        bgUrl = convertFileSrc(s.custom_bg_path);
      }
    }

    if (bgUrl) {
      setBgStyle({
        url: bgUrl,
        opacity: (s.custom_bg_opacity ?? 50) / 100,
        blur: s.custom_bg_blur ?? 0,
        dim: (s.custom_bg_dim ?? 0) / 100,
        effect: s.bg_effect || "none",
      });
    } else {
      setBgStyle({
        effect: s.bg_effect || "none",
        dim: 0,
      });
    }

    // Mascot settings
    setMascotMode(s.mascot_mode || "full");
    setMascotQuote(s.mascot_quote || "Больше, чем просто игра");
    setMascotBounce(s.mascot_bounce ?? true);

    if (s.custom_mascot_path) {
      setMascotSrc(convertFileSrc(s.custom_mascot_path));
    } else if (s.mascot_preset && s.mascot_preset !== "default" && s.mascot_preset !== "logo") {
      setMascotSrc(`/pandas_png/${s.mascot_preset}.png`);
    } else if (s.mascot_preset === "logo") {
      setMascotSrc("/logo.png");
    } else {
      setMascotSrc("/pandas_png/clasped.png");
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
          setShowUpdateModal(true);
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
    <div className={`launcher-shell flex h-screen w-screen font-sans overflow-hidden select-none relative ${bgStyle.url ? "has-custom-background" : ""}`}>
      {/* Background Image or Gradient */}
      {bgStyle.url && (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none transition-all duration-300"
          style={
            bgStyle.url.startsWith("gradient:")
              ? {
                  background: bgStyle.url.replace("gradient:", ""),
                  opacity: bgStyle.opacity ?? 0.5,
                  filter: `blur(${bgStyle.blur ?? 0}px)`,
                }
              : {
                  backgroundImage: `url("${bgStyle.url}")`,
                  opacity: bgStyle.opacity ?? 0.5,
                  filter: `blur(${bgStyle.blur ?? 0}px)`,
                }
          }
        />
      )}

      {/* Background Dimming layer */}
      {typeof bgStyle.dim === "number" && bgStyle.dim > 0 ? (
        <div 
          className="absolute inset-0 z-0 bg-black pointer-events-none transition-opacity duration-300"
          style={{ opacity: bgStyle.dim }}
        />
      ) : null}

      {/* Atmospheric Background Effect (Grid, Particles, Scanlines) */}
      {bgStyle.effect && bgStyle.effect !== "none" ? (
        <div className={`absolute inset-0 z-0 pointer-events-none ${`bg-effect-${bgStyle.effect}`}`} />
      ) : null}

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
        mascotSrc={mascotSrc}
        mascotMode={mascotMode}
        mascotQuote={mascotQuote}
        mascotBounce={mascotBounce}
      />

      {isSettingsOpen && (
        <SettingsModal 
          onClose={() => setIsSettingsOpen(false)} 
          onSettingsChanged={() => invoke<any>("get_settings").then(applyCustomSettings).catch(console.error)}
          onOpenUpdateModal={(info) => {
            setUpdateInfo(info);
            setShowUpdateModal(true);
          }}
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
