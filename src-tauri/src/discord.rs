use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

pub struct DiscordState {
    pub client: Mutex<Option<DiscordIpcClient>>,
    pub is_enabled: Mutex<bool>,
}

const CLIENT_ID: &str = "1328001712411516958"; // Replace with real Client ID if available

#[tauri::command]
pub fn init_discord(app: AppHandle, enabled: bool) -> Result<(), String> {
    let state: State<'_, DiscordState> = app.state();
    
    *state.is_enabled.lock().unwrap() = enabled;
    
    if enabled {
        let app_clone = app.clone();
        std::thread::spawn(move || {
            let state: State<'_, DiscordState> = app_clone.state();
            let mut client = DiscordIpcClient::new(CLIENT_ID);
            
            // Connect blocks and might panic, catch_unwind could be safer but thread crash won't kill app
            if client.connect().is_ok() {
                let mut client_guard = state.client.lock().unwrap();
                *client_guard = Some(client);
                drop(client_guard);
                // Set initial activity
                let _ = set_discord_activity(app_clone.clone(), "В главном меню".to_string(), "".to_string(), "redpanda_logo".to_string());
            }
        });
    } else {
        let mut client_guard = state.client.lock().unwrap();
        if let Some(mut client) = client_guard.take() {
            let _ = client.close();
        }
    }
    
    Ok(())
}

#[tauri::command]
pub fn set_discord_activity(app: AppHandle, details: String, state_str: String, large_image: String) -> Result<(), String> {
    let state: State<'_, DiscordState> = app.state();
    
    if !*state.is_enabled.lock().unwrap() {
        return Ok(());
    }
    
    let mut client_guard = state.client.lock().unwrap();
    if let Some(client) = client_guard.as_mut() {
        let mut payload = activity::Activity::new()
            .details(&details);
            
        if !state_str.is_empty() {
            payload = payload.state(&state_str);
        }
        
        let mut assets = activity::Assets::new();
        if !large_image.is_empty() {
            assets = assets.large_image(&large_image);
            payload = payload.assets(assets);
        }
        
        let _ = client.set_activity(payload);
    }
    
    Ok(())
}

#[tauri::command]
pub fn clear_discord_activity(app: AppHandle) -> Result<(), String> {
    let state: State<'_, DiscordState> = app.state();
    
    let mut client_guard = state.client.lock().unwrap();
    if let Some(client) = client_guard.as_mut() {
        let _ = client.clear_activity();
    }
    
    Ok(())
}
