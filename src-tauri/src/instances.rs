use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;
use tauri::AppHandle;
use tauri::Manager;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub game_version: String,
    pub loader_type: String, // "Vanilla", "Forge", "Fabric", "Quilt", "NeoForge"
    pub loader_version: String,
    pub last_played: Option<i64>,
    pub min_memory: Option<u32>,
    pub max_memory: Option<u32>,
    pub icon_path: Option<String>,
}

pub fn get_instances_file(app: &AppHandle) -> PathBuf {
    let mut path = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&path).unwrap_or(());
    path.push("instances.json");
    path
}

#[tauri::command]
pub async fn get_instances(app: AppHandle) -> Result<Vec<Instance>, String> {
    let path = get_instances_file(&app);
    if !path.exists() {
        return Ok(Vec::new());
    }

    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let instances_raw: Vec<Instance> = serde_json::from_str(&data).unwrap_or_else(|_| Vec::new());

    let mut needs_save = false;
    let mut migrated_instances = Vec::new();

    for mut instance in instances_raw {
        // If the ID is a valid UUID, we migrate it to a readable folder name
        if Uuid::parse_str(&instance.id).is_ok() {
            let new_id = generate_instance_id(&instance.name, &migrated_instances);

            let mut old_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
            old_dir.push("RedPandaLauncher");
            old_dir.push(&instance.id);

            let mut new_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
            new_dir.push("RedPandaLauncher");
            new_dir.push(&new_id);

            if old_dir.exists() {
                if let Err(e) = fs::rename(&old_dir, &new_dir) {
                    log::error!(
                        "Failed to rename instance dir from {} to {}: {}",
                        instance.id,
                        new_id,
                        e
                    );
                }
            }

            instance.id = new_id;
            needs_save = true;
        }
        migrated_instances.push(instance);
    }

    let mut instances = migrated_instances;

    if needs_save {
        if let Ok(new_data) = serde_json::to_string_pretty(&instances) {
            let _ = fs::write(&path, new_data);
        }
    }

    // Sort instances
    if let Ok(settings) = crate::settings::get_settings(app.clone()) {
        if settings.instances_sort_mode == "name" {
            instances.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        } else {
            // last_played (default)
            instances.sort_by(|a, b| b.last_played.unwrap_or(0).cmp(&a.last_played.unwrap_or(0)));
        }
    }

    Ok(instances)
}

pub fn generate_instance_id(name: &str, existing_instances: &[Instance]) -> String {
    let mut base_id: String = name
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == ' ' || *c == '_')
        .collect();

    base_id = base_id.replace(' ', "-");

    if base_id.is_empty() {
        base_id = "instance".to_string();
    }

    let mut final_id = base_id.clone();
    let mut counter = 1;

    while existing_instances.iter().any(|i| i.id == final_id) {
        final_id = format!("{}-{}", base_id, counter);
        counter += 1;
    }

    final_id
}

#[tauri::command]
pub async fn add_instance(
    app: AppHandle,
    name: String,
    game_version: String,
    loader_type: String,
    loader_version: String,
) -> Result<Instance, String> {
    let mut instances = get_instances(app.clone()).await?;

    let new_id = generate_instance_id(&name, &instances);

    let new_instance = Instance {
        id: new_id,
        name,
        game_version,
        loader_type,
        loader_version,
        last_played: None,
        min_memory: None,
        max_memory: None,
        icon_path: None,
    };

    instances.push(new_instance.clone());

    let path = get_instances_file(&app);
    let data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())?;

    Ok(new_instance)
}

#[tauri::command]
pub async fn remove_instance(app: AppHandle, id: String) -> Result<(), String> {
    let mut instances = get_instances(app.clone()).await?;
    instances.retain(|i| i.id != id);

    let path = get_instances_file(&app);
    let data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())?;

    // Remove the instance directory
    let mut dir_path = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    dir_path.push("RedPandaLauncher");
    dir_path.push(&id);
    let _ = std::fs::remove_dir_all(&dir_path);

    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ModInfo {
    filename: String,
    size: u64,
}

#[tauri::command]
pub async fn get_installed_mods(instance_id: String) -> Result<Vec<ModInfo>, String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push(&instance_id);
    path.push("mods");

    let mut mods = Vec::new();
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    let filename = entry.file_name().to_string_lossy().to_string();
                    if filename.ends_with(".jar") {
                        mods.push(ModInfo {
                            filename,
                            size: metadata.len(),
                        });
                    }
                }
            }
        }
    }
    Ok(mods)
}

