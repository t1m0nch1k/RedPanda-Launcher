use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{Cursor, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process::Command;
#[cfg(windows)]
use std::thread;
#[cfg(windows)]
use std::time::Duration;

#[cfg(windows)]
use winreg::enums::*;
#[cfg(windows)]
use winreg::RegKey;

// Embedded payload zip (packaged during release build)
static PAYLOAD_BYTES: &[u8] = include_bytes!("../payload.zip");

const INSTALL_MANIFEST_FILE: &str = ".redpanda-install.json";
const INSTALL_MANIFEST_VERSION: u32 = 1;
const LAUNCHER_IDENTIFIER: &str = "com.t1m0nch1k.redpanda.launcher";
const MAX_MANIFEST_BYTES: u64 = 1024 * 1024;
const MAX_MANAGED_FILES: usize = 10_000;
const REQUIRED_MANAGED_FILES: [&str; 2] = ["redpanda-launcher.exe", "uninstall.exe"];

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
struct ManagedFile {
    path: String,
    size: u64,
    sha256: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
struct InstallManifest {
    format_version: u32,
    product_identifier: String,
    install_id: String,
    files: Vec<ManagedFile>,
}

#[derive(Clone, Debug)]
enum ExistingTarget {
    EmptyOrAbsent,
    Legacy,
    Installed(InstallManifest),
}

fn manifest_path(install_dir: &Path) -> PathBuf {
    install_dir.join(INSTALL_MANIFEST_FILE)
}

fn metadata_is_reparse_point(metadata: &fs::Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        metadata.file_attributes() & 0x0400 != 0
    }
    #[cfg(not(windows))]
    {
        false
    }
}

fn ensure_regular_file(path: &Path) -> Result<fs::Metadata, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Не удалось проверить файл {}: {error}", path.display()))?;
    if metadata_is_reparse_point(&metadata) || !metadata.is_file() {
        return Err(format!(
            "Ожидался обычный файл, но найден небезопасный путь: {}",
            path.display()
        ));
    }
    Ok(metadata)
}

fn ensure_directory(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Не удалось проверить каталог {}: {error}", path.display()))?;
    if metadata_is_reparse_point(&metadata) || !metadata.is_dir() {
        return Err(format!(
            "Ожидался обычный каталог, но найден небезопасный путь: {}",
            path.display()
        ));
    }
    Ok(())
}

fn relative_path(value: &str) -> Result<PathBuf, String> {
    if value.is_empty() {
        return Err("Манифест установки содержит пустой путь".to_string());
    }

    let path = Path::new(value);
    if path.is_absolute()
        || path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(format!(
            "Манифест установки содержит небезопасный путь: {value}"
        ));
    }
    Ok(path.to_path_buf())
}

fn manifest_path_key(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "/")
        .to_ascii_lowercase()
}

