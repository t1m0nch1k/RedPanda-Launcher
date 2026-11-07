use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Cursor,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Emitter};

const MAX_SKIN_BYTES: usize = 1024 * 1024;

#[derive(Clone, Serialize, Deserialize)]
pub struct SkinPreview {
    pub data_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_data_url: Option<String>,
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

pub fn extract_avatar_png(skin_bytes: &[u8]) -> Result<Vec<u8>, String> {
    let decoder = png::Decoder::new_with_limits(
        Cursor::new(skin_bytes),
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
    let color_type = reader.info().color_type;
    let mut raw_pixels = vec![0; reader.output_buffer_size()];
    reader
        .next_frame(&mut raw_pixels)
        .map_err(|_| "PNG повреждён")?;

    let get_rgba = |px: u32, py: u32| -> [u8; 4] {
        if px >= width || py >= height {
            return [0, 0, 0, 0];
        }
        let base = (py * width + px) as usize;
        match color_type {
            png::ColorType::Rgba => {
                let idx = base * 4;
                if idx + 3 < raw_pixels.len() {
                    [
                        raw_pixels[idx],
                        raw_pixels[idx + 1],
                        raw_pixels[idx + 2],
                        raw_pixels[idx + 3],
                    ]
                } else {
                    [0, 0, 0, 0]
                }
            }
            png::ColorType::Rgb => {
                let idx = base * 3;
                if idx + 2 < raw_pixels.len() {
                    [
                        raw_pixels[idx],
                        raw_pixels[idx + 1],
                        raw_pixels[idx + 2],
                        255,
                    ]
                } else {
                    [0, 0, 0, 0]
                }
            }
            _ => [0, 0, 0, 0],
        }
    };

    let mut head_8x8 = [0u8; 8 * 8 * 4];
    for y in 0..8 {
        for x in 0..8 {
            let base_rgba = get_rgba(8 + x, 8 + y);
            let hat_rgba = get_rgba(40 + x, 8 + y);
            let dest_idx = (y * 8 + x) as usize * 4;

            let final_pixel = if hat_rgba[3] > 10 {
                if hat_rgba[3] >= 250 {
                    hat_rgba
                } else {
                    let a = hat_rgba[3] as f32 / 255.0;
                    [
                        ((hat_rgba[0] as f32 * a) + (base_rgba[0] as f32 * (1.0 - a))) as u8,
                        ((hat_rgba[1] as f32 * a) + (base_rgba[1] as f32 * (1.0 - a))) as u8,
                        ((hat_rgba[2] as f32 * a) + (base_rgba[2] as f32 * (1.0 - a))) as u8,
                        255,
                    ]
                }
            } else {
                base_rgba
            };

            head_8x8[dest_idx..dest_idx + 4].copy_from_slice(&final_pixel);
        }
    }

    let out_size = 64usize;
    let mut out_pixels = vec![0u8; out_size * out_size * 4];
    for y in 0..out_size {
        let sy = y / 8;
        for x in 0..out_size {
            let sx = x / 8;
            let src_idx = (sy * 8 + sx) * 4;
            let dst_idx = (y * out_size + x) * 4;
            out_pixels[dst_idx..dst_idx + 4].copy_from_slice(&head_8x8[src_idx..src_idx + 4]);
        }
    }

    let mut out_png = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut out_png, out_size as u32, out_size as u32);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
        writer
            .write_image_data(&out_pixels)
            .map_err(|e| e.to_string())?;
    }
    Ok(out_png)
}

