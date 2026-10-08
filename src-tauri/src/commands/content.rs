use crate::engine::content::install::{self, InstallPlan};
#[tauri::command]
pub async fn preview_mod_install(
    app: tauri::AppHandle,
    instance_id: String,
    source: String,
    id: String,
    project_type: String,
) -> Result<InstallPlan, String> {
    install::preview(app, instance_id, source, id, project_type).await
}
#[tauri::command]
pub async fn execute_mod_install(app: tauri::AppHandle, plan_id: String) -> Result<(), String> {
    install::execute(app, plan_id).await
}

#[tauri::command]
pub fn discard_mod_install(plan_id: String) -> Result<(), String> {
    install::discard(&plan_id)
}
