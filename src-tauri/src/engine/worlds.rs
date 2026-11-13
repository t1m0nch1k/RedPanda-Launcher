use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldSummary {
    pub folder_name: String,
    pub name: String,
    pub game_type: String, // "Survival", "Creative", "Adventure", "Spectator", "Hardcore"
    pub last_played: i64,  // Unix timestamp (seconds)
    pub version_name: String,
    pub seed: Option<i64>,
    pub size_bytes: u64,
    pub icon_data_url: Option<String>,
}

#[derive(Default, Debug, Clone)]
pub struct LevelDatMeta {
    pub level_name: Option<String>,
    pub game_type: Option<i32>,
    pub is_hardcore: bool,
    pub last_played_ms: Option<i64>,
    pub seed: Option<i64>,
    pub version_name: Option<String>,
}

// ---------------------------------------------------------------------------
// NBT Parsing for level.dat
// ---------------------------------------------------------------------------

struct NbtReader<'a> {
    cursor: Cursor<&'a [u8]>,
}

impl<'a> NbtReader<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self {
            cursor: Cursor::new(data),
        }
    }

    fn read_u8(&mut self) -> Option<u8> {
        let mut buf = [0u8; 1];
        self.cursor.read_exact(&mut buf).ok()?;
        Some(buf[0])
    }

    fn read_i16(&mut self) -> Option<i16> {
        let mut buf = [0u8; 2];
        self.cursor.read_exact(&mut buf).ok()?;
        Some(i16::from_be_bytes(buf))
    }

    fn read_i32(&mut self) -> Option<i32> {
        let mut buf = [0u8; 4];
        self.cursor.read_exact(&mut buf).ok()?;
        Some(i32::from_be_bytes(buf))
    }

    fn read_i64(&mut self) -> Option<i64> {
        let mut buf = [0u8; 8];
        self.cursor.read_exact(&mut buf).ok()?;
        Some(i64::from_be_bytes(buf))
    }

    fn read_string(&mut self) -> Option<String> {
        let len = self.read_i16()? as usize;
        let mut buf = vec![0u8; len];
        self.cursor.read_exact(&mut buf).ok()?;
        String::from_utf8(buf).ok()
    }

    fn skip_bytes(&mut self, count: usize) -> Option<()> {
        let pos = self.cursor.position() as usize;
        let target = pos.checked_add(count)?;
        if target > self.cursor.get_ref().len() {
            return None;
        }
        self.cursor.set_position(target as u64);
        Some(())
    }

    fn skip_tag(&mut self, tag_type: u8) -> Option<()> {
        match tag_type {
            0 => Some(()),           // TAG_End
            1 => self.skip_bytes(1), // TAG_Byte
            2 => self.skip_bytes(2), // TAG_Short
            3 => self.skip_bytes(4), // TAG_Int
            4 => self.skip_bytes(8), // TAG_Long
            5 => self.skip_bytes(4), // TAG_Float
            6 => self.skip_bytes(8), // TAG_Double
            7 => {
                let len = self.read_i32()?;
                if len < 0 {
                    return None;
                }
                self.skip_bytes(len as usize)
            }
            8 => {
                let len = self.read_i16()?;
                if len < 0 {
                    return None;
                }
                self.skip_bytes(len as usize)
            }
            9 => {
                let elem_type = self.read_u8()?;
                let len = self.read_i32()?;
                if len <= 0 {
                    return Some(());
                }
                for _ in 0..len {
                    self.skip_tag(elem_type)?;
                }
                Some(())
            }
            10 => {
                // TAG_Compound
                loop {
                    let next_type = self.read_u8()?;
                    if next_type == 0 {
                        break;
                    }
                    let _ = self.read_string()?;
                    self.skip_tag(next_type)?;
                }
                Some(())
            }
            11 => {
                let len = self.read_i32()?;
                if len < 0 {
                    return None;
                }
                self.skip_bytes((len as usize).checked_mul(4)?)
            }
            12 => {
                let len = self.read_i32()?;
                if len < 0 {
                    return None;
                }
                self.skip_bytes((len as usize).checked_mul(8)?)
            }
            _ => None,
        }
    }

    fn parse_compound_into(&mut self, meta: &mut LevelDatMeta, depth: usize) -> Option<()> {
        if depth > 32 {
            return None;
        }
        loop {
            let tag_type = self.read_u8()?;
            if tag_type == 0 {
                break;
            }
            let name = self.read_string()?;

            match (name.as_str(), tag_type) {
                ("Data", 10) => {
                    self.parse_compound_into(meta, depth + 1)?;
                }
                ("LevelName", 8) => {
                    meta.level_name = self.read_string();
                }
                ("GameType", 1) => {
                    meta.game_type = self.read_u8().map(|b| b as i32);
                }
                ("GameType", 3) => {
                    meta.game_type = self.read_i32();
                }
                ("hardcore", 1) => {
                    meta.is_hardcore = self.read_u8().unwrap_or(0) == 1;
                }
                ("LastPlayed", 4) => {
                    meta.last_played_ms = self.read_i64();
                }
                ("RandomSeed", 4) => {
                    meta.seed = self.read_i64();
                }
                ("seed", 4) if meta.seed.is_none() => {
                    meta.seed = self.read_i64();
                }
                ("Version", 10) => {
                    self.parse_version_compound(meta, depth + 1)?;
                }
                ("WorldGenSettings", 10) => {
                    self.parse_compound_into(meta, depth + 1)?;
                }
                _ => {
                    self.skip_tag(tag_type)?;
                }
            }
        }
        Some(())
    }

    fn parse_version_compound(&mut self, meta: &mut LevelDatMeta, depth: usize) -> Option<()> {
        if depth > 32 {
            return None;
        }
        loop {
            let tag_type = self.read_u8()?;
            if tag_type == 0 {
                break;
            }
            let name = self.read_string()?;
            if name == "Name" && tag_type == 8 {
                meta.version_name = self.read_string();
            } else {
                self.skip_tag(tag_type)?;
            }
        }
        Some(())
    }
}

