use reqwest::Client;
use serde::Serialize;
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

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

fn map_mod_slug(slug: &str, loader_type: &str) -> String {
    let clean = slug.trim();
    let lower = clean.to_lowercase();
    match lower.as_str() {
        "cataclysm" => "l_enders-cataclysm".to_string(),
        "applied-energistics-2" => "ae2".to_string(),
        "relics" => "relics-mod".to_string(),
        "ferrite-core" => "ferritecore".to_string(),
        "when-dungeons-arise" => "dungeons-arise".to_string(),
        "create" if matches!(loader_type, "Fabric" | "Quilt") => "create-fabric".to_string(),
        "create-fabric" if matches!(loader_type, "Forge" | "NeoForge") => "create".to_string(),
        "sodium" if loader_type == "Forge" => "embeddium".to_string(),
        "embeddium" if matches!(loader_type, "Fabric" | "Quilt") => "sodium".to_string(),
        _ => clean.to_string(),
    }
}

pub fn is_version_supported_by_mod(v: &ModrinthVersion, target_game_version: &str) -> bool {
    let Some(ref gvs) = v.game_versions else {
        return true;
    };
    if gvs.iter().any(|g| g == target_game_version) {
        return true;
    }
    let parts: Vec<&str> = target_game_version.split('.').collect();
    if parts.len() >= 2 {
        let minor_base = format!("{}.{}", parts[0], parts[1]);
        let minor_x = format!("{}.x", minor_base);
        let minor_star = format!("{}.*", minor_base);
        if gvs
            .iter()
            .any(|g| g == &minor_base || g.eq_ignore_ascii_case(&minor_x) || g == &minor_star)
        {
            return true;
        }
    }
    false
}

fn is_loader_supported_by_mod(v: &ModrinthVersion, loader_type: &str) -> bool {
    let Some(loaders) = &v.loaders else {
        return true;
    };
    if loader_type == "Vanilla" {
        return true;
    }

    loaders.iter().any(|loader| match loader_type {
        "Fabric" => loader.eq_ignore_ascii_case("fabric"),
        "Forge" => loader.eq_ignore_ascii_case("forge"),
        "NeoForge" => {
            loader.eq_ignore_ascii_case("neoforge") || loader.eq_ignore_ascii_case("forge")
        }
        "Quilt" => loader.eq_ignore_ascii_case("quilt") || loader.eq_ignore_ascii_case("fabric"),
        _ => false,
    })
}

fn is_version_compatible(version: &ModrinthVersion, game_version: &str, loader_type: &str) -> bool {
    is_version_supported_by_mod(version, game_version)
        && is_loader_supported_by_mod(version, loader_type)
}

fn register_selected_version(
    selected_versions: &mut HashMap<String, String>,
    version: &ModrinthVersion,
    fallback_project_id: Option<&str>,
) -> Result<(), String> {
    let project_id = version
        .project_id
        .as_deref()
        .or(fallback_project_id)
        .map(str::trim)
        .filter(|project_id| !project_id.is_empty());
    let Some(project_id) = project_id else {
        return Ok(());
    };
    let project_id = project_id.to_ascii_lowercase();

    match selected_versions.get(&project_id) {
        Some(selected_version) if selected_version != &version.id => Err(format!(
            "Конфликт обязательных зависимостей для проекта {project_id}: требуются версии {selected_version} и {}",
            version.id
        )),
        _ => {
            selected_versions.insert(project_id, version.id.clone());
            Ok(())
        }
    }
}

