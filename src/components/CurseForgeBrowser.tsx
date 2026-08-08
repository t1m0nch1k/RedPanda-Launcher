import { useState, useEffect, memo } from "react";
import { Search, Download, Loader2, ArrowLeft } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "./Toast";
import { useTranslation } from "react-i18next";

interface Instance {
  id: string;
  name: string;
  game_version: string;
  loader_type: string;
  loader_version: string;
}

interface CurseForgeSearchResult {
    id: number;
    name: string;
    summary: string;
    logo?: {
        url: string;
        thumbnailUrl: string;
    };
    downloadCount: number;
}

interface CurseForgeFile {
    id: number;
    modId: number;
    displayName: string;
    fileName: string;
    releaseType: number; // 1 = Release, 2 = Beta, 3 = Alpha
    fileDate: string;
    fileLength: number;
    downloadUrl?: string;
    gameVersions: string[];
}

interface CurseForgeBrowserProps {
    instance?: Instance;
    onClose: () => void;
    projectType?: "mod" | "resourcepack" | "shader" | "modpack";
}

const ModItem = memo(({ mod, isSelected, onClick }: { mod: CurseForgeSearchResult, isSelected: boolean, onClick: (mod: CurseForgeSearchResult) => void }) => {
    return (
        <button 
            onClick={() => onClick(mod)}
            className={`flex items-start gap-4 p-4 rounded-none text-left transition-colors border ${isSelected ? "bg-primary/5 border-primary/30" : "bg-background border-border hover:border-muted/50"}`}
        >
            <div className="w-12 h-12 rounded-none bg-card brutalist-border shrink-0 overflow-hidden">
                {mod.logo ? <img src={mod.logo.thumbnailUrl || mod.logo.url} alt={mod.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted/20" />}
            </div>
            <div className="flex-1">
                <h4 className="font-semibold text-white text-sm line-clamp-1">{mod.name}</h4>
                <p className="text-xs text-muted line-clamp-2 mt-1">{mod.summary}</p>
            </div>
        </button>
    );
});

export default function CurseForgeBrowser({ instance, onClose, projectType = "mod" }: CurseForgeBrowserProps) {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<CurseForgeSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(0);

    const [selectedMod, setSelectedMod] = useState<CurseForgeSearchResult | null>(null);
    const [versions, setVersions] = useState<CurseForgeFile[]>([]);
    const [isLoadingVersions, setIsLoadingVersions] = useState(false);
    const [installingVersionId, setInstallingVersionId] = useState<number | null>(null);

    const classId = projectType === "modpack" ? 4471 : projectType === "resourcepack" ? 12 : projectType === "shader" ? 6552 : 6; // CurseForge Class IDs: Mods=6, Modpacks=4471, ResourcePacks=12 (Shaders aren't directly a class, usually under Customization, let's use 6 for now if not sure, but Shaders is usually classId 6552 in newer API)

    const searchCurseForge = async (p = 0) => {
        setIsLoading(true);
        try {
            const data: CurseForgeSearchResult[] = await invoke("search_curseforge", {
                query,
                gameVersion: instance ? instance.game_version : "",
                classId,
                index: p * 20,
                pageSize: 20
            });
            if (p === 0) setResults(data);
            else setResults(prev => [...prev, ...data]);
        } catch (e: any) {
            toast.error(e.toString());
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const tId = setTimeout(() => {
            setPage(0);
            searchCurseForge(0);
        }, 500);
        return () => clearTimeout(tId);
    }, [query, projectType]);

    const handleSelectMod = async (mod: CurseForgeSearchResult) => {
        setSelectedMod(mod);
        setIsLoadingVersions(true);
        setVersions([]);
        try {
            const data: CurseForgeFile[] = await invoke("get_curseforge_versions", {
                modId: mod.id,
                gameVersion: instance ? instance.game_version : null,
            });
            setVersions(data);
        } catch (e: any) {
            toast.error(e.toString());
        } finally {
            setIsLoadingVersions(false);
        }
    };

    const handleInstallVersion = async (file: CurseForgeFile) => {
        if (!file.downloadUrl) {
            toast.error("Автор мода запретил скачивание сторонними приложениями. Пожалуйста, скачайте файл вручную с сайта CurseForge.");
            return;
        }

        setInstallingVersionId(file.id);
        try {
            if (projectType === "modpack") {
                await invoke("download_curseforge_modpack", { 
                    downloadUrl: file.downloadUrl,
                    fileName: file.fileName 
                });
                toast.success(t("modrinth.install_success_modpack"));
            } else if (instance) {
                await invoke("download_curseforge_version", {
                    instanceId: instance.id,
                    downloadUrl: file.downloadUrl,
                    fileName: file.fileName,
                    projectType
                });
                if (projectType === "resourcepack") {
                    toast.success(t("modrinth.install_success_resourcepack"));
                } else if (projectType === "shader") {
                    toast.success(t("modrinth.install_success_shader"));
                } else {
                    toast.success(t("modrinth.install_success_mod"));
                }
            }
        } catch (e: any) {
            toast.error(e.toString());
        } finally {
            setInstallingVersionId(null);
        }
    };

    const browserTitle = projectType === "modpack" ? "Модпаки CurseForge" : projectType === "resourcepack" ? "Ресурспаки CurseForge" : projectType === "shader" ? "Шейдеры CurseForge" : "Моды CurseForge";

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
            <div className="bg-card brutalist-border rounded-none w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center gap-4 p-4 border-b border-border bg-background/50">
                <button onClick={onClose} className="p-2 text-muted hover:text-white transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        {browserTitle}
                    </h2>
                    {instance ? <p className="text-xs text-muted">{t("modrinth.search_for")} {instance.game_version} {instance.loader_type}</p> : null}
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Search Sidebar */}
                <div className="w-72 bg-background border-r border-border flex flex-col">
                    <div className="p-4 border-b border-border">
                        <div className="relative">
                            <input 
                                type="text" 
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder={t("modrinth.search_placeholder")}
                                className="w-full bg-card brutalist-border pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                            />
                            <Search size={16} className="absolute left-3 top-2.5 text-muted" />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {results.length > 0 ? (
                            <>
                                {results.map(mod => (
                                    <ModItem 
                                        key={mod.id} 
                                        mod={mod} 
                                        isSelected={selectedMod?.id === mod.id}
                                        onClick={handleSelectMod} 
                                    />
                                ))}
                                <div className="p-2 flex justify-center">
                                    <button 
                                        onClick={() => { setPage(p => p + 1); searchCurseForge(page + 1); }}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        Загрузить еще
                                    </button>
                                </div>
                            </>
                        ) : (
                            !isLoading && <div className="text-center text-muted py-10 text-sm">{t("modrinth.nothing_found")}</div>
                        )}
                        {isLoading && (
                            <div className="flex justify-center py-4">
                                <Loader2 size={24} className="animate-spin text-primary" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col bg-card overflow-hidden">
                    {selectedMod ? (
                        <>
                            <div className="p-6 border-b border-border bg-background/30 flex items-start gap-6">
                                <div className="w-24 h-24 bg-background brutalist-border shrink-0 overflow-hidden">
                                    {selectedMod.logo ? <img src={selectedMod.logo.url} alt={selectedMod.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted/20" />}
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-bold text-white">{selectedMod.name}</h2>
                                    <p className="text-muted mt-2">{selectedMod.summary}</p>
                                    <div className="flex flex-wrap gap-2 mt-4 text-xs font-mono">
                                        <div className="px-2 py-1 bg-background border border-border text-muted">
                                            Downloads: {selectedMod.downloadCount.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                                <h3 className="font-semibold text-white mb-4">{t("modrinth.versions")}</h3>
                                {isLoadingVersions ? (
                                    <div className="flex justify-center py-10">
                                        <Loader2 size={32} className="animate-spin text-primary" />
                                    </div>
                                ) : versions.length > 0 ? (
                                    <div className="space-y-3">
                                        {versions.map(v => (
                                            <div key={v.id} className="bg-background border border-border p-4 flex items-center justify-between hover:border-primary/50 transition-colors">
                                                <div>
                                                    <div className="font-semibold flex items-center gap-2">
                                                        <span className="text-white">{v.displayName}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 uppercase font-bold ${v.releaseType === 1 ? "bg-green-500/20 text-green-400" : v.releaseType === 2 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>
                                                            {v.releaseType === 1 ? "Release" : v.releaseType === 2 ? "Beta" : "Alpha"}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-muted font-mono mt-1">
                                                        {v.fileName} • {new Date(v.fileDate).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleInstallVersion(v)}
                                                    disabled={installingVersionId === v.id || !v.downloadUrl}
                                                    className="p-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition-colors disabled:opacity-50"
                                                    title={!v.downloadUrl ? "Автор запретил скачивание сторонними приложениями" : "Скачать"}
                                                >
                                                    {installingVersionId === v.id ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-muted py-10 text-sm">{t("modrinth.nothing_found")}</div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-muted">
                            <div className="text-center">
                                <Search size={48} className="mx-auto mb-4 opacity-20" />
                                <p>Выберите проект для просмотра версий</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            </div>
        </div>
    );
}