pub fn parse_level_dat(path: &Path) -> Result<LevelDatMeta, String> {
    let file = File::open(path).map_err(|e| format!("Cannot open level.dat: {e}"))?;
    let mut decoder = GzDecoder::new(file);
    let mut decompressed = Vec::with_capacity(32 * 1024);
    decoder
        .read_to_end(&mut decompressed)
        .map_err(|e| format!("Gzip decode failed: {e}"))?;

    let mut reader = NbtReader::new(&decompressed);
    let root_type = reader.read_u8().ok_or("Empty NBT data")?;
    if root_type != 10 {
        return Err("Root tag is not compound".to_string());
    }
    let _root_name = reader.read_string().unwrap_or_default();

    let mut meta = LevelDatMeta::default();
    reader
        .parse_compound_into(&mut meta, 0)
        .ok_or("Failed parsing compound")?;

    Ok(meta)
}

// ---------------------------------------------------------------------------
// World Management Operations
// ---------------------------------------------------------------------------

fn calculate_dir_size(path: &Path) -> u64 {
    walkdir::WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .map(|e| e.metadata().map(|m| m.len()).unwrap_or(0))
        .sum()
}

pub fn list_instance_worlds(instance_id: &str) -> Result<Vec<WorldSummary>, String> {
    let instance = crate::security::instance_dir(instance_id)?;
    let saves_dir = instance.join("saves");
    if !saves_dir.exists() {
        return Ok(Vec::new());
    }

    let mut worlds = Vec::new();
    let entries = fs::read_dir(&saves_dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let folder_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        let level_dat = path.join("level.dat");
        let meta = if level_dat.exists() {
            parse_level_dat(&level_dat).ok()
        } else {
            None
        };

        let icon_path = path.join("icon.png");
        let icon_data_url = if icon_path.exists() {
            fs::read(&icon_path).ok().map(|bytes| {
                format!(
                    "data:image/png;base64,{}",
                    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes)
                )
            })
        } else {
            None
        };

        let size_bytes = calculate_dir_size(&path);

        let name = meta
            .as_ref()
            .and_then(|m| m.level_name.clone())
            .unwrap_or_else(|| folder_name.clone());

        let game_type = if let Some(ref m) = meta {
            if m.is_hardcore {
                "Hardcore".to_string()
            } else {
                match m.game_type {
                    Some(0) => "Survival".to_string(),
                    Some(1) => "Creative".to_string(),
                    Some(2) => "Adventure".to_string(),
                    Some(3) => "Spectator".to_string(),
                    _ => "Survival".to_string(),
                }
            }
        } else {
            "Survival".to_string()
        };

        let last_played = meta
            .as_ref()
            .and_then(|m| m.last_played_ms)
            .map(|ms| ms / 1000)
            .unwrap_or_else(|| {
                entry
                    .metadata()
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0)
            });

        let version_name = meta
            .as_ref()
            .and_then(|m| m.version_name.clone())
            .unwrap_or_default();

        let seed = meta.as_ref().and_then(|m| m.seed);

        worlds.push(WorldSummary {
            folder_name,
            name,
            game_type,
            last_played,
            version_name,
            seed,
            size_bytes,
            icon_data_url,
        });
    }

    // Sort by last_played desc
    worlds.sort_by_key(|b| std::cmp::Reverse(b.last_played));
    Ok(worlds)
}

