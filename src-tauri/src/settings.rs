use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

const CUSTOM_ASSETS_DIR: &str = "assets";
const MAX_CUSTOM_ASSET_BYTES: u64 = 20 * 1024 * 1024;

lazy_static! {
    static ref SETTINGS_MUTEX: Mutex<()> = Mutex::new(());
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default)]
pub struct AppSettings {
    pub java_path: String,
    pub min_memory: u32,
    pub max_memory: u32,
    pub window_width: u32,
    pub window_height: u32,
    pub fullscreen: bool,
    pub jvm_args: String,
    pub instances_sort_mode: String,
    pub launch_behavior: String,
    pub show_console: bool,
    pub aggressive_optimization: bool,
    pub show_snapshots: bool,
    pub theme: String,
    pub custom_bg_path: String,
    pub custom_bg_opacity: u32,
    pub custom_bg_blur: u32,
    pub custom_mascot_path: String,
    pub mascot_preset: String,
    pub accent_color: String,
    /// Legacy field kept only long enough to remove keys written by older
    /// launcher versions. It is never serialized or used for requests.
    #[serde(rename = "curseforge_api_key", default, skip_serializing)]
    pub legacy_curseforge_api_key: String,
    pub discord_rpc: bool,
    pub auto_backup_worlds: bool,
    pub telegram_url: String,
    pub github_url: String,
    pub website_url: String,
    pub tiktok_url: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            java_path: "".to_string(), // Empty means auto
            min_memory: 1024,
            max_memory: 4096,
            window_width: 854,
            window_height: 480,
            fullscreen: false,
            jvm_args: "-XX:+UseG1GC -Dsun.rmi.dgc.server.gcInterval=2147483646 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M".to_string(),
            instances_sort_mode: "last_played".to_string(),
            launch_behavior: "hide".to_string(),
            show_console: false,
            aggressive_optimization: false,
            show_snapshots: false,
            theme: "dark".to_string(),
            custom_bg_path: "".to_string(),
            custom_bg_opacity: 50,
            custom_bg_blur: 0,
            custom_mascot_path: "".to_string(),
            mascot_preset: "default".to_string(),
            accent_color: "#F55E1D".to_string(),
            legacy_curseforge_api_key: String::new(),
            discord_rpc: true,
            auto_backup_worlds: false,
            telegram_url: "https://t.me/redpanda_launcher".to_string(),
            github_url: "https://github.com/t1m0nch1k/RedPanda-Launcher".to_string(),
            website_url: "https://www.redlauncher.ru".to_string(),
            tiktok_url: "https://www.tiktok.com/@redpanda_launcher".to_string(),
        }
    }
}

fn get_settings_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Could not get app data dir: {}", e))?;

    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| format!("Could not create app data dir: {}", e))?;
    }

    path.push("settings.json");
    Ok(path)
}

fn custom_assets_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Could not get app local data dir: {e}"))?;
    fs::create_dir_all(&base).map_err(|e| format!("Could not create app local data dir: {e}"))?;
    let assets = crate::security::safe_join(&base, CUSTOM_ASSETS_DIR)?;
    fs::create_dir_all(&assets).map_err(|e| format!("Could not create custom assets dir: {e}"))?;
    Ok(assets)
}

fn is_supported_custom_asset(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase()),
        Some(extension) if matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "webp")
    )
}

