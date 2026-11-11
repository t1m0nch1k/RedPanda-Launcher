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

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.3.5";
const LATEST_RELEASE_TAG = "v0.3.5";
const RELEASE_VERSION = "0.3.5";

export const LAUNCHER_RELEASES: LauncherRelease[] = [
  {
    version: `v${APP_VERSION}`,
    date: "7 ноября 2026",
    title: "Скины Ely.by и оффлайн-скины в модах",
    tagline: "Автоматическая поддержка и установка CustomSkinLoader для сборок с модами: скины аккаунтов Ely.by и локальные скины теперь корректно отображаются в Forge, Fabric и NeoForge без ручной настройки.",
    downloadUrl: `https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/${LATEST_RELEASE_TAG}/RedPanda_Setup_${RELEASE_VERSION}.exe`,
    fileSize: "Windows 10/11 x64",
    isLatest: true,
    highlights: [
      "Скины Ely.by в модах: автоматическое подключение Ely.by API через CustomSkinLoader при запуске сборок Fabric, Forge и NeoForge",
      "Автоустановка CustomSkinLoader: лаунчер сам находит и докачивает нужную версию с Modrinth, если она отсутствует в сборке",
      "Оффлайн и локальные скины: перенос и синхронизация скина профиля в конфигурацию загрузчика скинов с поддержкой моделей classic и slim",
      "Совместимость с серверами: корректная передача параметров сессии и типа пользователя для стабильной авторизации",
      "Окно аккаунтов и гардероб: управление профилями Microsoft / Ely.by и 3D-предпросмотр скинов"
    ],
    changes: [
      { type: "feat", title: "Поддержка Ely.by в модовых сборках", description: "Интеграция CustomSkinLoader для аккаунтов Ely.by в сборках Fabric, Forge и NeoForge." },
      { type: "feat", title: "Автоматическая загрузка CustomSkinLoader", description: "Лаунчер определяет отсутствие мод-загрузчика скинов и автоматически устанавливает совместимую версию из каталога Modrinth." },
      { type: "feat", title: "Синхронизация локальных скинов", description: "Оффлайн-скины и кастомные скины аккаунтов автоматически подгружаются в CustomSkinLoader." },
      { type: "fix", title: "Формат user_type для Ely.by", description: "Корректный параметр типа пользователя при запуске игры для правильной валидации на поддерживаемых серверах." }
    ]
  },
  {
    version: "v0.3.4",
    date: "4 ноября 2026",
    title: "Аккаунты, скины и защищённые обновления",
    tagline: "Вход в Microsoft и Ely.by вынесен в отдельное окно аккаунтов: переключение профилей и обновление скина без перезапуска лаунчера. Вместе с этим — исправления сессий, загрузок и восстановления данных по итогам аудита кода.",
    downloadUrl: "https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/v0.3.4/RedPanda_Setup_0.3.4.exe",
    fileSize: "Windows 10/11 x64",
    isLatest: false,
    highlights: [
      "Окно аккаунтов: вход через Microsoft и Ely.by, переключение и удаление профилей в одном месте",
      "Скин активного аккаунта обновляется прямо из гардероба, 3D-предпросмотр остаётся",
      "Сессии больше не теряются: обновлённый токен Microsoft сохраняется до обмена на игровой, а истёкшая сессия помечается «нужен вход» вместо тихой ошибки",
      "Новый главный экран: боковая навигация, витрина выбранной сборки, карточки сборок и история запусков",
      "Защита обновлений: сборки без настоящего ключа подписи не принимают автообновления"
    ],
    changes: [
      { type: "feat", title: "Окно аккаунтов", description: "Вход через Microsoft и Ely.by, переключение активного профиля, удаление аккаунта и обновление данных без перезапуска лаунчера." },
      { type: "feat", title: "Скины без перезапуска", description: "Гардероб обновляет скин активного аккаунта отдельной командой: 3D-предпросмотр и установка через CustomSkinLoader работают как раньше." },
      { type: "fix", title: "Надёжные сессии", description: "Обновлённый токен Microsoft сохраняется до обмена на игровой, истёкшая сессия помечается «нужен вход», а устройство-код проверяется на корректность ответа и повторяется при 429/5xx." },
      { type: "security", title: "Проверка загрузок", description: "Скачивание проверяет начальный адрес и каждый редирект: только HTTPS и доверенные хосты, иначе загрузка отклоняется." },
      { type: "fix", title: "Восстановление данных", description: "Повреждённые данные восстанавливаются в безопасном порядке и больше не могут перезаписать исправные файлы." }
    ]
  },
  {
    version: "v0.3.2 (не опубликована)",
    date: "26 сентября 2026",
    title: "Smart Crash Diagnostics & Live Server Browser",
    tagline: "Интеллектуальная расшифровка крашей с готовыми решениями, встроенный мониторинг серверов с живым пингом и онлайном, экспорт модпаков в .mrpack и таймер Discord RPC",
    downloadUrl: `https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/${LATEST_RELEASE_TAG}/RedPanda_Setup_${RELEASE_VERSION}.exe`,
    fileSize: "См. опубликованные assets",
    isLatest: false,
    highlights: [
      "🧠 Умная диагностика крашей (Smart Diagnostics): лаунчер анализирует логи вылетов Minecraft, определяет нехватку памяти (OOM), несовместимость Java или конфликты модов и подсказывает понятные действия по исправлению",
      "🌐 Live Server Browser: встроенный мониторинг публичных и партнерских серверов с живым пингом, отображением онлайна, MOTD и прямым подключением в игру в 1 клик",
      "📦 Экспорт сборок в .mrpack: делитесь своими кастомными сборками с друзьями в один клик с автоматической очисткой логов, кэшей и временных файлов",
      "⏱ Discord RPC Elapsed Timer: точный счетчик игрового времени сессии в статусе Discord Rich Presence",
      "🚀 Расширенное SEO и сравнения: запущены страницы независимых сравнений (RedPanda vs TLauncher vs Prism) и динамический sitemap"
    ],
    changes: [
      {
        type: "feat",
        title: "Интеллектуальная диагностика крашей",
        description: "При неожиданном завершении игры лаунчер перехватывает лог, определяет тип ошибки (память, Java, дубликаты модов, поврежденные конфиги) и выводит понятную карточку с кнопкой быстрого исправления."
      },
      {
        type: "feat",
        title: "Браузер серверов с Live Ping",
        description: "Новая вкладка серверов: проверяйте статус, задержку (пинг) и текущий онлайн ваших любимых серверов прямо из лаунчера с возможностью запуска сразу в сервер."
      },
      {
        type: "feat",
        title: "Экспорт сборок в формат .mrpack",
        description: "Экспортируйте настроенные сборки в стандартный архив Modrinth pack (.mrpack), готовый для отправки друзьям или публикации."
      },
      {
        type: "perf",
        title: "Таймер сессии в Discord RPC",
        description: "В статус Discord добавлено реальное время, прошедшее с момента старта игры, а также название текущей запущенной сборки."
      }
    ]
  },
  {
    version: "v0.3.1",
    date: "6 сентября 2026",
    title: "Smart Modpack Builder & Modern MC Engine",
    tagline: "Интеллектуальный конструктор сборок под ключ, поддержка новейших версий 26.x и снапшотов, кастомизация палитры и исправление CurseForge API",
    downloadUrl: `https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/${LATEST_RELEASE_TAG}/RedPanda_Setup_${RELEASE_VERSION}.exe`,
    fileSize: "См. опубликованные assets",
    isLatest: false,
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
