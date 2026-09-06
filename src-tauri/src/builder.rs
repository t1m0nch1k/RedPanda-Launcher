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

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
enum ResolveTarget {
    Project(String),
    Version {
        version_id: String,
        fallback_project_id: Option<String>,
    },
}

async fn fetch_version_by_id(client: &Client, version_id: &str) -> Option<ModrinthVersion> {
    let raw = version_id.trim();
    if raw.is_empty() {
        return None;
    }
    let url = format!("https://api.modrinth.com/v2/version/{}", raw);
    if let Ok(res) = client.get(&url).send().await {
        if res.status().is_success() {
            if let Ok(version) = res.json::<ModrinthVersion>().await {
                return Some(version);
            }
        }
    }
    None
}

async fn fetch_latest_version_for_project(
    client: &Client,
    project_id_or_slug: &str,
    game_version: &str,
    loader_type: &str,
) -> Option<ModrinthVersion> {
    let raw = project_id_or_slug.trim();
    if raw.is_empty() {
        return None;
    }

    // Map loader-specific slugs if needed
    let mapped_slug = match (loader_type, raw.to_lowercase().as_str()) {
        ("Fabric" | "Quilt", "create") => "create-fabric",
        ("Forge" | "NeoForge", "create-fabric") => "create",
        _ => raw,
    };

    let loaders = match loader_type {
        "Fabric" => "[\"fabric\"]",
        "Forge" => "[\"forge\"]",
        "NeoForge" => "[\"neoforge\",\"forge\"]",
        "Quilt" => "[\"quilt\",\"fabric\"]",
        _ => "[]",
    };

    // Helper closure to query versions for a given slug/id and optional game_version filter
    async fn try_query(
        client: &Client,
        proj: &str,
        gv: Option<&str>,
        loaders_json: &str,
    ) -> Option<Vec<ModrinthVersion>> {
        let mut url = format!(
            "https://api.modrinth.com/v2/project/{}/version?loaders={}",
            proj,
            urlencoding::encode(loaders_json)
        );
        if let Some(v) = gv {
            url.push_str(&format!("&game_versions=[\"{}\"]", v));
        }
        if let Ok(res) = client.get(&url).send().await {
            if res.status().is_success() {
                if let Ok(versions) = res.json::<Vec<ModrinthVersion>>().await {
                    if !versions.is_empty() {
                        return Some(versions);
                    }
                }
            }
        }
        None
    }

    // 1. Try exact project and exact game_version
    if let Some(mut list) = try_query(client, mapped_slug, Some(game_version), loaders).await {
        return Some(list.remove(0));
    }

    // 2. If loader is Fabric/Quilt and slug doesn't end with -fabric, try with -fabric
    if matches!(loader_type, "Fabric" | "Quilt") && !mapped_slug.ends_with("-fabric") {
        let fabric_slug = format!("{}-fabric", mapped_slug);
        if let Some(mut list) = try_query(client, &fabric_slug, Some(game_version), loaders).await {
            return Some(list.remove(0));
        }
    }

    // 3. If loader is Forge and slug ends with -fabric, try removing -fabric
    if loader_type == "Forge" && mapped_slug.ends_with("-fabric") {
        let base = mapped_slug.trim_end_matches("-fabric");
        if let Some(mut list) = try_query(client, base, Some(game_version), loaders).await {
            return Some(list.remove(0));
        }
    }

    // 4. Try querying all versions for this loader and finding compatible game_version
    // (some mods specify minor version e.g. "1.19" which is compatible with "1.19.2")
    if let Some(all_versions) = try_query(client, mapped_slug, None, loaders).await {
        // 4a. Check if any version lists game_version
        for v in &all_versions {
            if let Some(ref gvs) = v.game_versions {
                if gvs.iter().any(|g| g == game_version) {
                    return Some(v.clone());
                }
            }
        }

        // 4b. Check minor version match (e.g. "1.19.2" -> "1.19")
        let parts: Vec<&str> = game_version.split('.').collect();
        if parts.len() >= 2 {
            let minor_prefix = format!("{}.{}", parts[0], parts[1]);
            for v in &all_versions {
                if let Some(ref gvs) = v.game_versions {
                    if gvs.iter().any(|g| g == &minor_prefix || g.starts_with(&minor_prefix)) {
                        return Some(v.clone());
                    }
                }
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
    let mut queued_filenames: HashSet<String> = HashSet::new();
    let mut queued_hashes: HashSet<String> = HashSet::new();

    let mut visited_projects: HashSet<String> = HashSet::new();
    let mut visited_versions: HashSet<String> = HashSet::new();
    let mut targets_to_resolve: VecDeque<ResolveTarget> = VecDeque::new();

    // Populate initial targets
    for slug in mod_slugs {
        let clean = slug.trim().to_string();
        if !clean.is_empty() {
            targets_to_resolve.push_back(ResolveTarget::Project(clean));
        }
    }

    // Always guarantee Fabric API for Fabric & Quilt instances
    if matches!(loader_type.as_str(), "Fabric" | "Quilt") {
        let has_fabric_api = targets_to_resolve.iter().any(|t| match t {
            ResolveTarget::Project(p) => p.eq_ignore_ascii_case("fabric-api") || p == "P7dR8mSH",
            _ => false,
        });
        if !has_fabric_api {
            targets_to_resolve.push_front(ResolveTarget::Project("fabric-api".to_string()));
        }
    }

    // 3. Resolve all mods and dependencies recursively
    let mut resolved_count = 0;
    while let Some(target) = targets_to_resolve.pop_front() {
        let target_display: String;
        let maybe_version = match &target {
            ResolveTarget::Version { version_id, fallback_project_id } => {
                if visited_versions.contains(version_id) {
                    continue;
                }
                if let Some(ref pid) = fallback_project_id {
                    let trimmed = pid.trim();
                    if visited_projects.contains(trimmed) || visited_projects.contains(&trimmed.to_lowercase()) {
                        continue;
                    }
                }
                visited_versions.insert(version_id.clone());
                target_display = format!("version:{}", version_id);

                let mut v = fetch_version_by_id(&client, version_id).await;
                if v.is_none() {
                    if let Some(pid) = fallback_project_id {
                        if !visited_projects.contains(pid) && !visited_projects.contains(&pid.to_lowercase()) {
                            v = fetch_latest_version_for_project(&client, pid, &game_version, &loader_type).await;
                        }
                    }
                }
                v
            }
            ResolveTarget::Project(pid) => {
                let trimmed = pid.trim();
                // Check if already visited by exact case or lower case
                if visited_projects.contains(trimmed) || visited_projects.contains(&trimmed.to_lowercase()) {
                    continue;
                }
                visited_projects.insert(trimmed.to_string());
                visited_projects.insert(trimmed.to_lowercase());
                target_display = trimmed.to_string();

                fetch_latest_version_for_project(&client, trimmed, &game_version, &loader_type).await
            }
        };

        let _ = app.emit(
            "builder-progress",
            BuilderProgress {
                status: "resolving".to_string(),
                message: format!("Поиск мода и зависимостей: {}", target_display),
                current: resolved_count,
                total: visited_projects.len() + visited_versions.len() + targets_to_resolve.len(),
                current_item: Some(target_display.clone()),
            },
        );

        if let Some(version) = maybe_version {
            // Mark version ID and project ID as visited so we don't query them again
            visited_versions.insert(version.id.clone());
            if let Some(ref proj_id) = version.project_id {
                visited_projects.insert(proj_id.clone());
                visited_projects.insert(proj_id.to_lowercase());
            }

            // Pick primary file or first file
            if let Some(file) = version
                .files
                .iter()
                .find(|f| f.primary)
                .or_else(|| version.files.first())
            {
                if is_trusted_download_url(&file.url) {
                    let sanitized = crate::security::sanitize_filename(&file.filename);
                    let primary_hash = file
                        .hashes
                        .get("sha1")
                        .or_else(|| file.hashes.get("sha512"))
                        .cloned()
                        .unwrap_or_else(|| sanitized.clone());

                    if !queued_filenames.contains(&sanitized) && !queued_hashes.contains(&primary_hash) {
                        queued_filenames.insert(sanitized.clone());
                        queued_hashes.insert(primary_hash);
                        download_queue.push(ModDownloadItem {
                            name: version.name.clone(),
                            filename: sanitized,
                            download_url: file.url.clone(),
                            hashes: file.hashes.clone(),
                        });
                    }
                }
            }

            // Check required dependencies
            if let Some(deps) = version.dependencies {
                for dep in deps {
                    if dep.dependency_type == "required" {
                        // If project is already resolved, don't queue older or duplicate version
                        if let Some(ref pid) = dep.project_id {
                            let trimmed = pid.trim();
                            if visited_projects.contains(trimmed) || visited_projects.contains(&trimmed.to_lowercase()) {
                                continue;
                            }
                        }

                        if let Some(vid) = dep.version_id {
                            if !visited_versions.contains(&vid) {
                                targets_to_resolve.push_back(ResolveTarget::Version {
                                    version_id: vid,
                                    fallback_project_id: dep.project_id.clone(),
                                });
                            }
                        } else if let Some(pid) = dep.project_id {
                            let trimmed = pid.trim();
                            if !visited_projects.contains(trimmed) && !visited_projects.contains(&trimmed.to_lowercase()) {
                                targets_to_resolve.push_back(ResolveTarget::Project(trimmed.to_string()));
                            }
                        }
                    }
                }
            }
        } else {
            log::warn!(
                "Не удалось найти версию для '{}' ({} / {})",
                target_display,
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
