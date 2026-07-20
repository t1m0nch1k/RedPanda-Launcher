import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Cpu, Monitor, Code, Coffee, ExternalLink, RefreshCw, Settings, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AppSettings {
  java_path: string;
  min_memory: number;
  max_memory: number;
  window_width: number;
  window_height: number;
  fullscreen: boolean;
  jvm_args: string;
  instances_sort_mode: string;
  launch_behavior: string;
  show_console: boolean;
  aggressive_optimization: boolean;
  show_snapshots: boolean;
}

interface JavaInstallation {
  path: string;
  version: string;
  vendor: string;
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [javas, setJavas] = useState<JavaInstallation[]>([]);
  const [isSearchingJava, setIsSearchingJava] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "java">("general");

  useEffect(() => {
    loadSettings();
    searchJava();
  }, []);

  const loadSettings = async () => {
    try {
      const data: AppSettings = await invoke("get_settings");
      setSettings(data);
    } catch (e) {
      console.error("Failed to load settings", e);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      await invoke("save_settings", { settings: newSettings });
      setSettings(newSettings);
    } catch (e) {
      console.error("Failed to save settings", e);
    }
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (!settings) return;
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const searchJava = async () => {
    setIsSearchingJava(true);
    try {
      const installations: JavaInstallation[] = await invoke("find_java_installations");
      setJavas(installations);
    } catch (e) {
      console.error("Failed to find Java", e);
    }
    setIsSearchingJava(false);
  };

  if (!settings) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-background/50">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <SettingsIcon size={24} className="text-primary" />
            {t("settings.title")}
          </h2>
          <button onClick={onClose} className="p-2 text-muted hover:text-white hover:bg-card rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 bg-background border-r border-border p-4 flex flex-col gap-2">
            <button 
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                activeTab === "general" ? "bg-primary/20 text-primary" : "text-muted hover:text-white hover:bg-card"
              }`}
            >
              <Monitor size={18} />
              {t("settings.tab_general", "General")}
            </button>
            <button 
              onClick={() => setActiveTab("java")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                activeTab === "java" ? "bg-primary/20 text-primary" : "text-muted hover:text-white hover:bg-card"
              }`}
            >
              <Coffee size={18} />
              {t("settings.tab_java", "Java & RAM")}
            </button>
          </div>

          {/* Main Panel */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-card">
            
            {activeTab === "general" && (
              <div className="flex flex-col gap-8">
                
                {/* Language */}
                <section>
                  <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Globe size={16} /> {t("settings.language")}
                  </h3>
                  
                  <div className="flex flex-col gap-3 mb-4">
                    <select 
                      value={i18n.language}
                      onChange={(e) => i18n.changeLanguage(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="ru">Русский</option>
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="zh">中文</option>
                    </select>
                  </div>
                </section>

                <hr className="border-border" />

                {/* Launcher Behavior */}
                <section>
                  <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                    <SettingsIcon size={16} /> {t("settings.launch_behavior")}
                  </h3>
                  
                  <div className="flex flex-col gap-3 mb-4">
                    <select 
                      value={settings.launch_behavior}
                      onChange={(e) => updateSetting("launch_behavior", e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="hide">{t("settings.behavior_hide")}</option>
                      <option value="close">{t("settings.behavior_close")}</option>
                      <option value="keep_open">{t("settings.behavior_keep")}</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <label className="text-xs text-muted block">{t("settings.instances_sort")}:</label>
                    <select 
                      value={settings.instances_sort_mode}
                      onChange={(e) => updateSetting("instances_sort_mode", e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="last_played">{t("settings.sort_last_played")}</option>
                      <option value="name">{t("settings.sort_alphabetical")}</option>
                    </select>
                  </div>
                </section>

                <hr className="border-border" />

                {/* Resolution */}
                <section>
                  <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Monitor size={16} /> {t("settings.window_width")} / {t("settings.window_height")}
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs text-muted mb-2 block">{t("settings.window_width")}</label>
                      <input 
                        type="number" 
                        value={settings.window_width}
                        onChange={(e) => updateSetting("window_width", parseInt(e.target.value) || 854)}
                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted mb-2 block">{t("settings.window_height")}</label>
                      <input 
                        type="number" 
                        value={settings.window_height}
                        onChange={(e) => updateSetting("window_height", parseInt(e.target.value) || 480)}
                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-10 h-5 rounded-full p-1 transition-colors ${settings.fullscreen ? 'bg-primary' : 'bg-background border border-border'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full transition-transform ${settings.fullscreen ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </div>
                    <span className="text-sm font-medium group-hover:text-white transition-colors text-white/80">{t("settings.fullscreen")}</span>
                  </label>
                </section>

                <hr className="border-border" />

                {/* JVM Args */}
                <section>
                  <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Code size={16} /> {t("settings.jvm_args")}
                  </h3>
                  <textarea 
                    value={settings.jvm_args}
                    onChange={(e) => updateSetting("jvm_args", e.target.value)}
                    rows={4}
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-white/80 focus:outline-none focus:border-primary transition-colors resize-none font-mono"
                    placeholder="-Xmx4G -XX:+UseG1GC..."
                  />
                  <p className="text-xs text-muted mt-2">Переопределяет стандартные параметры виртуальной машины Java.</p>
                </section>
              </div>
            )}

            {activeTab === "java" && (
              <div className="flex flex-col gap-8">
                
                {/* RAM */}
                <section>
                  <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Cpu size={16} /> {t("settings.min_ram")} & {t("settings.max_ram")}
                  </h3>
                  <div className="bg-background border border-border rounded-xl p-5 flex flex-col gap-4">
                    <div className="flex justify-between items-center text-sm font-medium">
                      <span className="text-muted">{t("settings.min_ram")}:</span>
                      <span className="text-primary">{settings.min_memory} MB</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="16384" step="256"
                      value={settings.min_memory}
                      onChange={(e) => updateSetting("min_memory", Math.max(512, Math.min(parseInt(e.target.value), settings.max_memory)))}
                      className="w-full accent-primary h-2 bg-card rounded-lg appearance-none cursor-pointer"
                    />
                    
                    <div className="flex justify-between items-center text-sm font-medium mt-2">
                      <span className="text-muted">{t("settings.max_ram")}:</span>
                      <span className="text-primary">{settings.max_memory} MB</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="16384" step="512"
                      value={settings.max_memory}
                      onChange={(e) => updateSetting("max_memory", Math.max(1024, Math.max(parseInt(e.target.value), settings.min_memory)))}
                      className="w-full accent-primary h-2 bg-card rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="relative text-xs text-muted h-4 mt-1">
                      <span className="absolute left-[6.25%]" style={{ transform: 'translateX(-50%)' }}>1 GB</span>
                      <span className="absolute left-[50%]" style={{ transform: 'translateX(-50%)' }}>8 GB</span>
                      <span className="absolute right-0">16 GB</span>
                    </div>
                  </div>

                  <div className="mt-6 flex items-start gap-3">
                    <div className="flex items-center h-5">
                      <input
                        id="aggressive_optimization"
                        type="checkbox"
                        checked={settings.aggressive_optimization}
                        onChange={(e) => updateSetting("aggressive_optimization", e.target.checked)}
                        className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-background"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="aggressive_optimization" className="text-sm font-medium text-white cursor-pointer">
                        {t("settings.aggressive_opt")}
                      </label>
                      <p className="text-[10px] text-muted mt-0.5">
                        Автоматически подбирает лучшие аргументы Java (ZGC/Shenandoah) в зависимости от ОЗУ и задает процессу игры высокий приоритет в Windows.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-start gap-3">
                    <div className="flex items-center h-5">
                      <input
                        id="show_snapshots"
                        type="checkbox"
                        checked={settings.show_snapshots}
                        onChange={(e) => updateSetting("show_snapshots", e.target.checked)}
                        className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-background"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="show_snapshots" className="text-sm font-medium text-white cursor-pointer">
                        {t("settings.show_snapshots", "Показывать снапшоты (Snapshots, Alpha, Beta)")}
                      </label>
                      <p className="text-[10px] text-muted mt-0.5">
                        {t("settings.show_snapshots_desc", "Отображать тестовые и старые версии Minecraft при создании сборок.")}
                      </p>
                    </div>
                  </div>
                </section>

                <hr className="border-border" />

                {/* Java Path */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                      <Coffee size={16} /> {t("settings.select_java")}
                    </h3>
                    <button 
                      onClick={searchJava}
                      disabled={isSearchingJava}
                      className="text-xs flex items-center gap-1 text-primary hover:text-primary-hover disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={isSearchingJava ? "animate-spin" : ""} /> Обновить
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-3 mb-4">
                    <label 
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                        settings.java_path === "" ? "border-primary bg-primary/5" : "border-border bg-background hover:border-border/80"
                      }`}
                      onClick={() => updateSetting("java_path", "")}
                    >
                      <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        settings.java_path === "" ? "border-primary" : "border-muted"
                      }`}>
                        {settings.java_path === "" && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{t("settings.java_path")}</div>
                      </div>
                    </label>

                    {javas.map((java, idx) => (
                      <label 
                        key={idx}
                        className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                          settings.java_path === java.path ? "border-primary bg-primary/5" : "border-border bg-background hover:border-border/80"
                        }`}
                        onClick={() => updateSetting("java_path", java.path)}
                      >
                        <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          settings.java_path === java.path ? "border-primary" : "border-muted"
                        }`}>
                          {settings.java_path === java.path && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <div className="overflow-hidden">
                          <div className="font-semibold text-sm truncate">Java {java.version} <span className="text-muted text-xs font-normal">({java.vendor})</span></div>
                          <div className="text-xs text-muted mt-1 truncate">{java.path}</div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {javas.length === 0 && !isSearchingJava && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex flex-col gap-2">
                      <div className="text-sm font-semibold text-red-400">Java не найдена на этом ПК!</div>
                      <p className="text-xs text-white/70">Если вы не хотите использовать "Автоматически", вам нужно установить Java вручную.</p>
                      
                      <div className="flex gap-2 mt-2">
                        <a href="https://adoptium.net/" target="_blank" className="flex items-center gap-1 text-xs bg-card hover:bg-background border border-border rounded px-3 py-1.5 transition-colors">
                          <ExternalLink size={12} /> Temurin (Рекомендуется)
                        </a>
                        <a href="https://www.azul.com/downloads/?package=jdk" target="_blank" className="flex items-center gap-1 text-xs bg-card hover:bg-background border border-border rounded px-3 py-1.5 transition-colors">
                          <ExternalLink size={12} /> Azul Zulu
                        </a>
                      </div>
                    </div>
                  )}

                </section>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// Icon for the header
function SettingsIcon(props: any) {
  return <Settings {...props} />;
}
