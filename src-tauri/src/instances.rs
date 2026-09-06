use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::SystemTime;
use tauri::AppHandle;
use tauri::Manager;
use uuid::Uuid;

lazy_static! {
    static ref INSTANCES_MUTEX: Mutex<()> = Mutex::new(());
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub game_version: String,
    pub loader_type: String, // "Vanilla", "Forge", "Fabric", "Quilt", "NeoForge"
    pub loader_version: String,
    pub last_played: Option<i64>,
    pub min_memory: Option<u32>,
    pub max_memory: Option<u32>,
    pub icon_path: Option<String>,
    pub java_path: Option<String>,
    pub jvm_args: Option<String>,
    pub window_width: Option<u32>,
    pub window_height: Option<u32>,
    pub total_play_time_seconds: Option<u64>,
}

pub fn get_instances_file(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not determine instances directory: {e}"))?;
    fs::create_dir_all(&path).map_err(|e| format!("Could not create instances directory: {e}"))?;
    path.push("instances.json");
    Ok(path)
}

#[tauri::command]
pub async fn get_instances(app: AppHandle) -> Result<Vec<Instance>, String> {
    let _guard = INSTANCES_MUTEX
        .lock()
        .map_err(|_| "Failed to lock instances mutex".to_string())?;

    read_instances_unlocked(&app)
}

fn read_instances_unlocked(app: &AppHandle) -> Result<Vec<Instance>, String> {
    let path = get_instances_file(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let instances_raw: Vec<Instance> = crate::storage::read_json_with_backup(&path)?;

    let mut needs_save = false;
    let mut migrated_instances = Vec::new();

    for mut instance in instances_raw {
        // If the ID is a valid UUID, we migrate it to a readable folder name
        if Uuid::parse_str(&instance.id).is_ok() {
            let new_id = generate_instance_id(&instance.name, &migrated_instances);

            let mut old_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
            old_dir.push("RedPandaLauncher");
            old_dir.push(&instance.id);

            let mut new_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
            new_dir.push("RedPandaLauncher");
            new_dir.push(&new_id);

            if old_dir.exists() && new_dir.exists() {
                return Err(format!(
                    "Cannot migrate instance {}: target already exists",
                    instance.id
                ));
            }
            if old_dir.exists() {
                if let Err(e) = fs::rename(&old_dir, &new_dir) {
                    return Err(format!("Failed to migrate instance {}: {e}", instance.id));
                }
            }

            instance.id = new_id;
            needs_save = true;
        }

        // Auto-heal missing or blank loader_version
        if instance.loader_type != "Vanilla" && instance.loader_version.trim().is_empty() {
            instance.loader_version = match instance.loader_type.as_str() {
                "Fabric" => "0.16.10".to_string(),
                "Quilt" => "0.27.1".to_string(),
                "NeoForge" => {
                    if instance.game_version.starts_with("1.21") {
                        "21.1.72".to_string()
                    } else if instance.game_version.starts_with("1.20.6") {
                        "20.6.119".to_string()
                    } else {
                        "20.4.80".to_string()
                    }
                }
                "Forge" => {
                    if instance.game_version == "1.16.5" {
                        "36.2.39".to_string()
                    } else if instance.game_version == "1.12.2" {
                        "14.23.5.2860".to_string()
                    } else if instance.game_version == "1.18.2" {
                        "40.2.14".to_string()
                    } else if instance.game_version == "1.19.2" {
                        "43.3.0".to_string()
                    } else if instance.game_version == "1.20.1" {
                        "47.3.0".to_string()
                    } else {
                        "".to_string()
                    }
                }
                _ => "".to_string(),
            };
            if !instance.loader_version.is_empty() {
                needs_save = true;
            }
        }

        migrated_instances.push(instance);
    }

    let mut instances = migrated_instances;

    if needs_save {
        if let Ok(new_data) = serde_json::to_string_pretty(&instances) {
            crate::storage::atomic_write(&path, new_data.as_bytes())?;
        }
    }

    // Sort instances
    if let Ok(settings) = crate::settings::get_settings(app.clone()) {
        if settings.instances_sort_mode == "name" {
            instances.sort_by_key(|a| a.name.to_lowercase());
        } else {
            // last_played (default)
            instances.sort_by_key(|b| std::cmp::Reverse(b.last_played.unwrap_or(0)));
        }
    }

    Ok(instances)
}

fn transliterate_to_ascii(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 2);
    for c in s.chars() {
        match c {
            'а' | 'А' => out.push_str("a"),
            'б' | 'Б' => out.push_str("b"),
            'в' | 'В' => out.push_str("v"),
            'г' | 'Г' => out.push_str("g"),
            'д' | 'Д' => out.push_str("d"),
            'е' | 'Е' | 'ё' | 'Ё' => out.push_str("e"),
            'ж' | 'Ж' => out.push_str("zh"),
            'з' | 'З' => out.push_str("z"),
            'и' | 'И' => out.push_str("i"),
            'й' | 'Й' => out.push_str("y"),
            'к' | 'К' => out.push_str("k"),
            'л' | 'Л' => out.push_str("l"),
            'м' | 'М' => out.push_str("m"),
            'н' | 'Н' => out.push_str("n"),
            'о' | 'О' => out.push_str("o"),
            'п' | 'П' => out.push_str("p"),
            'р' | 'Р' => out.push_str("r"),
            'с' | 'С' => out.push_str("s"),
            'т' | 'Т' => out.push_str("t"),
            'у' | 'У' => out.push_str("u"),
            'ф' | 'Ф' => out.push_str("f"),
            'х' | 'Х' => out.push_str("kh"),
            'ц' | 'Ц' => out.push_str("ts"),
            'ч' | 'Ч' => out.push_str("ch"),
            'ш' | 'Ш' => out.push_str("sh"),
            'щ' | 'Щ' => out.push_str("shch"),
            'ъ' | 'Ъ' | 'ь' | 'Ь' => {},
            'ы' | 'Ы' => out.push_str("y"),
            'э' | 'Э' => out.push_str("e"),
            'ю' | 'Ю' => out.push_str("yu"),
            'я' | 'Я' => out.push_str("ya"),
            c if c.is_ascii_alphanumeric() => out.push(c.to_ascii_lowercase()),
            '.' => out.push('.'),
            '-' | '_' | ' ' => out.push('-'),
            _ => {},
        }
    }
    let mut clean = String::new();
    let mut prev_dash = false;
    for c in out.chars() {
        if c == '-' {
            if !prev_dash && !clean.is_empty() {
                clean.push('-');
            }
            prev_dash = true;
        } else {
            clean.push(c);
            prev_dash = false;
        }
    }
    clean.trim_end_matches('-').to_string()
}

