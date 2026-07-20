import { useState, useEffect, memo } from "react";
import { Search, Download, Loader2, ArrowLeft } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface Instance {
  id: string;
  name: string;
  game_version: string;
  loader_type: string;
  loader_version: string;
}

interface ModrinthSearchResult {
    slug: string;
    title: string;
    description: string;
    icon_url: string | null;
    downloads: number;
}

interface ModrinthVersion {
    id: string;
    name: string;
    version_number: string;
}

interface ModrinthBrowserProps {
    instance?: Instance;
    onClose: () => void;
    projectType?: "mod" | "resourcepack" | "shader" | "modpack";
}

const ModItem = memo(({ mod, isSelected, onClick }: { mod: ModrinthSearchResult, isSelected: boolean, onClick: (mod: ModrinthSearchResult) => void }) => {
    return (
        <button 
            onClick={() => onClick(mod)}
            className={`flex items-start gap-4 p-4 rounded-none text-left transition-colors border ${isSelected ? "bg-primary/5 border-primary/30" : "bg-background border-border hover:border-muted/50"}`}
        >
            <div className="w-12 h-12 rounded-none bg-card brutalist-border shrink-0 overflow-hidden">
                {mod.icon_url ? <img src={mod.icon_url} alt={mod.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted/20" />}
            </div>
            <div className="flex-1">
                <h4 className="font-semibold text-white text-sm line-clamp-1">{mod.title}</h4>
                <p className="text-xs text-muted line-clamp-2 mt-1">{mod.description}</p>
            </div>
        </button>
    );
});

import { toast } from "./Toast";
import { useTranslation } from "react-i18next";

const MODPACK_CATEGORIES = [
    { id: "adventure", label: "Adventure" },
    { id: "combat", label: "Combat" },
    { id: "exploration", label: "Exploration" },
    { id: "hardcore", label: "Hardcore" },
    { id: "magic", label: "Magic" },
    { id: "mini-game", label: "Mini Game" },
    { id: "multiplayer", label: "Multiplayer" },
    { id: "optimization", label: "Optimization" },
    { id: "quests", label: "Quests" },
    { id: "tech", label: "Tech" },
    { id: "vanilla-plus", label: "Vanilla+" }
];

const MOD_CATEGORIES = [
    { id: "adventure", label: "Adventure" },
    { id: "cursed", label: "Cursed" },
    { id: "decoration", label: "Decoration" },
    { id: "economy", label: "Economy" },
    { id: "equipment", label: "Equipment" },
    { id: "food", label: "Food" },
    { id: "game-mechanics", label: "Game Mechanics" },
    { id: "library", label: "Library" },
    { id: "magic", label: "Magic" },
    { id: "management", label: "Management" },
    { id: "minigame", label: "Minigame" },
    { id: "mobs", label: "Mobs" },
    { id: "optimization", label: "Optimization" },
    { id: "social", label: "Social" },
    { id: "storage", label: "Storage" },
    { id: "technology", label: "Technology" },
    { id: "transportation", label: "Transportation" },
    { id: "utility", label: "Utility" },
    { id: "worldgen", label: "Worldgen" },
];

const RESOURCEPACK_CATEGORIES = [
    { id: "16x", label: "16x" },
    { id: "32x", label: "32x" },
    { id: "64x", label: "64x" },
    { id: "128x", label: "128x" },
    { id: "256x", label: "256x" },
    { id: "512x", label: "512x" },
    { id: "animated", label: "Animated" },
    { id: "cartoon", label: "Cartoon" },
    { id: "dark", label: "Dark" },
    { id: "default-edit", label: "Default Edit" },
    { id: "hd", label: "HD" },
    { id: "medieval", label: "Medieval" },
    { id: "minimalist", label: "Minimalist" },
    { id: "realistic", label: "Realistic" },
    { id: "themed", label: "Themed" },
    { id: "vanilla-like", label: "Vanilla-like" },
];

const SHADER_CATEGORIES = [
    { id: "realistic", label: "Realistic" },
    { id: "fantasy", label: "Fantasy" },
    { id: "high-performance", label: "High Performance" },
    { id: "vanilla-like", label: "Vanilla-like" },
];

export default function ModrinthBrowser({ instance, onClose, projectType = "mod" }: ModrinthBrowserProps) {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<ModrinthSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [sortBy, setSortBy] = useState("relevance");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    
    // For a specific mod when we click "Download"
    const [selectedMod, setSelectedMod] = useState<ModrinthSearchResult | null>(null);
    const [versions, setVersions] = useState<ModrinthVersion[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [installingVersion, setInstallingVersion] = useState<string | null>(null);

    const handleSearch = async (e?: React.FormEvent, isNewSearch = true) => {
        if (e) e.preventDefault();
        setLoading(true);
        if (isNewSearch) {
            setPage(0);
            setSelectedMod(null);
        }
        
        try {
            const currentOffset = isNewSearch ? 0 : page * 20;
            const data: ModrinthSearchResult[] = await invoke("search_modrinth", {
                query,
                gameVersion: instance?.game_version || "",
                loader: instance?.loader_type || "",
                offset: currentOffset,
                sortBy: sortBy,
                projectType: projectType,
                categories: selectedCategories
            });
            setResults(data);
        } catch (e) {
            console.error(e);
            toast.error(t("common.error") + ": " + e);
        }
        setLoading(false);
    };

    useEffect(() => {
        handleSearch(undefined, false);
    }, [page, sortBy]);

    useEffect(() => {
        handleSearch(undefined, true);
    }, [selectedCategories]);

    const handleSelectMod = async (mod: ModrinthSearchResult) => {
        setSelectedMod(mod);
        setLoadingVersions(true);
        try {
            const data: ModrinthVersion[] = await invoke("get_modrinth_versions", {
                projectSlug: mod.slug,
                gameVersion: instance?.game_version || "",
                loader: instance?.loader_type || "",
                projectType: projectType
            });
            setVersions(data);
        } catch (e) {
            console.error(e);
            toast.error(t("common.error") + ": " + e);
        }
        setLoadingVersions(false);
    };

    const handleInstall = async (versionId: string) => {
        setInstallingVersion(versionId);
        try {
            if (projectType === "modpack") {
                await invoke("download_modrinth_modpack", { versionId });
                toast.success(t("modrinth.install_success_modpack"));
                onClose();
            } else {
                await invoke("download_modrinth_version", {
                    instanceId: instance?.id,
                    versionId,
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
            // Optionally, we could go back or show a checkmark
        } catch(e) {
            console.error(e);
            toast.error(t("common.error") + ": " + e);
        }
        setInstallingVersion(null);
    }

    const browserTitle = projectType === "modpack" ? t("modrinth.browser_modpacks") : projectType === "resourcepack" ? t("modrinth.browser_resourcepacks") : projectType === "shader" ? t("modrinth.browser_shaders") : t("modrinth.browser_mods");

    return (
        <div className="fixed inset-0 bg-black/80  flex items-center justify-center z-50 p-6">
            <div className="bg-card brutalist-border rounded-none w-full max-w-4xl h-[80vh]  flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center gap-4 bg-background/50">
                    <button onClick={onClose} className="p-2 text-muted hover:text-white hover:bg-background rounded-none transition-colors">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex-1">
                        <h3 className="font-semibold text-white leading-tight">{browserTitle}</h3>
                        {instance ? <p className="text-xs text-muted">{t("modrinth.search_for")} {instance.game_version} {instance.loader_type}</p> : null}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    
                    {/* Category Sidebar */}
                    <div className="w-48 border-r border-border bg-background/20 flex flex-col overflow-y-auto shrink-0 custom-scrollbar">
                         <div className="p-3 text-[11px] font-bold text-muted uppercase tracking-wider sticky top-0 bg-background/95  z-10 border-b border-border/50">
                             {t("modrinth.categories")}
                         </div>
                         <div className="p-2 flex flex-col gap-0.5">
                             {(projectType === "modpack" ? MODPACK_CATEGORIES : projectType === "resourcepack" ? RESOURCEPACK_CATEGORIES : projectType === "shader" ? SHADER_CATEGORIES : MOD_CATEGORIES).map(cat => (
                                 <label key={cat.id} className="flex items-center gap-3 px-2 py-1.5 hover:bg-card/80 rounded-none cursor-pointer group transition-colors">
                                     <input 
                                        type="checkbox" 
                                        checked={selectedCategories.includes(cat.id)}
                                        onChange={() => {
                                            setSelectedCategories(prev => prev.includes(cat.id) ? prev.filter(c => c !== cat.id) : [...prev, cat.id]);
                                        }}
                                        className="w-3.5 h-3.5 rounded-none border-border text-primary focus: bg-background cursor-pointer"
                                     />
                                     <span className={`text-[13px] transition-colors ${selectedCategories.includes(cat.id) ? "text-white font-medium" : "text-muted group-hover:text-white/80"}`}>{cat.label}</span>
                                 </label>
                             ))}
                         </div>
                    </div>

                    {/* Left: Search & Results */}
                    <div className={`flex flex-col flex-1 min-w-0 ${selectedMod ? "border-r border-border max-w-[50%]" : ""}`}>
                        <div className="p-4 border-b border-border flex flex-col gap-3">
                            <form onSubmit={(e) => handleSearch(e, true)} className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                <input 
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={t("modrinth.search_placeholder")}
                                    className="w-full bg-background brutalist-border rounded-none pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                                />
                            </form>
                            <div className="flex justify-between items-center">
                                <select 
                                    value={sortBy} 
                                    onChange={(e) => { setSortBy(e.target.value); }}
                                    className="bg-card brutalist-border rounded-none px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                                >
                                    <option value="relevance">{t("modrinth.sort_relevance")}</option>
                                    <option value="downloads">{t("modrinth.sort_downloads")}</option>
                                    <option value="newest">{t("modrinth.sort_newest")}</option>
                                    <option value="updated">{t("modrinth.sort_updated")}</option>
                                </select>
                                <div className="flex items-center gap-2">
                                    <button 
                                        disabled={page === 0 || loading} 
                                        onClick={() => setPage(p => Math.max(0, p - 1))}
                                        className="px-2 py-1 text-xs bg-card hover:bg-background brutalist-border rounded-none disabled:opacity-50 transition-colors text-white"
                                    >
                                        {t("modrinth.prev")}
                                    </button>
                                    <span className="text-xs text-muted">{t("modrinth.page", { page: page + 1 })}</span>
                                    <button 
                                        disabled={results.length < 20 || loading} 
                                        onClick={() => setPage(p => p + 1)}
                                        className="px-2 py-1 text-xs bg-card hover:bg-background brutalist-border rounded-none disabled:opacity-50 transition-colors text-white"
                                    >
                                        {t("modrinth.next")}
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                            {loading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="animate-spin text-muted" />
                                </div>
                            ) : results.length === 0 ? (
                                <div className="text-center text-muted py-10 text-sm">{t("modrinth.nothing_found")}</div>
                            ) : (
                                results.map((mod) => (
                                    <ModItem 
                                        key={mod.slug} 
                                        mod={mod} 
                                        isSelected={selectedMod?.slug === mod.slug} 
                                        onClick={handleSelectMod} 
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right: Mod Details & Versions */}
                    {selectedMod && (
                        <div className="flex-1 flex flex-col bg-background/30 overflow-hidden">
                            <div className="p-6 border-b border-border">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-16 h-16 rounded-none bg-card brutalist-border overflow-hidden">
                                        {selectedMod.icon_url && <img src={selectedMod.icon_url} className="w-full h-full object-cover" />}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white leading-tight">{selectedMod.title}</h3>
                                        <p className="text-sm text-muted">{t("modrinth.downloads_count", { count: selectedMod.downloads.toLocaleString() })}</p>
                                    </div>
                                </div>
                                <p className="text-sm text-muted/90 leading-relaxed">{selectedMod.description}</p>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-4">
                                <h4 className="text-sm font-medium text-white mb-3 pl-2">{t("modrinth.available_versions")}</h4>
                                {loadingVersions ? (
                                    <div className="flex justify-center py-10">
                                        <Loader2 className="animate-spin text-muted" />
                                    </div>
                                ) : versions.length === 0 ? (
                                    <div className="text-center text-muted py-10 text-sm">
                                        {projectType === "modpack" ? t("modrinth.no_compatible_versions_modpack") : t("modrinth.no_compatible_versions", { version: instance?.game_version || "", loader: instance?.loader_type || "" })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {versions.map(v => (
                                            <div key={v.id} className="bg-card brutalist-border rounded-none p-3 flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-medium text-white">{v.name}</div>
                                                    <div className="text-xs text-muted">{v.version_number}</div>
                                                </div>
                                                <button
                                                    onClick={() => handleInstall(v.id)}
                                                    disabled={installingVersion === v.id}
                                                    className="brutalist-button-primary  disabled:opacity-50  disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-2 "
                                                >
                                                    {installingVersion === v.id ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : (
                                                        <Download size={14} />
                                                    )}
                                                    {t("modrinth.install")}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
