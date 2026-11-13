/**
 * Theme & Deep Customization System for RedPanda Launcher
 * Enables granular control over themes, accent colors, neon glows,
 * glassmorphism, fonts, corner radii, mascots, wallpapers, and effects.
 */

export interface ThemeOption {
  id: string;
  name: string;
  description: string;
  previewBg: string;
  previewAccent: string;
  previewCard: string;
  previewBorder: string;
  previewText: string;
  iconName: "moon" | "sun" | "sparkles" | "zap" | "trees" | "flame" | "snowflake" | "gem" | "terminal" | "palette";
}

export const THEMES: ThemeOption[] = [
  {
    id: "dark",
    name: "Тёмная RedPanda",
    description: "Классический тёплый обсидиановый стиль с фирменным оранжевым акцентом",
    previewBg: "#14110f",
    previewCard: "#231c17",
    previewBorder: "#382921",
    previewAccent: "#F55E1D",
    previewText: "#f5ece5",
    iconName: "moon",
  },
  {
    id: "light",
    name: "Светлая",
    description: "Чистая и контрастная дневная тема в светлых тонах",
    previewBg: "#f4f6fa",
    previewCard: "#ffffff",
    previewBorder: "#d0d7e4",
    previewAccent: "#F55E1D",
    previewText: "#131722",
    iconName: "sun",
  },
  {
    id: "midnight",
    name: "Midnight OLED",
    description: "Глубокий истинный чёрный для OLED экранов с минимальным энергопотреблением",
    previewBg: "#000000",
    previewCard: "#0f0f12",
    previewBorder: "#1e1e24",
    previewAccent: "#F55E1D",
    previewText: "#f0f0f5",
    iconName: "sparkles",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk Neon",
    description: "Футуристичный неоново-синий стиль ночного мегаполиса",
    previewBg: "#080c16",
    previewCard: "#121b30",
    previewBorder: "#1e2c4d",
    previewAccent: "#00F0FF",
    previewText: "#e6efff",
    iconName: "zap",
  },
  {
    id: "emerald",
    name: "Изумрудная тайга",
    description: "Глубокий лесной стиль в духе диких биомов Minecraft",
    previewBg: "#09120c",
    previewCard: "#13271a",
    previewBorder: "#223f2b",
    previewAccent: "#10B981",
    previewText: "#e8f5ec",
    iconName: "trees",
  },
  {
    id: "dracula",
    name: "Вампир Dracula",
    description: "Культовая тёмно-фиолетовая эстетика с неоновым пурпуром",
    previewBg: "#151122",
    previewCard: "#211b33",
    previewBorder: "#382c54",
    previewAccent: "#bd93f9",
    previewText: "#f8f8f2",
    iconName: "flame",
  },
  {
    id: "sunset",
    name: "Кровавый закат",
    description: "Пылающие вечерние бордово-угольные тона с рубиновым свечением",
    previewBg: "#170c0f",
    previewCard: "#261318",
    previewBorder: "#421e26",
    previewAccent: "#ff4757",
    previewText: "#fdf0f0",
    iconName: "flame",
  },
  {
    id: "nord",
    name: "Северный мороз",
    description: "Холодная скандинавская палитра арктических фьордов",
    previewBg: "#0f141c",
    previewCard: "#182230",
    previewBorder: "#26354a",
    previewAccent: "#38bdf8",
    previewText: "#e2e8f0",
    iconName: "snowflake",
  },
  {
    id: "amethyst",
    name: "Аметистовая жеода",
    description: "Мистическая глубина сияющих кристаллов из подземелий",
    previewBg: "#110b1a",
    previewCard: "#1d122d",
    previewBorder: "#321d4f",
    previewAccent: "#c084fc",
    previewText: "#f3e8ff",
    iconName: "gem",
  },
  {
    id: "matrix",
    name: "Matrix Terminal",
    description: "Ретро-хакерский терминал с монохромным ядовито-зеленым фосфором",
    previewBg: "#040905",
    previewCard: "#09140b",
    previewBorder: "#122e17",
    previewAccent: "#22c55e",
    previewText: "#86efac",
    iconName: "terminal",
  },
  {
    id: "custom",
    name: "Свой конструктор",
    description: "Полная свобода: создайте собственную цветовую палитру",
    previewBg: "#181410",
    previewCard: "#241d17",
    previewBorder: "#453328",
    previewAccent: "#F55E1D",
    previewText: "#f5ece5",
    iconName: "palette",
  },
];

