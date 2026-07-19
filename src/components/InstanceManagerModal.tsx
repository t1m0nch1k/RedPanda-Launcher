import { useState, useEffect } from "react";
import { X, Puzzle, Palette, Settings as SettingsIcon, Trash2, Plus, Loader2, RefreshCw, ArrowUpCircle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import ModrinthBrowser from "./ModrinthBrowser";

interface Instance {
  id: string;
  name: string;
  game_version: string;
  loader_type: string;
  loader_version: string;
  min_memory?: number | null;
  max_memory?: number | null;
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

export default function InstanceManagerModal({ instance, onClose, onDelete }: InstanceManagerModalProps) {
  const [activeTab, setActiveTab] = useState<"mods" | "resources" | "settings">("mods");
  const [showModrinth, setShowModrinth] = useState(false);
  const [modrinthProjectType, setModrinthProjectType] = useState<"mod" | "resourcepack" | "shader">("mod");
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
          toast.error("Ошибка при проверке обновлений: " + e);
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
          toast.error("Ошибка при обновлении мода: " + e);
      } finally {
          setUpdatingMods(prev => ({ ...prev, [modFileName]: false }));
      }
  };

  const loadMods = async () => {
    setLoadingMods(true);
    try {
        const mods: Mod[] = await invoke("get_installed_mods", { instanceId: instance.id });
        setInstalledMods(mods);
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
    if (activeTab === "mods" && !showModrinth) {
        loadMods();
    } else if (activeTab === "resources") {
        loadResources();
    }
  }, [activeTab, showModrinth]);

  const handleDeleteMod = async (filename: string) => {
    try {
        await invoke("delete_mod", { instanceId: instance.id, filename });
        loadMods();
    } catch(e) {
        console.error(e);
        toast.error("Ошибка при удалении мода: " + e);
    }
  }

  const handleDeleteResourcePack = async (filename: string) => {
    try {
        await invoke("delete_resourcepack", { instanceId: instance.id, filename });
        loadResources();
    } catch(e) {
        console.error(e);
        toast.error("Ошибка при удалении ресурспака: " + e);
    }
  }

  const handleDeleteShader = async (filename: string) => {
    try {
        await invoke("delete_shader", { instanceId: instance.id, filename });
        loadResources();
    } catch(e) {
        console.error(e);
        toast.error("Ошибка при удалении шейдера: " + e);
    }
  }

  const handleDeleteInstance = async () => {
    setShowConfirmDelete(true);
  };

  if (showModrinth) {
    return <ModrinthBrowser 
        instance={instance} 
        onClose={() => setShowModrinth(false)} 
        projectType={modrinthProjectType}
    />;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl h-[80vh] shadow-2xl flex overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
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
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === "mods" ? "bg-primary/10 text-primary" : "text-muted hover:text-white hover:bg-card"
              }`}
            >
              <Puzzle size={16} /> Моды
            </button>
            <button
              onClick={() => setActiveTab("resources")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === "resources" ? "bg-primary/10 text-primary" : "text-muted hover:text-white hover:bg-card"
              }`}
            >
              <Palette size={16} /> Ресурспаки
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === "settings" ? "bg-primary/10 text-primary" : "text-muted hover:text-white hover:bg-card"
              }`}
            >
              <SettingsIcon size={16} /> Настройки
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col relative bg-card">
          <div className="p-4 border-b border-border flex justify-between items-center bg-background/50">
            <h3 className="font-semibold text-white">
              {activeTab === "mods" && "Управление модами"}
              {activeTab === "resources" && "Ресурспаки и Шейдеры"}
              {activeTab === "settings" && "Настройки сборки"}
            </h3>
            <button onClick={onClose} className="p-2 text-muted hover:text-white hover:bg-background rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "mods" && (
              <div className="flex flex-col h-full gap-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium text-muted">Установленные моды ({installedMods.length})</h4>
                  <div className="flex items-center gap-2">
                      <button 
                        onClick={handleCheckUpdates}
                        disabled={checkingUpdates}
                        className="bg-card hover:bg-background border border-border text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {checkingUpdates ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                        Проверить обновления
                      </button>
                      <button 
                        onClick={() => { setModrinthProjectType("mod"); setShowModrinth(true); }}
                        className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
                      >
                        <Plus size={14} /> Скачать моды
                      </button>
                  </div>
                </div>
                
                <div className="bg-background border border-border rounded-xl flex-1 overflow-y-auto">
                    {loadingMods ? (
                        <div className="flex items-center justify-center h-full text-muted flex-col gap-3">
                            <Loader2 className="animate-spin" size={24} />
                            <span className="text-sm">Загрузка списка...</span>
                        </div>
                    ) : installedMods.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted text-sm flex-col gap-2 p-8 text-center">
                            <Puzzle size={32} className="opacity-20 mb-2" />
                            Модов пока нет.<br/>Нажмите "Скачать моды" чтобы найти их в базе Modrinth.
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {installedMods.map((mod, i) => (
                                <div key={i} className="p-4 flex items-center justify-between group hover:bg-card transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-card border border-border rounded-lg flex items-center justify-center relative">
                                            <Puzzle size={18} className="text-muted" />
                                            {modUpdates[mod.filename] && (
                                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-white flex items-center gap-2">
                                                {mod.filename}
                                                {modUpdates[mod.filename] && (
                                                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded uppercase font-bold">
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
                                                className="text-green-400 hover:bg-green-500/10 p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-medium disabled:opacity-50"
                                            >
                                                {updatingMods[mod.filename] ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpCircle size={16} />}
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleDeleteMod(mod.filename)}
                                            className="text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 p-2 rounded-lg transition-all"
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
                        <h3 className="text-sm font-semibold text-white">Ресурспаки</h3>
                        <button 
                            onClick={() => {
                                setModrinthProjectType("resourcepack");
                                setShowModrinth(true);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium"
                        >
                            <Plus size={14} /> Добавить из Modrinth
                        </button>
                    </div>
                    <div className="bg-background border border-border rounded-xl overflow-hidden min-h-[100px]">
                        {loadingResources ? (
                            <div className="flex justify-center items-center h-24">
                                <Loader2 className="animate-spin text-primary" />
                            </div>
                        ) : installedResourcePacks.length === 0 ? (
                            <div className="flex justify-center items-center h-24 text-muted text-sm flex-col gap-2">
                                <Palette size={20} className="opacity-50" />
                                <span>Нет установленных ресурспаков</span>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {installedResourcePacks.map((pack, i) => (
                                    <div key={i} className="p-4 flex items-center justify-between group hover:bg-card transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-card border border-border rounded-lg flex items-center justify-center">
                                                <Palette size={18} className="text-muted" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-white">{pack.filename}</div>
                                                <div className="text-xs text-muted">{(pack.size / 1024 / 1024).toFixed(2)} МБ</div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteResourcePack(pack.filename)}
                                            className="text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 p-2 rounded-lg transition-all"
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
                        <h3 className="text-sm font-semibold text-white">Шейдеры</h3>
                        <button 
                            onClick={() => {
                                setModrinthProjectType("shader");
                                setShowModrinth(true);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium"
                        >
                            <Plus size={14} /> Добавить из Modrinth
                        </button>
                    </div>
                    <div className="bg-background border border-border rounded-xl overflow-hidden min-h-[100px]">
                        {loadingResources ? (
                            <div className="flex justify-center items-center h-24">
                                <Loader2 className="animate-spin text-primary" />
                            </div>
                        ) : installedShaders.length === 0 ? (
                            <div className="flex justify-center items-center h-24 text-muted text-sm flex-col gap-2">
                                <Palette size={20} className="opacity-50" />
                                <span>Нет установленных шейдеров</span>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {installedShaders.map((shader, i) => (
                                    <div key={i} className="p-4 flex items-center justify-between group hover:bg-card transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-card border border-border rounded-lg flex items-center justify-center">
                                                <Palette size={18} className="text-muted" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-white">{shader.filename}</div>
                                                <div className="text-xs text-muted">{(shader.size / 1024 / 1024).toFixed(2)} МБ</div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteShader(shader.filename)}
                                            className="text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 p-2 rounded-lg transition-all"
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
                <div className="bg-background border border-border rounded-xl p-5">
                  <h4 className="text-sm font-semibold text-white mb-4">Основные настройки</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-muted mb-1">Название сборки</label>
                        <input 
                            type="text" 
                            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-white" 
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
                <div className="bg-background border border-border rounded-xl p-5">
                  <h4 className="text-sm font-semibold text-white mb-4">Память</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-muted mb-1">Минимум RAM (МБ)</label>
                        <input 
                            type="number" 
                            placeholder="По умолчанию"
                            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-white" 
                            value={instance.min_memory || ""}
                            onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value) : null;
                                invoke("save_instance_settings", {
                                    id: instance.id,
                                    minMemory: val,
                                    maxMemory: instance.max_memory
                                }).then(() => {
                                    instance.min_memory = val;
                                }).catch(console.error);
                            }}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-muted mb-1">Максимум RAM (МБ)</label>
                        <input 
                            type="number" 
                            placeholder="По умолчанию"
                            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-white" 
                            value={instance.max_memory || ""}
                            onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value) : null;
                                invoke("save_instance_settings", {
                                    id: instance.id,
                                    minMemory: instance.min_memory,
                                    maxMemory: val
                                }).then(() => {
                                    instance.max_memory = val;
                                }).catch(console.error);
                            }}
                        />
                    </div>
                  </div>
                </div>

                 <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6 flex items-center justify-between">
                     <div>
                         <h4 className="text-red-400 font-medium mb-1">Удаление сборки</h4>
                         <p className="text-xs text-muted">Это действие необратимо удалит все файлы, моды и миры.</p>
                     </div>
                     <button 
                        onClick={handleDeleteInstance}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                     >
                         Удалить
                     </button>
                 </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {showConfirmDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowConfirmDelete(false)}>
          <div className="bg-card border border-border rounded-xl shadow-2xl w-[400px] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 text-red-400 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <Trash2 size={20} />
                </div>
                <h3 className="font-bold text-lg text-white">Удаление сборки</h3>
              </div>
              <p className="text-muted text-sm leading-relaxed mb-6">
                Вы уверены, что хотите удалить сборку <span className="text-white font-medium">{instance.name}</span>? 
                <br/><br/>
                <span className="text-red-400/90 font-medium">Все моды и сохранения будут удалены безвозвратно!</span>
              </p>
              
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setShowConfirmDelete(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-card-hover transition-colors"
                >
                  Отмена
                </button>
                <button 
                  onClick={async () => {
                      try {
                          await invoke("remove_instance", { id: instance.id });
                          onDelete();
                      } catch(e) {
                          toast.error("Ошибка при удалении: " + e);
                      }
                      setShowConfirmDelete(false);
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
    </div>
  );
}
