use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use zip::write::FileOptions;
use zip::ZipWriter;
use chrono::Local;

pub fn backup_saves(instance_dir: &Path) -> Result<(), String> {
    let saves_dir = instance_dir.join("saves");
    if !saves_dir.exists() {
        // No saves to backup
        return Ok(());
    }

    let backups_dir = instance_dir.join("backups");
    if !backups_dir.exists() {
        std::fs::create_dir_all(&backups_dir).map_err(|e| format!("Failed to create backups dir: {}", e))?;
    }

    let now = Local::now();
    let timestamp = now.format("%Y-%m-%d_%H-%M-%S").to_string();
    let zip_filename = format!("saves_{}.zip", timestamp);
    let zip_path = backups_dir.join(&zip_filename);

    let zip_file = File::create(&zip_path).map_err(|e| format!("Failed to create zip file: {}", e))?;
    let mut zip = ZipWriter::new(zip_file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    // Recursively add all files in saves/ to the zip
    add_dir_to_zip(&saves_dir, &saves_dir, &mut zip, options)?;

    zip.finish().map_err(|e| format!("Failed to finish zip: {}", e))?;

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
            let mut buffer = Vec::new();
            f.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
            zip.write_all(&buffer).map_err(|e| e.to_string())?;
        } else if path.is_dir() {
            // we could add directory entries, but it's often not strictly necessary if we just add the files with full paths
            // however, some zip tools prefer them. Let's just recurse.
            add_dir_to_zip(root, &path, zip, options)?;
        }
    }
    Ok(())
}
