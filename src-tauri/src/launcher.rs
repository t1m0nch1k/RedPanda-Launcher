use lighty_event::EventBus;
use lighty_launcher::prelude::*;
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
pub async fn launch_game(
    app: AppHandle,
    username: String,
    instance_id: String,
    version: String,
    loader_type: String,
    loader_version: String,
    server: Option<String>,
) -> Result<(), String> {
    // Initialize lighty-launcher global state (ignore error if already initialized)
    let _ = AppState::init("RedPandaLauncher");

    // Load settings
    let settings = crate::settings::get_settings(app.clone())?;

    // Find instance settings
    let instances = crate::instances::get_instances(app.clone())
        .await
        .unwrap_or_default();
    let instance_data = instances.into_iter().find(|i| i.id == instance_id);
    let min_mem = instance_data
        .as_ref()
        .and_then(|i| i.min_memory)
        .unwrap_or(settings.min_memory);
    let max_mem = instance_data
        .as_ref()
        .and_then(|i| i.max_memory)
        .unwrap_or(settings.max_memory);
    let window_width = instance_data
        .as_ref()
        .and_then(|i| i.window_width)
        .unwrap_or(settings.window_width);
    let window_height = instance_data
        .as_ref()
        .and_then(|i| i.window_height)
        .unwrap_or(settings.window_height);
    let jvm_args_str = instance_data
        .as_ref()
        .and_then(|i| i.jvm_args.clone())
        .unwrap_or_else(|| settings.jvm_args.clone());
    let java_path_str = instance_data
        .as_ref()
        .and_then(|i| i.java_path.clone())
        .unwrap_or_else(|| settings.java_path.clone());

    log::info!(
        "Starting game {} (Loader: {}) for user {}...",
        version,
        loader_type,
        username
    );

    let loader = match loader_type.as_str() {
        "Forge" => Loader::Forge,
        "Fabric" => Loader::Fabric,
        "Quilt" => Loader::Quilt,
        "NeoForge" => Loader::NeoForge,
        _ => Loader::Vanilla,
    };

    let mut instance = VersionBuilder::new(&instance_id, loader, &loader_version, &version);
    if !java_path_str.is_empty() {
        instance = instance.with_custom_java_dir(std::path::PathBuf::from(java_path_str));
    }

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
            std::fs::OpenOptions::new().create(true).write(true).truncate(true).open(d).ok()
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
                    let _ = writeln!(f, "[{}] {}", chrono::Local::now().format("%H:%M:%S"), out.line);
                }
            } else if let lighty_event::Event::InstanceExited(exit) = &event {
                log::info!("[GAME] Instance exited with code: {:?}", exit.exit_code);
                
                let elapsed = start_time.elapsed().as_secs();
                if elapsed > 0 {
                    let _ = crate::instances::add_play_time(app_clone.clone(), instance_id_clone.clone(), elapsed).await;
                }
                
                let _ = crate::discord::set_discord_activity(
                    app_clone.clone(),
                    "В главном меню".to_string(),
                    "".to_string(),
                    "redpanda_logo".to_string(),
                );
                
                // Reshow the launcher window when the game closes
                if let Some(window) = app_clone.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            let _ = app_clone.emit("launcher-event", event);
        }
    });

    let accounts = crate::accounts::get_accounts(app.clone())?;
    let account = accounts
        .into_iter()
        .find(|a| a.username == username)
        .ok_or_else(|| format!("Account {} not found", username))?;

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
    
    // Ensure required Java version is installed
    if let Err(e) = crate::java::ensure_java_runtime(&version).await {
        log::warn!("Java auto-downloader warning: {}, falling back to default distribution", e);
    }

    // Build launch configuration
    let mut builder = instance
        .launch(&profile, JavaDistribution::Temurin)
        .with_event_bus(&event_bus);

    let mut jvm_builder = builder
        .with_jvm_options()
        .set("Xmx", format!("{}M", max_mem))
        .set("Xms", format!("{}M", min_mem));

    if let Some(mut inst_path) = dirs::data_dir() {
        inst_path.push("RedPandaLauncher");
        inst_path.push(&instance_id);
        inst_path.push("natives");
        jvm_builder = jvm_builder.set("Dorg.lwjgl.librarypath", inst_path.to_string_lossy().to_string());
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

    let mut builder = jvm_builder.done();

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
            let parts: Vec<&str> = trimmed.split(':').collect();
            let host = parts[0];
            let port = parts.get(1).unwrap_or(&"25565");
            arg_builder = arg_builder.set("server", host).set("port", *port);
        }
    }

    let builder = arg_builder.done();

    let agg_opt = settings.aggressive_optimization;

    let version_clone = version.clone();
    let loader_clone = loader_type.clone();

    if settings.auto_backup_worlds {
        if let Some(mut inst_path) = dirs::data_dir() {
            inst_path.push("RedPandaLauncher");
            inst_path.push(&instance_id);
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
                    let _ = std::process::Command::new("cmd").creation_flags(0x08000000).args(["/C", cmd]).output();
                });
            }

            if settings.launch_behavior == "hide" {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            } else if settings.launch_behavior == "close" {
                std::process::exit(0);
            }
            Ok(())
        }
        Err(e) => {
            log::error!("Error running game: {}", e);
            Err(format!("Launch failed: {}", e))
        }
    }
}