pub fn generate_instance_id(name: &str, existing_instances: &[Instance]) -> String {
    let mut base_id = transliterate_to_ascii(name);

    if base_id.is_empty() {
        base_id = "instance".to_string();
    }

    let mut final_id = base_id.clone();
    let mut counter = 1;

    while existing_instances.iter().any(|i| i.id == final_id) {
        final_id = format!("{}-{}", base_id, counter);
        counter += 1;
    }

    final_id
}

#[tauri::command]
pub async fn add_instance(
    app: AppHandle,
    name: String,
    game_version: String,
    loader_type: String,
    loader_version: String,
) -> Result<Instance, String> {
    let _guard = INSTANCES_MUTEX
        .lock()
        .map_err(|_| "Failed to lock instances mutex".to_string())?;
    let mut instances = read_instances_unlocked(&app)?;

    let new_id = generate_instance_id(&name, &instances);
    crate::security::validate_instance_id(&new_id)?;

    let new_instance = Instance {
        id: new_id,
        name,
        game_version,
        loader_type,
        loader_version,
        last_played: None,
        min_memory: None,
        max_memory: None,
        icon_path: None,
        java_path: None,
        jvm_args: None,
        window_width: None,
        window_height: None,
        total_play_time_seconds: Some(0),
    };

    instances.push(new_instance.clone());

    let path = get_instances_file(&app)?;
    let data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;
    crate::storage::atomic_write(&path, data.as_bytes())?;

    Ok(new_instance)
}

#[tauri::command]
pub async fn remove_instance(app: AppHandle, id: String) -> Result<(), String> {
    crate::security::validate_instance_id(&id)?;
    let _guard = INSTANCES_MUTEX
        .lock()
        .map_err(|_| "Failed to lock instances mutex".to_string())?;
    let mut instances = read_instances_unlocked(&app)?;
    let original_instances = instances.clone();
    let initial_len = instances.len();
    instances.retain(|i| i.id != id);
    if instances.len() == initial_len {
        return Err("Инстанс не найден".to_string());
    }

    let path = get_instances_file(&app)?;
    let data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;

    // Move the directory aside first. If metadata persistence fails, restore
    // it so the filesystem and instances.json stay consistent.
    let dir_path = crate::security::instance_dir(&id)?;
    let tombstone =
        crate::security::launcher_data_dir()?.join(format!(".{}.removing-{}", id, Uuid::new_v4()));
    let moved = if dir_path.exists() {
        fs::rename(&dir_path, &tombstone)
            .map_err(|e| format!("Не удалось подготовить удаление инстанса: {e}"))?;
        true
    } else {
        false
    };

    if let Err(error) = crate::storage::atomic_write(&path, data.as_bytes()) {
        if moved {
            let _ = fs::rename(&tombstone, &dir_path);
        }
        return Err(error);
    }
    if moved {
        if let Err(error) = fs::remove_dir_all(&tombstone) {
            let original_data = serde_json::to_string_pretty(&original_instances)
                .map_err(|e| format!("Не удалось восстановить метаданные инстанса: {e}"))?;
            let _ = crate::storage::atomic_write(&path, original_data.as_bytes());
            let _ = fs::rename(&tombstone, &dir_path);
            return Err(format!(
                "Метаданные восстановлены, но не удалось очистить файлы инстанса: {error}"
            ));
        }
    }

    Ok(())
}