export interface MascotPreset {
  id: string;
  name: string;
  description: string;
  image: string;
}

export const MASCOT_PRESETS: MascotPreset[] = [
  {
    id: "clasped",
    name: "Обнимающий лапки",
    description: "Классическая панда",
    image: "/pandas_png/clasped.png",
  },
  {
    id: "standing",
    name: "Страж RedPanda",
    description: "В полной готовности",
    image: "/pandas_png/standing.png",
  },
  {
    id: "mining",
    name: "Шахтёр",
    description: "С алмазной киркой",
    image: "/pandas_png/mining.png",
  },
  {
    id: "reading",
    name: "Учёный",
    description: "С древней книгой",
    image: "/pandas_png/reading.png",
  },
  {
    id: "holographic",
    name: "Голограмма",
    description: "Кибер-проекция",
    image: "/pandas_png/holographic.png",
  },
  {
    id: "joy",
    name: "Радостный",
    description: "Празднует победу",
    image: "/pandas_png/joy.png",
  },
  {
    id: "thinking",
    name: "Задумчивый",
    description: "Планирует постройку",
    image: "/pandas_png/thinking.png",
  },
  {
    id: "waving",
    name: "Приветливый",
    description: "Машет лапкой",
    image: "/pandas_png/waving.png",
  },
  {
    id: "logo",
    name: "Логотип",
    description: "Официальный знак",
    image: "/logo.png",
  },
];

export interface ColorPreset {
  name: string;
  color: string;
}

export const ACCENT_COLORS: ColorPreset[] = [
  { name: "RedPanda Orange", color: "#F55E1D" },
  { name: "Cyber Cyan", color: "#00F0FF" },
  { name: "Neon Pink", color: "#FF0055" },
  { name: "Emerald Green", color: "#10B981" },
  { name: "Deep Purple", color: "#8B5CF6" },
  { name: "Gold Amber", color: "#F59E0B" },
  { name: "Ruby Red", color: "#EF4444" },
  { name: "Electric Blue", color: "#3B82F6" },
  { name: "Acid Lime", color: "#84CC16" },
  { name: "Solar Yellow", color: "#EAB308" },
  { name: "Magenta Rose", color: "#EC4899" },
  { name: "Frost Silver", color: "#94A3B8" },
];

export interface WallpaperPreset {
  id: string;
  name: string;
  description: string;
  url: string;
  blurDefault?: number;
  opacityDefault?: number;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: "sunset_hero",
    name: "Закат над миром",
    description: "Живописные лучи солнца и мягкие облака",
    url: "/hero_sunset.jpg",
    opacityDefault: 60,
    blurDefault: 0,
  },
  {
    id: "bento_catalog",
    name: "Глубокая пещера",
    description: "Таинственные своды и редкие руды",
    url: "/bento_catalogs.jpg",
    opacityDefault: 50,
    blurDefault: 2,
  },
  {
    id: "bento_modpack",
    name: "Инженерная база",
    description: "Механизмы и индустриальный прогресс",
    url: "/bento_modpack.jpg",
    opacityDefault: 50,
    blurDefault: 2,
  },
  {
    id: "cyber_grid",
    name: "Неоновый горизонт",
    description: "Кибер-пространство с градиентным свечением",
    url: "gradient:linear-gradient(135deg, #090a14 0%, #171b36 50%, #05060a 100%)",
    opacityDefault: 75,
    blurDefault: 0,
  },
  {
    id: "amethyst_void",
    name: "Кристальный градиент",
    description: "Глубокий переход между индиго и фиалковым",
    url: "gradient:linear-gradient(135deg, #0b0714 0%, #1f1136 50%, #080410 100%)",
    opacityDefault: 80,
    blurDefault: 0,
  },
  {
    id: "emerald_taiga_grad",
    name: "Лесной туман",
    description: "Хвойная глубина и северные хребты",
    url: "gradient:linear-gradient(135deg, #060e08 0%, #112517 50%, #040905 100%)",
    opacityDefault: 80,
    blurDefault: 0,
  },
];