fn preview(bytes: &[u8]) -> Result<SkinPreview, String> {
    let (width, height) = validate_png(bytes)?;
    let avatar_data_url = extract_avatar_png(bytes)
        .ok()
        .map(|b| format!("data:image/png;base64,{}", STANDARD.encode(&b)));
    Ok(SkinPreview {
        sha256: hex::encode(Sha256::digest(bytes)),
        data_url: format!("data:image/png;base64,{}", STANDARD.encode(bytes)),
        avatar_data_url,
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

pub async fn get_saved(app: &AppHandle, account_id: &str) -> Result<Option<SkinPreview>, String> {
    let accounts = crate::accounts::load_accounts_data(app)?.accounts;
    let account = accounts
        .into_iter()
        .find(|a| a.id == account_id)
        .ok_or("Аккаунт не найден")?;
    let folder = account_folder(account_id)?;
    let path = crate::security::safe_join(&folder, "skin.png")?;
    if path.exists() {
        if let Ok(bytes) = read_skin(&path) {
            let mut skin = preview(&bytes)?;
            let metadata = crate::security::safe_join(&folder, "skin.json")?;
            if metadata.exists() {
                if let Ok(saved) = crate::storage::read_json_with_backup::<SavedSkin>(&metadata) {
                    skin.model = Some(saved.model);
                }
            }
            return Ok(Some(skin));
        }
    }

    if account.account_type == "ElyBy" && !account.username.trim().is_empty() {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?;
        let url = format!(
            "http://skinsystem.ely.by/skins/{}.png",
            account.username.trim()
        );
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                if let Ok(bytes) = resp.bytes().await {
                    if let Ok(skin) = preview(&bytes) {
                        let _ = crate::storage::atomic_write(&path, &bytes);
                        let _ = crate::storage::atomic_write(
                            &crate::security::safe_join(&folder, "skin.json")?,
                            serde_json::to_string(&SavedSkin {
                                model: "classic".into(),
                            })
                            .unwrap_or_default()
                            .as_bytes(),
                        );
                        return Ok(Some(skin));
                    }
                }
            }
        }
    } else if account.account_type == "Microsoft" {
        if let Some(ref uuid) = account.uuid {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .map_err(|e| e.to_string())?;
            let url = format!("https://minotar.net/skin/{}", uuid);
            if let Ok(resp) = client.get(&url).send().await {
                if resp.status().is_success() {
                    if let Ok(bytes) = resp.bytes().await {
                        if let Ok(skin) = preview(&bytes) {
                            let _ = crate::storage::atomic_write(&path, &bytes);
                            return Ok(Some(skin));
                        }
                    }
                }
            }
        }
    }

    Ok(None)
}

pub async fn refresh_account_skin(
    app: &AppHandle,
    account_id: &str,
) -> Result<Option<SkinPreview>, String> {
    let folder = account_folder(account_id)?;
    let path = crate::security::safe_join(&folder, "skin.png")?;
    if path.exists() {
        let _ = fs::remove_file(&path);
    }
    let metadata = crate::security::safe_join(&folder, "skin.json")?;
    if metadata.exists() {
        let _ = fs::remove_file(&metadata);
    }
    let skin = get_saved(app, account_id).await?;
    let _ = app.emit("accounts_changed", ());
    let _ = app.emit("skin_changed", account_id);
    Ok(skin)
}

fn local_config(
    mut config: serde_json::Value,
    account_id: &str,
    model: &str,
) -> Result<serde_json::Value, String> {
    if !config.is_object() {
        return Err("Конфигурация CustomSkinLoader повреждена".into());
    }
    config["enable"] = serde_json::json!(true);
    config["enableCache"] = serde_json::json!(true);
    if config.get("loadlist").is_none() {
        config["loadlist"] = serde_json::json!([]);
    }
    let list = config["loadlist"]
        .as_array_mut()
        .ok_or("Некорректный loadlist CustomSkinLoader")?;
    let name = format!("RedPanda-{account_id}");
    list.retain(|entry| entry["name"].as_str() != Some(&name));
    list.insert(
        0,
        serde_json::json!({
            "name": name,
            "type": "Legacy",
            "checkPNG": false,
            "skin": format!("RedPanda/{account_id}/{{USERNAME}}.png"),
            "model": if model == "classic" { "default" } else { "slim" }
        }),
    );
    if !list
        .iter()
        .any(|entry| entry["name"].as_str() == Some("ElyBy"))
    {
        list.push(serde_json::json!({
            "name": "ElyBy",
            "type": "ElyByAPI"
        }));
    }
    if !list
        .iter()
        .any(|entry| entry["name"].as_str() == Some("Mojang"))
    {
        list.push(serde_json::json!({
            "name": "Mojang",
            "type": "MojangAPI"
        }));
    }
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
                        let matches_id =
                            |id: &str| id.to_lowercase().starts_with("customskinloader");
                        if value["id"].as_str().is_some_and(matches_id)
                            || value["quilt_loader"]["id"].as_str().is_some_and(matches_id)
                            || value.as_array().is_some_and(|items| {
                                items
                                    .iter()
                                    .any(|i| i["modid"].as_str().is_some_and(matches_id))
                            })
                        {
                            return Ok(true);
                        }
                    }
                } else if text.lines().any(|line| {
                    let line = line.split('#').next().unwrap_or("").trim();
                    line.split_once('=').is_some_and(|(key, value)| {
                        key.trim() == "modId"
                            && value
                                .trim()
                                .trim_matches(['\"', '\''])
                                .to_lowercase()
                                .starts_with("customskinloader")
                    })
                }) {
                    return Ok(true);
                }
            }
        }
    }
    Ok(false)
}

