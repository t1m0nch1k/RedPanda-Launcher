mod accounts;
pub mod backup;
pub mod builder;
mod commands;
pub mod curseforge;
pub mod dependencies;
pub mod discord;
pub mod downloads;
pub mod engine;
pub mod errors;
pub mod import;
pub mod instances;
pub mod java;
pub mod launcher;
mod modrinth;
mod oauth;
pub mod security;
pub mod settings;
pub mod storage;
pub mod updater;
mod versions;

use crate::discord::DiscordState;
use std::sync::{Mutex, OnceLock};
use tauri::Manager;

#[cfg(windows)]
static SINGLE_INSTANCE_HANDLE: OnceLock<usize> = OnceLock::new();

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let mut direct_instance: Option<String> = None;
    for (i, arg) in args.iter().enumerate() {
        if (arg == "--launch-instance" || arg == "--instance" || arg == "-i") && i + 1 < args.len()
        {
            direct_instance = Some(args[i + 1].clone());
            break;
        }
    }

    #[cfg(windows)]
    if !acquire_single_instance() {
        // Другой экземпляр уже работает. Запуск с ярлыка не поднимает второй процесс:
        // запрос передаётся работающему лаунчеру, чтобы данные писал только один процесс.
        if let Some(instance_id) = direct_instance.take() {
            if let Err(error) = request_direct_launch(&instance_id) {
                log::error!("Не удалось передать запрос прямого запуска: {error}");
            }
        }
        return;
    }

    let direct_instance_clone = direct_instance.clone();

    tauri::Builder::default()
        .manage(DiscordState {
            client: Mutex::new(None),
            is_enabled: Mutex::new(false),
            start_time: Mutex::new(None),
        })
        .setup(move |app| {
            #[cfg(windows)]
            start_shutdown_listener(app.handle().clone());

            #[cfg(windows)]
            start_direct_launch_watcher(app.handle().clone());

            if let Some(instance_id) = direct_instance_clone {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }

                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) =
                        crate::launcher::launch_game_direct(app_handle.clone(), instance_id).await
                    {
                        log::error!("Direct launch failed: {}", e);
                        use tauri_plugin_dialog::DialogExt;
                        let _ = app_handle
                            .dialog()
                            .message(format!("Ошибка запуска сборки:\n{}", e))
                            .title("RedPanda Launcher")
                            .kind(tauri_plugin_dialog::MessageDialogKind::Error)
                            .blocking_show();
                        app_handle.exit(1);
                    }
                });
            }

            Ok(())
        })
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
            accounts::poll_microsoft_device_code,
            accounts::validate_and_refresh_account,
            accounts::add_microsoft_account_oauth,
            accounts::add_elyby_account_oauth,
            launcher::launch_game,
            launcher::ping_minecraft_server,
            settings::get_settings,
            settings::save_settings,
            settings::find_java_installations,
            instances::get_instances,
            instances::migrate_legacy_instance_ids,
            instances::add_instance,
            instances::remove_instance,
            instances::clone_instance,
            instances::rename_instance,
            instances::set_instance_icon,
            instances::get_instance_icon,
            instances::create_instance_shortcut,
            instances::export_instance,
            instances::update_instance_played,
            instances::edit_instance,
            instances::save_instance_settings,
            instances::get_installed_mods,
            instances::toggle_mod,
            instances::diagnose_instance,
            backup::list_backups,
            backup::restore_backup,
            instances::delete_mod,
            instances::install_mod_jar,
            instances::open_instance_folder,
            instances::open_instance_logs,
            instances::open_launcher_folder,
            instances::open_logs_folder,
            instances::get_installed_resourcepacks,
            instances::delete_resourcepack,
            instances::get_installed_shaders,
            instances::delete_shader,
            instances::install_resourcepack_zip,
            instances::install_shader_zip,
            import::import_mrpack,
            import::import_curseforge_pack,
            import::is_curseforge_pack,
            discord::init_discord,
            discord::set_discord_activity,
            discord::clear_discord_activity,
            versions::get_minecraft_versions,
            versions::get_loader_versions,
            versions::get_supported_game_versions,
            modrinth::search_modrinth,
            modrinth::get_modrinth_versions,
            modrinth::download_modrinth_version,
            modrinth::download_modrinth_modpack,
            modrinth::check_mod_updates,
            modrinth::update_mod,
            curseforge::search_curseforge,
            curseforge::get_curseforge_versions,
            curseforge::get_curseforge_download_url,
            curseforge::download_curseforge_version,
            curseforge::download_curseforge_modpack,
            updater::check_for_updates,
            updater::download_and_install_update,
            dependencies::resolve_dependencies,
            commands::content::preview_mod_install,
            commands::content::execute_mod_install,
            commands::content::discard_mod_install,
            commands::skins::preview_skin,
            commands::skins::get_account_skin,
            commands::skins::apply_skin,
            builder::build_custom_modpack,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(windows)]