export interface CornerRadiusOption {
  id: "sharp" | "default" | "rounded" | "pill";
  name: string;
  value: string;
  description: string;
}

export const CORNER_RADIUS_OPTIONS: CornerRadiusOption[] = [
  { id: "sharp", name: "0px (Sharp)", value: "0px", description: "Строгий киберпанк и брутализм без скруглений" },
  { id: "default", name: "4px (Классика)", value: "4px", description: "Оригинальный стиль интерфейса RedPanda" },
  { id: "rounded", name: "8px (Плавный)", value: "8px", description: "Современный сглаженный вид карточек" },
  { id: "pill", name: "14px (Округлый)", value: "14px", description: "Мягкий органичный дизайн" },
];

export interface GlassmorphismOption {
  id: "solid" | "balanced" | "frosted";
  name: string;
  description: string;
}

export const GLASS_OPTIONS: GlassmorphismOption[] = [
  { id: "solid", name: "Плотный (Solid)", description: "Непрозрачные матовые панели с максимальной читаемостью" },
  { id: "balanced", name: "Сбалансированный", description: "Элегантное полупрозрачное стекло с легким блюром" },
  { id: "frosted", name: "Глубокий Frosted", description: "Выраженный эффект матового морозного стекла Aero Glass" },
];

export interface FontOption {
  id: "default" | "pixel" | "sans";
  name: string;
  description: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { id: "default", name: "JetBrains + Space Grotesk", description: "Фирменный технологичный стиль" },
  { id: "pixel", name: "Minecraft Pixel", description: "Ностальгический пиксельный шрифт блоков" },
  { id: "sans", name: "Inter / Clean Sans", description: "Чистый современный интерфейсный шрифт" },
];

export interface GlowOption {
  id: "none" | "low" | "medium" | "high";
  name: string;
  description: string;
}

export const GLOW_OPTIONS: GlowOption[] = [
  { id: "none", name: "Без свечения", description: "Минималистичный матовый стиль без неоновых ореолов" },
  { id: "low", name: "Мягкое", description: "Едва заметный деликатный акцент" },
  { id: "medium", name: "Классическое", description: "Фирменное свечение RedPanda Launcher" },
  { id: "high", name: "Ультра-неон", description: "Яркие киберпанковые лучи и выразительный фокус" },
];

export interface ButtonStyleOption {
  id: "gradient" | "solid" | "outline";
  name: string;
  description: string;
}

export const BUTTON_STYLE_OPTIONS: ButtonStyleOption[] = [
  { id: "gradient", name: "Градиент", description: "Объемный градиент с сочным переливом" },
  { id: "solid", name: "Монохром", description: "Строгий сплошной цвет без переходов" },
  { id: "outline", name: "Контурный неон", description: "Полупрозрачное тело и яркая светящаяся рамка" },
];

export interface BgEffectOption {
  id: "none" | "grid" | "particles" | "scanlines";
  name: string;
  description: string;
}

export const BG_EFFECT_OPTIONS: BgEffectOption[] = [
  { id: "none", name: "Без эффектов", description: "Чистое изображение или цветной фон" },
  { id: "grid", name: "Кибер-сетка", description: "Анимированная голографическая координатная сетка" },
  { id: "particles", name: "Споры пыли", description: "Парящие атмосферные световые частицы" },
  { id: "scanlines", name: "CRT монитор", description: "Ретро-полосы кинескопного терминала" },
];

export interface MascotModeOption {
  id: "full" | "compact" | "hidden";
  name: string;
  description: string;
}

