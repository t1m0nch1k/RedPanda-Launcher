export interface ModItem {
  id: string;
  name: string;
  author: string;
  description: string;
  category: "Оптимизация" | "Графика" | "Мультиплеер" | "Интерфейс" | "Утилиты";
  loaders: ("Fabric" | "Forge" | "NeoForge" | "Quilt")[];
  downloads: string;
  source: "Modrinth" | "CurseForge" | "Both";
  featured?: boolean;
}

export const TOP_MODS: ModItem[] = [
  {
    id: "sodium",
    name: "Sodium",
    author: "jellysquid3 / CaffeineMC",
    description: "Мод оптимизации рендеринга Minecraft. Итоговый прирост производительности зависит от сборки и оборудования.",
    category: "Оптимизация",
    loaders: ["Fabric", "NeoForge"],
    downloads: "45M+",
    source: "Both",
    featured: true
  },
  {
    id: "iris",
    name: "Iris Shaders",
    author: "coderbot / IMS21",
    description: "Современный шейдерный загрузчик с полной поддержкой шейдеров OptiFine и нативной оптимизацией Sodium.",
    category: "Графика",
    loaders: ["Fabric", "NeoForge", "Quilt"],
    downloads: "38M+",
    source: "Both",
    featured: true
  },
  {
    id: "distant-horizons",
    name: "Distant Horizons",
    author: "The-Distant-Horizons-Team",
    description: "Рендеринг LOD-чанков (Level of Detail) для просмотра дальних участков мира.",
    category: "Графика",
    loaders: ["Fabric", "Forge", "NeoForge"],
    downloads: "12M+",
    source: "Both",
    featured: true
  },
  {
    id: "e4mc",
    name: "e4mc",
    author: "hmperson1",
    description: "Встроенный сервис для локальной игры по сети: превращает одиночный мир в общедоступный P2P-сервер за один клик.",
    category: "Мультиплеер",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    downloads: "8M+",
    source: "Both",
    featured: true
  },
  {
    id: "lithium",
    name: "Lithium",
    author: "CaffeineMC",
    description: "Глубокая оптимизация серверного тика игры, физики мобов, чанков и ИИ без изменения ванильной механики.",
    category: "Оптимизация",
    loaders: ["Fabric", "NeoForge", "Quilt"],
    downloads: "32M+",
    source: "Both",
    featured: true
  },
  {
    id: "jei",
    name: "Just Enough Items (JEI)",
    author: "mezz",
    description: "Незаменимый просмотрщик крафтов, рецептов плавки, зельеварения и использования предметов прямо в игре.",
    category: "Интерфейс",
    loaders: ["Fabric", "Forge", "NeoForge"],
    downloads: "280M+",
    source: "Both",
    featured: true
  },
  {
    id: "appleskin",
    name: "AppleSkin",
    author: "squeek502",
    description: "Информативный HUD сытости и насыщения: показывает, сколько здоровья и голода восстановит еда.",
    category: "Интерфейс",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    downloads: "190M+",
    source: "Both"
  },
  {
    id: "simple-voice-chat",
    name: "Simple Voice Chat",
    author: "henkelmax",
    description: "Позиционный голосовой 3D-чат прямо внутри игры с шумоподавлением, радиостанциями и группами.",
    category: "Мультиплеер",
    loaders: ["Fabric", "Forge", "NeoForge", "Quilt"],
    downloads: "42M+",
    source: "Both"
  },
  {
    id: "ferrite-core",
    name: "FerriteCore",
    author: "malte0811",
    description: "Оптимизация ресурсов и моделей Minecraft с эффектом, зависящим от конфигурации сборки.",
    category: "Оптимизация",
    loaders: ["Fabric", "Forge", "NeoForge"],
    downloads: "55M+",
    source: "Both"
  }
];
