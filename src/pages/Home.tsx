import { Account, SkinPreview, command } from "../lib/ipc";
import { Plus, Play, Anvil, Feather, TreePine, Hammer, Settings, Loader2, Folder, FileText, Trash2, Download, Copy, Wand2, ExternalLink, ChevronDown, Layers, Users, ArrowUpRight, Shirt, Globe, X } from "lucide-react";
import { useState, useEffect, useLayoutEffect, useMemo, memo, useRef, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "../components/Toast";
import { open, save } from "@tauri-apps/plugin-dialog";

import InstanceLibrary from "../components/InstanceLibrary";

const CreateInstanceModal = lazy(() => import("../components/CreateInstanceModal"));
const InstanceManagerModal = lazy(() => import("../components/InstanceManagerModal"));
const CrashModal = lazy(() => import("../components/CrashModal"));
const ModrinthBrowser = lazy(() => import("../components/ModrinthBrowser"));
const CurseForgeBrowser = lazy(() => import("../components/CurseForgeBrowser"));
const ModpackBuilderModal = lazy(() => import("../components/ModpackBuilderModal"));
const WardrobeModal = lazy(() => import("../components/WardrobeModal"));
const SkinViewer = lazy(() => import("../components/SkinViewer"));
const ServerBrowserModal = lazy(() => import("../components/ServerBrowserModal"));

interface Instance {
  id: string;
  name: string;
  game_version: string;
  loader_type: "Vanilla" | "Forge" | "Fabric" | "Quilt" | "NeoForge";
  loader_version: string;
  last_played: number | null;
  icon_path?: string;
  total_play_time_seconds?: number;
}

interface HomeProps {
  selectedInstance: string | null;
  onSelectInstance: (id: string) => void;
  activeUsername: string | null;
  activeAccountId: string | null;
  onOpenLauncherSettings?: () => void;
}

const getLoaderIcon = (loader: string) => {
  switch (loader) {
    case "Forge": return <Anvil size={24} className="text-orange-500" />;
    case "Fabric": return <Feather size={24} className="text-yellow-200" />;
    case "Vanilla": return <TreePine size={24} className="text-green-500" />;
    case "NeoForge": return <Hammer size={24} className="text-orange-600" />;
    default: return <TreePine size={24} className="text-white" />;
  }
};

const InstanceIcon = memo(({ iconPath, loaderType, className }: { iconPath?: string; loaderType: string; className?: string }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [iconPath]);

  if (!iconPath || hasError) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        {getLoaderIcon(loaderType)}
      </div>
    );
  }

  return (
    <img 
      src={convertFileSrc(iconPath)} 
      alt="" 
      className={className || "w-full h-full object-cover"} 
      onError={() => setHasError(true)} 
    />
  );
});

