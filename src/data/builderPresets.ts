export interface CuratedMod {
  id: string; // Modrinth slug
  name: string;
  description: string;
  category: string;
  iconUrl?: string;
  loaders: ("Fabric" | "Forge" | "NeoForge" | "Quilt")[];
  minVersion?: string;
  maxVersion?: string;
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
    isCore: true,
    recommended: true,
  },
  {
    id: "sodium",
    name: "Sodium",
    description: "Революционный графический движок, увеличивающий FPS в разы",
    category: "optimization",
    loaders: ["Fabric", "Quilt", "NeoForge"],
    isCore: true,
    recommended: true,
  },
  {
    id: "lithium",
    name: "Lithium",
    description: "Оптимизация физики, мобов и серверного тика игры",
    category: "optimization",
    loaders: ["Fabric", "Quilt", "NeoForge"],
    isCore: true,
    recommended: true,
  },
  {
    id: "ferrite-core",
    name: "FerriteCore",
    description: "Снижает потребление оперативной памяти Java до 50%",
    category: "optimization",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    isCore: true,
    recommended: true,
  },
  {
    id: "entityculling",
    name: "Entity Culling",
    description: "Не рендерит мобов и сундуки сквозь стены для экономии ресурсов",
    category: "optimization",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    isCore: true,
    recommended: true,
  },
  {
    id: "immediatelyfast",
    name: "ImmediatelyFast",
    description: "Ускоряет рендеринг текста, инвентарей и частиц",
    category: "optimization",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    isCore: true,
    recommended: true,
  },
  // --- OPTIMIZATION (FORGE) ---
  {
    id: "embeddium",
    name: "Embeddium",
    description: "Высокопроизводительный порт Sodium для Forge и NeoForge",
    category: "optimization",
    loaders: ["Forge", "NeoForge"],
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
    recommended: true,
  },
  {
    id: "journeymap",
    name: "JourneyMap",
    description: "Удобная карта мира в реальном времени с метками и радаром",
    category: "qol",
    loaders: ["Fabric", "Forge", "NeoForge"],
    recommended: true,
  },
  {
    id: "jade",
    name: "Jade",
    description: "Всплывающие информационные подсказки о блоках и мобах при наведении",
    category: "qol",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    recommended: true,
  },
  {
    id: "appleskin",
    name: "AppleSkin",
    description: "Отображение сытости и насыщения еды прямо на полоске голода",
    category: "qol",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    recommended: true,
  },
  {
    id: "mouse-tweaks",
    name: "Mouse Tweaks",
    description: "Быстрое перемещение и перетаскивание предметов мышью",
    category: "qol",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    recommended: true,
  },
  {
    id: "inventory-profiles-next",
    name: "Inventory Profiles Next",
    description: "Сортировка сундуков и инвентаря в один клик",
    category: "qol",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    recommended: false,
  },

  // --- MAGIC ---
  {
    id: "irons-spells-n-spellbooks",
    name: "Iron's Spells 'n Spellbooks",
    description: "Классическая RPG-магия: сотни заклинаний, посохи, свитки и мана",
    category: "magic",
    loaders: ["Fabric", "Forge", "NeoForge"],
    recommended: true,
  },
  {
    id: "ars-nouveau",
    name: "Ars Nouveau",
    description: "Создание собственных уникальных заклинаний, ритуалов и фамильяров",
    category: "magic",
    loaders: ["Forge", "NeoForge"],
    recommended: true,
  },
  {
    id: "botania",
    name: "Botania",
    description: "Природная магия на основе цветов, маны и мистических механизмов",
    category: "magic",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    recommended: true,
  },
  {
    id: "wizards",
    name: "Wizards (RPG Series)",
    description: "Магические классы волшебников: огонь, холод и тайная магия",
    category: "magic",
    loaders: ["Fabric", "Forge", "NeoForge"],
    recommended: false,
  },

  // --- ADVENTURE & DUNGEONS ---
  {
    id: "when-dungeons-arise",
    name: "When Dungeons Arise",
    description: "Огромные летающие корабли, ветряные мельницы и замки с сокровищами",
    category: "adventure",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    recommended: true,
  },
  {
    id: "cataclysm",
    name: "L_Ender 's Cataclysm",
    description: "Эпические боссы в неизведанных подземельях с уникальными механиками",
    category: "adventure",
    loaders: ["Forge", "NeoForge"],
    recommended: true,
  },
  {
    id: "alexs-mobs",
    name: "Alex's Mobs",
    description: "Более 80 уникальных анимированных животных и фантастических существ",
    category: "adventure",
    loaders: ["Forge", "NeoForge"],
    recommended: true,
  },
  {
    id: "aquamirae",
    name: "Aquamirae",
    description: "Глубоководные морские приключения, лабиринт льда и жуткие монстры",
    category: "adventure",
    loaders: ["Fabric", "Forge", "NeoForge"],
    recommended: false,
  },
  {
    id: "dungeons-and-taverns",
    name: "Dungeons and Taverns",
    description: "Атмосферные таверны, форпосты разбойников и подземные лабиринты",
    category: "adventure",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    recommended: true,
  },

  // --- TECH ---
  {
    id: "create",
    name: "Create",
    description: "Шедевры кинетической механики: поезда, ветряки, конвейеры и фабрики",
    category: "tech",
    loaders: ["Fabric", "Forge", "NeoForge"],
    recommended: true,
  },
  {
    id: "create-steam-n-rails",
    name: "Create: Steam 'n' Rails",
    description: "Расширение поездов для мода Create: семафоры, развилки и локомотивы",
    category: "tech",
    loaders: ["Fabric", "Forge", "NeoForge"],
    recommended: false,
  },
  {
    id: "mekanism",
    name: "Mekanism",
    description: "Высокотехнологичные фабрики, переработка руд 5x, реакторы и джетпаки",
    category: "tech",
    loaders: ["Forge", "NeoForge"],
    recommended: true,
  },
  {
    id: "applied-energistics-2",
    name: "Applied Energistics 2",
    description: "Хранение миллионов предметов в цифровой МЭ-сети и автокрафт",
    category: "tech",
    loaders: ["Fabric", "Forge", "NeoForge"],
    recommended: true,
  },

  // --- WORLD GEN ---
  {
    id: "terralith",
    name: "Terralith",
    description: "Полная трансформация генерации ванильного мира: 100+ новых биомов",
    category: "worldgen",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    recommended: true,
  },
  {
    id: "incendium",
    name: "Incendium",
    description: "Невероятный адский мир с замками пиглинов и лавовыми вулканами",
    category: "worldgen",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    recommended: true,
  },
  {
    id: "nullscape",
    name: "Nullscape",
    description: "Полное перерождение Края: парящие монолиты и кристаллы пустоты",
    category: "worldgen",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    recommended: true,
  },
  {
    id: "yungs-better-dungeons",
    name: "YUNG's Better Dungeons",
    description: "Переработка подземелий со спавнерами в захватывающие катакомбы",
    category: "worldgen",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    recommended: true,
  },

  // --- BUILDING & DECOR ---
  {
    id: "chipped",
    name: "Chipped",
    description: "Более 2000 вариантов текстур для ванильных строительных блоков",
    category: "building",
    loaders: ["Fabric", "Forge", "NeoForge"],
    recommended: true,
  },
  {
    id: "handcrafted",
    name: "Handcrafted",
    description: "Уютная мебель: диваны, стулья, столы, тарелки и светильники",
    category: "building",
    loaders: ["Fabric", "Forge", "NeoForge"],
    recommended: true,
  },
  {
    id: "supplementaries",
    name: "Supplementaries",
    description: "Флюгеры, клетки, знаки, кувшины, веревки и анимированные детали",
    category: "building",
    loaders: ["Fabric", "Forge", "NeoForge"],
    recommended: true,
  },
  {
    id: "macaws-bridges",
    name: "Macaw's Bridges",
    description: "Канатные, деревянные и каменные подвесные мосты для переправ",
    category: "building",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    recommended: false,
  },

  // --- RPG & COMBAT ---
  {
    id: "better-combat",
    name: "Better Combat",
    description: "Плавная боевая анимация оружия от 3-го и 1-го лица, комбо-удары",
    category: "rpg",
    loaders: ["Fabric", "Forge", "NeoForge"],
    recommended: true,
  },
  {
    id: "simply-swords",
    name: "Simply Swords",
    description: "Десятки уникальных мечей, рапир, клейморов и кос с пассивками",
    category: "rpg",
    loaders: ["Fabric", "Forge", "NeoForge"],
    recommended: true,
  },
  {
    id: "relics",
    name: "Relics",
    description: "Магические артефакты, кольца и амулеты, улучшающие персонажа",
    category: "rpg",
    loaders: ["Fabric", "Forge", "NeoForge"],
    recommended: false,
  },
];
