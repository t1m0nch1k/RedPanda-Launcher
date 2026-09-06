import { useState, useEffect } from "react";
import { 
  Wand2, X, ChevronRight, ChevronLeft, Check, Sparkles, 
  Play, CheckCircle2, ShieldCheck
} from "lucide-react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { command, getErrorMessage, BuilderProgress } from "../lib/ipc";
import { BUILDER_CATEGORIES, CURATED_MODS } from "../data/builderPresets";
import { toast } from "./Toast";

interface ModpackBuilderModalProps {
  onClose: () => void;
  onInstanceCreated: (instanceId: string) => void;
}

interface CreatedInstance {
  id: string;
  name: string;
}

export default function ModpackBuilderModal({ onClose, onInstanceCreated }: ModpackBuilderModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Settings
  const [packName, setPackName] = useState("");
  const [gameVersion, setGameVersion] = useState("1.20.1");
  const [loaderType, setLoaderType] = useState<"Fabric" | "Forge" | "NeoForge">("Fabric");
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [mcVersions, setMcVersions] = useState<string[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Step 2: Selected Categories
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "optimization",
    "qol",
    "magic",
    "adventure",
  ]);

  // Step 3: Selected Mods
  const [selectedModIds, setSelectedModIds] = useState<Set<string>>(new Set());

  // Step 4: Build Progress
  const [isBuilding, setIsBuilding] = useState(false);
  const [progress, setProgress] = useState<BuilderProgress>({
    status: "init",
    message: "Подготовка...",
    current: 0,
    total: 100,
  });
  const [createdInstance, setCreatedInstance] = useState<CreatedInstance | null>(null);

  // Load versions
  useEffect(() => {
    async function loadVersions() {
      setLoadingVersions(true);
      try {
        const versions = await command<string[]>("get_minecraft_versions", {
          includeSnapshots: showSnapshots,
        });
        setMcVersions(versions);
        if (versions.length > 0 && !versions.includes(gameVersion)) {
          setGameVersion(versions[0]);
        }
      } catch (e) {
        console.error("Failed to load versions:", e);
      } finally {
        setLoadingVersions(false);
      }
    }
    loadVersions();
  }, [showSnapshots]);

  // Auto-generate name based on categories
  useEffect(() => {
    if (!packName || packName.startsWith("Сборка: ")) {
      const activeNames = BUILDER_CATEGORIES.filter(c => selectedCategories.includes(c.id) && c.id !== "optimization" && c.id !== "qol")
        .map(c => c.name.split(" ")[0]);
      
      if (activeNames.length > 0) {
        setPackName(`Сборка: ${activeNames.slice(0, 2).join(" & ")}`);
      } else {
        setPackName("Моя кастомная сборка");
      }
    }
  }, [selectedCategories]);

  // Filter curated mods by selected categories, game version & loader
  const availableMods = CURATED_MODS.filter(mod => {
    if (!selectedCategories.includes(mod.category)) return false;
    if (!mod.loaders.includes(loaderType)) return false;
    return true;
  });

  // When available mods change (category or loader changed), auto-select recommended mods
  useEffect(() => {
    const nextSet = new Set<string>();
    availableMods.forEach(mod => {
      if (mod.isCore || mod.recommended || selectedModIds.has(mod.id)) {
        nextSet.add(mod.id);
      }
    });
    setSelectedModIds(nextSet);
  }, [selectedCategories, loaderType]);

  // Listen to builder events
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    async function setupListener() {
      unlisten = await listen<BuilderProgress>("builder-progress", (event) => {
        if (event.payload) {
          setProgress(event.payload);
        }
      });
    }
    setupListener();
    return () => {
      unlisten?.();
    };
  }, []);

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const toggleMod = (modId: string) => {
    setSelectedModIds(prev => {
      const next = new Set(prev);
      if (next.has(modId)) {
        next.delete(modId);
      } else {
        next.add(modId);
      }
      return next;
    });
  };

  const handleStartBuild = async () => {
    if (!packName.trim()) {
      toast.error("Пожалуйста, введите название сборки");
      return;
    }
    if (selectedModIds.size === 0) {
      toast.error("Выберите хотя бы один мод для сборки");
      return;
    }

    setStep(4);
    setIsBuilding(true);

    try {
      const result = await command<CreatedInstance>("build_custom_modpack", {
        name: packName.trim(),
        gameVersion,
        loaderType,
        loaderVersion: null,
        modSlugs: Array.from(selectedModIds),
      });

      setCreatedInstance(result);
      setStep(5);
      toast.success("Сборка успешно сгенерирована и готова!");
    } catch (e) {
      console.error("Build failed:", e);
      toast.error("Ошибка при сборке: " + getErrorMessage(e));
      setStep(3);
    } finally {
      setIsBuilding(false);
    }
  };

  const percent = progress.total > 0 
    ? Math.min(100, Math.round((progress.current / progress.total) * 100))
    : 0;

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
      <div className="bg-card brutalist-border w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="h-16 px-6 bg-background border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-none bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
              <Wand2 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">Конструктор сборок</h2>
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold brutalist-border uppercase tracking-wider">
                  BETA
                </span>
              </div>
              <p className="text-xs text-muted">Умный генератор модпаков под выбранные тематики</p>
            </div>
          </div>
          <button 
            disabled={isBuilding}
            onClick={onClose}
            className="p-1.5 text-muted hover:text-white brutalist-border hover:bg-card-hover transition-colors disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        {/* Steps Breadcrumb Indicator */}
        <div className="bg-background/50 border-b border-border px-6 py-2.5 flex items-center justify-between text-xs font-mono shrink-0">
          {[
            { id: 1, label: "1. Параметры" },
            { id: 2, label: "2. Тематики" },
            { id: 3, label: "3. Выбор модов" },
            { id: 4, label: "4. Сборка" },
          ].map((s) => (
            <div 
              key={s.id} 
              className={`flex items-center gap-1.5 font-bold ${
                step === s.id ? "text-primary" : step > s.id ? "text-white/80" : "text-muted"
              }`}
            >
              <span>{s.label}</span>
              {step > s.id && <Check size={12} className="text-emerald-400" />}
            </div>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          
          {/* STEP 1: General Parameters */}
          {step === 1 && (
            <div className="flex flex-col gap-6">
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">
                  Название сборки
                </label>
                <input 
                  type="text"
                  value={packName}
                  onChange={(e) => setPackName(e.target.value)}
                  placeholder="Например: Магические приключения"
                  className="w-full bg-background brutalist-border px-4 py-3 text-sm text-white focus:outline-none focus:border-primary font-mono"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-muted uppercase tracking-wider block">
                      Версия Minecraft
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted hover:text-white">
                      <input 
                        type="checkbox"
                        checked={showSnapshots}
                        onChange={(e) => setShowSnapshots(e.target.checked)}
                        className="accent-primary w-3.5 h-3.5"
                      />
                      <span>Снапшоты</span>
                    </label>
                  </div>
                  <select
                    value={gameVersion}
                    onChange={(e) => setGameVersion(e.target.value)}
                    disabled={loadingVersions}
                    className="w-full bg-background brutalist-border px-4 py-3 text-sm text-white focus:outline-none focus:border-primary font-mono cursor-pointer"
                  >
                    {loadingVersions ? (
                      <option>Загрузка версий...</option>
                    ) : (
                      mcVersions.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">
                    Загрузчик модов
                  </label>
                  <select
                    value={loaderType}
                    onChange={(e) => setLoaderType(e.target.value as "Fabric" | "Forge" | "NeoForge")}
                    className="w-full bg-background brutalist-border px-4 py-3 text-sm text-white focus:outline-none focus:border-primary font-mono cursor-pointer"
                  >
                    <option value="Fabric">Fabric (Быстрый, легкий, топовый FPS)</option>
                    <option value="Forge">Forge (Классический каталог модов)</option>
                    <option value="NeoForge">NeoForge (Современный форк Forge)</option>
                  </select>
                </div>
              </div>

              <div className="p-4 bg-primary/5 border border-primary/20 flex items-start gap-3">
                <Sparkles size={18} className="text-primary shrink-0 mt-0.5" />
                <div className="text-xs text-text/80 space-y-1">
                  <div className="font-bold text-white">Умный подборщик RedPanda:</div>
                  <p>Алгоритм автоматически проверит совместимость каждого мода с выбранной версией ({gameVersion}) и загрузчиком ({loaderType}), а также скачает ядро оптимизации FPS и все требуемые библиотеки.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Categories / Themes */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="text-xs text-muted mb-1">
                Выберите тематики, которые хотите включить в вашу новую сборку:
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {BUILDER_CATEGORIES.map(category => {
                  const isSelected = selectedCategories.includes(category.id);
                  const modsCount = CURATED_MODS.filter(m => m.category === category.id && m.loaders.includes(loaderType)).length;

                  return (
                    <button
                      key={category.id}
                      onClick={() => toggleCategory(category.id)}
                      className={`p-4 brutalist-border text-left transition-all flex items-start gap-3 ${
                        isSelected 
                          ? "bg-primary/10 border-primary scale-[1.01]" 
                          : "bg-background border-border hover:border-muted/80 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <span className="text-2xl shrink-0 select-none">{category.icon}</span>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-xs text-white truncate">{category.name}</h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-card text-muted brutalist-border shrink-0">
                            {modsCount} модов
                          </span>
                        </div>
                        <p className="text-[11px] text-muted mt-1 leading-snug">{category.description}</p>
                      </div>
                      <div className={`w-4 h-4 mt-0.5 rounded-none border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? "border-primary bg-primary text-background" : "border-muted"
                      }`}>
                        {isSelected && <Check size={10} className="stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Mod Selection & Customization */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">
                  Отобрано модов под {gameVersion} ({loaderType}): <strong className="text-white">{selectedModIds.size} из {availableMods.length}</strong>
                </span>
                <button
                  onClick={() => {
                    if (selectedModIds.size === availableMods.length) {
                      setSelectedModIds(new Set());
                    } else {
                      setSelectedModIds(new Set(availableMods.map(m => m.id)));
                    }
                  }}
                  className="text-primary hover:underline text-xs font-mono"
                >
                  {selectedModIds.size === availableMods.length ? "Снять все" : "Выбрать все"}
                </button>
              </div>

              {availableMods.length === 0 ? (
                <div className="p-8 text-center text-muted border border-dashed border-border text-xs">
                  Для выбранной комбинации версий нет доступных модов в каталоге. Попробуйте выбрать другие категории или загрузчик.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[48vh] overflow-y-auto pr-1 custom-scrollbar">
                  {availableMods.map(mod => {
                    const isChecked = selectedModIds.has(mod.id);
                    return (
                      <div
                        key={mod.id}
                        onClick={() => toggleMod(mod.id)}
                        className={`p-3 brutalist-border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isChecked ? "bg-card border-primary/50" : "bg-background border-border/60 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`w-4 h-4 rounded-none border-2 flex items-center justify-center shrink-0 ${
                            isChecked ? "border-primary bg-primary text-background" : "border-muted"
                          }`}>
                            {isChecked && <Check size={10} className="stroke-[3]" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-white">{mod.name}</span>
                              {mod.isCore && (
                                <span className="text-[9px] px-1 bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                                  CORE
                                </span>
                              )}
                              <span className="text-[10px] text-muted font-mono">{mod.id}</span>
                            </div>
                            <p className="text-[11px] text-muted truncate mt-0.5">{mod.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="p-3 bg-background brutalist-border flex items-center gap-2 text-xs text-muted">
                <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                <span>Все необходимые библиотеки (Fabric API, Architectury, Curios, Cloth Config и др.) будут добавлены и установлены автоматически.</span>
              </div>
            </div>
          )}

          {/* STEP 4: Building in progress */}
          {step === 4 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 gap-6 text-center">
              <div className="w-16 h-16 rounded-none bg-primary/10 border-2 border-primary flex items-center justify-center text-primary animate-pulse">
                <Wand2 size={32} />
              </div>

              <div>
                <h3 className="text-base font-bold text-white tracking-wide">Генерация сборки...</h3>
                <p className="text-xs text-muted mt-1 font-mono">{progress.message}</p>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-md bg-background brutalist-border p-1">
                <div 
                  className="h-3 bg-primary transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-muted">
                <span>Прогресс: {percent}%</span>
                <span>•</span>
                <span>Файлов: {progress.current} / {progress.total}</span>
              </div>
            </div>
          )}

          {/* STEP 5: Success screen */}
          {step === 5 && createdInstance && (
            <div className="flex flex-col items-center justify-center py-8 px-4 gap-6 text-center">
              <div className="w-16 h-16 rounded-none bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white tracking-wide">Сборка успешно готова!</h3>
                <p className="text-xs text-muted mt-1 font-mono">
                  Инстанс <strong>{createdInstance.name}</strong> создан с {selectedModIds.size} модами и всеми зависимостями.
                </p>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={() => {
                    onInstanceCreated(createdInstance.id);
                    onClose();
                  }}
                  className="px-6 py-2.5 bg-primary text-background font-bold text-xs uppercase brutalist-border hover:bg-primary-hover transition-colors flex items-center gap-2"
                >
                  <Play size={14} /> Выбрать и играть
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-card text-white font-bold text-xs uppercase brutalist-border hover:bg-card-hover transition-colors"
                >
                  Закрыть
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation Buttons */}
        {step <= 3 && (
          <div className="h-16 px-6 bg-background border-t border-border flex items-center justify-between shrink-0">
            {step > 1 ? (
              <button
                onClick={() => setStep(prev => (prev - 1) as 1 | 2 | 3)}
                className="px-4 py-2 bg-card brutalist-border text-xs font-bold text-white hover:bg-card-hover transition-colors flex items-center gap-1.5"
              >
                <ChevronLeft size={14} /> Назад
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                onClick={() => {
                  if (step === 1 && !packName.trim()) {
                    toast.error("Введите название сборки");
                    return;
                  }
                  if (step === 2 && selectedCategories.length === 0) {
                    toast.error("Выберите хотя бы одну тематику");
                    return;
                  }
                  setStep(prev => (prev + 1) as 2 | 3);
                }}
                className="px-5 py-2 bg-primary text-background brutalist-border text-xs font-bold hover:bg-primary-hover transition-colors flex items-center gap-1.5"
              >
                Далее <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleStartBuild}
                className="px-6 py-2.5 bg-primary text-background brutalist-border text-xs font-bold hover:bg-primary-hover transition-colors flex items-center gap-2"
              >
                <Wand2 size={14} /> Собрать сборку ({selectedModIds.size})
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