#[tauri::command]
pub async fn delete_mod(instance_id: String, filename: String) -> Result<(), String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push(&instance_id);
    path.push("mods");
    path.push(filename);

    std::fs::remove_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_installed_resourcepacks(instance_id: String) -> Result<Vec<ModInfo>, String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push(&instance_id);
    path.push("resourcepacks");

    let mut packs = Vec::new();
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    let filename = entry.file_name().to_string_lossy().to_string();
                    if filename.ends_with(".zip") {
                        packs.push(ModInfo {
                            filename,
                            size: metadata.len(),
                        });
                    }
                }
            }
        }
    }
    Ok(packs)
}

#[tauri::command]
pub async fn delete_resourcepack(instance_id: String, filename: String) -> Result<(), String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push(&instance_id);
    path.push("resourcepacks");
    path.push(filename);

    std::fs::remove_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_installed_shaders(instance_id: String) -> Result<Vec<ModInfo>, String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push(&instance_id);
    path.push("shaderpacks");

    let mut shaders = Vec::new();
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    let filename = entry.file_name().to_string_lossy().to_string();
                    if filename.ends_with(".zip") {
                        shaders.push(ModInfo {
                            filename,
                            size: metadata.len(),
                        });
                    }
                }
            }
        }
    }
    Ok(shaders)
}

