import { Account } from "../lib/ipc";
import { 
  Plus, Play, Anvil, Feather, TreePine, Hammer, Settings, Loader2, Folder, 
  FileText, Trash2, Copy, ExternalLink, ChevronRight, 
  Box, Blocks, Layers, Puzzle, User, Pickaxe, Globe, X, AlertCircle, Home as HomeIcon,
  MessageCircle, Send, GitBranch, Sparkles, Minus, Square
} from "lucide-react";
import { useState, useEffect, useLayoutEffect, useMemo, memo, useRef, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "../components/Toast";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from '@tauri-apps/api/window';
import { openUrl } from '@tauri-apps/plugin-opener';
import AccountSelector from "../components/AccountSelector";
import InstanceLibrary from "../components/InstanceLibrary";
import packageInfo from "../../package.json";

const CreateInstanceModal = lazy(() => import("../components/CreateInstanceModal"));
const InstanceManagerModal = lazy(() => import("../components/InstanceManagerModal"));
const CrashModal = lazy(() => import("../components/CrashModal"));
const ModrinthBrowser = lazy(() => import("../components/ModrinthBrowser"));
const CurseForgeBrowser = lazy(() => import("../components/CurseForgeBrowser"));
const ModpackBuilderModal = lazy(() => import("../components/ModpackBuilderModal"));
const WardrobeModal = lazy(() => import("../components/WardrobeModal"));
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
  onAccountChange?: (username: string | null, accountId: string | null) => void;
  onOpenLauncherSettings?: () => void;
  onOpenFolder?: () => void;
  onOpenLogs?: () => void;
  updateInfo?: any;
  onOpenUpdateModal?: () => void;
}