fn ensure_safe_path_components(root: &Path, relative: &Path) -> Result<(), String> {
    ensure_directory(root)?;
    let mut current = root.to_path_buf();
    for component in relative.components() {
        current.push(component.as_os_str());
        match fs::symlink_metadata(&current) {
            Ok(metadata) => {
                if metadata_is_reparse_point(&metadata) {
                    return Err(format!(
                        "Путь установки содержит символическую ссылку или reparse point: {}",
                        current.display()
                    ));
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(format!(
                    "Не удалось проверить путь установки {}: {error}",
                    current.display()
                ));
            }
        }
    }
    Ok(())
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path)
        .map_err(|error| format!("Не удалось прочитать {}: {error}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|error| format!("Не удалось прочитать {}: {error}", path.display()))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn validate_manifest(manifest: &InstallManifest) -> Result<(), String> {
    if manifest.format_version != INSTALL_MANIFEST_VERSION {
        return Err("Неподдерживаемая версия манифеста установки".to_string());
    }
    if manifest.product_identifier != LAUNCHER_IDENTIFIER {
        return Err("Манифест относится к другому приложению".to_string());
    }
    if uuid::Uuid::parse_str(&manifest.install_id).is_err() {
        return Err("Манифест установки содержит некорректный идентификатор".to_string());
    }
    if manifest.files.is_empty() || manifest.files.len() > MAX_MANAGED_FILES {
        return Err("Манифест установки содержит недопустимое число файлов".to_string());
    }

    let mut paths = HashSet::new();
    for file in &manifest.files {
        let relative = relative_path(&file.path)?;
        let key = manifest_path_key(&relative);
        if key == INSTALL_MANIFEST_FILE || !paths.insert(key) {
            return Err("Манифест установки содержит повторяющиеся или служебные пути".to_string());
        }
        if file.sha256.len() != 64 || !file.sha256.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err(format!("Некорректный SHA-256 в манифесте: {}", file.path));
        }
    }

    for required in REQUIRED_MANAGED_FILES {
        if !paths.contains(required) {
            return Err(format!("Манифест не содержит обязательный файл {required}"));
        }
    }
    Ok(())
}

fn read_install_manifest(install_dir: &Path) -> Result<InstallManifest, String> {
    ensure_directory(install_dir)?;
    let path = manifest_path(install_dir);
    let metadata = ensure_regular_file(&path)?;
    if metadata.len() > MAX_MANIFEST_BYTES {
        return Err("Манифест установки превышает допустимый размер".to_string());
    }
    let content = fs::read(&path)
        .map_err(|error| format!("Не удалось прочитать манифест установки: {error}"))?;
    let manifest: InstallManifest = serde_json::from_slice(&content)
        .map_err(|error| format!("Не удалось разобрать манифест установки: {error}"))?;
    validate_manifest(&manifest)?;

    for file in &manifest.files {
        let relative = relative_path(&file.path)?;
        ensure_safe_path_components(install_dir, &relative)?;
        let path = install_dir.join(&relative);
        let metadata = ensure_regular_file(&path)?;
        if metadata.len() != file.size {
            return Err(format!(
                "Размер файла установки не совпадает: {}",
                file.path
            ));
        }
        let actual_hash = sha256_file(&path)?;
        if !actual_hash.eq_ignore_ascii_case(&file.sha256) {
            return Err(format!(
                "Контрольная сумма файла установки не совпадает: {}",
                file.path
            ));
        }
    }

    Ok(manifest)
}

fn write_install_manifest(install_dir: &Path, manifest: &InstallManifest) -> Result<(), String> {
    validate_manifest(manifest)?;
    let content = serde_json::to_vec_pretty(manifest)
        .map_err(|error| format!("Не удалось подготовить манифест установки: {error}"))?;
    let path = manifest_path(install_dir);
    let mut file = File::create(&path)
        .map_err(|error| format!("Не удалось создать манифест установки: {error}"))?;
    file.write_all(&content)
        .map_err(|error| format!("Не удалось записать манифест установки: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("Не удалось сохранить манифест установки: {error}"))?;
    Ok(())
}

fn collect_managed_files(root: &Path) -> Result<Vec<ManagedFile>, String> {
    fn visit(root: &Path, directory: &Path, files: &mut Vec<ManagedFile>) -> Result<(), String> {
        ensure_directory(directory)?;
        for entry in fs::read_dir(directory)
            .map_err(|error| format!("Не удалось прочитать {}: {error}", directory.display()))?
        {
            let entry =
                entry.map_err(|error| format!("Не удалось прочитать файл установки: {error}"))?;
            let path = entry.path();
            let metadata = fs::symlink_metadata(&path)
                .map_err(|error| format!("Не удалось проверить {}: {error}", path.display()))?;
            if metadata_is_reparse_point(&metadata) {
                return Err(format!(
                    "Payload содержит символическую ссылку или reparse point: {}",
                    path.display()
                ));
            }
            if metadata.is_dir() {
                visit(root, &path, files)?;
                continue;
            }
            if !metadata.is_file() {
                return Err(format!(
                    "Payload содержит недопустимый объект: {}",
                    path.display()
                ));
            }
            let relative = path
                .strip_prefix(root)
                .map_err(|error| format!("Не удалось определить путь payload: {error}"))?;
            let path_text = relative.to_string_lossy().replace('\\', "/");
            if path_text.eq_ignore_ascii_case(INSTALL_MANIFEST_FILE) {
                return Err("Payload не может содержать служебный манифест установки".to_string());
            }
            files.push(ManagedFile {
                path: path_text,
                size: metadata.len(),
                sha256: sha256_file(&path)?,
            });
            if files.len() > MAX_MANAGED_FILES {
                return Err("Payload содержит слишком много файлов".to_string());
            }
        }
        Ok(())
    }

    let mut files = Vec::new();
    visit(root, root, &mut files)?;
    files.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(files)
}

fn create_install_manifest(
    staging_dir: &Path,
    install_id: String,
) -> Result<InstallManifest, String> {
    let manifest = InstallManifest {
        format_version: INSTALL_MANIFEST_VERSION,
        product_identifier: LAUNCHER_IDENTIFIER.to_string(),
        install_id,
        files: collect_managed_files(staging_dir)?,
    };
    validate_manifest(&manifest)?;
    Ok(manifest)
}

fn collect_relative_file_paths(root: &Path) -> Result<HashSet<String>, String> {
    fn visit(root: &Path, directory: &Path, files: &mut HashSet<String>) -> Result<(), String> {
        ensure_directory(directory)?;
        for entry in fs::read_dir(directory)
            .map_err(|error| format!("Не удалось прочитать {}: {error}", directory.display()))?
        {
            let entry =
                entry.map_err(|error| format!("Не удалось прочитать файл установки: {error}"))?;
            let path = entry.path();
            let metadata = fs::symlink_metadata(&path)
                .map_err(|error| format!("Не удалось проверить {}: {error}", path.display()))?;
            if metadata_is_reparse_point(&metadata) {
                return Err(format!(
                    "Каталог содержит символическую ссылку или reparse point: {}",
                    path.display()
                ));
            }
            if metadata.is_dir() {
                visit(root, &path, files)?;
                continue;
            }
            if !metadata.is_file() {
                return Err(format!(
                    "Каталог содержит недопустимый объект: {}",
                    path.display()
                ));
            }
            let relative = path
                .strip_prefix(root)
                .map_err(|error| format!("Не удалось определить относительный путь: {error}"))?;
            files.insert(manifest_path_key(relative));
        }
        Ok(())
    }

    let mut files = HashSet::new();
    visit(root, root, &mut files)?;
    Ok(files)
}

fn embedded_payload_file_paths() -> Result<HashSet<String>, String> {
    if PAYLOAD_BYTES.is_empty() {
        return Ok(HashSet::from(["redpanda-launcher.exe".to_string()]));
    }

    let cursor = Cursor::new(PAYLOAD_BYTES);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|error| format!("Не удалось открыть встроенный payload: {error}"))?;
    let mut files = HashSet::new();
    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|error| format!("Не удалось прочитать встроенный payload: {error}"))?;
        if entry.name().ends_with('/') {
            continue;
        }
        let relative = entry
            .enclosed_name()
            .ok_or_else(|| "Встроенный payload содержит небезопасный путь".to_string())?;
        files.insert(manifest_path_key(&relative));
    }
    Ok(files)
}

/// Older launcher releases did not write an install manifest. They can still
/// be upgraded when the selected directory contains exactly the files from
/// the embedded payload plus the previous uninstaller, with no user files.
fn is_legacy_install(target: &Path) -> bool {
    let Ok(actual) = collect_relative_file_paths(target) else {
        return false;
    };
    let Ok(mut expected) = embedded_payload_file_paths() else {
        return false;
    };
    expected.insert("uninstall.exe".to_string());
    actual == expected
}

fn directory_is_empty(path: &Path) -> Result<bool, String> {
    ensure_directory(path)?;
    let mut entries = fs::read_dir(path)
        .map_err(|error| format!("Не удалось прочитать каталог {}: {error}", path.display()))?;
    Ok(entries.next().is_none())
}

