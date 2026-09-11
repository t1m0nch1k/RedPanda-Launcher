use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::{HashSet, VecDeque};
use tauri::AppHandle;

use crate::curseforge::{get_curseforge_api_key, CurseForgeFile};
use crate::modrinth::ModrinthVersion;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InstallTask {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub url: String,
    pub filename: String,
    pub source: String,
    pub warning: Option<String>,
    pub sha1: Option<String>,
}

async fn resolve_modrinth_latest(
    project_id: &str,
    game_version: &str,
    loader: &str,
    client: &Client,
) -> Option<ModrinthVersion> {
    let loaders = match loader {
        "Fabric" => "[\"fabric\"]",
        "Forge" => "[\"forge\"]",
        "NeoForge" => "[\"neoforge\"]",
        "Quilt" => "[\"quilt\"]",
        _ => "[]",
    };

    let url = format!(
        "https://api.modrinth.com/v2/project/{}/version?game_versions=[\"{}\"]&loaders={}",
        project_id,
        game_version,
        urlencoding::encode(loaders)
    );

    if let Ok(res) = client.get(&url).send().await {
        if let Ok(mut versions) = res.json::<Vec<ModrinthVersion>>().await {
            if !versions.is_empty() {
                return Some(versions.remove(0));
            }
        }
    }
    None
}

async fn resolve_curseforge_latest(
    app: &AppHandle,
    mod_id: u32,
    game_version: &str,
    loader: &str,
    client: &Client,
) -> Option<CurseForgeFile> {
    let modloader_type = match loader {
        "Forge" => 1,
        "Fabric" => 4,
        "Quilt" => 5,
        "NeoForge" => 6,
        _ => 0,
    };

    let url = format!(
        "https://api.curseforge.com/v1/mods/{}/files?gameVersion={}&modLoaderType={}",
        mod_id, game_version, modloader_type
    );

    #[derive(Deserialize)]
    struct FilesResponse {
        data: Vec<CurseForgeFile>,
    }

    let api_key = get_curseforge_api_key(app);
    if let Ok(res) = client.get(&url).header("x-api-key", &api_key).send().await {
        if let Ok(mut files) = res.json::<FilesResponse>().await {
            if !files.data.is_empty() {
                return Some(files.data.remove(0));
            }
        }
    }
    None
}

enum DepItem {
    Modrinth(String), // version_id
    CurseForge(u32),  // file_id
}

