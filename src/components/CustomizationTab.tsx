import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { 
  THEMES, 
  ACCENT_COLORS, 
  MASCOT_PRESETS, 
  WALLPAPER_PRESETS,
  CORNER_RADIUS_OPTIONS,
  GLASS_OPTIONS,
  FONT_OPTIONS,
  GLOW_OPTIONS,
  BUTTON_STYLE_OPTIONS,
  BG_EFFECT_OPTIONS,
  MASCOT_MODE_OPTIONS,
  generateRandomThemeConfig,
  exportThemeToJSON,
  importThemeFromJSON 
} from "../lib/theme";
import { playUiClick } from "../lib/audio";
import { toast } from "./Toast";
import { 
  Sun, Palette, Image as ImageIcon, Smile, Trash2, Check, Sparkles, Sliders, 
  RotateCcw, Upload, Dices, Share2, Download, Volume2, VolumeX, Layers, Type, 
  Square, Play, Eye, SlidersHorizontal
} from "lucide-react";

export interface AppSettingsCustomizationProps {
  settings: any;
  updateSetting: (key: any, value: any) => void;
  updateSettingsBatch: (partial: any) => void;
}

export default function CustomizationTab({ settings, updateSetting, updateSettingsBatch }: AppSettingsCustomizationProps) {
  const [subTab, setSubTab] = useState<"themes" | "wallpaper" | "mascot" | "ui">("themes");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");

  const handleSelectBgImage = async () => {
    try {
      playUiClick("click");
      const selected = await open({
        multiple: false,
        filters: [{ name: "Изображение", extensions: ["png", "jpg", "jpeg", "webp"] }]
      });
      if (selected && typeof selected === "string") {
        updateSetting("custom_bg_path", selected);
        playUiClick("chime");
        toast.success("Фоновое изображение установлено");
      }
    } catch (e) {
      console.error("Failed to pick background image", e);
    }
  };

  const handleSelectMascotImage = async () => {
    try {
      playUiClick("click");
      const selected = await open({
        multiple: false,
        filters: [{ name: "Изображение", extensions: ["png", "jpg", "jpeg", "webp"] }]
      });
      if (selected && typeof selected === "string") {
        updateSettingsBatch({
          custom_mascot_path: selected,
          mascot_preset: "custom"
        });
        playUiClick("chime");
        toast.success("Пользовательский аватар установлен");
      }
    } catch (e) {
      console.error("Failed to pick mascot image", e);
    }
  };

  const handleRandomize = () => {
    playUiClick("dice");
    const randomConfig = generateRandomThemeConfig();
    updateSettingsBatch(randomConfig);
    toast.success("🎲 Случайный стиль оформления применён!");
  };

  const handleExport = () => {
    try {
      const json = exportThemeToJSON(settings);
      navigator.clipboard.writeText(json);
      playUiClick("chime");
      toast.success("📋 Настройки темы скопированы в буфер обмена!");
    } catch (e) {
      toast.error("Не удалось скопировать тему: " + e);
    }
  };

  const handleImportSubmit = () => {
    if (!importJsonText.trim()) return;
    const parsed = importThemeFromJSON(importJsonText);
    if (!parsed || Object.keys(parsed).length === 0) {
      toast.error("Некорректный формат JSON темы!");
      return;
    }
    playUiClick("chime");
    updateSettingsBatch(parsed);
    setIsImportModalOpen(false);
    setImportJsonText("");
    toast.success("📥 Тема успешно импортирована!");
  };

  const handleResetToDefault = () => {
    playUiClick("click");
    updateSettingsBatch({
      theme: "dark",
      accent_color: "#F55E1D",
      accent_glow_intensity: "medium",
      button_style: "gradient",
      custom_bg_path: "",
      custom_bg_opacity: 50,
      custom_bg_blur: 0,
      custom_bg_dim: 0,
      bg_effect: "none",
      mascot_preset: "clasped",
      custom_mascot_path: "",
      mascot_mode: "full",
      mascot_quote: "Больше, чем просто игра",
      mascot_bounce: true,
      ui_corner_radius: "default",
      ui_glassmorphism: "balanced",
      ui_font: "default",
      sound_effects: true,
      sound_volume: 70,
      custom_theme_bg: "",
      custom_theme_card: "",
      custom_theme_border: "",
      custom_theme_text: "",
    });
    toast.info("Все параметры оформления сброшены по умолчанию");
  };

  // Preview properties calculation
  const currentAccent = settings.accent_color || "#F55E1D";
  const currentTheme = THEMES.find(t => t.id === (settings.theme || "dark")) || THEMES[0];
  const isCustomTheme = settings.theme === "custom";

  const previewBgColor = isCustomTheme && settings.custom_theme_bg ? settings.custom_theme_bg : currentTheme.previewBg;
  const previewCardColor = isCustomTheme && settings.custom_theme_card ? settings.custom_theme_card : currentTheme.previewCard;
  const previewBorderColor = isCustomTheme && settings.custom_theme_border ? settings.custom_theme_border : currentTheme.previewBorder;
  const previewTextColor = isCustomTheme && settings.custom_theme_text ? settings.custom_theme_text : currentTheme.previewText;

  let previewMascotSrc = "/pandas_png/clasped.png";
  if (settings.custom_mascot_path) {
    previewMascotSrc = convertFileSrc(settings.custom_mascot_path);
  } else if (settings.mascot_preset && settings.mascot_preset !== "default" && settings.mascot_preset !== "logo") {
    previewMascotSrc = `/pandas_png/${settings.mascot_preset}.png`;
  } else if (settings.mascot_preset === "logo") {
    previewMascotSrc = "/logo.png";
  }

  const radiusValues: Record<string, string> = {
    sharp: "0px",
    default: "4px",
    rounded: "8px",
    pill: "14px",
  };
  const previewRadius = radiusValues[settings.ui_corner_radius || "default"] || "4px";

  const glowShadows: Record<string, string> = {
    none: "none",
    low: `0 2px 8px ${currentAccent}40`,
    medium: `0 4px 16px ${currentAccent}60`,
    high: `0 0 24px ${currentAccent}90, 0 4px 16px ${currentAccent}60`,
  };
  const previewButtonShadow = glowShadows[settings.accent_glow_intensity || "medium"] || glowShadows.medium;

  return (
    <div className="flex flex-col gap-6">

      {/* TOP ACTION TOOLBAR & QUICK TOOLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#130f0c] border border-[#2d2018] rounded">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRandomize}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-600/30 to-orange-600/30 hover:from-amber-600/50 hover:to-orange-600/50 text-amber-300 border border-amber-500/40 text-xs font-bold font-mono rounded flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(245,158,11,0.15)]"
            title="Случайно подобрать гармоничное оформление"
          >
            <Dices size={14} className="animate-pulse" />
            <span>Рандомайзер</span>
          </button>

          <button
            onClick={handleExport}
            className="px-3 py-1.5 bg-[#1f1712] hover:bg-[#2c2018] text-[#c9b7aa] hover:text-white border border-[#3b2a1f] text-xs font-bold font-mono rounded flex items-center gap-1.5 transition-all"
            title="Скопировать текущие параметры в JSON для передачи другу"
          >
            <Share2 size={13} />
            <span>Экспорт</span>
          </button>

          <button
            onClick={() => {
              playUiClick("click");
              setIsImportModalOpen(true);
            }}
            className="px-3 py-1.5 bg-[#1f1712] hover:bg-[#2c2018] text-[#c9b7aa] hover:text-white border border-[#3b2a1f] text-xs font-bold font-mono rounded flex items-center gap-1.5 transition-all"
            title="Импортировать параметры темы из JSON"
          >
            <Download size={13} />
            <span>Импорт</span>
          </button>
        </div>

        <button
          onClick={handleResetToDefault}
          className="text-xs text-[#8c7769] hover:text-[#f55e1d] flex items-center gap-1.5 font-mono transition-colors"
          title="Сбросить всё к заводским настройкам"
        >
          <RotateCcw size={13} />
          <span>Сбросить всё</span>
        </button>
      </div>

      {/* LIVE MINI PREVIEW CANVAS */}
      <div className="bg-[#120e0b] border border-[#2d2018] rounded p-4 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-primary" />
            <span className="text-xs font-bold tracking-wider uppercase text-muted font-mono">
              Живой интерактивный предпросмотр
            </span>
          </div>
          <span className="text-[10px] font-mono text-muted/70">
            Реагирует мгновенно на любые ползунки и палитры
          </span>
        </div>

        {/* The Mini Screen Mockup */}
        <div 
          className="w-full h-44 rounded-md border relative overflow-hidden flex flex-col transition-all duration-300 shadow-inner"
          style={{
            backgroundColor: previewBgColor,
            borderColor: previewBorderColor,
            color: previewTextColor,
            borderRadius: previewRadius,
          }}
        >
          {/* Mock Background Image/Gradient */}
          {settings.custom_bg_path && (
            <div 
              className="absolute inset-0 bg-cover bg-center pointer-events-none transition-all duration-300"
              style={
                settings.custom_bg_path.startsWith("gradient:")
                  ? {
                      background: settings.custom_bg_path.replace("gradient:", ""),
                      opacity: (settings.custom_bg_opacity ?? 50) / 100,
                      filter: `blur(${Math.min(settings.custom_bg_blur ?? 0, 10)}px)`,
                    }
                  : {
                      backgroundImage: `url("${settings.custom_bg_path.startsWith('/') ? settings.custom_bg_path : convertFileSrc(settings.custom_bg_path)}")`,
                      opacity: (settings.custom_bg_opacity ?? 50) / 100,
                      filter: `blur(${Math.min(settings.custom_bg_blur ?? 0, 10)}px)`,
                    }
              }
            />
          )}

          {/* Dimming layer in preview */}
          {settings.custom_bg_dim && settings.custom_bg_dim > 0 && (
            <div 
              className="absolute inset-0 bg-black pointer-events-none transition-opacity"
              style={{ opacity: settings.custom_bg_dim / 100 }}
            />
          )}

          {/* Background atmosphere effect */}
          {settings.bg_effect && settings.bg_effect !== "none" && (
            <div className={`absolute inset-0 pointer-events-none ${`bg-effect-${settings.bg_effect}`}`} />
          )}

          {/* Mini Header Bar */}
          <div 
            className="h-8 border-b px-3 flex items-center justify-between shrink-0 relative z-10 transition-colors"
            style={{
              backgroundColor: previewCardColor,
              borderColor: previewBorderColor,
            }}
          >
            <div className="flex items-center gap-2">
              <div 
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: currentAccent }}
              />
              <span className="text-[11px] font-bold tracking-wider font-mono">
                RedPanda Deck
              </span>
            </div>
            <div className="flex items-center gap-1.5 opacity-60">
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-red-400/50" />
            </div>
          </div>

          {/* Mini Content Area */}
          <div className="flex-1 p-3 flex items-center justify-between gap-4 relative z-10">
            {/* Instance Card Mockup */}
            <div 
              className="p-2.5 border flex-1 max-w-[240px] flex items-center gap-2.5 transition-all shadow-md"
              style={{
                backgroundColor: previewCardColor,
                borderColor: previewBorderColor,
                borderRadius: previewRadius,
              }}
            >
              <div 
                className="w-9 h-9 flex items-center justify-center shrink-0 font-mono font-bold text-xs"
                style={{
                  backgroundColor: `${currentAccent}25`,
                  color: currentAccent,
                  borderColor: currentAccent,
                  borderRadius: previewRadius,
                }}
              >
                RP
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold truncate">TechnoMagic RPG</div>
                <div className="text-[9px] opacity-70 font-mono">1.20.1 Forge • 142 мода</div>
              </div>
            </div>

            {/* Play Button Mockup */}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div 
                className="px-5 py-2 font-mono font-black text-xs uppercase flex items-center gap-2 cursor-default transition-all"
                style={{
                  backgroundColor: settings.button_style === "outline" ? "rgba(0,0,0,0.5)" : currentAccent,
                  borderColor: settings.button_style === "outline" ? currentAccent : currentAccent,
                  borderWidth: settings.button_style === "outline" ? "2px" : "1px",
                  color: settings.button_style === "outline" ? currentAccent : "#ffffff",
                  boxShadow: previewButtonShadow,
                  borderRadius: previewRadius,
                }}
              >
                <Play size={12} className={settings.button_style === "outline" ? "" : "fill-white"} />
                <span>ИГРАТЬ</span>
              </div>
              <span className="text-[8px] font-mono opacity-60">
                {settings.button_style || "gradient"} / {settings.accent_glow_intensity || "medium"} glow
              </span>
            </div>

            {/* Mascot Mockup */}
            {settings.mascot_mode !== "hidden" && (
              <div className="flex items-center gap-2 shrink-0">
                <img 
                  src={previewMascotSrc} 
                  alt="Mascot preview"
                  className={`w-11 h-11 object-contain drop-shadow ${settings.mascot_bounce ? "animate-bounce" : ""}`}
                />
                {settings.mascot_mode !== "compact" && (
                  <div className="hidden sm:block max-w-[120px] text-[9px] leading-tight font-mono opacity-75 italic truncate">
                    "{settings.mascot_quote || "Больше, чем просто игра"}"
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SUB-TABS NAVIGATION BAR */}
      <div className="flex items-center border-b border-[#33241b] gap-2 pb-1 overflow-x-auto">
        <button
          onClick={() => {
            playUiClick("tab");
            setSubTab("themes");
          }}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-mono font-bold border-b-2 transition-all shrink-0 ${
            subTab === "themes"
              ? "border-primary text-primary bg-primary/10"
              : "border-transparent text-muted hover:text-white"
          }`}
        >
          <Sun size={15} />
          <span>Темы и палитры</span>
        </button>

        <button
          onClick={() => {
            playUiClick("tab");
            setSubTab("wallpaper");
          }}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-mono font-bold border-b-2 transition-all shrink-0 ${
            subTab === "wallpaper"
              ? "border-primary text-primary bg-primary/10"
              : "border-transparent text-muted hover:text-white"
          }`}
        >
          <ImageIcon size={15} />
          <span>Фон и атмосфера</span>
        </button>

        <button
          onClick={() => {
            playUiClick("tab");
            setSubTab("mascot");
          }}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-mono font-bold border-b-2 transition-all shrink-0 ${
            subTab === "mascot"
              ? "border-primary text-primary bg-primary/10"
              : "border-transparent text-muted hover:text-white"
          }`}
        >
          <Smile size={15} />
          <span>Маскот панды</span>
        </button>

        <button
          onClick={() => {
            playUiClick("tab");
            setSubTab("ui");
          }}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-mono font-bold border-b-2 transition-all shrink-0 ${
            subTab === "ui"
              ? "border-primary text-primary bg-primary/10"
              : "border-transparent text-muted hover:text-white"
          }`}
        >
          <SlidersHorizontal size={15} />
          <span>Интерфейс и звуки</span>
        </button>
      </div>

      {/* TAB 1: THEMES & ACCENTS */}
      {subTab === "themes" && (
        <div className="flex flex-col gap-6">

          {/* Preset Themes Grid */}
          <section>
            <div className="mb-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sun size={15} className="text-primary" /> Готовые темы оформления ({THEMES.length})
              </h4>
              <p className="text-[11px] text-muted mt-0.5">
                Комплексные цветовые палитры для всего интерфейса
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {THEMES.map((th) => {
                const isActive = (settings.theme || "dark") === th.id;
                return (
                  <button
                    key={th.id}
                    onClick={() => {
                      playUiClick("click");
                      updateSetting("theme", th.id);
                    }}
                    className={`p-3 brutalist-border text-left flex flex-col gap-2 transition-all relative overflow-hidden group ${
                      isActive
                        ? "bg-[#251b15] border-primary shadow-[0_0_15px_rgba(245,94,29,0.25)] ring-1 ring-primary"
                        : "bg-[#18120e] hover:bg-[#201712] hover:border-[#4d3a2f]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-3.5 h-3.5 rounded-full border border-black/40 shadow shrink-0" 
                          style={{ backgroundColor: th.previewAccent }}
                        />
                        <span className={`text-xs font-bold ${isActive ? "text-primary" : "text-white"}`}>
                          {th.name}
                        </span>
                      </div>
                      {isActive && (
                        <span className="flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/40 rounded">
                          <Check size={10} /> АКТИВНО
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-muted leading-tight line-clamp-2">
                      {th.description}
                    </p>

                    {/* Color Swatch Bar */}
                    <div className="flex h-2 w-full rounded-sm overflow-hidden border border-black/40 mt-0.5">
                      <div className="w-2/5 h-full" style={{ backgroundColor: th.previewBg }} title="Фон" />
                      <div className="w-2/5 h-full" style={{ backgroundColor: th.previewCard }} title="Карточки" />
                      <div className="w-1/5 h-full" style={{ backgroundColor: th.previewAccent }} title="Акцент" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Custom Theme Color Builder (Shown when theme is "custom") */}
          {settings.theme === "custom" && (
            <section className="bg-[#1b1410] border border-primary/50 p-4 rounded flex flex-col gap-4 shadow-[0_0_15px_rgba(245,94,29,0.15)]">
              <div>
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                  <Palette size={15} /> Конструктор своей темы
                </h4>
                <p className="text-[11px] text-muted mt-0.5">
                  Задайте точные цвета для каждого элемента интерфейса лаунчера
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Background color */}
                <div className="p-3 bg-[#130f0c] border border-[#33241b] rounded flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Основной фон</div>
                    <div className="text-[10px] text-muted font-mono">Цвет задней плоскости</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.custom_theme_bg || "#14110f"}
                      onChange={(e) => updateSetting("custom_theme_bg", e.target.value)}
                      className="w-7 h-7 border-0 bg-transparent cursor-pointer rounded p-0"
                    />
                    <input
                      type="text"
                      maxLength={7}
                      value={settings.custom_theme_bg || "#14110f"}
                      onChange={(e) => updateSetting("custom_theme_bg", e.target.value)}
                      className="w-16 bg-[#1f1712] border border-[#3b2a1f] px-1.5 py-1 text-[11px] font-mono text-white text-center rounded uppercase"
                    />
                  </div>
                </div>

                {/* Card / Panel color */}
                <div className="p-3 bg-[#130f0c] border border-[#33241b] rounded flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Карточки и панели</div>
                    <div className="text-[10px] text-muted font-mono">Сайдбары и блоки сборок</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.custom_theme_card || "#1c1511"}
                      onChange={(e) => updateSetting("custom_theme_card", e.target.value)}
                      className="w-7 h-7 border-0 bg-transparent cursor-pointer rounded p-0"
                    />
                    <input
                      type="text"
                      maxLength={7}
                      value={settings.custom_theme_card || "#1c1511"}
                      onChange={(e) => updateSetting("custom_theme_card", e.target.value)}
                      className="w-16 bg-[#1f1712] border border-[#3b2a1f] px-1.5 py-1 text-[11px] font-mono text-white text-center rounded uppercase"
                    />
                  </div>
                </div>

                {/* Border color */}
                <div className="p-3 bg-[#130f0c] border border-[#33241b] rounded flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Рамки и линии</div>
                    <div className="text-[10px] text-muted font-mono">Контуры и разделители</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.custom_theme_border || "#382921"}
                      onChange={(e) => updateSetting("custom_theme_border", e.target.value)}
                      className="w-7 h-7 border-0 bg-transparent cursor-pointer rounded p-0"
                    />
                    <input
                      type="text"
                      maxLength={7}
                      value={settings.custom_theme_border || "#382921"}
                      onChange={(e) => updateSetting("custom_theme_border", e.target.value)}
                      className="w-16 bg-[#1f1712] border border-[#3b2a1f] px-1.5 py-1 text-[11px] font-mono text-white text-center rounded uppercase"
                    />
                  </div>
                </div>

                {/* Text color */}
                <div className="p-3 bg-[#130f0c] border border-[#33241b] rounded flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Цвет текста</div>
                    <div className="text-[10px] text-muted font-mono">Шрифты и надписи</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.custom_theme_text || "#f5ece5"}
                      onChange={(e) => updateSetting("custom_theme_text", e.target.value)}
                      className="w-7 h-7 border-0 bg-transparent cursor-pointer rounded p-0"
                    />
                    <input
                      type="text"
                      maxLength={7}
                      value={settings.custom_theme_text || "#f5ece5"}
                      onChange={(e) => updateSetting("custom_theme_text", e.target.value)}
                      className="w-16 bg-[#1f1712] border border-[#3b2a1f] px-1.5 py-1 text-[11px] font-mono text-white text-center rounded uppercase"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          <hr className="border-[#2d2018]" />

          {/* Accent Color Palette & Custom Picker */}
          <section>
            <div className="mb-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Palette size={15} className="text-primary" /> Акцентный цвет лаунчера
              </h4>
              <p className="text-[11px] text-muted mt-0.5">
                Окрашивает кнопки запуска, подсветку, индикаторы прогресса и активные элементы
              </p>
            </div>

            <div className="bg-[#18120e] border border-[#2d2018] p-4 rounded flex flex-col gap-4">
              {/* Presets Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {ACCENT_COLORS.map((preset) => {
                  const isCurrent = (settings.accent_color || "#F55E1D").toLowerCase() === preset.color.toLowerCase();
                  return (
                    <button
                      key={preset.color}
                      onClick={() => {
                        playUiClick("click");
                        updateSetting("accent_color", preset.color);
                      }}
                      className={`px-2.5 py-2 rounded text-xs font-bold flex items-center justify-between transition-all ${
                        isCurrent
                          ? "ring-2 ring-white scale-102 shadow-lg"
                          : "opacity-85 hover:opacity-100 hover:scale-101"
                      }`}
                      style={{ backgroundColor: preset.color, color: "#0E0F12" }}
                      title={preset.name}
                    >
                      <span className="truncate">{preset.name}</span>
                      {isCurrent && <Check size={12} className="stroke-[3] shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Custom Color Input & Reset */}
              <div className="flex items-center justify-between pt-3 border-t border-[#2d2018] flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted font-medium">Произвольный цвет (HEX):</span>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 border border-[#3b2a1f] bg-[#120e0b] rounded">
                    <input
                      type="color"
                      id="custom_accent_color"
                      value={settings.accent_color || "#F55E1D"}
                      onChange={(e) => updateSetting("accent_color", e.target.value)}
                      className="w-6 h-6 border-0 bg-transparent cursor-pointer rounded p-0"
                    />
                    <input
                      type="text"
                      maxLength={7}
                      value={settings.accent_color || "#F55E1D"}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.startsWith("#") && (val.length === 4 || val.length === 7)) {
                          updateSetting("accent_color", val);
                        }
                      }}
                      className="w-20 bg-transparent text-xs font-mono font-bold text-white uppercase focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    playUiClick("click");
                    updateSetting("accent_color", "#F55E1D");
                  }}
                  className="text-xs text-muted hover:text-primary transition-colors flex items-center gap-1 font-mono"
                  title="Вернуть стандартный RedPanda Orange"
                >
                  <RotateCcw size={12} /> Сбросить на фирменный оранжевый
                </button>
              </div>
            </div>
          </section>

          <hr className="border-[#2d2018]" />

          {/* Glow Intensity and Button Style */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Glow Intensity */}
            <div className="bg-[#18120e] border border-[#2d2018] p-4 rounded flex flex-col gap-3">
              <div>
                <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-primary" /> Интенсивность неонового свечения
                </h5>
                <p className="text-[10px] text-muted mt-0.5">
                  Яркость и радиус свечения вокруг активных кнопок
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {GLOW_OPTIONS.map((opt) => {
                  const isActive = (settings.accent_glow_intensity || "medium") === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        playUiClick("click");
                        updateSetting("accent_glow_intensity", opt.id);
                      }}
                      className={`p-2.5 rounded text-left border transition-all ${
                        isActive
                          ? "text-white shadow"
                          : "bg-[#130e0b] border-[#2d2018] text-muted hover:text-white"
                      }`}
                      style={
                        isActive
                          ? {
                              borderColor: currentAccent,
                              backgroundColor: `${currentAccent}22`,
                              boxShadow: `0 0 10px ${currentAccent}33`,
                            }
                          : {}
                      }
                    >
                      <div className="text-xs font-bold">{opt.name}</div>
                      <div className="text-[10px] opacity-75 mt-0.5 leading-snug">{opt.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Button Style */}
            <div className="bg-[#18120e] border border-[#2d2018] p-4 rounded flex flex-col gap-3">
              <div>
                <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={14} className="text-primary" /> Стиль главных кнопок
                </h5>
                <p className="text-[10px] text-muted mt-0.5">
                  Внешний вид кнопки запуска игры и акцентных действий
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {BUTTON_STYLE_OPTIONS.map((opt) => {
                  const isActive = (settings.button_style || "gradient") === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        playUiClick("click");
                        updateSetting("button_style", opt.id);
                      }}
                      className={`p-2.5 rounded text-left border transition-all ${
                        isActive
                          ? "text-white shadow"
                          : "bg-[#130e0b] border-[#2d2018] text-muted hover:text-white"
                      }`}
                      style={
                        isActive
                          ? {
                              borderColor: currentAccent,
                              backgroundColor: `${currentAccent}22`,
                              boxShadow: `0 0 10px ${currentAccent}33`,
                            }
                          : {}
                      }
                    >
                      <div className="text-xs font-bold">{opt.name}</div>
                      <div className="text-[10px] opacity-75 mt-0.5 leading-snug">{opt.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

        </div>
      )}

      {/* TAB 2: WALLPAPER & ATMOSPHERE */}
      {subTab === "wallpaper" && (
        <div className="flex flex-col gap-6">

          {/* Built-in Wallpapers Presets */}
          <section>
            <div className="mb-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ImageIcon size={15} className="text-primary" /> Атмосферные обои и градиенты
              </h4>
              <p className="text-[11px] text-muted mt-0.5">
                Готовые фоновые темы, оптимизированные для комфортной игры
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Default Theme Background Button */}
              <button
                onClick={() => {
                  playUiClick("click");
                  updateSetting("custom_bg_path", "");
                }}
                className={`p-3 rounded border text-left flex flex-col gap-2 transition-all relative overflow-hidden ${
                  !settings.custom_bg_path
                    ? "bg-[#251b15] border-primary shadow-[0_0_12px_rgba(245,94,29,0.2)] ring-1 ring-primary"
                    : "bg-[#18120e] border-[#2d2018] hover:bg-[#201712]"
                }`}
              >
                {!settings.custom_bg_path && (
                  <span className="absolute top-2 right-2 text-primary">
                    <Check size={14} />
                  </span>
                )}
                <div className="w-full h-16 rounded bg-[#120e0b] border border-[#2d2018] flex items-center justify-center text-muted font-mono text-[10px]">
                  Стандартный
                </div>
                <div>
                  <div className={`text-xs font-bold ${!settings.custom_bg_path ? "text-primary" : "text-white"}`}>
                    Фон темы
                  </div>
                  <div className="text-[10px] text-muted truncate mt-0.5">
                    Оригинальный чистый цвет
                  </div>
                </div>
              </button>

              {WALLPAPER_PRESETS.map((wp) => {
                const isActive = settings.custom_bg_path === wp.url;
                return (
                  <button
                    key={wp.id}
                    onClick={() => {
                      playUiClick("click");
                      updateSettingsBatch({
                        custom_bg_path: wp.url,
                        custom_bg_opacity: wp.opacityDefault ?? 60,
                        custom_bg_blur: wp.blurDefault ?? 0,
                      });
                    }}
                    className={`p-3 rounded border text-left flex flex-col gap-2 transition-all relative overflow-hidden group ${
                      isActive
                        ? "bg-[#251b15] border-primary shadow-[0_0_12px_rgba(245,94,29,0.2)] ring-1 ring-primary"
                        : "bg-[#18120e] border-[#2d2018] hover:bg-[#201712]"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute top-2 right-2 text-primary z-10">
                        <Check size={14} />
                      </span>
                    )}

                    {/* Preview box */}
                    <div 
                      className="w-full h-16 rounded bg-cover bg-center border border-[#2d2018] transition-transform group-hover:scale-102"
                      style={
                        wp.url.startsWith("gradient:")
                          ? { background: wp.url.replace("gradient:", "") }
                          : { backgroundImage: `url("${wp.url}")` }
                      }
                    />

                    <div>
                      <div className={`text-xs font-bold ${isActive ? "text-primary" : "text-white"}`}>
                        {wp.name}
                      </div>
                      <div className="text-[10px] text-muted truncate mt-0.5">
                        {wp.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <hr className="border-[#2d2018]" />

          {/* Custom Image Upload & File Controls */}
          <section className="bg-[#18120e] border border-[#2d2018] p-4 rounded flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Upload size={14} className="text-primary" /> Загрузить собственный файл
                </h4>
                <p className="text-[11px] text-muted mt-0.5">
                  Поддерживаются форматы PNG, JPG, JPEG и WebP любого разрешения
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleSelectBgImage}
                  className="px-3.5 py-1.5 bg-primary text-background font-bold text-xs rounded hover:bg-primary-hover transition-colors flex items-center gap-1.5 shadow"
                >
                  <Upload size={13} />
                  <span>{settings.custom_bg_path ? "Выбрать другой файл" : "Выбрать файл с ПК"}</span>
                </button>

                {settings.custom_bg_path && (
                  <button
                    onClick={() => {
                      playUiClick("click");
                      updateSetting("custom_bg_path", "");
                    }}
                    className="p-1.5 border border-[#3b2a1f] text-muted hover:text-red-400 hover:border-red-400 rounded transition-colors"
                    title="Сбросить фон на стандартный"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Sliders: Opacity, Blur, Dim */}
            {settings.custom_bg_path && (
              <div className="flex flex-col gap-4 pt-4 border-t border-[#2d2018]">
                {/* Opacity */}
                <div>
                  <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                    <span className="text-muted flex items-center gap-1.5">
                      <Sliders size={13} /> Непрозрачность (Opacity):
                    </span>
                    <span className="text-primary font-mono font-bold">{settings.custom_bg_opacity ?? 50}%</span>
                  </div>
                  <input
                    type="range"
                    min="10" max="100" step="5"
                    value={settings.custom_bg_opacity ?? 50}
                    onChange={(e) => updateSetting("custom_bg_opacity", parseInt(e.target.value))}
                    className="w-full accent-primary h-2 bg-[#120e0b] rounded cursor-pointer"
                  />
                </div>

                {/* Blur */}
                <div>
                  <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                    <span className="text-muted flex items-center gap-1.5">
                      <Sparkles size={13} /> Размытие (Blur):
                    </span>
                    <span className="text-primary font-mono font-bold">{settings.custom_bg_blur ?? 0}px</span>
                  </div>
                  <input
                    type="range"
                    min="0" max="25" step="1"
                    value={settings.custom_bg_blur ?? 0}
                    onChange={(e) => updateSetting("custom_bg_blur", parseInt(e.target.value))}
                    className="w-full accent-primary h-2 bg-[#120e0b] rounded cursor-pointer"
                  />
                </div>

                {/* Extra Dimming */}
                <div>
                  <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                    <span className="text-muted flex items-center gap-1.5">
                      <SlidersHorizontal size={13} /> Затемнение фона (Dim):
                    </span>
                    <span className="text-primary font-mono font-bold">{settings.custom_bg_dim ?? 0}%</span>
                  </div>
                  <input
                    type="range"
                    min="0" max="90" step="5"
                    value={settings.custom_bg_dim ?? 0}
                    onChange={(e) => updateSetting("custom_bg_dim", parseInt(e.target.value))}
                    className="w-full accent-primary h-2 bg-[#120e0b] rounded cursor-pointer"
                  />
                </div>
              </div>
            )}
          </section>

          <hr className="border-[#2d2018]" />

          {/* Atmospheric Background Effects */}
          <section>
            <div className="mb-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={15} className="text-primary" /> Специальные эффекты фона
              </h4>
              <p className="text-[11px] text-muted mt-0.5">
                Дополнительные анимированные слои поверх обоев
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {BG_EFFECT_OPTIONS.map((opt) => {
                const isActive = (settings.bg_effect || "none") === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      playUiClick("click");
                      updateSetting("bg_effect", opt.id);
                    }}
                    className={`p-3 rounded border text-left transition-all ${
                      isActive
                        ? "bg-[#251b15] border-primary text-white shadow ring-1 ring-primary"
                        : "bg-[#18120e] border-[#2d2018] text-muted hover:text-white hover:bg-[#201712]"
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.name}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{opt.description}</div>
                  </button>
                );
              })}
            </div>
          </section>

        </div>
      )}

      {/* TAB 3: MASCOT CUSTOMIZATION */}
      {subTab === "mascot" && (
        <div className="flex flex-col gap-6">

          {/* Mascot Modes */}
          <section>
            <div className="mb-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Smile size={15} className="text-primary" /> Режим отображения маскота
              </h4>
              <p className="text-[11px] text-muted mt-0.5">
                Выберите, как персонаж представлен в левой панели лаунчера
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MASCOT_MODE_OPTIONS.map((opt) => {
                const isActive = (settings.mascot_mode || "full") === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      playUiClick("click");
                      updateSetting("mascot_mode", opt.id);
                    }}
                    className={`p-3 rounded border text-left transition-all ${
                      isActive
                        ? "bg-[#251b15] border-primary text-white shadow ring-1 ring-primary"
                        : "bg-[#18120e] border-[#2d2018] text-muted hover:text-white hover:bg-[#201712]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{opt.name}</span>
                      {isActive && <Check size={13} className="text-primary" />}
                    </div>
                    <p className="text-[10px] opacity-70 mt-1">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Mascot Custom Quote & Animation */}
          {settings.mascot_mode !== "hidden" && (
            <section className="bg-[#18120e] border border-[#2d2018] p-4 rounded flex flex-col gap-4">
              {settings.mascot_mode === "full" && (
                <div>
                  <label className="text-xs font-bold text-white uppercase tracking-wider block mb-1">
                    Цитата или девиз маскота:
                  </label>
                  <p className="text-[10px] text-muted mb-2">
                    Этот текст отображается под персонажем в левом меню лаунчера
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={60}
                      value={settings.mascot_quote || "Больше, чем просто игра"}
                      onChange={(e) => updateSetting("mascot_quote", e.target.value)}
                      placeholder="Напишите свой девиз или статус..."
                      className="flex-1 bg-[#120e0b] border border-[#3b2a1f] px-3 py-2 text-xs text-white rounded focus:outline-none focus:border-primary font-mono"
                    />
                    <button
                      onClick={() => updateSetting("mascot_quote", "Больше, чем просто игра")}
                      className="px-3 py-2 text-xs text-muted hover:text-white border border-[#3b2a1f] bg-[#120e0b] rounded font-mono"
                      title="Сбросить на стандартную фразу"
                    >
                      Сброс
                    </button>
                  </div>
                </div>
              )}

              {/* Floating Bounce Animation Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-[#2d2018]">
                <div>
                  <div className="text-xs font-bold text-white">Анимация плавного парения (Bounce)</div>
                  <div className="text-[10px] text-muted">Маскот мягко покачивается и дышит</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.mascot_bounce ?? true}
                    onChange={(e) => {
                      playUiClick("click");
                      updateSetting("mascot_bounce", e.target.checked);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#261d17] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </section>
          )}

          <hr className="border-[#2d2018]" />

          {/* Mascot Poses & Custom Avatar Upload */}
          <section>
            <div className="mb-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Smile size={15} className="text-primary" /> Позы RedPanda и загрузка своего аватара
              </h4>
              <p className="text-[11px] text-muted mt-0.5">
                Выберите готовую позу панды или загрузите собственную картинку
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {MASCOT_PRESETS.map((preset) => {
                const isActive = (settings.mascot_preset || "clasped") === preset.id && !settings.custom_mascot_path;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      playUiClick("click");
                      updateSettingsBatch({
                        mascot_preset: preset.id,
                        custom_mascot_path: ""
                      });
                    }}
                    className={`p-3 rounded border flex flex-col items-center text-center gap-2 transition-all relative group ${
                      isActive
                        ? "bg-[#251b15] border-primary shadow-[0_0_12px_rgba(245,94,29,0.2)] ring-1 ring-primary"
                        : "bg-[#18120e] border-[#2d2018] hover:bg-[#201712]"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute top-2 right-2 text-primary">
                        <Check size={13} />
                      </span>
                    )}
                    <img
                      src={preset.image}
                      alt={preset.name}
                      className="w-12 h-12 object-contain drop-shadow transition-transform group-hover:scale-105"
                    />
                    <div className="w-full">
                      <div className={`text-xs font-bold truncate ${isActive ? "text-primary" : "text-white"}`}>
                        {preset.name}
                      </div>
                      <div className="text-[9px] text-muted truncate mt-0.5">
                        {preset.description}
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Custom Mascot Upload Card */}
              <div
                className={`p-3 rounded border flex flex-col items-center text-center justify-between gap-2 transition-all relative ${
                  settings.custom_mascot_path
                    ? "bg-[#251b15] border-primary shadow-[0_0_12px_rgba(245,94,29,0.2)] ring-1 ring-primary"
                    : "bg-[#18120e] border-[#2d2018] hover:bg-[#201712]"
                }`}
              >
                {settings.custom_mascot_path && (
                  <span className="absolute top-2 right-2 text-primary">
                    <Check size={13} />
                  </span>
                )}
                
                {settings.custom_mascot_path ? (
                  <img
                    src={convertFileSrc(settings.custom_mascot_path)}
                    alt="Custom Avatar"
                    className="w-12 h-12 object-contain rounded drop-shadow"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-[#120e0b] border border-[#2d2018] flex items-center justify-center text-muted">
                    <Upload size={20} />
                  </div>
                )}

                <div className="w-full">
                  <div className="text-xs font-bold truncate text-white">
                    {settings.custom_mascot_path ? "Свой аватар" : "Загрузить свой"}
                  </div>
                  <div className="text-[9px] text-muted truncate mt-0.5">
                    {settings.custom_mascot_path ? "Применён файл" : "PNG / WebP"}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 w-full mt-1">
                  <button
                    onClick={handleSelectMascotImage}
                    className="flex-1 py-1 px-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 text-[10px] font-bold rounded transition-colors truncate"
                  >
                    {settings.custom_mascot_path ? "Заменить" : "Выбрать"}
                  </button>
                  {settings.custom_mascot_path && (
                    <button
                      onClick={() => {
                        playUiClick("click");
                        updateSettingsBatch({
                          custom_mascot_path: "",
                          mascot_preset: "clasped"
                        });
                      }}
                      className="p-1 border border-[#3b2a1f] text-muted hover:text-red-400 hover:border-red-400 rounded transition-colors"
                      title="Сбросить аватар"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

        </div>
      )}

      {/* TAB 4: UI SHAPES, GLASS & SOUNDS */}
      {subTab === "ui" && (
        <div className="flex flex-col gap-6">

          {/* Corner Radius */}
          <section>
            <div className="mb-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Square size={15} className="text-primary" /> Геометрия углов (Border Radius)
              </h4>
              <p className="text-[11px] text-muted mt-0.5">
                Форма карточек, кнопок, модальных окон и полей ввода
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CORNER_RADIUS_OPTIONS.map((opt) => {
                const isActive = (settings.ui_corner_radius || "default") === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      playUiClick("click");
                      updateSetting("ui_corner_radius", opt.id);
                    }}
                    className={`p-3.5 border text-left flex flex-col justify-between gap-3 transition-all ${
                      isActive
                        ? "bg-[#251b15] border-primary text-white shadow ring-1 ring-primary"
                        : "bg-[#18120e] border-[#2d2018] text-muted hover:text-white hover:bg-[#201712]"
                    }`}
                    style={{ borderRadius: opt.value }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{opt.name}</span>
                      {isActive && <Check size={13} className="text-primary" />}
                    </div>
                    {/* Visual box demo of radius */}
                    <div 
                      className="w-full h-8 border border-white/20 bg-white/5 flex items-center justify-center text-[10px] font-mono text-white/60"
                      style={{ borderRadius: opt.value }}
                    >
                      {opt.value}
                    </div>
                    <div className="text-[10px] opacity-70 leading-tight">{opt.description}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <hr className="border-[#2d2018]" />

          {/* Glassmorphism / Transparency */}
          <section>
            <div className="mb-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers size={15} className="text-primary" /> Прозрачность панелей (Glassmorphism)
              </h4>
              <p className="text-[11px] text-muted mt-0.5">
                Степень размытия и прозрачности панелей поверх фонового рисунка
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {GLASS_OPTIONS.map((opt) => {
                const isActive = (settings.ui_glassmorphism || "balanced") === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      playUiClick("click");
                      updateSetting("ui_glassmorphism", opt.id);
                    }}
                    className={`p-3 rounded border text-left transition-all ${
                      isActive
                        ? "bg-[#251b15] border-primary text-white shadow ring-1 ring-primary"
                        : "bg-[#18120e] border-[#2d2018] text-muted hover:text-white hover:bg-[#201712]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{opt.name}</span>
                      {isActive && <Check size={13} className="text-primary" />}
                    </div>
                    <p className="text-[10px] opacity-70 mt-1">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <hr className="border-[#2d2018]" />

          {/* Font Family Selection */}
          <section>
            <div className="mb-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Type size={15} className="text-primary" /> Шрифт интерфейса
              </h4>
              <p className="text-[11px] text-muted mt-0.5">
                Основная типографика кнопок, списков и текстов
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {FONT_OPTIONS.map((opt) => {
                const isActive = (settings.ui_font || "default") === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      playUiClick("click");
                      updateSetting("ui_font", opt.id);
                    }}
                    className={`p-3 rounded border text-left transition-all ${
                      isActive
                        ? "bg-[#251b15] border-primary text-white shadow ring-1 ring-primary"
                        : "bg-[#18120e] border-[#2d2018] text-muted hover:text-white hover:bg-[#201712]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{opt.name}</span>
                      {isActive && <Check size={13} className="text-primary" />}
                    </div>
                    <p className="text-[10px] opacity-70 mt-1">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <hr className="border-[#2d2018]" />

          {/* Procedural Sound Effects Engine */}
          <section className="bg-[#18120e] border border-[#2d2018] p-4 rounded flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  {settings.sound_effects ? <Volume2 size={15} className="text-primary" /> : <VolumeX size={15} className="text-muted" />}
                  Звуковые эффекты интерфейса (UI Sound FX)
                </h4>
                <p className="text-[10px] text-muted mt-0.5">
                  Приятные процедурные отклики на клики кнопок, переключение вкладок и завершение действий
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.sound_effects ?? true}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    updateSetting("sound_effects", checked);
                    if (checked) {
                      playUiClick("toggle_on");
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#261d17] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Volume slider & Test button */}
            {settings.sound_effects && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 border-t border-[#2d2018]">
                <div className="flex-1 w-full sm:max-w-xs">
                  <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                    <span className="text-muted">Громкость звуков:</span>
                    <span className="text-primary font-mono font-bold">{settings.sound_volume ?? 70}%</span>
                  </div>
                  <input
                    type="range"
                    min="10" max="100" step="5"
                    value={settings.sound_volume ?? 70}
                    onChange={(e) => updateSetting("sound_volume", parseInt(e.target.value))}
                    className="w-full accent-primary h-2 bg-[#120e0b] rounded cursor-pointer"
                  />
                </div>

                <button
                  onClick={() => playUiClick("chime")}
                  className="px-3 py-1.5 border border-[#3b2a1f] bg-[#120e0b] hover:bg-[#201813] text-xs font-bold text-white rounded flex items-center gap-1.5 font-mono transition-colors"
                >
                  <Volume2 size={13} className="text-primary" /> Прослушать звук
                </button>
              </div>
            )}
          </section>

        </div>
      )}

      {/* IMPORT JSON MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#1b1511] border border-primary/60 p-5 rounded max-w-lg w-full flex flex-col gap-4 shadow-2xl">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Download size={16} className="text-primary" /> Импорт темы RedPanda
              </h3>
              <p className="text-xs text-muted mt-1">
                Вставьте экспортированный JSON конфигурации темы в поле ниже:
              </p>
            </div>

            <textarea
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='{\n  "app": "RedPanda Launcher",\n  "theme": "cyberpunk",\n  "accent_color": "#00F0FF",\n  ...\n}'
              className="w-full bg-[#120e0b] border border-[#382921] rounded p-2.5 text-xs text-white font-mono focus:outline-none focus:border-primary resize-none custom-scrollbar"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#382921]">
              <button
                onClick={() => {
                  playUiClick("click");
                  setIsImportModalOpen(false);
                }}
                className="px-3 py-1.5 bg-[#251c17] hover:bg-[#33261f] text-muted hover:text-white text-xs font-bold rounded"
              >
                Отмена
              </button>
              <button
                onClick={handleImportSubmit}
                className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-background text-xs font-bold rounded flex items-center gap-1.5 shadow"
              >
                <Check size={14} /> Применить тему
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
