use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotInfo {
    pub filename: String,
    pub path: String,
    pub created_at: i64,
    pub size_bytes: u64,
}

pub fn list_instance_screenshots(instance_id: &str) -> Result<Vec<ScreenshotInfo>, String> {
    let instance = crate::security::instance_dir(instance_id)?;
    let screenshots_dir = instance.join("screenshots");
    if !screenshots_dir.exists() {
        return Ok(Vec::new());
    }

    let mut list = Vec::new();
    let entries = fs::read_dir(&screenshots_dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or_default()
            .to_lowercase();
        if ext != "png" && ext != "jpg" && ext != "jpeg" {
            continue;
        }

        let filename = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        let meta = entry.metadata().ok();
        let size_bytes = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let created_at = meta
            .and_then(|m| m.modified().or_else(|_| m.created()).ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        list.push(ScreenshotInfo {
            filename,
            path: path.to_string_lossy().into_owned(),
            created_at,
            size_bytes,
        });
    }

    list.sort_by_key(|b| std::cmp::Reverse(b.created_at));
    Ok(list)
}

pub fn delete_screenshot(instance_id: &str, filename: &str) -> Result<(), String> {
    let instance = crate::security::instance_dir(instance_id)?;
    let file = crate::security::safe_join(&instance.join("screenshots"), filename)?;
    if file.exists() {
        fs::remove_file(file).map_err(|e| format!("Не удалось удалить скриншот: {e}"))?;
    }
    Ok(())
}

pub fn read_screenshot_data_url(instance_id: &str, filename: &str) -> Result<String, String> {
    let instance = crate::security::instance_dir(instance_id)?;
    let file = crate::security::safe_join(&instance.join("screenshots"), filename)?;
    if !file.exists() {
        return Err("Файл скриншота не найден".to_string());
    }

    let bytes = fs::read(file).map_err(|e| e.to_string())?;
    Ok(format!(
        "data:image/png;base64,{}",
        base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes)
    ))
}
