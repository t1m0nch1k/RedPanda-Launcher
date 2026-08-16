mod installer;

use installer::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            is_uninstall_mode,
            get_default_install_dir,
            extract_payload,
            create_desktop_shortcut,
            create_start_menu_shortcut,
            register_uninstaller,
            remove_shortcuts,
            unregister_uninstaller,
            uninstall_files,
            launch_app,
            close_window,
            minimize_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running RedPanda Installer");
}
