use futures::stream::{self, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{self, Read, Seek};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

use crate::instances::add_instance;

#[derive(Debug, Deserialize)]
struct MrpackManifest {
    #[serde(rename = "formatVersion")]
    pub format_version: u32,
    pub name: String,
    pub dependencies: HashMap<String, String>,
    pub files: Vec<MrpackFile>,
}

#[derive(Debug, Deserialize)]
struct MrpackFile {
    pub path: String,
    pub downloads: Vec<String>,
    #[serde(default)]
    pub hashes: HashMap<String, String>,
}

const MAX_ARCHIVE_FILES: usize = 10_000;
const MAX_ARCHIVE_UNCOMPRESSED_BYTES: u64 = 8 * 1024 * 1024 * 1024;
const MAX_ARCHIVE_FILE_BYTES: u64 = 1024 * 1024 * 1024;
const MAX_IMPORT_CONCURRENT_DOWNLOADS: usize = 4;

fn mrpack_loader(dependencies: &HashMap<String, String>) -> Result<(String, String), String> {
    let loaders = [
        ("fabric-loader", "Fabric"),
        ("forge", "Forge"),
        // Older RedPanda exports used these two aliases. Accepting them keeps
        // existing exported packs importable without changing the canonical
        // Modrinth dependency keys.
        ("forge-loader", "Forge"),
        ("neoforge", "NeoForge"),
        ("neoforge-loader", "NeoForge"),
        ("quilt-loader", "Quilt"),
    ];
    let mut resolved = Vec::new();
    for (key, loader_type) in loaders {
        if let Some(version) = dependencies.get(key) {
            resolved.push((loader_type, version.as_str(), key));
        }
    }

    let Some((loader_type, loader_version, _)) = resolved.first() else {
        return Ok(("Vanilla".to_string(), String::new()));
    };
    if resolved
        .iter()
        .any(|(type_name, version, _)| type_name != loader_type || version != loader_version)
    {
        return Err("В modrinth.index.json указаны конфликтующие загрузчики".to_string());
    }
    Ok(((*loader_type).to_string(), (*loader_version).to_string()))
}

fn validate_archive<R: Read + Seek>(archive: &mut zip::ZipArchive<R>) -> Result<(), String> {
    if archive.len() > MAX_ARCHIVE_FILES {
        return Err("Архив содержит слишком много файлов".to_string());
    }
    let mut total_size = 0u64;
    for index in 0..archive.len() {
        let file = archive
            .by_index(index)
            .map_err(|e| format!("Не удалось проверить архив: {e}"))?;
        total_size = total_size
            .checked_add(file.size())
            .ok_or_else(|| "Размер архива переполнен".to_string())?;
        if file.size() > MAX_ARCHIVE_FILE_BYTES {
            return Err(format!("Файл в архиве слишком большой: {}", file.name()));
        }
        if total_size > MAX_ARCHIVE_UNCOMPRESSED_BYTES {
            return Err("Распакованный размер архива превышает допустимый лимит".to_string());
        }
        if file.name().len() > 512 {
            return Err("Архив содержит слишком длинное имя файла".to_string());
        }
        if file.compressed_size() > 0 && file.size() / file.compressed_size() > 1_000 {
            return Err(format!(
                "Архив содержит подозрительно сжатый файл: {}",
                file.name()
            ));
        }
    }
    Ok(())
}

#[derive(Clone, Serialize)]
struct ImportProgress {
    total: usize,
    current: usize,
    message: String,
}

struct ImportMetadataGuard {
    app: Option<AppHandle>,
    instance_id: String,
}

impl ImportMetadataGuard {
    fn commit(&mut self) {
        self.app = None;
    }
}

impl Drop for ImportMetadataGuard {
    fn drop(&mut self) {
        if let Some(app) = self.app.take() {
            let id = self.instance_id.clone();
            tauri::async_runtime::spawn(async move {
                let _ = crate::instances::remove_instance(app, id).await;
            });
        }
    }
}

#[tauri::command]
pub async fn import_mrpack(app: AppHandle, path: String) -> Result<(), String> {
    log::info!("Starting import of .mrpack from {}", path);

    // 1. Read ZIP
    let file = fs::File::open(&path).map_err(|e| format!("Failed to open .mrpack: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read .mrpack: {}", e))?;
    validate_archive(&mut archive)?;

    // 2. Read modrinth.index.json
    let index_str = {
        let mut index_file = archive
            .by_name("modrinth.index.json")
            .map_err(|e| format!("Invalid .mrpack (missing modrinth.index.json): {}", e))?;
        if index_file.size() > 2 * 1024 * 1024 {
            return Err("modrinth.index.json слишком большой".to_string());
        }
        let mut contents = String::new();
        std::io::Read::read_to_string(&mut index_file, &mut contents).map_err(|e| e.to_string())?;
        contents
    };

    let manifest: MrpackManifest = serde_json::from_str(&index_str)
        .map_err(|e| format!("Invalid modrinth.index.json: {}", e))?;

    if manifest.format_version != 1 {
        return Err(format!(
            "Unsupported formatVersion: {}",
            manifest.format_version
        ));
    }

    let mc_version = manifest
        .dependencies
        .get("minecraft")
        .ok_or("No minecraft version in dependencies")?
        .clone();

    let (loader_type, loader_version) = mrpack_loader(&manifest.dependencies)?;

    let _ = app.emit(
        "mrpack-progress",
        ImportProgress {
            total: 100,
            current: 0,
            message: format!("Создание сборки {}...", manifest.name),
        },
    );

    // 3. Create Instance
    let instance = add_instance(
        app.clone(),
        manifest.name.clone(),
        mc_version,
        loader_type,
        loader_version,
    )
    .await?;
    let mut metadata_guard = ImportMetadataGuard {
        app: Some(app.clone()),
        instance_id: instance.id.clone(),
    };

    let final_instance_dir = crate::security::instance_dir(&instance.id)?;
    let data_dir = final_instance_dir
        .parent()
        .ok_or_else(|| "Не удалось определить каталог экземпляров".to_string())?;
    fs::create_dir_all(data_dir)
        .map_err(|e| format!("Не удалось создать каталог экземпляров: {e}"))?;
    let staging = tempfile::Builder::new()
        .prefix("redpanda-import-")
        .tempdir_in(data_dir)
        .map_err(|e| format!("Не удалось создать staging-каталог: {e}"))?;
    let instance_dir = staging.path().to_path_buf();

    // 4. Extract overrides
    // We have to extract everything from `overrides/` to the root of instance_dir.
    // And `client-overrides/` if it exists.
    let prefixes = ["overrides/", "client-overrides/"];

    // We reopen the archive to extract since it requires a mutable reference
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        let mut extracted_path = None;
        for prefix in prefixes {
            if let Ok(stripped) = outpath.strip_prefix(prefix) {
                extracted_path = Some(stripped.to_owned());
                break;
            }
        }

        if let Some(rel_path) = extracted_path {
            let relative = rel_path.to_string_lossy();
            let target_path = crate::security::safe_join(&instance_dir, &relative)?;

            if file.is_dir() {
                fs::create_dir_all(&target_path).map_err(|e| e.to_string())?;
            } else {
                if let Some(p) = target_path.parent() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
                let mut outfile = fs::File::create(&target_path).map_err(|e| e.to_string())?;
                io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
            }
        }
    }

    // 5. Download mods
    let client = crate::downloads::trusted_download_client("RedPandaLauncher/1.0.0")?;
    let total_files = manifest.files.len();
    let downloaded = Arc::new(AtomicUsize::new(0));

    let _ = app.emit(
        "mrpack-progress",
        ImportProgress {
            total: total_files,
            current: 0,
            message: format!("Скачивание модов (0/{})", total_files),
        },
    );

    // Downloads are streamed directly into staging, so bounded concurrency does
    // not multiply the response-body memory footprint.
    let mut stream = stream::iter(manifest.files)
        .map(|file_meta| {
            let client = client.clone();
            let instance_dir = instance_dir.clone();
            let app = app.clone();
            let downloaded = downloaded.clone();
            let total = total_files;

            async move {
                let file_path = file_meta.path.clone();
                let result = async {
                    let url = file_meta
                        .downloads
                        .iter()
                        .find(|url| crate::modrinth::is_trusted_download_url(url))
                        .ok_or_else(|| {
                            format!("Для {} нет доверенного адреса загрузки", file_meta.path)
                        })?;
                    let target_path = crate::security::safe_join(&instance_dir, &file_meta.path)
                        .map_err(|error| {
                            format!("Некорректный путь {}: {error}", file_meta.path)
                        })?;
                    crate::downloads::download_to_file_with_hashes(
                        &client,
                        url,
                        &target_path,
                        &file_meta.hashes,
                    )
                    .await
                    .map(|_| ())
                    .map_err(|error| format!("{file_path}: {error}"))
                }
                .await;

                let curr = downloaded.fetch_add(1, Ordering::SeqCst) + 1;
                let _ = app.emit(
                    "mrpack-progress",
                    ImportProgress {
                        total,
                        current: curr,
                        message: format!("Скачивание модов ({}/{})", curr, total),
                    },
                );

                result
            }
        })
        .buffer_unordered(MAX_IMPORT_CONCURRENT_DOWNLOADS);

    let mut failed_files = Vec::new();
    while let Some(result) = stream.next().await {
        if let Err(error) = result {
            log::error!("{error}");
            failed_files.push(error);
        }
    }

    if !failed_files.is_empty() {
        return Err(format!(
            "Не удалось импортировать {} файлов: {}",
            failed_files.len(),
            failed_files
                .iter()
                .take(10)
                .cloned()
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }

    if final_instance_dir.exists() {
        return Err(format!(
            "Каталог нового экземпляра уже существует: {}",
            final_instance_dir.display()
        ));
    }
    fs::rename(staging.path(), &final_instance_dir)
        .map_err(|e| format!("Не удалось применить импорт: {e}"))?;
    metadata_guard.commit();

    log::info!("Import of .mrpack completed successfully!");
    let _ = app.emit(
        "mrpack-progress",
        ImportProgress {
            total: 100,
            current: 100,
            message: "Готово!".to_string(),
        },
    );
    Ok(())
}

use crate::curseforge::get_curseforge_api_key;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeManifest {
    pub minecraft: CurseForgeMinecraft,
    pub name: String,
    pub files: Vec<CurseForgeFileReq>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeMinecraft {
    pub version: String,
    pub mod_loaders: Vec<CurseForgeModLoader>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeModLoader {
    pub id: String,
    pub primary: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeFileReq {
    pub project_id: u32,
    pub file_id: u32,
    pub required: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeFileResponse {
    pub data: CurseForgeFileData,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeFileData {
    pub download_url: Option<String>,
    pub file_name: String,
    #[serde(default)]
    pub hashes: Option<Vec<crate::curseforge::CurseForgeHash>>,
}

#[tauri::command]
pub async fn import_curseforge_pack(app: AppHandle, path: String) -> Result<(), String> {
    log::info!("Starting import of CurseForge pack from {}", path);

    // 1. Read ZIP
    let file = fs::File::open(&path).map_err(|e| format!("Failed to open pack: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read pack: {}", e))?;
    validate_archive(&mut archive)?;

    // 2. Read manifest.json
    let manifest_str = {
        let mut manifest_file = archive
            .by_name("manifest.json")
            .map_err(|e| format!("Invalid pack (missing manifest.json): {}", e))?;
        if manifest_file.size() > 2 * 1024 * 1024 {
            return Err("manifest.json слишком большой".to_string());
        }
        let mut contents = String::new();
        std::io::Read::read_to_string(&mut manifest_file, &mut contents)
            .map_err(|e| e.to_string())?;
        contents
    };

    let manifest: CurseForgeManifest =
        serde_json::from_str(&manifest_str).map_err(|e| format!("Invalid manifest.json: {}", e))?;

    let mc_version = manifest.minecraft.version;

    // Determine loader type from mod_loaders
    let mut loader_type = "Vanilla".to_string();
    let mut loader_version = "".to_string();

    if let Some(primary_loader) = manifest.minecraft.mod_loaders.iter().find(|l| l.primary) {
        if primary_loader.id.starts_with("forge-") {
            loader_type = "Forge".to_string();
            loader_version = primary_loader.id.replace("forge-", "");
        } else if primary_loader.id.starts_with("fabric-") {
            loader_type = "Fabric".to_string();
            loader_version = primary_loader.id.replace("fabric-", "");
        } else if primary_loader.id.starts_with("quilt-") {
            loader_type = "Quilt".to_string();
            loader_version = primary_loader.id.replace("quilt-", "");
        } else if primary_loader.id.starts_with("neoforge-") {
            loader_type = "NeoForge".to_string();
            loader_version = primary_loader.id.replace("neoforge-", "");
        }
    }

    let _ = app.emit(
        "mrpack-progress",
        ImportProgress {
            total: 100,
            current: 0,
            message: format!("Создание сборки {}...", manifest.name),
        },
    );

    // 3. Create Instance
    let instance = add_instance(
        app.clone(),
        manifest.name.clone(),
        mc_version,
        loader_type,
        loader_version,
    )
    .await?;
    let mut metadata_guard = ImportMetadataGuard {
        app: Some(app.clone()),
        instance_id: instance.id.clone(),
    };

    let final_instance_dir = crate::security::instance_dir(&instance.id)?;
    let data_dir = final_instance_dir
        .parent()
        .ok_or_else(|| "Не удалось определить каталог экземпляров".to_string())?;
    fs::create_dir_all(data_dir)
        .map_err(|e| format!("Не удалось создать каталог экземпляров: {e}"))?;
    let staging = tempfile::Builder::new()
        .prefix("redpanda-import-")
        .tempdir_in(data_dir)
        .map_err(|e| format!("Не удалось создать staging-каталог: {e}"))?;
    let instance_dir = staging.path().to_path_buf();

    // 4. Extract overrides/
    let prefixes = ["overrides/"];
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        let mut extracted_path = None;
        for prefix in prefixes {
            if let Ok(stripped) = outpath.strip_prefix(prefix) {
                extracted_path = Some(stripped.to_owned());
                break;
            }
        }

        if let Some(rel_path) = extracted_path {
            let relative = rel_path.to_string_lossy();
            let target_path = crate::security::safe_join(&instance_dir, &relative)?;

            if file.is_dir() {
                fs::create_dir_all(&target_path).map_err(|e| e.to_string())?;
            } else {
                if let Some(p) = target_path.parent() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
                let mut outfile = fs::File::create(&target_path).map_err(|e| e.to_string())?;
                io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
            }
        }
    }

    // 5. Download mods
    let client = crate::downloads::trusted_download_client("RedPandaLauncher/1.0.0")?;

    let total_files = manifest.files.len();
    let downloaded = Arc::new(AtomicUsize::new(0));

    let _ = app.emit(
        "mrpack-progress",
        ImportProgress {
            total: total_files,
            current: 0,
            message: format!("Скачивание модов (0/{})", total_files),
        },
    );

    let mut stream = stream::iter(manifest.files)
        .map(|file_meta| {
            let client = client.clone();
            let instance_dir = instance_dir.clone();
            let app = app.clone();
            let downloaded = downloaded.clone();
            let total = total_files;

            async move {
                let result = async {
                    if !file_meta.required {
                        return Ok(());
                    }

                    let api_url = format!(
                        "https://api.curseforge.com/v1/mods/{}/files/{}",
                        file_meta.project_id, file_meta.file_id
                    );
                    let api_key = get_curseforge_api_key(&app);
                    let response = client
                        .get(&api_url)
                        .header("x-api-key", &api_key)
                        .send()
                        .await
                        .map_err(|error| {
                            format!(
                                "{}:{}: ошибка запроса метаданных: {error}",
                                file_meta.project_id, file_meta.file_id
                            )
                        })?;
                    if !response.status().is_success() {
                        return Err(format!(
                            "{}:{}: CurseForge API вернул HTTP {}",
                            file_meta.project_id,
                            file_meta.file_id,
                            response.status()
                        ));
                    }
                    let info = response
                        .json::<CurseForgeFileResponse>()
                        .await
                        .map_err(|error| {
                            format!(
                                "{}:{}: некорректный ответ CurseForge: {error}",
                                file_meta.project_id, file_meta.file_id
                            )
                        })?
                        .data;
                    let download_url = info.download_url.ok_or_else(|| {
                        format!(
                            "{}: CurseForge не предоставил ссылку на скачивание",
                            info.file_name
                        )
                    })?;
                    if !crate::curseforge::is_trusted_download_url(&download_url) {
                        return Err(format!(
                            "{}: указан недоверенный адрес загрузки",
                            info.file_name
                        ));
                    }
                    let expected_sha1 = info
                        .hashes
                        .as_ref()
                        .and_then(|hashes| {
                            hashes
                                .iter()
                                .find(|hash| hash.algo == crate::curseforge::HASH_ALGO_SHA1)
                                .map(|hash| hash.value.as_str())
                        })
                        .ok_or_else(|| format!("{}: отсутствует SHA-1 checksum", info.file_name))?;
                    let clean_filename = crate::security::sanitize_filename(&info.file_name);
                    let mods_dir = instance_dir.join("mods");
                    let target_path = crate::security::safe_join(&mods_dir, &clean_filename)?;
                    crate::downloads::download_to_file_with_sha1(
                        &client,
                        &download_url,
                        &target_path,
                        expected_sha1,
                    )
                    .await
                    .map(|_| ())
                    .map_err(|error| format!("{}: {error}", info.file_name))
                }
                .await;

                let curr = downloaded.fetch_add(1, Ordering::SeqCst) + 1;
                let _ = app.emit(
                    "mrpack-progress",
                    ImportProgress {
                        total,
                        current: curr,
                        message: format!("Скачивание модов ({}/{})", curr, total),
                    },
                );

                result
            }
        })
        .buffer_unordered(MAX_IMPORT_CONCURRENT_DOWNLOADS);

    let mut failed_files = Vec::new();
    while let Some(result) = stream.next().await {
        if let Err(error) = result {
            log::error!("{error}");
            failed_files.push(error);
        }
    }

    if !failed_files.is_empty() {
        return Err(format!(
            "Не удалось импортировать {} файлов: {}",
            failed_files.len(),
            failed_files
                .iter()
                .take(10)
                .cloned()
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }

    if final_instance_dir.exists() {
        return Err(format!(
            "Каталог нового экземпляра уже существует: {}",
            final_instance_dir.display()
        ));
    }
    fs::rename(staging.path(), &final_instance_dir)
        .map_err(|e| format!("Не удалось применить импорт: {e}"))?;
    metadata_guard.commit();

    log::info!("Import of CurseForge pack completed successfully!");
    let _ = app.emit(
        "mrpack-progress",
        ImportProgress {
            total: 100,
            current: 100,
            message: "Готово!".to_string(),
        },
    );
    Ok(())
}

#[tauri::command]
pub async fn is_curseforge_pack(path: String) -> Result<bool, String> {
    let file = fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut archive = match zip::ZipArchive::new(file) {
        Ok(a) => a,
        Err(_) => return Ok(false),
    };
    let is_ok = archive.by_name("manifest.json").is_ok();
    Ok(is_ok)
}
