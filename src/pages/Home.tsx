import { Plus, Play, Anvil, Feather, TreePine, Hammer, Settings, Loader2, Folder, FileText, Trash2, Download } from "lucide-react";
import { useState, useEffect, useMemo, memo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import CreateInstanceModal from "../components/CreateInstanceModal";
import InstanceManagerModal from "../components/InstanceManagerModal";
import CrashModal from "../components/CrashModal";
import ModrinthBrowser from "../components/ModrinthBrowser";
import { toast } from "../components/Toast";
import { open, save } from "@tauri-apps/plugin-dialog";

interface Instance {
  id: string;
  name: string;
  game_version: string;
  loader_type: "Vanilla" | "Forge" | "Fabric" | "Quilt" | "NeoForge";
  loader_version: string;
  last_played: number | null;
  icon_path?: string;
}

interface HomeProps {
  selectedInstance: string | null;
  onSelectInstance: (id: string) => void;
  activeUsername: string | null;
}

export default memo(function Home({ selectedInstance, onSelectInstance, activeUsername }: HomeProps) {
  const { t } = useTranslation();
  const [showModpackBrowser, setShowModpackBrowser] = useState(false);

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

  type PandaState = "welcome" | "greeting" | "celebration" | "thinking" | "searching" | "working" | "loading" | "mining" | "reading";
  const [pandaState, setPandaState] = useState<PandaState>("welcome");

  const getPandaImage = () => {
    switch(pandaState) {
      case "welcome": return "/pandas_png/clasped.png";
      case "greeting": return "/pandas_png/waving.png";
      case "celebration": return "/pandas_png/joy.png";
      case "thinking": return "/pandas_png/thinking.png";
      case "working": return "/pandas_png/holographic.png";
      case "searching": return "/pandas_png/standing.png";
      case "reading": return "/pandas_png/reading.png";
      // Fallbacks if images are missing
      case "loading": return "/pandas_png/clasped.png";
      case "mining": return "/pandas_png/mining.png";
      default: return "/pandas_png/clasped.png";
    }
  };

  const getPandaMessage = () => {
    switch(pandaState) {
      case "welcome": return t("home.panda.welcome");
      case "greeting": return t("home.panda.greeting");
      case "celebration": return t("home.panda.celebration");
      case "thinking": return t("home.panda.thinking");
      case "searching": return t("home.panda.searching");
      case "working": return t("home.panda.working");
      case "loading": return t("home.panda.loading");
      case "mining": return t("home.panda.mining");
      case "reading": return t("home.panda.reading");
      default: return t("home.panda.welcome");
    }
  };

  const getIcon = (loader: string) => {
    switch (loader) {
      case "Forge": return <Anvil size={24} className="text-orange-500" />;
      case "Fabric": return <Feather size={24} className="text-yellow-200" />;
      case "Vanilla": return <TreePine size={24} className="text-green-500" />;
      case "NeoForge": return <Hammer size={24} className="text-orange-600" />;
      default: return <TreePine size={24} className="text-white" />;
    }
  };


  const currentInstance = useMemo(() => instances.find(i => i.id === selectedInstance) || instances[0], [instances, selectedInstance]);
  const otherInstances = useMemo(() => instances.filter(i => currentInstance && i.id !== currentInstance.id), [instances, currentInstance]);

  const [isLaunching, setIsLaunching] = useState(false);
  const [downloadTotal, setDownloadTotal] = useState<number>(0);
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [downloadAction, setDownloadAction] = useState<string>("");
  const speedCalcRef = useRef({ lastBytes: 0, lastTime: 0 });
  const gameLogsRef = useRef<{stream: string, line: string}[]>([]);
  const [crashLogs, setCrashLogs] = useState<{stream: string, line: string}[]>([]);
  const [showCrashModal, setShowCrashModal] = useState(false);

  const currentInstanceRef = useRef(currentInstance);
  useEffect(() => {
    currentInstanceRef.current = currentInstance;
  }, [currentInstance]);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, instanceId: string } | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
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
                setCrashLogs([...gameLogsRef.current]);
                setShowCrashModal(true);
            }
            return;
        }
        
        const eventName = data.event;
        
        if (eventName === "InstallStarted" || eventName === "ExtractionStarted") {
           const total = data.total_bytes || data.total_files || 0;
           setDownloadTotal(total);
           setDownloadedBytes(0);
           setDownloadSpeed(0);
           speedCalcRef.current = { lastBytes: 0, lastTime: performance.now() };
           
           if (eventType === "Launch") setDownloadAction(t("home.download_action.game"));
           else if (eventType === "Java") setDownloadAction(t("home.download_action.java"));
           else if (eventType === "Loader" || eventType === "Modloader") setDownloadAction(t("home.download_action.loader"));
           else if (eventType === "Core" && eventName === "ExtractionStarted") setDownloadAction(t("home.download_action.extract"));
        }
        
        if (eventName === "InstallProgress" || eventName === "ExtractionProgress") {
           const currentBytes = data.bytes || data.files_extracted || 0;
           setDownloadedBytes(currentBytes);
           
           const now = performance.now();
           const timeDiff = now - speedCalcRef.current.lastTime;
           if (timeDiff > 500) {
             const bytesDiff = currentBytes - speedCalcRef.current.lastBytes;
             const speed = (bytesDiff / timeDiff) * 1000;
             setDownloadSpeed(speed);
             speedCalcRef.current = { lastBytes: currentBytes, lastTime: now };
           }
        }
        
        if (eventName === "Launching") {
           setDownloadAction(t("home.download_action.launch"));
           setDownloadTotal(0);
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

  // Revert back to welcome after some time if left alone
  useEffect(() => {
    if (isLaunching) return;
    if (pandaState !== "welcome" && pandaState !== "loading") {
      const timeout = setTimeout(() => setPandaState("welcome"), 4000);
      return () => clearTimeout(timeout);
    }
  }, [pandaState, isLaunching]);

  const handleLaunch = async () => {
    setIsLaunching(true);
    setPandaState("working");
    gameLogsRef.current = [];
    
    try {
      const accounts: any[] = await invoke("get_accounts");
      const activeAccount = accounts.find(a => a.is_active);
      
      if (!activeAccount) {
        toast.error("Пожалуйста, выберите или создайте аккаунт в левом нижнем углу перед запуском!");
        setIsLaunching(false);
        setPandaState("welcome");
        return;
      }
      
      await invoke("launch_game", { 
        username: activeAccount.username,
        instanceId: currentInstance.id,
        version: currentInstance.game_version,
        loaderType: currentInstance.loader_type,
        loaderVersion: currentInstance.loader_version
      });
      
      await invoke("update_instance_played", { id: currentInstance.id });
      loadInstances();
      setPandaState("celebration");
    } catch (e) {
      console.error(e);
      toast.error("Ошибка запуска: " + e);
      setPandaState("thinking");
    }
    
    setIsLaunching(false);
    setDownloadAction("");
  };

  return (
    <div className="flex flex-col h-full gap-10 pb-8 max-w-5xl mx-auto w-full">
      
      <div className="flex justify-between items-end">
        <div className="mb-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            {getGreeting()}, {activeUsername || t("home.player")}
          </h1>
        </div>
        {/* Panda Personality */}
        <div className="flex items-center transition-all duration-300">
          {/* Speech Bubble */}
          <div className="relative bg-card border border-border px-4 py-2.5 rounded-xl shadow-sm flex items-center justify-center mr-5 mb-3">
            <span className="text-[13px] text-white/90 font-medium transition-all duration-300 leading-none">{getPandaMessage()}</span>
            {/* Bubble Tail */}
            <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-card border-r border-t border-border rotate-45"></div>
          </div>

          <div className="w-28 h-28 shrink-0 drop-shadow-xl z-10 relative">
            <img src={getPandaImage()} alt="Panda Emotion" className="w-full h-full object-contain transition-opacity duration-300" />
          </div>
        </div>
      </div>

      {/* Steam-like Selected Instance Section */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold tracking-wider text-muted uppercase pl-1">{t("home.selected_instance")}</h2>
        {currentInstance ? (
        <div 
          className="relative group rounded-xl bg-card border border-border transition-colors hover:border-border/80 flex shadow-sm"
          onContextMenu={(e) => { 
            e.preventDefault(); 
            setContextMenu({ x: e.clientX, y: e.clientY, instanceId: currentInstance.id }); 
          }}
        >
          <div className="relative z-10 flex w-full p-6 items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-background rounded-xl flex items-center justify-center border border-border overflow-hidden">
                {currentInstance.icon_path ? (
                  <img src={convertFileSrc(currentInstance.icon_path)} alt="icon" className="w-full h-full object-cover" />
                ) : (
                  getIcon(currentInstance.loader_type)
                )}
              </div>
              <div>
                <h3 className="text-[22px] font-bold tracking-tight leading-none mb-2 text-white">{currentInstance.name}</h3>
                <div className="flex items-center gap-2.5">
                  <span className="text-[13px] font-medium text-white/80">
                    {currentInstance.game_version} {currentInstance.loader_type} {currentInstance.loader_version}
                  </span>
                  <span className="text-[13px] text-muted/80">•</span>
                  <span className="text-[13px] text-muted">
                    {currentInstance.last_played ? new Date(currentInstance.last_played * 1000).toLocaleDateString() : t("home.never_played")}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               {isLaunching && downloadAction ? (
                 <div className="flex flex-col items-end gap-1.5 mr-2">
                   <div className="flex justify-between w-48 text-[11px] font-medium text-white/80">
                     <span>{downloadAction}</span>
                     <span>
                       {downloadTotal > 0 ? `${Math.round((downloadedBytes / downloadTotal) * 100)}%` : ""}
                     </span>
                   </div>
                   <div className="w-48 h-1.5 bg-background rounded-full overflow-hidden border border-border">
                     <div 
                       className="h-full bg-primary transition-all duration-300 ease-out"
                       style={{ width: downloadTotal > 0 ? `${(downloadedBytes / downloadTotal) * 100}%` : "100%" }}
                     />
                   </div>
                   {downloadSpeed > 0 && downloadTotal > 10000 && (
                     <span className="text-[10px] text-muted">
                       {(downloadSpeed / 1024 / 1024).toFixed(1)} MB/s
                     </span>
                   )}
                 </div>
                ) : (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => invoke("open_instance_folder", { id: currentInstance.id }).catch(console.error)}
                      className="bg-card hover:bg-background border border-border text-muted hover:text-white px-3 py-3 rounded-xl shadow-sm transition-colors"
                      title="Открыть папку сборки"
                    >
                      <Folder size={18} />
                    </button>
                    <button 
                      onClick={() => {
                          setCrashLogs(gameLogsRef.current);
                          setShowCrashModal(true);
                      }}
                      className="bg-card hover:bg-background border border-border text-muted hover:text-white px-3 py-3 rounded-xl shadow-sm transition-colors"
                      title="Просмотр логов"
                    >
                      <FileText size={18} />
                    </button>
                    <button 
                      onClick={() => setManagingInstance(currentInstance.id)}
                      className="bg-card hover:bg-background border border-border text-muted hover:text-white px-3 py-3 rounded-xl shadow-sm transition-colors"
                      title="Управление сборкой (Моды, Ресурспаки)"
                    >
                      <Settings size={18} />
                    </button>
                  </div>
                )}
               <button 
                 onClick={handleLaunch}
                 disabled={isLaunching}
                 onMouseEnter={() => !isLaunching && setPandaState("celebration")}
                 onMouseLeave={() => !isLaunching && setPandaState("welcome")}
                 className="bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-7 py-3 rounded-xl font-medium text-[13px] flex items-center gap-2 shadow-sm transition-colors"
               >
                 {isLaunching ? (
                   <><Loader2 className="animate-spin" size={16} /> <span className="translate-y-[0.5px]">{t("home.launching")}</span></>
                 ) : (
                   <><Play fill="currentColor" size={15} /> <span className="translate-y-[0.5px]">{t("home.play")}</span></>
                 )}
               </button>
            </div>
          </div>
        </div>
        ) : (
          <div className="p-8 text-center text-muted border border-dashed border-border rounded-xl">
            {t("home.no_instance")}
          </div>
        )}
      </div>

      {/* Other Instances Grid */}
      <div className="flex flex-col gap-3 mt-2 pb-8">
        <h2 className="text-[11px] font-semibold tracking-wider text-muted uppercase pl-1">{t("home.other_instances")}</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Add New Instance Button */}
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-transparent hover:bg-card border border-dashed border-border hover:border-muted text-muted rounded-xl flex flex-col items-center justify-center gap-3 min-h-[140px] transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center group-hover:text-white transition-colors">
              <Plus size={18} />
            </div>
            <span className="text-[13px] font-medium group-hover:text-white transition-colors">{t("home.add_instance")}</span>
          </button>
          
          <button 
            onClick={() => setShowModpackBrowser(true)}
            className="bg-transparent hover:bg-card border border-dashed border-border hover:border-muted text-muted rounded-xl flex flex-col items-center justify-center gap-3 min-h-[140px] transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center group-hover:text-white transition-colors">
              <Download size={18} />
            </div>
            <span className="text-[13px] font-medium group-hover:text-white transition-colors">{t("home.install_modpack")}</span>
          </button>

          {/* Other Instance Cards */}
          {otherInstances.map((inst) => {
            const isSelected = selectedInstance === inst.id;
            
            return (
              <button
                key={inst.id}
                onClick={() => onSelectInstance(inst.id)}
                onContextMenu={(e) => { 
                  e.preventDefault(); 
                  setContextMenu({ x: e.clientX, y: e.clientY, instanceId: inst.id }); 
                }}
                className={`flex flex-col bg-card rounded-xl p-5 text-left transition-colors border group ${
                  isSelected 
                    ? "border-primary/50 ring-1 ring-primary/20" 
                    : "border-border hover:border-muted/50"
                }`}
              >
                <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center border border-border mb-4 overflow-hidden">
                  {inst.icon_path ? (
                    <img src={convertFileSrc(inst.icon_path)} alt="icon" className="w-full h-full object-cover" />
                  ) : (
                    getIcon(inst.loader_type)
                  )}
                </div>
                
                <div className="mt-auto">
                  <h3 className="font-semibold text-[14px] line-clamp-1 leading-snug mb-1 text-white">{inst.name}</h3>
                  <div className="text-[12px] text-muted">
                    {inst.game_version} {inst.loader_type !== "Vanilla" && inst.loader_type}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      
      {showCreateModal && (
        <CreateInstanceModal 
          onClose={() => setShowCreateModal(false)} 
          onCreated={() => {
            setShowCreateModal(false);
            loadInstances();
          }} 
        />
      )}

      {showModpackBrowser && (
        <ModrinthBrowser 
          onClose={() => {
            setShowModpackBrowser(false);
            loadInstances();
          }}
          projectType="modpack"
        />
      )}

      {managingInstance && currentInstance && (
        <InstanceManagerModal 
          instance={currentInstance}
          onClose={() => {
            setManagingInstance(null);
            loadInstances();
          }}
          onDelete={() => {
            setManagingInstance(null);
            loadInstances();
          }}
        />
      )}
      
      {showCrashModal && (
        <CrashModal 
          logs={crashLogs}
          onClose={() => setShowCrashModal(false)}
        />
      )}

      {contextMenu && (
        <div 
          className="fixed z-50 bg-card border border-border rounded-xl shadow-2xl py-1 min-w-[220px] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
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
                setTimeout(() => handleLaunch(), 100);
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setDeletingInstance({ isOpen: false, id: null })}>
          <div className="bg-card border border-border rounded-xl shadow-2xl w-[400px] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 text-red-400 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
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
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-card-hover transition-colors"
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
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500 hover:bg-red-600 text-white transition-colors shadow-lg shadow-red-500/20"
                >
                  Удалить навсегда
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {renameModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setRenameModal({ isOpen: false, id: null, currentName: "" })}>
          <div className="bg-card border border-border rounded-xl shadow-2xl w-[400px] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 text-white mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
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
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white outline-none focus:border-primary/50 transition-colors mb-6"
                placeholder="Новое имя сборки"
              />
              
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setRenameModal({ isOpen: false, id: null, currentName: "" })}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-card-hover transition-colors"
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
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-primary hover:bg-primary-hover text-primary-foreground disabled:opacity-50 transition-colors shadow-lg shadow-primary/20"
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