/// Copies a user-selected image into the application data directory before it
/// is exposed through Tauri's asset protocol. This lets the CSP grant access
/// only to launcher-owned paths instead of every local file on the computer.
fn store_custom_asset(app: &AppHandle, source: &str, kind: &str) -> Result<String, String> {
    if source.trim().is_empty() {
        return Ok(String::new());
    }
    if !matches!(kind, "background" | "mascot") {
        return Err("Unknown custom asset type".to_string());
    }

    let source_path = PathBuf::from(source);
    if !source_path.is_absolute() {
        return Err("Custom image path must be absolute".to_string());
    }
    let source_path = fs::canonicalize(&source_path)
        .map_err(|e| format!("Could not resolve custom image path: {e}"))?;
    let metadata =
        fs::metadata(&source_path).map_err(|e| format!("Could not inspect custom image: {e}"))?;
    if !metadata.is_file() {
        return Err("Custom image must be a file".to_string());
    }
    if metadata.len() == 0 || metadata.len() > MAX_CUSTOM_ASSET_BYTES {
        return Err("Custom image must be between 1 byte and 20 MB".to_string());
    }
    if !is_supported_custom_asset(&source_path) {
        return Err("Custom image must be PNG, JPG, JPEG, or WebP".to_string());
    }

    let assets = custom_assets_dir(app)?;
    let canonical_assets = fs::canonicalize(&assets)
        .map_err(|e| format!("Could not resolve custom assets dir: {e}"))?;
    if source_path.starts_with(&canonical_assets) {
        return Ok(source_path.to_string_lossy().into_owned());
    }

    let extension = source_path
        .extension()
        .and_then(|extension| extension.to_str())
        .ok_or_else(|| "Custom image has no extension".to_string())?
        .to_ascii_lowercase();
    let file_name = format!("{kind}-{}.{}", uuid::Uuid::new_v4(), extension);
    let destination = crate::security::safe_join(&assets, &file_name)?;
    let temporary =
        crate::security::safe_join(&assets, &format!(".{kind}-{}.tmp", uuid::Uuid::new_v4()))?;
    fs::copy(&source_path, &temporary)
        .map_err(|e| format!("Could not copy custom image into launcher data: {e}"))?;
    if let Err(error) = fs::rename(&temporary, &destination) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Could not publish custom image: {error}"));
    }
    Ok(destination.to_string_lossy().into_owned())
}

fn migrate_custom_asset(app: &AppHandle, source: &mut String, kind: &str) -> bool {
    if source.trim().is_empty() {
        return false;
    }
    match store_custom_asset(app, source, kind) {
        Ok(stored) if stored != *source => {
            *source = stored;
            true
        }
        Ok(_) => false,
        Err(error) => {
            log::warn!("Removing unavailable custom {kind} image from settings: {error}");
            source.clear();
            true
        }
    }
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    let _guard = SETTINGS_MUTEX
        .lock()
        .map_err(|_| "Failed to acquire settings mutex lock".to_string())?;

    let path = get_settings_file_path(&app)?;

    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let mut data: AppSettings = crate::storage::read_json_with_backup(&path)?;
    validate_settings(&data)?;
    let has_legacy_curseforge_key = !data.legacy_curseforge_api_key.trim().is_empty();
    data.legacy_curseforge_api_key.clear();
    let mut needs_save = has_legacy_curseforge_key;
    needs_save |= migrate_custom_asset(&app, &mut data.custom_bg_path, "background");
    needs_save |= migrate_custom_asset(&app, &mut data.custom_mascot_path, "mascot");
    if needs_save {
        let data_to_save = data.clone();
        drop(_guard);
        save_settings(app.clone(), data_to_save)?;
    }

    Ok(data)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let _guard = SETTINGS_MUTEX
        .lock()
        .map_err(|_| "Failed to acquire settings mutex lock".to_string())?;

    validate_settings(&settings)?;
    let mut settings = settings;
    settings.custom_bg_path = store_custom_asset(&app, &settings.custom_bg_path, "background")?;
    settings.custom_mascot_path = store_custom_asset(&app, &settings.custom_mascot_path, "mascot")?;
    let path = get_settings_file_path(&app)?;
    let contents = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    crate::storage::atomic_write(&path, contents.as_bytes())
        .map_err(|e| format!("Failed to write settings.json: {e}"))
}

