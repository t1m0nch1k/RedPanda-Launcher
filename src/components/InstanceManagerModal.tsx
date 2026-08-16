import { useState, useEffect } from "react";
import { X, Puzzle, Palette, Settings as SettingsIcon, Trash2, Plus, Loader2, RefreshCw, ArrowUpCircle, Globe, Gamepad2, Check } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import ModrinthBrowser from "./ModrinthBrowser";
import CurseForgeBrowser from "./CurseForgeBrowser";

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
}

interface ModUpdate {
    file_name: string;
    new_version_id: string;
    new_file_name: string;
    new_file_url: string;
}

interface InstanceManagerModalProps {
  instance: Instance;
  onClose: () => void;
  onDelete: () => void;
}

import { toast } from "./Toast";
import { useTranslation } from "react-i18next";

export default function InstanceManagerModal({ instance, onClose, onDelete }: InstanceManagerModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"mods" | "resources" | "settings" | "multiplayer">("mods");
  const [showModrinth, setShowModrinth] = useState(false);
  const [showCurseForge, setShowCurseForge] = useState(false);
  const [modrinthProjectType, setModrinthProjectType] = useState<"mod" | "resourcepack" | "shader">("mod");
  const [isE4mcInstalled, setIsE4mcInstalled] = useState(false);
  const [isE4steamInstalled, setIsE4steamInstalled] = useState(false);
  const [installingE4mc, setInstallingE4mc] = useState(false);
  const [installingE4steam, setInstallingE4steam] = useState(false);
  const [uninstallingMod, setUninstallingMod] = useState<string | null>(null);
  const [installedMods, setInstalledMods] = useState<Mod[]>([]);
  const [loadingMods, setLoadingMods] = useState(true);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [modUpdates, setModUpdates] = useState<Record<string, ModUpdate>>({});
  const [updatingMods, setUpdatingMods] = useState<Record<string, boolean>>({});
  
  const [installedResourcePacks, setInstalledResourcePacks] = useState<Mod[]>([]);
  const [installedShaders, setInstalledShaders] = useState<Mod[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleCheckUpdates = async () => {
      setCheckingUpdates(true);
      try {
          const updates: ModUpdate[] = await invoke("check_mod_updates", { instanceId: instance.id });
          const updatesMap: Record<string, ModUpdate> = {};
          for (const u of updates) {
              updatesMap[u.file_name] = u;
          }
          setModUpdates(updatesMap);
      } catch (e) {
          console.error(e);
          toast.error(t("common.error") + ": " + e);
      } finally {
          setCheckingUpdates(false);
      }
  };

  const handleApplyUpdate = async (modFileName: string) => {
      const update = modUpdates[modFileName];
      if (!update) return;

      setUpdatingMods(prev => ({ ...prev, [modFileName]: true }));
      try {
          await invoke("update_mod", {
              instanceId: instance.id,
              oldFileName: update.file_name,
              newFileName: update.new_file_name,
              downloadUrl: update.new_file_url
          });
          
          setModUpdates(prev => {
              const next = { ...prev };
              delete next[modFileName];
              return next;
          });
          await loadMods();
      } catch (e) {
          console.error(e);
          toast.error(t("common.error") + ": " + e);
      } finally {
          setUpdatingMods(prev => ({ ...prev, [modFileName]: false }));
      }
  };

  const loadMods = async () => {
    setLoadingMods(true);
    try {
        const mods: Mod[] = await invoke("get_installed_mods", { instanceId: instance.id });
        setInstalledMods(mods);
        setIsE4mcInstalled(mods.some(m => m.filename.toLowerCase().includes("e4mc") && !m.filename.toLowerCase().includes("e4steam")));
        setIsE4steamInstalled(mods.some(m => m.filename.toLowerCase().includes("e4steam")));
    } catch(e) {
        console.error(e);
        setInstalledMods([]);
    } finally {
        setLoadingMods(false);
    }
  };

  const loadResources = async () => {
    setLoadingResources(true);
    try {
        const packs: Mod[] = await invoke("get_installed_resourcepacks", { instanceId: instance.id });
        setInstalledResourcePacks(packs);
        const shaders: Mod[] = await invoke("get_installed_shaders", { instanceId: instance.id });
        setInstalledShaders(shaders);
    } catch(e) {
        console.error(e);
        setInstalledResourcePacks([]);
        setInstalledShaders([]);
    } finally {
        setLoadingResources(false);
    }
  };

  useEffect(() => {
    if (activeTab === "mods" && !showModrinth && !showCurseForge) {
      loadMods();
    } else if (activeTab === "resources" && !showModrinth && !showCurseForge) {
        loadResources();
    } else if (activeTab === "multiplayer") {
        loadMods();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, showModrinth, showCurseForge]);

  const handleDeleteMod = async (filename: string) => {
    try {
        await invoke("delete_mod", { instanceId: instance.id, filename });
        loadMods();
    } catch(e) {
        console.error(e);
        toast.error(t("common.error") + ": " + e);
    }
  }

  const handleDeleteResourcePack = async (filename: string) => {
    try {
        await invoke("delete_resourcepack", { instanceId: instance.id, filename });
        loadResources();
    } catch(e) {
        console.error(e);
        toast.error(t("common.error") + ": " + e);
    }
  }

  const handleDeleteShader = async (filename: string) => {
    try {
        await invoke("delete_shader", { instanceId: instance.id, filename });
        loadResources();
    } catch(e) {
        console.error(e);
        toast.error(t("common.error") + ": " + e);
    }
  }

  const handleInstallE4mc = async () => {
    setInstallingE4mc(true);
    try {
        const versions: any[] = await invoke("get_modrinth_versions", {
            projectSlug: "e4mc",
            gameVersion: instance.game_version,
            loader: instance.loader_type,
            projectType: "mod"
        });
        
        if (versions.length === 0) {
            toast.error(t("common.error") + ": e4mc не поддерживает эту версию игры или загрузчик.");
            return;
        }
        
        const tasks: any[] = await invoke("resolve_dependencies", {
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
                    projectType: "mod"
                });
            }
        }
        
        toast.success("Мод e4mc успешно установлен!");
        await loadMods();
    } catch (e: any) {
        console.error(e);
        toast.error(t("common.error") + ": " + e);
    } finally {
        setInstallingE4mc(false);
    }
  };

  const handleInstallE4steam = async () => {
    setInstallingE4steam(true);
    try {
        // e4steam mod_id on CurseForge is 1633302
        let versions: any[] = await invoke("get_curseforge_versions", {
            modId: 1633302,
            gameVersion: instance.game_version,
        });

        const loaderLower = instance.loader_type.toLowerCase();
        let targetVersion = versions.find((v: any) => {
            const gvList = (v.gameVersions || []).map((gv: string) => gv.toLowerCase());
            return gvList.includes(loaderLower);
        });

        // Fallback: search all versions if not matched with gameVersion param directly
        if (!targetVersion) {
            versions = await invoke("get_curseforge_versions", {
                modId: 1633302,
                gameVersion: null,
            });
            targetVersion = versions.find((v: any) => {
                const gvList = (v.gameVersions || []).map((gv: string) => gv.toLowerCase());
                return gvList.includes(loaderLower) && gvList.includes(instance.game_version.toLowerCase());
            });
        }

        if (!targetVersion) {
            toast.error(t("common.error") + `: e4steam не найден для версии ${instance.game_version} (${instance.loader_type}).`);
            return;
        }

        const tasks: any[] = await invoke("resolve_dependencies", {
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
                    projectType: "mod"
                });
            }
        }

        toast.success("Мод e4steam успешно установлен!");
        await loadMods();
    } catch (e: any) {
        console.error(e);
        toast.error(t("common.error") + ": " + e);
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
    } catch (e: any) {
        console.error(e);
        toast.error(t("common.error") + ": " + e);
    } finally {
        setUninstallingMod(null);
    }
  };

  const handleDeleteInstance = async () => {
    setShowConfirmDelete(true);
  };

  if (showCurseForge) {
    return <CurseForgeBrowser 
        instance={instance} 
        onClose={() => setShowCurseForge(false)} 
        projectType={modrinthProjectType} // Reusing modrinthProjectType state as it maps to the same values
    />;
  }

  if (showModrinth) {
    return <ModrinthBrowser 
        instance={instance} 
        onClose={() => setShowModrinth(false)} 
        projectType={modrinthProjectType}
    />;
  }

  return (
    <div className="fixed inset-0 bg-black/80  flex items-center justify-center z-50 p-6">
      <div className="bg-card brutalist-border rounded-none w-full max-w-4xl h-[80vh]  flex overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Sidebar */}
        <div className="w-64 bg-background/50 border-r border-border flex flex-col">
          <div className="p-6">
            <h2 className="text-lg font-bold text-white leading-tight mb-1">{instance.name}</h2>
            <p className="text-xs text-muted">
              {instance.game_version} • {instance.loader_type}
            </p>
          </div>
          
          <nav className="flex-1 px-3 flex flex-col gap-1">
            <button
              onClick={() => setActiveTab("mods")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-none text-sm font-medium transition-colors ${
                activeTab === "mods" ? "bg-primary/10 text-primary" : "text-muted hover:text-white hover:bg-card"
              }`}
            >
              <Puzzle size={16} /> {t("instance_manager.mods")}
            </button>
            <button
              onClick={() => setActiveTab("resources")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-none text-sm font-medium transition-colors ${
                activeTab === "resources" ? "bg-primary/10 text-primary" : "text-muted hover:text-white hover:bg-card"
              }`}
            >
              <Palette size={16} /> {t("instance_manager.resources")}
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-none text-sm font-medium transition-colors ${
                activeTab === "settings" ? "bg-primary/10 text-primary" : "text-muted hover:text-white hover:bg-card"
              }`}
            >
              <SettingsIcon size={16} /> {t("instance_manager.settings")}
            </button>
            <button
              onClick={() => setActiveTab("multiplayer")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-none text-sm font-medium transition-colors ${
                activeTab === "multiplayer" ? "bg-primary/10 text-primary" : "text-muted hover:text-white hover:bg-card"
              }`}
            >
              <Globe size={16} /> Игра по сети
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col relative bg-card">
          <div className="p-4 border-b border-border flex justify-between items-center bg-background/50">
            <h3 className="font-semibold text-white">
              {activeTab === "mods" && t("instance_manager.manage_mods")}
              {activeTab === "resources" && t("instance_manager.resources_and_shaders")}
              {activeTab === "settings" && t("instance_manager.instance_settings")}
              {activeTab === "multiplayer" && "Игра по сети (e4mc / e4steam)"}
            </h3>
            <button onClick={onClose} className="p-2 text-muted hover:text-white hover:bg-background rounded-none transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "mods" && (
              <div className="flex flex-col h-full gap-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium text-muted">{t("instance_manager.installed_mods", { count: installedMods.length })}</h4>
                  <div className="flex items-center gap-2">
                      <button 
                        onClick={handleCheckUpdates}
                        disabled={checkingUpdates}
                        className="bg-card hover:bg-background brutalist-border text-white px-4 py-2 rounded-none text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {checkingUpdates ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                        {t("instance_manager.check_updates")}
                      </button>
                      <button 
                        onClick={() => { setModrinthProjectType("mod"); setShowModrinth(true); }}
                        className="brutalist-button-primary   text-xs font-semibold flex items-center gap-2 "
                      >
                        <Plus size={14} /> {t("instance_manager.add_from_modrinth")}
                      </button>
                      <button 
                        onClick={() => { setModrinthProjectType("mod"); setShowCurseForge(true); }}
                        className="brutalist-button-primary !bg-[#F55E1D] hover:!bg-[#D94F16] text-xs font-semibold flex items-center gap-2"
                      >
                        <Plus size={14} /> Добавить из CurseForge
                      </button>
                  </div>
                </div>
                
                <div className="bg-background brutalist-border rounded-none flex-1 overflow-y-auto">
                    {loadingMods ? (
                        <div className="flex items-center justify-center h-full text-muted flex-col gap-3">
                            <Loader2 className="animate-spin" size={24} />
                            <span className="text-sm">{t("instance_manager.loading_list")}</span>
                        </div>
                    ) : installedMods.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted text-sm flex-col gap-2 p-8 text-center">
                            <Puzzle size={32} className="opacity-20 mb-2" />
                            <span dangerouslySetInnerHTML={{ __html: t("instance_manager.no_mods_desc") }} />
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {installedMods.map((mod, i) => (
                                <div key={i} className="p-4 flex items-center justify-between group hover:bg-card transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-card brutalist-border rounded-none flex items-center justify-center relative">
                                            <Puzzle size={18} className="text-muted" />
                                            {modUpdates[mod.filename] && (
                                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-none border-2 border-background"></div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-white flex items-center gap-2">
                                                {mod.filename}
                                                {modUpdates[mod.filename] && (
                                                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-none uppercase font-bold">
                                                        Update
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted">{(mod.size / 1024 / 1024).toFixed(2)} МБ</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {modUpdates[mod.filename] && (
                                            <button 
                                                onClick={() => handleApplyUpdate(mod.filename)}
                                                disabled={updatingMods[mod.filename]}
                                                className="text-green-400 hover:bg-green-500/10 p-2 rounded-none transition-all flex items-center gap-2 text-xs font-medium disabled:opacity-50"
                                            >
                                                {updatingMods[mod.filename] ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpCircle size={16} />}
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleDeleteMod(mod.filename)}
                                            className="text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 p-2 rounded-none transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              </div>
            )}

            {activeTab === "resources" && (
              <div className="flex flex-col gap-6">
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-white">{t("instance_manager.resources")}</h3>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => {
                                    setModrinthProjectType("resourcepack");
                                    setShowModrinth(true);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-none bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium"
                            >
                                <Plus size={14} /> Добавить из Modrinth
                            </button>
                            <button 
                                onClick={() => {
                                    setModrinthProjectType("resourcepack");
                                    setShowCurseForge(true);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-none bg-[#F55E1D]/10 text-[#F55E1D] hover:bg-[#F55E1D]/20 transition-colors text-xs font-medium"
                            >
                                <Plus size={14} /> CurseForge
                            </button>
                        </div>
                    </div>
                    <div className="bg-background brutalist-border rounded-none overflow-hidden min-h-[100px]">
                        {loadingResources ? (
                            <div className="flex justify-center items-center h-24">
                                <Loader2 className="animate-spin text-primary" />
                            </div>
                        ) : installedResourcePacks.length === 0 ? (
                            <div className="flex justify-center items-center h-24 text-muted text-sm flex-col gap-2">
                                <Palette size={20} className="opacity-50" />
                                <span>{t("instance_manager.no_resourcepacks")}</span>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {installedResourcePacks.map((pack, i) => (
                                    <div key={i} className="p-4 flex items-center justify-between group hover:bg-card transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-card brutalist-border rounded-none flex items-center justify-center">
                                                <Palette size={18} className="text-muted" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-white">{pack.filename}</div>
                                                <div className="text-xs text-muted">{(pack.size / 1024 / 1024).toFixed(2)} МБ</div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteResourcePack(pack.filename)}
                                            className="text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 p-2 rounded-none transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-white">{t("instance_manager.shaders")}</h3>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => {
                                    setModrinthProjectType("shader");
                                    setShowModrinth(true);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-none bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium"
                            >
                                <Plus size={14} /> {t("instance_manager.add_from_modrinth")}
                            </button>
                            <button 
                                onClick={() => {
                                    setModrinthProjectType("shader");
                                    setShowCurseForge(true);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-none bg-[#F55E1D]/10 text-[#F55E1D] hover:bg-[#F55E1D]/20 transition-colors text-xs font-medium"
                            >
                                <Plus size={14} /> CurseForge
                            </button>
                        </div>
                    </div>
                    <div className="bg-background brutalist-border rounded-none overflow-hidden min-h-[100px]">
                        {loadingResources ? (
                            <div className="flex justify-center items-center h-24">
                                <Loader2 className="animate-spin text-primary" />
                            </div>
                        ) : installedShaders.length === 0 ? (
                            <div className="flex justify-center items-center h-24 text-muted text-sm flex-col gap-2">
                                <Palette size={20} className="opacity-50" />
                                <span>{t("instance_manager.no_shaders")}</span>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {installedShaders.map((shader, i) => (
                                    <div key={i} className="p-4 flex items-center justify-between group hover:bg-card transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-card brutalist-border rounded-none flex items-center justify-center">
                                                <Palette size={18} className="text-muted" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-white">{shader.filename}</div>
                                                <div className="text-xs text-muted">{(shader.size / 1024 / 1024).toFixed(2)} МБ</div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteShader(shader.filename)}
                                            className="text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 p-2 rounded-none transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="flex flex-col gap-8">
                {/* General Settings */}
                <div className="bg-background brutalist-border rounded-none p-5">
                  <h4 className="text-sm font-semibold text-white mb-4">{t("instance_manager.general_settings")}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-muted mb-1">{t("instance_manager.instance_name")}</label>
                        <input 
                            type="text" 
                            className="w-full bg-card brutalist-border rounded-none px-3 py-2 text-sm text-white" 
                            value={instance.name}
                            onChange={(e) => {
                                invoke("edit_instance", {
                                    id: instance.id,
                                    name: e.target.value,
                                    gameVersion: instance.game_version,
                                    loaderType: instance.loader_type,
                                    loaderVersion: instance.loader_version
                                }).then(() => {
                                    instance.name = e.target.value;
                                }).catch(console.error);
                            }}
                        />
                    </div>
                  </div>
                </div>

                {/* Memory Settings */}
                <div className="bg-background brutalist-border rounded-none p-5">
                  <h4 className="text-sm font-semibold text-white mb-4">{t("instance_manager.memory")}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-muted mb-1">{t("instance_manager.min_ram")}</label>
                        <input 
                            type="number" 
                            placeholder={t("instance_manager.default")}
                            className="w-full bg-card brutalist-border rounded-none px-3 py-2 text-sm text-white" 
                            value={instance.min_memory || ""}
                            onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value) : null;
                                invoke("save_instance_settings", {
                                    id: instance.id,
                                    minMemory: val,
                                    maxMemory: instance.max_memory,
                                    javaPath: instance.java_path,
                                    jvmArgs: instance.jvm_args,
                                    windowWidth: instance.window_width,
                                    windowHeight: instance.window_height
                                }).then(() => {
                                    instance.min_memory = val;
                                }).catch(console.error);
                            }}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-muted mb-1">{t("instance_manager.max_ram")}</label>
                        <input 
                            type="number" 
                            placeholder={t("instance_manager.default")}
                            className="w-full bg-card brutalist-border rounded-none px-3 py-2 text-sm text-white" 
                            value={instance.max_memory || ""}
                            onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value) : null;
                                invoke("save_instance_settings", {
                                    id: instance.id,
                                    minMemory: instance.min_memory,
                                    maxMemory: val,
                                    javaPath: instance.java_path,
                                    jvmArgs: instance.jvm_args,
                                    windowWidth: instance.window_width,
                                    windowHeight: instance.window_height
                                }).then(() => {
                                    instance.max_memory = val;
                                }).catch(console.error);
                            }}
                        />
                    </div>
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="bg-background brutalist-border rounded-none p-5">
                  <h4 className="text-sm font-semibold text-white mb-4">{t("instance_manager.advanced_settings")}</h4>
                  <div className="space-y-4">
                    <div>
                        <label className="block text-xs text-muted mb-1">{t("instance_manager.java_path")}</label>
                        <input 
                            type="text" 
                            placeholder={t("instance_manager.default")}
                            className="w-full bg-card brutalist-border rounded-none px-3 py-2 text-sm text-white" 
                            value={instance.java_path || ""}
                            onChange={(e) => {
                                const val = e.target.value || null;
                                invoke("save_instance_settings", {
                                    id: instance.id,
                                    minMemory: instance.min_memory,
                                    maxMemory: instance.max_memory,
                                    javaPath: val,
                                    jvmArgs: instance.jvm_args,
                                    windowWidth: instance.window_width,
                                    windowHeight: instance.window_height
                                }).then(() => {
                                    instance.java_path = val;
                                }).catch(console.error);
                            }}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-muted mb-1">{t("instance_manager.jvm_args")}</label>
                        <input 
                            type="text" 
                            placeholder="-Xms2G -Xmx4G ..."
                            className="w-full bg-card brutalist-border rounded-none px-3 py-2 text-sm text-white" 
                            value={instance.jvm_args || ""}
                            onChange={(e) => {
                                const val = e.target.value || null;
                                invoke("save_instance_settings", {
                                    id: instance.id,
                                    minMemory: instance.min_memory,
                                    maxMemory: instance.max_memory,
                                    javaPath: instance.java_path,
                                    jvmArgs: val,
                                    windowWidth: instance.window_width,
                                    windowHeight: instance.window_height
                                }).then(() => {
                                    instance.jvm_args = val;
                                }).catch(console.error);
                            }}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-muted mb-1">{t("instance_manager.window_size")}</label>
                        <div className="flex items-center gap-2">
                          <input 
                              type="number" 
                              placeholder="854"
                              className="w-full bg-card brutalist-border rounded-none px-3 py-2 text-sm text-white" 
                              value={instance.window_width || ""}
                              onChange={(e) => {
                                  const val = e.target.value ? parseInt(e.target.value) : null;
                                  invoke("save_instance_settings", {
                                      id: instance.id,
                                      minMemory: instance.min_memory,
                                      maxMemory: instance.max_memory,
                                      javaPath: instance.java_path,
                                      jvmArgs: instance.jvm_args,
                                      windowWidth: val,
                                      windowHeight: instance.window_height
                                  }).then(() => {
                                      instance.window_width = val;
                                  }).catch(console.error);
                              }}
                          />
                          <span className="text-muted">x</span>
                          <input 
                              type="number" 
                              placeholder="480"
                              className="w-full bg-card brutalist-border rounded-none px-3 py-2 text-sm text-white" 
                              value={instance.window_height || ""}
                              onChange={(e) => {
                                  const val = e.target.value ? parseInt(e.target.value) : null;
                                  invoke("save_instance_settings", {
                                      id: instance.id,
                                      minMemory: instance.min_memory,
                                      maxMemory: instance.max_memory,
                                      javaPath: instance.java_path,
                                      jvmArgs: instance.jvm_args,
                                      windowWidth: instance.window_width,
                                      windowHeight: val
                                  }).then(() => {
                                      instance.window_height = val;
                                  }).catch(console.error);
                              }}
                          />
                        </div>
                    </div>
                  </div>
                </div>

                 <div className="bg-red-500/5 border border-red-500/20 rounded-none p-6 flex items-center justify-between">
                     <div>
                         <h4 className="text-red-400 font-medium mb-1">{t("instance_manager.delete_instance")}</h4>
                         <p className="text-xs text-muted">{t("instance_manager.delete_warning")}</p>
                     </div>
                     <button 
                        onClick={handleDeleteInstance}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-none text-sm font-medium transition-colors"
                     >
                         {t("instance_manager.delete")}
                     </button>
                 </div>
              </div>
            )}

            {activeTab === "multiplayer" && (
              <div className="flex flex-col gap-6">
                {/* Intro Card */}
                <div className="bg-background brutalist-border rounded-none p-5">
                  <h4 className="text-lg font-bold text-white mb-1.5 flex items-center gap-2">
                    <Globe className="text-primary" size={20} />
                    Играйте с друзьями без белого IP и стороннего хостинга
                  </h4>
                  <p className="text-sm text-muted leading-relaxed">
                    Выберите удобный способ создания сетевой игры прямо из одиночного мира. 
                    Оба мода работают без сложной настройки роутера и проброса портов.
                  </p>
                </div>

                {/* Mod Cards Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Card 1: e4mc */}
                  <div className={`bg-card brutalist-border rounded-none p-5 flex flex-col justify-between transition-colors ${
                    isE4mcInstalled ? "border-primary/50" : ""
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            <Globe size={20} />
                          </div>
                          <div>
                            <h5 className="font-bold text-white text-base">e4mc</h5>
                            <span className="text-[11px] text-muted font-mono">Публичный веб-прокси</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary border border-primary/20">
                          Modrinth
                        </span>
                      </div>

                      <p className="text-xs text-muted mb-4 leading-relaxed">
                        Генерирует временную веб-ссылку (например, <code className="text-primary font-mono">*.e4mc.link</code>). 
                        Друзьям не нужны сторонние программы — они просто подключаются по ссылке как к обычному серверу.
                      </p>

                      <ul className="text-xs text-muted/90 space-y-1.5 mb-5">
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                          <span>Работает со всеми лаунчерами и клиентами</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                          <span>Подключение в 1 клик через чат</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                          <span>Не требует запущенного Steam</span>
                        </li>
                      </ul>
                    </div>

                    <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3">
                      {isE4mcInstalled ? (
                        <>
                          <div className="flex items-center gap-2 text-green-400 text-xs font-semibold">
                            <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center">
                              <Check size={12} />
                            </div>
                            <span>Установлен</span>
                          </div>
                          <button
                            onClick={() => handleUninstallMultiplayerMod("e4mc")}
                            disabled={uninstallingMod === "e4mc"}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5"
                          >
                            {uninstallingMod === "e4mc" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            {uninstallingMod === "e4mc" ? "Удаление..." : "Удалить"}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={handleInstallE4mc}
                          disabled={installingE4mc || installingE4steam}
                          className="brutalist-button-primary w-full flex items-center justify-center gap-2 py-2 text-xs font-bold"
                        >
                          {installingE4mc ? <Loader2 size={15} className="animate-spin" /> : <Globe size={15} />}
                          {installingE4mc ? "Установка..." : "Установить e4mc"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card 2: e4steam */}
                  <div className={`bg-card brutalist-border rounded-none p-5 flex flex-col justify-between transition-colors ${
                    isE4steamInstalled ? "border-[#66c0f4]/50" : ""
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 bg-[#66c0f4]/10 border border-[#66c0f4]/20 flex items-center justify-center text-[#66c0f4]">
                            <Gamepad2 size={20} />
                          </div>
                          <div>
                            <h5 className="font-bold text-white text-base">e4steam</h5>
                            <span className="text-[11px] text-muted font-mono">Steam P2P Relay</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-[#66c0f4]/10 text-[#66c0f4] border border-[#66c0f4]/20">
                          CurseForge
                        </span>
                      </div>

                      <p className="text-xs text-muted mb-4 leading-relaxed">
                        Форк e4mc на основе защищенной сети Valve Steam. Позволяет подключаться через Steam Overlay 
                        (Shift+Tab) и приглашать друзей из списка контактов Steam.
                      </p>

                      <ul className="text-xs text-muted/90 space-y-1.5 mb-5">
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-[#66c0f4] rounded-full"></span>
                          <span>Приглашения через оверлей Steam (Shift+Tab)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-[#66c0f4] rounded-full"></span>
                          <span>Прямое P2P-соединение с минимальным пингом</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-[#66c0f4] rounded-full"></span>
                          <span>Подключение в 1 клик через список друзей Steam</span>
                        </li>
                      </ul>
                    </div>

                    <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3">
                      {isE4steamInstalled ? (
                        <>
                          <div className="flex items-center gap-2 text-green-400 text-xs font-semibold">
                            <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center">
                              <Check size={12} />
                            </div>
                            <span>Установлен</span>
                          </div>
                          <button
                            onClick={() => handleUninstallMultiplayerMod("e4steam")}
                            disabled={uninstallingMod === "e4steam"}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5"
                          >
                            {uninstallingMod === "e4steam" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            {uninstallingMod === "e4steam" ? "Удаление..." : "Удалить"}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={handleInstallE4steam}
                          disabled={installingE4mc || installingE4steam}
                          className="brutalist-button-primary !bg-[#66c0f4] hover:!bg-[#4ba3d9] !text-black w-full flex items-center justify-center gap-2 py-2 text-xs font-bold"
                        >
                          {installingE4steam ? <Loader2 size={15} className="animate-spin text-black" /> : <Gamepad2 size={15} />}
                          {installingE4steam ? "Установка..." : "Установить e4steam"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Instructions Section */}
                <div className="bg-card brutalist-border rounded-none p-5">
                  <h5 className="font-bold text-white text-sm mb-3">Инструкция по использованию:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted">
                    <div className="bg-background/60 p-3.5 border border-border/70 space-y-2">
                      <div className="font-bold text-primary flex items-center gap-1.5 text-xs">
                        <Globe size={14} /> Для e4mc:
                      </div>
                      <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                        <li>Установите мод <strong>e4mc</strong> кнопкой выше.</li>
                        <li>Зайдите в свой одиночный мир.</li>
                        <li>Нажмите <strong>Esc</strong> &rarr; <strong>«Открыть для сети»</strong>.</li>
                        <li>Скопируйте полученную ссылку <code className="text-white bg-card px-1">*.e4mc.link</code>.</li>
                        <li>Друзья подключаются через «Сетевая игра» &rarr; «Прямое подключение».</li>
                      </ol>
                    </div>

                    <div className="bg-background/60 p-3.5 border border-border/70 space-y-2">
                      <div className="font-bold text-[#66c0f4] flex items-center gap-1.5 text-xs">
                        <Gamepad2 size={14} /> Для e4steam:
                      </div>
                      <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                        <li>Убедитесь, что клиент <strong>Steam</strong> запущен на вашем ПК.</li>
                        <li>Установите мод <strong>e4steam</strong> кнопкой выше.</li>
                        <li>Зайдите в свой одиночный мир и откройте его для сети.</li>
                        <li>Нажмите <strong>Shift + Tab</strong> в оверлее Steam.</li>
                        <li>Нажмите правой кнопкой на друга в Steam &rarr; <strong>«Пригласить в игру»</strong>!</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {showConfirmDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80  animate-in fade-in duration-200" onClick={() => setShowConfirmDelete(false)}>
          <div className="bg-card brutalist-border rounded-none  w-[400px] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 text-red-400 mb-4">
                <div className="w-10 h-10 rounded-none bg-red-500/10 flex items-center justify-center">
                  <Trash2 size={20} />
                </div>
                <h3 className="font-bold text-lg text-white">{t("instance_manager.delete_instance")}</h3>
              </div>
              <p className="text-muted text-sm leading-relaxed mb-6">
                {t("instance_manager.delete_confirm")} <span className="text-white font-medium">{instance.name}</span>? 
                <br/><br/>
                <span className="text-red-400/90 font-medium">{t("instance_manager.delete_irreversible")}</span>
              </p>
              
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setShowConfirmDelete(false)}
                  className="px-4 py-2 rounded-none text-sm font-medium hover:bg-card-hover transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button 
                  onClick={async () => {
                      try {
                          await invoke("remove_instance", { id: instance.id });
                          onDelete();
                      } catch(e) {
                          toast.error(t("common.error") + ": " + e);
                      }
                      setShowConfirmDelete(false);
                  }}
                  className="px-4 py-2 rounded-none text-sm font-bold bg-red-500 hover:bg-red-600 text-white transition-colors  "
                >
                  {t("instance_manager.delete_permanently")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