pub async fn install_custom_skin_loader_if_missing(
    app: AppHandle,
    instance_id: &str,
    game_version: &str,
    loader_type: &str,
    game_dir: &Path,
) -> Result<(), String> {
    if has_skin_loader(game_dir)? {
        return Ok(());
    }
    let versions = crate::modrinth::get_modrinth_versions(
        "customskinloader".into(),
        game_version.to_string(),
        loader_type.to_string(),
        "mod".into(),
    )
    .await?;
    let version = versions
        .first()
        .ok_or("Для этой версии Minecraft и загрузчика нет совместимого CustomSkinLoader")?;
    let plan = super::content::install::preview(
        app.clone(),
        instance_id.to_string(),
        "modrinth".into(),
        version.id.clone(),
        "mod".into(),
    )
    .await?;
    super::content::install::execute(app.clone(), plan.id).await?;
    Ok(())
}

pub async fn ensure_modded_skin_support(
    app: &AppHandle,
    instance_id: &str,
    account_type: &str,
    account_id: &str,
    username: &str,
) -> Result<(), String> {
    let instances = crate::instances::get_instances(app.clone()).await?;
    let instance = match instances.into_iter().find(|i| i.id == instance_id) {
        Some(i) => i,
        None => return Ok(()),
    };

    if instance.loader_type == "Vanilla" {
        return Ok(());
    }

    let game_dir = crate::security::instance_dir(instance_id)?;

    let folder = account_folder(account_id);
    let local_skin_exists = if let Ok(ref f) = folder {
        crate::security::safe_join(f, "skin.png")
            .map(|p| p.exists())
            .unwrap_or(false)
    } else {
        false
    };

    if account_type != "ElyBy" && !local_skin_exists {
        return Ok(());
    }

    if let Err(e) = install_custom_skin_loader_if_missing(
        app.clone(),
        instance_id,
        &instance.game_version,
        &instance.loader_type,
        &game_dir,
    )
    .await
    {
        log::warn!(
            "Could not auto-install CustomSkinLoader for {}: {}",
            instance_id,
            e
        );
    }

    let csl_dir = crate::security::safe_join(&game_dir, "CustomSkinLoader")?;
    let _ = fs::create_dir_all(&csl_dir);
    let config_path = crate::security::safe_join(&csl_dir, "CustomSkinLoader.json")?;

    let mut config: serde_json::Value = if config_path.exists() {
        crate::storage::read_json_with_backup(&config_path).unwrap_or_else(|_| {
            serde_json::json!({
                "enable": true,
                "enableCache": true,
                "loadlist": []
            })
        })
    } else {
        serde_json::json!({
            "enable": true,
            "enableCache": true,
            "loadlist": []
        })
    };

    if !config.is_object() {
        config = serde_json::json!({
            "enable": true,
            "enableCache": true,
            "loadlist": []
        });
    }

    config["enable"] = serde_json::json!(true);
    config["enableCache"] = serde_json::json!(true);

    if config.get("loadlist").is_none() || !config["loadlist"].is_array() {
        config["loadlist"] = serde_json::json!([]);
    }

    let list = config["loadlist"].as_array_mut().unwrap();

    if let Ok(ref account_dir) = folder {
        let local_skin_png = crate::security::safe_join(account_dir, "skin.png")?;
        if local_skin_png.exists() {
            if let Ok(bytes) = fs::read(&local_skin_png) {
                let skin_dest = crate::security::safe_join(
                    &csl_dir,
                    &format!("RedPanda/{account_id}/{username}.png"),
                )?;
                let _ = crate::storage::atomic_write(&skin_dest, &bytes);
                let model = if let Ok(meta) = crate::storage::read_json_with_backup::<SavedSkin>(
                    &crate::security::safe_join(account_dir, "skin.json")?,
                ) {
                    if meta.model == "slim" {
                        "slim"
                    } else {
                        "default"
                    }
                } else {
                    "default"
                };

                let name = format!("RedPanda-{account_id}");
                list.retain(|entry| entry["name"].as_str() != Some(&name));
                list.insert(
                    0,
                    serde_json::json!({
                        "name": name,
                        "type": "Legacy",
                        "checkPNG": false,
                        "skin": format!("RedPanda/{account_id}/{{USERNAME}}.png"),
                        "model": model
                    }),
                );
            }
        }
    }

    if !list
        .iter()
        .any(|entry| entry["name"].as_str() == Some("ElyBy"))
    {
        let insert_idx = if !list.is_empty()
            && list[0]["name"]
                .as_str()
                .is_some_and(|n| n.starts_with("RedPanda-"))
        {
            1
        } else {
            0
        };
        list.insert(
            insert_idx,
            serde_json::json!({
                "name": "ElyBy",
                "type": "ElyByAPI"
            }),
        );
    }

    if !list
        .iter()
        .any(|entry| entry["name"].as_str() == Some("Mojang"))
    {
        list.push(serde_json::json!({
            "name": "Mojang",
            "type": "MojangAPI"
        }));
    }

    let _ = crate::storage::atomic_write(
        &config_path,
        &serde_json::to_vec_pretty(&config).map_err(|e| e.to_string())?,
    );

    Ok(())
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
        install_custom_skin_loader_if_missing(
            app.clone(),
            &id,
            &instance.game_version,
            &instance.loader_type,
            &game_dir,
        )
        .await?;
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
    let _ = app.emit("accounts_changed", ());
    let _ = app.emit("skin_changed", &account_id);
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
    fn extracts_avatar_from_valid_skin() {
        let avatar = extract_avatar_png(&png_bytes(64, 64)).unwrap();
        assert!(!avatar.is_empty());
        assert_eq!(validate_png(&avatar).unwrap(), (64, 64));
    }
    #[test]
    fn preserves_existing_config_and_replaces_own_profile() {
        let initial =
            serde_json::json!({"cacheExpiry":60,"loadlist":[{"name":"Mojang","type":"MojangAPI"}]});
        let first = local_config(initial, "id", "classic").unwrap();
        let second = local_config(first, "id", "slim").unwrap();
        assert_eq!(second["loadlist"].as_array().unwrap().len(), 3);
        assert_eq!(second["loadlist"][0]["model"], "slim");
        assert!(second["loadlist"]
            .as_array()
            .unwrap()
            .iter()
            .any(|e| e["name"] == "ElyBy"));
        assert_eq!(second["cacheExpiry"], 60);
    }
}
