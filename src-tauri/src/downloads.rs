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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ChecksumAlgorithm {
    Sha1,
    Sha256,
    Sha512,
}

impl ChecksumAlgorithm {
    fn name(self) -> &'static str {
        match self {
            Self::Sha1 => "SHA-1",
            Self::Sha256 => "SHA-256",
            Self::Sha512 => "SHA-512",
        }
    }

    fn expected_length(self) -> usize {
        match self {
            Self::Sha1 => 40,
            Self::Sha256 => 64,
            Self::Sha512 => 128,
        }
    }
}

fn validate_checksum(algorithm: ChecksumAlgorithm, expected: &str) -> Result<String, String> {
    let expected = expected.trim();
    if expected.len() != algorithm.expected_length()
        || !expected
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Err(format!("Некорректный {} checksum", algorithm.name()));
    }
    Ok(expected.to_ascii_lowercase())
}

fn checksum_from_hashes(
    hashes: &HashMap<String, String>,
) -> Result<(ChecksumAlgorithm, String), String> {
    for (name, algorithm) in [
        ("sha512", ChecksumAlgorithm::Sha512),
        ("sha256", ChecksumAlgorithm::Sha256),
        ("sha1", ChecksumAlgorithm::Sha1),
    ] {
        if let Some(value) = hashes
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case(name))
            .map(|(_, value)| value)
        {
            return Ok((algorithm, validate_checksum(algorithm, value)?));
        }
    }

    Err("У загружаемого файла отсутствует поддерживаемый checksum".to_string())
}

fn checked_download_size(total: u64, next_chunk_size: usize, maximum: u64) -> Result<u64, String> {
    let total = total
        .checked_add(next_chunk_size as u64)
        .ok_or_else(|| "Размер загрузки переполнен".to_string())?;
    if total > maximum {
        return Err("Размер загрузки превышает лимит 500 МБ".to_string());
    }
    Ok(total)
}

fn digest_bytes(algorithm: ChecksumAlgorithm, bytes: &[u8]) -> String {
    match algorithm {
        ChecksumAlgorithm::Sha1 => hex::encode(Sha1::digest(bytes)),
        ChecksumAlgorithm::Sha256 => hex::encode(Sha256::digest(bytes)),
        ChecksumAlgorithm::Sha512 => hex::encode(Sha512::digest(bytes)),
    }
}

async fn replace_download_file(temporary: &Path, destination: &Path) -> Result<(), String> {
    let temporary = temporary.to_path_buf();
    let destination = destination.to_path_buf();
    tokio::task::spawn_blocking(move || replace_download_file_blocking(&temporary, &destination))
        .await
        .map_err(|error| format!("Не удалось завершить загрузку: {error}"))?
        .map_err(|error| format!("Не удалось завершить загрузку: {error}"))
}

#[cfg(not(windows))]
fn replace_download_file_blocking(temporary: &Path, destination: &Path) -> std::io::Result<()> {
    std::fs::rename(temporary, destination)
}

#[cfg(windows)]
fn replace_download_file_blocking(temporary: &Path, destination: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let temporary_wide: Vec<u16> = temporary.as_os_str().encode_wide().chain(Some(0)).collect();
    let destination_wide: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let result = unsafe {
        MoveFileExW(
            temporary_wide.as_ptr(),
            destination_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}

async fn download_to_file_with_checksum(
    client: &reqwest::Client,
    url: &str,
    destination: &Path,
    algorithm: ChecksumAlgorithm,
    expected_checksum: &str,
) -> Result<u64, String> {
    let expected_checksum = validate_checksum(algorithm, expected_checksum)?;
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
        let mut sha1 = Sha1::new();
        let mut sha256 = Sha256::new();
        let mut sha512 = Sha512::new();
        let mut total = 0u64;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|error| format!("Ошибка чтения загрузки: {error}"))?;
            total = checked_download_size(total, chunk.len(), MAX_DOWNLOAD_BYTES as u64)?;
            sha1.update(&chunk);
            sha256.update(&chunk);
            sha512.update(&chunk);
            file.write_all(&chunk)
                .await
                .map_err(|error| format!("Не удалось записать загрузку: {error}"))?;
        }
        file.flush()
            .await
            .map_err(|error| format!("Не удалось сохранить загрузку: {error}"))?;
        file.sync_all()
            .await
            .map_err(|error| format!("Не удалось сохранить загрузку: {error}"))?;
        drop(file);

        let actual = match algorithm {
            ChecksumAlgorithm::Sha1 => hex::encode(sha1.finalize()),
            ChecksumAlgorithm::Sha256 => hex::encode(sha256.finalize()),
            ChecksumAlgorithm::Sha512 => hex::encode(sha512.finalize()),
        };
        if actual != expected_checksum {
            return Err("Checksum загружаемого файла не совпадает".to_string());
        }
        replace_download_file(&temporary, destination).await?;
        Ok(total)
    }
    .await;
    if result.is_err() {
        let _ = tokio::fs::remove_file(&temporary).await;
    }
    result
}

/// Streams a verified artifact to disk without buffering the whole response.
/// The destination is replaced only after the complete response and checksum
/// have been validated.
pub async fn download_to_file(
    client: &reqwest::Client,
    url: &str,
    destination: &Path,
    expected_sha256: &str,
) -> Result<u64, String> {
    download_to_file_with_checksum(
        client,
        url,
        destination,
        ChecksumAlgorithm::Sha256,
        expected_sha256,
    )
    .await
}

/// Streams a Modrinth artifact while validating its strongest advertised hash.
pub async fn download_to_file_with_hashes(
    client: &reqwest::Client,
    url: &str,
    destination: &Path,
    hashes: &HashMap<String, String>,
) -> Result<u64, String> {
    let (algorithm, expected_checksum) = checksum_from_hashes(hashes)?;
    download_to_file_with_checksum(client, url, destination, algorithm, &expected_checksum).await
}

/// Streams an artifact whose provider publishes a SHA-1 checksum.
pub async fn download_to_file_with_sha1(
    client: &reqwest::Client,
    url: &str,
    destination: &Path,
    expected_sha1: &str,
) -> Result<u64, String> {
    download_to_file_with_checksum(
        client,
        url,
        destination,
        ChecksumAlgorithm::Sha1,
        expected_sha1,
    )
    .await
}

pub fn verify_modrinth_hashes(
    bytes: &[u8],
    hashes: &HashMap<String, String>,
) -> Result<(), String> {
    let (algorithm, expected) = checksum_from_hashes(hashes)?;
    if digest_bytes(algorithm, bytes) == expected {
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

    #[test]
    fn prefers_the_strongest_supported_hash() {
        let bytes = b"redpanda";
        let mut hashes = HashMap::new();
        hashes.insert("SHA1".to_string(), hex::encode(Sha1::digest(bytes)));
        hashes.insert("sha512".to_string(), hex::encode(Sha512::digest(bytes)));

        let (algorithm, checksum) = checksum_from_hashes(&hashes).expect("checksum");
        assert_eq!(algorithm, ChecksumAlgorithm::Sha512);
        assert_eq!(checksum, hex::encode(Sha512::digest(bytes)));
    }

    #[test]
    fn rejects_malformed_advertised_hashes() {
        let mut hashes = HashMap::new();
        hashes.insert("sha256".to_string(), "not-a-checksum".to_string());
        assert!(checksum_from_hashes(&hashes).is_err());
    }

    #[test]
    fn checks_each_streamed_chunk_against_the_limit() {
        assert_eq!(checked_download_size(3, 2, 5), Ok(5));
        assert!(checked_download_size(3, 3, 5).is_err());
    }
}