fn copy_dir_all(
    src: impl AsRef<std::path::Path>,
    dst: impl AsRef<std::path::Path>,
) -> std::io::Result<()> {
    std::fs::create_dir_all(&dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_symlink() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Нельзя клонировать символические ссылки",
            ));
        }
        if matches!(
            entry
                .file_name()
                .to_string_lossy()
                .to_ascii_lowercase()
                .as_str(),
            "logs" | "cache" | "backups"
        ) {
            continue;
        }
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            std::fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

fn copy_user_file_no_overwrite(source: &Path, destination: &Path) -> Result<(), String> {
    if destination.exists() {
        return Err(format!("Файл уже существует: {}", destination.display()));
    }
    let mut input = fs::File::open(source).map_err(|e| e.to_string())?;
    let mut output = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(destination)
        .map_err(|e| format!("Не удалось создать файл назначения: {e}"))?;
    std::io::copy(&mut input, &mut output).map_err(|e| e.to_string())?;
    output.sync_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clone_instance(app: AppHandle, id: String) -> Result<Instance, String> {
    crate::security::validate_instance_id(&id)?;
    let _guard = INSTANCES_MUTEX
        .lock()
        .map_err(|_| "Failed to lock instances mutex".to_string())?;
    let mut instances = read_instances_unlocked(&app)?;

    let original = instances
        .iter()
        .find(|i| i.id == id)
        .ok_or("Инстанс не найден")?
        .clone();

    let new_name = format!("{} (Копия)", original.name);
    let new_id = generate_instance_id(&new_name, &instances);

    // Copy folders
    let old_dir = crate::security::instance_dir(&id)?;

    let new_dir = crate::security::instance_dir(&new_id)?;

    if old_dir.exists() {
        copy_dir_all(&old_dir, &new_dir)
            .map_err(|e| format!("Не удалось скопировать файлы: {}", e))?;
    }

    let new_instance = Instance {
        id: new_id,
        name: new_name,
        last_played: None,
        total_play_time_seconds: Some(0),
        ..original
    };
    let mut new_instance = new_instance;
    new_instance.icon_path = None;

    instances.push(new_instance.clone());

    let path = get_instances_file(&app)?;
    let data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;
    crate::storage::atomic_write(&path, data.as_bytes())?;

    Ok(new_instance)
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ModInfo {
    pub filename: String,
    pub size: u64,
    pub enabled: bool,
}

#[tauri::command]
pub async fn get_installed_mods(instance_id: String) -> Result<Vec<ModInfo>, String> {
    let mut path = crate::security::instance_dir(&instance_id)?;
    path.push("mods");

    let mut mods = Vec::new();
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    let filename = entry.file_name().to_string_lossy().to_string();
                    let lower_name = filename.to_ascii_lowercase();
                    let enabled = lower_name.ends_with(".jar");
                    if enabled || lower_name.ends_with(".jar.disabled") {
                        mods.push(ModInfo {
                            filename,
                            size: metadata.len(),
                            enabled,
                        });
                    }
                }
            }
        }
    }
    mods.sort_by_key(|mod_info| mod_info.filename.to_lowercase());
    Ok(mods)
}

#[tauri::command]
pub async fn toggle_mod(
    instance_id: String,
    filename: String,
    enabled: bool,
) -> Result<(), String> {
    let mut mods_dir = crate::security::instance_dir(&instance_id)?;
    mods_dir.push("mods");

    let filename = crate::security::validate_filename(&filename)?;
    let lower_name = filename.to_ascii_lowercase();
    if !lower_name.ends_with(".jar") && !lower_name.ends_with(".jar.disabled") {
        return Err("Only .jar mods can be enabled or disabled".to_string());
    }

    let current_enabled = lower_name.ends_with(".jar");
    if current_enabled == enabled {
        return Ok(());
    }

    let target_filename = if enabled {
        filename[..filename.len() - ".disabled".len()].to_string()
    } else {
        format!("{}.disabled", filename)
    };
    let source_path = crate::security::safe_join(&mods_dir, &filename)?;
    let target_path = crate::security::safe_join(&mods_dir, &target_filename)?;

    if !source_path.is_file() {
        return Err("Mod file not found".to_string());
    }
    if target_path.exists() {
        return Err(format!("A mod named '{}' already exists", target_filename));
    }

    std::fs::rename(source_path, target_path).map_err(|e| format!("Failed to toggle mod: {}", e))
}

