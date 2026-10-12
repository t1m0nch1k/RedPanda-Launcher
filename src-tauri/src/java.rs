// Автоустановка JRE выполняется движком lighty-launcher; этот модуль только
// сопоставляет версию Minecraft с требуемой версией Java.

pub fn get_required_java_version(mc_version: &str) -> u8 {
    // Modern snapshots (24w..., 25w..., 26w...) or pre-releases/release candidates
    if mc_version.starts_with("24w")
        || mc_version.starts_with("25w")
        || mc_version.starts_with("26w")
    {
        return 21;
    }

    let parts: Vec<&str> = mc_version.split('.').collect();
    if !parts.is_empty() {
        if let Ok(major) = parts[0].parse::<u32>() {
            // Modern year-based releases (26.x, 27.x, etc.)
            if major >= 24 {
                return 21;
            }
            if major == 1 && parts.len() >= 2 {
                if let Ok(minor) = parts[1].parse::<u32>() {
                    if minor >= 21 {
                        return 21;
                    }
                    if minor == 20 {
                        let patch = parts
                            .get(2)
                            .and_then(|p| p.split(|c: char| !c.is_ascii_digit()).next())
                            .and_then(|p| p.parse::<u32>().ok())
                            .unwrap_or(0);
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
    }
    21 // default fallback for modern Minecraft is Java 21
}
