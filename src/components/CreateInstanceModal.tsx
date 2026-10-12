import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Box, Layers, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "./Toast";
import { AppSettings } from "../lib/ipc";

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
  const [showSnapshots, setShowSnapshots] = useState(false);

  // Sync snapshot preference from settings on mount
  useEffect(() => {
    invoke<AppSettings>("get_settings")
      .then((s) => {
        if (s?.show_snapshots) setShowSnapshots(true);
      })
      .catch(() => {});
  }, []);

  // Load Minecraft versions
  useEffect(() => {
    async function loadMcVersions() {
      setLoadingVersions(true);
      try {
        const versions = await invoke<string[]>("get_minecraft_versions", {
          includeSnapshots: showSnapshots,
        });
        setAllMcVersions(versions);
        setMcVersions(versions);
        if (versions.length > 0) {
          setGameVersion((prev) => (versions.includes(prev) ? prev : versions[0]));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingVersions(false);
      }
    }
    loadMcVersions();
  }, [showSnapshots]);

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

  const handleImportMrpack = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "Modrinth Modpack", extensions: ["mrpack"] }]
      });
      if (selected && typeof selected === "string") {
        toast.info("Импорт сборки .mrpack запущен...");
        await invoke("import_mrpack", { path: selected });
        toast.success("Сборка успешно импортирована!");
        onCreated();
      }
    } catch(e) {
      console.error(e);
      toast.error(t("common.error") + ": " + e);
    }
  };

  const loaderOptions = [
    { id: "Vanilla", name: "Vanilla", desc: t("create_instance.desc_vanilla"), color: "text-white" },
    { id: "Fabric", name: "Fabric", desc: t("create_instance.desc_fabric"), color: "text-[#DBC39A]" },
    { id: "Forge", name: "Forge", desc: t("create_instance.desc_forge"), color: "text-[#DF8D68]" },
    { id: "Quilt", name: "Quilt", desc: t("create_instance.desc_quilt"), color: "text-[#8E69C6]" },
    { id: "NeoForge", name: "NeoForge", desc: t("create_instance.desc_neoforge"), color: "text-[#E36636]" },
  ];

  return (
    <div className="deck-modal-backdrop animate-in fade-in duration-200">
      <div className="deck-modal-window w-full max-w-lg">
        <div className="deck-modal-laser" />
        
        {/* Header */}
        <div className="deck-modal-header">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#291b14] border border-[#f55e1d]/40 rounded flex items-center justify-center text-primary shrink-0 shadow-[0_0_12px_rgba(245,94,29,0.2)]">
              <Box size={18} className="text-[#f55e1d]" />
            </div>
            <div>
              <span className="deck-modal-eyebrow">REDPANDA / NEW INSTANCE</span>
              <h2 className="deck-modal-title">
                {t("create_instance.title")}
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="deck-modal-close">
            <X size={17} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-5 bg-[#17120e]">
          
          <div>
            <label className="text-xs text-[#a69284] mb-2 block uppercase tracking-wider font-mono font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f55e1d]" />
              {t("create_instance.name")}
            </label>
            <input 
              type="text" 
              placeholder={t("create_instance.name_placeholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#120e0c] border border-[#382921] focus:border-[#f55e1d] rounded px-4 py-2.5 text-xs text-white placeholder-[#78675c] focus:outline-none font-mono transition-colors"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-[#a69284] block uppercase tracking-wider font-mono font-bold">
                  {t("create_instance.version")}
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={showSnapshots}
                    onChange={(e) => setShowSnapshots(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#f55e1d] cursor-pointer rounded"
                  />
                  <span className="text-[11px] font-mono text-[#a69284] group-hover:text-white transition-colors">Снапшоты</span>
                </label>
              </div>
              <select 
                value={gameVersion}
                onChange={(e) => setGameVersion(e.target.value)}
                disabled={loadingVersions}
                className="w-full bg-[#120e0c] border border-[#382921] focus:border-[#f55e1d] rounded px-3 py-2.5 text-xs text-white focus:outline-none font-mono transition-colors appearance-none cursor-pointer disabled:opacity-50"
              >
                {loadingVersions ? (
                  <option>{t("common.loading")}</option>
                ) : (
                  mcVersions.map(v => (
                    <option key={v} value={v} className="bg-[#18120e]">{v}</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#a69284] mb-2 block uppercase tracking-wider font-mono font-bold">
                {t("create_instance.loader")}
              </label>
              <select 
                value={loaderType}
                onChange={(e) => setLoaderType(e.target.value)}
                className="w-full bg-[#120e0c] border border-[#382921] focus:border-[#f55e1d] rounded px-3 py-2.5 text-xs text-white focus:outline-none font-mono transition-colors appearance-none cursor-pointer"
              >
                {loaderOptions.map(opt => (
                  <option key={opt.id} value={opt.id} className="bg-[#18120e]">{opt.name}</option>
                ))}
              </select>
            </div>
          </div>

          {loaderType !== "Vanilla" && (
            <div className="p-3.5 bg-[#130f0d] border border-[#33251d] rounded space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <label className="text-xs text-[#a69284] mb-2 block uppercase tracking-wider font-mono font-bold flex items-center gap-1.5">
                  <Layers size={13} className="text-[#f55e1d]" /> {t("create_instance.loader_version", { loader: loaderType })}
                </label>
                <select
                  value={loaderVersion}
                  onChange={(e) => setLoaderVersion(e.target.value)}
                  disabled={loadingLoaderVersions}
                  className="w-full bg-[#120e0c] border border-[#382921] focus:border-[#f55e1d] rounded px-3 py-2 text-xs text-white focus:outline-none font-mono transition-colors appearance-none cursor-pointer disabled:opacity-50"
                >
                  {loadingLoaderVersions ? (
                    <option>{t("common.loading")}</option>
                  ) : loaderVersions.length === 0 ? (
                    <option value="">{t("create_instance.latest_available")}</option>
                  ) : (
                    loaderVersions.map(v => (
                      <option key={v} value={v} className="bg-[#18120e]">{v}</option>
                    ))
                  )}
                </select>
                <p className="text-[10px] text-[#8c7a6e] font-mono mt-1.5">
                  {t("create_instance.leave_empty_latest")}
                </p>
              </div>

              <div className="pt-2 border-t border-[#291e18] flex items-start gap-3">
                <input
                  id="optimize"
                  type="checkbox"
                  checked={optimizeFPS}
                  onChange={(e) => setOptimizeFPS(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#f55e1d] cursor-pointer rounded"
                />
                <div className="flex flex-col">
                  <label htmlFor="optimize" className="text-xs font-mono font-bold text-white cursor-pointer">
                    {t("create_instance.install_opt_mods")}
                  </label>
                  <p className="text-[10px] text-[#a69284] mt-0.5 font-mono">
                    {t("create_instance.opt_mods_desc")}
                  </p>
                </div>
              </div>
            </div>
          )}
          
        </div>

        {/* Footer */}
        <div className="deck-modal-footer">
          <button
            onClick={handleImportMrpack}
            className="px-3 py-1.5 rounded text-xs font-mono font-bold border border-[#f55e1d]/40 text-[#ff7537] hover:bg-[#f55e1d]/10 transition-colors flex items-center gap-1.5"
          >
            <Box size={14} /> Импорт (.mrpack)
          </button>
          <div className="flex items-center gap-2">
            <button 
              onClick={onClose} 
              className="px-4 py-1.5 rounded text-xs font-mono text-[#a69284] hover:text-white border border-[#382921] bg-[#201813] hover:bg-[#2b2019] transition-colors"
            >
              {t("create_instance.cancel")}
            </button>
            <button 
              onClick={handleCreate}
              disabled={isCreating || !name.trim() || !gameVersion.trim()}
              className="deck-play-btn !py-1.5 !px-5 !text-xs disabled:opacity-40"
            >
              {isCreating ? t("create_instance.creating") : <><Play size={13} fill="currentColor" /> {t("create_instance.create")}</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
