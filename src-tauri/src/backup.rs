use chrono::Local;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use zip::ZipWriter;

pub fn backup_saves(instance_dir: &Path) -> Result<(), String> {
    let saves_dir = instance_dir.join("saves");
    if !saves_dir.exists() {
        // No saves to backup
        return Ok(());
    }

    let backups_dir = instance_dir.join("backups");
    if !backups_dir.exists() {
        std::fs::create_dir_all(&backups_dir)
            .map_err(|e| format!("Failed to create backups dir: {}", e))?;
    }

    let now = Local::now();
    let timestamp = now.format("%Y-%m-%d_%H-%M-%S").to_string();
    let zip_filename = format!("saves_{}_{}.zip", timestamp, uuid::Uuid::new_v4());
    let zip_path = backups_dir.join(&zip_filename);

    let temporary_path = backups_dir.join(format!(".{}.tmp", uuid::Uuid::new_v4()));
    let zip_file =
        File::create(&temporary_path).map_err(|e| format!("Failed to create zip file: {}", e))?;
    let mut zip = ZipWriter::new(zip_file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    // Recursively add all files in saves/ to the zip
    add_dir_to_zip(&saves_dir, &saves_dir, &mut zip, options)?;

    zip.finish()
        .map_err(|e| format!("Failed to finish zip: {}", e))?;
    fs::rename(&temporary_path, &zip_path).map_err(|e| format!("Failed to publish backup: {e}"))?;
    rotate_backups(&backups_dir, 5)?;

    Ok(())
}

fn add_dir_to_zip(
    root: &Path,
    dir: &Path,
    zip: &mut ZipWriter<File>,
    options: zip::write::SimpleFileOptions,
) -> Result<(), String> {
    if !dir.is_dir() {
        return Ok(());
    }

    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        let name = path
            .strip_prefix(root)
            .map_err(|e| e.to_string())?
            .to_str()
            .ok_or_else(|| "Invalid UTF-8 in path".to_string())?;

        // convert to unix path format for zip
        let name = name.replace("\\", "/");

        if path.is_file() {
            zip.start_file(name, options).map_err(|e| e.to_string())?;
            let mut f = File::open(&path).map_err(|e| e.to_string())?;
            std::io::copy(&mut f, zip).map_err(|e| e.to_string())?;
        } else if path.is_dir() {
            // we could add directory entries, but it's often not strictly necessary if we just add the files with full paths
            // however, some zip tools prefer them. Let's just recurse.
            add_dir_to_zip(root, &path, zip, options)?;
        }
    }
    Ok(())
}

fn rotate_backups(backups_dir: &Path, keep: usize) -> Result<(), String> {
    let mut files: Vec<(std::time::SystemTime, PathBuf)> = fs::read_dir(backups_dir)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("zip") {
                return None;
            }
            let modified = entry.metadata().ok()?.modified().ok()?;
            Some((modified, path))
        })
        .collect();
    files.sort_by_key(|(modified, _)| *modified);
    for (_, path) in files.into_iter().rev().skip(keep) {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn list_backups(instance_id: String) -> Result<Vec<String>, String> {
    let instance = crate::security::instance_dir(&instance_id)?;
    let backups = instance.join("backups");
    if !backups.exists() {
        return Ok(Vec::new());
    }
    let mut result = fs::read_dir(backups)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("zip") {
                Some(path.file_name()?.to_string_lossy().into_owned())
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    result.sort();
    Ok(result)
}

#[tauri::command]
pub async fn restore_backup(instance_id: String, filename: String) -> Result<(), String> {
    let instance = crate::security::instance_dir(&instance_id)?;
    let filename = crate::security::validate_filename(&filename)?;
    let backup = crate::security::safe_join(&instance.join("backups"), &filename)?;
    if !backup.exists() {
        return Err("Резервная копия не найдена".to_string());
    }
    let file = File::open(&backup).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    if archive.len() > 10_000 {
        return Err("Backup contains too many files".to_string());
    }
    let mut unpacked_size = 0u64;
    for index in 0..archive.len() {
        let entry = archive.by_index(index).map_err(|e| e.to_string())?;
        unpacked_size = unpacked_size
            .checked_add(entry.size())
            .ok_or_else(|| "Backup size overflow".to_string())?;
        if entry.size() > 1024 * 1024 * 1024 || unpacked_size > 8 * 1024 * 1024 * 1024 {
            return Err("Backup exceeds the unpacked size limit".to_string());
        }
        if entry.compressed_size() > 0 && entry.size() / entry.compressed_size() > 1_000 {
            return Err("Backup contains suspicious compression".to_string());
        }
    }
    let staging = tempfile::Builder::new()
        .prefix("redpanda-restore-")
        .tempdir_in(&instance)
        .map_err(|e| e.to_string())?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|e| e.to_string())?;
        let relative = entry.enclosed_name().ok_or("Небезопасный путь в backup")?;
        let target = crate::security::safe_join(staging.path(), &relative.to_string_lossy())?;
        if entry.is_dir() {
            fs::create_dir_all(&target).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut output = File::create(target).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut output).map_err(|e| e.to_string())?;
        }
    }
    let saves = instance.join("saves");
    let old = instance.join(format!(".saves-before-{}", uuid::Uuid::new_v4()));
    if saves.exists() {
        fs::rename(&saves, &old).map_err(|e| e.to_string())?;
    }
    if let Err(error) = fs::rename(staging.path(), &saves) {
        if old.exists() {
            let _ = fs::rename(&old, &saves);
        }
        return Err(format!("Не удалось восстановить backup: {error}"));
    }
    if old.exists() {
        let _ = fs::remove_dir_all(old);
    }
    Ok(())
}
