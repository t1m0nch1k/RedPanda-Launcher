use std::path::{Component, Path, PathBuf};

/// Validates instance ID to ensure it is alphanumeric, contains no path separators or traversal sequences
pub fn validate_instance_id(id: &str) -> Result<String, String> {
    let trimmed = id.trim();
    if trimmed.is_empty() {
        return Err("Instance ID cannot be empty".to_string());
    }

    if trimmed.len() > 64 {
        return Err("Instance ID cannot exceed 64 characters".to_string());
    }

    if trimmed.ends_with('.') || trimmed.ends_with(' ') || is_reserved_windows_name(trimmed) {
        return Err("Instance ID is not a valid Windows directory name".to_string());
    }

    if trimmed.contains("..")
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.contains(':')
    {
        return Err(format!(
            "Instance ID '{}' contains illegal characters or path traversal components",
            trimmed
        ));
    }

    for c in trimmed.chars() {
        if !c.is_alphanumeric() && c != '-' && c != '_' && c != '.' && c != ' ' {
            return Err(format!("Instance ID contains forbidden character '{}'", c));
        }
    }

    Ok(trimmed.to_string())
}

/// Sanitizes a file name (e.g. for downloaded mods, resource packs, skins)
pub fn sanitize_filename(name: &str) -> String {
    let raw_name = Path::new(name)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or(name);

    let mut clean = String::with_capacity(raw_name.len());
    for c in raw_name.chars() {
        match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0' => {
                clean.push('_');
            }
            _ => clean.push(c),
        }
    }

    let trimmed = clean.trim();
    if trimmed.is_empty() || trimmed == "." || trimmed == ".." {
        return "unnamed_file".to_string();
    }

    trimmed.to_string()
}

/// Validates a single file name supplied by the frontend.
///
/// Sanitizing is appropriate before saving a remote file, but destructive
/// operations must reject path-like input instead of silently changing it.
pub fn validate_filename(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed == "." || trimmed == ".." {
        return Err("File name cannot be empty or a traversal component".to_string());
    }

    let mut components = Path::new(trimmed).components();
    match (components.next(), components.next()) {
        (Some(Component::Normal(component)), None) if !component.is_empty() => {}
        _ => return Err("File name must be a single path component".to_string()),
    }

    if trimmed.chars().any(|c| c.is_control()) {
        return Err("File name contains control characters".to_string());
    }

    if trimmed.len() > 255
        || trimmed.ends_with('.')
        || trimmed.ends_with(' ')
        || is_reserved_windows_name(trimmed)
    {
        return Err("File name is not valid on Windows".to_string());
    }

    Ok(trimmed.to_string())
}

fn is_reserved_windows_name(name: &str) -> bool {
    let stem = name.split('.').next().unwrap_or(name).to_ascii_uppercase();
    matches!(
        stem.as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    )
}

/// Returns the private directory containing all launcher instances.
pub fn launcher_data_dir() -> Result<PathBuf, String> {
    let mut path = dirs::data_dir().ok_or("Could not determine application data directory")?;
    path.push("RedPandaLauncher");
    Ok(path)
}

/// Builds a validated instance directory path.
pub fn instance_dir(id: &str) -> Result<PathBuf, String> {
    let valid_id = validate_instance_id(id)?;
    let base = launcher_data_dir()?;
    safe_join(&base, &valid_id)
}

/// Verifies that target_path is safely contained within base_dir (prevents directory traversal)
pub fn is_safe_subpath(base_dir: &Path, target_path: &Path) -> bool {
    safe_join(base_dir, &target_path.to_string_lossy()).is_ok()
}

/// Normalizes and safely joins path components
pub fn safe_join(base: &Path, subpath: &str) -> Result<PathBuf, String> {
    let sub = Path::new(subpath);
    let mut result = base.to_path_buf();
    for comp in sub.components() {
        match comp {
            Component::Normal(n) => result.push(n),
            Component::CurDir => {}
            Component::Prefix(_) | Component::RootDir | Component::ParentDir => {
                return Err(format!("Unsafe path traversal detected in '{}'", subpath));
            }
        }
    }

    // Reject existing symlinks/junctions anywhere in the resolved path. This
    // closes the common archive/import escape where a safe textual path points
    // through a link outside the launcher data directory.
    let mut current = base.to_path_buf();
    if is_link_like(&current) {
        return Err("Base directory cannot be a symbolic link".to_string());
    }
    for component in sub.components() {
        if let Component::Normal(name) = component {
            current.push(name);
            if is_link_like(&current) {
                return Err(format!(
                    "Path contains a symbolic link: {}",
                    current.display()
                ));
            }
        }
    }

    Ok(result)
}

fn is_link_like(path: &Path) -> bool {
    let Ok(metadata) = std::fs::symlink_metadata(path) else {
        return false;
    };
    if metadata.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
        metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }
    #[cfg(not(windows))]
    {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_instance_id_valid() {
        assert!(validate_instance_id("vanilla-1.20.4").is_ok());
        assert!(validate_instance_id("modded_fabric_1").is_ok());
        assert!(validate_instance_id("My Instance").is_ok());
    }

    #[test]
    fn test_validate_instance_id_invalid() {
        assert!(validate_instance_id("").is_err());
        assert!(validate_instance_id("../evil").is_err());
        assert!(validate_instance_id("sub/dir").is_err());
        assert!(validate_instance_id("sub\\dir").is_err());
        assert!(validate_instance_id("C:evil").is_err());
    }

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(sanitize_filename("valid_mod.jar"), "valid_mod.jar");
        assert_eq!(sanitize_filename("../../etc/passwd.jar"), "passwd.jar");
        assert_eq!(sanitize_filename("mod:name*?.jar"), "mod_name__.jar");
        assert_eq!(sanitize_filename(".."), "unnamed_file");
        assert_eq!(sanitize_filename(""), "unnamed_file");
    }

    #[test]
    fn test_safe_join() {
        let base = Path::new("/var/data/instances");
        assert!(safe_join(base, "instance1").is_ok());
        assert!(safe_join(base, "instance1/mods/mod.jar").is_ok());
        assert!(safe_join(base, "../evil").is_err());
        assert!(safe_join(base, "../../root").is_err());
    }

    #[test]
    fn test_validate_filename() {
        assert!(validate_filename("mod.jar").is_ok());
        assert!(validate_filename("folder/mod.jar").is_err());
        assert!(validate_filename("..\\secret.txt").is_err());
        assert!(validate_filename("").is_err());
        assert!(validate_filename("CON").is_err());
        assert!(validate_filename("name.").is_err());
    }
}