fn inspect_target(target: &Path) -> Result<ExistingTarget, String> {
    match fs::symlink_metadata(target) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            Ok(ExistingTarget::EmptyOrAbsent)
        }
        Err(error) => Err(format!("Не удалось проверить путь установки: {error}")),
        Ok(_) => {
            ensure_directory(target)?;
            if directory_is_empty(target)? {
                return Ok(ExistingTarget::EmptyOrAbsent);
            }
            if is_legacy_install(target) {
                return Ok(ExistingTarget::Legacy);
            }
            read_install_manifest(target)
                .map(ExistingTarget::Installed)
                .map_err(|error| {
                    format!(
                        "Выбранная папка уже содержит файлы, не принадлежащие проверенной установке RedPanda Launcher: {error}. Выберите пустую отдельную папку."
                    )
                })
        }
    }
}

fn managed_relative_paths(manifest: &InstallManifest) -> Result<Vec<PathBuf>, String> {
    let mut paths = manifest
        .files
        .iter()
        .map(|file| relative_path(&file.path))
        .collect::<Result<Vec<_>, _>>()?;
    paths.push(PathBuf::from(INSTALL_MANIFEST_FILE));
    Ok(paths)
}

fn create_target_parent(target: &Path) -> Result<&Path, String> {
    let parent = target
        .parent()
        .ok_or_else(|| "Не удалось определить родительскую папку установки".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Не удалось создать родительскую папку установки: {error}"))?;
    ensure_directory(parent)?;
    Ok(parent)
}

fn publish_new_install(staging_dir: &Path, target: &Path) -> Result<(), String> {
    match fs::symlink_metadata(target) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("Не удалось проверить путь установки: {error}")),
        Ok(_) => {
            ensure_directory(target)?;
            if !directory_is_empty(target)? {
                return Err(
                    "Папка установки изменилась во время подготовки и больше не пуста. Файлы не были затронуты."
                        .to_string(),
                );
            }
            fs::remove_dir(target).map_err(|error| {
                format!("Не удалось освободить пустую папку установки: {error}")
            })?;
        }
    }
    fs::rename(staging_dir, target)
        .map_err(|error| format!("Не удалось применить установку: {error}"))?;
    Ok(())
}

fn publish_legacy_install(staging_dir: &Path, target: &Path) -> Result<(), String> {
    if !is_legacy_install(target) {
        return Err(
            "Содержимое старой установки изменилось во время подготовки. Файлы не были затронуты; повторите попытку."
                .to_string(),
        );
    }
    let parent = target
        .parent()
        .ok_or_else(|| "Не удалось определить родительскую папку установки".to_string())?;
    let backup = tempfile::Builder::new()
        .prefix("redpanda-legacy-backup-")
        .tempdir_in(parent)
        .map_err(|error| format!("Не удалось подготовить замену старой установки: {error}"))?;
    let backup_target = backup.path().join("old-install");
    fs::rename(target, &backup_target)
        .map_err(|error| format!("Не удалось сохранить старую установку: {error}"))?;

    if let Err(error) = fs::rename(staging_dir, target) {
        let rollback = fs::rename(&backup_target, target);
        return match rollback {
            Ok(()) => Err(format!(
                "Не удалось применить обновление старой установки: {error}. Предыдущая версия восстановлена."
            )),
            Err(rollback_error) => Err(format!(
                "Не удалось применить обновление старой установки: {error}. Также не удалось восстановить предыдущую версию: {rollback_error}"
            )),
        };
    }

    if let Err(error) = fs::remove_dir_all(&backup_target) {
        log::warn!(
            "Новая установка применена, но резервная копия старой версии не удалена: {error}"
        );
    }
    Ok(())
}

