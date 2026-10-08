use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Cursor,
    path::{Path, PathBuf},
};
use tauri::AppHandle;

const MAX_SKIN_BYTES: usize = 1024 * 1024;
#[derive(Clone, Serialize, Deserialize)]
pub struct SkinPreview {
    pub data_url: String,
    pub sha256: String,
    pub width: u32,
    pub height: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}
#[derive(Serialize, Deserialize)]
struct SavedSkin {
    model: String,
}
fn validate_model(model: &str) -> Result<(), String> {
    if !matches!(model, "classic" | "slim") {
        return Err("Выберите Classic или Slim".into());
    }
    Ok(())
}
fn validate_png(bytes: &[u8]) -> Result<(u32, u32), String> {
    if bytes.len() > MAX_SKIN_BYTES {
        return Err("PNG должен быть не больше 1 МБ".into());
    }
    let decoder = png::Decoder::new_with_limits(
        Cursor::new(bytes),
        png::Limits {
            bytes: MAX_SKIN_BYTES,
        },
    );
    let mut reader = decoder
        .read_info()
        .map_err(|_| "Не удалось прочитать PNG скина")?;
    let (width, height) = (reader.info().width, reader.info().height);
    if width != 64 || !matches!(height, 32 | 64) {
        return Err("Нужен PNG размером 64×64 или 64×32".into());
    }
    let mut pixels = vec![0; reader.output_buffer_size()];
    reader
        .next_frame(&mut pixels)
        .map_err(|_| "PNG повреждён")?;
    Ok((width, height))
}
fn read_skin(path: &Path) -> Result<Vec<u8>, String> {
    let metadata = fs::metadata(path).map_err(|e| format!("Не удалось открыть PNG: {e}"))?;
    if !metadata.is_file() || metadata.len() > MAX_SKIN_BYTES as u64 {
        return Err("Выберите PNG не больше 1 МБ".into());
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    validate_png(&bytes)?;
    Ok(bytes)
}
fn preview(bytes: &[u8]) -> Result<SkinPreview, String> {
    let (width, height) = validate_png(bytes)?;
    Ok(SkinPreview {
        sha256: hex::encode(Sha256::digest(bytes)),
        data_url: format!("data:image/png;base64,{}", STANDARD.encode(bytes)),
        width,
        height,
        model: None,
    })
}
fn account_folder(id: &str) -> Result<PathBuf, String> {
    // Account IDs are generated UUIDs; reject arbitrary IPC paths.
    uuid::Uuid::parse_str(id).map_err(|_| "Некорректный ID аккаунта")?;
    crate::security::safe_join(
        &crate::security::launcher_data_dir()?,
        &format!("skins/{id}"),
    )
}
pub async fn preview_file(path: String) -> Result<SkinPreview, String> {
    tauri::async_runtime::spawn_blocking(move || preview(&read_skin(Path::new(&path))?))
        .await
        .map_err(|e| e.to_string())?
}
pub fn get_saved(app: &AppHandle, account_id: &str) -> Result<Option<SkinPreview>, String> {
    if !crate::accounts::get_accounts(app.clone())?
        .iter()
        .any(|a| a.id == account_id)
    {
        return Err("Аккаунт не найден".into());
    }
    let folder = account_folder(account_id)?;
    let path = crate::security::safe_join(&folder, "skin.png")?;
    if !path.exists() {
        return Ok(None);
    }
    let mut skin = preview(&read_skin(&path)?)?;
    let metadata = crate::security::safe_join(&folder, "skin.json")?;
    if metadata.exists() {
        let saved: SavedSkin = crate::storage::read_json_with_backup(&metadata)?;
        skin.model = Some(saved.model);
    }
    Ok(Some(skin))
}
fn local_config(
    mut config: serde_json::Value,
    account_id: &str,
    model: &str,
) -> Result<serde_json::Value, String> {
    if !config.is_object() {
        return Err("Конфигурация CustomSkinLoader повреждена".into());
    }
    if config.get("loadlist").is_none() {
        config["loadlist"] = serde_json::json!([]);
    }
    let list = config["loadlist"]
        .as_array_mut()
        .ok_or("Некорректный loadlist CustomSkinLoader")?;
    let name = format!("RedPanda-{account_id}");
    list.retain(|entry| entry["name"].as_str() != Some(&name));
    list.insert(0,serde_json::json!({"name":name,"type":"Legacy","skin":format!("RedPanda/{account_id}/{{USERNAME}}.png"),"model":if model == "classic" { "default" } else { "slim" }}));
    Ok(config)
}
fn has_skin_loader(game_dir: &Path) -> Result<bool, String> {
    use std::io::Read;
    let mods = crate::security::safe_join(game_dir, "mods")?;
    if !mods.exists() {
        return Ok(false);
    }
    for entry in fs::read_dir(&mods).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.ends_with(".jar") {
            continue;
        }
        let path = crate::security::safe_join(&mods, &name)?;
        let file = fs::File::open(path).map_err(|e| e.to_string())?;
        let Ok(mut archive) = zip::ZipArchive::new(file) else {
            continue;
        };
        for metadata in [
            "fabric.mod.json",
            "quilt.mod.json",
            "META-INF/mods.toml",
            "META-INF/neoforge.mods.toml",
            "mcmod.info",
        ] {
            if let Ok(entry) = archive.by_name(metadata) {
                let mut text = String::new();
                if entry.take(65536).read_to_string(&mut text).is_err() {
                    continue;
                }
                if metadata.ends_with(".json") || metadata == "mcmod.info" {
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
                        if value["id"].as_str() == Some("customskinloader")
                            || value["quilt_loader"]["id"].as_str() == Some("customskinloader")
                            || value.as_array().is_some_and(|items| {
                                items
                                    .iter()
                                    .any(|i| i["modid"].as_str() == Some("customskinloader"))
                            })
                        {
                            return Ok(true);
                        }
                    }
                } else if text.lines().any(|line| {
                    let line = line.split('#').next().unwrap_or("").trim();
                    line.split_once('=').is_some_and(|(key, value)| {
                        key.trim() == "modId"
                            && value.trim().trim_matches(['\"', '\'']) == "customskinloader"
                    })
                }) {
                    return Ok(true);
                }
            }
        }
    }
    Ok(false)
}
pub async fn apply(
    app: AppHandle,
    account_id: String,
    path: String,
    expected_sha256: String,
    model: String,
    mode: String,
    instance_id: Option<String>,
) -> Result<SkinPreview, String> {
    validate_model(&model)?;
    let read_path = path.clone();
    let bytes = tauri::async_runtime::spawn_blocking(move || read_skin(Path::new(&read_path)))
        .await
        .map_err(|e| e.to_string())??;
    if !hex::encode(Sha256::digest(&bytes)).eq_ignore_ascii_case(&expected_sha256) {
        return Err("PNG изменился после предпросмотра. Выберите файл заново".into());
    }
    if model == "slim" && validate_png(&bytes)?.1 == 32 {
        return Err("Для Slim нужен скин 64×64".into());
    }
    let mut account = crate::accounts::load_accounts_data(&app)?
        .accounts
        .into_iter()
        .find(|a| a.id == account_id)
        .ok_or("Аккаунт не найден")?;
    let folder = account_folder(&account_id)?;
    if mode == "profile" {
        if account.account_type != "Microsoft" {
            return Err("Загрузка в профиль доступна для Microsoft. Для этого аккаунта выберите локальную сборку".into());
        }
        crate::accounts::refresh_account_tokens_and_persist(&app, &mut account).await?;
        let token = account.access_token.ok_or("Войдите в Microsoft заново")?;
        let part = reqwest::multipart::Part::bytes(bytes.clone())
            .file_name("skin.png")
            .mime_str("image/png")
            .map_err(|e| e.to_string())?;
        let form = reqwest::multipart::Form::new()
            .text("variant", model.clone())
            .part("file", part);
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(std::time::Duration::from_secs(45))
            .build()
            .map_err(|e| e.to_string())?;
        let response = client
            .post("https://api.minecraftservices.com/minecraft/profile/skins")
            .bearer_auth(token)
            .multipart(form)
            .send()
            .await
            .map_err(|_| "Не удалось связаться с сервисом скинов Minecraft")?;
        if !response.status().is_success() {
            return Err(format!(
                "Minecraft не принял скин (HTTP {}). Проверьте вход и наличие Java Edition",
                response.status()
            ));
        }
    } else if mode == "local" {
        let id = instance_id.ok_or("Выберите сборку")?;
        let instance = crate::instances::get_instances(app.clone())
            .await?
            .into_iter()
            .find(|i| i.id == id)
            .ok_or("Сборка не найдена")?;
        if instance.loader_type == "Vanilla" {
            return Err(
                "Для локального скина нужна сборка Fabric, Quilt, Forge или NeoForge".into(),
            );
        }
        if account.username.is_empty()
            || account.username.len() > 16
            || !account
                .username
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_')
        {
            return Err("Для локального скина нужен ник из 1–16 латинских букв, цифр или _".into());
        }
        let game_dir = crate::security::instance_dir(&id)?;
        let config_path =
            crate::security::safe_join(&game_dir, "CustomSkinLoader/CustomSkinLoader.json")?;
        let config = if config_path.exists() {
            crate::storage::read_json_with_backup(&config_path)?
        } else {
            serde_json::json!({"loadlist":[{"name":"Mojang","type":"MojangAPI"}]})
        };
        let config = local_config(config, &account_id, &model)?;
        // Leave a manually installed helper version in place; install only when absent.
        if !has_skin_loader(&game_dir)? {
            let versions = crate::modrinth::get_modrinth_versions(
                "customskinloader".into(),
                instance.game_version.clone(),
                instance.loader_type.clone(),
                "mod".into(),
            )
            .await?;
            let version = versions.first().ok_or(
                "Для этой версии Minecraft и загрузчика нет совместимого CustomSkinLoader",
            )?;
            let plan = super::content::install::preview(
                app.clone(),
                id.clone(),
                "modrinth".into(),
                version.id.clone(),
                "mod".into(),
            )
            .await?;
            super::content::install::execute(app.clone(), plan.id).await?;
        }
        let skin_path = crate::security::safe_join(
            &game_dir,
            &format!(
                "CustomSkinLoader/RedPanda/{account_id}/{}.png",
                account.username
            ),
        )?;
        crate::storage::atomic_write(&skin_path, &bytes)?;
        crate::storage::atomic_write(
            &config_path,
            &serde_json::to_vec_pretty(&config).map_err(|e| e.to_string())?,
        )?;
    } else {
        return Err("Неизвестный способ установки скина".into());
    }
    crate::storage::atomic_write(&crate::security::safe_join(&folder, "skin.png")?, &bytes)?;
    crate::storage::atomic_write(
        &crate::security::safe_join(&folder, "skin.json")?,
        &serde_json::to_vec(&SavedSkin {
            model: model.clone(),
        })
        .map_err(|e| e.to_string())?,
    )?;
    let mut skin = preview(&bytes)?;
    skin.model = Some(model);
    Ok(skin)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn png_bytes(w: u32, h: u32) -> Vec<u8> {
        let mut out = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut out, w, h);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().unwrap();
            writer
                .write_image_data(&vec![255; (w * h * 4) as usize])
                .unwrap();
        }
        out
    }
    #[test]
    fn accepts_standard_and_legacy_png() {
        assert_eq!(validate_png(&png_bytes(64, 64)).unwrap(), (64, 64));
        assert!(validate_png(&png_bytes(64, 32)).is_ok());
    }
    #[test]
    fn rejects_wrong_size_and_fake_png() {
        assert!(validate_png(&png_bytes(32, 32)).is_err());
        assert!(validate_png(b"fake png").is_err());
    }
    #[test]
    fn rejects_unknown_model() {
        assert!(validate_model("other").is_err());
    }
    #[test]
    fn preserves_existing_config_and_replaces_own_profile() {
        let initial =
            serde_json::json!({"cacheExpiry":60,"loadlist":[{"name":"Mojang","type":"MojangAPI"}]});
        let first = local_config(initial, "id", "classic").unwrap();
        let second = local_config(first, "id", "slim").unwrap();
        assert_eq!(second["loadlist"].as_array().unwrap().len(), 2);
        assert_eq!(second["loadlist"][0]["model"], "slim");
        assert_eq!(second["cacheExpiry"], 60);
    }
}
