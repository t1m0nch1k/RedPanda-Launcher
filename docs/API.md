# 📚 RedPanda Launcher — Tauri Backend API Documentation

Справочник всех зарегистрированных Rust IPC команд, доступных во фронтенде через `@tauri-apps/api/core::invoke`.

---

## 👤 Управление аккаунтами (Accounts)

### `get_accounts()`
- **Описание**: Возвращает список всех сохранённых аккаунтов (токены расшифровываются прозрачно на лету).
- **Возвращает**: `Promise<Account[]>`

### `add_offline_account({ username: string })`
- **Описание**: Добавляет автономный (офлайн) аккаунт.
- **Параметры**: `username: string`
- **Возвращает**: `Promise<Account>`

### `add_elyby_account_oauth()`
- **Описание**: Запускает браузерный OAuth2 Flow для авторизации через Ely.by с получением access/refresh токенов.
- **Возвращает**: `Promise<Account>`

### `add_elyby_account({ email: string, password: string })`
- **Описание**: Авторизация через логин/пароль Yggdrasil API для Ely.by.
- **Параметры**: `email: string`, `password: string`
- **Возвращает**: `Promise<Account>`

### `microsoft_device_code()`
- **Описание**: Генерирует код устройства (Device Code Flow) для Microsoft OAuth.
- **Возвращает**: `Promise<DeviceCodeInfo>` (`user_code`, `verification_uri`, `device_code`, `interval`)

### `poll_microsoft_device_code({ deviceCode: string })`
- **Описание**: Опрашивает сервер Microsoft OAuth для завершения авторизации и прохождения цепочки Xbox Live -> XSTS -> Minecraft Services.
- **Параметры**: `deviceCode: string`
- **Возвращает**: `Promise<Account>`

### `add_microsoft_account_oauth()`
- **Описание**: Браузерная авторизация Microsoft OAuth через локальный HTTP Redirect Server.
- **Возвращает**: `Promise<Account>`

### `validate_and_refresh_account({ id: string })`
- **Описание**: Проверяет срок действия access_token и при необходимости обновляет его через refresh_token.
- **Параметры**: `id: string`
- **Возвращает**: `Promise<Account>`

### `remove_account({ id: string })`
- **Описание**: Удаляет аккаунт по ID.
- **Параметры**: `id: string`
- **Возвращает**: `Promise<void>`

### `set_active_account({ id: string })`
- **Описание**: Устанавливает активный аккаунт по умолчанию.
- **Параметры**: `id: string`
- **Возвращает**: `Promise<void>`

---

## 🎮 Запуск игры (Launcher)

### `launch_game({ username, instanceId, version, loaderType, loaderVersion, server? })`
- **Описание**: Выполняет сборку JVM аргументов, авто-скачивание Java, валидацию токенов и запуск игрового процесса Minecraft с трансляцией логов в `launcher-event`.
- **Возвращает**: `Promise<void>`

---

## ⚙️ Настройки приложения (Settings)

### `get_settings()`
- **Описание**: Загружает конфигурацию приложения (`settings.json`).
- **Возвращает**: `Promise<AppSettings>`

### `save_settings({ settings: AppSettings })`
- **Описание**: Сохраняет конфигурацию приложения с потокобезопасной блокировкой.
- **Параметры**: `settings: AppSettings`
- **Возвращает**: `Promise<void>`

### `find_java_installations()`
- **Описание**: Выполняет автоматический поиск всех установленных сред Java на компьютере (Program Files, PATH, JAVA_HOME).
- **Возвращает**: `Promise<JavaInstallation[]>`

---

## 📦 Управление инстансами (Instances)

### `get_instances()`
- **Описание**: Возвращает список всех созданных сборок.
- **Возвращает**: `Promise<Instance[]>`

### `add_instance({ name, gameVersion, loaderType, loaderVersion })`
- **Описание**: Создает новую сборку с валидацией имени и пути.
- **Возвращает**: `Promise<Instance>`

### `remove_instance({ id: string })`
- **Описание**: Удаляет сборку и все связанные с ней файлы.
- **Параметры**: `id: string`
- **Возвращает**: `Promise<void>`

### `clone_instance({ id: string })`
- **Описание**: Клонирует существующую сборку.
- **Параметры**: `id: string`
- **Возвращает**: `Promise<Instance>`

### `export_instance({ id: string })`
- **Описание**: Экспортирует сборку в .zip архив (бэкап).
- **Параметры**: `id: string`
- **Возвращает**: `Promise<string>`

---

## 🧩 Моды и Зависимости (Mod Ecosystem)

### `search_modrinth({ query, gameVersion, loader, index, sort })`
- **Описание**: Поиск модов, шейдеров и ресурс-паков в каталоге Modrinth.
- **Возвращает**: `Promise<ModrinthSearchResult>`

### `search_curseforge({ query, gameVersion, classId, index, pageSize })`
- **Описание**: Поиск в каталоге CurseForge API с динамическим API-ключом.
- **Возвращает**: `Promise<CurseForgeSearchResult[]>`

### `resolve_dependencies({ instanceId, source, id, gameVersion, loader })`
- **Описание**: Рекурсивный поиск и построение дерева обязательных зависимостей для модов.
- **Возвращает**: `Promise<InstallTask[]>`

### `download_modrinth_version({ instanceId, versionId, projectType })`
- **Описание**: Скачивание файла с лимитом размера 500 МБ и санитизацией пути.
- **Возвращает**: `Promise<void>`

### `download_curseforge_version({ instanceId, downloadUrl, fileName, projectType })`
- **Описание**: Скачивание файла из CurseForge с лимитом размера 500 МБ.
- **Возвращает**: `Promise<void>`

---

## 🔄 Авто-обновления (Updater)

### `check_for_updates()`
- **Описание**: Проверяет наличие новых релизов лаунчера на GitHub Releases.
- **Возвращает**: `Promise<UpdateInfo>`

### `download_and_install_update({ downloadUrl: string })`
- **Описание**: Загружает и применяет обновление лаунчера.
- **Возвращает**: `Promise<void>`
