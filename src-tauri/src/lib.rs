mod accounts;
pub mod import;
pub mod instances;
mod launcher;
mod modrinth;
mod oauth;
pub mod settings;
mod versions;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            accounts::get_accounts,
            accounts::add_offline_account,
            accounts::remove_account,
            accounts::set_active_account,
            accounts::add_elyby_account,
            accounts::microsoft_device_code,
            accounts::add_microsoft_account,
            accounts::add_microsoft_account_oauth,
            accounts::add_elyby_account_oauth,
            launcher::launch_game,
            settings::get_settings,
            settings::save_settings,
            settings::find_java_installations,
            instances::get_instances,
            instances::add_instance,
            instances::remove_instance,
            instances::rename_instance,
            instances::set_instance_icon,
            instances::export_instance,
            instances::update_instance_played,
            instances::edit_instance,
            instances::save_instance_settings,
            instances::get_installed_mods,
            instances::delete_mod,
            instances::install_mod_jar,
            instances::open_instance_folder,
            instances::open_launcher_folder,
            instances::open_logs_folder,
            instances::get_installed_resourcepacks,
            instances::delete_resourcepack,
            instances::get_installed_shaders,
            instances::delete_shader,
            instances::install_resourcepack_zip,
            instances::install_shader_zip,
            import::import_mrpack,
            versions::get_minecraft_versions,
            versions::get_loader_versions,
            versions::get_supported_game_versions,
            modrinth::search_modrinth,
            modrinth::get_modrinth_versions,
            modrinth::download_modrinth_version,
            modrinth::check_mod_updates,
            modrinth::update_mod,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
