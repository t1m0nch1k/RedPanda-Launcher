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
) -> Result<(), String> {
    // Initialize lighty-launcher global state (ignore error if already initialized)
    let _ = AppState::init("RedPandaLauncher");

    // Load settings
    let settings = crate::settings::get_settings(app.clone())?;

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

    let event_bus = EventBus::new(1000);
    let mut rx = event_bus.subscribe();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        while let Ok(event) = rx.next().await {
            // Also log console output and exits for debugging
            if let lighty_event::Event::ConsoleOutput(out) = &event {
                if matches!(out.stream, lighty_event::ConsoleStream::Stderr) {
                    log::error!("[GAME] {}", out.line);
                } else {
                    log::info!("[GAME] {}", out.line);
                }
            } else if let lighty_event::Event::InstanceExited(exit) = &event {
                log::info!("[GAME] Instance exited with code: {:?}", exit.exit_code);
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

    let launch_behavior = settings.launch_behavior.clone();
    
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
    for arg in settings.jvm_args.split_whitespace() {
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
        .set("width", settings.window_width.to_string())
        .set("height", settings.window_height.to_string());

    if settings.fullscreen {
        arg_builder = arg_builder.set("fullscreen", "");
    }

    let builder = arg_builder.done();

    let agg_opt = settings.aggressive_optimization;

    match builder.run().await {
        Ok(_) => {
            log::info!("Game launched successfully");

            if agg_opt {
                #[cfg(target_os = "windows")]
                tauri::async_runtime::spawn(async move {
                    // Wait a bit for javaw to actually start up completely
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    log::info!("Applying aggressive optimization (High Priority)...");
                    let cmd = "wmic process where \"(name='javaw.exe' or name='java.exe') and commandline like '%RedPandaLauncher%'\" CALL setpriority 128";
                    let _ = std::process::Command::new("cmd").args(["/C", cmd]).output();
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
