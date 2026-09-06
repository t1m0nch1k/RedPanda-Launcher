use std::fs::{self, File};
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};
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
    let parent = target
        .parent()
        .ok_or_else(|| "Не удалось определить родительскую папку установки".to_string())?;
    if target.file_name().is_none() {
        return Err("Нельзя устанавливать приложение в корень диска".to_string());
    }
    fs::create_dir_all(parent)
        .map_err(|e| format!("Failed to create install directory parent: {}", e))?;
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

        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let outpath = match file.enclosed_name() {
                Some(path) => staging_path.join(path),
                None => continue,
            };

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
                let mut buffer = Vec::new();
                file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
                outfile.write_all(&buffer).map_err(|e| e.to_string())?;
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

    // Copy current running installer as uninstall.exe into target directory
    if let Ok(current_exe) = std::env::current_exe() {
        let uninstall_dest = staging_path.join("uninstall.exe");
        fs::copy(current_exe, uninstall_dest)
            .map_err(|e| format!("Failed to copy uninstaller: {e}"))?;
    }

    // Swap the complete installation only after every payload file has been
    // extracted successfully. The old directory is retained until the new
    // one is in place and restored if the final rename fails.
    let backup_path = target.with_file_name(format!(
        ".{}.backup-{}",
        target
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("redpanda-launcher"),
        uuid::Uuid::new_v4()
    ));
    let had_old_install = target.exists();
    if had_old_install {
        fs::rename(&target, &backup_path)
            .map_err(|e| format!("Не удалось сохранить предыдущую установку: {e}"))?;
    }
    if let Err(error) = fs::rename(&staging_path, &target) {
        if had_old_install {
            let _ = fs::rename(&backup_path, &target);
        }
        return Err(format!("Не удалось применить установку: {error}"));
    }
    if had_old_install {
        fs::remove_dir_all(&backup_path)
            .map_err(|e| format!("Установка завершена, но не удалось удалить backup: {e}"))?;
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

        let exe_path = PathBuf::from(&target_dir).join("redpanda-launcher.exe");
        let uninstall_exe = PathBuf::from(&target_dir).join("uninstall.exe");

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
        let installed_size = directory_size(Path::new(&target_dir))
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
    let local_data = dirs::data_local_dir().ok_or("Cannot find local appdata")?;
    let program_dir = local_data.join("Programs").join("RedPanda Launcher");

    if clean_user_data {
        let appdata_dir = dirs::data_dir()
            .unwrap_or_default()
            .join("RedPandaLauncher");
        if let Err(error) = fs::remove_dir_all(appdata_dir) {
            if error.kind() != std::io::ErrorKind::NotFound {
                return Err(format!("Failed to remove user data: {error}"));
            }
        }
        let local_appdata = local_data.join("redpanda-launcher");
        if let Err(error) = fs::remove_dir_all(local_appdata) {
            if error.kind() != std::io::ErrorKind::NotFound {
                return Err(format!("Failed to remove local user data: {error}"));
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // Schedule directory removal after uninstaller process exits via cmd
        let script = format!(
            "ping 127.0.0.1 -n 2 > nul & rmdir /S /Q \"{}\"",
            program_dir.to_string_lossy()
        );
        let mut cmd = Command::new("cmd.exe");
        cmd.args(["/C", &script]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.spawn()
            .map_err(|e| format!("Failed to schedule uninstall cleanup: {e}"))?;
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
    use super::directory_size;
    use std::fs;

    #[test]
    fn calculates_installed_size_recursively() {
        let directory = tempfile::tempdir().expect("tempdir");
        fs::create_dir(directory.path().join("nested")).expect("nested");
        fs::write(directory.path().join("a.bin"), [1u8, 2, 3]).expect("a");
        fs::write(directory.path().join("nested").join("b.bin"), [4u8; 7]).expect("b");
        assert_eq!(directory_size(directory.path()).expect("size"), 10);
    }
}
