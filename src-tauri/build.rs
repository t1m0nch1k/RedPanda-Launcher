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
    // RFC 8032 test-vector public key. Its private half is public knowledge,
    // so a build that falls back to it must never accept automatic updates.
    const TEST_UPDATE_PUBLIC_KEY: &str =
        "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";

    let provided_key = std::env::var("REDPANDA_UPDATE_PUBLIC_KEY_HEX")
        .ok()
        .map(|key| key.trim().to_string())
        .filter(|key| !key.is_empty());

    let (update_key, key_is_test) = match provided_key {
        Some(key) => {
            let is_test = key.eq_ignore_ascii_case(TEST_UPDATE_PUBLIC_KEY);
            (key, is_test)
        }
        None => (TEST_UPDATE_PUBLIC_KEY.to_string(), true),
    };

    if update_key.len() != 64 || !update_key.chars().all(|c| c.is_ascii_hexdigit()) {
        panic!("REDPANDA_UPDATE_PUBLIC_KEY_HEX must be a 32-byte hexadecimal key");
    }
    if key_is_test {
        println!(
            "cargo:warning=REDPANDA_UPDATE_PUBLIC_KEY_HEX не задан или равен тестовому ключу RFC 8032: сборка откажется от автоматических обновлений. Для распространяемой сборки задайте настоящий публичный ключ обновлений."
        );
    }
    println!("cargo:rustc-env=REDPANDA_UPDATE_PUBLIC_KEY_HEX={update_key}");
    println!(
        "cargo:rustc-env=REDPANDA_UPDATE_KEY_IS_TEST={}",
        if key_is_test { "1" } else { "0" }
    );
    println!("cargo:rerun-if-env-changed=REDPANDA_UPDATE_PUBLIC_KEY_HEX");
    println!("cargo:rerun-if-changed={}", version_path.display());
    tauri_build::build()
}
