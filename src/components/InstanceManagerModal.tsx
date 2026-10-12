import { useState, useEffect, useMemo } from "react";
import { 
  X, Puzzle, Palette, Settings as SettingsIcon, Trash2, Plus, Loader2, 
  RefreshCw, ArrowUpCircle, Globe, Gamepad2, Check, Power, Stethoscope, 
  CheckCircle2, AlertTriangle, XCircle, Search, FolderOpen, HardDrive, 
  Cpu, Sliders, ExternalLink
} from "lucide-react";
import ModrinthBrowser from "./ModrinthBrowser";
import CurseForgeBrowser from "./CurseForgeBrowser";
import { InstallTask, command, getErrorMessage } from "../lib/ipc";
import { toast } from "./Toast";
import { useTranslation } from "react-i18next";

const invoke = command;

interface Instance {
  id: string;
  name: string;
  game_version: string;
  loader_type: string;
  loader_version: string;
  min_memory?: number | null;
  max_memory?: number | null;
  java_path?: string | null;
  jvm_args?: string | null;
  window_width?: number | null;
  window_height?: number | null;
}

interface Mod {
  filename: string;
  size: number;
  enabled: boolean;
}

interface DiagnosticItem {
  key: string;
  label: string;
  status: "ok" | "warning" | "error";
  details: string;
  fix?: string | null;
}

interface DiagnosticReport {
  instance_id: string;
  instance_name: string;
  items: DiagnosticItem[];
}

interface ModUpdate {
  file_name: string;
  new_version_id: string;
  new_file_name: string;
  new_file_url: string;
  new_sha1?: string;
}

interface ModrinthVersionSummary {
  id: string;
  name: string;
  version_number: string;
}

interface CurseForgeVersionSummary {
  id: number;
  gameVersions?: string[];
}

interface InstanceManagerModalProps {
  instance: Instance;
  initialTab?: "mods" | "resources" | "diagnostics" | "settings" | "multiplayer";
  onClose: () => void;
  onDelete: () => void;
}