export const MASCOT_MODE_OPTIONS: MascotModeOption[] = [
  { id: "full", name: "С цитатой", description: "Маскот с интерактивной цитатой или вашим статусом" },
  { id: "compact", name: "Компактный", description: "Только миниатюра маскота без текста" },
  { id: "hidden", name: "Скрыть", description: "Убрать карточку маскота для максимального пространства" },
];

/**
 * Applies custom accent color variables to root document
 */
export const applyAccentColor = (hex: string, glowIntensity: string = "medium") => {
  if (!hex || !hex.startsWith("#") || hex.length !== 7) return;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return;

  const rHover = Math.min(255, Math.round(r * 1.15 + 15));
  const gHover = Math.min(255, Math.round(g * 1.15 + 15));
  const bHover = Math.min(255, Math.round(b * 1.15 + 15));
  const hexHover = `#${rHover.toString(16).padStart(2, "0")}${gHover.toString(16).padStart(2, "0")}${bHover.toString(16).padStart(2, "0")}`;

  let glowAlpha = 0.32;
  let glowSpread = 16;
  if (glowIntensity === "none") {
    glowAlpha = 0;
    glowSpread = 0;
  } else if (glowIntensity === "low") {
    glowAlpha = 0.16;
    glowSpread = 8;
  } else if (glowIntensity === "high") {
    glowAlpha = 0.65;
    glowSpread = 26;
  }

  const rgbaGlow = `rgba(${r}, ${g}, ${b}, ${glowAlpha})`;

  const root = document.documentElement;
  root.style.setProperty("--color-primary", hex);
  root.style.setProperty("--color-primary-hover", hexHover);
  root.style.setProperty("--color-primary-glow", rgbaGlow);
  root.style.setProperty("--rp-orange", hex);
  root.style.setProperty("--rp-orange-hover", hexHover);
  root.style.setProperty("--rp-orange-glow", rgbaGlow);
  root.style.setProperty("--rp-accent-amber", hexHover);
  root.style.setProperty("--rp-glow-spread", `${glowSpread}px`);
  root.style.setProperty("--rp-glow-alpha", `${glowAlpha}`);
};

/**
 * Full engine function applying all customization settings across the entire DOM
 */
export const applyFullTheme = (settings: {
  theme?: string;
  accent_color?: string;
  accent_glow_intensity?: string;
  button_style?: string;
  ui_corner_radius?: string;
  ui_glassmorphism?: string;
  ui_font?: string;
  custom_theme_bg?: string;
  custom_theme_card?: string;
  custom_theme_border?: string;
  custom_theme_text?: string;
}) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // 1. Theme Attribute
  const theme = settings.theme || "dark";
  root.setAttribute("data-theme", theme);

  // 2. Custom Theme Overrides (if in custom theme mode)
  if (theme === "custom") {
    if (settings.custom_theme_bg) {
      root.style.setProperty("--rp-bg", settings.custom_theme_bg);
      root.style.setProperty("--color-bg", settings.custom_theme_bg);
    }
    if (settings.custom_theme_card) {
      root.style.setProperty("--rp-panel", settings.custom_theme_card);
      root.style.setProperty("--rp-panel-card", settings.custom_theme_card);
      root.style.setProperty("--color-card", settings.custom_theme_card);
    }
    if (settings.custom_theme_border) {
      root.style.setProperty("--rp-border", settings.custom_theme_border);
      root.style.setProperty("--color-border", settings.custom_theme_border);
    }
    if (settings.custom_theme_text) {
      root.style.setProperty("--rp-text-main", settings.custom_theme_text);
      root.style.setProperty("--color-text", settings.custom_theme_text);
    }
  } else {
    // Clean inline theme variable overrides
    root.style.removeProperty("--rp-bg");
    root.style.removeProperty("--color-bg");
    root.style.removeProperty("--rp-panel");
    root.style.removeProperty("--rp-panel-card");
    root.style.removeProperty("--color-card");
    root.style.removeProperty("--rp-border");
    root.style.removeProperty("--color-border");
    root.style.removeProperty("--rp-text-main");
    root.style.removeProperty("--color-text");
  }

  // 3. Accent Color and Glow
  applyAccentColor(settings.accent_color || "#F55E1D", settings.accent_glow_intensity || "medium");

  // 4. Corner Radius
  const radiusMap: Record<string, string> = {
    sharp: "0px",
    default: "4px",
    rounded: "8px",
    pill: "14px",
  };
  const radius = radiusMap[settings.ui_corner_radius || "default"] || "4px";
  root.style.setProperty("--rp-radius", radius);
  root.setAttribute("data-radius", settings.ui_corner_radius || "default");

  // 5. Glassmorphism
  root.setAttribute("data-glass", settings.ui_glassmorphism || "balanced");

  // 6. Font Style
  root.setAttribute("data-font", settings.ui_font || "default");

  // 7. Button Style
  root.setAttribute("data-button-style", settings.button_style || "gradient");
};

