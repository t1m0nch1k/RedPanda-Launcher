use reqwest::Client;
use serde::Serialize;
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

use crate::downloads::{verify_modrinth_hashes, MAX_DOWNLOAD_BYTES};
use crate::instances::Instance;
use crate::modrinth::{is_trusted_download_url, ModrinthVersion};

#[derive(Serialize, Clone, Debug)]
pub struct BuilderProgress {
    pub status: String, // "init", "resolving", "downloading", "done", "error"
    pub message: String,
    pub current: usize,
    pub total: usize,
    pub current_item: Option<String>,
}

#[derive(Clone, Debug)]
struct ModDownloadItem {
    pub name: String,
    pub filename: String,
    pub download_url: String,
    pub hashes: HashMap<String, String>,
}

async fn fetch_latest_version_for_project(
    client: &Client,
    project_id_or_slug: &str,
    game_version: &str,
    loader_type: &str,
) -> Option<ModrinthVersion> {
    let loaders = match loader_type {
        "Fabric" => "[\"fabric\"]",
        "Forge" => "[\"forge\"]",
        "NeoForge" => "[\"neoforge\",\"forge\"]",
        "Quilt" => "[\"quilt\",\"fabric\"]",
        _ => "[]",
    };

    let url = format!(
        "https://api.modrinth.com/v2/project/{}/version?game_versions=[\"{}\"]&loaders={}",
        project_id_or_slug,
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

#[tauri::command]
pub async fn build_custom_modpack(
    app: AppHandle,
    name: String,
    game_version: String,
    loader_type: String,
    loader_version: Option<String>,
    mod_slugs: Vec<String>,
) -> Result<Instance, String> {
    if name.trim().is_empty() {
        return Err("Название сборки не может быть пустым".to_string());
    }
    if game_version.trim().is_empty() {
        return Err("Версия Minecraft не указана".to_string());
    }

    let _ = app.emit(
        "builder-progress",
        BuilderProgress {
            status: "init".to_string(),
            message: "Создание профиля сборки...".to_string(),
            current: 0,
            total: mod_slugs.len(),
            current_item: None,
        },
    );

    // 1. Resolve loader version if not supplied
    let actual_loader_version = match loader_version {
        Some(lv) if !lv.trim().is_empty() => lv,
        _ => {
            let versions = crate::versions::get_loader_versions(
                loader_type.clone(),
                game_version.clone(),
            )
            .await
            .unwrap_or_default();
            versions.first().cloned().unwrap_or_default()
        }
    };

    // 2. Create instance in RedPanda
    let instance = crate::instances::add_instance(
        app.clone(),
        name.clone(),
        game_version.clone(),
        loader_type.clone(),
        actual_loader_version,
    )
    .await?;

    let client = crate::downloads::trusted_download_client(&format!(
        "RedPandaLauncher/{}",
        env!("REDPANDA_VERSION")
    ))?;

    let mut download_queue: Vec<ModDownloadItem> = Vec::new();
    let mut visited_projects: HashSet<String> = HashSet::new();
    let mut projects_to_resolve: VecDeque<String> = mod_slugs.into_iter().collect();

    // 3. Resolve all mods and dependencies
    let mut resolved_count = 0;
    while let Some(project) = projects_to_resolve.pop_front() {
        let clean_proj = project.trim().to_lowercase();
        if clean_proj.is_empty() || visited_projects.contains(&clean_proj) {
            continue;
        }
        visited_projects.insert(clean_proj.clone());

        let _ = app.emit(
            "builder-progress",
            BuilderProgress {
                status: "resolving".to_string(),
                message: format!("Поиск мода и зависимостей: {}", clean_proj),
                current: resolved_count,
                total: visited_projects.len() + projects_to_resolve.len(),
                current_item: Some(clean_proj.clone()),
            },
        );

        if let Some(version) = fetch_latest_version_for_project(
            &client,
            &clean_proj,
            &game_version,
            &loader_type,
        )
        .await
        {
            // Pick primary file
            if let Some(file) = version
                .files
                .iter()
                .find(|f| f.primary)
                .or_else(|| version.files.first())
            {
                if is_trusted_download_url(&file.url) {
                    let sanitized = crate::security::sanitize_filename(&file.filename);
                    download_queue.push(ModDownloadItem {
                        name: version.name.clone(),
                        filename: sanitized,
                        download_url: file.url.clone(),
                        hashes: file.hashes.clone(),
                    });
                }
            }

            // Check required dependencies
            if let Some(deps) = version.dependencies {
                for dep in deps {
                    if dep.dependency_type == "required" {
                        if let Some(pid) = dep.project_id {
                            if !visited_projects.contains(&pid.to_lowercase()) {
                                projects_to_resolve.push_back(pid);
                            }
                        }
                    }
                }
            }
        } else {
            log::warn!(
                "Не удалось найти версию для мода '{}' ({} / {})",
                clean_proj,
                game_version,
                loader_type
            );
        }

        resolved_count += 1;
    }

    // 4. Download all gathered files into {instance_dir}/mods
    let instance_dir = crate::security::instance_dir(&instance.id)?;
    let mods_dir = instance_dir.join("mods");
    fs::create_dir_all(&mods_dir)
        .map_err(|e| format!("Не удалось создать папку mods: {}", e))?;

    let total_downloads = download_queue.len();

    for (index, item) in download_queue.into_iter().enumerate() {
        let dest_path: PathBuf = mods_dir.join(&item.filename);

        let _ = app.emit(
            "builder-progress",
            BuilderProgress {
                status: "downloading".to_string(),
                message: format!("Скачивание: {}", item.name),
                current: index + 1,
                total: total_downloads,
                current_item: Some(item.name.clone()),
            },
        );

        // Skip if already downloaded
        if dest_path.exists() {
            continue;
        }

        match client.get(&item.download_url).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(bytes) = resp.bytes().await {
                    if bytes.len() <= MAX_DOWNLOAD_BYTES {
                        if verify_modrinth_hashes(&bytes, &item.hashes).is_ok() {
                            let _ = fs::write(&dest_path, bytes);
                        }
                    }
                }
            }
            Ok(err_resp) => {
                log::warn!(
                    "Ошибка загрузки {}: HTTP {}",
                    item.filename,
                    err_resp.status()
                );
            }
            Err(e) => {
                log::warn!("Сетевая ошибка при скачивании {}: {}", item.filename, e);
            }
        }
    }

    let _ = app.emit(
        "builder-progress",
        BuilderProgress {
            status: "done".to_string(),
            message: "Сборка успешно создана!".to_string(),
            current: total_downloads,
            total: total_downloads,
            current_item: None,
        },
    );

    Ok(instance)
}
