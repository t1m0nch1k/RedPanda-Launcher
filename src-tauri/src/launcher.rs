use lighty_event::EventBus;
use lighty_launcher::prelude::*;
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
pub async fn launch_game(
    app: AppHandle,
    account_id: Option<String>,
    instance_id: String,
    server: Option<String>,
) -> Result<(), String> {
    launch_game_internal(app, account_id, instance_id, server, false).await
}

pub async fn launch_game_direct(app: AppHandle, instance_id: String) -> Result<(), String> {
    launch_game_internal(app, None, instance_id, None, true).await
}

async fn launch_game_internal(
    app: AppHandle,
    account_id: Option<String>,
    instance_id: String,
    server: Option<String>,
    is_direct: bool,
) -> Result<(), String> {
    crate::security::validate_instance_id(&instance_id)?;
    // Initialize lighty-launcher global state (ignore error if already initialized)
    let _ = AppState::init("RedPandaLauncher");

    // Load settings
    let settings = crate::settings::get_settings(app.clone())?;

    // Find instance settings
    let instances = crate::instances::get_instances(app.clone()).await?;
    let instance_data = instances
        .into_iter()
        .find(|i| i.id == instance_id)
        .ok_or_else(|| format!("Инстанс '{}' не найден", instance_id))?;
    let version = instance_data.game_version.clone();
    let loader_type = instance_data.loader_type.clone();
    let mut loader_version = instance_data.loader_version.clone();

    if loader_type != "Vanilla" && loader_version.trim().is_empty() {
        log::warn!(
            "Instance '{}' has empty loader_version! Attempting auto-resolution...",
            instance_id
        );
        if let Ok(versions) =
            crate::versions::get_loader_versions(loader_type.clone(), version.clone()).await
        {
            if let Some(first) = versions.first() {
                loader_version = first.clone();
            }
        }
        if loader_version.trim().is_empty() {
            loader_version = match loader_type.as_str() {
                "Fabric" => "0.16.10".to_string(),
                "Quilt" => "0.27.1".to_string(),
                "Forge" => {
                    if version == "1.16.5" {
                        "36.2.39".to_string()
                    } else if version == "1.12.2" {
                        "14.23.5.2860".to_string()
                    } else if version == "1.18.2" {
                        "40.2.14".to_string()
                    } else if version == "1.19.2" {
                        "43.3.0".to_string()
                    } else if version == "1.20.1" {
                        "47.3.0".to_string()
                    } else {
                        "".to_string()
                    }
                }
                "NeoForge" => {
                    if version.starts_with("1.21") {
                        "21.1.72".to_string()
                    } else if version.starts_with("1.20.6") {
                        "20.6.119".to_string()
                    } else {
                        "20.4.80".to_string()
                    }
                }
                _ => "".to_string(),
            };
        }
        if !loader_version.trim().is_empty() {
            log::info!(
                "Auto-resolved loader_version for '{}' to '{}'. Updating storage...",
                instance_id,
                loader_version
            );
            let _ =
                crate::instances::update_loader_version(&app, &instance_id, &loader_version).await;
        }
    }

    let min_mem = instance_data.min_memory.unwrap_or(settings.min_memory);
    let max_mem = instance_data.max_memory.unwrap_or(settings.max_memory);
    let window_width = instance_data.window_width.unwrap_or(settings.window_width);
    let window_height = instance_data
        .window_height
        .unwrap_or(settings.window_height);
    let jvm_args_str = instance_data
        .jvm_args
        .clone()
        .unwrap_or_else(|| settings.jvm_args.clone());
    let java_path_str = instance_data
        .java_path
        .clone()
        .unwrap_or_else(|| settings.java_path.clone());

    log::info!(
        "Starting game {} (Loader: {}) for account {:?}...",
        version,
        loader_type,
        account_id
    );

    let loader = match loader_type.as_str() {
        "Forge" => Loader::Forge,
        "Fabric" => Loader::Fabric,
        "Quilt" => Loader::Quilt,
        "NeoForge" => Loader::NeoForge,
        _ => Loader::Vanilla,
    };

    let mut instance = VersionBuilder::new(&instance_id, loader, &loader_version, &version);
    instance = configure_custom_java(instance, &java_path_str, &version);

    let event_bus = EventBus::new(1000);
    let mut rx = event_bus.subscribe();
    let app_clone = app.clone();
    let instance_id_clone = instance_id.clone();

    tauri::async_runtime::spawn(async move {
        let start_time = std::time::Instant::now();

        let mut log_file = dirs::data_dir().and_then(|mut d| {
            d.push("RedPandaLauncher");
            d.push(&instance_id_clone);
            d.push("logs");
            let _ = std::fs::create_dir_all(&d);
            d.push("latest.log");
            std::fs::OpenOptions::new()
                .create(true)
                .write(true)
                .truncate(true)
                .open(d)
                .ok()
        });

        while let Ok(event) = rx.next().await {
            // Also log console output and exits for debugging
            if let lighty_event::Event::ConsoleOutput(out) = &event {
                if matches!(out.stream, lighty_event::ConsoleStream::Stderr) {
                    log::error!("[GAME] {}", out.line);
                } else {
                    log::info!("[GAME] {}", out.line);
                }

                if let Some(f) = &mut log_file {
                    use std::io::Write;
                    let _ = writeln!(
                        f,
                        "[{}] {}",
                        chrono::Local::now().format("%H:%M:%S"),
                        out.line
                    );
                }
            } else if let lighty_event::Event::InstanceExited(exit) = &event {
                log::info!("[GAME] Instance exited with code: {:?}", exit.exit_code);

                let elapsed = start_time.elapsed().as_secs();
                if elapsed > 0 {
                    let _ = crate::instances::add_play_time(
                        app_clone.clone(),
                        instance_id_clone.clone(),
                        elapsed,
                    )
                    .await;
                }

                let _ = crate::discord::set_discord_activity(
                    app_clone.clone(),
                    "В главном меню".to_string(),
                    "".to_string(),
                    "redpanda_logo".to_string(),
                );

                if is_direct {
                    log::info!("Direct launch game finished, exiting launcher process");
                    app_clone.exit(0);
                } else {
                    // Reshow the launcher window when the game closes
                    if let Some(window) = app_clone.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
            let _ = app_clone.emit("launcher-event", event);
        }
    });

    let accounts = crate::accounts::load_accounts_data(&app)?.accounts;
    let target_id = account_id.filter(|s| !s.trim().is_empty());
    let mut account = if let Some(ref id) = target_id {
        accounts
            .into_iter()
            .find(|a| a.id == *id)
            .ok_or_else(|| format!("Account {} not found", id))?
    } else {
        accounts
            .into_iter()
            .find(|a| a.is_active)
            .or_else(|| crate::accounts::load_accounts_data(&app).ok().and_then(|d| d.accounts.into_iter().next()))
            .ok_or_else(|| "Активный аккаунт не найден. Выберите или добавьте аккаунт перед запуском.".to_string())?
    };
    let username = account.username.clone();

    if let Ok(true) = crate::accounts::refresh_account_tokens(&app, &mut account).await {
        log::info!("Refreshed auth tokens for user {}", username);
    }

    let profile = if let (Some(token), Some(uuid)) = (account.access_token, account.uuid) {
        use lighty_launcher::auth::SecretString;
        let mut p = UserProfile::offline(username.clone(), uuid);
        p.access_token = Some(SecretString::from(token));
        p
    } else {
        let mut auth = OfflineAuth::new(&username);
        auth.authenticate(Some(&event_bus))
            .await
            .map_err(|e| format!("Auth error: {}", e))?
    };

    let _launch_behavior = settings.launch_behavior.clone();

    // Build launch configuration
    let builder = instance
        .launch(&profile, JavaDistribution::Temurin)
        .with_event_bus(&event_bus);

    let mut jvm_builder = builder
        .with_jvm_options()
        .set("Xmx", format!("{}M", max_mem))
        .set("Xms", format!("{}M", min_mem));

    if let Ok(mut inst_path) = crate::security::instance_dir(&instance_id) {
        inst_path.push("natives");
        let inst_path = crate::security::to_short_path(&inst_path);
        jvm_builder = jvm_builder.set(
            "Dorg.lwjgl.librarypath",
            inst_path.to_string_lossy().to_string(),
        );
    }

    // Parse custom JVM args
    for arg in jvm_args_str.split_whitespace() {
        if arg.starts_with('-') {
            let stripped = arg.strip_prefix('-').unwrap();

            // Skip experimental flags that crash due to ordering issues in BTreeMap
            if stripped.contains("UnlockExperimentalVMOptions")
                || stripped.contains("G1NewSizePercent")
                || stripped.contains("G1ReservePercent")
            {
                continue;
            }

            if let Some((k, v)) = stripped.split_once('=') {
                jvm_builder = jvm_builder.set(k, v);
            } else {
                jvm_builder = jvm_builder.set(stripped, "");
            }
        }
    }

    if settings.aggressive_optimization {
        jvm_builder = jvm_builder
            .set("XX:+PerfDisableSharedMem", "")
            .set("XX:+AlwaysPreTouch", "")
            .set("Xverify:none", "")
            .set("XX:+UseStringDeduplication", "");
    }

    let builder = jvm_builder.done();

    let mut arg_builder = builder
        .with_arguments()
        .set("width", window_width.to_string())
        .set("height", window_height.to_string());

    if settings.fullscreen {
        arg_builder = arg_builder.set("fullscreen", "");
    }

    if let Some(srv) = server {
        let trimmed = srv.trim();
        if !trimmed.is_empty() {
            if trimmed.len() > 253 || trimmed.chars().any(|c| c.is_control() || c.is_whitespace()) {
                return Err("Некорректный адрес сервера".to_string());
            }
            let parts: Vec<&str> = trimmed.split(':').collect();
            if parts.len() > 2 || parts[0].is_empty() {
                return Err("Некорректный адрес сервера".to_string());
            }
            let host = parts[0];
            let port = parts.get(1).unwrap_or(&"25565");
            let port_number = port
                .parse::<u16>()
                .map_err(|_| "Некорректный порт сервера".to_string())?;
            if port_number == 0 {
                return Err("Некорректный порт сервера".to_string());
            }
            arg_builder = arg_builder.set("server", host).set("port", *port);
        }
    }

    let builder = arg_builder.done();

    let agg_opt = settings.aggressive_optimization;

    let version_clone = version.clone();
    let loader_clone = loader_type.clone();

    if settings.auto_backup_worlds {
        if let Ok(inst_path) = crate::security::instance_dir(&instance_id) {
            log::info!("Backing up worlds for instance {}...", instance_id);
            if let Err(e) = crate::backup::backup_saves(&inst_path) {
                log::error!("Failed to backup worlds: {}", e);
            } else {
                log::info!("Worlds backup completed.");
            }
        }
    }

    match builder.run().await {
        Ok(_) => {
            log::info!("Game launched successfully");

            let _ = crate::discord::set_discord_activity(
                app.clone(),
                format!("Играет в {} ({})", version_clone, loader_clone),
                "".to_string(),
                "redpanda_logo".to_string(),
            );

            if agg_opt {
                #[cfg(target_os = "windows")]
                tauri::async_runtime::spawn(async move {
                    // Wait a bit for javaw to actually start up completely
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    log::info!("Applying aggressive optimization (High Priority)...");
                    let cmd = "wmic process where \"(name='javaw.exe' or name='java.exe') and commandline like '%RedPandaLauncher%'\" CALL setpriority 128";
                    use std::os::windows::process::CommandExt;
                    let _ = std::process::Command::new("cmd")
                        .creation_flags(0x08000000)
                        .args(["/C", cmd])
                        .output();
                });
            }

            if is_direct || settings.launch_behavior == "hide" {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            } else if settings.launch_behavior == "close" {
                app.exit(0);
            }
            Ok(())
        }
        Err(e) => {
            log::error!("Error running game: {}", e);
            Err(format!("Launch failed: {}", e))
        }
    }
}

fn configure_custom_java(
    instance: VersionBuilder<Loader>,
    java_path_str: &str,
    mc_version: &str,
) -> VersionBuilder<Loader> {
    let trimmed = java_path_str.trim();
    if trimmed.is_empty() {
        // By default, lighty-launcher manages JRE downloads automatically in AppData/Roaming/RedPandaLauncher/jre
        return instance;
    }

    let custom_path = std::path::PathBuf::from(trimmed);
    if !custom_path.exists() {
        log::warn!(
            "Custom java path {:?} does not exist, using auto-downloaded JRE",
            custom_path
        );
        return instance;
    }

    // Determine the java executable and JDK root directory
    let (java_exe, jdk_root) = if custom_path.is_file() {
        let exe = custom_path.clone();
        let root = custom_path
            .parent()
            .and_then(|bin| {
                if bin
                    .file_name()
                    .map_or(false, |n| n.eq_ignore_ascii_case("bin"))
                {
                    bin.parent().map(|p| p.to_path_buf())
                } else {
                    Some(bin.to_path_buf())
                }
            })
            .unwrap_or_else(|| custom_path.clone());
        (exe, root)
    } else {
        (custom_path.join("bin").join("java.exe"), custom_path.clone())
    };

    if !java_exe.exists() {
        log::warn!(
            "java.exe not found at {:?}, using auto-downloaded JRE",
            java_exe
        );
        return instance;
    }

    // Prepare custom JRE folder structure expected by lighty:
    // <custom_jre_base>/temurin_<java_version>/custom/bin/java.exe
    let java_version = crate::java::get_required_java_version(mc_version);
    if let Some(appdata) = dirs::data_dir() {
        let custom_jre_base = appdata.join("RedPandaLauncher").join("custom_jre");
        let version_folder = custom_jre_base.join(format!("temurin_{}", java_version));
        let custom_link = version_folder.join("custom");

        let _ = std::fs::create_dir_all(&version_folder);

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            if custom_link.exists() {
                let _ = std::fs::remove_dir_all(&custom_link);
            }
            let cmd_res = std::process::Command::new("cmd")
                .creation_flags(0x08000000)
                .args([
                    "/C",
                    "mklink",
                    "/J",
                    &custom_link.to_string_lossy(),
                    &jdk_root.to_string_lossy(),
                ])
                .output();

            if let Ok(output) = cmd_res {
                if output.status.success() && custom_link.join("bin").join("java.exe").exists() {
                    log::info!("Successfully linked custom Java to {:?}", custom_link);
                    return instance.with_custom_java_dir(custom_jre_base);
                }
            }
        }
    }

    instance
}
