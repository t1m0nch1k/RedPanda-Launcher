use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct GameVersion {
    pub id: String,
    pub r#type: String, // "release", "snapshot", etc.
}

#[derive(Serialize, Deserialize)]
struct MojangManifest {
    versions: Vec<GameVersion>,
}

#[tauri::command]
pub async fn get_minecraft_versions(
    app: tauri::AppHandle,
    include_snapshots: Option<bool>,
) -> Result<Vec<String>, String> {
    let client = crate::downloads::trusted_download_client(&format!(
        "RedPandaLauncher/{}",
        env!("REDPANDA_VERSION")
    ))?;
    let res = client
        .get("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let manifest: MojangManifest = res.json().await.map_err(|e| format!("JSON error: {}", e))?;

    let settings = crate::settings::get_settings(app).unwrap_or_default();
    let show_snapshots = include_snapshots.unwrap_or(settings.show_snapshots);

    // Return release versions or both release + snapshots
    let releases = manifest
        .versions
        .into_iter()
        .filter(|v| show_snapshots || v.r#type == "release")
        .map(|v| v.id)
        .filter(|id| {
            if id.starts_with("1.") {
                // Remove versions older than 1.7 for stability/support reasons
                let minor_part = id.strip_prefix("1.").unwrap_or("");
                let minor_str = minor_part
                    .split(|c: char| !c.is_ascii_digit())
                    .next()
                    .unwrap_or("");
                if let Ok(minor) = minor_str.parse::<u32>() {
                    return minor >= 7;
                }
                true
            } else {
                // Keep all modern versions (26.x, 27.x, 2.x) and all snapshots (24w..., 25w..., 26w..., etc.)
                true
            }
        })
        .collect();

    Ok(releases)
}

#[tauri::command]
pub async fn get_loader_versions(
    loader_type: String,
    game_version: String,
) -> Result<Vec<String>, String> {
    let client = crate::downloads::trusted_download_client(&format!(
        "RedPandaLauncher/{}",
        env!("REDPANDA_VERSION")
    ))?;

    match loader_type.as_str() {
        "Vanilla" => Ok(vec![]),
        "Fabric" => {
            let url = format!(
                "https://meta.fabricmc.net/v2/versions/loader/{}",
                game_version
            );
            let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
            let data: Vec<serde_json::Value> = res.json().await.map_err(|e| e.to_string())?;

            let mut versions = Vec::new();
            for item in data {
                if let Some(loader) = item.get("loader") {
                    if let Some(version) = loader.get("version").and_then(|v| v.as_str()) {
                        versions.push(version.to_string());
                    }
                }
            }
            Ok(versions)
        }
        "Quilt" => {
            let url = format!(
                "https://meta.quiltmc.org/v3/versions/loader/{}",
                game_version
            );
            let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
            let data: Vec<serde_json::Value> = res.json().await.map_err(|e| e.to_string())?;

            let mut versions = Vec::new();
            for item in data {
                if let Some(loader) = item.get("loader") {
                    if let Some(version) = loader.get("version").and_then(|v| v.as_str()) {
                        versions.push(version.to_string());
                    }
                }
            }
            Ok(versions)
        }
        "NeoForge" => {
            // NeoForge Maven API
            let url =
                "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";
            let res = client.get(url).send().await.map_err(|e| e.to_string())?;
            let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

            let mut versions = Vec::new();
            if let Some(versions_array) = data.get("versions").and_then(|v| v.as_array()) {
                for v in versions_array {
                    if let Some(ver) = v.as_str() {
                        // NeoForge versions are usually like 20.4.80 for 1.20.4, or 21.0.1 for 1.21.
                        // We filter them roughly based on game version.
                        let prefix = game_version.strip_prefix("1.").unwrap_or(&game_version); // "20.4"
                        if ver.starts_with(prefix) {
                            versions.push(ver.to_string());
                        }
                    }
                }
            }
            // Reverse so newest is first
            versions.reverse();
            Ok(versions)
        }
        "Forge" => {
            // Forge is tricky. A common approach is using BMCLAPI or just returning an empty list to let lighty-launcher handle it automatically (it auto-picks latest if empty).
            // For now, let's fetch from BMCLAPI which has a nice endpoint for forge versions per game version.
            let url = format!(
                "https://bmclapi2.bangbang93.com/forge/minecraft/{}",
                game_version
            );
            let res = client.get(&url).send().await.map_err(|e| e.to_string())?;

            if !res.status().is_success() {
                return Ok(vec![]);
            }

            let data: Vec<serde_json::Value> = res.json().await.map_err(|e| e.to_string())?;
            let mut versions = Vec::new();

            for item in data {
                if let Some(version) = item.get("version").and_then(|v| v.as_str()) {
                    versions.push(version.to_string());
                }
            }
            Ok(versions)
        }
        _ => Ok(vec![]),
    }
}

#[tauri::command]
pub async fn get_supported_game_versions(loader_type: String) -> Result<Vec<String>, String> {
    let client = crate::downloads::trusted_download_client(&format!(
        "RedPandaLauncher/{}",
        env!("REDPANDA_VERSION")
    ))?;

    match loader_type.as_str() {
        "Fabric" => {
            let url = "https://meta.fabricmc.net/v2/versions/game";
            let res = client.get(url).send().await.map_err(|e| e.to_string())?;
            let data: Vec<serde_json::Value> = res.json().await.map_err(|e| e.to_string())?;
            let mut versions = Vec::new();
            for item in data {
                if let Some(version) = item.get("version").and_then(|v| v.as_str()) {
                    versions.push(version.to_string());
                }
            }
            Ok(versions)
        }
        "Quilt" => {
            let url = "https://meta.quiltmc.org/v3/versions/game";
            let res = client.get(url).send().await.map_err(|e| e.to_string())?;
            let data: Vec<serde_json::Value> = res.json().await.map_err(|e| e.to_string())?;
            let mut versions = Vec::new();
            for item in data {
                if let Some(version) = item.get("version").and_then(|v| v.as_str()) {
                    versions.push(version.to_string());
                }
            }
            Ok(versions)
        }
        "Forge" => {
            let url = "https://bmclapi2.bangbang93.com/forge/minecraft";
            let res = client.get(url).send().await.map_err(|e| e.to_string())?;
            let data: Vec<String> = res.json().await.map_err(|e| e.to_string())?;
            let mut versions = data;
            // Forge API returns them in alphabetical order mostly. We should reverse them or just return.
            versions.reverse();
            Ok(versions)
        }
        "NeoForge" => {
            // NeoForge supports 1.20.1+ essentially. We'll fetch from maven and extract unique prefixes.
            let url =
                "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";
            let res = client.get(url).send().await.map_err(|e| e.to_string())?;
            let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

            let mut versions = Vec::new();
            if let Some(versions_array) = data.get("versions").and_then(|v| v.as_array()) {
                for v in versions_array {
                    if let Some(ver) = v.as_str() {
                        let parts: Vec<&str> = ver.split('.').collect();
                        if parts.len() >= 2 {
                            let major_num = parts[0].parse::<u32>().unwrap_or(0);
                            let mc_version = if major_num >= 26 {
                                if parts[1] == "0" {
                                    parts[0].to_string()
                                } else {
                                    format!("{}.{}", parts[0], parts[1])
                                }
                            } else if parts[1] == "0" {
                                format!("1.{}", parts[0])
                            } else {
                                format!("1.{}.{}", parts[0], parts[1])
                            };
                            if !versions.contains(&mc_version) {
                                versions.push(mc_version);
                            }
                        }
                    }
                }
            }
            versions.reverse();
            Ok(versions)
        }
        _ => Ok(vec![]), // Empty means all vanilla versions are supported
    }
}
