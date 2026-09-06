use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_notes: String,
    pub download_url: String,
    pub html_url: String,
    pub sha256: Option<String>,
    pub asset_name: Option<String>,
    pub size: Option<u64>,
    pub signature: Option<String>,
    pub key_id: Option<String>,
    pub manifest_json: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct UpdateManifest {
    version: String,
    asset_name: String,
    sha256: String,
    size: u64,
    download_url: String,
    key_id: String,
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

const CURRENT_VERSION: &str = env!("REDPANDA_VERSION");

#[tauri::command]
pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    log::info!("Checking for RedPanda Launcher updates on GitHub...");

    let client =
        crate::downloads::trusted_download_client(&format!("RedPandaLauncher/{CURRENT_VERSION}"))?;

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
            sha256: None,
            asset_name: None,
            size: None,
            signature: None,
            key_id: None,
            manifest_json: None,
        });
    }

    if res.status() == reqwest::StatusCode::FORBIDDEN {
        return Err(
            "Превышен лимит анонимных запросов к GitHub API (403 Forbidden). Попробуйте позже."
                .to_string(),
        );
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

    let has_newer_version = is_version_newer(&latest_tag, &current_tag);

    let manifest_asset = release
        .assets
        .iter()
        .find(|asset| asset.name == "update-manifest.json");
    let signature_asset = release
        .assets
        .iter()
        .find(|asset| asset.name == "update-manifest.json.sig");
    let (manifest, signature, manifest_json) =
        if let (Some(manifest_asset), Some(signature_asset)) = (manifest_asset, signature_asset) {
            let manifest_response = client
                .get(&manifest_asset.browser_download_url)
                .send()
                .await
                .map_err(|e| format!("Не удалось загрузить manifest обновления: {e}"))?
                .error_for_status()
                .map_err(|e| format!("GitHub не отдал manifest обновления: {e}"))?;
            let manifest_bytes = manifest_response
                .bytes()
                .await
                .map_err(|e| format!("Не удалось прочитать manifest обновления: {e}"))?;
            let signature_response = client
                .get(&signature_asset.browser_download_url)
                .send()
                .await
                .map_err(|e| format!("Не удалось загрузить подпись обновления: {e}"))?
                .error_for_status()
                .map_err(|e| format!("GitHub не отдал подпись обновления: {e}"))?;
            let signature_text = signature_response
                .text()
                .await
                .map_err(|e| format!("Не удалось прочитать подпись обновления: {e}"))?;
            let manifest: UpdateManifest = serde_json::from_slice(&manifest_bytes)
                .map_err(|e| format!("Некорректный update manifest: {e}"))?;
            verify_manifest_signature(&manifest_bytes, &signature_text)?;
            if manifest.version.trim_start_matches('v') != latest_tag
                || manifest.key_id.trim().is_empty()
                || manifest.sha256.len() != 64
                || !manifest.sha256.chars().all(|c| c.is_ascii_hexdigit())
                || manifest.size == 0
            {
                return Err(
                    "Подписанный manifest обновления содержит некорректные данные".to_string(),
                );
            }
            let expected_asset_name = format!("RedPanda_Setup_{latest_tag}.exe");
            if manifest.asset_name != expected_asset_name {
                return Err("Manifest указывает неподдерживаемый installer asset".to_string());
            }
            let release_asset = release
                .assets
                .iter()
                .find(|asset| asset.name == manifest.asset_name)
                .ok_or_else(|| "Installer asset из manifest отсутствует в релизе".to_string())?;
            if release_asset.browser_download_url != manifest.download_url {
                return Err("URL installer в manifest не совпадает с asset релиза".to_string());
            }
            let manifest_json = String::from_utf8(manifest_bytes.to_vec())
                .map_err(|e| format!("Manifest обновления не является UTF-8: {e}"))?;
            (
                Some(manifest),
                Some(signature_text.trim().to_string()),
                Some(manifest_json),
            )
        } else {
            (None, None, None)
        };

    let has_update = has_newer_version && manifest.is_some() && signature.is_some();
    let (download_url, checksum, asset_name, size, key_id) = manifest
        .as_ref()
        .map(|m| {
            (
                m.download_url.clone(),
                Some(m.sha256.clone()),
                Some(m.asset_name.clone()),
                Some(m.size),
                Some(m.key_id.clone()),
            )
        })
        .unwrap_or_default();

    Ok(UpdateInfo {
        has_update,
        current_version: CURRENT_VERSION.to_string(),
        latest_version: latest_tag,
        release_notes: release
            .body
            .unwrap_or_else(|| "Описание отсутствуют".to_string()),
        download_url,
        html_url: release.html_url,
        sha256: checksum,
        asset_name,
        size,
        signature,
        key_id,
        manifest_json,
    })
}

