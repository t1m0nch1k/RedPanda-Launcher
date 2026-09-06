use serde::de::DeserializeOwned;
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;

/// Writes a small application data file through a sibling temporary file.
/// The rename is performed with replace semantics on Windows, so readers never
/// observe a partially-written JSON document.
pub fn atomic_write(path: &Path, contents: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Target path has no parent directory".to_string())?;
    fs::create_dir_all(parent).map_err(|e| format!("Failed to create data directory: {e}"))?;

    let temp_path = parent.join(format!(
        ".{}.{}.tmp",
        path.file_name().unwrap_or_default().to_string_lossy(),
        uuid::Uuid::new_v4()
    ));
    let result = (|| {
        let mut file = File::create(&temp_path)
            .map_err(|e| format!("Failed to create temporary file: {e}"))?;
        file.write_all(contents)
            .map_err(|e| format!("Failed to write temporary file: {e}"))?;
        file.sync_all()
            .map_err(|e| format!("Failed to flush temporary file: {e}"))?;
        drop(file);

        if path.exists() {
            let backup_path = path.with_extension(format!(
                "{}.bak",
                path.extension()
                    .and_then(|extension| extension.to_str())
                    .unwrap_or("data")
            ));
            fs::copy(path, backup_path)
                .map_err(|e| format!("Failed to create data backup: {e}"))?;
        }

        replace_file(&temp_path, path).map_err(|e| format!("Failed to replace data file: {e}"))
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result
}

/// Reads JSON without silently converting corruption into an empty state.
/// A valid sibling backup is restored and returned to the caller.
pub fn read_json_with_backup<T: DeserializeOwned>(path: &Path) -> Result<T, String> {
    let primary =
        fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {e}", path.display()))?;
    match serde_json::from_str(&primary) {
        Ok(value) => Ok(value),
        Err(primary_error) => {
            let backup = path.with_extension(format!(
                "{}.bak",
                path.extension().and_then(|e| e.to_str()).unwrap_or("json")
            ));
            let backup_text = fs::read_to_string(&backup).map_err(|backup_error| {
                format!(
                    "{} is corrupted ({primary_error}); backup unavailable ({backup_error})",
                    path.display()
                )
            })?;
            let value = serde_json::from_str(&backup_text).map_err(|backup_error| {
                format!(
                    "{} and its backup are corrupted: {primary_error}; {backup_error}",
                    path.display()
                )
            })?;

            let corrupt = path.with_extension(format!(
                "{}.corrupt-{}",
                path.extension().and_then(|e| e.to_str()).unwrap_or("json"),
                uuid::Uuid::new_v4()
            ));
            fs::rename(path, &corrupt).map_err(|e| {
                format!(
                    "Не удалось сохранить повреждённый файл {}: {e}",
                    path.display()
                )
            })?;
            atomic_write(path, backup_text.as_bytes())?;
            log::warn!(
                "Restored {} from backup; corrupt file moved to {}",
                path.display(),
                corrupt.display()
            );
            Ok(value)
        }
    }
}

#[cfg(not(windows))]
fn replace_file(from: &Path, to: &Path) -> std::io::Result<()> {
    fs::rename(from, to)
}

#[cfg(windows)]
fn replace_file(from: &Path, to: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let from_wide: Vec<u16> = from.as_os_str().encode_wide().chain(Some(0)).collect();
    let to_wide: Vec<u16> = to.as_os_str().encode_wide().chain(Some(0)).collect();
    let ok = unsafe {
        MoveFileExW(
            from_wide.as_ptr(),
            to_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if ok == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize, PartialEq)]
    struct Fixture {
        value: String,
    }

    #[test]
    fn atomic_write_creates_backup_and_recovers_corruption() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("settings.json");
        atomic_write(&path, br#"{"value":"first"}"#).expect("initial write");
        atomic_write(&path, br#"{"value":"second"}"#).expect("second write");
        std::fs::write(&path, b"not-json").expect("corrupt fixture");

        let recovered: Fixture = read_json_with_backup(&path).expect("backup recovery");
        assert_eq!(
            recovered,
            Fixture {
                value: "first".to_string()
            }
        );
        assert!(
            path.with_extension("json.corrupt").exists()
                || std::fs::read_dir(directory.path()).unwrap().any(|entry| {
                    entry.ok().is_some_and(|entry| {
                        entry.file_name().to_string_lossy().contains("corrupt-")
                    })
                })
        );
    }
}