fn acquire_single_instance() -> bool {
    use std::os::windows::ffi::OsStrExt;
    use std::ptr::null_mut;
    use windows_sys::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};
    use windows_sys::Win32::System::Threading::CreateMutexW;

    let name: Vec<u16> = std::ffi::OsStr::new("Local\\RedPandaLauncher.SingleInstance")
        .encode_wide()
        .chain(Some(0))
        .collect();
    let handle = unsafe { CreateMutexW(null_mut(), 0, name.as_ptr()) };
    if handle.is_null() {
        log::error!("Unable to create single-instance mutex");
        return true;
    }
    if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
        unsafe { windows_sys::Win32::Foundation::CloseHandle(handle) };
        return false;
    }

    // Keep the mutex handle open for the lifetime of the process; Windows
    // releases it automatically on process termination.
    let _ = SINGLE_INSTANCE_HANDLE.set(handle as usize);
    true
}

#[cfg(windows)]
fn start_shutdown_listener(app: tauri::AppHandle) {
    use std::os::windows::ffi::OsStrExt;
    use std::ptr::null_mut;
    use windows_sys::Win32::System::Threading::{CreateEventW, WaitForSingleObject, INFINITE};

    let name: Vec<u16> = std::ffi::OsStr::new("Local\\RedPandaLauncher.GracefulShutdown")
        .encode_wide()
        .chain(Some(0))
        .collect();
    let event = unsafe { CreateEventW(null_mut(), 0, 0, name.as_ptr()) };
    if event.is_null() {
        log::error!("Unable to create graceful shutdown event");
        return;
    }
    let event_handle = event as usize;
    std::thread::spawn(move || {
        let event = event_handle as *mut std::ffi::c_void;
        unsafe { WaitForSingleObject(event, INFINITE) };
        app.exit(0);
        unsafe { windows_sys::Win32::Foundation::CloseHandle(event) };
    });
}

/// Запрос прямого запуска, который второй процесс оставляет работающему лаунчеру.
#[cfg(windows)]
#[derive(serde::Serialize, serde::Deserialize)]
struct DirectLaunchRequest {
    instance_id: String,
    requested_at: u64,
}

/// Запрос старше этого времени считается забытым (например, после аварийного завершения).
#[cfg(windows)]
const DIRECT_LAUNCH_REQUEST_TTL_SECONDS: u64 = 60;

#[cfg(windows)]
static FORWARDED_LAUNCH_ACTIVE: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

#[cfg(windows)]
fn direct_launch_request_path() -> Result<std::path::PathBuf, String> {
    Ok(crate::security::launcher_data_dir()?.join("direct-launch.request"))
}

/// Кладёт запрос запуска в общий каталог данных лаунчера.
#[cfg(windows)]
fn request_direct_launch(instance_id: &str) -> Result<(), String> {
    crate::security::validate_instance_id(instance_id)?;
    let requested_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0);
    let payload = serde_json::json!({
        "instance_id": instance_id,
        "requested_at": requested_at,
    });
    crate::storage::atomic_write(
        &direct_launch_request_path()?,
        payload.to_string().as_bytes(),
    )
}

/// Раз в 500 мс проверяет файл-запрос от ярлыка и запускает сборку в этом процессе.
#[cfg(windows)]
fn start_direct_launch_watcher(app: tauri::AppHandle) {
    use std::sync::atomic::Ordering;

    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_millis(500));

        let Ok(path) = direct_launch_request_path() else {
            continue;
        };
        if !path.exists() {
            continue;
        }
        let Ok(text) = std::fs::read_to_string(&path) else {
            continue;
        };
        let _ = std::fs::remove_file(&path);

        let request: DirectLaunchRequest = match serde_json::from_str(&text) {
            Ok(request) => request,
            Err(error) => {
                log::warn!("Некорректный запрос прямого запуска: {error}");
                continue;
            }
        };
        if crate::security::validate_instance_id(&request.instance_id).is_err() {
            log::warn!("Запрос прямого запуска содержит недопустимый идентификатор сборки");
            continue;
        }
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|elapsed| elapsed.as_secs())
            .unwrap_or(0);
        if now.saturating_sub(request.requested_at) > DIRECT_LAUNCH_REQUEST_TTL_SECONDS {
            log::warn!("Пропущен устаревший запрос прямого запуска");
            continue;
        }
        if FORWARDED_LAUNCH_ACTIVE.swap(true, Ordering::SeqCst) {
            log::warn!("Прямой запуск уже выполняется, запрос пропущен");
            continue;
        }

        let handle = app.clone();
        tauri::async_runtime::spawn(async move {
            let result =
                crate::launcher::launch_game_forwarded(handle.clone(), request.instance_id).await;
            FORWARDED_LAUNCH_ACTIVE.store(false, Ordering::SeqCst);

            if let Err(error) = result {
                log::error!("Прямой запуск по ярлыку не удался: {error}");
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                use tauri_plugin_dialog::DialogExt;
                let _ = handle
                    .dialog()
                    .message(format!("Ошибка запуска сборки:\n{error}"))
                    .title("RedPanda Launcher")
                    .kind(tauri_plugin_dialog::MessageDialogKind::Error)
                    .blocking_show();
            }
        });
    });
}