#[tauri::command]
pub async fn resolve_dependencies(
    app: AppHandle,
    instance_id: String,
    source: String,
    id: String,
    game_version: String,
    loader: String,
) -> Result<Vec<InstallTask>, String> {
    crate::security::validate_instance_id(&instance_id)?;
    let instances = crate::instances::get_instances(app.clone()).await?;
    if !instances.iter().any(|instance| instance.id == instance_id) {
        return Err("Instance not found".to_string());
    }

    let client = crate::downloads::trusted_download_client(&format!(
        "RedPandaLauncher/{}",
        env!("REDPANDA_VERSION")
    ))?;

    let mut tasks = Vec::new();
    let mut visited_projects = HashSet::new();
    let mut queue = VecDeque::new();

    if source == "modrinth" {
        queue.push_back(DepItem::Modrinth(id));
    } else if source == "curseforge" {
        let file_id = id
            .parse::<u32>()
            .map_err(|_| "Некорректный CurseForge file ID".to_string())?;
        queue.push_back(DepItem::CurseForge(file_id));
    } else {
        return Err("Неизвестный provider зависимостей".to_string());
    }

    while let Some(item) = queue.pop_front() {
        match item {
            DepItem::Modrinth(version_id) => {
                let url = format!("https://api.modrinth.com/v2/version/{}", version_id);
                let res = client
                    .get(&url)
                    .send()
                    .await
                    .map_err(|e| {
                        format!("Не удалось получить Modrinth-зависимость {version_id}: {e}")
                    })?
                    .error_for_status()
                    .map_err(|e| {
                        format!("Modrinth вернул ошибку для зависимости {version_id}: {e}")
                    })?;
                {
                    let version = res.json::<ModrinthVersion>().await.map_err(|e| {
                        format!("Некорректная Modrinth-зависимость {version_id}: {e}")
                    })?;
                    let proj_key = format!("modrinth:{}", version.name);
                    if visited_projects.contains(&proj_key) {
                        continue;
                    }
                    visited_projects.insert(proj_key);

                    let file = version
                        .files
                        .iter()
                        .find(|f| f.primary)
                        .or_else(|| version.files.first());
                    if let Some(f) = file {
                        tasks.push(InstallTask {
                            id: version_id.clone(),
                            project_id: version.name.clone(),
                            name: version.name.clone(),
                            url: f.url.clone(),
                            filename: f.filename.clone(),
                            source: "modrinth".to_string(),
                            warning: None,
                            sha1: None,
                        });
                    }

                    if let Some(deps) = version.dependencies {
                        for dep in deps {
                            if dep.dependency_type == "required" {
                                if let Some(vid) = dep.version_id {
                                    queue.push_back(DepItem::Modrinth(vid));
                                } else if let Some(pid) = dep.project_id {
                                    if let Some(mv) = resolve_modrinth_latest(
                                        &pid,
                                        &game_version,
                                        &loader,
                                        &client,
                                    )
                                    .await
                                    {
                                        queue.push_back(DepItem::Modrinth(mv.id));
                                    } else {
                                        return Err(format!(
                                                "Не удалось найти обязательную Modrinth-зависимость {pid}"
                                            ));
                                    }
                                }
                            }
                        }
                    }
                }
            }
            DepItem::CurseForge(file_id) => {
                let url = "https://api.curseforge.com/v1/mods/files";
                #[derive(Serialize)]
                struct FilesReq {
                    file_ids: Vec<u32>,
                }
                #[derive(Deserialize)]
                struct FilesRes {
                    data: Vec<CurseForgeFile>,
                }

                let api_key = get_curseforge_api_key(&app);
                let res = client
                    .post(url)
                    .header("x-api-key", &api_key)
                    .json(&FilesReq {
                        file_ids: vec![file_id],
                    })
                    .send()
                    .await
                    .map_err(|e| {
                        format!("Не удалось получить CurseForge-зависимость {file_id}: {e}")
                    })?
                    .error_for_status()
                    .map_err(|e| {
                        format!("CurseForge вернул ошибку для зависимости {file_id}: {e}")
                    })?;
                {
                    let mut files_res = res.json::<FilesRes>().await.map_err(|e| {
                        format!("Некорректная CurseForge-зависимость {file_id}: {e}")
                    })?;
                    if !files_res.data.is_empty() {
                        let file = files_res.data.remove(0);
                        let proj_key = format!("curseforge:{}", file.mod_id);
                        if visited_projects.contains(&proj_key) {
                            continue;
                        }
                        visited_projects.insert(proj_key);

                        tasks.push(InstallTask {
                            id: file.id.to_string(),
                            project_id: file.mod_id.to_string(),
                            name: file.display_name.clone(),
                            url: file.download_url.unwrap_or_default(),
                            filename: file.file_name.clone(),
                            source: "curseforge".to_string(),
                            warning: None,
                            sha1: file
                                .hashes
                                .as_ref()
                                .and_then(|hashes| {
                                    hashes
                                        .iter()
                                        .find(|hash| hash.algo == crate::curseforge::HASH_ALGO_SHA1)
                                })
                                .map(|hash| hash.value.clone()),
                        });

                        if let Some(deps) = file.dependencies {
                            for dep in deps {
                                if dep.relation_type == 3 {
                                    // Required dependency (mod_id)
                                    if let Some(cf_file) = resolve_curseforge_latest(
                                        &app,
                                        dep.mod_id,
                                        &game_version,
                                        &loader,
                                        &client,
                                    )
                                    .await
                                    {
                                        queue.push_back(DepItem::CurseForge(cf_file.id));
                                    } else {
                                        return Err(format!(
                                                "Не удалось найти обязательную CurseForge-зависимость {}",
                                                dep.mod_id
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

    // Reverse tasks so dependencies are installed first (or leaves first)
    tasks.reverse();

    Ok(tasks)
}