export default memo(function Home({ selectedInstance, onSelectInstance, activeUsername, activeAccountId, onOpenLauncherSettings }: HomeProps) {
  const { t } = useTranslation();
  const [showModpackBrowser, setShowModpackBrowser] = useState(false);
  const [showCurseForgeModpackBrowser, setShowCurseForgeModpackBrowser] = useState(false);
  const [showModpackBuilder, setShowModpackBuilder] = useState(false);
  const [activeAccountObj, setActiveAccountObj] = useState<Account | null>(null);

  const [showWardrobe, setShowWardrobe] = useState(false);
  const [savedSkin, setSavedSkin] = useState<SkinPreview | null>(null);

  useEffect(() => {
    let disposed = false;
    invoke<Account[]>("get_accounts").then(accs => {
      if (!disposed) setActiveAccountObj(accs.find(a => a.is_active) || null);
    }).catch(console.error);
    return () => { disposed = true; };
  }, [activeUsername, activeAccountId]);

  useEffect(() => {
    let disposed = false;
    setSavedSkin(null);
    if (activeAccountObj) command<SkinPreview | null>("get_account_skin", { accountId: activeAccountObj.id }).then(skin => { if (!disposed) setSavedSkin(skin); }).catch(console.error);
    return () => { disposed = true; };
  }, [activeAccountObj?.id]);

  const getSkinUrl = () => {
    if (savedSkin) return savedSkin.data_url;
    if (!activeAccountObj) return "https://minotar.net/skin/MHF_Steve";
    if (activeAccountObj.account_type === "ElyBy") {
      return `https://skinsystem.ely.by/skins/${activeAccountObj.username}.png`;
    }
    return `https://minotar.net/skin/${activeAccountObj.uuid || activeAccountObj.username}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return t("home.greeting_night");
    if (hour < 12) return t("home.greeting_morning");
    if (hour < 18) return t("home.greeting_day");
    return t("home.greeting_evening");
  };

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    try {
      const data: Instance[] = await invoke("get_instances");
      setInstances(data);
      if (data.length > 0 && !data.find(i => i.id === selectedInstance)) {
        onSelectInstance(data[0].id);
      }
    } catch (e) {
      console.error("Failed to load instances", e);
    }
  };

  const [instances, setInstances] = useState<Instance[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [managingInstance, setManagingInstance] = useState<string | null>(null);
  const [deletingInstance, setDeletingInstance] = useState<{isOpen: boolean, id: string | null}>({isOpen: false, id: null});
  const [renameModal, setRenameModal] = useState<{isOpen: boolean, id: string | null, currentName: string}>({isOpen: false, id: null, currentName: ""});
  const [isExporting, setIsExporting] = useState<Record<string, boolean>>({});

  const currentInstance = useMemo(() => instances.find(i => i.id === selectedInstance) || instances[0], [instances, selectedInstance]);
  const [showLibrary, setShowLibrary] = useState(false);
  const managedInstance = instances.find(instance => instance.id === managingInstance);

  const [isLaunching, setIsLaunching] = useState(false);
  const [downloadTotal, setDownloadTotal] = useState<number>(0);
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [downloadAction, setDownloadAction] = useState<string>("");
  const downloadedBytesRef = useRef<number>(0);
  const speedCalcRef = useRef({ lastBytes: 0, lastTime: 0 });
  const gameLogsRef = useRef<{stream: string, line: string}[]>([]);
  const [crashLogs, setCrashLogs] = useState<{stream: string, line: string}[]>([]);
  const [crashExitCode, setCrashExitCode] = useState<number | null>(null);
  const [showCrashModal, setShowCrashModal] = useState(false);
  const [managerInitialTab, setManagerInitialTab] = useState<"mods" | "resources" | "diagnostics" | "settings" | "multiplayer">("mods");
  const [quickServer, setQuickServer] = useState("");
  const [showServerBrowser, setShowServerBrowser] = useState(false);

  const currentInstanceRef = useRef(currentInstance);
  useEffect(() => {
    currentInstanceRef.current = currentInstance;
  }, [currentInstance]);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, instanceId: string } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const handleOpenContextMenu = (e: React.MouseEvent, instanceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 260;
    const menuHeight = 460;
    const padding = 12;

    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth - padding) {
      x = Math.max(padding, window.innerWidth - menuWidth - padding);
    }
    if (y + menuHeight > window.innerHeight - padding) {
      y = Math.max(padding, window.innerHeight - menuHeight - padding);
    }

    setContextMenu({ x, y, instanceId });
  };

  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;
    const el = contextMenuRef.current;
    const rect = el.getBoundingClientRect();
    const padding = 12;

    if (rect.right > window.innerWidth - padding) {
      const newX = Math.max(padding, window.innerWidth - rect.width - padding);
      el.style.left = `${newX}px`;
    }
    if (rect.bottom > window.innerHeight - padding) {
      const newY = Math.max(padding, window.innerHeight - rect.height - padding);
      el.style.top = `${newY}px`;
    }
  }, [contextMenu]);

  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener("click", handleClose);
    window.addEventListener("contextmenu", handleClose);
    window.addEventListener("resize", handleClose);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("contextmenu", handleClose);
      window.removeEventListener("resize", handleClose);
    };
  }, []);

  useEffect(() => {
    let unlisten: any;
    let mrpackUnlisten: any;
    let dragUnlisten: any;

    const setupListener = async () => {
      unlisten = await listen("launcher-event", (event: any) => {
        const payload = event.payload;
        if (!payload) return;
        
        let eventType = null;
        let data: any = null;
        
        if (payload.ConsoleOutput) { eventType = "ConsoleOutput"; data = payload.ConsoleOutput; }
        else if (payload.InstanceExited) { eventType = "InstanceExited"; data = payload.InstanceExited; }
        else if (payload.Launch) { eventType = "Launch"; data = payload.Launch; }
        else if (payload.Java) { eventType = "Java"; data = payload.Java; }
        else if (payload.Modloader) { eventType = "Modloader"; data = payload.Modloader; }
        else if (payload.Loader) { eventType = "Loader"; data = payload.Loader; }
        else if (payload.Core) { eventType = "Core"; data = payload.Core; }
        else if (payload.type && payload.data) { eventType = payload.type; data = payload.data; }
        
        if (!eventType || !data) return;

        if (eventType === "ConsoleOutput") {
            gameLogsRef.current.push({
                stream: data.stream === "Stderr" ? "Stderr" : "Stdout",
                line: data.line
            });
            if (gameLogsRef.current.length > 500) {
                gameLogsRef.current.shift();
            }
            return;
        }

        if (eventType === "InstanceExited") {
            setIsLaunching(false);
            setDownloadAction("");
            if (data.exit_code !== 0) {
                setCrashExitCode(data.exit_code);
                setCrashLogs([...gameLogsRef.current]);
                setShowCrashModal(true);
            }
            return;
        }
        
        const eventName = data.event;
        
        if (eventName === "InstallStarted" || eventName === "JavaDownloadStarted") {
           const total = data.total_bytes || 0;
           setDownloadTotal(total);
           downloadedBytesRef.current = 0;
           setDownloadedBytes(0);
           setDownloadSpeed(0);
           speedCalcRef.current = { lastBytes: 0, lastTime: performance.now() };
           
           if (eventType === "Java" || eventName === "JavaDownloadStarted") {
             setDownloadAction(data.version ? `${t("home.download_action.java")} (${data.version})` : t("home.download_action.java"));
           } else if (eventType === "Launch") {
             setDownloadAction(t("home.download_action.game"));
           } else if (eventType === "Loader" || eventType === "Modloader") {
             setDownloadAction(t("home.download_action.loader"));
           }
        }
        
        if (eventName === "InstallProgress") {
           const delta = data.bytes || 0;
           downloadedBytesRef.current += delta;
           const currentBytes = downloadedBytesRef.current;
           setDownloadedBytes(currentBytes);
           
           const now = performance.now();
           const timeDiff = now - speedCalcRef.current.lastTime;
           if (timeDiff > 300) {
             const bytesDiff = currentBytes - speedCalcRef.current.lastBytes;
             const speed = Math.max(0, (bytesDiff / timeDiff) * 1000);
             setDownloadSpeed(speed);
             speedCalcRef.current = { lastBytes: currentBytes, lastTime: now };
           }
        }

        if (eventName === "JavaDownloadProgress") {
           const currentBytes = data.bytes || 0;
           downloadedBytesRef.current = currentBytes;
           setDownloadedBytes(currentBytes);
           
           const now = performance.now();
           const timeDiff = now - speedCalcRef.current.lastTime;
           if (timeDiff > 300) {
             const bytesDiff = currentBytes - speedCalcRef.current.lastBytes;
             const speed = Math.max(0, (bytesDiff / timeDiff) * 1000);
             setDownloadSpeed(speed);
             speedCalcRef.current = { lastBytes: currentBytes, lastTime: now };
           }
        }

        if (eventName === "ExtractionStarted" || eventName === "JavaExtractionStarted") {
           setDownloadAction(eventName === "JavaExtractionStarted" ? t("home.download_action.java_extract") : t("home.download_action.extract"));
           setDownloadTotal(data.total_files || 100);
           downloadedBytesRef.current = 0;
           setDownloadedBytes(0);
        }
        
        if (eventName === "ExtractionProgress" || eventName === "JavaExtractionProgress") {
           const currentFiles = data.files_extracted || data.bytes || 0;
           setDownloadedBytes(currentFiles);
        }

        if (eventName === "InstallCompleted" || eventName === "JavaDownloadCompleted" || eventName === "JavaExtractionCompleted") {
           setDownloadAction(t("home.download_action.checking"));
        }

        if (eventName === "FetchingData" || eventName === "MergingLoaderData") {
           setDownloadAction(t("home.download_action.loader"));
        }

        if (eventName === "ResolveStarted" || eventName === "ModpackResolveStart") {
           setDownloadAction(t("home.download_action.mods"));
        }
        
        if (eventName === "Launching") {
           setDownloadAction(t("home.download_action.launch"));
           setDownloadTotal(0);
           setDownloadedBytes(0);
           setDownloadSpeed(0);
        }

        if (eventName === "Launched") {
           setDownloadAction(t("home.download_action.running"));
        }
      });
      
      mrpackUnlisten = await listen("mrpack-progress", (event: any) => {
        const payload = event.payload;
        if (payload) {
            setIsLaunching(true);
            setDownloadAction(payload.message);
            setDownloadTotal(payload.total);
            setDownloadedBytes(payload.current);
            setDownloadSpeed(0);
            
            if (payload.current >= payload.total && payload.total > 0) {
               setTimeout(() => {
                   setIsLaunching(false);
                   setDownloadAction("");
                   loadInstances();
               }, 1000);
            }
        }
      });
      
      dragUnlisten = await listen("tauri://drag-drop", async (event: any) => {
        const payload = event.payload as any;
        if (payload && payload.paths && payload.paths.length > 0) {
            const path = payload.paths[0];
            if (path.endsWith(".mrpack")) {
                setIsLaunching(true);
                setDownloadAction(t("home.download_action.import_prep"));
                setDownloadTotal(100);
                setDownloadedBytes(0);
                setDownloadSpeed(0);
                
                try {
                    await invoke("import_mrpack", { path });
                } catch (e) {
                    console.error("Import failed:", e);
                    toast.error("Ошибка импорта: " + e);
                    setIsLaunching(false);
                    setDownloadAction("");
                }
            } else if (path.endsWith(".jar")) {
                const instance = currentInstanceRef.current;
                if (!instance) {
                    toast.error("Сначала создайте и выберите сборку.");
                    return;
                }
                try {
                    await invoke("install_mod_jar", { id: instance.id, jarPath: path });
                    toast.success(`Мод успешно установлен в сборку ${instance.name}!`);
                } catch (e) {
                    console.error(e);
                    toast.error("Ошибка установки мода: " + e);
                }
            } else if (path.endsWith(".zip")) {
                const isCF: boolean = await invoke("is_curseforge_pack", { path });
                if (isCF) {
                    await invoke("import_curseforge_pack", { path });
                    return;
                }
                const instance = currentInstanceRef.current;
                if (!instance) {
                    toast.error("Сначала создайте и выберите сборку.");
                    return;
                }
                const isShader = window.confirm("Вы устанавливаете Шейдер? (Нажмите 'ОК' для Шейдера, 'Отмена' для Ресурспака)");
                try {
                    if (isShader) {
                        await invoke("install_shader_zip", { id: instance.id, zipPath: path });
                        toast.success(`Шейдер успешно установлен в сборку ${instance.name}!`);
                    } else {
                        await invoke("install_resourcepack_zip", { id: instance.id, zipPath: path });
                        toast.success(`Ресурспак успешно установлен в сборку ${instance.name}!`);
                    }
                } catch (e) {
                    console.error(e);
                    toast.error("Ошибка установки: " + e);
                }
            }
        }
      });
    };
    
    setupListener();
    return () => {
      if (unlisten) unlisten();
      if (mrpackUnlisten) mrpackUnlisten();
      if (dragUnlisten) dragUnlisten();
    };
  }, []);

  const handleLaunch = async (serverUrl?: string, instanceId = currentInstance?.id) => {
    if (isLaunching || !instanceId) return;
    setIsLaunching(true);

    setDownloadAction(t("home.download_action.checking"));
    setDownloadTotal(0);
    downloadedBytesRef.current = 0;
    setDownloadedBytes(0);
    setDownloadSpeed(0);
    
    try {
      const accounts: any[] = await invoke("get_accounts");
      const activeAccount = accounts.find(a => a.is_active);
      
      if (!activeAccount) {
        toast.error(t("home.lobby.choose_account"));
        setIsLaunching(false);

        return;
      }
      
      const targetServer = typeof serverUrl === "string" ? serverUrl : (quickServer.trim() || undefined);

      await invoke("launch_game", { 
        accountId: activeAccount.id,
        instanceId,
        server: targetServer || null
      });
      
      await invoke("update_instance_played", { id: instanceId });
      loadInstances();

    } catch (e) {
      console.error(e);
      toast.error("Ошибка запуска: " + e);

    }
    
    setIsLaunching(false);
    setDownloadAction("");
  };

  return (
    <div className="home-deck">
      {/* Cinematic tech backdrop with blueprint grid and embers */}
      <div className="deck-backdrop" aria-hidden="true">
        <div className="deck-ambient-glow" />
        <div className="deck-tech-grid" />
        {Array.from({ length: 18 }, (_, index) => (
          <i
            key={index}
            className="deck-ember"
            style={{
              left: `${8 + ((index * 33) % 84)}%`,
              top: `${10 + ((index * 29) % 78)}%`,
              width: index % 3 === 0 ? 6 : 3,
              height: index % 3 === 0 ? 6 : 3,
              animationDelay: `${index * -0.65}s`,
            }}
          />
        ))}
      </div>

      {/* LEFT COLUMN: PILOT & 3D CHARACTER POD */}
      <aside className="deck-pod" aria-label={t("home.lobby.character")}>
        {/* Pilot header */}
        <div className="deck-pilot-header">
          <div className="deck-pilot-eyebrow">
            <span>REDPANDA PILOT</span>
            <span className="deck-pilot-status-pill">
              <i className="deck-status-dot" />
              {activeAccountObj ? (activeAccountObj.account_type === "Microsoft" ? "MS" : activeAccountObj.account_type === "ElyBy" ? "ELY" : "LOCAL") : "GUEST"}
            </span>
          </div>
          <h2 className="deck-pilot-greeting">
            {getGreeting()}, <strong title={activeUsername || t("home.player")}>{activeUsername || t("home.player")}</strong>
          </h2>
        </div>

        {/* 3D Hologram Pedestal Stage */}
        <div className="deck-pedestal-stage">
          <div className="deck-pedestal-hologram">
            <Suspense fallback={<div className="deck-character-loading"><Loader2 size={28} className="animate-spin" /></div>}>
              <SkinViewer skinUrl={getSkinUrl()} model={savedSkin?.model} responsive width={320} height={360} />
            </Suspense>
          </div>
          <div className="deck-pedestal-base" aria-hidden="true">
            <div className="deck-pedestal-ring" />
            <div className="deck-pedestal-shadow" />
            <span className="deck-pedestal-tag">POD-01 · {savedSkin?.model === "slim" ? "SLIM 3PX" : "CLASSIC 4PX"}</span>
          </div>
        </div>

        {/* Pod actions */}
        <div className="deck-pod-actions">
          <button
            className="deck-wardrobe-btn"
            disabled={!activeAccountObj}
            onClick={() => setShowWardrobe(true)}
            title={t("wardrobe.title")}
          >
            <Shirt size={15} />
            <span>{t("wardrobe.title")}</span>
            <ArrowUpRight size={14} />
          </button>
          <button
            className="deck-server-radar-btn"
            onClick={() => setShowServerBrowser(true)}
            title={t("home.lobby.friends")}
          >
            <Users size={15} />
            <span>{t("home.lobby.friends")}</span>
            <span className="deck-badge-p2p">P2P</span>
          </button>
        </div>
      </aside>

      {/* RIGHT COLUMN: COMMAND DECK & RIG CONTROLS */}
      <main className="deck-main" aria-label="Command Deck">
        {/* TIER 1: ACTIVE RIG SHOWCASE */}
        <section className="deck-rig-card" aria-label={t("home.selected_instance")}>
          <div className="deck-rig-primary">
            <div
              className="deck-rig-icon"
              onClick={() => setShowLibrary(true)}
              onContextMenu={event => { if (currentInstance) handleOpenContextMenu(event, currentInstance.id); }}
              role="button"
              tabIndex={0}
              title={t("home.lobby.choose_instance")}
            >
              {currentInstance ? (
                <InstanceIcon iconPath={currentInstance.icon_path} loaderType={currentInstance.loader_type} />
              ) : (
                <Layers size={32} />
              )}
              <span className="deck-rig-loader-tag">{currentInstance?.loader_type || "VANILLA"}</span>
            </div>

            <div className="deck-rig-meta">
              <div className="deck-rig-eyebrow">
                <span>{t("home.selected_instance")}</span>
                <span className="deck-rig-divider">/</span>
                <span>{currentInstance ? `MINECRAFT ${currentInstance.game_version}` : "NO INSTANCE"}</span>
              </div>
              <h1 className="deck-rig-title" title={currentInstance?.name || t("home.lobby.choose_instance")}>
                {currentInstance?.name || t("home.lobby.choose_instance")}
              </h1>
              <div className="deck-rig-stats">
                <span className="deck-rig-stat-item">
                  <TreePine size={13} />
                  {currentInstance ? `${currentInstance.loader_type} ${currentInstance.loader_version || ""}`.trim() : "—"}
                </span>
                <span className="deck-rig-stat-item">
                  <span className="deck-stat-dot" />
                  {currentInstance
                    ? t("home.lobby.play_time", {
                        hours: Math.floor((currentInstance.total_play_time_seconds || 0) / 3600),
                        minutes: Math.floor(((currentInstance.total_play_time_seconds || 0) % 3600) / 60),
                      })
                    : "0 ч"}
                </span>
              </div>
            </div>
          </div>

          {/* Rig direct tools */}
          <div className="deck-rig-tools">
            <button
              className="deck-tool-btn deck-tool-btn--primary"
              disabled={!currentInstance || isLaunching}
              onClick={() => currentInstance && setManagingInstance(currentInstance.id)}
              title={t("home.lobby.manage")}
            >
              <Settings size={15} />
              <span>{t("instance_manager.mods")}</span>
            </button>
            <button
              className="deck-tool-btn"
              disabled={!currentInstance}
              onClick={() => currentInstance && invoke("open_instance_folder", { id: currentInstance.id }).catch(console.error)}
              title={t("home.lobby.folder")}
              aria-label={t("home.lobby.folder")}
            >
              <Folder size={15} />
            </button>
            <button
              className="deck-tool-btn"
              onClick={() => {
                setCrashExitCode(null);
                setCrashLogs(gameLogsRef.current);
                setShowCrashModal(true);
              }}
              title={t("home.lobby.logs")}
              aria-label={t("home.lobby.logs")}
            >
              <FileText size={15} />
            </button>
          </div>
        </section>

        {/* TIER 2: INSTANT INSTANCE SWITCHER STRIP */}
        <section className="deck-strip-section" aria-label={t("home.lobby.library")}>
          <div className="deck-strip-header">
            <span className="deck-strip-label">
              <Layers size={13} />
              {t("home.lobby.library")} ({instances.length})
            </span>
            <div className="deck-strip-actions">
              <button className="deck-strip-action-btn" onClick={() => setShowCreateModal(true)}>
                <Plus size={12} /> {t("home.add_instance")}
              </button>
              <button className="deck-strip-action-btn" onClick={() => setShowLibrary(true)}>
                <ChevronDown size={12} /> {t("home.lobby.library")}
              </button>
            </div>
          </div>

          <div className="deck-strip-carousel custom-scrollbar">
            {instances.map((inst) => {
              const isSelected = inst.id === currentInstance?.id;
              return (
                <button
                  key={inst.id}
                  className={`deck-strip-card ${isSelected ? "is-selected" : ""}`}
                  onClick={() => onSelectInstance(inst.id)}
                  onContextMenu={(event) => handleOpenContextMenu(event, inst.id)}
                  title={`${inst.name} (${inst.game_version} · ${inst.loader_type})`}
                >
                  <div className="deck-strip-card-icon">
                    <InstanceIcon iconPath={inst.icon_path} loaderType={inst.loader_type} />
                  </div>
                  <div className="deck-strip-card-info">
                    <strong>{inst.name}</strong>
                    <span>{inst.game_version} · {inst.loader_type}</span>
                  </div>
                  {isSelected && <span className="deck-strip-active-indicator" />}
                </button>
              );
            })}
            {instances.length === 0 && (
              <div className="deck-strip-empty">
                <span>{t("home.lobby.empty")}</span>
              </div>
            )}
          </div>
        </section>

        {/* TIER 3: BENTO FEATURE HUBS */}
        <section className="deck-bento-grid">
          {/* Bento 1: Smart Modpack Studio */}
          <div
            className="deck-bento-card deck-bento-card--builder"
            onClick={() => setShowModpackBuilder(true)}
            role="button"
            tabIndex={0}
          >
            <div className="deck-bento-visual">
              <img src="/bento_modpack.jpg" alt="" className="deck-bento-visual__img" />
              <div className="deck-bento-visual__gradient" />
            </div>
            <div className="deck-bento-card-content">
              <div className="deck-bento-header">
                <span className="deck-bento-badge flex items-center gap-1"><Wand2 size={11} />BETA · AI PRESETS</span>
                <ArrowUpRight size={14} className="text-orange-400" />
              </div>
              <h3>{t("home.lobby.build")}</h3>
              <p>{t("home.lobby.build_hint")}</p>
              <div className="deck-bento-tags">
                <span>⚡ FPS Boost</span>
                <span>✨ Shaders</span>
                <span>🌲 Vanilla+</span>
              </div>
            </div>
          </div>

          {/* Bento 2: Mod Catalogs Modrinth / CurseForge */}
          <div className="deck-bento-card deck-bento-card--catalogs">
            <div className="deck-bento-visual">
              <img src="/bento_catalogs.jpg" alt="" className="deck-bento-visual__img" />
              <div className="deck-bento-visual__gradient" />
            </div>
            <div className="deck-bento-card-content">
              <div className="deck-bento-header">
                <span className="deck-bento-badge deck-bento-badge--cyan">50,000+ MODS</span>
                <Download size={14} className="text-sky-400" />
              </div>
              <h3>Каталоги модов</h3>
              <p>Быстрый поиск и загрузка модификаций</p>
              <div className="deck-bento-buttons">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowModpackBrowser(true);
                  }}
                >
                  Modrinth <Download size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCurseForgeModpackBrowser(true);
                  }}
                >
                  CurseForge <Download size={12} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* TIER 4: IGNITION LAUNCH CONSOLE */}
        <section className="deck-ignition-console">
          {/* Direct server address */}
          <div className="deck-ignition-server">
            <Globe size={15} className="text-muted shrink-0" />
            <input
              type="text"
              value={quickServer}
              onChange={(e) => setQuickServer(e.target.value)}
              placeholder="Прямой IP (напр. hypixel.net)..."
              className="deck-server-input"
            />
            {quickServer && (
              <button
                className="deck-server-clear"
                onClick={() => setQuickServer("")}
                title={t("home.lobby.clear_server")}
                aria-label={t("home.lobby.clear_server")}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Center status / telemetry */}
          <div className="deck-ignition-telemetry">
            {isLaunching ? (
              <div className="deck-telemetry-progress" role="status">
                <div className="deck-telemetry-text">
                  <span className="truncate max-w-[200px]" title={downloadAction}>{downloadAction}</span>
                  <span>{downloadSpeed > 0 ? `${(downloadSpeed / 1024 / 1024).toFixed(1)} МБ/с` : ""}</span>
                </div>
                <div className="deck-telemetry-bar">
                  <i
                    style={{
                      width: downloadTotal > 0 ? `${Math.min(100, (downloadedBytes / downloadTotal) * 100)}%` : "100%",
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="deck-telemetry-idle">
                <span className="deck-telemetry-dot" />
                <span className="truncate">
                  {!currentInstance
                    ? t("home.lobby.choose_instance")
                    : !activeAccountObj
                    ? t("home.lobby.choose_account")
                    : quickServer
                    ? `Вход на: ${quickServer}`
                    : t("home.lobby.ready")}
                </span>
              </div>
            )}
          </div>

          {/* Massive launch button */}
          <button
            className="deck-launch-btn"
            onClick={() => handleLaunch(quickServer || undefined)}
            disabled={isLaunching || !currentInstance}
          >
            <span className="deck-launch-btn__icon">
              {isLaunching ? <Loader2 size={24} className="animate-spin text-black" /> : <Play size={24} fill="currentColor" />}
            </span>
            <span className="deck-launch-btn__text">
              <strong>{isLaunching ? t("home.launching") : t("home.play")}</strong>
              <small>
                {isLaunching
                  ? downloadTotal > 0
                    ? `${Math.min(100, Math.round((downloadedBytes / downloadTotal) * 100))}%`
                    : downloadAction
                  : currentInstance
                  ? t("home.lobby.play_time", {
                      hours: Math.floor((currentInstance.total_play_time_seconds || 0) / 3600),
                      minutes: Math.floor(((currentInstance.total_play_time_seconds || 0) % 3600) / 60),
                    })
                  : t("home.lobby.choose_instance")}
              </small>
            </span>
          </button>
        </section>
      </main>

      {showLibrary && <InstanceLibrary instances={instances} selectedId={currentInstance?.id} onSelect={onSelectInstance} onClose={() => setShowLibrary(false)} onCreate={() => setShowCreateModal(true)} onContextMenu={(event, id) => { setShowLibrary(false); handleOpenContextMenu(event, id); }} />}
      {showWardrobe && activeAccountObj && <Suspense fallback={null}><WardrobeModal key={activeAccountObj.id} account={activeAccountObj} selectedInstance={selectedInstance} onClose={() => setShowWardrobe(false)} onApplied={setSavedSkin} /></Suspense>}

      {showCreateModal && (
        <Suspense fallback={null}>
          <CreateInstanceModal
            onClose={() => setShowCreateModal(false)}
            onCreated={() => {
              setShowCreateModal(false);
              loadInstances();
            }}
          />
        </Suspense>
      )}

      {showModpackBrowser && (
        <Suspense fallback={null}>
          <ModrinthBrowser
            onClose={() => {
              setShowModpackBrowser(false);
              loadInstances();
            }}
            projectType="modpack"
          />
        </Suspense>
      )}

      {showCurseForgeModpackBrowser && (
        <Suspense fallback={null}>
          <CurseForgeBrowser
            onClose={() => {
              setShowCurseForgeModpackBrowser(false);
              loadInstances();
            }}
            projectType="modpack"
          />
        </Suspense>
      )}

      {showModpackBuilder && (
        <Suspense fallback={null}>
          <ModpackBuilderModal
            onClose={() => setShowModpackBuilder(false)}
            onInstanceCreated={(newInstanceId) => {
              loadInstances();
              onSelectInstance(newInstanceId);
            }}
          />
        </Suspense>
      )}

      {managingInstance && managedInstance && (
        <Suspense fallback={null}>
          <InstanceManagerModal
            instance={managedInstance}
            initialTab={managerInitialTab}
            onClose={() => {
              setManagingInstance(null);
              setManagerInitialTab("mods");
              loadInstances();
            }}
            onDelete={() => {
              setManagingInstance(null);
              setManagerInitialTab("mods");
              loadInstances();
            }}
          />
        </Suspense>
      )}
      
      {showCrashModal && (
        <Suspense fallback={null}>
          <CrashModal
            logs={crashLogs}
            exitCode={crashExitCode}
            instanceId={currentInstance?.id}
            onClose={() => setShowCrashModal(false)}
            onOpenMods={() => {
              setShowCrashModal(false);
              setManagerInitialTab("mods");
              if (currentInstance) setManagingInstance(currentInstance.id);
            }}
            onOpenSettings={() => {
              setShowCrashModal(false);
              setManagerInitialTab("settings");
              if (currentInstance) setManagingInstance(currentInstance.id);
            }}
            onOpenLauncherSettings={() => {
              setShowCrashModal(false);
              if (onOpenLauncherSettings) {
                onOpenLauncherSettings();
              }
            }}
          />
        </Suspense>
      )}

      {showServerBrowser && (
        <Suspense fallback={null}>
          <ServerBrowserModal
            selectedInstanceName={currentInstance?.name}
            onClose={() => setShowServerBrowser(false)}
            onConnectServer={(address) => {
              setQuickServer(address);
              setShowServerBrowser(false);
              setTimeout(() => {
                handleLaunch(address);
              }, 100);
            }}
          />
        </Suspense>
      )}

      {contextMenu && (
        <div 
          ref={contextMenuRef}
          className="fixed z-50 bg-card brutalist-border rounded-none py-1 min-w-[260px] max-h-[calc(100vh-24px)] overflow-y-auto custom-scrollbar shadow-2xl animate-in fade-in zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <div className="px-3 py-2 border-b border-border mb-1">
            <span className="text-xs font-semibold text-muted">{t("home.context_menu.options")}</span>
          </div>
          <button 
            className="w-full text-left px-4 py-2 hover:bg-background text-sm text-white flex items-center gap-3"
            onClick={(e) => { e.stopPropagation(); setManagingInstance(contextMenu.instanceId); setContextMenu(null); }}
          >
            <Settings size={14} /> {t("home.context_menu.settings")}
          </button>
          <button 
            className="w-full text-left px-4 py-2 hover:bg-background text-sm text-white flex items-center gap-3"
            onClick={(e) => { 
                e.stopPropagation(); 
                onSelectInstance(contextMenu.instanceId);
                handleLaunch(undefined, contextMenu.instanceId);
                setContextMenu(null); 
            }}
          >
            <Play size={14} /> {t("home.context_menu.play")}
          </button>
            <button 
              className="w-full text-left px-4 py-2 hover:bg-background text-sm text-white flex items-center gap-3"
              onClick={async (e) => { 
                  e.stopPropagation(); 
                  try { await invoke("open_instance_folder", { id: contextMenu.instanceId }); } catch(err) { alert(err); }
                  setContextMenu(null); 
              }}
            >
              <Folder size={14} /> {t("home.context_menu.folder")}
            </button>
            <button 
              className="w-full text-left px-4 py-2 hover:bg-background text-sm text-white flex items-center gap-3"
              onClick={async (e) => { 
                  e.stopPropagation(); 
                  try { await invoke("open_instance_logs", { id: contextMenu.instanceId }); } catch(err) { alert(err); }
                  setContextMenu(null); 
              }}
            >
              <FileText size={14} /> {t("home.context_menu.logs")}
            </button>
          
          <div className="my-1 border-t border-border" />
          
          <button 
            className="w-full text-left px-4 py-2 hover:bg-background text-sm text-white flex items-center gap-3 transition-colors"
            onClick={(e) => { 
                e.stopPropagation(); 
                const inst = instances.find(i => i.id === contextMenu.instanceId);
                if (inst) {
                  setRenameModal({ isOpen: true, id: inst.id, currentName: inst.name });
                }
                setContextMenu(null); 
            }}
          >
             <FileText size={14} /> {t("home.context_menu.rename")}
          </button>
          
          <button 
            className="w-full text-left px-4 py-2 hover:bg-background text-sm text-white flex items-center gap-3 transition-colors"
            onClick={async (e) => { 
                e.stopPropagation(); 
                const id = contextMenu.instanceId;
                setContextMenu(null); 
                try {
                  await invoke("clone_instance", { id });
                  loadInstances();
                  toast.success("Сборка успешно скопирована");
                } catch(err) {
                  toast.error("Ошибка при копировании: " + err);
                }
            }}
          >
             <Copy size={14} /> {t("home.context_menu.duplicate")}
          </button>
          
          <button 
            className="w-full text-left px-4 py-2 hover:bg-background text-sm text-white flex items-center gap-3 transition-colors"
            onClick={async (e) => { 
                e.stopPropagation(); 
                const id = contextMenu.instanceId;
                setContextMenu(null);
                try {
                  const selectedPath = await open({
                    multiple: false,
                    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
                  });
                  if (selectedPath) {
                    await invoke("set_instance_icon", { id, iconPath: selectedPath });
                    loadInstances();
                  }
                } catch(err) {
                  toast.error(t("common.error") + ": " + err);
                }
            }}
          >
             <Plus size={14} /> {t("home.context_menu.icon")}
          </button>
          
          <button 
            className="w-full text-left px-4 py-2 hover:bg-background text-sm text-white flex items-center gap-3 transition-colors"
            onClick={async (e) => { 
                e.stopPropagation(); 
                const id = contextMenu.instanceId;
                setContextMenu(null);
                try {
                  const res = await invoke("create_instance_shortcut", { id });
                  toast.success(String(res));
                } catch(err) {
                  toast.error("Не удалось создать ярлык: " + err);
                }
            }}
          >
             <ExternalLink size={14} /> {t("home.context_menu.desktop_shortcut")}
          </button>
          
          <button 
            className="w-full text-left px-4 py-2 hover:bg-background text-sm text-white flex items-center gap-3 transition-colors"
            onClick={async (e) => { 
                e.stopPropagation(); 
                const id = contextMenu.instanceId;
                setContextMenu(null);
                try {
                  const savePath = await save({
                    filters: [
                      { name: 'ZIP Archive', extensions: ['zip'] },
                      { name: 'Modrinth Modpack', extensions: ['mrpack'] }
                    ]
                  });
                  if (savePath) {
                    setIsExporting(prev => ({...prev, [id]: true}));
                    await invoke("export_instance", { id, destPath: savePath });
                    setIsExporting(prev => ({...prev, [id]: false}));
                  }
                } catch(err) {
                  toast.error(t("common.error") + ": " + err);
                  setIsExporting(prev => ({...prev, [id]: false}));
                }
            }}
          >
             {isExporting[contextMenu.instanceId] ? <Loader2 size={14} className="animate-spin" /> : <Folder size={14} />} {t("home.context_menu.export")}
          </button>
          
          <div className="my-1 border-t border-border" />
          
          <button 
            className="w-full text-left px-4 py-2 hover:bg-red-500/20 text-sm text-red-400 flex items-center gap-3 transition-colors"
            onClick={(e) => { 
                e.stopPropagation(); 
                setDeletingInstance({ isOpen: true, id: contextMenu.instanceId });
                setContextMenu(null); 
            }}
          >
            <Trash2 size={14} /> {t("home.context_menu.delete")}
          </button>
        </div>
      )}

      {deletingInstance.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80  animate-in fade-in duration-200" onClick={() => setDeletingInstance({ isOpen: false, id: null })}>
          <div className="bg-card brutalist-border rounded-none  w-[400px] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 text-red-400 mb-4">
                <div className="w-10 h-10 rounded-none bg-red-500/10 flex items-center justify-center">
                  <Trash2 size={20} />
                </div>
                <h3 className="text-xl font-bold">Удалить сборку?</h3>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                Вы уверены, что хотите удалить эту сборку? Это действие нельзя отменить, все миры и моды будут удалены.
              </p>
              
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setDeletingInstance({ isOpen: false, id: null })}
                  className="px-4 py-2 rounded-none text-sm font-medium hover:bg-card-hover transition-colors"
                >
                  Отмена
                </button>
                <button 
                  onClick={async () => {
                    if (deletingInstance.id) {
                      try {
                        await invoke("remove_instance", { id: deletingInstance.id });
                        loadInstances();
                      } catch(err) {
                        toast.error("Ошибка при удалении: " + err);
                      }
                    }
                    setDeletingInstance({ isOpen: false, id: null });
                  }}
                  className="px-4 py-2 rounded-none text-sm font-bold bg-red-500 hover:bg-red-600 text-white transition-colors  "
                >
                  Удалить навсегда
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {renameModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80  animate-in fade-in duration-200" onClick={() => setRenameModal({ isOpen: false, id: null, currentName: "" })}>
          <div className="bg-card brutalist-border rounded-none  w-[400px] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 text-white mb-4">
                <div className="w-10 h-10 rounded-none bg-primary/20 flex items-center justify-center text-primary">
                  <FileText size={20} />
                </div>
                <h3 className="text-xl font-bold">Переименовать сборку</h3>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Введите новое имя для вашей сборки.
              </p>
              
              <input 
                autoFocus
                type="text" 
                value={renameModal.currentName} 
                onChange={(e) => setRenameModal(prev => ({...prev, currentName: e.target.value}))}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && renameModal.currentName.trim()) {
                    if (renameModal.id) {
                      try {
                        await invoke("rename_instance", { id: renameModal.id, newName: renameModal.currentName.trim() });
                        loadInstances();
                        toast.success("Сборка переименована");
                      } catch(err) {
                        toast.error("Ошибка: " + err);
                      }
                    }
                    setRenameModal({ isOpen: false, id: null, currentName: "" });
                  }
                }}
                className="w-full bg-background brutalist-border rounded-none px-4 py-3 text-white outline-none focus:border-primary transition-colors mb-6"
                placeholder="Новое имя сборки"
              />
              
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setRenameModal({ isOpen: false, id: null, currentName: "" })}
                  className="px-4 py-2 rounded-none text-sm font-medium hover:bg-card-hover transition-colors"
                >
                  Отмена
                </button>
                <button 
                  disabled={!renameModal.currentName.trim()}
                  onClick={async () => {
                    if (renameModal.id && renameModal.currentName.trim()) {
                      try {
                        await invoke("rename_instance", { id: renameModal.id, newName: renameModal.currentName.trim() });
                        loadInstances();
                        toast.success("Сборка переименована");
                      } catch(err) {
                        toast.error("Ошибка: " + err);
                      }
                    }
                    setRenameModal({ isOpen: false, id: null, currentName: "" });
                  }}
                  className="px-4 py-2 rounded-none text-sm font-bold bg-primary hover:bg-primary-hover text-primary-foreground disabled:opacity-50 transition-colors  "
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