fn validate_settings(settings: &AppSettings) -> Result<(), String> {
    if settings.min_memory < 256 || settings.min_memory > 65_536 {
        return Err("Минимальная память должна быть от 256 до 65536 МБ".to_string());
    }
    if settings.max_memory < settings.min_memory || settings.max_memory > 65_536 {
        return Err(
            "Максимальная память должна быть не меньше минимальной и не больше 65536 МБ"
                .to_string(),
        );
    }
    if !(400..=7680).contains(&settings.window_width)
        || !(300..=4320).contains(&settings.window_height)
    {
        return Err("Некорректный размер окна".to_string());
    }
    if settings.custom_bg_opacity > 100 || settings.custom_bg_blur > 100 {
        return Err("Параметры изображения должны быть в диапазоне 0..100".to_string());
    }
    if !matches!(settings.theme.as_str(), "dark" | "light") {
        return Err("Неизвестная тема интерфейса".to_string());
    }
    if settings.jvm_args.len() > 8_192 {
        return Err("Строка JVM-параметров слишком длинная".to_string());
    }
    if !(settings.accent_color.is_empty()
        || (settings.accent_color.starts_with('#') && settings.accent_color.len() == 7))
    {
        return Err("Цвет акцента должен быть в формате #RRGGBB".to_string());
    }
    Ok(())
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct JavaInstallation {
    pub path: String,
    pub version: String,
    pub vendor: String,
}

#[tauri::command]
pub async fn find_java_installations() -> Result<Vec<JavaInstallation>, String> {
    let mut installations = Vec::new();

    // Check JAVA_HOME
    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        let exe_path = Path::new(&java_home).join("bin").join("java.exe");
        if exe_path.exists() {
            if let Some(info) = check_java(&exe_path) {
                installations.push(info);
            }
        }
    }

    // Common directories
    let base_dirs = vec![
        "C:\\Program Files\\Java",
        "C:\\Program Files (x86)\\Java",
        "C:\\Program Files\\AdoptOpenJDK",
        "C:\\Program Files\\Eclipse Adoptium",
        "C:\\Program Files\\Microsoft",
        "C:\\Program Files\\BellSoft",
    ];

    for dir in base_dirs {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let exe_path = path.join("bin").join("java.exe");
                    if exe_path.exists() {
                        if let Some(info) = check_java(&exe_path) {
                            // Avoid duplicates
                            if !installations.iter().any(|j| j.path == info.path) {
                                installations.push(info);
                            }
                        }
                    }
                }
            }
        }
    }

    #[cfg(windows)]
    for java_home in find_java_homes_in_registry() {
        let exe_path = java_home.join("bin").join("java.exe");
        if exe_path.exists() {
            if let Some(info) = check_java(&exe_path) {
                if !installations.iter().any(|j| j.path == info.path) {
                    installations.push(info);
                }
            }
        }
    }

    Ok(installations)
}

#[cfg(windows)]
fn find_java_homes_in_registry() -> Vec<PathBuf> {
    use std::os::windows::process::CommandExt;

    let mut homes = Vec::new();
    for key in [
        r"HKLM\SOFTWARE\JavaSoft",
        r"HKLM\SOFTWARE\WOW6432Node\JavaSoft",
        r"HKLM\SOFTWARE\Microsoft\JDK",
    ] {
        let mut command = Command::new("reg.exe");
        command.creation_flags(0x08000000);
        let Ok(output) = command.args(["query", key, "/s"]).output() else {
            continue;
        };
        for line in String::from_utf8_lossy(&output.stdout).lines() {
            let fields: Vec<&str> = line.splitn(3, "    ").collect();
            if fields.len() == 3 && fields[0].trim().eq_ignore_ascii_case("JavaHome") {
                let home = PathBuf::from(fields[2].trim());
                if !homes.iter().any(|candidate| candidate == &home) {
                    homes.push(home);
                }
            }
        }
    }
    homes
}

fn check_java(path: &Path) -> Option<JavaInstallation> {
    let mut cmd = Command::new(path);
    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let mut child = cmd
        .arg("-version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .ok()?;
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        if child.try_wait().ok()?.is_some() {
            break;
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            return None;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    let output = child.wait_with_output().ok()?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let output_str = format!("{}\n{}", stdout, stderr);

    // Extract version (e.g. java version "1.8.0_291" or openjdk version "17.0.1")
    let mut version = "Unknown".to_string();
    let mut vendor = "Unknown".to_string();

    for line in output_str.lines() {
        if line.contains("version \"") {
            if let Some(start) = line.find('"') {
                if let Some(end) = line[start + 1..].find('"') {
                    version = line[start + 1..start + 1 + end].to_string();
                }
            }
            if line.to_lowercase().starts_with("openjdk") {
                vendor = "OpenJDK".to_string();
            } else if line.to_lowercase().starts_with("java") {
                vendor = "Oracle".to_string();
            }
        }
        if line.contains("Temurin") {
            vendor = "Eclipse Temurin".to_string();
        } else if line.contains("Zulu") {
            vendor = "Azul Zulu".to_string();
        } else if line.contains("Microsoft") {
            vendor = "Microsoft".to_string();
        }
    }

    Some(JavaInstallation {
        path: path.to_string_lossy().to_string(),
        version,
        vendor,
    })
}
