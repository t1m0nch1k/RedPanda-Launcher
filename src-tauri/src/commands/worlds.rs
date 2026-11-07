use crate::engine::worlds::{self, WorldSummary};
use std::path::PathBuf;
use tauri::AppHandle;

#[tauri::command]
pub async fn get_instance_worlds(instance_id: String) -> Result<Vec<WorldSummary>, String> {
    tokio::task::spawn_blocking(move || worlds::list_instance_worlds(&instance_id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn backup_instance_world(
    app: AppHandle,
    instance_id: String,
    world_folder: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        worlds::backup_single_world(&app, &instance_id, &world_folder)
            .map(|p| p.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn export_instance_world(
    instance_id: String,
    world_folder: String,
    target_path: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        worlds::export_world_to_path(&instance_id, &world_folder, &PathBuf::from(target_path))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn import_instance_world(
    app: AppHandle,
    instance_id: String,
    zip_path: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        worlds::import_world_from_zip(&app, &instance_id, &PathBuf::from(zip_path))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn duplicate_instance_world(
    app: AppHandle,
    instance_id: String,
    world_folder: String,
    new_name: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        worlds::duplicate_world(&app, &instance_id, &world_folder, &new_name)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_instance_world(
    app: AppHandle,
    instance_id: String,
    world_folder: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || worlds::delete_world(&app, &instance_id, &world_folder))
        .await
        .map_err(|e| e.to_string())?
}