/**
 * Generate a harmonious randomized theme configuration
 */
export function generateRandomThemeConfig() {
  const themesWithoutCustom = THEMES.filter(t => t.id !== "custom");
  const randomTheme = themesWithoutCustom[Math.floor(Math.random() * themesWithoutCustom.length)];
  const randomAccent = ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
  const randomRadius = CORNER_RADIUS_OPTIONS[Math.floor(Math.random() * CORNER_RADIUS_OPTIONS.length)].id;
  const randomGlass = GLASS_OPTIONS[Math.floor(Math.random() * GLASS_OPTIONS.length)].id;
  const randomGlow = GLOW_OPTIONS[Math.floor(Math.random() * GLOW_OPTIONS.length)].id;
  const randomMascot = MASCOT_PRESETS[Math.floor(Math.random() * MASCOT_PRESETS.length)].id;

  return {
    theme: randomTheme.id,
    accent_color: randomAccent.color,
    ui_corner_radius: randomRadius,
    ui_glassmorphism: randomGlass,
    accent_glow_intensity: randomGlow,
    mascot_preset: randomMascot,
  };
}

/**
 * Export theme bundle as a clean shareable JSON string
 */
export function exportThemeToJSON(settings: any): string {
  const exportPayload = {
    app: "RedPanda Launcher",
    version: "1.0",
    theme: settings.theme || "dark",
    accent_color: settings.accent_color || "#F55E1D",
    accent_glow_intensity: settings.accent_glow_intensity || "medium",
    button_style: settings.button_style || "gradient",
    ui_corner_radius: settings.ui_corner_radius || "default",
    ui_glassmorphism: settings.ui_glassmorphism || "balanced",
    ui_font: settings.ui_font || "default",
    custom_bg_dim: settings.custom_bg_dim ?? 0,
    bg_effect: settings.bg_effect || "none",
    mascot_preset: settings.mascot_preset || "clasped",
    mascot_mode: settings.mascot_mode || "full",
    mascot_quote: settings.mascot_quote || "Больше, чем просто игра",
    mascot_bounce: settings.mascot_bounce ?? true,
    custom_theme_bg: settings.custom_theme_bg || "",
    custom_theme_card: settings.custom_theme_card || "",
    custom_theme_border: settings.custom_theme_border || "",
    custom_theme_text: settings.custom_theme_text || "",
  };
  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Parse and validate an imported theme JSON
 */
export function importThemeFromJSON(jsonString: string): Record<string, any> | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== "object") return null;
    const allowedKeys = [
      "theme", "accent_color", "accent_glow_intensity", "button_style",
      "ui_corner_radius", "ui_glassmorphism", "ui_font", "custom_bg_dim",
      "bg_effect", "mascot_preset", "mascot_mode", "mascot_quote",
      "mascot_bounce", "custom_theme_bg", "custom_theme_card",
      "custom_theme_border", "custom_theme_text"
    ];
    const filtered: Record<string, any> = {};
    for (const key of allowedKeys) {
      if (key in parsed) {
        filtered[key] = parsed[key];
      }
    }
    return filtered;
  } catch {
    return null;
  }
}
