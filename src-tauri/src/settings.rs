use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

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
    pub curseforge_api_key: String,
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
            curseforge_api_key: "".to_string(),
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
    let decrypted_key = crate::accounts::decrypt_secret(&data.curseforge_api_key);
    #[cfg(windows)]
    let needs_key_migration =
        !data.curseforge_api_key.is_empty() && !data.curseforge_api_key.starts_with("enc:dpapi:");
    #[cfg(not(windows))]
    let needs_key_migration = false;
    #[cfg(windows)]
    if needs_key_migration {
        data.curseforge_api_key = decrypted_key.clone();
        drop(_guard);
        save_settings(app.clone(), data.clone())?;
    }
    data.curseforge_api_key = decrypted_key;

    Ok(data)
}

pub(crate) fn get_curseforge_api_key(app: &AppHandle) -> Result<String, String> {
    let path = get_settings_file_path(app)?;
    if !path.exists() {
        return Ok(String::new());
    }
    let data: AppSettings = crate::storage::read_json_with_backup(&path)?;
    Ok(crate::accounts::decrypt_secret(&data.curseforge_api_key))
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let _guard = SETTINGS_MUTEX
        .lock()
        .map_err(|_| "Failed to acquire settings mutex lock".to_string())?;

    validate_settings(&settings)?;
    let mut settings = settings;
    let trimmed_key = settings.curseforge_api_key.trim();
    if !trimmed_key.is_empty() {
        settings.curseforge_api_key = crate::accounts::encrypt_secret(trimmed_key);
    } else {
        settings.curseforge_api_key = String::new();
    }
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
