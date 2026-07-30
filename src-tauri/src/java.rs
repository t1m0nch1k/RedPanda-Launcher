use reqwest::Client;
use std::fs::{self, File};
use std::io::Cursor;
use std::path::PathBuf;
use zip::ZipArchive;

pub fn get_required_java_version(mc_version: &str) -> u8 {
    let parts: Vec<&str> = mc_version.split('.').collect();
    if parts.len() >= 2 {
        if let (Ok(major), Ok(minor)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
            if major == 1 {
                if minor >= 21 {
                    return 21;
                }
                if minor == 20 {
                    let patch = parts.get(2).and_then(|p| p.parse::<u32>().ok()).unwrap_or(0);
                    if patch >= 5 {
                        return 21;
                    }
                    return 17;
                }
                if minor >= 17 {
                    return 17;
                }
                return 8;
            }
        }
    }
    17 // default fallback
}

pub async fn ensure_java_runtime(mc_version: &str) -> Result<PathBuf, String> {
    let java_version = get_required_java_version(mc_version);
    
    let base_dir = dirs::data_dir()
        .ok_or_else(|| "Could not determine AppData directory".to_string())?
        .join("RedPandaLauncher")
        .join("runtimes")
        .join(format!("java-{}", java_version));

    // Check if java.exe already exists
    let java_exe = base_dir.join("bin").join("java.exe");
    if java_exe.exists() {
        return Ok(java_exe);
    }

    // Search inside subdirectories if extracted inside a wrapper folder like jdk-17.0.9+9-jre
    if base_dir.exists() {
        if let Ok(entries) = fs::read_dir(&base_dir) {
            for entry in entries.flatten() {
                let sub_java = entry.path().join("bin").join("java.exe");
                if sub_java.exists() {
                    return Ok(sub_java);
                }
            }
        }
    }

    log::info!("Downloading Java {} runtime for Minecraft {}...", java_version, mc_version);
    fs::create_dir_all(&base_dir).map_err(|e| e.to_string())?;

    let download_url = match java_version {
        8 => "https://api.adoptium.net/v3/binary/latest/8/ga/windows/x64/jre/hotspot/normal/eclipse",
        21 => "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse",
        _ => "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jre/hotspot/normal/eclipse",
    };

    let client = Client::builder()
        .user_agent("RedPandaLauncher/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download Java: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Java download failed with status: {}", res.status()));
    }

    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("Failed to read Java download bytes: {}", e))?;

    let cursor = Cursor::new(bytes);
    let mut archive = ZipArchive::new(cursor).map_err(|e| format!("Failed to open Zip archive: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => base_dir.join(path),
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
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    // Check again for java.exe
    if java_exe.exists() {
        return Ok(java_exe);
    }

    if let Ok(entries) = fs::read_dir(&base_dir) {
        for entry in entries.flatten() {
            let sub_java = entry.path().join("bin").join("java.exe");
            if sub_java.exists() {
                return Ok(sub_java);
            }
        }
    }

    Err(format!("Java {} downloaded but java.exe was not found", java_version))
}