export default function InstanceManagerModal({ instance, initialTab = "mods", onClose, onDelete }: InstanceManagerModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"mods" | "resources" | "diagnostics" | "settings" | "multiplayer">(initialTab);
  const [showModrinth, setShowModrinth] = useState(false);
  const [showCurseForge, setShowCurseForge] = useState(false);
  const [modrinthProjectType, setModrinthProjectType] = useState<"mod" | "resourcepack" | "shader">("mod");
  
  // Multiplayer state
  const [isE4mcInstalled, setIsE4mcInstalled] = useState(false);
  const [isE4steamInstalled, setIsE4steamInstalled] = useState(false);
  const [installingE4mc, setInstallingE4mc] = useState(false);
  const [installingE4steam, setInstallingE4steam] = useState(false);
  const [uninstallingMod, setUninstallingMod] = useState<string | null>(null);

  // Mods state
  const [installedMods, setInstalledMods] = useState<Mod[]>([]);
  const [loadingMods, setLoadingMods] = useState(true);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [modUpdates, setModUpdates] = useState<Record<string, ModUpdate>>({});
  const [updatingMods, setUpdatingMods] = useState<Record<string, boolean>>({});
  const [searchModQuery, setSearchModQuery] = useState("");
  const [modFilter, setModFilter] = useState<"all" | "enabled" | "disabled" | "updates">("all");
  
  // Resources state
  const [installedResourcePacks, setInstalledResourcePacks] = useState<Mod[]>([]);
  const [installedShaders, setInstalledShaders] = useState<Mod[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  
  // Settings & Instance state
  const [instanceName, setInstanceName] = useState(instance.name);
  const [minMemory, setMinMemory] = useState<number | null>(instance.min_memory ?? null);
  const [maxMemory, setMaxMemory] = useState<number | null>(instance.max_memory ?? null);
  const [javaPath, setJavaPath] = useState<string>(instance.java_path ?? "");
  const [jvmArgs, setJvmArgs] = useState<string>(instance.jvm_args ?? "");
  const [windowWidth, setWindowWidth] = useState<number | null>(instance.window_width ?? null);
  const [windowHeight, setWindowHeight] = useState<number | null>(instance.window_height ?? null);
  
  // Deletion & Diagnostics
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);

  // Load mods
  const loadMods = async () => {
    setLoadingMods(true);
    try {
      const mods: Mod[] = await invoke("get_installed_mods", { instanceId: instance.id });
      setInstalledMods(mods);
      setIsE4mcInstalled(mods.some(m => m.filename.toLowerCase().includes("e4mc") && !m.filename.toLowerCase().includes("e4steam")));
      setIsE4steamInstalled(mods.some(m => m.filename.toLowerCase().includes("e4steam")));
    } catch (e) {
      console.error(e);
      setInstalledMods([]);
    } finally {
      setLoadingMods(false);
    }
  };

  // Load resourcepacks & shaders
  const loadResources = async () => {
    setLoadingResources(true);
    try {
      const packs: Mod[] = await invoke("get_installed_resourcepacks", { instanceId: instance.id });
      setInstalledResourcePacks(packs);
      const shaders: Mod[] = await invoke("get_installed_shaders", { instanceId: instance.id });
      setInstalledShaders(shaders);
    } catch (e) {
      console.error(e);
      setInstalledResourcePacks([]);
      setInstalledShaders([]);
    } finally {
      setLoadingResources(false);
    }
  };

  // Check for updates
  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const updates: ModUpdate[] = await invoke("check_mod_updates", { instanceId: instance.id });
      const updatesMap: Record<string, ModUpdate> = {};
      for (const u of updates) {
        updatesMap[u.file_name] = u;
      }
      setModUpdates(updatesMap);
      if (updates.length > 0) {
        toast.success(`Найдено обновлений: ${updates.length}`);
      } else {
        toast.success("Все моды обновлены до актуальных версий!");
      }
    } catch (e) {
      console.error(e);
      toast.error(t("common.error") + ": " + e);
    } finally {
      setCheckingUpdates(false);
    }
  };

  // Apply single update
  const handleApplyUpdate = async (modFileName: string) => {
    const update = modUpdates[modFileName];
    if (!update) return;

    setUpdatingMods(prev => ({ ...prev, [modFileName]: true }));
    try {
      await invoke("update_mod", {
        instanceId: instance.id,
        oldFileName: update.file_name,
        newFileName: update.new_file_name,
        downloadUrl: update.new_file_url,
        expectedSha1: update.new_sha1
      });
      
      setModUpdates(prev => {
        const next = { ...prev };
        delete next[modFileName];
        return next;
      });
      await loadMods();
      toast.success(`Мод ${update.new_file_name} успешно обновлен!`);
    } catch (e) {
      console.error(e);
      toast.error(t("common.error") + ": " + e);
    } finally {
      setUpdatingMods(prev => ({ ...prev, [modFileName]: false }));
    }
  };

  // Run diagnostics
  const runDiagnostics = async () => {
    setLoadingDiagnostics(true);
    try {
      const report: DiagnosticReport = await invoke("diagnose_instance", { instanceId: instance.id });
      setDiagnosticReport(report);
    } catch (e) {
      console.error(e);
      toast.error(t("common.error") + ": " + e);
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  useEffect(() => {
    if (activeTab === "mods" && !showModrinth && !showCurseForge) {
      loadMods();
    } else if (activeTab === "resources" && !showModrinth && !showCurseForge) {
      loadResources();
    } else if (activeTab === "diagnostics" && !showModrinth && !showCurseForge) {
      runDiagnostics();
    } else if (activeTab === "multiplayer") {
      loadMods();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, showModrinth, showCurseForge]);

  const handleDeleteMod = async (filename: string) => {
    try {
      await invoke("delete_mod", { instanceId: instance.id, filename });
      loadMods();
      toast.success(`Файл ${filename} удален`);
    } catch (e) {
      console.error(e);
      toast.error(t("common.error") + ": " + e);
    }
  };

  const handleToggleMod = async (mod: Mod) => {
    try {
      await invoke("toggle_mod", { instanceId: instance.id, filename: mod.filename, enabled: !mod.enabled });
      await loadMods();
      toast.success(mod.enabled ? t("instance_manager.mod_disabled") : t("instance_manager.mod_enabled"));
    } catch (e) {
      console.error(e);
      toast.error(t("common.error") + ": " + e);
    }
  };

  const handleDeleteResourcePack = async (filename: string) => {
    try {
      await invoke("delete_resourcepack", { instanceId: instance.id, filename });
      loadResources();
      toast.success(`Ресурспак ${filename} удален`);
    } catch (e) {
      console.error(e);
      toast.error(t("common.error") + ": " + e);
    }
  };

  const handleDeleteShader = async (filename: string) => {
    try {
      await invoke("delete_shader", { instanceId: instance.id, filename });
      loadResources();
      toast.success(`Шейдер ${filename} удален`);
    } catch (e) {
      console.error(e);
      toast.error(t("common.error") + ": " + e);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await invoke("open_instance_folder", { id: instance.id });
    } catch (e) {
      console.error(e);
      toast.error("Не удалось открыть папку: " + e);
    }
  };

  // Multiplayer handlers
  const handleInstallE4mc = async () => {
    setInstallingE4mc(true);
    try {
      const versions: ModrinthVersionSummary[] = await invoke("get_modrinth_versions", {
        projectSlug: "e4mc",
        gameVersion: instance.game_version,
        loader: instance.loader_type,
        projectType: "mod"
      });
      
      if (versions.length === 0) {
        toast.error("e4mc не поддерживает эту версию игры или загрузчик.");
        return;
      }
      
      const tasks: InstallTask[] = await invoke("resolve_dependencies", {
        instanceId: instance.id,
        source: "modrinth",
        id: versions[0].id,
        gameVersion: instance.game_version,
        loader: instance.loader_type,
      });

      for (const task of tasks) {
        if (task.source === "modrinth") {
          await invoke("download_modrinth_version", {
            instanceId: instance.id,
            versionId: task.id,
            projectType: "mod"
          });
        } else if (task.source === "curseforge") {
          await invoke("download_curseforge_version", {
            instanceId: instance.id,
            downloadUrl: task.url,
            fileName: task.filename,
            projectType: "mod",
            expectedSha1: task.sha1
          });
        }
      }
      
      toast.success("Мод e4mc успешно установлен!");
      await loadMods();
    } catch (e: unknown) {
      console.error(e);
      toast.error(t("common.error") + ": " + getErrorMessage(e));
    } finally {
      setInstallingE4mc(false);
    }
  };

  const handleInstallE4steam = async () => {
    setInstallingE4steam(true);
    try {
      let versions: CurseForgeVersionSummary[] = await invoke("get_curseforge_versions", {
        modId: 1633302,
        gameVersion: instance.game_version,
      });

      const loaderLower = instance.loader_type.toLowerCase();
      let targetVersion = versions.find((v) => {
        const gvList = (v.gameVersions || []).map((gv: string) => gv.toLowerCase());
        return gvList.includes(loaderLower);
      });

      if (!targetVersion) {
        versions = await invoke("get_curseforge_versions", {
          modId: 1633302,
          gameVersion: null,
        });
        targetVersion = versions.find((v) => {
          const gvList = (v.gameVersions || []).map((gv: string) => gv.toLowerCase());
          return gvList.includes(loaderLower) && gvList.includes(instance.game_version.toLowerCase());
        });
      }

      if (!targetVersion) {
        toast.error(`e4steam не найден для версии ${instance.game_version} (${instance.loader_type}).`);
        return;
      }

      const tasks: InstallTask[] = await invoke("resolve_dependencies", {
        instanceId: instance.id,
        source: "curseforge",
        id: targetVersion.id.toString(),
        gameVersion: instance.game_version,
        loader: instance.loader_type,
      });

      for (const task of tasks) {
        if (task.source === "modrinth") {
          await invoke("download_modrinth_version", {
            instanceId: instance.id,
            versionId: task.id,
            projectType: "mod"
          });
        } else if (task.source === "curseforge") {
          await invoke("download_curseforge_version", {
            instanceId: instance.id,
            downloadUrl: task.url,
            fileName: task.filename,
            projectType: "mod",
            expectedSha1: task.sha1
          });
        }
      }

      toast.success("Мод e4steam успешно установлен!");
      await loadMods();
    } catch (e: unknown) {
      console.error(e);
      toast.error(t("common.error") + ": " + getErrorMessage(e));
    } finally {
      setInstallingE4steam(false);
    }
  };

  const handleUninstallMultiplayerMod = async (modType: "e4mc" | "e4steam") => {
    setUninstallingMod(modType);
    try {
      const targetMod = installedMods.find(m => 
        modType === "e4steam"
          ? m.filename.toLowerCase().includes("e4steam")
          : (m.filename.toLowerCase().includes("e4mc") && !m.filename.toLowerCase().includes("e4steam"))
      );
      if (targetMod) {
        await invoke("delete_mod", { instanceId: instance.id, filename: targetMod.filename });
        toast.success(`Мод ${modType} успешно удален!`);
        await loadMods();
      } else {
        toast.error(`Файл мода ${modType} не найден.`);
      }
    } catch (e: unknown) {
      console.error(e);
      toast.error(t("common.error") + ": " + getErrorMessage(e));
    } finally {
      setUninstallingMod(null);
    }
  };

  // Save Settings Helper
  const persistSettings = async (overrides: {
    minMemory?: number | null;
    maxMemory?: number | null;
    javaPath?: string | null;
    jvmArgs?: string | null;
    windowWidth?: number | null;
    windowHeight?: number | null;
  }) => {
    const finalMin = overrides.minMemory !== undefined ? overrides.minMemory : minMemory;
    const finalMax = overrides.maxMemory !== undefined ? overrides.maxMemory : maxMemory;
    const finalJava = overrides.javaPath !== undefined ? overrides.javaPath : (javaPath.trim() || null);
    const finalJvm = overrides.jvmArgs !== undefined ? overrides.jvmArgs : (jvmArgs.trim() || null);
    const finalW = overrides.windowWidth !== undefined ? overrides.windowWidth : windowWidth;
    const finalH = overrides.windowHeight !== undefined ? overrides.windowHeight : windowHeight;

    try {
      await invoke("save_instance_settings", {
        id: instance.id,
        minMemory: finalMin,
        maxMemory: finalMax,
        javaPath: finalJava,
        jvmArgs: finalJvm,
        windowWidth: finalW,
        windowHeight: finalH,
      });
      instance.min_memory = finalMin;
      instance.max_memory = finalMax;
      instance.java_path = finalJava;
      instance.jvm_args = finalJvm;
      instance.window_width = finalW;
      instance.window_height = finalH;
    } catch (err) {
      console.error(err);
      toast.error("Не удалось сохранить настройки: " + err);
    }
  };

  // Filtered mods computation
  const filteredMods = useMemo(() => {
    return installedMods.filter(mod => {
      const matchesSearch = mod.filename.toLowerCase().includes(searchModQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (modFilter === "enabled") return mod.enabled;
      if (modFilter === "disabled") return !mod.enabled;
      if (modFilter === "updates") return Boolean(modUpdates[mod.filename]);
      return true;
    });
  }, [installedMods, searchModQuery, modFilter, modUpdates]);

  const enabledModsCount = useMemo(() => installedMods.filter(m => m.enabled).length, [installedMods]);
  const disabledModsCount = useMemo(() => installedMods.filter(m => !m.enabled).length, [installedMods]);
  const updatesCount = useMemo(() => Object.keys(modUpdates).length, [modUpdates]);

  if (showCurseForge) {
    return (
      <CurseForgeBrowser 
        instance={instance} 
        onClose={() => setShowCurseForge(false)} 
        projectType={modrinthProjectType}
      />
    );
  }

  if (showModrinth) {
    return (
      <ModrinthBrowser 
        instance={instance} 
        onClose={() => setShowModrinth(false)} 
        projectType={modrinthProjectType}
      />
    );
  }

  return (
    <div className="deck-modal-backdrop animate-in fade-in duration-200">
      <div 
        className="deck-modal-window deck-modal-window-row w-full max-w-5xl h-[86vh] flex flex-row overflow-hidden relative shadow-2xl"
        style={{ flexDirection: "row" }}
        data-layout="row"
      >
        <div className="deck-modal-laser" />
        
        {/* === LEFT SIDEBAR === */}
        <div className="w-64 bg-[#140f0c] border-r border-[#302219] flex flex-col shrink-0 h-full select-none">
          {/* Header */}
          <div className="p-4 border-b border-[#302219] bg-[#1a130f] flex flex-col justify-center min-h-[72px]">
            <span className="deck-modal-eyebrow text-[10px] tracking-wider text-[#ff7537] font-mono">
              INSTANCE HUB
            </span>
            <h2 className="text-sm font-bold text-white leading-tight font-sans truncate mb-1" title={instance.name}>
              {instance.name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-[#a69284] font-mono">
              <span>{instance.game_version}</span>
              <span>•</span>
              <span className="px-1.5 py-0.2 rounded bg-[#ff7537]/15 text-[#ff7537] font-semibold border border-[#ff7537]/25 text-[11px]">
                {instance.loader_type}
              </span>
            </div>
          </div>
          
          {/* Navigation Links */}
          <nav className="flex-1 p-3 flex flex-col gap-1.5 overflow-y-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab("mods")}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-mono font-bold transition-all text-left ${
                activeTab === "mods"
                  ? "bg-gradient-to-r from-[#2c1b12] to-[#1e140e] border border-[#f55e1d]/60 text-white shadow-[0_0_12px_rgba(245,94,29,0.2)]"
                  : "text-[#a69284] hover:text-white hover:bg-[#1f1712] border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Puzzle size={16} className={activeTab === "mods" ? "text-[#f55e1d]" : "text-[#78675c]"} />
                <span>{t("instance_manager.mods")}</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/40 text-stone-300 border border-stone-800">
                {installedMods.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("resources")}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-mono font-bold transition-all text-left ${
                activeTab === "resources"
                  ? "bg-gradient-to-r from-[#2c1b12] to-[#1e140e] border border-[#f55e1d]/60 text-white shadow-[0_0_12px_rgba(245,94,29,0.2)]"
                  : "text-[#a69284] hover:text-white hover:bg-[#1f1712] border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Palette size={16} className={activeTab === "resources" ? "text-[#f55e1d]" : "text-[#78675c]"} />
                <span>{t("instance_manager.resources")}</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/40 text-stone-300 border border-stone-800">
                {installedResourcePacks.length + installedShaders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-mono font-bold transition-all text-left ${
                activeTab === "settings"
                  ? "bg-gradient-to-r from-[#2c1b12] to-[#1e140e] border border-[#f55e1d]/60 text-white shadow-[0_0_12px_rgba(245,94,29,0.2)]"
                  : "text-[#a69284] hover:text-white hover:bg-[#1f1712] border border-transparent"
              }`}
            >
              <SettingsIcon size={16} className={activeTab === "settings" ? "text-[#f55e1d]" : "text-[#78675c]"} />
              <span>{t("instance_manager.settings")}</span>
            </button>

            <button
              onClick={() => setActiveTab("diagnostics")}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-mono font-bold transition-all text-left ${
                activeTab === "diagnostics"
                  ? "bg-gradient-to-r from-[#2c1b12] to-[#1e140e] border border-[#f55e1d]/60 text-white shadow-[0_0_12px_rgba(245,94,29,0.2)]"
                  : "text-[#a69284] hover:text-white hover:bg-[#1f1712] border border-transparent"
              }`}
            >
              <Stethoscope size={16} className={activeTab === "diagnostics" ? "text-[#f55e1d]" : "text-[#78675c]"} />
              <span>{t("instance_manager.diagnostics")}</span>
            </button>

            <button
              onClick={() => setActiveTab("multiplayer")}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-mono font-bold transition-all text-left ${
                activeTab === "multiplayer"
                  ? "bg-gradient-to-r from-[#2c1b12] to-[#1e140e] border border-[#f55e1d]/60 text-white shadow-[0_0_12px_rgba(245,94,29,0.2)]"
                  : "text-[#a69284] hover:text-white hover:bg-[#1f1712] border border-transparent"
              }`}
            >
              <Globe size={16} className={activeTab === "multiplayer" ? "text-[#f55e1d]" : "text-[#78675c]"} />
              <span>Игра по сети</span>
            </button>
          </nav>

          {/* Sidebar Footer Quick Actions */}
          <div className="p-3 border-t border-[#302219] bg-[#17110d] flex flex-col gap-2">
            <button
              onClick={handleOpenFolder}
              className="flex items-center gap-2 px-3 py-2 rounded text-xs text-[#b8a698] hover:text-white bg-[#221813] hover:bg-[#2b1f18] border border-[#38261c] transition-colors"
              title="Открыть папку сборки в проводнике"
            >
              <FolderOpen size={14} className="text-[#ff7537]" />
              <span className="truncate">Папка сборки</span>
              <ExternalLink size={12} className="ml-auto opacity-50" />
            </button>
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="flex items-center gap-2 px-3 py-2 rounded text-xs text-red-400/80 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
            >
              <Trash2 size={14} />
              <span>Удалить сборку</span>
            </button>
          </div>
        </div>

        {/* === RIGHT CONTENT AREA === */}
        <div className="flex-1 flex flex-col relative bg-[#17120e] min-w-0 h-full overflow-hidden">
          {/* Top Bar */}
          <div className="px-6 py-4 border-b border-[#302219] flex justify-between items-center bg-[#1c1511] min-h-[72px] shrink-0">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[#f55e1d] shadow-[0_0_8px_#f55e1d]" />
              <div>
                <h3 className="font-bold text-white font-sans text-sm tracking-wide">
                  {activeTab === "mods" && t("instance_manager.manage_mods")}
                  {activeTab === "resources" && t("instance_manager.resources_and_shaders")}
                  {activeTab === "settings" && t("instance_manager.instance_settings")}
                  {activeTab === "diagnostics" && t("instance_manager.diagnostics")}
                  {activeTab === "multiplayer" && "Игра по сети (e4mc / e4steam)"}
                </h3>
                <p className="text-[11px] text-[#8e7a6d] font-mono mt-0.5">
                  {activeTab === "mods" && `Установлено модов: ${installedMods.length} • активных: ${enabledModsCount}`}
                  {activeTab === "resources" && `Ресурспаков: ${installedResourcePacks.length} • Шейдеров: ${installedShaders.length}`}
                  {activeTab === "settings" && "Конфигурация памяти, Java и графики"}
                  {activeTab === "diagnostics" && "Проверка файлов на конфликты и ошибки"}
                  {activeTab === "multiplayer" && "Сетевая игра с друзьями без белого IP"}
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

          {/* Dynamic Tab Body */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#15100d]">
            {/* === TAB 1: MODS === */}
            {activeTab === "mods" && (
              <div className="flex flex-col h-full gap-4">
                {/* Search & Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1c1511] p-3 rounded-lg border border-[#33241b]">
                  {/* Left: Search input */}
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search size={14} className="absolute left-3 top-2.5 text-[#8e7a6d]" />
                    <input
                      type="text"
                      value={searchModQuery}
                      onChange={(e) => setSearchModQuery(e.target.value)}
                      placeholder={`Поиск среди ${installedMods.length} модов...`}
                      className="w-full bg-[#120d0a] border border-[#38261c] focus:border-[#f55e1d] rounded-md pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#786558] outline-none transition-colors"
                    />
                    {searchModQuery && (
                      <button 
                        onClick={() => setSearchModQuery("")}
                        className="absolute right-2.5 top-2 text-[#786558] hover:text-white"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 bg-[#120d0a] p-1 rounded-md border border-[#2e2018]">
                    <button
                      onClick={() => setModFilter("all")}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                        modFilter === "all" ? "bg-[#2e1d15] text-[#ff7537] font-bold border border-[#f55e1d]/40" : "text-[#8e7a6d] hover:text-white"
                      }`}
                    >
                      Все ({installedMods.length})
                    </button>
                    <button
                      onClick={() => setModFilter("enabled")}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                        modFilter === "enabled" ? "bg-[#2e1d15] text-emerald-400 font-bold border border-emerald-500/40" : "text-[#8e7a6d] hover:text-white"
                      }`}
                    >
                      Вкл ({enabledModsCount})
                    </button>
                    {disabledModsCount > 0 && (
                      <button
                        onClick={() => setModFilter("disabled")}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                          modFilter === "disabled" ? "bg-[#2e1d15] text-amber-400 font-bold border border-amber-500/40" : "text-[#8e7a6d] hover:text-white"
                        }`}
                      >
                        Выкл ({disabledModsCount})
                      </button>
                    )}
                    {updatesCount > 0 && (
                      <button
                        onClick={() => setModFilter("updates")}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                          modFilter === "updates" ? "bg-[#2e1d15] text-emerald-400 font-bold border border-emerald-500/40" : "text-[#8e7a6d] hover:text-white"
                        }`}
                      >
                        Обновления ({updatesCount})
                      </button>
                    )}
                  </div>

                  {/* Right: Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCheckUpdates}
                      disabled={checkingUpdates}
                      className="px-3 py-1.5 rounded-md bg-[#221813] hover:bg-[#2b1f18] text-[#c7b5a8] hover:text-white border border-[#38271e] text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      title="Проверить наличие обновлений на Modrinth"
                    >
                      {checkingUpdates ? <Loader2 className="animate-spin text-[#ff7537]" size={13} /> : <RefreshCw size={13} />}
                      <span>{checkingUpdates ? "Поиск..." : "Обновления"}</span>
                    </button>

                    <button
                      onClick={() => { setModrinthProjectType("mod"); setShowModrinth(true); }}
                      className="px-3 py-1.5 rounded-md bg-[#1bd96a]/15 text-[#1bd96a] hover:bg-[#1bd96a]/25 border border-[#1bd96a]/30 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-[0_0_10px_rgba(27,217,106,0.1)]"
                    >
                      <Plus size={14} />
                      <span>Modrinth</span>
                    </button>

                    <button
                      onClick={() => { setModrinthProjectType("mod"); setShowCurseForge(true); }}
                      className="px-3 py-1.5 rounded-md bg-[#f55e1d]/15 text-[#ff7537] hover:bg-[#f55e1d]/25 border border-[#f55e1d]/30 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-[0_0_10px_rgba(245,94,29,0.1)]"
                    >
                      <Plus size={14} />
                      <span>CurseForge</span>
                    </button>
                  </div>
                </div>

                {/* Mod Cards List */}
                <div className="bg-[#18120e] border border-[#2e2018] rounded-lg flex-1 overflow-y-auto custom-scrollbar p-3">
                  {loadingMods ? (
                    <div className="flex items-center justify-center h-48 text-[#8e7a6d] flex-col gap-3">
                      <Loader2 className="animate-spin text-[#ff7537]" size={26} />
                      <span className="text-xs font-mono">{t("instance_manager.loading_list")}</span>
                    </div>
                  ) : filteredMods.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-[#8e7a6d] text-xs flex-col gap-2 p-8 text-center font-mono">
                      <Puzzle size={36} className="opacity-20 mb-1 text-[#ff7537]" />
                      <span>
                        {searchModQuery ? `По запросу «${searchModQuery}» ничего не найдено` : "Моды не найдены. Добавьте моды кнопками выше!"}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredMods.map((mod) => {
                        const hasUpdate = Boolean(modUpdates[mod.filename]);
                        const isUpdating = Boolean(updatingMods[mod.filename]);

                        return (
                          <div
                            key={mod.filename}
                            className={`px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between group ${
                              mod.enabled
                                ? "bg-[#1d1612] border-[#302219] hover:border-[#4d3324] hover:bg-[#221a15]"
                                : "bg-[#140e0b]/70 border-[#221711] opacity-60 hover:opacity-90"
                            }`}
                          >
                            {/* Left: Info */}
                            <div className="flex items-center gap-3 min-w-0 pr-3">
                              <div className="w-8 h-8 rounded-md bg-[#251b15] border border-[#3a291f] flex items-center justify-center shrink-0 text-[#ff7537] relative">
                                <Puzzle size={15} />
                                {hasUpdate && (
                                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#1d1612]" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-semibold font-mono truncate ${mod.enabled ? "text-stone-100" : "text-stone-400 line-through"}`}>
                                    {mod.filename}
                                  </span>
                                  {!mod.enabled && (
                                    <span className="text-[9px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                                      ОТКЛЮЧЕН
                                    </span>
                                  )}
                                  {hasUpdate && (
                                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                                      ОБНОВЛЕНИЕ
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[#8e7a6d] font-mono mt-0.5">
                                  {(mod.size / 1024 / 1024).toFixed(2)} МБ
                                </div>
                              </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasUpdate && (
                                <button
                                  onClick={() => handleApplyUpdate(mod.filename)}
                                  disabled={isUpdating}
                                  className="px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                                  title="Установить обновление"
                                >
                                  {isUpdating ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpCircle size={13} />}
                                  <span>{isUpdating ? "Обновление..." : "Обновить"}</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleToggleMod(mod)}
                                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all border ${
                                  mod.enabled
                                    ? "bg-amber-500/10 text-amber-300 border-amber-500/25 hover:bg-amber-500/20"
                                    : "bg-emerald-500/10 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20"
                                }`}
                                title={mod.enabled ? "Отключить мод" : "Включить мод"}
                              >
                                <Power size={12} />
                                <span className="font-mono text-[11px]">{mod.enabled ? "Выкл" : "Вкл"}</span>
                              </button>

                              <button
                                onClick={() => handleDeleteMod(mod.filename)}
                                className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded transition-all opacity-0 group-hover:opacity-100"
                                title="Удалить файл"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* === TAB 2: RESOURCES & SHADERS === */}
            {activeTab === "resources" && (
              <div className="flex flex-col gap-6">
                {/* Resourcepacks section */}
                <div className="bg-[#18120e] border border-[#2e2018] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Palette size={16} className="text-[#ff7537]" />
                      <h4 className="text-sm font-bold text-white">Ресурспаки ({installedResourcePacks.length})</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => { setModrinthProjectType("resourcepack"); setShowModrinth(true); }}
                        className="px-2.5 py-1 rounded bg-[#1bd96a]/15 text-[#1bd96a] hover:bg-[#1bd96a]/25 border border-[#1bd96a]/30 text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Plus size={13} /> Modrinth
                      </button>
                      <button 
                        onClick={() => { setModrinthProjectType("resourcepack"); setShowCurseForge(true); }}
                        className="px-2.5 py-1 rounded bg-[#f55e1d]/15 text-[#ff7537] hover:bg-[#f55e1d]/25 border border-[#f55e1d]/30 text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Plus size={13} /> CurseForge
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#130d0a] border border-[#271b14] rounded-md overflow-hidden min-h-[90px]">
                    {loadingResources ? (
                      <div className="flex justify-center items-center h-24">
                        <Loader2 className="animate-spin text-[#ff7537]" size={20} />
                      </div>
                    ) : installedResourcePacks.length === 0 ? (
                      <div className="flex justify-center items-center h-24 text-[#8e7a6d] text-xs flex-col gap-1.5 font-mono">
                        <Palette size={20} className="opacity-30 text-[#ff7537]" />
                        <span>Ресурспаки не установлены</span>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#271b14]">
                        {installedResourcePacks.map((pack, i) => (
                          <div key={i} className="p-3 flex items-center justify-between group hover:bg-[#1c140f] transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-[#221813] border border-[#38261c] rounded flex items-center justify-center text-[#ff7537]">
                                <Palette size={15} />
                              </div>
                              <div>
                                <div className="text-xs font-medium text-white font-mono">{pack.filename}</div>
                                <div className="text-[10px] text-[#8e7a6d] font-mono">{(pack.size / 1024 / 1024).toFixed(2)} МБ</div>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleDeleteResourcePack(pack.filename)}
                              className="text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 p-1.5 rounded transition-all"
                              title="Удалить"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Shaders section */}
                <div className="bg-[#18120e] border border-[#2e2018] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Palette size={16} className="text-[#ff7537]" />
                      <h4 className="text-sm font-bold text-white">Шейдерпаки ({installedShaders.length})</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => { setModrinthProjectType("shader"); setShowModrinth(true); }}
                        className="px-2.5 py-1 rounded bg-[#1bd96a]/15 text-[#1bd96a] hover:bg-[#1bd96a]/25 border border-[#1bd96a]/30 text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Plus size={13} /> Modrinth
                      </button>
                      <button 
                        onClick={() => { setModrinthProjectType("shader"); setShowCurseForge(true); }}
                        className="px-2.5 py-1 rounded bg-[#f55e1d]/15 text-[#ff7537] hover:bg-[#f55e1d]/25 border border-[#f55e1d]/30 text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Plus size={13} /> CurseForge
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#130d0a] border border-[#271b14] rounded-md overflow-hidden min-h-[90px]">
                    {loadingResources ? (
                      <div className="flex justify-center items-center h-24">
                        <Loader2 className="animate-spin text-[#ff7537]" size={20} />
                      </div>
                    ) : installedShaders.length === 0 ? (
                      <div className="flex justify-center items-center h-24 text-[#8e7a6d] text-xs flex-col gap-1.5 font-mono">
                        <Palette size={20} className="opacity-30 text-[#ff7537]" />
                        <span>Шейдерпаки не установлены</span>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#271b14]">
                        {installedShaders.map((shader, i) => (
                          <div key={i} className="p-3 flex items-center justify-between group hover:bg-[#1c140f] transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-[#221813] border border-[#38261c] rounded flex items-center justify-center text-[#ff7537]">
                                <Palette size={15} />
                              </div>
                              <div>
                                <div className="text-xs font-medium text-white font-mono">{shader.filename}</div>
                                <div className="text-[10px] text-[#8e7a6d] font-mono">{(shader.size / 1024 / 1024).toFixed(2)} МБ</div>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleDeleteShader(shader.filename)}
                              className="text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 p-1.5 rounded transition-all"
                              title="Удалить"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* === TAB 3: SETTINGS === */}
            {activeTab === "settings" && (
              <div className="flex flex-col gap-5">
                {/* General Settings */}
                <div className="bg-[#18120e] border border-[#2e2018] rounded-lg p-5">
                  <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Sliders size={16} className="text-[#ff7537]" />
                    <span>Основные параметры</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#8e7a6d] mb-1.5 font-mono">Название сборки</label>
                      <input 
                        type="text" 
                        className="w-full bg-[#120d0a] border border-[#38261c] focus:border-[#f55e1d] rounded-md px-3.5 py-2 text-xs text-white outline-none transition-colors" 
                        value={instanceName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInstanceName(val);
                          invoke("edit_instance", {
                            id: instance.id,
                            name: val,
                            gameVersion: instance.game_version,
                            loaderType: instance.loader_type,
                            loaderVersion: instance.loader_version
                          }).then(() => {
                            instance.name = val;
                          }).catch(console.error);
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Memory Settings */}
                <div className="bg-[#18120e] border border-[#2e2018] rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Cpu size={16} className="text-[#ff7537]" />
                      <span>Выделение оперативной памяти (RAM)</span>
                    </h4>
                    <span className="text-[11px] text-[#ff7537] font-mono font-bold">
                      {maxMemory ? `${(maxMemory / 1024).toFixed(1)} ГБ` : "По умолчанию"}
                    </span>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="text-xs text-[#8e7a6d] mr-1">Быстрый выбор:</span>
                    {[2048, 4096, 6144, 8192, 10240, 12288].map((ram) => (
                      <button
                        key={ram}
                        onClick={() => {
                          setMaxMemory(ram);
                          persistSettings({ maxMemory: ram });
                          toast.success(`Установлено ${ram / 1024} ГБ RAM`);
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all border ${
                          maxMemory === ram
                            ? "bg-[#f55e1d]/20 text-[#ff7537] border-[#f55e1d]/60 shadow-[0_0_8px_rgba(245,94,29,0.25)]"
                            : "bg-[#120d0a] text-[#a69284] border-[#38261c] hover:border-[#f55e1d]/40 hover:text-white"
                        }`}
                      >
                        {ram / 1024} ГБ
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#8e7a6d] mb-1 font-mono">Минимум памяти (МБ)</label>
                      <input 
                        type="number" 
                        placeholder="Например, 2048"
                        className="w-full bg-[#120d0a] border border-[#38261c] focus:border-[#f55e1d] rounded-md px-3.5 py-2 text-xs text-white outline-none transition-colors" 
                        value={minMemory || ""}
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : null;
                          setMinMemory(val);
                          persistSettings({ minMemory: val });
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#8e7a6d] mb-1 font-mono">Максимум памяти (МБ)</label>
                      <input 
                        type="number" 
                        placeholder="Например, 8192"
                        className="w-full bg-[#120d0a] border border-[#38261c] focus:border-[#f55e1d] rounded-md px-3.5 py-2 text-xs text-white outline-none transition-colors" 
                        value={maxMemory || ""}
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : null;
                          setMaxMemory(val);
                          persistSettings({ maxMemory: val });
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Java & Advanced Settings */}
                <div className="bg-[#18120e] border border-[#2e2018] rounded-lg p-5">
                  <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <HardDrive size={16} className="text-[#ff7537]" />
                    <span>Параметры Java & Разрешение окна</span>
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-[#8e7a6d] mb-1 font-mono">Путь к Java runtime (опционально)</label>
                      <input 
                        type="text" 
                        placeholder="Автоматическое определение лаунчером"
                        className="w-full bg-[#120d0a] border border-[#38261c] focus:border-[#f55e1d] rounded-md px-3.5 py-2 text-xs text-white outline-none transition-colors" 
                        value={javaPath}
                        onChange={(e) => {
                          setJavaPath(e.target.value);
                          persistSettings({ javaPath: e.target.value });
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-[#8e7a6d] mb-1 font-mono">JVM Аргументы запуска</label>
                      <input 
                        type="text" 
                        placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled ..."
                        className="w-full bg-[#120d0a] border border-[#38261c] focus:border-[#f55e1d] rounded-md px-3.5 py-2 text-xs text-white outline-none transition-colors font-mono" 
                        value={jvmArgs}
                        onChange={(e) => {
                          setJvmArgs(e.target.value);
                          persistSettings({ jvmArgs: e.target.value });
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-[#8e7a6d] mb-1 font-mono">Разрешение игрового окна (Ширина × Высота)</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="number" 
                          placeholder="854"
                          className="w-32 bg-[#120d0a] border border-[#38261c] focus:border-[#f55e1d] rounded-md px-3 py-2 text-xs text-white outline-none font-mono" 
                          value={windowWidth || ""}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value) : null;
                            setWindowWidth(val);
                            persistSettings({ windowWidth: val });
                          }}
                        />
                        <span className="text-[#8e7a6d] font-mono">×</span>
                        <input 
                          type="number" 
                          placeholder="480"
                          className="w-32 bg-[#120d0a] border border-[#38261c] focus:border-[#f55e1d] rounded-md px-3 py-2 text-xs text-white outline-none font-mono" 
                          value={windowHeight || ""}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value) : null;
                            setWindowHeight(val);
                            persistSettings({ windowHeight: val });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* === TAB 4: DIAGNOSTICS === */}
            {activeTab === "diagnostics" && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between gap-4 bg-[#18120e] p-4 rounded-lg border border-[#2e2018]">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Stethoscope size={16} className="text-[#ff7537]" />
                      <span>Диагностика инстанса и окружения</span>
                    </h4>
                    <p className="text-xs text-[#8e7a6d] mt-0.5">
                      Автоматическая проверка целостности файлов, совместимости Java и доступных ресурсов
                    </p>
                  </div>
                  <button
                    onClick={runDiagnostics}
                    disabled={loadingDiagnostics}
                    className="px-3.5 py-2 rounded-md bg-[#221813] hover:bg-[#2b1f18] text-[#c7b5a8] hover:text-white border border-[#38271e] text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {loadingDiagnostics ? <Loader2 size={14} className="animate-spin text-[#ff7537]" /> : <RefreshCw size={14} />}
                    <span>{loadingDiagnostics ? "Проверка..." : "Запустить анализ"}</span>
                  </button>
                </div>

                {loadingDiagnostics && !diagnosticReport ? (
                  <div className="flex flex-col items-center justify-center py-16 text-[#8e7a6d] gap-3">
                    <Loader2 className="animate-spin text-[#ff7537]" size={28} />
                    <span className="text-xs font-mono">{t("instance_manager.diagnostics_loading")}</span>
                  </div>
                ) : diagnosticReport ? (
                  <div className="space-y-3">
                    {diagnosticReport.items.map((item) => {
                      const StatusIcon = item.status === "ok" ? CheckCircle2 : item.status === "warning" ? AlertTriangle : XCircle;
                      const statusClass = item.status === "ok" 
                        ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/5" 
                        : item.status === "warning" 
                          ? "text-amber-400 border-amber-500/25 bg-amber-500/5" 
                          : "text-red-400 border-red-500/25 bg-red-500/5";

                      return (
                        <div key={item.key} className={`border p-4 rounded-lg flex items-start gap-3.5 ${statusClass}`}>
                          <StatusIcon size={19} className="shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold font-mono tracking-wide">{item.label}</div>
                            <div className="text-xs text-[#a69284] mt-1 break-words leading-relaxed font-sans">{item.details}</div>
                            {item.fix && (
                              <div className="text-xs text-amber-300/90 mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 font-mono">
                                💡 Совет: {item.fix}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-[#8e7a6d] text-xs font-mono">
                    Нажмите «Запустить анализ» для проверки сборки
                  </div>
                )}
              </div>
            )}

            {/* === TAB 5: MULTIPLAYER === */}
            {activeTab === "multiplayer" && (
              <div className="flex flex-col gap-6">
                {/* Intro Card */}
                <div className="bg-[#18120e] border border-[#2e2018] rounded-lg p-5">
                  <h4 className="text-base font-bold text-white mb-1.5 flex items-center gap-2">
                    <Globe className="text-[#ff7537]" size={18} />
                    <span>Играйте с друзьями без белого IP и покупки хостинга</span>
                  </h4>
                  <p className="text-xs text-[#a69284] leading-relaxed">
                    Выберите удобный способ создания сетевой игры прямо из одиночного мира. 
                    Оба решения работают в 1 клик без сложной настройки роутера и проброса портов.
                  </p>
                </div>

                {/* Mod Cards Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Card 1: e4mc */}
                  <div className={`bg-[#18120e] border rounded-lg p-5 flex flex-col justify-between transition-all ${
                    isE4mcInstalled ? "border-emerald-500/40 bg-emerald-500/5" : "border-[#2e2018]"
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 bg-[#1bd96a]/10 border border-[#1bd96a]/20 rounded-md flex items-center justify-center text-[#1bd96a]">
                            <Globe size={18} />
                          </div>
                          <div>
                            <h5 className="font-bold text-white text-sm">e4mc</h5>
                            <span className="text-[11px] text-[#8e7a6d] font-mono">Публичный веб-прокси</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-[#1bd96a]/15 text-[#1bd96a] border border-[#1bd96a]/30 rounded">
                          Modrinth
                        </span>
                      </div>

                      <p className="text-xs text-[#a69284] mb-4 leading-relaxed">
                        Генерирует временную веб-ссылку (<code className="text-[#ff7537] font-mono">*.e4mc.link</code>). 
                        Друзьям не нужны сторонние программы — они просто подключаются по ссылке как к обычному серверу.
                      </p>

                      <ul className="text-xs text-[#a69284] space-y-1.5 mb-5 font-mono">
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-[#1bd96a] rounded-full"></span>
                          <span>Работает со всеми лаунчерами</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-[#1bd96a] rounded-full"></span>
                          <span>Подключение в 1 клик через ссылку</span>
                        </li>
                      </ul>
                    </div>

                    <div className="pt-3 border-t border-[#302219] flex items-center justify-between gap-3">
                      {isE4mcInstalled ? (
                        <>
                          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                            <div className="w-4 h-4 bg-emerald-500/20 rounded-full flex items-center justify-center">
                              <Check size={11} />
                            </div>
                            <span>Установлен</span>
                          </div>
                          <button
                            onClick={() => handleUninstallMultiplayerMod("e4mc")}
                            disabled={uninstallingMod === "e4mc"}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                          >
                            {uninstallingMod === "e4mc" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            <span>{uninstallingMod === "e4mc" ? "Удаление..." : "Удалить"}</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={handleInstallE4mc}
                          disabled={installingE4mc || installingE4steam}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-[#1bd96a]/15 text-[#1bd96a] hover:bg-[#1bd96a]/25 border border-[#1bd96a]/30 text-xs font-bold transition-all shadow-[0_0_10px_rgba(27,217,106,0.15)]"
                        >
                          {installingE4mc ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                          <span>{installingE4mc ? "Установка..." : "Установить e4mc"}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card 2: e4steam */}
                  <div className={`bg-[#18120e] border rounded-lg p-5 flex flex-col justify-between transition-all ${
                    isE4steamInstalled ? "border-[#66c0f4]/40 bg-[#66c0f4]/5" : "border-[#2e2018]"
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 bg-[#66c0f4]/10 border border-[#66c0f4]/20 rounded-md flex items-center justify-center text-[#66c0f4]">
                            <Gamepad2 size={18} />
                          </div>
                          <div>
                            <h5 className="font-bold text-white text-sm">e4steam</h5>
                            <span className="text-[11px] text-[#8e7a6d] font-mono">Steam P2P Relay</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-[#66c0f4]/15 text-[#66c0f4] border border-[#66c0f4]/30 rounded">
                          CurseForge
                        </span>
                      </div>

                      <p className="text-xs text-[#a69284] mb-4 leading-relaxed">
                        Форк e4mc на основе защищенной сети Valve Steam. Позволяет подключаться через Steam Overlay (Shift+Tab) и приглашать друзей из списка контактов Steam.
                      </p>

                      <ul className="text-xs text-[#a69284] space-y-1.5 mb-5 font-mono">
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-[#66c0f4] rounded-full"></span>
                          <span>Приглашения через Shift+Tab в Steam</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-[#66c0f4] rounded-full"></span>
                          <span>Прямое P2P-соединение с минимальным пингом</span>
                        </li>
                      </ul>
                    </div>

                    <div className="pt-3 border-t border-[#302219] flex items-center justify-between gap-3">
                      {isE4steamInstalled ? (
                        <>
                          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                            <div className="w-4 h-4 bg-emerald-500/20 rounded-full flex items-center justify-center">
                              <Check size={11} />
                            </div>
                            <span>Установлен</span>
                          </div>
                          <button
                            onClick={() => handleUninstallMultiplayerMod("e4steam")}
                            disabled={uninstallingMod === "e4steam"}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                          >
                            {uninstallingMod === "e4steam" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            <span>{uninstallingMod === "e4steam" ? "Удаление..." : "Удалить"}</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={handleInstallE4steam}
                          disabled={installingE4mc || installingE4steam}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-[#66c0f4]/15 text-[#66c0f4] hover:bg-[#66c0f4]/25 border border-[#66c0f4]/30 text-xs font-bold transition-all shadow-[0_0_10px_rgba(102,192,244,0.15)]"
                        >
                          {installingE4steam ? <Loader2 size={14} className="animate-spin" /> : <Gamepad2 size={14} />}
                          <span>{installingE4steam ? "Установка..." : "Установить e4steam"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-[#18120e] border border-[#2e2018] rounded-lg p-5">
                  <h5 className="font-bold text-white text-xs mb-3 font-mono uppercase tracking-wider text-[#ff7537]">
                    Инструкция по подключению:
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#a69284]">
                    <div className="bg-[#120d0a] p-3.5 rounded border border-[#271b14] space-y-2">
                      <div className="font-bold text-[#1bd96a] flex items-center gap-1.5 text-xs font-mono">
                        <Globe size={14} /> Для e4mc:
                      </div>
                      <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                        <li>Установите мод <strong>e4mc</strong> кнопкой выше.</li>
                        <li>Зайдите в свой одиночный мир.</li>
                        <li>Нажмите <strong>Esc</strong> &rarr; <strong>«Открыть для сети»</strong>.</li>
                        <li>Скопируйте ссылку <code className="text-[#ff7537] bg-black/40 px-1 rounded">*.e4mc.link</code> из чата.</li>
                        <li>Друзья вводят ссылку в «Сетевая игра» &rarr; «Прямое подключение».</li>
                      </ol>
                    </div>

                    <div className="bg-[#120d0a] p-3.5 rounded border border-[#271b14] space-y-2">
                      <div className="font-bold text-[#66c0f4] flex items-center gap-1.5 text-xs font-mono">
                        <Gamepad2 size={14} /> Для e4steam:
                      </div>
                      <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                        <li>Убедитесь, что клиент <strong>Steam</strong> запущен на вашем ПК.</li>
                        <li>Установите мод <strong>e4steam</strong> кнопкой выше.</li>
                        <li>Откройте одиночный мир для сети.</li>
                        <li>Нажмите <strong>Shift + Tab</strong> в оверлее Steam.</li>
                        <li>Правый клик по другу в списке Steam &rarr; <strong>«Пригласить в игру»</strong>!</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Deletion */}
      {showConfirmDelete && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200" 
          onClick={() => setShowConfirmDelete(false)}
        >
          <div 
            className="bg-[#1a130f] border border-red-500/40 rounded-xl w-[420px] overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.2)]" 
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 text-red-400 mb-4">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <Trash2 size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-mono tracking-widest text-red-400/80 uppercase">ВНИМАНИЕ</span>
                  <h3 className="font-bold text-base text-white">Удаление сборки</h3>
                </div>
              </div>
              <p className="text-[#a69284] text-xs leading-relaxed mb-6 font-sans">
                Вы уверены, что хотите полностью удалить профиль <span className="text-white font-bold">{instance.name}</span>? 
                Все моды, миры и локальные конфигурации будут безвозвратно стёрты.
              </p>
              
              <div className="flex justify-end gap-2.5">
                <button 
                  onClick={() => setShowConfirmDelete(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-[#a69284] hover:text-white bg-[#221813] hover:bg-[#2b1f18] border border-[#38271e] transition-colors"
                >
                  Отмена
                </button>
                <button 
                  onClick={async () => {
                    try {
                      await invoke("remove_instance", { id: instance.id });
                      toast.success(`Сборка ${instance.name} удалена`);
                      onDelete();
                    } catch (e) {
                      toast.error("Ошибка при удалении: " + e);
                    }
                    setShowConfirmDelete(false);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-colors shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                >
                  Удалить навсегда
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
