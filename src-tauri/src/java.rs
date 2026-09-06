use serde::Deserialize;
use std::fs::{self, File};
use std::path::PathBuf;
use zip::ZipArchive;

pub fn get_required_java_version(mc_version: &str) -> u8 {
    // Modern snapshots (24w..., 25w..., 26w...) or pre-releases/release candidates
    if mc_version.starts_with("24w") || mc_version.starts_with("25w") || mc_version.starts_with("26w") {
        return 21;
    }

    let parts: Vec<&str> = mc_version.split('.').collect();
    if !parts.is_empty() {
        if let Ok(major) = parts[0].parse::<u32>() {
            // Modern year-based releases (26.x, 27.x, etc.)
            if major >= 24 {
                return 21;
            }
            if major == 1 && parts.len() >= 2 {
                if let Ok(minor) = parts[1].parse::<u32>() {
                    if minor >= 21 {
                        return 21;
                    }
                    if minor == 20 {
                        let patch = parts
                            .get(2)
                            .and_then(|p| p.split(|c: char| !c.is_ascii_digit()).next())
                            .and_then(|p| p.parse::<u32>().ok())
                            .unwrap_or(0);
                        if patch >= 5 {
                            return 21;
                        }
                        return 17;
                    }
                    if minor >= 17 {
                        return 17;
                    }
                    return 8;
                }
            }
        }
    }
    21 // default fallback for modern Minecraft is Java 21
}

pub async fn ensure_java_runtime(mc_version: &str) -> Result<PathBuf, String> {
    let java_version = get_required_java_version(mc_version);

    if let Some(java) = find_java_on_path() {
        return Ok(java);
    }

    let base_dir = dirs::data_dir()
        .ok_or_else(|| "Could not determine AppData directory".to_string())?
        .join("RedPandaLauncher")
        .join("runtimes")
        .join(format!("java-{}", java_version));

    // Check if java.exe already exists
    let java_exe = base_dir.join("bin").join("java.exe");
    if java_exe.exists() {
        return Ok(java_exe);
    }

    // Search inside subdirectories if extracted inside a wrapper folder like jdk-17.0.9+9-jre
    if base_dir.exists() {
        if let Ok(entries) = fs::read_dir(&base_dir) {
            for entry in entries.flatten() {
                let sub_java = entry.path().join("bin").join("java.exe");
                if sub_java.exists() {
                    return Ok(sub_java);
                }
            }
        }
    }

    log::info!(
        "Downloading Java {} runtime for Minecraft {}...",
        java_version,
        mc_version
    );
    fs::create_dir_all(&base_dir).map_err(|e| e.to_string())?;

    let client = crate::downloads::trusted_download_client(&format!(
        "RedPandaLauncher/{}",
        env!("REDPANDA_VERSION")
    ))?;
    let metadata_url = format!(
        "https://api.adoptium.net/v3/assets/latest/{java_version}/ga?architecture=x64&image_type=jre&jvm_impl=hotspot&os=windows&vendor=eclipse"
    );
    let assets: Vec<AdoptiumAsset> = client
        .get(metadata_url)
        .send()
        .await
        .map_err(|e| format!("Не удалось получить метаданные Java: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Adoptium вернул ошибку метаданных Java: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Некорректные метаданные Java: {e}"))?;
    let package = assets
        .first()
        .and_then(|asset| asset.binary.package.as_ref())
        .ok_or_else(|| "Adoptium не вернул пакет Java".to_string())?;
    let staging = tempfile::tempdir_in(
        base_dir
            .parent()
            .ok_or_else(|| "Не удалось определить папку runtime".to_string())?,
    )
    .map_err(|e| format!("Не удалось создать staging для Java: {e}"))?;
    let staging_path = staging.path().to_path_buf();
    let archive_path = staging_path.join("java.zip");
    crate::downloads::download_to_file(&client, &package.link, &archive_path, &package.checksum)
        .await?;
    let archive_file =
        File::open(&archive_path).map_err(|e| format!("Failed to read Java archive: {e}"))?;
    let mut archive =
        ZipArchive::new(archive_file).map_err(|e| format!("Failed to open Zip archive: {}", e))?;

    if archive.len() > 10_000 {
        return Err("Java archive contains too many files".to_string());
    }
    let mut total_uncompressed = 0u64;
    for index in 0..archive.len() {
        let file = archive.by_index(index).map_err(|e| e.to_string())?;
        total_uncompressed = total_uncompressed
            .checked_add(file.size())
            .ok_or_else(|| "Java archive size overflow".to_string())?;
        if total_uncompressed > 8 * 1024 * 1024 * 1024 {
            return Err("Java archive exceeds the 8 GB unpacked limit".to_string());
        }
        if file.compressed_size() > 0 && file.size() / file.compressed_size() > 1_000 {
            return Err("Java archive contains a suspiciously compressed file".to_string());
        }
    }

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => staging_path.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    let staged_java = staging_path.join("bin").join("java.exe");
    if !staged_java.exists()
        && !fs::read_dir(&staging_path).ok().is_some_and(|entries| {
            entries
                .flatten()
                .any(|entry| entry.path().join("bin").join("java.exe").exists())
        })
    {
        return Err(format!(
            "Java {} downloaded but java.exe was not found",
            java_version
        ));
    }
    drop(archive);
    fs::remove_file(&archive_path).map_err(|e| format!("Не удалось удалить архив Java: {e}"))?;

    // Replace an incomplete/old runtime only after the archive has been fully
    // downloaded, verified and extracted. Keep a rollback path for failures.
    let backup_path = base_dir.with_file_name(format!(
        ".{}.backup-{}",
        base_dir
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("java"),
        uuid::Uuid::new_v4()
    ));
    let had_old_runtime = base_dir.exists();
    if had_old_runtime {
        fs::rename(&base_dir, &backup_path)
            .map_err(|e| format!("Не удалось подготовить замену Java runtime: {e}"))?;
    }
    if let Err(error) = fs::rename(&staging_path, &base_dir) {
        if had_old_runtime {
            let _ = fs::rename(&backup_path, &base_dir);
        }
        return Err(format!("Не удалось установить Java runtime: {error}"));
    }
    if had_old_runtime {
        let _ = fs::remove_dir_all(&backup_path);
    }

    // Check again for java.exe
    if java_exe.exists() {
        return Ok(java_exe);
    }

    if let Ok(entries) = fs::read_dir(&base_dir) {
        for entry in entries.flatten() {
            let sub_java = entry.path().join("bin").join("java.exe");
            if sub_java.exists() {
                return Ok(sub_java);
            }
        }
    }

    Err(format!(
        "Java {} downloaded but java.exe was not found",
        java_version
    ))
}

#[derive(Debug, Deserialize)]
struct AdoptiumAsset {
    binary: AdoptiumBinary,
}

#[derive(Debug, Deserialize)]
struct AdoptiumBinary {
    package: Option<AdoptiumPackage>,
}

#[derive(Debug, Deserialize)]
struct AdoptiumPackage {
    link: String,
    checksum: String,
}

fn find_java_on_path() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let mut command = std::process::Command::new("where.exe");
        command.creation_flags(0x08000000);
        let output = command.arg("java.exe").output().ok()?;
        let output_text = String::from_utf8_lossy(&output.stdout).into_owned();
        let candidate = output_text.lines().next()?.trim().to_string();
        let path = PathBuf::from(candidate);
        path.exists().then_some(path)
    }
    #[cfg(not(windows))]
    {
        None
    }
}
