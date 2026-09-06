use reqwest::Url;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeSearchResult {
    pub id: u32,
    pub name: String,
    pub summary: String,
    pub logo: Option<CurseForgeLogo>,
    pub download_count: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeLogo {
    pub url: String,
    pub thumbnail_url: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct SearchResponse {
    data: Vec<CurseForgeSearchResult>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeFile {
    pub id: u32,
    pub mod_id: u32,
    pub display_name: String,
    pub file_name: String,
    pub release_type: u32, // 1 = Release, 2 = Beta, 3 = Alpha
    pub file_date: String,
    pub file_length: u64,
    pub download_url: Option<String>,
    pub game_versions: Vec<String>,
    pub dependencies: Option<Vec<CurseForgeDependency>>,
    pub hashes: Option<Vec<CurseForgeHash>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeHash {
    pub value: String,
    pub algo: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeDependency {
    pub mod_id: u32,
    pub relation_type: u32, // 3 = RequiredDependency
}

#[derive(Serialize, Deserialize, Debug)]
struct FilesResponse {
    data: Vec<CurseForgeFile>,
}

pub const DEFAULT_CURSEFORGE_API_KEY: &str =
    "$2a$10$QdP21DmwEcYxV.f.T1orWeyr7SB65NMbFxme2NGVEsEpyFeen44RK";

pub fn get_curseforge_api_key(app: &AppHandle) -> String {
    if let Ok(key) = std::env::var("CURSEFORGE_API_KEY") {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    if let Ok(key) = crate::settings::get_curseforge_api_key(app) {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    DEFAULT_CURSEFORGE_API_KEY.to_string()
}

pub(crate) async fn send_curseforge_request(
    app: &AppHandle,
    client: &reqwest::Client,
    method: reqwest::Method,
    url: &str,
    json_body: Option<&serde_json::Value>,
) -> Result<reqwest::Response, String> {
    let api_key = get_curseforge_api_key(app);

    let send = |key: &str| {
        let mut builder = client
            .request(method.clone(), url)
            .header("x-api-key", key)
            .header("Accept", "application/json");
        if let Some(body) = json_body {
            builder = builder.json(body);
        }
        builder.send()
    };

    let res = send(&api_key)
        .await
        .map_err(|e| format!("Ошибка подключения к CurseForge API: {}", e))?;

    // If custom key returned 401 or 403, fallback to DEFAULT_CURSEFORGE_API_KEY
    if (res.status() == reqwest::StatusCode::FORBIDDEN
        || res.status() == reqwest::StatusCode::UNAUTHORIZED)
        && api_key != DEFAULT_CURSEFORGE_API_KEY
    {
        log::warn!(
            "Кастомный API-ключ CurseForge вернул {}. Пробуем встроенный ключ лаунчера...",
            res.status()
        );
        if let Ok(fallback_res) = send(DEFAULT_CURSEFORGE_API_KEY).await {
            if fallback_res.status().is_success() {
                return Ok(fallback_res);
            }
        }
    }

    if !res.status().is_success() {
        let status = res.status();
        let error_text = res.text().await.unwrap_or_default();
        return Err(format!(
            "CurseForge API вернул ошибку {}: {}",
            status, error_text
        ));
    }

    Ok(res)
}

pub(crate) fn is_trusted_download_url(value: &str) -> bool {
    let Ok(url) = Url::parse(value) else {
        return false;
    };
    let Some(host) = url.host_str() else {
        return false;
    };
    url.scheme() == "https"
        && (host == "curseforge.com"
            || host.ends_with(".curseforge.com")
            || host == "forgecdn.net"
            || host.ends_with(".forgecdn.net"))
}

#[tauri::command]
pub async fn search_curseforge(
    app: AppHandle,
    query: String,
    game_version: String,
    class_id: u32, // 6 = Mods, 4471 = Modpacks, 12 = Resource Packs
    index: usize,
    page_size: usize,
) -> Result<Vec<CurseForgeSearchResult>, String> {
    let client = crate::downloads::trusted_download_client(&format!(
        "RedPandaLauncher/{}",
        env!("REDPANDA_VERSION")
    ))?;

    // CurseForge API documentation: https://docs.curseforge.com/
    // Endpoint: GET /v1/mods/search
    // gameId for Minecraft is 432

    let mut url = format!(
        "https://api.curseforge.com/v1/mods/search?gameId=432&classId={}&searchFilter={}&index={}&pageSize={}",
        class_id,
        urlencoding::encode(&query),
        index,
        page_size
    );
    if !game_version.is_empty() {
        url.push_str(&format!(
            "&gameVersion={}",
            urlencoding::encode(&game_version)
        ));
    }

    let res = send_curseforge_request(&app, &client, reqwest::Method::GET, &url, None).await?;

    let search_res: SearchResponse = res
        .json()
        .await
        .map_err(|e| format!("Не удалось распарсить ответ CurseForge: {}", e))?;

    Ok(search_res.data)
}

#[tauri::command]
pub async fn get_curseforge_versions(
    app: AppHandle,
    mod_id: u32,
    game_version: Option<String>,
) -> Result<Vec<CurseForgeFile>, String> {
    let client = crate::downloads::trusted_download_client(&format!(
        "RedPandaLauncher/{}",
        env!("REDPANDA_VERSION")
    ))?;

    let mut url = format!(
        "https://api.curseforge.com/v1/mods/{}/files?pageSize=50",
        mod_id
    );
    if let Some(gv) = game_version {
        if !gv.is_empty() {
            url.push_str(&format!("&gameVersion={}", urlencoding::encode(&gv)));
        }
    }

    let res = send_curseforge_request(&app, &client, reqwest::Method::GET, &url, None).await?;

    let files_res: FilesResponse = res
        .json()
        .await
        .map_err(|e| format!("Не удалось распарсить ответ CurseForge: {}", e))?;

    Ok(files_res.data)
}

#[tauri::command]
pub async fn get_curseforge_download_url(
    app: AppHandle,
    mod_id: u32,
    file_id: u32,
) -> Result<String, String> {
    let client = crate::downloads::trusted_download_client(&format!(
        "RedPandaLauncher/{}",
        env!("REDPANDA_VERSION")
    ))?;

    let url = format!(
        "https://api.curseforge.com/v1/mods/{}/files/{}/download-url",
        mod_id, file_id
    );

    let res = send_curseforge_request(&app, &client, reqwest::Method::GET, &url, None).await?;

    #[derive(Deserialize)]
    struct DownloadUrlResponse {
        data: Option<String>,
    }

    let parsed: DownloadUrlResponse = res
        .json()
        .await
        .map_err(|e| format!("Не удалось распарсить ссылку на скачивание: {}", e))?;

    parsed
        .data
        .filter(|u| !u.trim().is_empty())
        .ok_or_else(|| "Автор мода отключил прямое скачивание сторонними приложениями.".to_string())
}

#[tauri::command]
pub async fn download_curseforge_version(
    _app: AppHandle,
    instance_id: String,
    download_url: String,
    file_name: String,
    project_type: String,
    expected_sha1: Option<String>,
) -> Result<(), String> {
    const MAX_DOWNLOAD_BYTES: usize = 500 * 1024 * 1024; // 500 MB
    let instance_dir = crate::security::instance_dir(&instance_id)?;
    if !is_trusted_download_url(&download_url) {
        return Err("Untrusted CurseForge download URL".to_string());
    }
    let client = crate::downloads::trusted_download_client("RedPandaLauncher/1.0.0")?;

    let file_res = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Ошибка скачивания: {}", e))?;

    if !file_res.status().is_success() {
        return Err(format!("Ошибка скачивания: HTTP {}", file_res.status()));
    }

    if let Some(cl) = file_res.content_length() {
        if cl > (MAX_DOWNLOAD_BYTES as u64) {
            return Err(format!(
                "Размер файла превышает лимит 500 МБ: {} МБ",
                cl / (1024 * 1024)
            ));
        }
    }

    let bytes = file_res.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() > MAX_DOWNLOAD_BYTES {
        return Err("Размер загруженных данных превысил лимит 500 МБ".to_string());
    }

    let expected_sha1 = expected_sha1
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "У файла CurseForge отсутствует SHA-1 checksum".to_string())?;
    crate::downloads::verify_sha1(&bytes, &expected_sha1)?;

    let clean_filename = crate::security::sanitize_filename(&file_name);

    let mut path = instance_dir;

    match project_type.as_str() {
        "resourcepack" => path.push("resourcepacks"),
        "shader" => path.push("shaderpacks"),
        _ => path.push("mods"),
    }

    fs::create_dir_all(&path)
        .map_err(|e| format!("Не удалось создать директорию {:?}: {}", path, e))?;

    path.push(clean_filename);
    crate::storage::atomic_write(&path, &bytes)?;

    Ok(())
}

#[tauri::command]
pub async fn download_curseforge_modpack(
    _app: AppHandle,
    download_url: String,
    file_name: String,
    expected_sha1: Option<String>,
) -> Result<(), String> {
    const MAX_DOWNLOAD_BYTES: usize = 500 * 1024 * 1024; // 500 MB
    if !is_trusted_download_url(&download_url) {
        return Err("Untrusted CurseForge download URL".to_string());
    }
    let client = crate::downloads::trusted_download_client("RedPandaLauncher/1.0.0")?;

    let file_res = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Ошибка скачивания модпака: {}", e))?;

    if !file_res.status().is_success() {
        return Err(format!(
            "Ошибка скачивания модпака: HTTP {}",
            file_res.status()
        ));
    }

    if let Some(cl) = file_res.content_length() {
        if cl > (MAX_DOWNLOAD_BYTES as u64) {
            return Err(format!(
                "Размер модпака превышает лимит 500 МБ: {} МБ",
                cl / (1024 * 1024)
            ));
        }
    }

    let bytes = file_res.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() > MAX_DOWNLOAD_BYTES {
        return Err("Размер загруженных данных модпака превысил лимит 500 МБ".to_string());
    }

    let expected_sha1 = expected_sha1
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "У модпака CurseForge отсутствует SHA-1 checksum".to_string())?;
    crate::downloads::verify_sha1(&bytes, &expected_sha1)?;

    let clean_filename = crate::security::sanitize_filename(&file_name);

    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push("temp_downloads");

    fs::create_dir_all(&path)
        .map_err(|e| format!("Не удалось создать директорию {:?}: {}", path, e))?;

    path.push(clean_filename);
    crate::storage::atomic_write(&path, &bytes)?;

    Ok(())
}
