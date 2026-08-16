use reqwest::Client;
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

pub const CURSEFORGE_API_KEY: &str = "$2a$10$QdP21DmwEcYxV.f.T1orWeyr7SB65NMbFxme2NGVEsEpyFeen44RK"; // TODO: Замените на ваш API ключ

#[tauri::command]
pub async fn search_curseforge(
    query: String,
    game_version: String,
    class_id: u32, // 6 = Mods, 4471 = Modpacks, 12 = Resource Packs
    index: usize,
    page_size: usize,
) -> Result<Vec<CurseForgeSearchResult>, String> {
    if CURSEFORGE_API_KEY == "YOUR_API_KEY_HERE" {
        return Err("API-ключ CurseForge не настроен во внутренних файлах лаунчера.".to_string());
    }

    let client = Client::builder()
        .user_agent("RedPandaLauncher/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;

    // CurseForge API documentation: https://docs.curseforge.com/
    // Endpoint: GET /v1/mods/search
    // gameId for Minecraft is 432
    
    let mut url = format!(
        "https://api.curseforge.com/v1/mods/search?gameId=432&classId={}&searchFilter={}&index={}&pageSize={}",
        class_id, query, index, page_size
    );
    if !game_version.is_empty() {
        url.push_str(&format!("&gameVersion={}", game_version));
    }

    let res = client
        .get(&url)
        .header("x-api-key", CURSEFORGE_API_KEY)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Ошибка подключения к CurseForge API: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let error_text = res.text().await.unwrap_or_default();
        return Err(format!("CurseForge API вернул ошибку {}: {}", status, error_text));
    }

    let search_res: SearchResponse = res
        .json()
        .await
        .map_err(|e| format!("Не удалось распарсить ответ CurseForge: {}", e))?;

    Ok(search_res.data)
}

#[tauri::command]
pub async fn get_curseforge_versions(
    mod_id: u32,
    game_version: Option<String>,
) -> Result<Vec<CurseForgeFile>, String> {
    if CURSEFORGE_API_KEY == "YOUR_API_KEY_HERE" {
        return Err("API-ключ CurseForge не настроен во внутренних файлах лаунчера.".to_string());
    }

    let client = Client::builder()
        .user_agent("RedPandaLauncher/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;

    let mut url = format!(
        "https://api.curseforge.com/v1/mods/{}/files?pageSize=50",
        mod_id
    );
    if let Some(gv) = game_version {
        if !gv.is_empty() {
            url.push_str(&format!("&gameVersion={}", gv));
        }
    }

    let res = client
        .get(&url)
        .header("x-api-key", CURSEFORGE_API_KEY)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Ошибка подключения к CurseForge API: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let error_text = res.text().await.unwrap_or_default();
        return Err(format!("CurseForge API вернул ошибку {}: {}", status, error_text));
    }

    let files_res: FilesResponse = res
        .json()
        .await
        .map_err(|e| format!("Не удалось распарсить ответ CurseForge: {}", e))?;

    Ok(files_res.data)
}

#[tauri::command]
pub async fn download_curseforge_version(
    _app: AppHandle,
    instance_id: String,
    download_url: String,
    file_name: String,
    project_type: String,
) -> Result<(), String> {
    let client = Client::new();

    let file_res = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Ошибка скачивания: {}", e))?;

    let bytes = file_res.bytes().await.map_err(|e| e.to_string())?;

    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push(&instance_id);

    match project_type.as_str() {
        "resourcepack" => path.push("resourcepacks"),
        "shader" => path.push("shaderpacks"),
        _ => path.push("mods"),
    }

    fs::create_dir_all(&path).unwrap_or(());

    path.push(file_name);
    fs::write(path, bytes).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn download_curseforge_modpack(
    _app: AppHandle,
    download_url: String,
    file_name: String,
) -> Result<(), String> {
    // For now we just download the zip file to the temp directory or a specific location.
    // The actual modpack installation (extracting manifest.json, downloading overrides and mods)
    // is a complex process similar to Modrinth Mrpack import.
    // We will just download the zip file into the data dir for now.
    
    let client = Client::new();

    let file_res = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Ошибка скачивания модпака: {}", e))?;

    let bytes = file_res.bytes().await.map_err(|e| e.to_string())?;

    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push("temp_downloads");

    fs::create_dir_all(&path).unwrap_or(());

    path.push(file_name);
    fs::write(path, bytes).map_err(|e| e.to_string())?;

    // In a full implementation, you would call your import logic here, passing the downloaded zip path.
    Ok(())
}

