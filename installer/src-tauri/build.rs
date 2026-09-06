fn main() {
    // Keep a clean-clone `cargo check` reproducible. Release builds replace
    // this marker with the real payload in scripts/build-custom-installer.ps1.
    let payload = std::path::Path::new("payload.zip");
    if !payload.exists() {
        std::fs::write(payload, []).expect("failed to create payload marker");
    }
    println!("cargo:rerun-if-changed=payload.zip");
    tauri_build::build()
}
