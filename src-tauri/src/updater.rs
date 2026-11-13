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
    #[serde(default)]
    pub size: Option<u64>,
}

const CURRENT_VERSION: &str = env!("REDPANDA_VERSION");

/// Set by build.rs. Builds packaged without the real update public key embed the
/// RFC 8032 test vector whose private half is public knowledge, so they must not
/// accept automatic updates at all.
const UPDATE_KEY_IS_TEST: &str = env!("REDPANDA_UPDATE_KEY_IS_TEST");

fn automatic_updates_disabled() -> bool {
    UPDATE_KEY_IS_TEST == "1"
}

#[tauri::command]
pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    log::info!("Checking for RedPanda Launcher updates on GitHub...");

    let client =
        crate::downloads::trusted_download_client(&format!("RedPandaLauncher/{CURRENT_VERSION}"))?;

    let res = client
        .get("https://api.github.com/repos/t1m0nch1k/RedPanda-Launcher/releases/latest")
        .header("Accept", "application/vnd.github+json")
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

    // Try signed manifest first if both manifest and signature assets exist
    let manifest_asset = release
        .assets
        .iter()
        .find(|asset| asset.name == "update-manifest.json");
    let signature_asset = release
        .assets
        .iter()
        .find(|asset| asset.name == "update-manifest.json.sig");

    let mut signed_info = None;
    if let (Some(m_asset), Some(s_asset)) = (manifest_asset, signature_asset) {
        if !automatic_updates_disabled() {
            if let (Ok(m_resp), Ok(s_resp)) = (
                client.get(&m_asset.browser_download_url).send().await,
                client.get(&s_asset.browser_download_url).send().await,
            ) {
                if m_resp.status().is_success() && s_resp.status().is_success() {
                    if let (Ok(m_bytes), Ok(s_text)) = (m_resp.bytes().await, s_resp.text().await) {
                        if let Ok(manifest) = serde_json::from_slice::<UpdateManifest>(&m_bytes) {
                            if verify_manifest_signature(&m_bytes, &s_text).is_ok()
                                && manifest.version.trim_start_matches('v') == latest_tag
                                && !manifest.key_id.trim().is_empty()
                                && manifest.sha256.len() == 64
                                && manifest.sha256.chars().all(|c| c.is_ascii_hexdigit())
                                && manifest.size > 0
                            {
                                let expected_asset_name =
                                    format!("RedPanda_Setup_{latest_tag}.exe");
                                if manifest.asset_name == expected_asset_name {
                                    if let Ok(m_json) = String::from_utf8(m_bytes.to_vec()) {
                                        signed_info = Some((
                                            manifest.download_url,
                                            Some(manifest.sha256),
                                            Some(manifest.asset_name),
                                            Some(manifest.size),
                                            Some(manifest.key_id),
                                            Some(s_text.trim().to_string()),
                                            Some(m_json),
                                        ));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let (download_url, checksum, asset_name, size, key_id, signature, manifest_json) =
        if let Some(info) = signed_info {
            info
        } else {
            // Find installer asset directly from release assets
            let expected_exact_name = format!("RedPanda_Setup_{latest_tag}.exe");
            let installer_asset = release
                .assets
                .iter()
                .find(|asset| asset.name == expected_exact_name)
                .or_else(|| {
                    release.assets.iter().find(|asset| {
                        asset.name.starts_with("RedPanda_Setup_") && asset.name.ends_with(".exe")
                    })
                })
                .or_else(|| {
                    release
                        .assets
                        .iter()
                        .find(|asset| asset.name.ends_with(".exe") || asset.name.ends_with(".msi"))
                });

            if let Some(asset) = installer_asset {
                let mut sha256_val = None;
                let sha256_name = format!("{}.sha256", asset.name);
                if let Some(sha_asset) = release.assets.iter().find(|a| a.name == sha256_name) {
                    if let Ok(resp) = client.get(&sha_asset.browser_download_url).send().await {
                        if resp.status().is_success() {
                            if let Ok(text) = resp.text().await {
                                if let Some(token) = text.split_whitespace().next() {
                                    let token = token.trim();
                                    if token.len() == 64
                                        && token.chars().all(|c| c.is_ascii_hexdigit())
                                    {
                                        sha256_val = Some(token.to_lowercase());
                                    }
                                }
                            }
                        }
                    }
                }

                (
                    asset.browser_download_url.clone(),
                    sha256_val,
                    Some(asset.name.clone()),
                    asset.size,
                    None,
                    None,
                    None,
                )
            } else {
                (String::new(), None, None, None, None, None, None)
            }
        };

    let has_update = has_newer_version && !download_url.is_empty();
    let release_notes = release
        .body
        .unwrap_or_else(|| "Описание отсутствует".to_string());

    Ok(UpdateInfo {
        has_update,
        current_version: CURRENT_VERSION.to_string(),
        latest_version: latest_tag,
        release_notes,
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
        return Err("Недоверенный источник обновления. Обновления разрешены только из официальных релизов GitHub проекта.".to_string());
    }

    // If signed manifest is provided and not test key, verify signature & values
    if let (Some(ref manifest_str), Some(ref sig_str)) = (&expected_manifest, &expected_signature) {
        if !sig_str.trim().is_empty() && !automatic_updates_disabled() {
            verify_manifest_signature(manifest_str.as_bytes(), sig_str)?;
            let manifest: UpdateManifest = serde_json::from_str(manifest_str)
                .map_err(|e| format!("Некорректный подписанный manifest обновления: {e}"))?;

            if !is_version_newer(manifest.version.trim_start_matches('v'), CURRENT_VERSION) {
                return Err(format!(
                    "Отказ от обновления: подписанный manifest описывает версию {}, которая не новее текущей {} (защита от даунгрейда).",
                    manifest.version, CURRENT_VERSION
                ));
            }
            if manifest.download_url != download_url {
                return Err("Параметры обновления не совпадают с подписанным manifest".to_string());
            }
        }
    }

    // Downgrade protection & version check from asset name or url
    let candidate_name = expected_asset_name
        .as_deref()
        .or_else(|| parsed_url.path_segments().and_then(|mut s| s.next_back()));
    if let Some(name) = candidate_name {
        if let Some(ver_str) = name
            .strip_prefix("RedPanda_Setup_")
            .and_then(|s| s.strip_suffix(".exe").or_else(|| s.strip_suffix(".msi")))
        {
            if !is_version_newer(ver_str.trim_start_matches('v'), CURRENT_VERSION) {
                return Err(format!(
                    "Отказ от обновления: версия {} не новее текущей {} (защита от даунгрейда).",
                    ver_str, CURRENT_VERSION
                ));
            }
        }
    }

    let actual_asset_name = Url::parse(&download_url)
        .ok()
        .and_then(|url| url.path_segments()?.next_back().map(str::to_string))
        .unwrap_or_default();
    if let Some(ref expected) = expected_asset_name {
        if !actual_asset_name.is_empty() && !actual_asset_name.eq_ignore_ascii_case(expected) {
            return Err("Имя asset обновления не совпадает с ожидаемым".to_string());
        }
    }

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

    let valid_sha256 =
        expected_sha256.filter(|v| v.len() == 64 && v.chars().all(|c| c.is_ascii_hexdigit()));

    crate::downloads::download_to_file(
        &client,
        &download_url,
        &installer_path,
        valid_sha256.as_deref(),
    )
    .await?;

    if let Some(expected_size) = expected_size.filter(|s| *s > 0) {
        let downloaded_size = std::fs::metadata(&installer_path)
            .map_err(|e| format!("Не удалось проверить размер installer: {e}"))?
            .len();
        if downloaded_size != expected_size {
            let _ = std::fs::remove_file(&installer_path);
            return Err("Размер скачанного обновления не совпадает с ожидаемым".to_string());
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
        return Err("Скачанный файл не является корректным установщиком Windows".to_string());
    }

    // Windows keeps the file locked while the File handle is alive. Drop it
    // before spawning the installer to avoid ERROR_SHARING_VIOLATION (32).
    drop(file);

    log::info!("Installer saved to {:?}, launching...", installer_path);

    #[cfg(target_os = "windows")]
    {
        let mut cmd = if path.ends_with(".msi") {
            let mut command = Command::new("msiexec.exe");
            command.arg("/i").arg(&installer_path);
            command
        } else {
            Command::new(&installer_path)
        };
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct ReleaseVersion {
    major: u64,
    minor: u64,
    patch: u64,
    fix: u64,
}

/// Parses the release format used by this project: `vMAJOR.MINOR.PATCH` with
/// an optional `_fixN` suffix. GitHub tags such as `v0.3.0_fix2` are not
/// SemVer, so silently dropping their suffix makes a hotfix invisible.
fn parse_release_version(value: &str) -> Option<ReleaseVersion> {
    let value = value.trim().trim_start_matches('v');
    let (core, fix) = match value.split_once('_') {
        Some((core, suffix)) => {
            let fix = suffix.strip_prefix("fix")?.parse::<u64>().ok()?;
            (core, fix)
        }
        None => (value, 0),
    };
    let mut parts = core.split('.');
    let major = parts.next()?.parse::<u64>().ok()?;
    let minor = parts.next()?.parse::<u64>().ok()?;
    let patch = parts.next()?.parse::<u64>().ok()?;
    if parts.next().is_some() {
        return None;
    }
    Some(ReleaseVersion {
        major,
        minor,
        patch,
        fix,
    })
}

fn is_version_newer(latest: &str, current: &str) -> bool {
    match (
        parse_release_version(latest),
        parse_release_version(current),
    ) {
        (Some(latest), Some(current)) => latest > current,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_semantic_versions() {
        assert!(is_version_newer("0.3.0", "0.2.2"));
        assert!(!is_version_newer("0.2.2", "0.2.2"));
        assert!(!is_version_newer("0.2.1", "0.2.2"));
        assert!(is_version_newer("0.3.0_fix1", "0.3.0"));
        assert!(is_version_newer("v0.3.0_fix10", "v0.3.0_fix2"));
        assert!(is_version_newer("0.3.1", "0.3.0_fix99"));
        assert!(!is_version_newer("0.3.0", "0.3.0_fix1"));
        assert!(!is_version_newer("not-a-version", "0.3.0"));
    }

    #[test]
    fn rejects_invalid_manifest_signature() {
        assert!(verify_manifest_signature(b"redpanda", "not-a-signature").is_err());
    }

    #[test]
    fn extracts_version_from_asset_name() {
        let asset = "RedPanda_Setup_0.3.6.exe";
        let ver = asset
            .strip_prefix("RedPanda_Setup_")
            .and_then(|s| s.strip_suffix(".exe"));
        assert_eq!(ver, Some("0.3.6"));
        assert!(is_version_newer(ver.unwrap(), "0.3.5"));
    }
}
