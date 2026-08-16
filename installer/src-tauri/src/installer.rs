use std::fs::{self, File};
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(windows)]
use winreg::enums::*;
#[cfg(windows)]
use winreg::RegKey;

// Embedded payload zip (packaged during release build)
static PAYLOAD_BYTES: &[u8] = include_bytes!("../payload.zip");

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
pub async fn extract_payload(target_dir: String) -> Result<(), String> {
    let target = PathBuf::from(&target_dir);
    fs::create_dir_all(&target).map_err(|e| format!("Failed to create install directory: {}", e))?;

    // If payload is not empty, extract zip
    if !PAYLOAD_BYTES.is_empty() {
        let cursor = Cursor::new(PAYLOAD_BYTES);
        let mut archive = zip::ZipArchive::new(cursor)
            .map_err(|e| format!("Failed to open embedded zip archive: {}", e))?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let outpath = match file.enclosed_name() {
                Some(path) => target.join(path),
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
            let dest_exe = target.join("redpanda-launcher.exe");
            fs::copy(exe_path, dest_exe).map_err(|e| format!("Failed to copy exe: {}", e))?;
        }
    }

    // Copy current running installer as uninstall.exe into target directory
    if let Ok(current_exe) = std::env::current_exe() {
        let uninstall_dest = target.join("uninstall.exe");
        let _ = fs::copy(current_exe, uninstall_dest);
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
        cmd.output().map_err(|e| format!("Failed to create desktop shortcut: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn create_start_menu_shortcut(target_dir: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let local_data = dirs::data_dir().ok_or("Cannot find AppData Roaming")?;
        let start_menu = local_data.join("Microsoft").join("Windows").join("Start Menu").join("Programs");
        fs::create_dir_all(&start_menu).unwrap_or(());

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
        cmd.output().map_err(|e| format!("Failed to create start menu shortcut: {}", e))?;
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
        key.set_value("DisplayVersion", &"0.2.0")
            .map_err(|e| e.to_string())?;
        key.set_value("Publisher", &"RedPanda Team")
            .map_err(|e| e.to_string())?;
        key.set_value("DisplayIcon", &format!("{},0", exe_path.to_string_lossy()))
            .map_err(|e| e.to_string())?;
        key.set_value("InstallLocation", &target_dir)
            .map_err(|e| e.to_string())?;
        key.set_value("UninstallString", &format!("\"{}\" --uninstall", uninstall_exe.to_string_lossy()))
            .map_err(|e| e.to_string())?;
        key.set_value("QuietUninstallString", &format!("\"{}\" --uninstall --quiet", uninstall_exe.to_string_lossy()))
            .map_err(|e| e.to_string())?;
        let size: u32 = 120 * 1024; // ~120 MB in KB
        key.set_value("EstimatedSize", &size)
            .map_err(|e| e.to_string())?;
        let no_val: u32 = 1;
        key.set_value("NoModify", &no_val).map_err(|e| e.to_string())?;
        key.set_value("NoRepair", &no_val).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn remove_shortcuts() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(desktop) = dirs::desktop_dir() {
            let link = desktop.join("RedPanda Launcher.lnk");
            let _ = fs::remove_file(link);
        }
        if let Some(local_data) = dirs::data_dir() {
            let start_menu = local_data.join("Microsoft").join("Windows").join("Start Menu").join("Programs");
            let link = start_menu.join("RedPanda Launcher.lnk");
            let _ = fs::remove_file(link);
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
            let _ = uninstall_key.delete_subkey_all("RedPandaLauncher");
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn uninstall_files(clean_user_data: bool) -> Result<(), String> {
    let local_data = dirs::data_local_dir().ok_or("Cannot find local appdata")?;
    let program_dir = local_data.join("Programs").join("RedPanda Launcher");

    if clean_user_data {
        let appdata_dir = dirs::data_dir().unwrap_or_default().join("RedPandaLauncher");
        let _ = fs::remove_dir_all(appdata_dir);
        let local_appdata = local_data.join("redpanda-launcher");
        let _ = fs::remove_dir_all(local_appdata);
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
        let _ = cmd.spawn();
    }

    Ok(())
}

#[tauri::command]
pub async fn launch_app(target_dir: String) -> Result<(), String> {
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
        cmd.spawn().map_err(|e| format!("Failed to spawn launcher: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = Command::new(&exe);
        cmd.current_dir(&target_dir);
        cmd.spawn().map_err(|e| format!("Failed to spawn launcher: {}", e))?;
    }

    Ok(())
}
