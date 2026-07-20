use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager};

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
    let path = get_settings_file_path(&app)?;

    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let contents =
        fs::read_to_string(path).map_err(|e| format!("Failed to read settings.json: {}", e))?;
    let data: AppSettings = serde_json::from_str(&contents).unwrap_or_default();

    Ok(data)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = get_settings_file_path(&app)?;
    let contents = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(path, contents).map_err(|e| format!("Failed to write settings.json: {}", e))?;
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

    Ok(installations)
}

fn check_java(path: &Path) -> Option<JavaInstallation> {
    let output = Command::new(path).arg("-version").output().ok()?;

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
