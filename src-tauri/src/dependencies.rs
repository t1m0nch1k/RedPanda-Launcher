// Compatibility command for existing consumers; all resolution lives in the engine.
pub use crate::engine::content::resolver::InstallTask;
#[tauri::command]
pub async fn resolve_dependencies(
    app: tauri::AppHandle,
    instance_id: String,
    source: String,
    id: String,
    game_version: String,
    loader: String,
) -> Result<Vec<InstallTask>, String> {
    crate::engine::content::resolver::resolve_dependencies(
        app,
        instance_id,
        source,
        id,
        game_version,
        loader,
    )
    .await
}