#[tauri::command]
pub async fn delete_shader(instance_id: String, filename: String) -> Result<(), String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push(&instance_id);
    path.push("shaderpacks");
    path.push(filename);

    std::fs::remove_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_instance_played(app: AppHandle, id: String) -> Result<(), String> {
    let mut instances = get_instances(app.clone()).await?;

    for instance in instances.iter_mut() {
        if instance.id == id {
            instance.last_played = Some(
                SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64,
            );
            break;
        }
    }

    let path = get_instances_file(&app);
    let data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn edit_instance(
    app: AppHandle,
    id: String,
    name: String,
    game_version: String,
    loader_type: String,
    loader_version: String,
) -> Result<(), String> {
    let mut instances = get_instances(app.clone()).await?;

    for instance in instances.iter_mut() {
        if instance.id == id {
            instance.name = name;
            instance.game_version = game_version;
            instance.loader_type = loader_type;
            instance.loader_version = loader_version;
            break;
        }
    }

    let path = get_instances_file(&app);
    let data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn save_instance_settings(
    app: AppHandle,
    id: String,
    min_memory: Option<u32>,
    max_memory: Option<u32>,
) -> Result<(), String> {
    let mut instances = get_instances(app.clone()).await?;

    for instance in instances.iter_mut() {
        if instance.id == id {
            instance.min_memory = min_memory;
            instance.max_memory = max_memory;
            break;
        }
    }

    let path = get_instances_file(&app);
    let data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())?;

    Ok(())
}
#[tauri::command]
pub async fn install_mod_jar(app: AppHandle, id: String, jar_path: String) -> Result<(), String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push(&id);
    path.push("mods");

    fs::create_dir_all(&path).map_err(|e| e.to_string())?;

    let file_name = PathBuf::from(&jar_path)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid jar path")?
        .to_string();

    path.push(file_name);
    fs::copy(&jar_path, &path).map_err(|e| e.to_string())?;

    Ok(())
}
#[tauri::command]
pub async fn open_instance_folder(id: String) -> Result<(), String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push(&id);

    // Attempt to open the directory
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn open_launcher_folder() -> Result<(), String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("RedPandaLauncher");

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn open_logs_folder() -> Result<(), String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push("logs");

    // Create the logs folder if it doesn't exist, otherwise opening it will fail
    let _ = fs::create_dir_all(&path);

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path.to_str().unwrap_or(""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn install_resourcepack_zip(
    app: AppHandle,
    id: String,
    zip_path: String,
) -> Result<(), String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push(&id);
    path.push("resourcepacks");

    fs::create_dir_all(&path).map_err(|e| e.to_string())?;

    let file_name = std::path::PathBuf::from(&zip_path)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid zip path")?
        .to_string();

    path.push(file_name);
    fs::copy(&zip_path, &path).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn install_shader_zip(
    app: AppHandle,
    id: String,
    zip_path: String,
) -> Result<(), String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    path.push("RedPandaLauncher");
    path.push(&id);
    path.push("shaderpacks");

    fs::create_dir_all(&path).map_err(|e| e.to_string())?;

    let file_name = std::path::PathBuf::from(&zip_path)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid zip path")?
        .to_string();

    path.push(file_name);
    fs::copy(&zip_path, &path).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn rename_instance(app: AppHandle, id: String, new_name: String) -> Result<(), String> {
    let path = get_instances_file(&app);
    if !path.exists() {
        return Err("Instances file not found".into());
    }

    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut instances: Vec<Instance> = serde_json::from_str(&data).unwrap_or_else(|_| Vec::new());

    if let Some(instance) = instances.iter_mut().find(|i| i.id == id) {
        instance.name = new_name;
    } else {
        return Err("Instance not found".into());
    }

    let updated_data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;
    fs::write(path, updated_data).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn set_instance_icon(app: AppHandle, id: String, icon_path: String) -> Result<(), String> {
    let mut inst_dir = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    inst_dir.push("RedPandaLauncher");
    inst_dir.push(&id);
    
    fs::create_dir_all(&inst_dir).map_err(|e| e.to_string())?;
    
    // Copy icon to instance directory
    let ext = std::path::Path::new(&icon_path).extension().and_then(|e| e.to_str()).unwrap_or("png");
    let dest_filename = format!("icon.{}", ext);
    let dest_path = inst_dir.join(&dest_filename);
    
    fs::copy(&icon_path, &dest_path).map_err(|e| e.to_string())?;

    let path = get_instances_file(&app);
    let data = fs::read_to_string(&path).unwrap_or_else(|_| "[]".to_string());
    let mut instances: Vec<Instance> = serde_json::from_str(&data).unwrap_or_else(|_| Vec::new());

    if let Some(instance) = instances.iter_mut().find(|i| i.id == id) {
        instance.icon_path = Some(dest_path.to_string_lossy().into_owned());
    }

    let updated_data = serde_json::to_string_pretty(&instances).map_err(|e| e.to_string())?;
    fs::write(path, updated_data).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn export_instance(app: AppHandle, id: String, dest_path: String) -> Result<(), String> {
    let mut inst_dir = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    inst_dir.push("RedPandaLauncher");
    inst_dir.push(&id);
    
    if !inst_dir.exists() {
        return Err("Instance folder not found".into());
    }
    
    let is_mrpack = dest_path.to_lowercase().ends_with(".mrpack");
    let mut instance_name = "Exported Pack".to_string();
    let mut game_version = "1.20.1".to_string();
    let mut loader_type = "Fabric".to_string();
    let mut loader_version = "0.14.21".to_string();

    if is_mrpack {
        // Load instance details
        let path = get_instances_file(&app);
        if let Ok(data) = fs::read_to_string(&path) {
            if let Ok(instances) = serde_json::from_str::<Vec<Instance>>(&data) {
                if let Some(inst) = instances.iter().find(|i| i.id == id) {
                    instance_name = inst.name.clone();
                    game_version = inst.game_version.clone();
                    loader_type = inst.loader_type.clone();
                    loader_version = inst.loader_version.clone();
                }
            }
        }
    }

    let file = std::fs::File::create(&dest_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
        
    if is_mrpack {
        use std::io::Write;
        
        let mut deps = serde_json::Map::new();
        deps.insert("minecraft".to_string(), serde_json::Value::String(game_version));
        
        if loader_type != "Vanilla" {
            let loader_key = format!("{}-loader", loader_type.to_lowercase());
            deps.insert(loader_key, serde_json::Value::String(loader_version));
        }

        let index = serde_json::json!({
            "formatVersion": 1,
            "game": "minecraft",
            "versionId": "1.0.0",
            "name": instance_name,
            "dependencies": deps,
            "files": []
        });

        zip.start_file("modrinth.index.json", options).map_err(|e| e.to_string())?;
        let json_str = serde_json::to_string_pretty(&index).unwrap_or_else(|_| "{}".to_string());
        zip.write_all(json_str.as_bytes()).map_err(|e| e.to_string())?;
    }
        
    let walkdir = walkdir::WalkDir::new(&inst_dir);
    let it = walkdir.into_iter().filter_map(|e| e.ok());

    for entry in it {
        let path = entry.path();
        let name = path.strip_prefix(&inst_dir).unwrap();
        let mut name_str = name.to_string_lossy().replace("\\", "/");
        
        if is_mrpack && !name_str.is_empty() {
            name_str = format!("overrides/{}", name_str);
        }
        
        if path.is_file() {
            zip.start_file(name_str, options).map_err(|e| e.to_string())?;
            let mut f = std::fs::File::open(path).map_err(|e| e.to_string())?;
            std::io::copy(&mut f, &mut zip).map_err(|e| e.to_string())?;
        } else if !name.as_os_str().is_empty() {
            zip.add_directory(name_str, options).map_err(|e| e.to_string())?;
        }
    }
    
    if is_mrpack {
        // Make sure overrides directory exists explicitly if it was empty
        let _ = zip.add_directory("overrides/", options);
    }
    
    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}