const getLoaderIcon = (loader: string) => {
  switch (loader) {
    case "Forge": return <Anvil size={20} className="text-orange-500" />;
    case "Fabric": return <Feather size={20} className="text-yellow-200" />;
    case "Vanilla": return <TreePine size={20} className="text-green-500" />;
    case "NeoForge": return <Hammer size={20} className="text-orange-600" />;
    default: return <TreePine size={20} className="text-white" />;
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

export default memo(function Home({ 
  selectedInstance, 
  onSelectInstance, 
  activeUsername, 
  activeAccountId, 
  onAccountChange,
  onOpenLauncherSettings,
  onOpenFolder,
  onOpenLogs,
  updateInfo,
  onOpenUpdateModal
}: HomeProps) {
  const { t } = useTranslation();
  const appWindow = getCurrentWindow();

  const [instances, setInstances] = useState<Instance[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [managingInstance, setManagingInstance] = useState<string | null>(null);
  const [managerInitialTab, setManagerInitialTab] = useState<"mods" | "resources" | "diagnostics" | "settings" | "multiplayer">("mods");
  
  const [showModpackBrowser, setShowModpackBrowser] = useState(false);
  const [showCurseForgeModpackBrowser, setShowCurseForgeModpackBrowser] = useState(false);
  const [showModpackBuilder, setShowModpackBuilder] = useState(false);
  const [showWardrobe, setShowWardrobe] = useState(false);
  const [showServerBrowser, setShowServerBrowser] = useState(false);
  
  const [deletingInstance, setDeletingInstance] = useState<{isOpen: boolean, id: string | null}>({isOpen: false, id: null});
  const [renameModal, setRenameModal] = useState<{isOpen: boolean, id: string | null, currentName: string}>({isOpen: false, id: null, currentName: ""});
  const [isExporting, setIsExporting] = useState<Record<string, boolean>>({});

  const [activeAccountObj, setActiveAccountObj] = useState<Account | null>(null);
  const [accountsCount, setAccountsCount] = useState<number>(1);
  const [modCount, setModCount] = useState<number | null>(null);

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
  const [quickServer, setQuickServer] = useState("");

  const currentInstance = useMemo(() => instances.find(i => i.id === selectedInstance) || instances[0], [instances, selectedInstance]);
  const managedInstance = instances.find(instance => instance.id === managingInstance);

  const currentInstanceRef = useRef(currentInstance);
  useEffect(() => {
    currentInstanceRef.current = currentInstance;
  }, [currentInstance]);

  // Load instances
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

  useEffect(() => {
    loadInstances();
  }, []);

  // Accounts information
  useEffect(() => {
    let disposed = false;
    invoke<Account[]>("get_accounts").then(accs => {
      if (!disposed) {
        setAccountsCount(accs.length || 1);
        setActiveAccountObj(accs.find(a => a.is_active) || null);
      }
    }).catch(console.error);
    return () => { disposed = true; };
  }, [activeUsername, activeAccountId]);

  // Fetch installed mods count for current instance
  useEffect(() => {
    if (currentInstance?.id) {
      invoke<any[]>("get_installed_mods", { instanceId: currentInstance.id })
        .then(mods => setModCount(mods.length))
        .catch(() => setModCount(null));
    } else {
      setModCount(null);
    }
  }, [currentInstance?.id]);

  // Format helpers
  const formatModCount = (count: number) => {
    const lastDigit = count % 10;
    const lastTwo = count % 100;
    if (lastTwo >= 11 && lastTwo <= 19) return `${count} модов`;
    if (lastDigit === 1) return `${count} мод`;
    if (lastDigit >= 2 && lastDigit <= 4) return `${count} мода`;
    return `${count} модов`;
  };

  const formatLastPlayed = (timestamp?: number | null) => {
    if (!timestamp) return "Не запускалась";
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const isToday = now.toDateString() === date.toDateString();
    
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = yesterday.toDateString() === date.toDateString();
    
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) return `Сегодня, ${timeStr}`;
    if (isYesterday) return `Вчера, ${timeStr}`;
    return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}, ${timeStr}`;
  };

  // Recent instances sorted by last_played desc
  const recentInstances = useMemo(() => {
    return [...instances]
      .filter(instance => Boolean(instance.last_played))
      .sort((a, b) => (b.last_played || 0) - (a.last_played || 0))
      .slice(0, 5);
  }, [instances]);

  // Context Menu
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

  // Listeners for launcher events
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
        
        if (eventName === "InstallProgress" || eventName === "JavaDownloadProgress") {
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
            let isCF = false;
            try {
              isCF = await invoke<boolean>("is_curseforge_pack", { path });
            } catch (e) {
              console.error("Не удалось определить тип архива:", e);
              toast.error("Не удалось прочитать архив: " + e);
              return;
            }
            if (isCF) {
              try {
                await invoke("import_curseforge_pack", { path });
              } catch (e) {
                console.error("Импорт сборки CurseForge не удался:", e);
                toast.error("Ошибка импорта сборки CurseForge: " + e);
              }
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

  // Launch game
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
    <div className="hub-root">
      {/* 0. TOP WINDOW HEADER BAR — лого слева, аккаунт и управление окном справа, на всю ширину окна */}
      <header
        className="hub-top-header"
        onMouseDown={event => {
          if (!(event.target as HTMLElement).closest('button, input, a, .account-selector')) {
            appWindow.startDragging();
          }
        }}
      >
        <div className="hub-brand">
          <img src="/logo.png" alt="RedPanda" />
          <div className="hub-brand-text">
            <span className="hub-brand-title">REDPANDA</span>
            <span className="hub-brand-subtitle">LAUNCHER</span>
          </div>
        </div>

        <div className="hub-drag-zone">
          {updateInfo?.has_update && (
            <button 
              onClick={() => onOpenUpdateModal?.()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#f55e1d]/20 border border-[#f55e1d]/40 text-[#f55e1d] text-xs font-mono font-bold animate-pulse"
            >
              <Sparkles size={13} />
              <span>Обновление v{updateInfo.latest_version}</span>
            </button>
          )}
        </div>

        <div className="hub-header-actions">
          <AccountSelector 
            variant="lobby" 
            onAccountChange={(username, id) => {
              onAccountChange?.(username, id);
            }} 
          />

          <button 
            className="hub-icon-btn" 
            onClick={() => onOpenFolder ? onOpenFolder() : invoke("open_launcher_folder").catch(console.error)} 
            title={t("app.launcher_folder")}
          >
            <Folder size={17} />
          </button>

          <button 
            className="hub-icon-btn" 
            onClick={() => onOpenLauncherSettings?.()} 
            title={t("app.launcher_settings")}
          >
            <Settings size={18} />
          </button>

          <div className="hub-win-controls">
            <button 
              onClick={() => appWindow.minimize()} 
              className="hub-win-btn" 
              title={t("home.lobby.minimize")}
            >
              <Minus size={15} />
            </button>
            <button 
              onClick={() => appWindow.toggleMaximize()} 
              className="hub-win-btn" 
              title={t("home.lobby.maximize")}
            >
              <Square size={12} />
            </button>
            <button 
              onClick={() => appWindow.close()} 
              className="hub-win-btn hub-win-btn--close" 
              title={t("common.close")}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* 1. LEFT NAVIGATION SIDEBAR */}
      <aside className="hub-sidebar-left">
        <div className="flex flex-col">
          {/* Navigation Items */}
          <nav className="hub-nav-menu">
            <button 
              className="hub-nav-item is-active"
              onClick={() => {}}
            >
              <HomeIcon size={18} />
              <span>Главная</span>
            </button>
            <button 
              className="hub-nav-item"
              onClick={() => setShowLibrary(true)}
            >
              <Box size={18} />
              <span>Играть</span>
            </button>
            <button 
              className="hub-nav-item"
              onClick={() => setShowModpackBuilder(true)}
            >
              <Layers size={18} />
              <span>Моды</span>
            </button>
            <button 
              className="hub-nav-item"
              onClick={() => setShowWardrobe(true)}
            >
              <Folder size={18} />
              <span>Профили</span>
            </button>
            <button 
              className="hub-nav-item"
              onClick={() => onOpenLauncherSettings?.()}
            >
              <Settings size={18} />
              <span>Настройки</span>
            </button>
          </nav>
        </div>

        {/* Mascot Bottom Card */}
        <div className="hub-mascot-card">
          <img src="/logo.png" alt="" />
          <span className="hub-mascot-text">
            Больше, чем просто игра
          </span>
        </div>
      </aside>

      {/* 2. CENTER MAIN COLUMN */}
      <main className="hub-center">
        {/* Scrollable Main Content */}
        <div className="hub-scroll-area custom-scrollbar">
          {/* HERO BANNER ("РЕКОМЕНДУЕМ" / Active Instance) */}
          <section className="hub-hero-banner">
            <div 
              className="hub-hero-bg"
              style={{ backgroundImage: 'url("/hero_sunset.jpg")' }}
            />
            <div className="hub-hero-overlay" />

            <div className="hub-hero-content">
              {/* Eyebrow */}
              <span className="hub-hero-eyebrow">РЕКОМЕНДУЕМ</span>

              {/* Title */}
              <h1 className="hub-hero-title">
                {currentInstance?.name || "TechnoMagic RPG"}
              </h1>

              {/* Description */}
              <p className="hub-hero-desc">
                {currentInstance?.id === "technomagic-rpg" 
                  ? "Магия, технологии и бесконечные возможности в одной сборке."
                  : "Погрузитесь в захватывающий игровой мир Minecraft с высокой производительностью и удобством."}
              </p>

              {/* Badges / Meta */}
              <div className="hub-hero-meta">
                <span className="hub-hero-meta-item">
                  <Box size={13} />
                  {currentInstance?.game_version || "—"}
                </span>
                <span className="hub-hero-meta-dot">•</span>
                <span className="hub-hero-meta-item">
                  <Pickaxe size={13} />
                  {currentInstance?.loader_type || "—"}
                </span>
                <span className="hub-hero-meta-dot">•</span>
                <span className="hub-hero-meta-item">
                  <Blocks size={13} />
                  {modCount !== null ? formatModCount(modCount) : "—"}
                </span>
              </div>

              {/* Bottom Launch Button & Tools */}
              <div className="hub-hero-bottom">
                <button
                  className="hub-hero-play-btn"
                  onClick={() => handleLaunch(quickServer || undefined)}
                  disabled={isLaunching || !currentInstance}
                >
                  {isLaunching ? (
                    <Loader2 size={18} className="animate-spin text-white" />
                  ) : (
                    <Play size={18} fill="currentColor" />
                  )}
                  <span>{isLaunching ? "Запуск..." : "Играть"}</span>
                </button>

                {currentInstance && (
                  <>
                    <button
                      className="hub-hero-tool-btn"
                      onClick={() => setManagingInstance(currentInstance.id)}
                      title="Настройки сборки и моды"
                    >
                      <Settings size={18} />
                    </button>
                    <button
                      className="hub-hero-tool-btn"
                      onClick={() => invoke("open_instance_folder", { id: currentInstance.id }).catch(console.error)}
                      title="Папка сборки"
                    >
                      <Folder size={18} />
                    </button>
                    <button
                      className="hub-hero-tool-btn"
                      onClick={() => setShowServerBrowser(true)}
                      title="Мультиплеер & Серверы"
                    >
                      <Globe size={18} />
                    </button>
                  </>
                )}
              </div>

              {/* In-banner launch progress bar */}
              {isLaunching && (
                <div className="mt-2 w-full max-w-md bg-[#130d09]/90 border border-[#3d261a] rounded-lg p-2.5 flex flex-col gap-1.5 shadow-xl backdrop-blur-md">
                  <div className="flex items-center justify-between text-xs font-mono text-[#dcd0c7]">
                    <span className="truncate max-w-[260px] font-medium">{downloadAction || "Подготовка к запуску..."}</span>
                    <span className="text-[#f55e1d] font-bold">
                      {downloadSpeed > 0 ? `${(downloadSpeed / 1024 / 1024).toFixed(1)} МБ/с ` : ""}
                      {downloadTotal > 0 ? `(${Math.min(100, Math.round((downloadedBytes / downloadTotal) * 100))}%)` : ""}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#0e0906] rounded-full overflow-hidden border border-[#2b1b12]">
                    <div 
                      className="h-full bg-gradient-to-r from-[#f55e1d] to-[#ff854d] transition-all duration-200 rounded-full shadow-[0_0_8px_rgba(245,94,29,0.7)]"
                      style={{ width: downloadTotal > 0 ? `${Math.min(100, (downloadedBytes / downloadTotal) * 100)}%` : "100%" }}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* SECTION: "МОИ СБОРКИ" */}
          <section className="flex flex-col">
            <div className="hub-section-header">
              <h2 className="hub-section-title">
                Мои сборки
              </h2>
              <button 
                className="hub-section-link"
                onClick={() => setShowLibrary(true)}
              >
                <span>Все сборки</span>
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="hub-cards-grid">
              {instances.slice(0, 4).map((inst) => {
                const isSelected = inst.id === currentInstance?.id;
                return (
                  <div
                    key={inst.id}
                    className={`hub-instance-card ${isSelected ? "is-active" : ""}`}
                    onClick={() => onSelectInstance(inst.id)}
                    onContextMenu={event => handleOpenContextMenu(event, inst.id)}
                    title={`${inst.name} (${inst.game_version} · ${inst.loader_type})`}
                  >
                    <div className="hub-card-thumb">
                      <InstanceIcon iconPath={inst.icon_path} loaderType={inst.loader_type} />
                    </div>

                    <div className="hub-card-info">
                      <span className="hub-card-title">{inst.name}</span>
                      <span className="hub-card-sub">{inst.game_version} • {inst.loader_type}</span>
                    </div>

                    <button
                      className="hub-card-play-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectInstance(inst.id);
                        handleLaunch(undefined, inst.id);
                      }}
                      title="Быстрый запуск"
                    >
                      <Play size={14} fill="currentColor" />
                    </button>
                  </div>
                );
              })}

              {/* Slot to create instance if less than 4 */}
              {instances.length < 4 && (
                <div 
                  className="hub-card-create"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus size={22} />
                  <span className="text-xs font-semibold">Создать сборку</span>
                </div>
              )}
            </div>
          </section>

          {/* SECTION: "ПОСЛЕДНИЕ ЗАПУСКИ" */}
          <section className="flex flex-col">
            <div className="hub-section-header">
              <h2 className="hub-section-title">Последние запуски</h2>
            </div>

            <div className="hub-history-container">
              {recentInstances.map((inst) => (
                <div
                  key={inst.id}
                  className="hub-history-row"
                  onClick={() => onSelectInstance(inst.id)}
                  onContextMenu={event => handleOpenContextMenu(event, inst.id)}
                >
                  <div className="hub-history-left">
                    <div className="hub-history-icon">
                      <InstanceIcon iconPath={inst.icon_path} loaderType={inst.loader_type} className="w-5 h-5 object-contain" />
                    </div>
                    <div className="hub-history-details">
                      <span className="hub-history-name">{inst.name}</span>
                      <span className="hub-history-sub">{inst.game_version} • {inst.loader_type}</span>
                    </div>
                  </div>

                  <div className="hub-history-right">
                    <span className="hub-history-time">
                      {formatLastPlayed(inst.last_played)}
                    </span>
                    <ChevronRight size={16} className="hub-history-chevron" />
                  </div>
                </div>
              ))}

              {recentInstances.length === 0 && (
                <div className="p-4 text-center text-xs text-[#8c7769]">
                  История запусков пока пуста
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* 3. RIGHT NAVIGATION SIDEBAR */}
      <aside className="hub-sidebar-right">
        {/* Shortcuts Box */}
        <div className="hub-shortcuts-box">
          <button 
            className="hub-shortcut-btn"
            onClick={() => setShowLibrary(true)}
          >
            <div className="hub-shortcut-btn-left">
              <Box size={17} />
              <span>Мои сборки</span>
            </div>
            <div className="hub-shortcut-btn-right">
              <span>{instances.length}</span>
              <ChevronRight size={14} />
            </div>
          </button>

          <button 
            className="hub-shortcut-btn"
            onClick={() => setShowModpackBuilder(true)}
          >
            <div className="hub-shortcut-btn-left">
              <Puzzle size={17} />
              <span>Мои моды</span>
            </div>
            <div className="hub-shortcut-btn-right">
              <span>{modCount ?? "—"}</span>
              <ChevronRight size={14} />
            </div>
          </button>

          <button 
            className="hub-shortcut-btn"
            onClick={() => setShowWardrobe(true)}
          >
            <div className="hub-shortcut-btn-left">
              <User size={17} />
              <span>Профили</span>
            </div>
            <div className="hub-shortcut-btn-right">
              <span>{accountsCount}</span>
              <ChevronRight size={14} />
            </div>
          </button>

          <button 
            className="hub-shortcut-btn"
            onClick={() => onOpenLauncherSettings?.()}
          >
            <div className="hub-shortcut-btn-left">
              <Settings size={17} />
              <span>Настройки</span>
            </div>
            <div className="hub-shortcut-btn-right">
              <ChevronRight size={14} />
            </div>
          </button>
        </div>

        {/* Brand Card */}
        <div className="hub-brand-card">
          <div className="hub-brand-row">
            <img src="/logo.png" alt="RedPanda" />
            <div className="hub-brand-copy">
              <span className="hub-brand-name">RedPanda</span>
              <span className="hub-brand-tagline">Твой мир — твои правила</span>
              <span className="hub-brand-accent-line" />
            </div>
          </div>

          <div className="hub-socials-row">
            <button 
              onClick={() => openUrl("https://discord.gg/dFv6YvYy5p")} 
              className="hub-social-btn" 
              title="Discord"
            >
              <MessageCircle size={14} />
            </button>
            <button 
              onClick={() => openUrl("https://t.me/redpanda_launcher")} 
              className="hub-social-btn" 
              title="Telegram"
            >
              <Send size={13} />
            </button>
            <button 
              onClick={() => openUrl("https://github.com/t1m0nch1k/RedPanda-Launcher")} 
              className="hub-social-btn" 
              title="GitHub"
            >
              <GitBranch size={14} />
            </button>
            <span className="ml-auto text-[10px] font-mono text-[#8c7769]">
              v{packageInfo.version}
            </span>
          </div>
        </div>
      </aside>

      {/* MODALS AND OVERLAYS */}
      {showLibrary && (
        <InstanceLibrary 
          instances={instances} 
          selectedId={currentInstance?.id} 
          onSelect={onSelectInstance} 
          onClose={() => setShowLibrary(false)} 
          onCreate={() => setShowCreateModal(true)} 
          onContextMenu={(event, id) => { 
            setShowLibrary(false); 
            handleOpenContextMenu(event, id); 
          }} 
        />
      )}

      {showWardrobe && activeAccountObj && (
        <Suspense fallback={null}>
          <WardrobeModal 
            key={activeAccountObj.id} 
            account={activeAccountObj} 
            selectedInstance={selectedInstance} 
            onClose={() => setShowWardrobe(false)} 
            onApplied={() => {}} 
          />
        </Suspense>
      )}

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
              onOpenLauncherSettings?.();
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

      {/* Context Menu */}
      {contextMenu && (
        <div 
          ref={contextMenuRef}
          className="fixed z-50 bg-[#17110e]/95 border border-[#3d2b20] rounded-lg py-1.5 min-w-[260px] max-h-[calc(100vh-24px)] overflow-y-auto custom-scrollbar shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <div className="px-3 py-1.5 border-b border-[#2e1f17] mb-1 flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-[#f55e1d]">Действия</span>
          </div>
          <button 
            className="w-full text-left px-3.5 py-1.5 hover:bg-[#261d17] text-xs text-[#f5ece5] flex items-center gap-2.5 transition-colors group"
            onClick={(e) => { e.stopPropagation(); setManagingInstance(contextMenu.instanceId); setContextMenu(null); }}
          >
            <Settings size={14} className="text-[#a69284] group-hover:text-[#f55e1d] transition-colors" /> {t("home.context_menu.settings")}
          </button>
          <button 
            className="w-full text-left px-3.5 py-1.5 hover:bg-[#261d17] text-xs text-[#f5ece5] flex items-center gap-2.5 transition-colors group"
            onClick={(e) => { 
              e.stopPropagation(); 
              onSelectInstance(contextMenu.instanceId);
              handleLaunch(undefined, contextMenu.instanceId);
              setContextMenu(null); 
            }}
          >
            <Play size={14} className="text-[#a69284] group-hover:text-[#f55e1d] transition-colors" /> {t("home.context_menu.play")}
          </button>
          <button 
            className="w-full text-left px-3.5 py-1.5 hover:bg-[#261d17] text-xs text-[#f5ece5] flex items-center gap-2.5 transition-colors group"
            onClick={async (e) => { 
              e.stopPropagation(); 
              try { await invoke("open_instance_folder", { id: contextMenu.instanceId }); } catch(err) { alert(err); }
              setContextMenu(null); 
            }}
          >
            <Folder size={14} className="text-[#a69284] group-hover:text-[#f55e1d] transition-colors" /> {t("home.context_menu.folder")}
          </button>
          <button 
            className="w-full text-left px-3.5 py-1.5 hover:bg-[#261d17] text-xs text-[#f5ece5] flex items-center gap-2.5 transition-colors group"
            onClick={async (e) => { 
              e.stopPropagation(); 
              if (onOpenLogs) {
                onOpenLogs();
              } else {
                try { await invoke("open_instance_logs", { id: contextMenu.instanceId }); } catch(err) { alert(err); }
              }
              setContextMenu(null); 
            }}
          >
            <FileText size={14} className="text-[#a69284] group-hover:text-[#f55e1d] transition-colors" /> {t("home.context_menu.logs")}
          </button>
          
          <div className="my-1 border-t border-[#2e1f17]" />
          
          <button 
            className="w-full text-left px-3.5 py-1.5 hover:bg-[#261d17] text-xs text-[#f5ece5] flex items-center gap-2.5 transition-colors group"
            onClick={(e) => { 
              e.stopPropagation(); 
              const inst = instances.find(i => i.id === contextMenu.instanceId);
              if (inst) {
                setRenameModal({ isOpen: true, id: inst.id, currentName: inst.name });
              }
              setContextMenu(null); 
            }}
          >
            <FileText size={14} className="text-[#a69284] group-hover:text-[#f55e1d] transition-colors" /> {t("home.context_menu.rename")}
          </button>
          
          <button 
            className="w-full text-left px-3.5 py-1.5 hover:bg-[#261d17] text-xs text-[#f5ece5] flex items-center gap-2.5 transition-colors group"
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
            <Copy size={14} className="text-[#a69284] group-hover:text-[#f55e1d] transition-colors" /> {t("home.context_menu.duplicate")}
          </button>
          
          <button 
            className="w-full text-left px-3.5 py-1.5 hover:bg-[#261d17] text-xs text-[#f5ece5] flex items-center gap-2.5 transition-colors group"
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
            <Plus size={14} className="text-[#a69284] group-hover:text-[#f55e1d] transition-colors" /> {t("home.context_menu.icon")}
          </button>
          
          <button 
            className="w-full text-left px-3.5 py-1.5 hover:bg-[#261d17] text-xs text-[#f5ece5] flex items-center gap-2.5 transition-colors group"
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
            <ExternalLink size={14} className="text-[#a69284] group-hover:text-[#f55e1d] transition-colors" /> {t("home.context_menu.desktop_shortcut")}
          </button>
          
          <button 
            className="w-full text-left px-3.5 py-1.5 hover:bg-[#261d17] text-xs text-[#f5ece5] flex items-center gap-2.5 transition-colors group"
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
            {isExporting[contextMenu.instanceId] ? <Loader2 size={14} className="animate-spin text-[#f55e1d]" /> : <Folder size={14} className="text-[#a69284] group-hover:text-[#f55e1d] transition-colors" />} {t("home.context_menu.export")}
          </button>
          
          <div className="my-1 border-t border-[#2e1f17]" />
          
          <button 
            className="w-full text-left px-3.5 py-1.5 hover:bg-red-950/40 text-xs text-red-400 flex items-center gap-2.5 transition-colors group"
            onClick={(e) => { 
              e.stopPropagation(); 
              setDeletingInstance({ isOpen: true, id: contextMenu.instanceId });
              setContextMenu(null); 
            }}
          >
            <Trash2 size={14} className="text-red-500/80 group-hover:text-red-400 transition-colors" /> {t("home.context_menu.delete")}
          </button>
        </div>
      )}

      {/* Delete Modal */}
      {deletingInstance.isOpen && (
        <div className="deck-modal-backdrop" onClick={() => setDeletingInstance({ isOpen: false, id: null })}>
          <div className="deck-modal-window w-[440px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <div className="deck-modal-laser" style={{ background: 'linear-gradient(90deg, transparent 0%, #ef4444 30%, #f87171 50%, #ef4444 70%, transparent 100%)' }} />
            <div className="deck-modal-header">
              <div>
                <span className="deck-modal-eyebrow text-red-400">REDPANDA / DESTRUCTION</span>
                <h3 className="deck-modal-title text-red-400">
                  <Trash2 size={18} className="text-red-500" />
                  Удалить сборку?
                </h3>
              </div>
              <button 
                onClick={() => setDeletingInstance({ isOpen: false, id: null })}
                className="deck-modal-close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <div className="p-3.5 bg-red-950/20 border border-red-500/30 rounded-md mb-6 flex items-start gap-3">
                <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                <p className="text-xs text-red-200/90 leading-relaxed font-sans">
                  Вы уверены, что хотите удалить эту сборку? Это действие нельзя отменить — все установленные моды, конфигурации и миры будут безвозвратно удалены.
                </p>
              </div>
              
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setDeletingInstance({ isOpen: false, id: null })}
                  className="px-4 py-2 rounded text-xs font-mono font-bold text-[#b5a192] hover:text-white bg-[#201813] hover:bg-[#2b1f18] border border-[#382921] transition-all"
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
                  className="px-4 py-2 rounded text-xs font-mono font-bold text-white bg-red-600 hover:bg-red-500 border border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  Удалить навсегда
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal.isOpen && (
        <div className="deck-modal-backdrop" onClick={() => setRenameModal({ isOpen: false, id: null, currentName: "" })}>
          <div className="deck-modal-window w-[440px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <div className="deck-modal-laser" />
            <div className="deck-modal-header">
              <div>
                <span className="deck-modal-eyebrow">REDPANDA / PROFILE</span>
                <h3 className="deck-modal-title">
                  <FileText size={18} className="text-[#f55e1d]" />
                  Переименовать сборку
                </h3>
              </div>
              <button 
                onClick={() => setRenameModal({ isOpen: false, id: null, currentName: "" })}
                className="deck-modal-close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-[#a69284] text-xs font-mono mb-4">
                Введите новое имя для вашей сборки:
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
                className="w-full bg-[#130e0b] border border-[#3d2b20] focus:border-[#f55e1d] rounded px-4 py-2.5 text-white font-mono text-sm outline-none transition-colors mb-6 shadow-inner"
                placeholder="Новое имя сборки"
              />
              
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setRenameModal({ isOpen: false, id: null, currentName: "" })}
                  className="px-4 py-2 rounded text-xs font-mono font-bold text-[#b5a192] hover:text-white bg-[#201813] hover:bg-[#2b1f18] border border-[#382921] transition-all"
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
                  className="deck-play-btn disabled:opacity-40 disabled:cursor-not-allowed text-xs py-2 px-5"
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
