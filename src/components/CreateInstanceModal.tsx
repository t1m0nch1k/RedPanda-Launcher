import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Box, Layers, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "./Toast";

interface CreateInstanceModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateInstanceModal({ onClose, onCreated }: CreateInstanceModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [gameVersion, setGameVersion] = useState("1.20.1");
  const [loaderType, setLoaderType] = useState("Vanilla");
  const [loaderVersion, setLoaderVersion] = useState("");
  const [optimizeFPS, setOptimizeFPS] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [mcVersions, setMcVersions] = useState<string[]>([]);
  const [allMcVersions, setAllMcVersions] = useState<string[]>([]);
  const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [loadingLoaderVersions, setLoadingLoaderVersions] = useState(false);

  // Load Minecraft versions
  
  useEffect(() => {
    async function loadMcVersions() {
      try {
        const versions = await invoke<string[]>("get_minecraft_versions");
        setAllMcVersions(versions);
        setMcVersions(versions);
        if (versions.length > 0) setGameVersion(versions[0]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingVersions(false);
      }
    }
    loadMcVersions();
  }, []);

  // Filter game versions when loaderType changes
  useEffect(() => {
    async function loadSupportedVersions() {
      if (loaderType === "Vanilla" || allMcVersions.length === 0) {
        setMcVersions(allMcVersions);
        return;
      }
      setLoadingVersions(true);
      try {
        const supported = await invoke<string[]>("get_supported_game_versions", { loaderType });
        if (supported.length > 0) {
            const filtered = allMcVersions.filter(v => supported.includes(v));
            const newVersions = filtered.length > 0 ? filtered : allMcVersions;
            setMcVersions(newVersions);
            setGameVersion(prev => newVersions.includes(prev) ? prev : newVersions[0]);
        } else {
            setMcVersions(allMcVersions);
        }
      } catch (e) {
        console.error(e);
        setMcVersions(allMcVersions);
      } finally {
        setLoadingVersions(false);
      }
    }
    loadSupportedVersions();
  }, [loaderType, allMcVersions]);

  // Load Modloader versions
  useEffect(() => {
    async function loadLoaderVers() {
      if (loaderType === "Vanilla" || !gameVersion) {
        setLoaderVersions([]);
        setLoaderVersion("");
        return;
      }
      setLoadingLoaderVersions(true);
      try {
        const versions = await invoke<string[]>("get_loader_versions", { loaderType, gameVersion });
        setLoaderVersions(versions);
        if (versions.length > 0) setLoaderVersion(versions[0]);
        else setLoaderVersion("");
      } catch (e) {
        console.error(e);
        setLoaderVersions([]);
      } finally {
        setLoadingLoaderVersions(false);
      }
    }
    loadLoaderVers();
  }, [loaderType, gameVersion]);

  const installOptimizationMods = async (instanceId: string, gameVersion: string, loaderType: string) => {
      let mods: string[] = [];
      if (loaderType === "Fabric") {
          mods = ["fabric-api", "sodium", "lithium", "ferrite-core", "entityculling"];
      } else if (loaderType === "Quilt") {
          mods = ["qsl", "sodium", "lithium", "ferrite-core", "entityculling"];
      } else if (loaderType === "Forge" || loaderType === "NeoForge") {
          mods = ["embeddium", "ferrite-core", "entityculling"];
      }
    
    for (const mod of mods) {
        try {
            const versions = await invoke<any[]>("get_modrinth_versions", {
                projectSlug: mod,
                gameVersion,
                loader: loaderType,
                projectType: "mod"
            });
            if (versions && versions.length > 0) {
                await invoke("download_modrinth_version", {
                    instanceId,
                    versionId: versions[0].id,
                    projectType: "mod"
                });
            }
        } catch(e) {
             console.error(`Failed to install ${mod}`, e);
        }
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !gameVersion.trim()) return;
    
    setIsCreating(true);
    try {
      const newInstance = await invoke<any>("add_instance", {
        name: name.trim(),
        gameVersion: gameVersion.trim(),
        loaderType,
        loaderVersion: loaderType === "Vanilla" ? "" : loaderVersion.trim()
      });

      if (optimizeFPS && loaderType !== "Vanilla") {
         toast.info(t("create_instance.installing_opt_mods"));
         try {
            await installOptimizationMods(newInstance.id, gameVersion.trim(), loaderType);
            toast.success(t("create_instance.opt_mods_installed"));
         } catch(e) {
            toast.error(t("create_instance.error_opt_mods"));
         }
      }

      onCreated();
    } catch (e) {
      console.error(e);
      toast.error(t("common.error") + ": " + e);
    }
    setIsCreating(false);
  };

  const loaderOptions = [
    { id: "Vanilla", name: "Vanilla", desc: t("create_instance.desc_vanilla"), color: "text-white" },
    { id: "Fabric", name: "Fabric", desc: t("create_instance.desc_fabric"), color: "text-[#DBC39A]" },
    { id: "Forge", name: "Forge", desc: t("create_instance.desc_forge"), color: "text-[#DF8D68]" },
    { id: "Quilt", name: "Quilt", desc: t("create_instance.desc_quilt"), color: "text-[#8E69C6]" },
    { id: "NeoForge", name: "NeoForge", desc: t("create_instance.desc_neoforge"), color: "text-[#E36636]" },
  ];

  return (
    <div className="fixed inset-0 bg-black/80  flex items-center justify-center z-50 p-4">
      <div className="bg-card brutalist-border rounded-none w-full max-w-md  flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-background/50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <Box size={20} className="text-primary" />
            {t("create_instance.title")}
          </h2>
          <button onClick={onClose} className="p-2 text-muted hover:text-white hover:bg-card rounded-none transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6">
          
          <div>
            <label className="text-xs text-muted mb-2 block uppercase tracking-wider font-semibold">{t("create_instance.name")}</label>
            <input 
              type="text" 
              placeholder={t("create_instance.name_placeholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-background brutalist-border rounded-none px-4 py-3 text-[13px] text-white focus:outline-none focus:border-primary transition-colors"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted mb-2 block uppercase tracking-wider font-semibold">{t("create_instance.version")}</label>
              <select 
                value={gameVersion}
                onChange={(e) => setGameVersion(e.target.value)}
                disabled={loadingVersions}
                className="w-full bg-background brutalist-border rounded-none px-4 py-3 text-[13px] text-white focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer disabled:opacity-50"
              >
                {loadingVersions ? (
                  <option>{t("common.loading")}</option>
                ) : (
                  mcVersions.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted mb-2 block uppercase tracking-wider font-semibold">{t("create_instance.loader")}</label>
              <select 
                value={loaderType}
                onChange={(e) => setLoaderType(e.target.value)}
                className="w-full bg-background brutalist-border rounded-none px-4 py-3 text-[13px] text-white focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
              >
                {loaderOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                ))}
              </select>
            </div>
          </div>

          {loaderType !== "Vanilla" && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="text-xs text-muted mb-2 block uppercase tracking-wider font-semibold flex items-center gap-2">
                <Layers size={14} /> {t("create_instance.loader_version", { loader: loaderType })}
              </label>
              <select
                value={loaderVersion}
                onChange={(e) => setLoaderVersion(e.target.value)}
                disabled={loadingLoaderVersions}
                className="w-full bg-background brutalist-border rounded-none px-4 py-3 text-[13px] text-white focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer disabled:opacity-50"
              >
                {loadingLoaderVersions ? (
                  <option>{t("common.loading")}</option>
                ) : loaderVersions.length === 0 ? (
                  <option value="">{t("create_instance.latest_available")}</option>
                ) : (
                  loaderVersions.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))
                )}
              </select>
              <p className="text-[10px] text-muted mt-1.5 ml-1">
                {t("create_instance.leave_empty_latest")}
              </p>

              <div className="mt-4 flex items-start gap-3">
                <div className="flex items-center h-5">
                  <input
                    id="optimize"
                    type="checkbox"
                    checked={optimizeFPS}
                    onChange={(e) => setOptimizeFPS(e.target.checked)}
                    className="w-4 h-4 rounded-none border-border bg-background text-primary focus:ring-primary focus:ring-offset-background"
                  />
                </div>
                <div className="flex flex-col">
                  <label htmlFor="optimize" className="text-sm font-medium text-white cursor-pointer">
                    {t("create_instance.install_opt_mods")}
                  </label>
                  <p className="text-[10px] text-muted mt-0.5">
                    {t("create_instance.opt_mods_desc")}
                  </p>
                </div>
              </div>
            </div>
          )}
          
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-background/50 rounded-b-2xl flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 rounded-none font-medium text-[13px] text-muted hover:text-white transition-colors"
          >
            {t("create_instance.cancel")}
          </button>
          <button 
            onClick={handleCreate}
            disabled={isCreating || !name.trim() || !gameVersion.trim()}
            className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-none font-semibold text-[13px] disabled:opacity-50 transition-colors  flex items-center gap-2"
          >
            {isCreating ? t("create_instance.creating") : <><Play size={14} /> {t("create_instance.create")}</>}
          </button>
        </div>

      </div>
    </div>
  );
}
