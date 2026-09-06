use futures::StreamExt;
use sha1::{Digest as Sha1Digest, Sha1};
use sha2::{Digest as Sha2Digest, Sha256, Sha512};
use std::collections::HashMap;
use std::path::Path;
use tokio::io::AsyncWriteExt;

/// Creates an artifact client whose redirects stay on supported providers.
pub fn trusted_download_client(user_agent: &str) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 5 {
                return attempt.stop();
            }
            match attempt.url().host_str() {
                Some(host)
                    if host == "modrinth.com"
                        || host.ends_with(".modrinth.com")
                        || host == "api.modrinth.com"
                        || host == "curseforge.com"
                        || host.ends_with(".curseforge.com")
                        || host == "api.curseforge.com"
                        || host == "forgecdn.net"
                        || host.ends_with(".forgecdn.net")
                        || host == "api.github.com"
                        || host == "github.com"
                        || host == "objects.githubusercontent.com"
                        || host == "github-releases.githubusercontent.com"
                        || host == "release-assets.githubusercontent.com"
                        || host == "api.adoptium.net"
                        || host == "launchermeta.mojang.com"
                        || host == "meta.fabricmc.net"
                        || host == "meta.quiltmc.org"
                        || host == "maven.neoforged.net"
                        || host == "bmclapi2.bangbang93.com"
                        || host == "authserver.ely.by"
                        || host == "account.ely.by"
                        || host == "login.live.com"
                        || host == "user.auth.xboxlive.com"
                        || host == "xsts.auth.xboxlive.com"
                        || host == "api.minecraftservices.com" =>
                {
                    attempt.follow()
                }
                _ => attempt.stop(),
            }
        }))
        .user_agent(user_agent)
        .build()
        .map_err(|error| format!("Failed to create download client: {error}"))
}

pub const MAX_DOWNLOAD_BYTES: usize = 500 * 1024 * 1024;

/// Streams a verified artifact to disk without buffering the whole response.
/// The destination is replaced only after the complete response and checksum
/// have been validated.
pub async fn download_to_file(
    client: &reqwest::Client,
    url: &str,
    destination: &Path,
    expected_sha256: &str,
) -> Result<u64, String> {
    if expected_sha256.len() != 64 || !expected_sha256.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Некорректный SHA-256 checksum".to_string());
    }
    let response = {
        let mut response = None;
        for attempt in 0..3 {
            match client.get(url).send().await {
                Ok(candidate)
                    if candidate.status() == reqwest::StatusCode::TOO_MANY_REQUESTS
                        || candidate.status().is_server_error() =>
                {
                    if attempt == 2 {
                        return Err(format!(
                            "Сервер временно недоступен: {}",
                            candidate.status()
                        ));
                    }
                    let delay = 250 * 2_u64.pow(attempt);
                    tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
                }
                Ok(candidate) => {
                    response = Some(candidate);
                    break;
                }
                Err(error) => {
                    if attempt == 2 {
                        return Err(format!("Ошибка загрузки: {error}"));
                    }
                    let delay = 250 * 2_u64.pow(attempt);
                    tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
                }
            }
        }
        response.ok_or_else(|| "Ошибка загрузки: не получен ответ сервера".to_string())?
    };
    if !response.status().is_success() {
        return Err(format!("Сервер вернул статус {}", response.status()));
    }
    if response
        .content_length()
        .is_some_and(|size| size > MAX_DOWNLOAD_BYTES as u64)
    {
        return Err("Размер загрузки превышает лимит 500 МБ".to_string());
    }

    let parent = destination
        .parent()
        .ok_or_else(|| "У destination отсутствует родительская папка".to_string())?;
    tokio::fs::create_dir_all(parent)
        .await
        .map_err(|error| format!("Не удалось создать папку загрузки: {error}"))?;
    let temporary = parent.join(format!(".{}.download", uuid::Uuid::new_v4()));
    let result = async {
        let mut file = tokio::fs::File::create(&temporary)
            .await
            .map_err(|error| format!("Не удалось создать временный файл: {error}"))?;
        let mut stream = response.bytes_stream();
        let mut hasher = Sha256::new();
        let mut total = 0u64;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|error| format!("Ошибка чтения загрузки: {error}"))?;
            total = total
                .checked_add(chunk.len() as u64)
                .ok_or_else(|| "Размер загрузки переполнен".to_string())?;
            if total > MAX_DOWNLOAD_BYTES as u64 {
                return Err("Размер загрузки превышает лимит 500 МБ".to_string());
            }
            hasher.update(&chunk);
            file.write_all(&chunk)
                .await
                .map_err(|error| format!("Не удалось записать загрузку: {error}"))?;
        }
        file.flush()
            .await
            .map_err(|error| format!("Не удалось сохранить загрузку: {error}"))?;
        let actual = hex::encode(hasher.finalize());
        if actual != expected_sha256.to_ascii_lowercase() {
            return Err("Checksum загружаемого файла не совпадает".to_string());
        }
        tokio::fs::rename(&temporary, destination)
            .await
            .map_err(|error| format!("Не удалось завершить загрузку: {error}"))?;
        Ok(total)
    }
    .await;
    if result.is_err() {
        let _ = tokio::fs::remove_file(&temporary).await;
    }
    result
}

pub fn verify_modrinth_hashes(
    bytes: &[u8],
    hashes: &HashMap<String, String>,
) -> Result<(), String> {
    let expected = hashes
        .get("sha512")
        .or_else(|| hashes.get("sha256"))
        .or_else(|| hashes.get("sha1"))
        .ok_or_else(|| "У загружаемого файла отсутствует поддерживаемый checksum".to_string())?;

    let actual = if hashes.contains_key("sha512") {
        hex::encode(Sha512::digest(bytes))
    } else if hashes.contains_key("sha256") {
        hex::encode(Sha256::digest(bytes))
    } else {
        hex::encode(Sha1::digest(bytes))
    };

    if actual.eq_ignore_ascii_case(expected) {
        Ok(())
    } else {
        Err("Checksum загружаемого файла не совпадает".to_string())
    }
}

pub fn verify_sha1(bytes: &[u8], expected: &str) -> Result<(), String> {
    let actual = hex::encode(Sha1::digest(bytes));
    if actual.eq_ignore_ascii_case(expected.trim()) {
        Ok(())
    } else {
        Err("SHA-1 checksum загружаемого файла не совпадает".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn verifies_modrinth_sha256() {
        let bytes = b"redpanda";
        let mut hashes = HashMap::new();
        hashes.insert("sha256".to_string(), hex::encode(Sha256::digest(bytes)));
        assert!(verify_modrinth_hashes(bytes, &hashes).is_ok());
    }

    #[test]
    fn rejects_hash_mismatch() {
        assert!(verify_sha1(b"redpanda", "0000000000000000000000000000000000000000").is_err());
    }

    #[test]
    fn rejects_missing_hash() {
        assert!(verify_modrinth_hashes(b"redpanda", &HashMap::new()).is_err());
    }
}
