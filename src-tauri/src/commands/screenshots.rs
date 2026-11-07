use crate::engine::screenshots::{self, ScreenshotInfo};

#[tauri::command]
pub async fn get_instance_screenshots(instance_id: String) -> Result<Vec<ScreenshotInfo>, String> {
    tokio::task::spawn_blocking(move || screenshots::list_instance_screenshots(&instance_id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_instance_screenshot(
    instance_id: String,
    filename: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || screenshots::delete_screenshot(&instance_id, &filename))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn read_instance_screenshot_data_url(
    instance_id: String,
    filename: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        screenshots::read_screenshot_data_url(&instance_id, &filename)
    })
    .await
    .map_err(|e| e.to_string())?
}