#[tauri::command]
pub async fn download_and_install_update(
    _app: AppHandle,
    download_url: String,
    expected_sha256: Option<String>,
    expected_signature: Option<String>,
    expected_asset_name: Option<String>,
    expected_size: Option<u64>,
    expected_manifest: Option<String>,
) -> Result<(), String> {
    if download_url.is_empty() {
        return Err("Download URL is empty".to_string());
    }

    let expected_signature = expected_signature
        .filter(|signature| !signature.trim().is_empty())
        .ok_or_else(|| "Для обновления отсутствует цифровая подпись manifest".to_string())?;
    let expected_manifest = expected_manifest
        .ok_or_else(|| "Для обновления отсутствует подписанный manifest".to_string())?;
    verify_manifest_signature(expected_manifest.as_bytes(), &expected_signature)?;
    if let Some(asset_name) = expected_asset_name {
        let actual_asset_name = Url::parse(&download_url)
            .ok()
            .and_then(|url| url.path_segments()?.next_back().map(str::to_string))
            .unwrap_or_default();
        if actual_asset_name != asset_name {
            return Err("Имя asset обновления не совпадает с подписанным manifest".to_string());
        }
    }

    let parsed_url = Url::parse(&download_url).map_err(|_| "Invalid update URL".to_string())?;
    let path = parsed_url.path().to_lowercase();
    let has_supported_extension = path.ends_with(".exe") || path.ends_with(".msi");
    let is_valid_source = parsed_url.scheme() == "https"
        && has_supported_extension
        && ((parsed_url.host_str() == Some("github.com")
            && path.starts_with("/t1m0nch1k/redpanda-launcher/releases/download/"))
            || matches!(
                parsed_url.host_str(),
                Some("objects.githubusercontent.com")
                    | Some("github-releases.githubusercontent.com")
                    | Some("release-assets.githubusercontent.com")
            ));

    if !is_valid_source {
        return Err("Untrusted update source URL. Updates are only permitted from official GitHub releases.".to_string());
    }
    let expected_sha256 = expected_sha256
        .filter(|value| value.len() == 64 && value.chars().all(|c| c.is_ascii_hexdigit()))
        .ok_or_else(|| "Для обновления отсутствует корректный SHA-256 checksum".to_string())?;

    log::info!("Downloading update from: {}", download_url);

    let client = crate::downloads::trusted_download_client(&format!(
        "RedPandaLauncher/{}",
        env!("REDPANDA_VERSION")
    ))?;

    let temp_dir = std::env::temp_dir();
    let unique_suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let file_name = if path.ends_with(".msi") {
        format!("RedPanda_Setup_Update_{}.msi", unique_suffix)
    } else {
        format!("RedPanda_Setup_Update_{}.exe", unique_suffix)
    };
    let installer_path = temp_dir.join(file_name);

    crate::downloads::download_to_file(&client, &download_url, &installer_path, &expected_sha256)
        .await?;
    let downloaded_size = std::fs::metadata(&installer_path)
        .map_err(|e| format!("Не удалось проверить размер installer: {e}"))?
        .len();
    if let Some(expected_size) = expected_size {
        if downloaded_size != expected_size {
            let _ = std::fs::remove_file(&installer_path);
            return Err("Размер обновления не совпадает с подписанным manifest".to_string());
        }
    }

    let mut header = [0u8; 4];
    let mut file = File::open(&installer_path)
        .map_err(|e| format!("Не удалось открыть скачанный installer: {e}"))?;
    file.read_exact(&mut header)
        .map_err(|e| format!("Не удалось проверить скачанный installer: {e}"))?;
    let is_valid_installer = if path.ends_with(".msi") {
        header == [0xD0, 0xCF, 0x11, 0xE0]
    } else {
        header[..2] == *b"MZ"
    };
    if !is_valid_installer {
        let _ = std::fs::remove_file(&installer_path);
        return Err("Downloaded update is not a valid Windows installer".to_string());
    }

    // Windows keeps the file locked while the File handle is alive. Drop it
    // before spawning the installer to avoid ERROR_SHARING_VIOLATION (32).
    drop(file);

    log::info!("Installer saved to {:?}, launching...", installer_path);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = if path.ends_with(".msi") {
            let mut command = Command::new("msiexec.exe");
            command.arg("/i").arg(&installer_path);
            command
        } else {
            Command::new(&installer_path)
        };
        cmd.creation_flags(0x08000000);
        cmd.spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new(&installer_path)
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;
    }

    Ok(())
}

fn verify_manifest_signature(manifest: &[u8], encoded_signature: &str) -> Result<(), String> {
    let key_bytes = hex::decode(env!("REDPANDA_UPDATE_PUBLIC_KEY_HEX"))
        .map_err(|_| "Некорректный встроенный ключ подписи обновлений".to_string())?;
    let key_array: [u8; 32] = key_bytes
        .try_into()
        .map_err(|_| "Некорректный размер ключа подписи обновлений".to_string())?;
    let key = VerifyingKey::from_bytes(&key_array)
        .map_err(|_| "Некорректный встроенный ключ подписи обновлений".to_string())?;
    let signature_bytes = hex::decode(encoded_signature.trim())
        .or_else(|_| BASE64.decode(encoded_signature.trim()))
        .map_err(|_| "Некорректный формат подписи update manifest".to_string())?;
    let signature = Signature::from_slice(&signature_bytes)
        .map_err(|_| "Некорректный размер подписи update manifest".to_string())?;
    key.verify(manifest, &signature)
        .map_err(|_| "Подпись update manifest не прошла проверку".to_string())
}

fn is_version_newer(latest: &str, current: &str) -> bool {
    let parse_ver =
        |v: &str| -> Vec<u32> { v.split('.').filter_map(|p| p.parse::<u32>().ok()).collect() };

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_semantic_versions() {
        assert!(is_version_newer("0.3.0", "0.2.2"));
        assert!(!is_version_newer("0.2.2", "0.2.2"));
        assert!(!is_version_newer("0.2.1", "0.2.2"));
    }

    #[test]
    fn rejects_invalid_manifest_signature() {
        assert!(verify_manifest_signature(b"redpanda", "not-a-signature").is_err());
    }
}