#[derive(serde::Serialize)]
pub struct DiagnosticItem {
    pub key: String,
    pub label: String,
    pub status: String,
    pub details: String,
    pub fix: Option<String>,
}

#[derive(serde::Serialize)]
pub struct DiagnosticReport {
    pub instance_id: String,
    pub instance_name: String,
    pub items: Vec<DiagnosticItem>,
}

fn diagnostic(
    key: &str,
    label: &str,
    status: &str,
    details: String,
    fix: Option<&str>,
) -> DiagnosticItem {
    DiagnosticItem {
        key: key.to_string(),
        label: label.to_string(),
        status: status.to_string(),
        details,
        fix: fix.map(str::to_string),
    }
}

fn java_is_available(path: &str) -> bool {
    if !path.trim().is_empty() {
        let java_path = Path::new(path);
        return java_path.exists()
            || java_path.join("bin").join("java.exe").exists()
            || java_path.join("bin").join("java").exists();
    }

    let mut cmd = std::process::Command::new(if cfg!(windows) { "java.exe" } else { "java" });
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    cmd.arg("-version").output().is_ok()
}

#[tauri::command]
pub async fn diagnose_instance(
    app: AppHandle,
    instance_id: String,
) -> Result<DiagnosticReport, String> {
    crate::security::validate_instance_id(&instance_id)?;
    let instances = get_instances(app.clone()).await?;
    let instance = instances
        .into_iter()
        .find(|instance| instance.id == instance_id)
        .ok_or_else(|| "Instance not found".to_string())?;
    let settings = crate::settings::get_settings(app)?;
    let instance_path = crate::security::instance_dir(&instance_id)?;
    let mut items = Vec::new();

    items.push(if instance_path.is_dir() {
        diagnostic(
            "instance_dir",
            "Папка сборки",
            "ok",
            instance_path.display().to_string(),
            None,
        )
    } else {
        diagnostic(
            "instance_dir",
            "Папка сборки",
            "error",
            "Папка сборки не найдена".to_string(),
            Some("Откройте папку сборки или переустановите сборку"),
        )
    });

    items.push(if !instance.game_version.trim().is_empty() {
        diagnostic(
            "game_version",
            "Версия Minecraft",
            "ok",
            instance.game_version.clone(),
            None,
        )
    } else {
        diagnostic(
            "game_version",
            "Версия Minecraft",
            "error",
            "Версия не указана".to_string(),
            Some("Укажите версию в настройках сборки"),
        )
    });

    let supported_loader = matches!(
        instance.loader_type.as_str(),
        "Vanilla" | "Fabric" | "Forge" | "Quilt" | "NeoForge"
    );
    items.push(if supported_loader {
        diagnostic(
            "loader",
            "Загрузчик",
            "ok",
            if instance.loader_type == "Vanilla" {
                "Vanilla".to_string()
            } else {
                format!("{} {}", instance.loader_type, instance.loader_version)
            },
            None,
        )
    } else {
        diagnostic(
            "loader",
            "Загрузчик",
            "error",
            format!("Неизвестный загрузчик: {}", instance.loader_type),
            Some("Выберите поддерживаемый загрузчик в настройках сборки"),
        )
    });

    let java_path = instance
        .java_path
        .as_deref()
        .filter(|path| !path.trim().is_empty())
        .unwrap_or(&settings.java_path);
    items.push(if java_is_available(java_path) {
        diagnostic(
            "java",
            "Java",
            "ok",
            if java_path.trim().is_empty() {
                "Найдена в PATH".to_string()
            } else {
                java_path.to_string()
            },
            None,
        )
    } else {
        diagnostic(
            "java",
            "Java",
            "error",
            if java_path.trim().is_empty() {
                "Java не найдена в PATH".to_string()
            } else {
                format!("Путь не существует: {}", java_path)
            },
            Some("Установите Java или выберите корректный путь в настройках"),
        )
    });

    let min_memory = instance.min_memory.unwrap_or(settings.min_memory);
    let max_memory = instance.max_memory.unwrap_or(settings.max_memory);
    items.push(if min_memory <= max_memory && max_memory >= 1024 {
        diagnostic(
            "memory",
            "Память",
            "ok",
            format!("{}–{} МБ", min_memory, max_memory),
            None,
        )
    } else {
        diagnostic(
            "memory",
            "Память",
            "warning",
            format!("Некорректный диапазон: {}–{} МБ", min_memory, max_memory),
            Some("Проверьте минимальный и максимальный объём RAM"),
        )
    });

    let mods_path = instance_path.join("mods");
    let (active_mods, disabled_mods) = if mods_path.is_dir() {
        fs::read_dir(&mods_path)
            .ok()
            .into_iter()
            .flatten()
            .flatten()
            .filter_map(|entry| entry.file_name().into_string().ok())
            .fold((0, 0), |(active, disabled), filename| {
                if filename.to_ascii_lowercase().ends_with(".jar.disabled") {
                    (active, disabled + 1)
                } else if filename.to_ascii_lowercase().ends_with(".jar") {
                    (active + 1, disabled)
                } else {
                    (active, disabled)
                }
            })
    } else {
        (0, 0)
    };
    items.push(diagnostic(
        "mods",
        "Моды",
        "ok",
        format!("Активных: {}, отключённых: {}", active_mods, disabled_mods),
        None,
    ));

    Ok(DiagnosticReport {
        instance_id,
        instance_name: instance.name,
        items,
    })
}

