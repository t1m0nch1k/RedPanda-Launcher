use reqwest::Url;
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::AppHandle;

pub(crate) fn is_trusted_download_url(value: &str) -> bool {
    let Ok(url) = Url::parse(value) else {
        return false;
    };
    let Some(host) = url.host_str() else {
        return false;
    };
    url.scheme() == "https" && (host == "modrinth.com" || host.ends_with(".modrinth.com"))
}

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
    pub dependencies: Option<Vec<ModrinthDependency>>,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub game_versions: Option<Vec<String>>,
    #[serde(default)]
    pub loaders: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModrinthDependency {
    pub version_id: Option<String>,
    pub project_id: Option<String>,
    pub dependency_type: String,
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
    let client = crate::downloads::trusted_download_client(&format!(
        "RedPandaLauncher/{}",
        env!("REDPANDA_VERSION")
    ))?;

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
    let client = crate::downloads::trusted_download_client(&format!(
        "RedPandaLauncher/{}",
        env!("REDPANDA_VERSION")
    ))?;

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
    _app: AppHandle,
    instance_id: String,
    version_id: String,
    project_type: String,
) -> Result<(), String> {
    // 1. Get the version details to find the primary file URL
    let client = crate::downloads::trusted_download_client("RedPandaLauncher/1.0.0")?;
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
        if !is_trusted_download_url(download_url) {
            return Err("Untrusted Modrinth download URL".to_string());
        }
        let filename = crate::security::sanitize_filename(&file.filename);

        let mut path = crate::security::instance_dir(&instance_id)?;

        match project_type.as_str() {
            "resourcepack" => path.push("resourcepacks"),
            "shader" => path.push("shaderpacks"),
            _ => path.push("mods"),
        }

        fs::create_dir_all(&path)
            .map_err(|e| format!("Failed to create folder {:?}: {}", path, e))?;

        path.push(filename);
        crate::downloads::download_to_file_with_hashes(&client, download_url, &path, &file.hashes)
            .await?;

        Ok(())
    } else {
        Err("No file found in this version".to_string())
    }
}

#[tauri::command]
pub async fn download_modrinth_modpack(app: AppHandle, version_id: String) -> Result<(), String> {
    // 1. Get the version details to find the primary file URL
    let client = crate::downloads::trusted_download_client("RedPandaLauncher/1.0.0")?;
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
        if !is_trusted_download_url(download_url) {
            return Err("Untrusted Modrinth modpack URL".to_string());
        }
        let filename = crate::security::sanitize_filename(&file.filename);

        // 2. Save the verified artifact to a temporary location.
        let mut temp_path = std::env::temp_dir();
        temp_path.push("RedPandaLauncher");
        fs::create_dir_all(&temp_path).map_err(|e| format!("Failed to create temp dir: {}", e))?;
        temp_path.push(filename);
        crate::downloads::download_to_file_with_hashes(
            &client,
            download_url,
            &temp_path,
            &file.hashes,
        )
        .await?;

        // 3. Import the .mrpack file and clean up even if importing fails.
        let path_str = temp_path.to_string_lossy().to_string();
        let import_result = crate::import::import_mrpack(app, path_str).await;
        let _ = fs::remove_file(temp_path);
        import_result
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
    pub new_sha1: Option<String>,
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

    let mut path = crate::security::instance_dir(&instance_id)?;
    path.push("mods");

    if !path.exists() {
        return Ok(vec![]);
    }

    // 2. Hash all jars
    let mut file_hashes: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    let mut hashes_vec = Vec::new();

    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_file() && p.extension().is_some_and(|ext| ext == "jar") {
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

    if hashes_vec.is_empty() {
        return Ok(vec![]);
    }

    // 3. Query Modrinth API
    let client = crate::downloads::trusted_download_client(&format!(
        "RedPandaLauncher/{}",
        env!("REDPANDA_VERSION")
    ))?;
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
                        new_sha1: f.hashes.get("sha1").cloned(),
                    });
                }
            }
        }
    }

    Ok(result)
}
#[tauri::command]
pub async fn update_mod(
    _app: AppHandle,
    instance_id: String,
    old_file_name: String,
    new_file_name: String,
    download_url: String,
    expected_sha1: Option<String>,
) -> Result<(), String> {
    let mut path = crate::security::instance_dir(&instance_id)?;
    path.push("mods");
    let old_file_name = crate::security::validate_filename(&old_file_name)?;
    let new_file_name = crate::security::sanitize_filename(&new_file_name);
    if !is_trusted_download_url(&download_url) {
        return Err("Untrusted Modrinth download URL".to_string());
    }
    let expected_sha1 = expected_sha1
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "У обновления отсутствует SHA-1 checksum".to_string())?;

    let new_path = crate::security::safe_join(&path, &new_file_name)?;
    let client = crate::downloads::trusted_download_client("RedPandaLauncher/1.0.0")?;
    crate::downloads::download_to_file_with_sha1(&client, &download_url, &new_path, &expected_sha1)
        .await?;

    let old_path = crate::security::safe_join(&path, &old_file_name)?;
    if old_path != new_path && old_path.exists() {
        fs::remove_file(old_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}
