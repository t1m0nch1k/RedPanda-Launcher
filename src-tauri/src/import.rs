use futures::stream::{self, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{self, Read, Seek};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
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
    const MAX_DOWNLOAD_BYTES: u64 = 500 * 1024 * 1024;
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

    // Determine loader type
    let (loader_type, loader_version) = if let Some(v) = manifest.dependencies.get("fabric-loader")
    {
        ("Fabric", v.clone())
    } else if let Some(v) = manifest.dependencies.get("forge") {
        ("Forge", v.clone())
    } else if let Some(v) = manifest.dependencies.get("neoforge") {
        ("NeoForge", v.clone())
    } else if let Some(v) = manifest.dependencies.get("quilt-loader") {
        ("Quilt", v.clone())
    } else {
        ("Vanilla", "".to_string())
    };

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
        loader_type.to_string(),
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
    let failed = Arc::new(Mutex::new(Vec::<String>::new()));

    let _ = app.emit(
        "mrpack-progress",
        ImportProgress {
            total: total_files,
            current: 0,
            message: format!("Скачивание модов (0/{})", total_files),
        },
    );

    // Create a stream of downloads
    let mut stream = stream::iter(manifest.files)
        .map(|file_meta| {
            let client = client.clone();
            let instance_dir = instance_dir.clone();
            let app = app.clone();
            let downloaded = downloaded.clone();
            let failed = failed.clone();
            let total = total_files;

            async move {
                if file_meta.downloads.is_empty() {
                    failed.lock().unwrap().push(file_meta.path.clone());
                    return Ok(());
                }

                let url = &file_meta.downloads[0];
                if !crate::modrinth::is_trusted_download_url(url) {
                    log::error!("Skipping untrusted download URL {url}");
                    failed.lock().unwrap().push(file_meta.path.clone());
                    return Ok::<(), ()>(());
                }
                let target_path = match crate::security::safe_join(&instance_dir, &file_meta.path) {
                    Ok(p) => p,
                    Err(e) => {
                        log::error!("Skipping unsafe file path '{}': {}", file_meta.path, e);
                        failed.lock().unwrap().push(file_meta.path.clone());
                        return Ok(());
                    }
                };

                if let Some(p) = target_path.parent() {
                    if let Err(e) = fs::create_dir_all(p) {
                        log::error!("Failed to create directory for {}: {}", file_meta.path, e);
                        failed.lock().unwrap().push(file_meta.path.clone());
                        return Ok(());
                    }
                }

                // Retry logic could be added here
                match client.get(url).send().await {
                    Ok(resp) => {
                        if !resp.status().is_success() {
                            log::error!("Failed to download {}: HTTP {}", url, resp.status());
                            failed.lock().unwrap().push(file_meta.path.clone());
                        } else if resp
                            .content_length()
                            .is_some_and(|size| size > MAX_DOWNLOAD_BYTES)
                        {
                            log::error!("Skipping oversized file {}", url);
                            failed.lock().unwrap().push(file_meta.path.clone());
                        } else if let Ok(bytes) = resp.bytes().await {
                            if bytes.len() as u64 <= MAX_DOWNLOAD_BYTES {
                                if let Err(error) = crate::downloads::verify_modrinth_hashes(
                                    &bytes,
                                    &file_meta.hashes,
                                ) {
                                    log::error!(
                                        "Checksum validation failed for {}: {}",
                                        file_meta.path,
                                        error
                                    );
                                    failed.lock().unwrap().push(file_meta.path.clone());
                                } else {
                                    if let Err(error) =
                                        crate::storage::atomic_write(&target_path, &bytes)
                                    {
                                        log::error!("Failed to save {}: {}", file_meta.path, error);
                                        failed.lock().unwrap().push(file_meta.path.clone());
                                    }
                                }
                            } else {
                                log::error!("Skipping oversized file {}", url);
                                failed.lock().unwrap().push(file_meta.path.clone());
                            }
                        } else {
                            failed.lock().unwrap().push(file_meta.path.clone());
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to download {}: {}", url, e);
                        failed.lock().unwrap().push(file_meta.path.clone());
                    }
                }

                let curr = downloaded.fetch_add(1, Ordering::SeqCst) + 1;
                let _ = app.emit(
                    "mrpack-progress",
                    ImportProgress {
                        total,
                        current: curr,
                        message: format!("Скачивание модов ({}/{})", curr, total),
                    },
                );

                Ok::<(), ()>(())
            }
        })
        .buffer_unordered(10); // Download 10 files at a time

    while stream.next().await.is_some() {}

    let failed_files = failed.lock().unwrap().clone();
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

    log::info!("Import of .mrpack completed successfully!");

    let _ = app.emit(
        "mrpack-progress",
        ImportProgress {
            total: 100,
            current: 100,
            message: "Готово!".to_string(),
        },
    );

    if final_instance_dir.exists() {
        fs::remove_dir_all(&final_instance_dir)
            .map_err(|e| format!("Не удалось подготовить замену экземпляра: {e}"))?;
    }
    fs::rename(staging.path(), &final_instance_dir)
        .map_err(|e| format!("Не удалось применить импорт: {e}"))?;
    metadata_guard.commit();
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
    const MAX_DOWNLOAD_BYTES: u64 = 500 * 1024 * 1024;
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
    let failed = Arc::new(Mutex::new(Vec::<String>::new()));

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
            let failed = failed.clone();
            let total = total_files;

            async move {
                if !file_meta.required {
                    let curr = downloaded.fetch_add(1, Ordering::SeqCst) + 1;
                    let _ = app.emit(
                        "mrpack-progress",
                        ImportProgress {
                            total,
                            current: curr,
                            message: format!("Скачивание модов ({}/{})", curr, total),
                        },
                    );
                    return Ok::<(), ()>(());
                }

                // 1. Fetch file info to get download URL and filename
                let api_url = format!(
                    "https://api.curseforge.com/v1/mods/{}/files/{}",
                    file_meta.project_id, file_meta.file_id
                );
                let api_key = get_curseforge_api_key(&app);

                let file_info = match client
                    .get(&api_url)
                    .header("x-api-key", &api_key)
                    .send()
                    .await
                {
                    Ok(resp) => {
                        if let Ok(info) = resp.json::<CurseForgeFileResponse>().await {
                            Some(info.data)
                        } else {
                            None
                        }
                    }
                    Err(_) => None,
                };

                if let Some(info) = file_info {
                    let url = info.download_url;

                    // Sometimes CurseForge API omits the downloadUrl, we have to construct it
                    if url.is_none() {
                        // For simplicity, just ignore if no url
                    }

                    if let Some(dl_url) = url {
                        if !crate::curseforge::is_trusted_download_url(&dl_url) {
                            log::error!("Skipping untrusted CurseForge URL {}", dl_url);
                            failed.lock().unwrap().push(info.file_name.clone());
                            return Ok::<(), ()>(());
                        }
                        let clean_filename = crate::security::sanitize_filename(&info.file_name);
                        let target_path = instance_dir.join("mods").join(clean_filename);

                        if let Some(p) = target_path.parent() {
                            if let Err(e) = fs::create_dir_all(p) {
                                log::error!(
                                    "Failed to create directory for {}: {}",
                                    info.file_name,
                                    e
                                );
                                failed.lock().unwrap().push(info.file_name.clone());
                                return Ok(());
                            }
                        }

                        match client.get(&dl_url).send().await {
                            Ok(resp) => {
                                if !resp.status().is_success() {
                                    log::error!(
                                        "Failed to download {}: HTTP {}",
                                        dl_url,
                                        resp.status()
                                    );
                                    failed.lock().unwrap().push(info.file_name.clone());
                                } else if resp
                                    .content_length()
                                    .is_some_and(|size| size > MAX_DOWNLOAD_BYTES)
                                {
                                    log::error!("Skipping oversized file {}", dl_url);
                                    failed.lock().unwrap().push(info.file_name.clone());
                                } else if let Ok(bytes) = resp.bytes().await {
                                    if bytes.len() as u64 <= MAX_DOWNLOAD_BYTES {
                                        let expected_sha1 =
                                            info.hashes.as_ref().and_then(|hashes| {
                                                hashes
                                                    .iter()
                                                    .find(|hash| hash.algo == 2)
                                                    .map(|hash| hash.value.clone())
                                            });
                                        if let Some(expected_sha1) = expected_sha1 {
                                            if crate::downloads::verify_sha1(&bytes, &expected_sha1)
                                                .is_ok()
                                            {
                                                if let Err(error) = crate::storage::atomic_write(
                                                    &target_path,
                                                    &bytes,
                                                ) {
                                                    log::error!(
                                                        "Failed to save {}: {}",
                                                        info.file_name,
                                                        error
                                                    );
                                                    failed
                                                        .lock()
                                                        .unwrap()
                                                        .push(info.file_name.clone());
                                                }
                                            } else {
                                                log::error!(
                                                    "Checksum validation failed for {}",
                                                    info.file_name
                                                );
                                                failed.lock().unwrap().push(info.file_name.clone());
                                            }
                                        } else {
                                            log::error!("Missing checksum for {}", info.file_name);
                                            failed.lock().unwrap().push(info.file_name.clone());
                                        }
                                    } else {
                                        log::error!("Skipping oversized file {}", dl_url);
                                        failed.lock().unwrap().push(info.file_name.clone());
                                    }
                                } else {
                                    failed.lock().unwrap().push(info.file_name.clone());
                                }
                            }
                            Err(e) => {
                                log::error!("Failed to download {}: {}", dl_url, e);
                                failed.lock().unwrap().push(info.file_name.clone());
                            }
                        }
                    } else {
                        failed.lock().unwrap().push(info.file_name.clone());
                    }
                } else {
                    failed
                        .lock()
                        .unwrap()
                        .push(format!("{}:{}", file_meta.project_id, file_meta.file_id));
                }

                let curr = downloaded.fetch_add(1, Ordering::SeqCst) + 1;
                let _ = app.emit(
                    "mrpack-progress",
                    ImportProgress {
                        total,
                        current: curr,
                        message: format!("Скачивание модов ({}/{})", curr, total),
                    },
                );

                Ok::<(), ()>(())
            }
        })
        .buffer_unordered(10);

    while stream.next().await.is_some() {}

    let failed_files = failed.lock().unwrap().clone();
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

    log::info!("Import of CurseForge pack completed successfully!");

    let _ = app.emit(
        "mrpack-progress",
        ImportProgress {
            total: 100,
            current: 100,
            message: "Готово!".to_string(),
        },
    );

    if final_instance_dir.exists() {
        fs::remove_dir_all(&final_instance_dir)
            .map_err(|e| format!("Не удалось подготовить замену экземпляра: {e}"))?;
    }
    fs::rename(staging.path(), &final_instance_dir)
        .map_err(|e| format!("Не удалось применить импорт: {e}"))?;
    metadata_guard.commit();
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