#[tauri::command]
pub async fn delete_mod(instance_id: String, filename: String) -> Result<(), String> {
    let mut path = crate::security::instance_dir(&instance_id)?;
    path.push("mods");
    let filename = crate::security::validate_filename(&filename)?;
    path = crate::security::safe_join(&path, &filename)?;

    std::fs::remove_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_installed_resourcepacks(instance_id: String) -> Result<Vec<ModInfo>, String> {
    let mut path = crate::security::instance_dir(&instance_id)?;
    path.push("resourcepacks");

    let mut packs = Vec::new();
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    let filename = entry.file_name().to_string_lossy().to_string();
                    if filename.ends_with(".zip") {
                        packs.push(ModInfo {
                            filename,
                            size: metadata.len(),
                            enabled: true,
                        });
                    }
                }
            }
        }
    }
    Ok(packs)
}

#[tauri::command]
pub async fn delete_resourcepack(instance_id: String, filename: String) -> Result<(), String> {
    let mut path = crate::security::instance_dir(&instance_id)?;
    path.push("resourcepacks");
    let filename = crate::security::validate_filename(&filename)?;
    path = crate::security::safe_join(&path, &filename)?;

    std::fs::remove_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_installed_shaders(instance_id: String) -> Result<Vec<ModInfo>, String> {
    let mut path = crate::security::instance_dir(&instance_id)?;
    path.push("shaderpacks");

    let mut shaders = Vec::new();
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    let filename = entry.file_name().to_string_lossy().to_string();
                    if filename.ends_with(".zip") {
                        shaders.push(ModInfo {
                            filename,
                            size: metadata.len(),
                            enabled: true,
                        });
                    }
                }
            }
        }
    }
    Ok(shaders)
}

