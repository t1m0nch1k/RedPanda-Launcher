use futures::stream::{self, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

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
}

#[derive(Clone, Serialize)]
struct ImportProgress {
    total: usize,
    current: usize,
    message: String,
}

#[tauri::command]
pub async fn import_mrpack(app: AppHandle, path: String) -> Result<(), String> {
    log::info!("Starting import of .mrpack from {}", path);

    // 1. Read ZIP
    let file = fs::File::open(&path).map_err(|e| format!("Failed to open .mrpack: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read .mrpack: {}", e))?;

    // 2. Read modrinth.index.json
    let index_str = {
        let mut index_file = archive
            .by_name("modrinth.index.json")
            .map_err(|e| format!("Invalid .mrpack (missing modrinth.index.json): {}", e))?;
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

    let mut instance_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    instance_dir.push("RedPandaLauncher");
    instance_dir.push(&instance.id);
    fs::create_dir_all(&instance_dir).map_err(|e| e.to_string())?;

    // 4. Extract overrides
    // We have to extract everything from `overrides/` to the root of instance_dir.
    // And `client-overrides/` if it exists.
    let prefixes = ["overrides/", "client-overrides/"];

    // We reopen the archive to extract since it requires a mutable reference
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).unwrap();
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
            let target_path = instance_dir.join(rel_path);

            if file.is_dir() {
                fs::create_dir_all(&target_path).unwrap_or(());
            } else {
                if let Some(p) = target_path.parent() {
                    fs::create_dir_all(p).unwrap_or(());
                }
                let mut outfile = fs::File::create(&target_path).map_err(|e| e.to_string())?;
                io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
            }
        }
    }

    // 5. Download mods
    let client = Client::new();
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

    // Create a stream of downloads
    let mut stream = stream::iter(manifest.files)
        .map(|file_meta| {
            let client = client.clone();
            let instance_dir = instance_dir.clone();
            let app = app.clone();
            let downloaded = downloaded.clone();
            let total = total_files;

            async move {
                if file_meta.downloads.is_empty() {
                    return Ok(());
                }

                let url = &file_meta.downloads[0];
                let target_path = instance_dir.join(&file_meta.path);

                if let Some(p) = target_path.parent() {
                    let _ = fs::create_dir_all(p);
                }

                // Retry logic could be added here
                match client.get(url).send().await {
                    Ok(resp) => {
                        if let Ok(bytes) = resp.bytes().await {
                            let _ = fs::write(&target_path, bytes);
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to download {}: {}", url, e);
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

    while let Some(_) = stream.next().await {}

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