pub fn backup_single_world(
    app: &AppHandle,
    instance_id: &str,
    world_folder: &str,
) -> Result<PathBuf, String> {
    if crate::runstate::is_instance_running(app, instance_id) {
        return Err(crate::runstate::BUSY_INSTANCE_MESSAGE.to_string());
    }

    let instance = crate::security::instance_dir(instance_id)?;
    let world_dir = crate::security::safe_join(&instance.join("saves"), world_folder)?;
    if !world_dir.exists() || !world_dir.is_dir() {
        return Err("Папка мира не найдена".to_string());
    }

    let backups_dir = instance.join("backups").join("worlds");
    fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;

    let now = chrono::Local::now();
    let timestamp = now.format("%Y-%m-%d_%H-%M-%S").to_string();
    let safe_name = world_folder.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    let zip_filename = format!("{}_{}.zip", safe_name, timestamp);
    let zip_path = backups_dir.join(&zip_filename);

    let temp_zip = backups_dir.join(format!(".{}.tmp", uuid::Uuid::new_v4()));
    let file = File::create(&temp_zip).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    add_world_dir_to_zip(&world_dir, &world_dir, world_folder, &mut zip, options)?;
    zip.finish().map_err(|e| e.to_string())?;

    fs::rename(&temp_zip, &zip_path).map_err(|e| e.to_string())?;
    Ok(zip_path)
}

pub fn export_world_to_path(
    instance_id: &str,
    world_folder: &str,
    target_path: &Path,
) -> Result<(), String> {
    let instance = crate::security::instance_dir(instance_id)?;
    let world_dir = crate::security::safe_join(&instance.join("saves"), world_folder)?;
    if !world_dir.exists() || !world_dir.is_dir() {
        return Err("Папка мира не найдена".to_string());
    }

    let file = File::create(target_path).map_err(|e| format!("Не удалось создать файл: {e}"))?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    add_world_dir_to_zip(&world_dir, &world_dir, world_folder, &mut zip, options)?;
    zip.finish().map_err(|e| format!("Ошибка архивации: {e}"))?;
    Ok(())
}

fn add_world_dir_to_zip(
    root: &Path,
    dir: &Path,
    prefix_folder: &str,
    zip: &mut ZipWriter<File>,
    options: SimpleFileOptions,
) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .map_err(|e| e.to_string())?
            .to_str()
            .ok_or_else(|| "Invalid UTF-8 in path".to_string())?
            .replace('\\', "/");

        let zip_entry_name = if relative.is_empty() {
            prefix_folder.to_string()
        } else {
            format!("{prefix_folder}/{relative}")
        };

        if path.is_file() {
            // Skip locks or temporary files
            if path.file_name().and_then(|n| n.to_str()) == Some("session.lock") {
                continue;
            }
            zip.start_file(zip_entry_name, options)
                .map_err(|e| e.to_string())?;
            let mut f = File::open(&path).map_err(|e| e.to_string())?;
            std::io::copy(&mut f, zip).map_err(|e| e.to_string())?;
        } else if path.is_dir() {
            add_world_dir_to_zip(root, &path, prefix_folder, zip, options)?;
        }
    }
    Ok(())
}