#[tauri::command]
pub async fn delete_shader(instance_id: String, filename: String) -> Result<(), String> {
    let mut path = crate::security::instance_dir(&instance_id)?;
    path.push("shaderpacks");
    let filename = crate::security::validate_filename(&filename)?;
    path = crate::security::safe_join(&path, &filename)?;

    std::fs::remove_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_instance_played(app: AppHandle, id: String) -> Result<(), String> {
    crate::security::validate_instance_id(&id)?;
    let _guard = INSTANCES_MUTEX
        .lock()
        .map_err(|_| "Failed to lock instances mutex".to_string())?;
    let mut instances = read_instances_unlocked(&app)?;

    for instance in instances.iter_mut() {
        if instance.id == id {
            instance.last_played = Some(
                SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64,
            );
            break;
        }
    }

    let found = instances.iter().any(|instance| instance.id == id);
    if !found {
        return Err("Инстанс не найден".to_string());
    }

    let path = get_instances_file(&app)?;
    let data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;
    crate::storage::atomic_write(&path, data.as_bytes())?;

    Ok(())
}

#[tauri::command]
pub async fn edit_instance(
    app: AppHandle,
    id: String,
    name: String,
    game_version: String,
    loader_type: String,
    loader_version: String,
) -> Result<(), String> {
    crate::security::validate_instance_id(&id)?;
    let _guard = INSTANCES_MUTEX
        .lock()
        .map_err(|_| "Failed to lock instances mutex".to_string())?;
    let mut instances = read_instances_unlocked(&app)?;

    for instance in instances.iter_mut() {
        if instance.id == id {
            instance.name = name;
            instance.game_version = game_version;
            instance.loader_type = loader_type;
            instance.loader_version = loader_version;
            break;
        }
    }

    let found = instances.iter().any(|instance| instance.id == id);
    if !found {
        return Err("Инстанс не найден".to_string());
    }

    let path = get_instances_file(&app)?;
    let data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;
    crate::storage::atomic_write(&path, data.as_bytes())?;

    Ok(())
}

pub async fn update_loader_version(
    app: &AppHandle,
    id: &str,
    loader_version: &str,
) -> Result<(), String> {
    let _guard = INSTANCES_MUTEX
        .lock()
        .map_err(|_| "Failed to lock instances mutex".to_string())?;
    let mut instances = read_instances_unlocked(app)?;

    let mut found = false;
    for instance in instances.iter_mut() {
        if instance.id == id {
            instance.loader_version = loader_version.to_string();
            found = true;
            break;
        }
    }

    if !found {
        return Err("Инстанс не найден".to_string());
    }

    let path = get_instances_file(app)?;
    let data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;
    crate::storage::atomic_write(&path, data.as_bytes())?;

    Ok(())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn save_instance_settings(
    app: AppHandle,
    id: String,
    min_memory: Option<u32>,
    max_memory: Option<u32>,
    java_path: Option<String>,
    jvm_args: Option<String>,
    window_width: Option<u32>,
    window_height: Option<u32>,
) -> Result<(), String> {
    crate::security::validate_instance_id(&id)?;
    let _guard = INSTANCES_MUTEX
        .lock()
        .map_err(|_| "Failed to lock instances mutex".to_string())?;
    let mut instances = read_instances_unlocked(&app)?;

    for instance in instances.iter_mut() {
        if instance.id == id {
            instance.min_memory = min_memory;
            instance.max_memory = max_memory;
            instance.java_path = java_path;
            instance.jvm_args = jvm_args;
            instance.window_width = window_width;
            instance.window_height = window_height;
            break;
        }
    }

    let found = instances.iter().any(|instance| instance.id == id);
    if !found {
        return Err("Инстанс не найден".to_string());
    }

    if let (Some(min), Some(max)) = (min_memory, max_memory) {
        if min < 256 || max < min || max > 65_536 {
            return Err("Некорректный диапазон памяти инстанса".to_string());
        }
    }
    if window_width.is_some_and(|v| !(400..=7680).contains(&v))
        || window_height.is_some_and(|v| !(300..=4320).contains(&v))
    {
        return Err("Некорректный размер окна инстанса".to_string());
    }

    let path = get_instances_file(&app)?;
    let data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;
    crate::storage::atomic_write(&path, data.as_bytes())?;

    Ok(())
}
#[tauri::command]
pub async fn install_mod_jar(_app: AppHandle, id: String, jar_path: String) -> Result<(), String> {
    let mut path = crate::security::instance_dir(&id)?;
    path.push("mods");

    fs::create_dir_all(&path).map_err(|e| e.to_string())?;

    let raw_name = PathBuf::from(&jar_path)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid jar path")?
        .to_string();
    let file_name = crate::security::sanitize_filename(&raw_name);

    path = crate::security::safe_join(&path, &file_name)?;
    copy_user_file_no_overwrite(Path::new(&jar_path), &path)?;

    Ok(())
}
#[tauri::command]
pub async fn open_instance_folder(id: String) -> Result<(), String> {
    let path = crate::security::instance_dir(&id)?;

    // Attempt to open the directory
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn open_instance_logs(id: String) -> Result<(), String> {
    let mut path = crate::security::instance_dir(&id)?;
    path.push("logs");

    let _ = std::fs::create_dir_all(&path);

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn open_launcher_folder() -> Result<(), String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("RedPandaLauncher");

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn open_logs_folder() -> Result<(), String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push("logs");

    // Create the logs folder if it doesn't exist, otherwise opening it will fail
    let _ = fs::create_dir_all(&path);

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn install_resourcepack_zip(
    _app: AppHandle,
    id: String,
    zip_path: String,
) -> Result<(), String> {
    let mut path = crate::security::instance_dir(&id)?;
    path.push("resourcepacks");

    fs::create_dir_all(&path).map_err(|e| e.to_string())?;

    let raw_name = std::path::PathBuf::from(&zip_path)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid zip path")?
        .to_string();
    let file_name = crate::security::sanitize_filename(&raw_name);

    path = crate::security::safe_join(&path, &file_name)?;
    copy_user_file_no_overwrite(Path::new(&zip_path), &path)?;

    Ok(())
}

#[tauri::command]
pub async fn install_shader_zip(
    _app: AppHandle,
    id: String,
    zip_path: String,
) -> Result<(), String> {
    let mut path = crate::security::instance_dir(&id)?;
    path.push("shaderpacks");

    fs::create_dir_all(&path).map_err(|e| e.to_string())?;

    let raw_name = std::path::PathBuf::from(&zip_path)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid zip path")?
        .to_string();
    let file_name = crate::security::sanitize_filename(&raw_name);

    path = crate::security::safe_join(&path, &file_name)?;
    copy_user_file_no_overwrite(Path::new(&zip_path), &path)?;

    Ok(())
}

#[tauri::command]
pub async fn rename_instance(app: AppHandle, id: String, new_name: String) -> Result<(), String> {
    crate::security::validate_instance_id(&id)?;
    let _guard = INSTANCES_MUTEX
        .lock()
        .map_err(|_| "Failed to lock instances mutex".to_string())?;
    let path = get_instances_file(&app)?;
    if !path.exists() {
        return Err("Instances file not found".into());
    }

    let mut instances: Vec<Instance> = crate::storage::read_json_with_backup(&path)?;

    if let Some(instance) = instances.iter_mut().find(|i| i.id == id) {
        instance.name = new_name;
    } else {
        return Err("Instance not found".into());
    }

    let updated_data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;
    crate::storage::atomic_write(&path, updated_data.as_bytes())?;

    Ok(())
}

#[tauri::command]
pub async fn set_instance_icon(
    app: AppHandle,
    id: String,
    icon_path: String,
) -> Result<(), String> {
    let _guard = INSTANCES_MUTEX
        .lock()
        .map_err(|_| "Failed to lock instances mutex".to_string())?;
    crate::security::validate_instance_id(&id)?;
    let inst_dir = crate::security::instance_dir(&id)?;

    fs::create_dir_all(&inst_dir).map_err(|e| e.to_string())?;

    // Copy icon to instance directory
    let ext = std::path::Path::new(&icon_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let dest_filename = format!("icon.{}", ext);
    let dest_path = inst_dir.join(&dest_filename);

    fs::copy(&icon_path, &dest_path).map_err(|e| e.to_string())?;

    let path = get_instances_file(&app)?;
    let mut instances: Vec<Instance> = crate::storage::read_json_with_backup(&path)?;

    if let Some(instance) = instances.iter_mut().find(|i| i.id == id) {
        instance.icon_path = Some(dest_path.to_string_lossy().into_owned());
    } else {
        return Err("Instance not found".to_string());
    }

    let updated_data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;
    crate::storage::atomic_write(&path, updated_data.as_bytes())?;

    Ok(())
}

#[tauri::command]
pub async fn export_instance(app: AppHandle, id: String, dest_path: String) -> Result<(), String> {
    let inst_dir = crate::security::instance_dir(&id)?;

    if !inst_dir.exists() {
        return Err("Instance folder not found".into());
    }

    let is_mrpack = dest_path.to_lowercase().ends_with(".mrpack");
    let mut instance_name = "Exported Pack".to_string();
    let mut game_version = "1.20.1".to_string();
    let mut loader_type = "Fabric".to_string();
    let mut loader_version = "0.14.21".to_string();

    if is_mrpack {
        // Load instance details
        let path = get_instances_file(&app)?;
        let instances: Vec<Instance> = crate::storage::read_json_with_backup(&path)?;
        if let Some(inst) = instances.iter().find(|i| i.id == id) {
            instance_name = inst.name.clone();
            game_version = inst.game_version.clone();
            loader_type = inst.loader_type.clone();
            loader_version = inst.loader_version.clone();
        }
    }

    let file = std::fs::File::create(&dest_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    if is_mrpack {
        use std::io::Write;

        let mut deps = serde_json::Map::new();
        deps.insert(
            "minecraft".to_string(),
            serde_json::Value::String(game_version),
        );

        if loader_type != "Vanilla" {
            let loader_key = format!("{}-loader", loader_type.to_lowercase());
            deps.insert(loader_key, serde_json::Value::String(loader_version));
        }

        let index = serde_json::json!({
            "formatVersion": 1,
            "game": "minecraft",
            "versionId": "1.0.0",
            "name": instance_name,
            "dependencies": deps,
            "files": []
        });

        zip.start_file("modrinth.index.json", options)
            .map_err(|e| e.to_string())?;
        let json_str = serde_json::to_string_pretty(&index).unwrap_or_else(|_| "{}".to_string());
        zip.write_all(json_str.as_bytes())
            .map_err(|e| e.to_string())?;
    }

    let walkdir = walkdir::WalkDir::new(&inst_dir);
    let it = walkdir.into_iter().filter_map(|e| e.ok());

    for entry in it {
        let path = entry.path();
        let name = path.strip_prefix(&inst_dir).unwrap();
        let mut name_str = name.to_string_lossy().replace("\\", "/");

        if is_mrpack && !name_str.is_empty() {
            name_str = format!("overrides/{}", name_str);
        }

        if path.is_file() {
            zip.start_file(name_str, options)
                .map_err(|e| e.to_string())?;
            let mut f = std::fs::File::open(path).map_err(|e| e.to_string())?;
            std::io::copy(&mut f, &mut zip).map_err(|e| e.to_string())?;
        } else if !name.as_os_str().is_empty() {
            zip.add_directory(name_str, options)
                .map_err(|e| e.to_string())?;
        }
    }

    if is_mrpack {
        // Make sure overrides directory exists explicitly if it was empty
        let _ = zip.add_directory("overrides/", options);
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn add_play_time(app: AppHandle, id: String, elapsed_seconds: u64) -> Result<(), String> {
    crate::security::validate_instance_id(&id)?;
    let _guard = INSTANCES_MUTEX
        .lock()
        .map_err(|_| "Failed to lock instances mutex".to_string())?;
    let mut instances = read_instances_unlocked(&app)?;
    if let Some(instance) = instances.iter_mut().find(|i| i.id == id) {
        let current = instance.total_play_time_seconds.unwrap_or(0);
        instance.total_play_time_seconds = Some(current + elapsed_seconds);

        let path = get_instances_file(&app)?;
        let data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;
        crate::storage::atomic_write(&path, data.as_bytes())?;
    } else {
        return Err("Инстанс не найден".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn get_instance_icon(id: String) -> Result<Option<String>, String> {
    crate::security::validate_instance_id(&id)?;
    let inst_dir = crate::security::instance_dir(&id)?;
    for ext in ["png", "jpg", "jpeg", "webp"] {
        let icon_file = inst_dir.join(format!("icon.{}", ext));
        if icon_file.exists() {
            if let Ok(bytes) = fs::read(&icon_file) {
                let mime = match ext {
                    "jpg" | "jpeg" => "image/jpeg",
                    "webp" => "image/webp",
                    _ => "image/png",
                };
                let b64 = BASE64.encode(&bytes);
                return Ok(Some(format!("data:{};base64,{}", mime, b64)));
            }
        }
    }
    Ok(None)
}

#[tauri::command]
pub async fn create_instance_shortcut(app: AppHandle, id: String) -> Result<String, String> {
    crate::security::validate_instance_id(&id)?;
    let _guard = INSTANCES_MUTEX
        .lock()
        .map_err(|_| "Failed to lock instances mutex".to_string())?;

    let instances = read_instances_unlocked(&app)?;
    let instance = instances
        .into_iter()
        .find(|i| i.id == id)
        .ok_or_else(|| format!("Инстанс '{}' не найден", id))?;

    let desktop = dirs::desktop_dir().ok_or("Не удалось определить путь к рабочему столу")?;
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Не удалось определить путь к исполняемому файлу: {e}"))?;

    let safe_name = crate::security::sanitize_filename(&instance.name);
    let shortcut_path = desktop.join(format!("{}.lnk", safe_name));

    let work_dir = current_exe.parent().unwrap_or(&desktop);
    let icon_location = format!("{},0", current_exe.to_string_lossy());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let script = format!(
            "$ws = New-Object -ComObject WScript.Shell; \
             $s = $ws.CreateShortcut('{}'); \
             $s.TargetPath = '{}'; \
             $s.Arguments = '--launch-instance \"{}\"'; \
             $s.WorkingDirectory = '{}'; \
             $s.IconLocation = '{}'; \
             $s.Description = 'Запуск сборки {} в RedPanda Launcher'; \
             $s.Save();",
            shortcut_path.to_string_lossy().replace('\'', "''"),
            current_exe.to_string_lossy().replace('\'', "''"),
            id.replace('"', "\\\""),
            work_dir.to_string_lossy().replace('\'', "''"),
            icon_location.replace('\'', "''"),
            instance.name.replace('\'', "''"),
        );

        let output = std::process::Command::new("powershell.exe")
            .creation_flags(0x08000000)
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .output()
            .map_err(|e| format!("Ошибка вызова PowerShell: {e}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Ошибка создания ярлыка: {stderr}"));
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        return Err("Создание ярлыков на рабочем столе поддерживается только на Windows".to_string());
    }

    log::info!(
        "Shortcut created for instance '{}' at: {}",
        id,
        shortcut_path.display()
    );
    Ok(shortcut_path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transliterate_to_ascii() {
        assert_eq!(transliterate_to_ascii("Сборка: Магия & Приключения"), "sborka-magiya-priklyucheniya");
        assert_eq!(transliterate_to_ascii("Мой Сервер 1.20"), "moy-server-1.20");
        assert_eq!(transliterate_to_ascii("Vanilla Fabric"), "vanilla-fabric");
    }

    #[test]
    fn test_generate_instance_id_ascii() {
        let existing = vec![];
        let id = generate_instance_id("Сборка: Магия & Приключения", &existing);
        assert_eq!(id, "sborka-magiya-priklyucheniya");
        assert!(id.is_ascii());
    }
}