fn emit_builder_error(app: &AppHandle, message: &str, current: usize, total: usize) {
    let _ = app.emit(
        "builder-progress",
        BuilderProgress {
            status: "error".to_string(),
            message: message.to_string(),
            current,
            total,
            current_item: None,
        },
    );
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

    let mapped_slug = map_mod_slug(raw, loader_type);

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
    if let Some(mut list) = try_query(client, &mapped_slug, Some(game_version), loaders).await {
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

    // 4. Try querying by minor version base (e.g. "1.20" or "1.19")
    let parts: Vec<&str> = game_version.split('.').collect();
    if parts.len() >= 2 {
        let minor_base = format!("{}.{}", parts[0], parts[1]);
        if let Some(list) = try_query(client, &mapped_slug, Some(&minor_base), loaders).await {
            for v in list {
                if is_version_supported_by_mod(&v, game_version) {
                    return Some(v);
                }
            }
        }
    }

    // 5. Try querying all versions for this loader and find strictly compatible version
    if let Some(all_versions) = try_query(client, &mapped_slug, None, loaders).await {
        for v in all_versions {
            if is_version_supported_by_mod(&v, game_version) {
                return Some(v);
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

    // Resolve the loader before creating metadata. A failed build must not leave
    // an apparently valid instance in the user's list.
    let actual_loader_version = match loader_version {
        Some(lv) if !lv.trim().is_empty() => lv,
        _ => {
            let mut resolved = String::new();
            if let Ok(versions) =
                crate::versions::get_loader_versions(loader_type.clone(), game_version.clone())
                    .await
            {
                if let Some(first) = versions.first() {
                    resolved = first.clone();
                }
            }

            if resolved.trim().is_empty() {
                resolved = match loader_type.as_str() {
                    "Fabric" => "0.16.10".to_string(),
                    "Quilt" => "0.27.1".to_string(),
                    "NeoForge" => {
                        if game_version.starts_with("1.21") {
                            "21.1.72".to_string()
                        } else if game_version.starts_with("1.20.6") {
                            "20.6.119".to_string()
                        } else {
                            "20.4.80".to_string()
                        }
                    }
                    "Forge" => {
                        if game_version == "1.16.5" {
                            "36.2.39".to_string()
                        } else if game_version == "1.12.2" {
                            "14.23.5.2860".to_string()
                        } else if game_version == "1.18.2" {
                            "40.2.14".to_string()
                        } else if game_version == "1.19.2" {
                            "43.3.0".to_string()
                        } else if game_version == "1.20.1" {
                            "47.3.0".to_string()
                        } else {
                            "".to_string()
                        }
                    }
                    _ => "".to_string(),
                };
            }
            resolved
        }
    };
    if loader_type != "Vanilla" && actual_loader_version.trim().is_empty() {
        let message = format!(
            "Не удалось подобрать версию загрузчика {loader_type} для Minecraft {game_version}"
        );
        emit_builder_error(&app, &message, 0, mod_slugs.len());
        return Err(message);
    }

    let client = crate::downloads::trusted_download_client(&format!(
        "RedPandaLauncher/{}",
        env!("REDPANDA_VERSION")
    ))?;

    let mut download_queue: Vec<ModDownloadItem> = Vec::new();
    let mut queued_filenames: HashMap<String, String> = HashMap::new();
    let mut queued_hashes: HashSet<String> = HashSet::new();

    let mut visited_projects: HashSet<String> = HashSet::new();
    let mut visited_versions: HashSet<String> = HashSet::new();
    let mut selected_versions: HashMap<String, String> = HashMap::new();
    let mut targets_to_resolve: VecDeque<ResolveTarget> = VecDeque::new();
    let mut resolution_errors = Vec::new();

    // Populate initial targets with mapped slugs
    for slug in mod_slugs {
        let mapped = map_mod_slug(&slug, &loader_type);
        let clean = mapped.trim().to_string();
        if !clean.is_empty() {
            targets_to_resolve.push_back(ResolveTarget::Project(clean));
        }
    }

    // Always guarantee Fabric API and Indium for Fabric & Quilt instances
    if matches!(loader_type.as_str(), "Fabric" | "Quilt") {
        let has_fabric_api = targets_to_resolve.iter().any(|t| match t {
            ResolveTarget::Project(p) => p.eq_ignore_ascii_case("fabric-api") || p == "P7dR8mSH",
            _ => false,
        });
        if !has_fabric_api {
            targets_to_resolve.push_front(ResolveTarget::Project("fabric-api".to_string()));
        }

        let needs_indium = targets_to_resolve.iter().any(|t| match t {
            ResolveTarget::Project(p) => {
                let lower = p.to_lowercase();
                lower == "sodium"
                    || lower == "aanobbmi"
                    || lower == "supplementaries"
                    || lower == "create"
                    || lower == "create-fabric"
                    || lower == "botania"
                    || lower == "continuity"
                    || lower == "iris"
            }
            _ => false,
        });
        let has_indium = targets_to_resolve.iter().any(|t| match t {
            ResolveTarget::Project(p) => p.eq_ignore_ascii_case("indium") || p == "Orvt0mRa",
            _ => false,
        });
        if needs_indium && !has_indium {
            targets_to_resolve.push_back(ResolveTarget::Project("indium".to_string()));
        }
    }

    // Resolve all requested mods and every required dependency before mutating
    // the instance directory. Pinned dependencies are still inspected even when
    // their project has already been encountered so conflicting version pins do
    // not depend on traversal order.
    let mut resolved_count = 0;
    while let Some(target) = targets_to_resolve.pop_front() {
        let target_display: String;
        let fallback_project_id = match &target {
            ResolveTarget::Version {
                fallback_project_id,
                ..
            } => fallback_project_id.as_deref(),
            ResolveTarget::Project(_) => None,
        };
        let maybe_version = match &target {
            ResolveTarget::Version {
                version_id,
                fallback_project_id,
            } => {
                if visited_versions.contains(version_id) {
                    continue;
                }
                visited_versions.insert(version_id.clone());
                target_display = format!("version:{}", version_id);

                let pinned_version = fetch_version_by_id(&client, version_id).await;
                if pinned_version.as_ref().is_some_and(|version| {
                    is_version_compatible(version, &game_version, &loader_type)
                }) {
                    pinned_version
                } else if let Some(project_id) = fallback_project_id.as_deref() {
                    fetch_latest_version_for_project(
                        &client,
                        project_id,
                        &game_version,
                        &loader_type,
                    )
                    .await
                    .filter(|version| is_version_compatible(version, &game_version, &loader_type))
                } else {
                    None
                }
            }
            ResolveTarget::Project(pid) => {
                let trimmed = pid.trim();
                // Check if already visited by exact case or lower case
                if visited_projects.contains(trimmed)
                    || visited_projects.contains(&trimmed.to_lowercase())
                {
                    continue;
                }
                visited_projects.insert(trimmed.to_string());
                visited_projects.insert(trimmed.to_lowercase());
                target_display = trimmed.to_string();

                fetch_latest_version_for_project(&client, trimmed, &game_version, &loader_type)
                    .await
                    .filter(|version| is_version_compatible(version, &game_version, &loader_type))
            }
        };

        // If Sodium was resolved on Fabric/Quilt, ensure Indium is queued
        if matches!(loader_type.as_str(), "Fabric" | "Quilt") {
            let is_sodium = match &target {
                ResolveTarget::Project(p) => {
                    let l = p.to_lowercase();
                    l == "sodium" || l == "aanobbmi"
                }
                _ => false,
            };
            if is_sodium
                && !visited_projects.contains("indium")
                && !visited_projects.contains("orvt0mra")
            {
                let already_queued = targets_to_resolve.iter().any(|t| match t {
                    ResolveTarget::Project(p) => {
                        p.eq_ignore_ascii_case("indium") || p == "Orvt0mRa"
                    }
                    _ => false,
                });
                if !already_queued {
                    targets_to_resolve.push_back(ResolveTarget::Project("indium".to_string()));
                }
            }
        }

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
            if let Err(error) =
                register_selected_version(&mut selected_versions, &version, fallback_project_id)
            {
                resolution_errors.push(error);
                resolved_count += 1;
                continue;
            }

            // Mark version ID and project ID as visited so we don't query them again
            visited_versions.insert(version.id.clone());
            if let Some(ref proj_id) = version.project_id {
                visited_projects.insert(proj_id.clone());
                visited_projects.insert(proj_id.to_lowercase());
            }

            // Each resolved version must yield a trusted, verifiable artifact.
            if let Some(file) = version
                .files
                .iter()
                .find(|f| f.primary)
                .or_else(|| version.files.first())
            {
                if !is_trusted_download_url(&file.url) {
                    resolution_errors.push(format!(
                        "У мода {} указан недоверенный адрес загрузки",
                        version.name
                    ));
                } else {
                    let sanitized = crate::security::sanitize_filename(&file.filename);
                    let artifact_hash = file
                        .hashes
                        .get("sha512")
                        .or_else(|| file.hashes.get("sha256"))
                        .or_else(|| file.hashes.get("sha1"))
                        .cloned();
                    let Some(artifact_hash) = artifact_hash else {
                        resolution_errors.push(format!(
                            "У мода {} отсутствует поддерживаемый checksum",
                            version.name
                        ));
                        resolved_count += 1;
                        continue;
                    };

                    if let Some(queued_hash) = queued_filenames.get(&sanitized) {
                        if queued_hash != &artifact_hash {
                            resolution_errors.push(format!(
                                "Несовместимые обязательные файлы используют имя {sanitized}"
                            ));
                        }
                    } else if !queued_hashes.contains(&artifact_hash) {
                        queued_filenames.insert(sanitized.clone(), artifact_hash.clone());
                        queued_hashes.insert(artifact_hash);
                        download_queue.push(ModDownloadItem {
                            name: version.name.clone(),
                            filename: sanitized,
                            download_url: file.url.clone(),
                            hashes: file.hashes.clone(),
                        });
                    }
                }
            } else {
                resolution_errors.push(format!("У мода {} нет файла для загрузки", version.name));
            }

            // Check required dependencies
            if let Some(deps) = version.dependencies {
                for dep in deps {
                    if dep.dependency_type == "required" {
                        if let Some(vid) = dep.version_id {
                            if !visited_versions.contains(&vid) {
                                targets_to_resolve.push_back(ResolveTarget::Version {
                                    version_id: vid,
                                    fallback_project_id: dep
                                        .project_id
                                        .map(|p| map_mod_slug(&p, &loader_type)),
                                });
                            }
                        } else if let Some(pid) = dep.project_id {
                            let mapped = map_mod_slug(&pid, &loader_type);
                            let trimmed = mapped.trim();
                            if !visited_projects.contains(trimmed)
                                && !visited_projects.contains(&trimmed.to_lowercase())
                            {
                                targets_to_resolve
                                    .push_back(ResolveTarget::Project(trimmed.to_string()));
                            }
                        }
                    }
                }
            }
        } else {
            resolution_errors.push(format!(
                "Не удалось найти совместимую версию для '{}' ({} / {})",
                target_display, game_version, loader_type
            ));
        }

        resolved_count += 1;
    }

    if !resolution_errors.is_empty() {
        let message = format!(
            "Не удалось разрешить сборку ({} проблем): {}",
            resolution_errors.len(),
            resolution_errors
                .iter()
                .take(5)
                .cloned()
                .collect::<Vec<_>>()
                .join("; ")
        );
        emit_builder_error(&app, &message, resolved_count, resolved_count);
        return Err(message);
    }

    // Persist metadata only after dependency resolution. Downloads are written to
    // a sibling staging directory and published as one directory rename.
    let instance = crate::instances::add_instance(
        app.clone(),
        name,
        game_version.clone(),
        loader_type.clone(),
        actual_loader_version,
    )
    .await
    .inspect_err(|error| {
        emit_builder_error(&app, error, resolved_count, download_queue.len());
    })?;

    let instance_dir = crate::security::instance_dir(&instance.id)?;
    let data_dir = instance_dir
        .parent()
        .ok_or_else(|| "Не удалось определить каталог экземпляров".to_string())?
        .to_path_buf();
    let total_downloads = download_queue.len();
    let build_result = async {
        if instance_dir.exists() {
            return Err(format!(
                "Каталог нового экземпляра уже существует: {}",
                instance_dir.display()
            ));
        }
        fs::create_dir_all(&data_dir)
            .map_err(|error| format!("Не удалось создать каталог экземпляров: {error}"))?;
        let staging = tempfile::Builder::new()
            .prefix("redpanda-builder-")
            .tempdir_in(&data_dir)
            .map_err(|error| format!("Не удалось создать staging-каталог: {error}"))?;
        let mods_dir = staging.path().join("mods");
        fs::create_dir_all(&mods_dir)
            .map_err(|error| format!("Не удалось создать папку mods: {error}"))?;

        let mut download_errors = Vec::new();
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

            if let Err(error) = crate::downloads::download_to_file_with_hashes(
                &client,
                &item.download_url,
                &dest_path,
                &item.hashes,
            )
            .await
            {
                download_errors.push(format!("{}: {error}", item.name));
            }
        }

        if !download_errors.is_empty() {
            return Err(format!(
                "Не удалось скачать {} обязательных файлов: {}",
                download_errors.len(),
                download_errors
                    .iter()
                    .take(5)
                    .cloned()
                    .collect::<Vec<_>>()
                    .join("; ")
            ));
        }

        fs::rename(staging.path(), &instance_dir)
            .map_err(|error| format!("Не удалось опубликовать сборку: {error}"))?;
        Ok(())
    }
    .await;

    if let Err(error) = build_result {
        let message =
            match crate::instances::remove_instance(app.clone(), instance.id.clone()).await {
                Ok(()) => error,
                Err(cleanup_error) => {
                    format!("{error}. Не удалось удалить неполную запись сборки: {cleanup_error}")
                }
            };
        emit_builder_error(&app, &message, 0, total_downloads);
        return Err(message);
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