fn copy_file_from_staging(
    staging_dir: &Path,
    target: &Path,
    relative: &Path,
) -> Result<(), String> {
    ensure_safe_path_components(target, relative)?;
    let source = staging_dir.join(relative);
    ensure_regular_file(&source)?;
    let destination = target.join(relative);
    if destination.exists() {
        return Err(format!(
            "Невозможно обновить файл, потому что он уже существует: {}",
            relative.display()
        ));
    }
    let parent = destination
        .parent()
        .ok_or_else(|| "Не удалось определить каталог файла установки".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Не удалось создать каталог установки: {error}"))?;
    ensure_safe_path_components(target, relative)?;
    fs::copy(&source, &destination)
        .map_err(|error| format!("Не удалось обновить {}: {error}", relative.display()))?;
    Ok(())
}

fn remove_empty_parent_directories(target: &Path, paths: &[PathBuf]) {
    let mut directories = HashSet::new();
    for path in paths {
        let mut parent = path.parent();
        while let Some(directory) = parent {
            if directory.as_os_str().is_empty() {
                break;
            }
            directories.insert(directory.to_path_buf());
            parent = directory.parent();
        }
    }
    let mut directories = directories.into_iter().collect::<Vec<_>>();
    directories.sort_by_key(|path| std::cmp::Reverse(path.components().count()));
    for directory in directories {
        let absolute = target.join(directory);
        let _ = fs::remove_dir(absolute);
    }
}

fn rollback_update(
    target: &Path,
    moved_files: &[(PathBuf, PathBuf)],
    copied_files: &[PathBuf],
) -> Result<(), String> {
    let mut errors = Vec::new();
    for relative in copied_files.iter().rev() {
        let path = target.join(relative);
        if let Err(error) = fs::remove_file(&path) {
            if error.kind() != std::io::ErrorKind::NotFound {
                errors.push(format!("{}: {error}", path.display()));
            }
        }
    }
    for (relative, backup) in moved_files.iter().rev() {
        if backup.exists() {
            let destination = target.join(relative);
            if let Some(parent) = destination.parent() {
                if let Err(error) = fs::create_dir_all(parent) {
                    errors.push(format!("{}: {error}", parent.display()));
                    continue;
                }
            }
            if let Err(error) = fs::rename(backup, &destination) {
                errors.push(format!("{}: {error}", destination.display()));
            }
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

fn publish_update(
    staging_dir: &Path,
    target: &Path,
    expected_manifest: &InstallManifest,
    new_manifest: &InstallManifest,
) -> Result<(), String> {
    let current_manifest = read_install_manifest(target)?;
    if current_manifest != *expected_manifest {
        return Err(
            "Установка изменилась во время обновления. Файлы не были затронуты; повторите попытку."
                .to_string(),
        );
    }
    if new_manifest.install_id != current_manifest.install_id {
        return Err("Обновление пытается изменить идентификатор установки".to_string());
    }
    read_install_manifest(staging_dir)?;

    let old_paths = managed_relative_paths(&current_manifest)?;
    let new_paths = managed_relative_paths(new_manifest)?;
    let old_keys = old_paths
        .iter()
        .map(|path| manifest_path_key(path))
        .collect::<HashSet<_>>();
    for relative in &new_paths {
        ensure_safe_path_components(target, relative)?;
        let destination = target.join(relative);
        if destination.exists() && !old_keys.contains(&manifest_path_key(relative)) {
            return Err(format!(
                "Обновление остановлено: файл {} не принадлежит предыдущей установке",
                relative.display()
            ));
        }
    }

    let parent = target
        .parent()
        .ok_or_else(|| "Не удалось определить родительскую папку установки".to_string())?;
    let backup = tempfile::Builder::new()
        .prefix("redpanda-update-backup-")
        .tempdir_in(parent)
        .map_err(|error| format!("Не удалось создать резервную копию обновления: {error}"))?;
    let backup_root = backup.path().join("files");
    let mut moved_files = Vec::new();
    let mut copied_files = Vec::new();

    let apply_result = (|| -> Result<(), String> {
        for relative in &old_paths {
            let source = target.join(relative);
            if !source.exists() {
                continue;
            }
            ensure_safe_path_components(target, relative)?;
            ensure_regular_file(&source)?;
            let backup_path = backup_root.join(relative);
            if let Some(parent) = backup_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("Не удалось создать резервную копию: {error}"))?;
            }
            fs::rename(&source, &backup_path).map_err(|error| {
                format!(
                    "Не удалось сохранить предыдущий файл {}: {error}",
                    relative.display()
                )
            })?;
            moved_files.push((relative.clone(), backup_path));
        }
        for relative in &new_paths {
            copy_file_from_staging(staging_dir, target, relative)?;
            copied_files.push(relative.clone());
        }
        Ok(())
    })();

    if let Err(error) = apply_result {
        let rollback = rollback_update(target, &moved_files, &copied_files);
        return match rollback {
            Ok(()) => Err(format!("Не удалось применить обновление: {error}. Предыдущая версия восстановлена.")),
            Err(rollback_error) => Err(format!(
                "Не удалось применить обновление: {error}. Также не удалось полностью восстановить предыдущую версию: {rollback_error}"
            )),
        };
    }

    remove_empty_parent_directories(target, &old_paths);
    Ok(())
}

fn launcher_user_data_paths(data_dir: &Path, local_data_dir: &Path) -> Vec<PathBuf> {
    vec![
        data_dir.join(LAUNCHER_IDENTIFIER),
        local_data_dir.join(LAUNCHER_IDENTIFIER),
        // Folders used by pre-manifest releases. Keep these for a complete clean uninstall.
        data_dir.join("RedPandaLauncher"),
        local_data_dir.join("redpanda-launcher"),
    ]
}

fn remove_user_data(data_dir: &Path, local_data_dir: &Path) -> Result<(), String> {
    for path in launcher_user_data_paths(data_dir, local_data_dir) {
        if let Err(error) = fs::remove_dir_all(&path) {
            if error.kind() != std::io::ErrorKind::NotFound {
                return Err(format!(
                    "Не удалось удалить пользовательские данные {}: {error}",
                    path.display()
                ));
            }
        }
    }
    Ok(())
}

#[cfg(windows)]
fn installed_location_from_registry() -> Result<Option<PathBuf>, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = Path::new("Software")
        .join("Microsoft")
        .join("Windows")
        .join("CurrentVersion")
        .join("Uninstall")
        .join("RedPandaLauncher");
    let key = match hkcu.open_subkey(&path) {
        Ok(key) => key,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(format!(
                "Не удалось прочитать запись деинсталлятора: {error}"
            ))
        }
    };
    let location: String = key
        .get_value("InstallLocation")
        .map_err(|error| format!("Не удалось прочитать путь установки из реестра: {error}"))?;
    if location.trim().is_empty() {
        return Err("Реестр содержит пустой путь установки".to_string());
    }
    Ok(Some(PathBuf::from(location)))
}

#[cfg(windows)]
fn paths_match(left: &Path, right: &Path) -> Result<bool, String> {
    let left = fs::canonicalize(left).map_err(|error| {
        format!(
            "Не удалось проверить путь установки {}: {error}",
            left.display()
        )
    })?;
    let right = fs::canonicalize(right).map_err(|error| {
        format!(
            "Не удалось проверить путь деинсталлятора {}: {error}",
            right.display()
        )
    })?;
    Ok(left
        .to_string_lossy()
        .eq_ignore_ascii_case(&right.to_string_lossy()))
}

fn active_installation_for_uninstall() -> Result<(PathBuf, InstallManifest), String> {
    let executable = std::env::current_exe()
        .map_err(|error| format!("Не удалось определить путь к деинсталлятору: {error}"))?;
    let file_name = executable
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Не удалось определить имя деинсталлятора".to_string())?;
    if !file_name.eq_ignore_ascii_case("uninstall.exe") {
        return Err(
            "Деинсталлятор должен запускаться из файла uninstall.exe установленной копии"
                .to_string(),
        );
    }
    let install_dir = executable
        .parent()
        .ok_or_else(|| "Не удалось определить папку деинсталлятора".to_string())?
        .to_path_buf();
    let manifest = read_install_manifest(&install_dir)?;

    #[cfg(windows)]
    if let Some(registered_location) = installed_location_from_registry()? {
        if !paths_match(&install_dir, &registered_location)? {
            return Err(
                "Путь деинсталлятора не совпадает с InstallLocation в реестре. Файлы не были удалены."
                    .to_string(),
            );
        }
    }

    Ok((install_dir, manifest))
}

#[cfg(windows)]
fn powershell_literal(value: &Path) -> String {
    value.to_string_lossy().replace('\'', "''")
}

