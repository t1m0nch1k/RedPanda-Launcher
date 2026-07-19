use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModrinthSearchResult {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub icon_url: Option<String>,
    pub downloads: i32,
}

#[derive(Serialize, Deserialize, Debug)]
struct SearchResponse {
    hits: Vec<ModrinthSearchResult>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModrinthVersion {
    pub id: String,
    pub name: String,
    pub version_number: String,
    pub files: Vec<ModrinthFile>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModrinthFile {
    pub url: String,
    pub filename: String,
    pub primary: bool,
    #[serde(default)]
    pub hashes: std::collections::HashMap<String, String>,
}

#[tauri::command]
pub async fn search_modrinth(
    query: String,
    game_version: String,
    loader: String,
    offset: usize,
    sort_by: String,
    project_type: String,
    categories: Option<Vec<String>>,
) -> Result<Vec<ModrinthSearchResult>, String> {
    let client = Client::builder()
        .user_agent("RedPandaLauncher/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;

    let mut facets = Vec::new();

    // Facet format for Modrinth API: [["project_type:mod"], ["versions:1.20.1"], ["categories:fabric"]]
    let pt = if project_type.is_empty() {
        "mod".to_string()
    } else {
        project_type
    };
    facets.push(vec![format!("project_type:{}", pt)]);

    if !game_version.is_empty() {
        facets.push(vec![format!("versions:{}", game_version)]);
    }

    if pt == "mod" {
        let loader_facet = match loader.as_str() {
            "Fabric" => "categories:fabric",
            "Forge" => "categories:forge",
            "Quilt" => "categories:quilt",
            "NeoForge" => "categories:neoforge",
            _ => "",
        };
        if !loader_facet.is_empty() {
            facets.push(vec![loader_facet.to_string()]);
        }
    }

    if let Some(cats) = categories {
        if !cats.is_empty() {
            let cat_facet: Vec<String> = cats
                .into_iter()
                .map(|c| format!("categories:{}", c))
                .collect();
            facets.push(cat_facet);
        }
    }

    let facets_json = serde_json::to_string(&facets).unwrap_or_else(|_| "[]".to_string());

    // index filter for sort_by. Valid values: relevance, downloads, follows, newest, updated
    let index = if sort_by.is_empty() {
        "relevance"
    } else {
        &sort_by
    };

    let url = format!(
        "https://api.modrinth.com/v2/search?query={}&facets={}&limit=20&offset={}&index={}",
        urlencoding::encode(&query),
        urlencoding::encode(&facets_json),
        offset,
        index
    );

    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("API Error: {}", err_text));
    }

    let data: SearchResponse = res.json().await.map_err(|e| e.to_string())?;

    Ok(data.hits)
}

#[tauri::command]
pub async fn get_modrinth_versions(
    project_slug: String,
    game_version: String,
    loader: String,
    project_type: String,
) -> Result<Vec<ModrinthVersion>, String> {
    let client = Client::builder()
        .user_agent("RedPandaLauncher/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;

    let mut loaders_json = String::new();
    let pt = if project_type.is_empty() {
        "mod".to_string()
    } else {
        project_type
    };
    if pt == "mod" {
        match loader.as_str() {
            "Fabric" => loaders_json = "[\"fabric\"]".to_string(),
            "Forge" => loaders_json = "[\"forge\"]".to_string(),
            "Quilt" => loaders_json = "[\"quilt\"]".to_string(),
            "NeoForge" => loaders_json = "[\"neoforge\"]".to_string(),
            _ => (),
        }
    }

    let mut url = format!(
        "https://api.modrinth.com/v2/project/{}/version",
        project_slug
    );
    let mut has_query = false;

    if !game_version.is_empty() {
        url.push_str(&format!("?game_versions=[\"{}\"]", game_version));
        has_query = true;
    }
    if !loaders_json.is_empty() {
        if has_query {
            url.push('&');
        } else {
            url.push('?');
        }
        url.push_str(&format!("loaders={}", urlencoding::encode(&loaders_json)));
    }

    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("API Error: {}", err_text));
    }

    let data: Vec<ModrinthVersion> = res.json().await.map_err(|e| e.to_string())?;

    Ok(data)
}

