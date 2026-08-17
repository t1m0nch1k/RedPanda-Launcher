use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::{HashSet, VecDeque};
use tauri::AppHandle;

use crate::curseforge::{CurseForgeFile, CurseForgeSearchResult, get_curseforge_api_key};
use crate::modrinth::{ModrinthSearchResult, ModrinthVersion};
use crate::instances::get_instances;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InstallTask {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub url: String,
    pub filename: String,
    pub source: String,
    pub warning: Option<String>,
}

#[derive(Deserialize)]
struct ModrinthProject {
    title: String,
}

#[derive(Deserialize)]
struct CurseForgeModResponse {
    data: CurseForgeMod,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeMod {
    name: String,
}

async fn get_modrinth_project_name(project_id: &str, client: &Client) -> Option<String> {
    let url = format!("https://api.modrinth.com/v2/project/{}", project_id);
    if let Ok(res) = client.get(&url).send().await {
        if let Ok(proj) = res.json::<ModrinthProject>().await {
            return Some(proj.title);
        }
    }
    None
}

async fn get_curseforge_mod_name(mod_id: u32, client: &Client) -> Option<String> {
    let url = format!("https://api.curseforge.com/v1/mods/{}", mod_id);
    let api_key = get_curseforge_api_key();
    if let Ok(res) = client.get(&url).header("x-api-key", &api_key).send().await {
        if let Ok(m) = res.json::<CurseForgeModResponse>().await {
            return Some(m.data.name);
        }
    }
    None
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
        project_id, game_version, urlencoding::encode(loaders)
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
    
    let api_key = get_curseforge_api_key();
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
    let client = Client::builder()
        .user_agent("RedPandaLauncher/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();
    let mut visited_projects = HashSet::new();
    let mut queue = VecDeque::new();
    
    if source == "modrinth" {
        queue.push_back(DepItem::Modrinth(id));
    } else {
        if let Ok(file_id) = id.parse::<u32>() {
            queue.push_back(DepItem::CurseForge(file_id));
        }
    }

    while let Some(item) = queue.pop_front() {
        match item {
            DepItem::Modrinth(version_id) => {
                let url = format!("https://api.modrinth.com/v2/version/{}", version_id);
                if let Ok(res) = client.get(&url).send().await {
                    if let Ok(version) = res.json::<ModrinthVersion>().await {
                        let proj_key = format!("modrinth:{}", version.name);
                        if visited_projects.contains(&proj_key) { continue; }
                        visited_projects.insert(proj_key);

                        let file = version.files.iter().find(|f| f.primary).or_else(|| version.files.first());
                        if let Some(f) = file {
                            tasks.push(InstallTask {
                                id: version_id.clone(),
                                project_id: version.name.clone(),
                                name: version.name.clone(),
                                url: f.url.clone(),
                                filename: f.filename.clone(),
                                source: "modrinth".to_string(),
                                warning: None,
                            });
                        }

                        if let Some(deps) = version.dependencies {
                            for dep in deps {
                                if dep.dependency_type == "required" {
                                    if let Some(vid) = dep.version_id {
                                        queue.push_back(DepItem::Modrinth(vid));
                                    } else if let Some(pid) = dep.project_id {
                                        if let Some(name) = get_modrinth_project_name(&pid, &client).await {
                                            if let Ok(mut cf_res) = crate::curseforge::search_curseforge(name.clone(), game_version.clone(), 6, 0, 5).await {
                                                if !cf_res.is_empty() && cf_res[0].name.to_lowercase() == name.to_lowercase() {
                                                    if let Some(cf_file) = resolve_curseforge_latest(cf_res[0].id, &game_version, &loader, &client).await {
                                                        queue.push_back(DepItem::CurseForge(cf_file.id));
                                                        continue;
                                                    }
                                                }
                                            }
                                        }
                                        
                                        if let Some(mv) = resolve_modrinth_latest(&pid, &game_version, &loader, &client).await {
                                            queue.push_back(DepItem::Modrinth(mv.id));
                                        }
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
                struct FilesReq { file_ids: Vec<u32> }
                #[derive(Deserialize)]
                struct FilesRes { data: Vec<CurseForgeFile> }
                
                let api_key = get_curseforge_api_key();
                if let Ok(res) = client.post(url).header("x-api-key", &api_key).json(&FilesReq { file_ids: vec![file_id] }).send().await {
                    if let Ok(mut files_res) = res.json::<FilesRes>().await {
                        if !files_res.data.is_empty() {
                            let file = files_res.data.remove(0);
                            let proj_key = format!("curseforge:{}", file.mod_id);
                            if visited_projects.contains(&proj_key) { continue; }
                            visited_projects.insert(proj_key);

                            tasks.push(InstallTask {
                                id: file.id.to_string(),
                                project_id: file.mod_id.to_string(),
                                name: file.display_name.clone(),
                                url: file.download_url.unwrap_or_default(),
                                filename: file.file_name.clone(),
                                source: "curseforge".to_string(),
                                warning: None,
                            });
                            
                            if let Some(deps) = file.dependencies {
                                for dep in deps {
                                    if dep.relation_type == 3 {
                                        // Required dependency (mod_id)
                                        let mut cf_resolved = false;
                                        if let Some(cf_file) = resolve_curseforge_latest(dep.mod_id, &game_version, &loader, &client).await {
                                            queue.push_back(DepItem::CurseForge(cf_file.id));
                                            cf_resolved = true;
                                        }
                                        
                                        if !cf_resolved {
                                            if let Some(name) = get_curseforge_mod_name(dep.mod_id, &client).await {
                                                if let Ok(mut mr_res) = crate::modrinth::search_modrinth(name.clone(), game_version.clone(), loader.clone(), 0, "relevance".to_string(), "mod".to_string(), None).await {
                                                    if !mr_res.is_empty() {
                                                        if let Some(mv) = resolve_modrinth_latest(&mr_res[0].slug, &game_version, &loader, &client).await {
                                                            queue.push_back(DepItem::Modrinth(mv.id));
                                                        }
                                                    }
                                                }
                                            }
                                        }
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
