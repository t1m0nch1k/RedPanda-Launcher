fn main() {
    let version_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("VERSION");
    let version = std::fs::read_to_string(&version_path)
        .expect("VERSION file is required")
        .trim()
        .to_string();
    if !version.chars().next().is_some_and(|c| c.is_ascii_digit()) {
        panic!("VERSION must contain a semantic version");
    }
    println!("cargo:rustc-env=REDPANDA_VERSION={version}");
    let update_key = match std::env::var("REDPANDA_UPDATE_PUBLIC_KEY_HEX") {
        Ok(key) if !key.is_empty() => key,
        _ => {
            // RFC 8032 test-vector key keeps local development/packaging builds deterministic.
            "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a".to_string()
        }
    };
    if update_key.len() != 64 || !update_key.chars().all(|c| c.is_ascii_hexdigit()) {
        panic!("REDPANDA_UPDATE_PUBLIC_KEY_HEX must be a 32-byte hexadecimal key");
    }
    println!("cargo:rustc-env=REDPANDA_UPDATE_PUBLIC_KEY_HEX={update_key}");
    println!("cargo:rerun-if-changed={}", version_path.display());
    tauri_build::build()
}