#[tauri::command]
pub async fn download_modrinth_version(
    app: AppHandle,
    instance_id: String,
    version_id: String,
    project_type: String,
) -> Result<(), String> {
    // 1. Get the version details to find the primary file URL
    let client = Client::new();
    let url = format!("https://api.modrinth.com/v2/version/{}", version_id);
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let version: ModrinthVersion = res.json().await.map_err(|e| e.to_string())?;

    let file = version
        .files
        .iter()
        .find(|f| f.primary)
        .or_else(|| version.files.first());

    if let Some(file) = file {
        let download_url = &file.url;
        let filename = &file.filename;

        // 2. Download the file bytes
        let file_res = client
            .get(download_url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
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

        path.push(filename);
        fs::write(path, bytes).map_err(|e| e.to_string())?;

        Ok(())
    } else {
        Err("No file found in this version".to_string())
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ModUpdate {
    pub file_name: String,
    pub new_version_id: String,
    pub new_file_name: String,
    pub new_file_url: String,
}

#[derive(Serialize)]
struct VersionFilesUpdateRequest {
    hashes: Vec<String>,
    algorithm: String,
    loaders: Vec<String>,
    game_versions: Vec<String>,
}

#[tauri::command]
pub async fn check_mod_updates(
    app: AppHandle,
    instance_id: String,
) -> Result<Vec<ModUpdate>, String> {
    use sha1::{Digest, Sha1};
    use std::io::Read;

    // 1. Get instance details
    let instances = crate::instances::get_instances(app.clone())
        .await
        .unwrap_or_default();
    let instance = instances
        .into_iter()
        .find(|i| i.id == instance_id)
        .ok_or("Instance not found")?;

    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push(&instance_id);
    path.push("mods");

    if !path.exists() {
        return Ok(vec![]);
    }

    // 2. Hash all jars
    let mut file_hashes: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    let mut hashes_vec = Vec::new();

    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    for entry in entries {
        if let Ok(entry) = entry {
            let p = entry.path();
            if p.is_file() && p.extension().map_or(false, |ext| ext == "jar") {
                let filename = entry.file_name().to_string_lossy().to_string();

                // Compute SHA1
                if let Ok(mut file) = fs::File::open(&p) {
                    let mut hasher = Sha1::new();
                    let mut buffer = [0; 1024 * 64];
                    while let Ok(n) = file.read(&mut buffer) {
                        if n == 0 {
                            break;
                        }
                        hasher.update(&buffer[..n]);
                    }
                    let hash = hex::encode(hasher.finalize());
                    hashes_vec.push(hash.clone());
                    file_hashes.insert(hash, filename);
                }
            }
        }
    }

    if hashes_vec.is_empty() {
        return Ok(vec![]);
    }

    // 3. Query Modrinth API
    let client = Client::new();
    let mut loaders = Vec::new();
    match instance.loader_type.as_str() {
        "Fabric" => loaders.push("fabric".to_string()),
        "Forge" => loaders.push("forge".to_string()),
        "Quilt" => loaders.push("quilt".to_string()),
        "NeoForge" => loaders.push("neoforge".to_string()),
        _ => (),
    }

    let req_body = VersionFilesUpdateRequest {
        hashes: hashes_vec,
        algorithm: "sha1".to_string(),
        loaders,
        game_versions: vec![instance.game_version],
    };

    let url = "https://api.modrinth.com/v2/version_files/update";
    let res = client
        .post(url)
        .json(&req_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("API Error: {}", err_text));
    }

    // Response is a map of hash -> ModrinthVersion (the updated version)
    let updates: std::collections::HashMap<String, ModrinthVersion> =
        res.json().await.map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for (hash, version) in updates {
        if let Some(old_file_name) = file_hashes.get(&hash) {
            let file = version
                .files
                .iter()
                .find(|f| f.primary)
                .or_else(|| version.files.first());

            let mut is_same = false;
            if let Some(f) = file {
                if let Some(sha1) = f.hashes.get("sha1") {
                    if sha1 == &hash {
                        is_same = true;
                    }
                }
            }

            if !is_same {
                if let Some(f) = file {
                    result.push(ModUpdate {
                        file_name: old_file_name.clone(),
                        new_version_id: version.id.clone(),
                        new_file_name: f.filename.clone(),
                        new_file_url: f.url.clone(),
                    });
                }
            }
        }
    }

    Ok(result)
}
#[tauri::command]
pub async fn update_mod(
    app: AppHandle,
    instance_id: String,
    old_file_name: String,
    new_file_name: String,
    download_url: String,
) -> Result<(), String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push(&instance_id);
    path.push("mods");

    // Delete old file
    let mut old_path = path.clone();
    old_path.push(&old_file_name);
    if old_path.exists() {
        fs::remove_file(old_path).map_err(|e| e.to_string())?;
    }

    // Download new file
    let client = Client::new();
    let res = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let bytes = res.bytes().await.map_err(|e| e.to_string())?;

    let mut new_path = path.clone();
    new_path.push(&new_file_name);
    fs::write(new_path, bytes).map_err(|e| e.to_string())?;

    Ok(())
}
