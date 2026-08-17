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

    if trimmed.contains("..") || trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains(':') {
        return Err(format!("Instance ID '{}' contains illegal characters or path traversal components", trimmed));
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

/// Verifies that target_path is safely contained within base_dir (prevents directory traversal)
pub fn is_safe_subpath(base_dir: &Path, target_path: &Path) -> bool {
    let mut depth: isize = 0;
    for component in target_path.components() {
        match component {
            Component::Prefix(_) | Component::RootDir => return false,
            Component::CurDir => continue,
            Component::ParentDir => {
                depth -= 1;
                if depth < 0 {
                    return false;
                }
            }
            Component::Normal(_) => {
                depth += 1;
            }
        }
    }

    if target_path.is_absolute() {
        if let (Ok(can_base), Ok(can_target)) = (base_dir.canonicalize(), target_path.canonicalize()) {
            return can_target.starts_with(can_base);
        }
    }

    true
}

/// Normalizes and safely joins path components
pub fn safe_join(base: &Path, subpath: &str) -> Result<PathBuf, String> {
    let sub = Path::new(subpath);
    if !is_safe_subpath(base, sub) {
        return Err(format!("Unsafe path traversal detected in '{}'", subpath));
    }

    let mut result = base.to_path_buf();
    for comp in sub.components() {
        if let Component::Normal(n) = comp {
            result.push(n);
        }
    }

    Ok(result)
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
}
