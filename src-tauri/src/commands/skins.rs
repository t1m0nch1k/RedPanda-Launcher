use crate::engine::skins::{self, SkinPreview};
#[tauri::command]
pub async fn preview_skin(path: String) -> Result<SkinPreview, String> {
    skins::preview_file(path).await
}
#[tauri::command]
pub fn get_account_skin(
    app: tauri::AppHandle,
    account_id: String,
) -> Result<Option<SkinPreview>, String> {
    skins::get_saved(&app, &account_id)
}
#[tauri::command]
pub async fn apply_skin(
    app: tauri::AppHandle,
    account_id: String,
    path: String,
    expected_sha256: String,
    model: String,
    mode: String,
    instance_id: Option<String>,
) -> Result<SkinPreview, String> {
    skins::apply(
        app,
        account_id,
        path,
        expected_sha256,
        model,
        mode,
        instance_id,
    )
    .await
}
