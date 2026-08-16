use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use std::process::Command;
use tauri::AppHandle;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_notes: String,
    pub download_url: String,
    pub html_url: String,
}

#[derive(Deserialize, Debug)]
struct GithubRelease {
    pub tag_name: String,
    pub html_url: String,
    pub body: Option<String>,
    pub assets: Vec<GithubAsset>,
}

#[derive(Deserialize, Debug)]
struct GithubAsset {
    pub name: String,
    pub browser_download_url: String,
}

const CURRENT_VERSION: &str = "0.2.0";

#[tauri::command]
pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    log::info!("Checking for RedPanda Launcher updates on GitHub...");

    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 RedPandaLauncher/0.2.0")
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get("https://api.github.com/repos/t1m0nch1k/RedPanda-Launcher/releases/latest")
        .send()
        .await
        .map_err(|e| format!("Не удалось подключиться к GitHub API: {}", e))?;

    if res.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(UpdateInfo {
            has_update: false,
            current_version: CURRENT_VERSION.to_string(),
            latest_version: CURRENT_VERSION.to_string(),
            release_notes: "Релизы на GitHub пока не созданы.".to_string(),
            download_url: String::new(),
            html_url: "https://github.com/t1m0nch1k/RedPanda-Launcher/releases".to_string(),
        });
    }

    if res.status() == reqwest::StatusCode::FORBIDDEN {
        return Err("Превышен лимит анонимных запросов к GitHub API (403 Forbidden). Попробуйте позже.".to_string());
    }

    if !res.status().is_success() {
        return Err(format!("GitHub API вернул статус: {}", res.status()));
    }

    let release: GithubRelease = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse release response: {}", e))?;

    let latest_tag = release.tag_name.trim_start_matches('v').to_string();
    let current_tag = CURRENT_VERSION.trim_start_matches('v').to_string();

    let has_update = is_version_newer(&latest_tag, &current_tag);

    // Find setup exe or msi installer in assets
    let mut download_url = release.html_url.clone();
    for asset in &release.assets {
        if asset.name.to_lowercase().ends_with(".exe") || asset.name.to_lowercase().ends_with(".msi") {
            download_url = asset.browser_download_url.clone();
            break;
        }
    }

    Ok(UpdateInfo {
        has_update,
        current_version: CURRENT_VERSION.to_string(),
        latest_version: latest_tag,
        release_notes: release.body.unwrap_or_else(|| "Описание отсутствуют".to_string()),
        download_url,
        html_url: release.html_url,
    })
}

#[tauri::command]
pub async fn download_and_install_update(_app: AppHandle, download_url: String) -> Result<(), String> {
    if download_url.is_empty() || !download_url.starts_with("http") {
        return Err("Invalid download URL".to_string());
    }

    log::info!("Downloading update from: {}", download_url);

    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 RedPandaLauncher/0.1.5")
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download update: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Download failed with status: {}", res.status()));
    }

    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("Failed to read update bytes: {}", e))?;

    let temp_dir = std::env::temp_dir();
    let file_name = if download_url.ends_with(".msi") {
        "RedPanda_Setup_Update.msi"
    } else {
        "RedPanda_Setup_Update.exe"
    };
    let installer_path = temp_dir.join(file_name);

    let mut file = File::create(&installer_path).map_err(|e| format!("Failed to create temp installer file: {}", e))?;
    file.write_all(&bytes).map_err(|e| format!("Failed to write installer file: {}", e))?;

    log::info!("Installer saved to {:?}, launching...", installer_path);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = Command::new(&installer_path);
        cmd.creation_flags(0x08000000);
        cmd.spawn().map_err(|e| format!("Failed to launch installer: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new(&installer_path).spawn().map_err(|e| format!("Failed to launch installer: {}", e))?;
    }

    Ok(())
}

fn is_version_newer(latest: &str, current: &str) -> bool {
    let parse_ver = |v: &str| -> Vec<u32> {
        v.split('.')
            .filter_map(|p| p.parse::<u32>().ok())
            .collect()
    };

    let l_parts = parse_ver(latest);
    let c_parts = parse_ver(current);

    for i in 0..std::cmp::max(l_parts.len(), c_parts.len()) {
        let l = l_parts.get(i).cloned().unwrap_or(0);
        let c = c_parts.get(i).cloned().unwrap_or(0);
        if l > c {
            return true;
        }
        if l < c {
            return false;
        }
    }
    false
}