pub fn import_world_from_zip(
    app: &AppHandle,
    instance_id: &str,
    zip_path: &Path,
) -> Result<String, String> {
    if crate::runstate::is_instance_running(app, instance_id) {
        return Err(crate::runstate::BUSY_INSTANCE_MESSAGE.to_string());
    }

    let instance = crate::security::instance_dir(instance_id)?;
    let saves_dir = instance.join("saves");
    fs::create_dir_all(&saves_dir).map_err(|e| e.to_string())?;

    let file = File::open(zip_path).map_err(|e| format!("Не удалось открыть архив: {e}"))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Некорректный ZIP архив: {e}"))?;

    // Detect if zip has a root directory (e.g., "MyWorld/level.dat") or level.dat directly in root
    let mut level_dat_prefix: Option<String> = None;
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().replace('\\', "/");
        if name == "level.dat" {
            level_dat_prefix = Some("".to_string());
            break;
        } else if name.ends_with("/level.dat") {
            let parts: Vec<&str> = name.split('/').collect();
            if parts.len() == 2 {
                level_dat_prefix = Some(parts[0].to_string());
                break;
            }
        }
    }

    let raw_folder_name = if let Some(ref p) = level_dat_prefix {
        if !p.is_empty() {
            p.clone()
        } else {
            zip_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Imported_World")
                .to_string()
        }
    } else {
        zip_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Imported_World")
            .to_string()
    };

    // Make unique folder name
    let mut target_folder = raw_folder_name.clone();
    let mut counter = 1;
    while saves_dir.join(&target_folder).exists() {
        target_folder = format!("{raw_folder_name} ({counter})");
        counter += 1;
    }

    let dest_dir = saves_dir.join(&target_folder);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

    let prefix_to_strip = level_dat_prefix.filter(|p| !p.is_empty());

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let clean_name = match entry.enclosed_name() {
            Some(p) => p.to_string_lossy().replace('\\', "/"),
            None => continue, // ignore unsafe paths
        };

        let relative_path = if let Some(ref prefix) = prefix_to_strip {
            if let Some(stripped) = clean_name.strip_prefix(prefix) {
                stripped.trim_start_matches('/').to_string()
            } else {
                continue;
            }
        } else {
            clean_name
        };

        if relative_path.is_empty() {
            continue;
        }

        let out_path = crate::security::safe_join(&dest_dir, &relative_path)?;

        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut out_file = File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut out_file).map_err(|e| e.to_string())?;
        }
    }

    Ok(target_folder)
}

pub fn duplicate_world(
    app: &AppHandle,
    instance_id: &str,
    world_folder: &str,
    new_name: &str,
) -> Result<String, String> {
    if crate::runstate::is_instance_running(app, instance_id) {
        return Err(crate::runstate::BUSY_INSTANCE_MESSAGE.to_string());
    }

    let instance = crate::security::instance_dir(instance_id)?;
    let saves_dir = instance.join("saves");
    let src_dir = crate::security::safe_join(&saves_dir, world_folder)?;
    if !src_dir.exists() {
        return Err("Исходный мир не найден".to_string());
    }

    let safe_new = new_name
        .trim()
        .replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    if safe_new.is_empty() {
        return Err("Некорректное имя мира".to_string());
    }

    let mut dest_folder = safe_new.clone();
    let mut counter = 1;
    while saves_dir.join(&dest_folder).exists() {
        dest_folder = format!("{safe_new} ({counter})");
        counter += 1;
    }

    let dest_dir = saves_dir.join(&dest_folder);
    copy_dir_recursive(&src_dir, &dest_dir)?;

    Ok(dest_folder)
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        let target = dst.join(entry.file_name());
        if path.is_dir() {
            copy_dir_recursive(&path, &target)?;
        } else if path.is_file() {
            // Skip lock files
            if path.file_name().and_then(|n| n.to_str()) == Some("session.lock") {
                continue;
            }
            let _ = fs::copy(&path, &target);
        }
    }
    Ok(())
}

