export interface CuratedMod {
  id: string; // Modrinth slug
  name: string;
  description: string;
  category: string;
  iconUrl?: string;
  loaders: ("Fabric" | "Forge" | "NeoForge" | "Quilt")[];
  minVersion?: string;
  maxVersion?: string;
  supportedVersions?: string[];
  isCore?: boolean;
  recommended?: boolean;
}

export interface BuilderCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  recommendedByDefault?: boolean;
}

export interface BuilderPreset {
  id: string;
  title: string;
  icon: string;
  subtitle: string;
  badge: string;
  categories: string[];
  recommendedLoader: "Fabric" | "Forge" | "NeoForge";
}

export function parseMcVersion(versionStr: string): { major: number; minor: number; patch: number } {
  const clean = versionStr.split("-")[0].split("+")[0];
  const parts = clean.split(".").map(p => {
    const n = parseInt(p, 10);
    return isNaN(n) ? 0 : n;
  });
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

export function compareMcVersions(a: string, b: string): number {
  const pa = parseMcVersion(a);
  const pb = parseMcVersion(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}

export function isModCompatibleWith(
  mod: CuratedMod,
  gameVersion: string,
  loaderType: "Fabric" | "Forge" | "NeoForge"
): boolean {
  // Check loader
  if (!mod.loaders.includes(loaderType)) {
    return false;
  }

  // If mod explicitly defines supported game versions
  if (mod.supportedVersions && mod.supportedVersions.length > 0) {
    if (mod.supportedVersions.includes(gameVersion)) return true;
    const parts = gameVersion.split(".");
    if (parts.length >= 2) {
      const minor = `${parts[0]}.${parts[1]}`;
      if (mod.supportedVersions.includes(minor)) return true;
    }
    return false;
  }

  // If minVersion is set
  if (mod.minVersion && compareMcVersions(gameVersion, mod.minVersion) < 0) {
    return false;
  }

  // If maxVersion is set
  if (mod.maxVersion && compareMcVersions(gameVersion, mod.maxVersion) > 0) {
    return false;
  }

  return true;
}

export const BUILDER_PRESETS: BuilderPreset[] = [
  {
    id: "vanilla-plus",
    title: "Vanilla+ Оптимизация",
    icon: "⚡",
    subtitle: "Максимальный буст FPS, карта, рецепты и чистый геймплей без багов",
    badge: "Для слабых ПК",
    categories: ["optimization", "qol"],
    recommendedLoader: "Fabric",
  },
  {
    id: "magic-rpg",
    title: "Магия & RPG Приключения",
    icon: "🪄",
    subtitle: "Заклинания, боссы, опасные подземелья, реликвии и комбо-удары мечами",
    badge: "Популярно",
    categories: ["optimization", "qol", "magic", "adventure", "rpg"],
    recommendedLoader: "Fabric",
  },
  {
    id: "tech-create",
    title: "Инженерия & Механизмы",
    icon: "⚙️",
    subtitle: "Поезда Create, автоматизация фабрик, МЭ-сеть AE2 и шестерёнки",
    badge: "Автоматизация",
    categories: ["optimization", "qol", "tech", "worldgen"],
    recommendedLoader: "Fabric",
  },
  {
    id: "world-building",
    title: "Живой мир & Строительство",
    icon: "🏰",
    subtitle: "100+ новых биомов, мебель, мосты, декоративные блоки и таверны",
    badge: "Эстетика",
    categories: ["optimization", "qol", "worldgen", "building"],
    recommendedLoader: "Fabric",
  },
  {
    id: "all-in-one",
    title: "Вселенная RedPanda (All-in-One)",
    icon: "👑",
    subtitle: "Полная мощь: магия, боссы, механизмы, биомы, мебель и RPG-боёвка",
    badge: "Максимум",
    categories: ["optimization", "qol", "magic", "adventure", "tech", "worldgen", "building", "rpg"],
    recommendedLoader: "Fabric",
  },
];

export const BUILDER_CATEGORIES: BuilderCategory[] = [
  {
    id: "optimization",
    name: "Оптимизация & FPS (Core)",
    icon: "⚡",
    description: "Максимальный FPS, плавность и низкое потребление оперативной памяти",
    color: "#10B981",
    recommendedByDefault: true,
  },
  {
    id: "qol",
    name: "Интерфейс & QoL",
    icon: "🎒",
    description: "Миникарта, рецепты крафтов, подсказки о блоках и сортировка",
    color: "#3B82F6",
    recommendedByDefault: true,
  },
  {
    id: "magic",
    name: "Магия & Заклинания",
    icon: "🪄",
    description: "Заклинания, свитки, алхимия, магические книги и мана",
    color: "#8B5CF6",
    recommendedByDefault: false,
  },
  {
    id: "adventure",
    name: "Приключения & Данжи",
    icon: "⚔️",
    description: "Новые опасные подземелья, мобы, боссы, реликвии и структуры",
    color: "#F59E0B",
    recommendedByDefault: true,
  },
  {
    id: "tech",
    name: "Технологии & Автоматизация",
    icon: "⚙️",
    description: "Механизмы, шестерёнки, трубы, автоматические фермы и энергия",
    color: "#6366F1",
    recommendedByDefault: false,
  },
  {
    id: "worldgen",
    name: "Генерация мира & Биомы",
    icon: "🏰",
    description: "Захватывающие реалистичные горы, пещеры, биомы и новые измерения",
    color: "#EC4899",
    recommendedByDefault: true,
  },
  {
    id: "building",
    name: "Строительство & Декор",
    icon: "🏡",
    description: "Сотни блоков мебели, мостов, крыш, фонарей и декоративных деталей",
    color: "#14B8A6",
    recommendedByDefault: false,
  },
  {
    id: "rpg",
    name: "RPG & Боевая система",
    icon: "🗡️",
    description: "Комбо-атаки, прокачка характеристик, мечи со способностями",
    color: "#EF4444",
    recommendedByDefault: false,
  },
];

export const CURATED_MODS: CuratedMod[] = [
  // --- OPTIMIZATION (FABRIC) ---
  {
    id: "fabric-api",
    name: "Fabric API",
    description: "Базовая системная библиотека для всех Fabric модов",
    category: "optimization",
    loaders: ["Fabric", "Quilt"],
    minVersion: "1.14",
    isCore: true,
    recommended: true,
  },
  {
    id: "sodium",
    name: "Sodium",
    description: "Революционный графический движок, увеличивающий FPS в разы",
    category: "optimization",
    loaders: ["Fabric", "Quilt", "NeoForge"],
    minVersion: "1.16.5",
    isCore: true,
    recommended: true,
  },
  {
    id: "indium",
    name: "Indium (FRAPI Bridge)",
    description: "Официальный мост FRAPI для Sodium (необходим для Create, Supplementaries, 3D моделей)",
    category: "optimization",
    loaders: ["Fabric", "Quilt"],
    minVersion: "1.16.5",
    maxVersion: "1.21.1",
    isCore: true,
    recommended: true,
  },
  {
    id: "lithium",
    name: "Lithium",
    description: "Оптимизация физики, мобов и серверного тика игры",
    category: "optimization",
    loaders: ["Fabric", "Quilt", "NeoForge"],
    minVersion: "1.16.5",
    isCore: true,
    recommended: true,
  },
  {
    id: "ferrite-core",
    name: "FerriteCore",
    description: "Снижает потребление оперативной памяти Java до 50%",
    category: "optimization",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.16.5",
    isCore: true,
    recommended: true,
  },
  {
    id: "entityculling",
    name: "Entity Culling",
    description: "Не рендерит мобов и сундуки сквозь стены для экономии ресурсов",
    category: "optimization",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.16.5",
    isCore: true,
    recommended: true,
  },
  {
    id: "immediatelyfast",
    name: "ImmediatelyFast",
    description: "Ускоряет рендеринг текста, инвентарей и частиц",
    category: "optimization",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.18.2",
    isCore: true,
    recommended: true,
  },
  // --- OPTIMIZATION (FORGE) ---
  {
    id: "embeddium",
    name: "Embeddium",
    description: "Высокопроизводительный движок на базе Sodium для Forge и NeoForge",
    category: "optimization",
    loaders: ["Forge", "NeoForge"],
    minVersion: "1.16.5",
    maxVersion: "1.21.1",
    isCore: true,
    recommended: true,
  },

  // --- QOL (QUALITY OF LIFE) ---
  {
    id: "jei",
    name: "Just Enough Items (JEI)",
    description: "Просмотр всех предметов, рецептов и способов их применения",
    category: "qol",
    loaders: ["Fabric", "Forge", "NeoForge"],
    minVersion: "1.12.2",
    recommended: true,
  },
  {
    id: "journeymap",
    name: "JourneyMap",
    description: "Удобная карта мира в реальном времени с метками и радаром",
    category: "qol",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.12.2",
    recommended: true,
  },
  {
    id: "jade",
    name: "Jade",
    description: "Всплывающие информационные подсказки о блоках и мобах при наведении",
    category: "qol",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.16.5",
    recommended: true,
  },
  {
    id: "appleskin",
    name: "AppleSkin",
    description: "Отображение сытости и насыщения еды прямо на полоске голода",
    category: "qol",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.12.2",
    recommended: true,
  },
  {
    id: "mouse-tweaks",
    name: "Mouse Tweaks",
    description: "Быстрое перемещение и перетаскивание предметов мышью",
    category: "qol",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.12.2",
    recommended: true,
  },
  {
    id: "inventory-profiles-next",
    name: "Inventory Profiles Next",
    description: "Сортировка сундуков и инвентаря в один клик",
    category: "qol",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.16.5",
    recommended: false,
  },

  // --- MAGIC ---
  {
    id: "irons-spells-n-spellbooks",
    name: "Iron's Spells 'n Spellbooks",
    description: "Классическая RPG-магия: сотни заклинаний, посохи, свитки и мана",
    category: "magic",
    loaders: ["Forge", "NeoForge"],
    minVersion: "1.18.2",
    maxVersion: "1.21.1",
    recommended: true,
  },
  {
    id: "ars-nouveau",
    name: "Ars Nouveau",
    description: "Создание собственных уникальных заклинаний, ритуалов и фамильяров",
    category: "magic",
    loaders: ["Forge", "NeoForge"],
    minVersion: "1.18.2",
    maxVersion: "1.21.1",
    recommended: true,
  },
  {
    id: "botania",
    name: "Botania",
    description: "Природная магия на основе цветов, маны и мистических механизмов",
    category: "magic",
    loaders: ["Fabric", "Forge", "Quilt"],
    minVersion: "1.16.5",
    maxVersion: "1.20.1",
    recommended: true,
  },
  {
    id: "wizards",
    name: "Wizards (RPG Series)",
    description: "Магические классы волшебников: огонь, холод и тайная магия",
    category: "magic",
    loaders: ["Fabric", "NeoForge"],
    minVersion: "1.19.2",
    recommended: true,
  },
  {
    id: "paladins-and-priests",
    name: "Paladins & Priests (RPG Series)",
    description: "Священная магия света, булавы, паладинские щиты и ауры лечения",
    category: "magic",
    loaders: ["Fabric", "NeoForge"],
    minVersion: "1.19.2",
    recommended: false,
  },
  {
    id: "archon",
    name: "Archon (Arcane Magic)",
    description: "Глубокая магия стихий, призыв молний, ритуалы и гримуары",
    category: "magic",
    loaders: ["Fabric", "Quilt"],
    minVersion: "1.20",
    maxVersion: "1.20.6",
    recommended: false,
  },

  // --- ADVENTURE & DUNGEONS ---
  {
    id: "when-dungeons-arise",
    name: "When Dungeons Arise",
    description: "Огромные летающие корабли, ветряные мельницы и замки с сокровищами",
    category: "adventure",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.16.5",
    maxVersion: "1.20.6",
    recommended: true,
  },
  {
    id: "l_enders-cataclysm",
    name: "L_Ender's Cataclysm",
    description: "Эпические боссы в неизведанных подземельях с уникальными механиками",
    category: "adventure",
    loaders: ["Forge", "NeoForge"],
    minVersion: "1.19.2",
    maxVersion: "1.21.5",
    recommended: true,
  },
  {
    id: "alexs-mobs",
    name: "Alex's Mobs",
    description: "Более 80 уникальных анимированных животных и фантастических существ",
    category: "adventure",
    loaders: ["Forge", "NeoForge"],
    minVersion: "1.16.5",
    maxVersion: "1.20.1",
    recommended: true,
  },
  {
    id: "aquamirae",
    name: "Aquamirae",
    description: "Глубоководные морские приключения, лабиринт льда и жуткие монстры",
    category: "adventure",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.18.2",
    maxVersion: "1.20.1",
    recommended: false,
  },
  {
    id: "dungeons-and-taverns",
    name: "Dungeons and Taverns",
    description: "Атмосферные таверны, форпосты разбойников и подземные лабиринты",
    category: "adventure",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.19.2",
    recommended: true,
  },

  // --- TECH ---
  {
    id: "create",
    name: "Create",
    description: "Шедевры кинетической механики: поезда, ветряки, конвейеры и фабрики",
    category: "tech",
    loaders: ["Fabric", "Forge", "NeoForge"],
    minVersion: "1.18.2",
    maxVersion: "1.20.1",
    recommended: true,
  },
  {
    id: "create-steam-n-rails",
    name: "Create: Steam 'n' Rails",
    description: "Расширение поездов для мода Create: семафоры, развилки и локомотивы",
    category: "tech",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.18.2",
    maxVersion: "1.20.1",
    recommended: false,
  },
  {
    id: "mekanism",
    name: "Mekanism",
    description: "Высокотехнологичные фабрики, переработка руд 5x, реакторы и джетпаки",
    category: "tech",
    loaders: ["Forge", "NeoForge"],
    minVersion: "1.16.5",
    maxVersion: "1.20.4",
    recommended: true,
  },
  {
    id: "ae2",
    name: "Applied Energistics 2",
    description: "Хранение миллионов предметов в цифровой МЭ-сети и автокрафт",
    category: "tech",
    loaders: ["Fabric", "Forge", "NeoForge"],
    minVersion: "1.18.2",
    recommended: true,
  },

  // --- WORLD GEN ---
  {
    id: "terralith",
    name: "Terralith",
    description: "Полная трансформация генерации ванильного мира: 100+ новых биомов",
    category: "worldgen",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.18.2",
    recommended: true,
  },
  {
    id: "incendium",
    name: "Incendium",
    description: "Невероятный адский мир с замками пиглинов и лавовыми вулканами",
    category: "worldgen",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.18.2",
    recommended: true,
  },
  {
    id: "nullscape",
    name: "Nullscape",
    description: "Полное перерождение Края: парящие монолиты и кристаллы пустоты",
    category: "worldgen",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.18.2",
    recommended: true,
  },
  {
    id: "yungs-better-dungeons",
    name: "YUNG's Better Dungeons",
    description: "Переработка подземелий со спавнерами в захватывающие катакомбы",
    category: "worldgen",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.19.2",
    recommended: true,
  },

  // --- BUILDING & DECOR ---
  {
    id: "chipped",
    name: "Chipped",
    description: "Более 2000 вариантов текстур для ванильных строительных блоков",
    category: "building",
    loaders: ["Fabric", "Forge", "NeoForge"],
    minVersion: "1.18.2",
    maxVersion: "1.20.4",
    recommended: true,
  },
  {
    id: "handcrafted",
    name: "Handcrafted",
    description: "Уютная мебель: диваны, стулья, столы, тарелки и светильники",
    category: "building",
    loaders: ["Fabric", "Forge", "NeoForge"],
    minVersion: "1.19.2",
    maxVersion: "1.20.4",
    recommended: true,
  },
  {
    id: "supplementaries",
    name: "Supplementaries",
    description: "Флюгеры, клетки, знаки, кувшины, веревки и анимированные детали",
    category: "building",
    loaders: ["Fabric", "Forge", "NeoForge"],
    minVersion: "1.16.5",
    maxVersion: "1.20.4",
    recommended: true,
  },
  {
    id: "macaws-bridges",
    name: "Macaw's Bridges",
    description: "Канатные, деревянные и каменные подвесные мосты для переправ",
    category: "building",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    minVersion: "1.16.5",
    recommended: false,
  },

  // --- RPG & COMBAT ---
  {
    id: "better-combat",
    name: "Better Combat",
    description: "Плавная боевая анимация оружия от 3-го и 1-го лица, комбо-удары",
    category: "rpg",
    loaders: ["Fabric", "Forge", "NeoForge"],
    minVersion: "1.18.2",
    recommended: true,
  },
  {
    id: "simply-swords",
    name: "Simply Swords",
    description: "Десятки уникальных мечей, рапир, клейморов и кос с пассивками",
    category: "rpg",
    loaders: ["Fabric", "Forge", "NeoForge"],
    minVersion: "1.18.2",
    maxVersion: "1.20.4",
    recommended: true,
  },
  {
    id: "relics-mod",
    name: "Relics",
    description: "Магические артефакты, кольца и амулеты, улучшающие персонажа",
    category: "rpg",
    loaders: ["Forge", "NeoForge"],
    minVersion: "1.16.5",
    maxVersion: "1.21.1",
    recommended: false,
  },
];