#[cfg(windows)]
fn schedule_managed_file_cleanup(
    install_dir: &Path,
    manifest: &InstallManifest,
) -> Result<(), String> {
    use base64::Engine;
    use std::os::windows::process::CommandExt;

    let files = managed_relative_paths(manifest)?;
    let mut script = format!(
        "$ErrorActionPreference = 'SilentlyContinue'\nWait-Process -Id {} -ErrorAction SilentlyContinue\nStart-Sleep -Milliseconds 200\n",
        std::process::id()
    );
    for relative in &files {
        script.push_str(&format!(
            "Remove-Item -LiteralPath '{}' -Force -ErrorAction SilentlyContinue\n",
            powershell_literal(&install_dir.join(relative))
        ));
    }

    let mut directories = HashSet::new();
    for relative in &files {
        let mut parent = relative.parent();
        while let Some(directory) = parent {
            if directory.as_os_str().is_empty() {
                break;
            }
            directories.insert(directory.to_path_buf());
            parent = directory.parent();
        }
    }
    let mut directories = directories.into_iter().collect::<Vec<_>>();
    directories.sort_by_key(|path| std::cmp::Reverse(path.components().count()));
    for directory in directories {
        script.push_str(&format!(
            "Remove-Item -LiteralPath '{}' -Force -ErrorAction SilentlyContinue\n",
            powershell_literal(&install_dir.join(directory))
        ));
    }
    // This is intentionally not recursive: user-created files keep the folder alive.
    script.push_str(&format!(
        "Remove-Item -LiteralPath '{}' -Force -ErrorAction SilentlyContinue\n",
        powershell_literal(install_dir)
    ));

    let mut utf16 = Vec::with_capacity(script.len() * 2);
    for unit in script.encode_utf16() {
        utf16.extend_from_slice(&unit.to_le_bytes());
    }
    let encoded = base64::engine::general_purpose::STANDARD.encode(utf16);
    let mut command = Command::new("powershell.exe");
    command.args([
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        &encoded,
    ]);
    command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    command
        .spawn()
        .map_err(|error| format!("Не удалось запланировать очистку файлов: {error}"))?;
    Ok(())
}

#[cfg(not(windows))]
fn remove_managed_files_now(install_dir: &Path, manifest: &InstallManifest) -> Result<(), String> {
    let files = managed_relative_paths(manifest)?;
    for relative in &files {
        let path = install_dir.join(relative);
        if let Err(error) = fs::remove_file(&path) {
            if error.kind() != std::io::ErrorKind::NotFound {
                return Err(format!(
                    "Не удалось удалить файл {}: {error}",
                    path.display()
                ));
            }
        }
    }
    remove_empty_parent_directories(install_dir, &files);
    let _ = fs::remove_dir(install_dir);
    Ok(())
}

fn directory_size(path: &Path) -> std::io::Result<u64> {
    let mut total = 0u64;
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let metadata = fs::symlink_metadata(entry.path())?;
        if metadata.file_type().is_symlink() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Установка содержит символическую ссылку",
            ));
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if metadata.file_attributes() & 0x0400 != 0 {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "Установка содержит reparse point",
                ));
            }
        }
        if metadata.is_dir() {
            total = total.saturating_add(directory_size(&entry.path())?);
        } else {
            total = total.saturating_add(metadata.len());
        }
    }
    Ok(total)
}

