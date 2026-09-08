export interface ReleaseChange {
  type: "feat" | "fix" | "security" | "perf";
  title: string;
  description: string;
}

export interface LauncherRelease {
  version: string;
  date: string;
  title: string;
  tagline: string;
  downloadUrl: string;
  fileSize: string;
  isLatest?: boolean;
  highlights: string[];
  changes: ReleaseChange[];
}

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.3.0";
const LATEST_RELEASE_TAG = "v0.3.0_fix2";

export const LAUNCHER_RELEASES: LauncherRelease[] = [
  {
    version: `v${APP_VERSION}`,
    date: "6 сентября 2026",
    title: "Smart Modpack Builder & Modern MC Engine",
    tagline: "Интеллектуальный конструктор сборок под ключ, поддержка новейших версий 26.x и снапшотов, кастомизация палитры и исправление CurseForge API",
    downloadUrl: `https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/${LATEST_RELEASE_TAG}/RedPanda_Setup_${APP_VERSION}.exe`,
    fileSize: "См. опубликованные assets",
    isLatest: true,
    highlights: [
      "🪄 Конструктор сборок [BETA]: сборка модпака по выбранным тематикам (Магия, Приключения, Технологии, Мир, Декор, RPG) в один клик",
      "Автоматический каскадный поиск и докачивание скрытых библиотек и зависимостей (Fabric API, Curios, Architectury, Cloth Config)",
      "Поддержка всех новейших релизов Minecraft (26.2, 26.1) и еженедельных снапшотов с удобным тумблером в модалке",
      "Автоматическое определение и загрузка Java 21 для современных версий игры",
      "Полноценный кастомный Color Picker в настройках внешнего вида лаунчера",
      "Стабильный встроенный CurseForge API с умным fallback и авто-обработкой прямых ссылок"
    ],
    changes: [
      {
        type: "feat",
        title: "Конструктор сборок [BETA]",
        description: "Интерактивный мастер: игрок выбирает тематики и загрузчик, а лаунчер сам подбирает совместимые моды, ядро оптимизации и зависимости."
      },
      {
        type: "feat",
        title: "Поддержка версий 26.x и снапшотов",
        description: "Переписан фильтр версий Mojang API: теперь доступны все современные релизы и пре-релизы со встроенным переключателем снапшотов."
      },
      {
        type: "feat",
        title: "Свободный выбор акцентного цвета",
        description: "В настройки добавлен встроенный Color Picker: можно выбрать любой HEX-оттенок интерфейса лаунчера."
      },
      {
        type: "fix",
        title: "Восстановление CurseForge API",
        description: "Интегрирован отказоустойчивый ключ открытых лаунчеров с автоматическим переключением на резервный источник при ошибках сети."
      },
      {
        type: "perf",
        title: "Поддержка Java 21",
        description: "Для версий 26.x и снапшотов автоматически скачивается и конфигурируется Eclipse Temurin Java 21."
      }
    ]
  },
  {
    version: "v0.2.2",
    date: "29 августа 2026",
    title: "Instance Diagnostics & Mod Control",
    tagline: "Проверка готовности сборки к запуску и безопасное управление установленными модами",
    downloadUrl: "https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/v0.2.2/RedPanda_Setup_0.2.2.exe",
    fileSize: "39.1 MB",
    isLatest: false,
    highlights: [
      "Диагностика папки сборки, Java, памяти и загрузчика перед запуском",
      "Включение и выключение модов без удаления файлов",
      "Отключённые моды отображаются отдельно и восстанавливаются в один клик",
      "Новые безопасные Tauri-команды для работы с состоянием модов",
      "Обновлены сайт, SEO-метаданные и ссылки на подписанный установщик"
    ],
    changes: [
      {
        type: "feat",
        title: "Диагностика сборок",
        description: "Новая вкладка в управлении сборкой проверяет наличие папки, Java, корректность загрузчика, диапазон памяти и состояние модов, показывая понятные рекомендации по исправлению."
      },
      {
        type: "feat",
        title: "Управление состоянием модов",
        description: "Любой установленный мод можно временно отключить без удаления: лаунчер переименовывает файл в .jar.disabled и возвращает его обратно по кнопке."
      },
      {
        type: "fix",
        title: "Безопасные операции с файлами модов",
        description: "Переключение состояния использует валидацию имён и безопасное построение путей, поэтому операции ограничены папкой текущей сборки."
      }
    ]
  },
  {
    version: "v0.2.1",
    date: "17 августа 2026",
    title: "Security Hardening & Custom GUI Installer",
    tagline: "Глубокий аудит безопасности, крипто-хранилище AES-256-GCM и автономный установщик",
    downloadUrl: "https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/v0.2.1/RedPanda_Setup_0.2.1.exe",
    fileSize: "38.6 MB",
    isLatest: false,
    highlights: [
      "Автономный Cyber-Brutalist установщик с распаковкой и созданием ярлыков",
      "Криптографическое хранилище паролей и токенов AES-256-GCM с рандомизированным Nonce",
      "Автоматический refresh токенов для аккаунтов Microsoft и Ely.by",
      "Защита от Path Traversal (safe_join) и потокобезопасные файловые мьютексы",
      "Белый список доменов обновления и лимиты загрузок (500 МБ)"
    ],
    changes: [
      {
        type: "security",
        title: "AES-256-GCM Vault & Randomized Nonces",
        description: "Устранены статические векторы инициализации. Для каждой операции сохранения генерируется криптографически стойкий 96-битный Nonce через OsRng."
      },
      {
        type: "security",
        title: "Защита от Path Traversal (Zip Slip / mrpack)",
        description: "Все операции распаковки архивов и модпаков теперь строго проверяются функцией safe_join с блокировкой выхода за пределы папки инстанса."
      },
      {
        type: "feat",
        title: "Автономный установщик RedPanda_Setup_0.2.1.exe",
        description: "Разработан кастомный GUI-инсталлятор на Tauri с выбором пути, созданием ярлыков на рабочем столе и в меню 'Пуск', а также интеграцией в реестр Windows (Установка и удаление программ)."
      },
      {
        type: "feat",
        title: "Фоновое обновление сессий Microsoft & Ely.by",
        description: "Токены авторизации обновляются в фоновом режиме перед каждым запуском игры, исключая внезапные вылеты сессии."
      },
      {
        type: "fix",
        title: "Файловые мьютексы на Rust",
        description: "Исключены состояния гонки (Race Conditions) при параллельной записи конфигураций и инстансов."
      }
    ]
  },
  {
    version: "v0.2.0",
    date: "14 августа 2026",
    title: "CurseForge API, P2P Multiplayer & 3D Skin Engine",
    tagline: "Единый каталог модов Modrinth + CurseForge и встроенный мультиплеер без портов",
    downloadUrl: "https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/v0.2.0/RedPanda_Setup_0.2.0.exe",
    fileSize: "37.8 MB",
    highlights: [
      "Прямой поиск и установка модов из CurseForge и Modrinth в одном окне",
      "Встроенный P2P мультиплеер e4mc и Steam",
      "3D просмотрщик скинов с анимацией движения и вращением",
      "Автоматическое определение установленных версий Java JDK 8/17/21"
    ],
    changes: [
      {
        type: "feat",
        title: "Интеграция CurseForge API v1",
        description: "Поддержка миллионов модов, ресурспаков и шейдеров из базы CurseForge с умным разрешением зависимостей."
      },
      {
        type: "feat",
        title: "e4mc & Steam P2P сетевой движок",
        description: "Возможность открывать одиночные миры для друзей без белого IP и сторонних программ."
      },
      {
        type: "perf",
        title: "Оптимизация параллельных загрузок",
        description: "Скачивание файлов игры разбито на асинхронные стримы со сжатием zstd."
      }
    ]
  },
  {
    version: "v0.1.0",
    date: "1 августа 2026",
    title: "Genesis of RedPanda Launcher",
    tagline: "Первый релиз сверхбыстрого лаунчера Minecraft на стеке Rust 2021 + Tauri 2.0",
    downloadUrl: "https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/v0.1.0/RedPanda_Launcher_v0.1.0.exe",
    fileSize: "34.2 MB",
    highlights: [
      "Архитектура на Rust & Tauri 2.0: потребление ОЗУ всего 40 МБ в простое",
      "Поддержка загрузчиков Fabric, Forge, NeoForge, Quilt и Vanilla",
      "Молниеносный запуск за 0.8 секунды",
      "Отсутствие рекламы, сторонних спам-баннеров и телеметрии"
    ],
    changes: [
      {
        type: "feat",
        title: "Первый публичный релиз",
        description: "Базовый функционал управления инстансами, скачивания версий с официальных серверов Mojang и запуска игры."
      }
    ]
  }
];