pub fn delete_world(app: &AppHandle, instance_id: &str, world_folder: &str) -> Result<(), String> {
    if crate::runstate::is_instance_running(app, instance_id) {
        return Err(crate::runstate::BUSY_INSTANCE_MESSAGE.to_string());
    }

    let instance = crate::security::instance_dir(instance_id)?;
    let world_dir = crate::security::safe_join(&instance.join("saves"), world_folder)?;
    if !world_dir.exists() {
        return Ok(());
    }

    fs::remove_dir_all(&world_dir).map_err(|e| format!("Не удалось удалить мир: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nbt_reader_skip_tags() {
        let data = [
            10u8, // compound
            0, 4, b'T', b'e', b's', b't', // name: "Test"
            1, 0, 1, b'b', 42, // byte "b" = 42
            3, 0, 1, b'i', 0, 0, 1, 0, // int "i" = 256
            8, 0, 1, b's', 0, 5, b'H', b'e', b'l', b'l', b'o', // string "s" = "Hello"
            0,    // end
        ];

        let mut reader = NbtReader::new(&data);
        assert_eq!(reader.read_u8(), Some(10));
        assert_eq!(reader.read_string(), Some("Test".to_string()));

        let mut meta = LevelDatMeta::default();
        assert!(reader.parse_compound_into(&mut meta, 0).is_some());
    }

    #[test]
    fn test_parse_real_world_if_present() {
        let path = std::path::PathBuf::from(
            r"C:\Users\artem\AppData\Roaming\RedPandaLauncher\fd\saves\Новый мир\level.dat",
        );
        if path.exists() {
            let meta = parse_level_dat(&path).expect("Failed to parse real level.dat");
            assert!(meta.level_name.is_some());
        }
    }

    fn build_synthetic_level_dat() -> Vec<u8> {
        // level.dat = gzipped NBT: root TAG_Compound (empty name) -> "Data" compound.
        let data = [
            // root TAG_Compound, пустое имя
            0x0A, 0x00, 0x00, // "Data" TAG_Compound, имя "Data" (4)
            0x0A, 0x00, 0x04, b'D', b'a', b't', b'a',
            // LevelName: TAG_String, имя "LevelName" (9), значение "My World" (8)
            0x08, 0x00, 0x09, b'L', b'e', b'v', b'e', b'l', b'N', b'a', b'm', b'e', 0x00, 0x08,
            b'M', b'y', b' ', b'W', b'o', b'r', b'l', b'd',
            // GameType: TAG_Int, имя "GameType" (8), значение 1
            0x03, 0x00, 0x08, b'G', b'a', b'm', b'e', b'T', b'y', b'p', b'e', 0x00, 0x00, 0x00,
            0x01, // hardcore: TAG_Byte, имя "hardcore" (8), значение 1
            0x01, 0x00, 0x08, b'h', b'a', b'r', b'd', b'c', b'o', b'r', b'e', 0x01,
            // LastPlayed: TAG_Long, имя "LastPlayed" (10), значение 1000
            0x04, 0x00, 0x0a, b'L', b'a', b's', b't', b'P', b'l', b'a', b'y', b'e', b'd', 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xe8,
            // RandomSeed: TAG_Long, имя "RandomSeed" (10), значение семени
            0x04, 0x00, 0x0a, b'R', b'a', b'n', b'd', b'o', b'm', b'S', b'e', b'e', b'd', 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x2a, 0x9d,
            // Version: TAG_Compound, имя "Version" (7)
            0x0A, 0x00, 0x07, b'V', b'e', b'r', b's', b'i', b'o', b'n',
            // Version.Name: TAG_String, имя "Name" (4), значение "1.21.4" (6)
            0x08, 0x00, 0x04, b'N', b'a', b'm', b'e', 0x00, 0x06, b'1', b'.', b'2', b'1', b'.',
            b'4', 0x00, // конец Version
            0x00, // конец Data
            0x00, // конец root
        ];
        data.to_vec()
    }

    #[test]
    fn test_parse_level_dat_synthetic() {
        use flate2::write::GzEncoder;
        use flate2::Compression;
        use std::io::Write;
        use tempfile::NamedTempFile;

        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(&build_synthetic_level_dat()).unwrap();
        let compressed = encoder.finish().unwrap();

        let file = NamedTempFile::new().unwrap();
        std::fs::write(file.path(), &compressed).unwrap();

        let meta = parse_level_dat(file.path()).expect("synthetic level.dat should parse");
        assert_eq!(meta.level_name, Some("My World".to_string()));
        assert_eq!(meta.game_type, Some(1));
        assert!(meta.is_hardcore);
        assert_eq!(meta.last_played_ms, Some(1000));
        assert!(meta.seed.is_some());
        assert_eq!(meta.version_name, Some("1.21.4".to_string()));
    }

    #[test]
    fn test_parse_level_dat_rejects_non_compound_root() {
        use flate2::write::GzEncoder;
        use flate2::Compression;
        use std::io::Write;
        use tempfile::NamedTempFile;

        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(&[0x01, 0x00, 0x00, 42]).unwrap(); // TAG_Byte корня — недопустимо
        let compressed = encoder.finish().unwrap();

        let file = NamedTempFile::new().unwrap();
        std::fs::write(file.path(), &compressed).unwrap();

        let err = parse_level_dat(file.path()).unwrap_err();
        assert!(err.contains("Root tag is not compound"));
    }
}