#[cfg(windows)]
fn available_space(path: &Path) -> Result<u64, String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let mut free_bytes = 0u64;
    let ok = unsafe {
        GetDiskFreeSpaceExW(
            wide.as_ptr(),
            &mut free_bytes,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    if ok == 0 {
        return Err(format!(
            "Не удалось проверить свободное место: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(free_bytes)
}

#[cfg(windows)]
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

#[tauri::command]
pub fn is_uninstall_mode() -> bool {
    std::env::args().any(|a| a == "--uninstall")
}

#[tauri::command]
pub fn get_default_install_dir() -> Result<String, String> {
    let local_data = dirs::data_local_dir().ok_or("Cannot determine local appdata directory")?;
    let path = local_data.join("Programs").join("RedPanda Launcher");
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn close_running_launcher() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use std::os::windows::process::CommandExt;
        use windows_sys::Win32::Foundation::{CloseHandle, ERROR_FILE_NOT_FOUND};
        use windows_sys::Win32::System::Threading::{OpenEventW, SetEvent, EVENT_MODIFY_STATE};

        let name: Vec<u16> = std::ffi::OsStr::new("Local\\RedPandaLauncher.GracefulShutdown")
            .encode_wide()
            .chain(Some(0))
            .collect();
        let event = unsafe { OpenEventW(EVENT_MODIFY_STATE, 0, name.as_ptr()) };
        if event.is_null() {
            let error = std::io::Error::last_os_error();
            if error.raw_os_error() == Some(ERROR_FILE_NOT_FOUND as i32) {
                // Older launchers did not expose the graceful-shutdown event.
                // Never terminate all matching processes from the installer: if
                // one is still running, ask the user to close that exact copy.
                let mut probe = Command::new("tasklist");
                probe.args([
                    "/FI",
                    "IMAGENAME eq redpanda-launcher.exe",
                    "/FO",
                    "CSV",
                    "/NH",
                ]);
                probe.creation_flags(0x08000000);
                let output = probe
                    .output()
                    .map_err(|e| format!("Не удалось проверить запущенный launcher: {e}"))?;
                let running = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .any(|line| line.to_ascii_lowercase().contains("redpanda-launcher.exe"));
                if running {
                    return Err(
                        "Обнаружен старый launcher без поддержки безопасного закрытия. Закройте его вручную и повторите установку."
                            .to_string(),
                    );
                }
                return Ok(());
            }
            return Err(format!("Не удалось найти канал закрытия launcher: {error}"));
        }
        let signaled = unsafe { SetEvent(event) } != 0;
        unsafe { CloseHandle(event) };
        if !signaled {
            return Err(format!(
                "Не удалось отправить команду закрытия launcher: {}",
                std::io::Error::last_os_error()
            ));
        }

        // Wait until the named event disappears after the launcher closes it.
        for _ in 0..100 {
            thread::sleep(Duration::from_millis(100));
            let probe = unsafe { OpenEventW(EVENT_MODIFY_STATE, 0, name.as_ptr()) };
            if probe.is_null() {
                return Ok(());
            }
            unsafe { CloseHandle(probe) };
        }
        Err(
            "Launcher не завершился за 10 секунд. Закройте его вручную и повторите установку."
                .to_string(),
        )
    }

    #[cfg(not(windows))]
    {
        Ok(())
    }
}

#[tauri::command]
pub async fn extract_payload(target_dir: String) -> Result<(), String> {
    let target = PathBuf::from(&target_dir);
    if !target.is_absolute() {
        return Err("Путь установки должен быть абсолютным".to_string());
    }
    if target.file_name().is_none() {
        return Err("Нельзя устанавливать приложение в корень диска".to_string());
    }
    let parent = create_target_parent(&target)?;
    let target_state = inspect_target(&target)?;
    #[cfg(windows)]
    if available_space(parent)? < PAYLOAD_BYTES.len() as u64 + 50 * 1024 * 1024 {
        return Err("Недостаточно свободного места для установки".to_string());
    }
    let staging = tempfile::Builder::new()
        .prefix("redpanda-install-")
        .tempdir_in(parent)
        .map_err(|e| format!("Не удалось создать staging-каталог установки: {e}"))?;
    let staging_path = staging.path().to_path_buf();

    // If payload is not empty, extract zip
    if !PAYLOAD_BYTES.is_empty() {
        let cursor = Cursor::new(PAYLOAD_BYTES);
        let mut archive = zip::ZipArchive::new(cursor)
            .map_err(|e| format!("Failed to open embedded zip archive: {}", e))?;

        if archive.len() > 10_000 {
            return Err("Embedded payload contains too many files".to_string());
        }
        let mut unpacked_size = 0u64;
        for index in 0..archive.len() {
            let entry = archive.by_index(index).map_err(|e| e.to_string())?;
            unpacked_size = unpacked_size
                .checked_add(entry.size())
                .ok_or_else(|| "Embedded payload size overflow".to_string())?;
            if unpacked_size > 8 * 1024 * 1024 * 1024 {
                return Err("Embedded payload exceeds the 8 GB limit".to_string());
            }
            if entry.compressed_size() > 0 && entry.size() / entry.compressed_size() > 1_000 {
                return Err("Embedded payload contains suspicious compression".to_string());
            }
        }

        let mut extracted_paths = HashSet::new();
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let relative = match file.enclosed_name() {
                Some(path) => path.to_path_buf(),
                None => {
                    return Err("Embedded payload contains an unsafe file path".to_string());
                }
            };
            let relative_text = relative.to_string_lossy().replace('\\', "/");
            let relative = relative_path(&relative_text)
                .map_err(|_| "Embedded payload contains an unsafe file path".to_string())?;
            if relative
                .to_string_lossy()
                .replace('\\', "/")
                .eq_ignore_ascii_case(INSTALL_MANIFEST_FILE)
            {
                return Err("Embedded payload cannot replace the installation manifest".to_string());
            }
            let path_key = manifest_path_key(&relative);
            if !extracted_paths.insert(path_key) {
                return Err("Embedded payload contains duplicate file paths".to_string());
            }
            let outpath = staging_path.join(&relative);

            if file.name().ends_with('/') {
                fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(p).map_err(|e| e.to_string())?;
                    }
                }
                if file.size() > 1024 * 1024 * 1024 {
                    return Err("A payload file exceeds the 1 GB limit".to_string());
                }
                let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
                let copied = std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
                if copied != file.size() {
                    return Err(
                        "Embedded payload ended before the file was fully extracted".to_string()
                    );
                }
                outfile.flush().map_err(|e| e.to_string())?;
            }
        }
    } else {
        // Dev fallback: copy from workspace target/release if payload.zip is empty during development
        let exe_path = Path::new("../../src-tauri/target/release/redpanda-launcher.exe");
        if exe_path.exists() {
            let dest_exe = staging_path.join("redpanda-launcher.exe");
            fs::copy(exe_path, dest_exe).map_err(|e| format!("Failed to copy exe: {}", e))?;
        }
    }

    // The installer itself is a managed file. A missing copy would make the
    // manifest incomplete, so do not silently continue when it cannot be read.
    let current_exe = std::env::current_exe()
        .map_err(|error| format!("Не удалось определить путь к установщику: {error}"))?;
    let uninstall_dest = staging_path.join("uninstall.exe");
    fs::copy(current_exe, uninstall_dest)
        .map_err(|error| format!("Не удалось скопировать деинсталлятор: {error}"))?;

    let install_id = match &target_state {
        ExistingTarget::EmptyOrAbsent | ExistingTarget::Legacy => uuid::Uuid::new_v4().to_string(),
        ExistingTarget::Installed(manifest) => manifest.install_id.clone(),
    };
    let manifest = create_install_manifest(&staging_path, install_id)?;
    write_install_manifest(&staging_path, &manifest)?;
    // Verify the complete staged tree before it is ever published.
    read_install_manifest(&staging_path)?;

    match target_state {
        ExistingTarget::EmptyOrAbsent => publish_new_install(&staging_path, &target)?,
        ExistingTarget::Legacy => publish_legacy_install(&staging_path, &target)?,
        ExistingTarget::Installed(existing_manifest) => {
            publish_update(&staging_path, &target, &existing_manifest, &manifest)?
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn create_desktop_shortcut(target_dir: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let desktop = dirs::desktop_dir().ok_or("Cannot find Desktop folder")?;
        let link_path = desktop.join("RedPanda Launcher.lnk");
        let target_exe = PathBuf::from(&target_dir).join("redpanda-launcher.exe");

        let script = format!(
            "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('{}'); $s.TargetPath = '{}'; $s.WorkingDirectory = '{}'; $s.IconLocation = '{},0'; $s.Save();",
            link_path.to_string_lossy().replace('\'', "''"),
            target_exe.to_string_lossy().replace('\'', "''"),
            target_dir.replace('\'', "''"),
            target_exe.to_string_lossy().replace('\'', "''"),
        );

        let mut cmd = Command::new("powershell");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        let output = cmd
            .output()
            .map_err(|e| format!("Failed to create desktop shortcut: {}", e))?;
        if !output.status.success() {
            return Err(format!(
                "Failed to create desktop shortcut: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn create_start_menu_shortcut(target_dir: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let local_data = dirs::data_dir().ok_or("Cannot find AppData Roaming")?;
        let start_menu = local_data
            .join("Microsoft")
            .join("Windows")
            .join("Start Menu")
            .join("Programs");
        fs::create_dir_all(&start_menu)
            .map_err(|e| format!("Failed to create Start Menu folder: {e}"))?;

        let link_path = start_menu.join("RedPanda Launcher.lnk");
        let target_exe = PathBuf::from(&target_dir).join("redpanda-launcher.exe");

        let script = format!(
            "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('{}'); $s.TargetPath = '{}'; $s.WorkingDirectory = '{}'; $s.IconLocation = '{},0'; $s.Save();",
            link_path.to_string_lossy().replace('\'', "''"),
            target_exe.to_string_lossy().replace('\'', "''"),
            target_dir.replace('\'', "''"),
            target_exe.to_string_lossy().replace('\'', "''"),
        );

        let mut cmd = Command::new("powershell");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        let output = cmd
            .output()
            .map_err(|e| format!("Failed to create start menu shortcut: {}", e))?;
        if !output.status.success() {
            return Err(format!(
                "Failed to create start menu shortcut: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn register_uninstaller(target_dir: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let target = PathBuf::from(&target_dir);
        read_install_manifest(&target)
            .map_err(|error| format!("Нельзя зарегистрировать непроверенную установку: {error}"))?;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let path = Path::new("Software")
            .join("Microsoft")
            .join("Windows")
            .join("CurrentVersion")
            .join("Uninstall")
            .join("RedPandaLauncher");

        let (key, _) = hkcu
            .create_subkey(&path)
            .map_err(|e| format!("Failed to create registry key: {}", e))?;

        let exe_path = target.join("redpanda-launcher.exe");
        let uninstall_exe = target.join("uninstall.exe");

        key.set_value("DisplayName", &"RedPanda Launcher")
            .map_err(|e| e.to_string())?;
        key.set_value("DisplayVersion", &APP_VERSION)
            .map_err(|e| e.to_string())?;
        key.set_value("Publisher", &"RedPanda Team")
            .map_err(|e| e.to_string())?;
        key.set_value("DisplayIcon", &format!("{},0", exe_path.to_string_lossy()))
            .map_err(|e| e.to_string())?;
        key.set_value("InstallLocation", &target_dir)
            .map_err(|e| e.to_string())?;
        key.set_value(
            "UninstallString",
            &format!("\"{}\" --uninstall", uninstall_exe.to_string_lossy()),
        )
        .map_err(|e| e.to_string())?;
        key.set_value(
            "QuietUninstallString",
            &format!(
                "\"{}\" --uninstall --quiet",
                uninstall_exe.to_string_lossy()
            ),
        )
        .map_err(|e| e.to_string())?;
        let installed_size = directory_size(&target)
            .map_err(|e| format!("Failed to calculate installed size: {e}"))?;
        let size: u32 = (installed_size / 1024).min(u32::MAX as u64) as u32;
        key.set_value("EstimatedSize", &size)
            .map_err(|e| e.to_string())?;
        let no_val: u32 = 1;
        key.set_value("NoModify", &no_val)
            .map_err(|e| e.to_string())?;
        key.set_value("NoRepair", &no_val)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn remove_shortcuts() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(desktop) = dirs::desktop_dir() {
            let link = desktop.join("RedPanda Launcher.lnk");
            if let Err(error) = fs::remove_file(link) {
                if error.kind() != std::io::ErrorKind::NotFound {
                    return Err(format!("Failed to remove desktop shortcut: {error}"));
                }
            }
        }
        if let Some(local_data) = dirs::data_dir() {
            let start_menu = local_data
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs");
            let link = start_menu.join("RedPanda Launcher.lnk");
            if let Err(error) = fs::remove_file(link) {
                if error.kind() != std::io::ErrorKind::NotFound {
                    return Err(format!("Failed to remove Start Menu shortcut: {error}"));
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn unregister_uninstaller() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let path = Path::new("Software")
            .join("Microsoft")
            .join("Windows")
            .join("CurrentVersion")
            .join("Uninstall");

        if let Ok(uninstall_key) = hkcu.open_subkey_with_flags(&path, KEY_WRITE) {
            if let Err(error) = uninstall_key.delete_subkey_all("RedPandaLauncher") {
                if error.kind() != std::io::ErrorKind::NotFound {
                    return Err(format!(
                        "Failed to remove uninstall registry entry: {error}"
                    ));
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn uninstall_files(clean_user_data: bool) -> Result<(), String> {
    let (install_dir, manifest) = active_installation_for_uninstall()?;

    if clean_user_data {
        let data_dir = dirs::data_dir().ok_or("Не удалось определить AppData")?;
        let local_data_dir = dirs::data_local_dir().ok_or("Не удалось определить LocalAppData")?;
        remove_user_data(&data_dir, &local_data_dir)?;
    }

    #[cfg(target_os = "windows")]
    {
        schedule_managed_file_cleanup(&install_dir, &manifest)?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        remove_managed_files_now(&install_dir, &manifest)?;
    }

    Ok(())
}

#[tauri::command]
pub fn close_window(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn minimize_window(app: tauri::AppHandle) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.minimize();
    }
}

#[tauri::command]
pub async fn launch_app(app: tauri::AppHandle, target_dir: String) -> Result<(), String> {
    let exe = PathBuf::from(&target_dir).join("redpanda-launcher.exe");
    if !exe.exists() {
        return Err("Executable not found".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = Command::new(&exe);
        cmd.current_dir(&target_dir);
        cmd.creation_flags(0x08000000);
        cmd.spawn()
            .map_err(|e| format!("Failed to spawn launcher: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = Command::new(&exe);
        cmd.current_dir(&target_dir);
        cmd.spawn()
            .map_err(|e| format!("Failed to spawn launcher: {}", e))?;
    }

    // Exit installer process
    app.exit(0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        create_install_manifest, directory_size, embedded_payload_file_paths, inspect_target,
        is_legacy_install, launcher_user_data_paths, managed_relative_paths, publish_update,
        read_install_manifest, write_install_manifest, ExistingTarget, InstallManifest,
    };
    use std::fs;
    use std::path::Path;

    fn write_file(root: &Path, relative: &str, contents: &[u8]) {
        let path = root.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("parent directory");
        }
        fs::write(path, contents).expect("fixture file");
    }

    fn create_verified_install(root: &Path, additional_files: &[(&str, &[u8])]) -> InstallManifest {
        write_file(root, "redpanda-launcher.exe", b"launcher");
        write_file(root, "uninstall.exe", b"uninstaller");
        for (path, contents) in additional_files {
            write_file(root, path, contents);
        }
        let manifest =
            create_install_manifest(root, uuid::Uuid::new_v4().to_string()).expect("manifest");
        write_install_manifest(root, &manifest).expect("write manifest");
        manifest
    }

    #[test]
    fn calculates_installed_size_recursively() {
        let directory = tempfile::tempdir().expect("tempdir");
        fs::create_dir(directory.path().join("nested")).expect("nested");
        fs::write(directory.path().join("a.bin"), [1u8, 2, 3]).expect("a");
        fs::write(directory.path().join("nested").join("b.bin"), [4u8; 7]).expect("b");
        assert_eq!(directory_size(directory.path()).expect("size"), 10);
    }

    #[test]
    fn rejects_nonempty_folder_without_a_verified_manifest_without_touching_its_files() {
        let root = tempfile::tempdir().expect("tempdir");
        let target = root.path().join("chosen-folder");
        fs::create_dir(&target).expect("target");
        let sentinel = target.join("do-not-delete.txt");
        fs::write(&sentinel, b"user data").expect("sentinel");

        let error = inspect_target(&target).expect_err("unmanaged folder must be rejected");

        assert!(error.contains("не принадлежащие"));
        assert_eq!(fs::read(&sentinel).expect("sentinel remains"), b"user data");
    }

    #[test]
    fn recognizes_only_the_known_manifestless_legacy_layout() {
        let root = tempfile::tempdir().expect("tempdir");
        let payload_files = embedded_payload_file_paths().expect("payload paths");
        for relative in payload_files {
            let path = root.path().join(&relative);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).expect("payload parent");
            }
            fs::write(path, []).expect("payload file");
        }
        fs::write(root.path().join("uninstall.exe"), []).expect("uninstaller");

        assert!(is_legacy_install(root.path()));
        fs::write(root.path().join("user-file.txt"), b"keep me").expect("sentinel");
        assert!(!is_legacy_install(root.path()));
    }

    #[test]
    fn verified_manifest_only_marks_its_own_files_for_removal() {
        let root = tempfile::tempdir().expect("tempdir");
        let manifest = create_verified_install(root.path(), &[("assets/icon.png", b"icon")]);
        let sentinel = root.path().join("notes.txt");
        fs::write(&sentinel, b"personal note").expect("sentinel");

        let inspected = inspect_target(root.path()).expect("verified install");
        match inspected {
            ExistingTarget::Installed(found) => assert_eq!(found, manifest),
            ExistingTarget::EmptyOrAbsent | ExistingTarget::Legacy => {
                panic!("expected an installed target")
            }
        }

        let paths = managed_relative_paths(&manifest).expect("managed paths");
        assert!(paths.iter().all(|path| path != Path::new("notes.txt")));
        assert!(paths
            .iter()
            .any(|path| path == Path::new("assets/icon.png")));
        assert!(paths
            .iter()
            .any(|path| path == Path::new(".redpanda-install.json")));
        assert_eq!(
            fs::read(sentinel).expect("sentinel remains"),
            b"personal note"
        );
    }

    #[test]
    fn update_preserves_unmanaged_files_and_removes_only_obsolete_managed_files() {
        let root = tempfile::tempdir().expect("tempdir");
        let target = root.path().join("installed");
        let staging = root.path().join("staging");
        fs::create_dir(&target).expect("target");
        fs::create_dir(&staging).expect("staging");

        let old_manifest = create_verified_install(&target, &[("obsolete.dll", b"old")]);
        let sentinel = target.join("savegames/keep.txt");
        write_file(&target, "savegames/keep.txt", b"user-owned");

        write_file(&staging, "redpanda-launcher.exe", b"updated-launcher");
        write_file(&staging, "uninstall.exe", b"updated-uninstaller");
        write_file(&staging, "assets/new.png", b"new");
        let new_manifest = create_install_manifest(&staging, old_manifest.install_id.clone())
            .expect("new manifest");
        write_install_manifest(&staging, &new_manifest).expect("write new manifest");

        publish_update(&staging, &target, &old_manifest, &new_manifest).expect("update");

        assert_eq!(
            fs::read(&sentinel).expect("sentinel remains"),
            b"user-owned"
        );
        assert!(!target.join("obsolete.dll").exists());
        assert_eq!(
            fs::read(target.join("redpanda-launcher.exe")).expect("updated launcher"),
            b"updated-launcher"
        );
        assert!(target.join("assets/new.png").exists());
        assert_eq!(
            read_install_manifest(&target).expect("updated manifest"),
            new_manifest
        );
    }

    #[test]
    fn clean_uninstall_includes_tauri_and_legacy_data_paths() {
        let data = Path::new("C:/Users/Player/AppData/Roaming");
        let local = Path::new("C:/Users/Player/AppData/Local");
        let paths = launcher_user_data_paths(data, local);

        assert!(paths.contains(&data.join("com.t1m0nch1k.redpanda.launcher")));
        assert!(paths.contains(&local.join("com.t1m0nch1k.redpanda.launcher")));
        assert!(paths.contains(&data.join("RedPandaLauncher")));
        assert!(paths.contains(&local.join("redpanda-launcher")));
    }
}
