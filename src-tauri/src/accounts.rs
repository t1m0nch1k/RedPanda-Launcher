#[cfg(not(windows))]
use aes_gcm::aead::{rand_core::RngCore, OsRng};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

lazy_static! {
    static ref ACCOUNTS_MUTEX: Mutex<()> = Mutex::new(());
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Account {
    pub id: String,
    pub username: String,
    pub account_type: String, // "Offline", "Microsoft", "ElyBy"
    pub is_active: bool,
    pub uuid: Option<String>,
    pub access_token: Option<String>,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub expires_at: Option<i64>,
    /// Секреты этого аккаунта не удалось расшифровать (повреждённый vault,
    /// смена профиля Windows и т.п.). Аккаунт не валиден до повторного входа,
    /// но остальное состояние vault продолжает работать.
    #[serde(default)]
    pub needs_relogin: bool,
}

fn public_account(mut account: Account) -> Account {
    account.access_token = None;
    account.refresh_token = None;
    account
}

#[derive(Serialize, Deserialize, Default, Clone, Debug)]
pub struct AccountsData {
    pub accounts: Vec<Account>,
}

fn get_encryption_key() -> [u8; 32] {
    let machine_id = dirs::config_dir()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let salt = "RedPanda_Launcher_Secure_Vault_v1";
    let combined = format!("{}:{}", machine_id, salt);
    let mut hasher = Sha1::new();
    hasher.update(combined.as_bytes());
    let hash1 = hasher.finalize();

    let mut key = [0u8; 32];
    key[..20].copy_from_slice(&hash1);
    for i in 0..12 {
        key[20 + i] = hash1[i] ^ 0x5A;
    }
    key
}

#[cfg(windows)]
/// App-specific DPAPI entropy: без него любой same-user процесс может
/// расшифровать blob. Как минимум привязывает blob к хранилищу лаунчера и
/// исключает молчаливую пере-используемость данных другими приложениями.
const DPAPI_ENTROPY: &[u8] = b"RedPandaLauncher::account-vault::v2";
#[cfg(windows)]
/// Запрещаем интерактивные DPAPI-подсказки в фоне (без UI).
const CRYPTPROTECT_UI_FORBIDDEN: u32 = 0x1;

#[cfg(windows)]
fn dpapi_protect(value: &[u8]) -> Option<Vec<u8>> {
    dpapi_protect_with_entropy(value, Some(DPAPI_ENTROPY))
}

#[cfg(windows)]
fn dpapi_protect_with_entropy(value: &[u8], entropy: Option<&[u8]>) -> Option<Vec<u8>> {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{CryptProtectData, CRYPT_INTEGER_BLOB};

    let entropy_blob = entropy.map(|bytes| CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr() as *mut u8,
    });
    let optional_entropy = entropy_blob
        .as_ref()
        .map(|blob| blob as *const CRYPT_INTEGER_BLOB)
        .unwrap_or_else(std::ptr::null);
    let input = CRYPT_INTEGER_BLOB {
        cbData: value.len() as u32,
        pbData: value.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };
    let ok = unsafe {
        CryptProtectData(
            &input,
            std::ptr::null(),
            optional_entropy,
            std::ptr::null_mut(),
            std::ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 || output.pbData.is_null() {
        return None;
    }
    let bytes = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) };
    let result = bytes.to_vec();
    unsafe { LocalFree(output.pbData as _) };
    Some(result)
}

#[cfg(windows)]
fn dpapi_unprotect(value: &[u8]) -> Option<Vec<u8>> {
    dpapi_unprotect_with_entropy(value, Some(DPAPI_ENTROPY))
}

#[cfg(windows)]
fn dpapi_unprotect_with_entropy(value: &[u8], entropy: Option<&[u8]>) -> Option<Vec<u8>> {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB};

    let entropy_blob = entropy.map(|bytes| CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr() as *mut u8,
    });
    let optional_entropy = entropy_blob
        .as_ref()
        .map(|blob| blob as *const CRYPT_INTEGER_BLOB)
        .unwrap_or_else(std::ptr::null);
    let input = CRYPT_INTEGER_BLOB {
        cbData: value.len() as u32,
        pbData: value.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };
    let ok = unsafe {
        CryptUnprotectData(
            &input,
            std::ptr::null_mut(),
            optional_entropy,
            std::ptr::null_mut(),
            std::ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 || output.pbData.is_null() {
        return None;
    }
    let bytes = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) };
    let result = bytes.to_vec();
    unsafe { LocalFree(output.pbData as _) };
    Some(result)
}

/// Encrypts a secret for a new write. On Windows we only write DPAPI-protected
/// data: falling back to a deterministic key or plaintext would silently reduce
/// the protection of fresh credentials.
pub(crate) fn encrypt_secret_checked(plain: &str) -> Result<String, String> {
    if plain.is_empty() {
        return Ok(String::new());
    }

    #[cfg(windows)]
    {
        let ciphertext = dpapi_protect(plain.as_bytes())
            .ok_or_else(|| "Windows DPAPI could not protect the secret".to_string())?;
        Ok(format!("enc:dpapi:v2:{}", BASE64.encode(ciphertext)))
    }

    #[cfg(not(windows))]
    {
        // This format is retained for non-Windows builds and for reading old
        // Windows data. The production Windows application never selects it
        // for a new credential write.
        let key = get_encryption_key();
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|_| "Could not initialize local secret encryption".to_string())?;
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher
            .encrypt(nonce, plain.as_bytes())
            .map_err(|_| "Could not encrypt secret".to_string())?;
        let mut payload = Vec::with_capacity(12 + ciphertext.len());
        payload.extend_from_slice(&nonce_bytes);
        payload.extend_from_slice(&ciphertext);
        Ok(format!("enc:v2:{}", BASE64.encode(payload)))
    }
}

/// Decrypts the current format and both historic AES formats. A corrupt or
/// inaccessible ciphertext is an error, never an apparent access token.
pub(crate) fn decrypt_secret_checked(enc: &str) -> Result<String, String> {
    #[cfg(windows)]
    if let Some(stripped) = enc.strip_prefix("enc:dpapi:v2:") {
        let decoded = BASE64
            .decode(stripped)
            .map_err(|_| "DPAPI ciphertext is not valid base64".to_string())?;
        let plaintext = dpapi_unprotect(&decoded)
            .ok_or_else(|| "Windows DPAPI could not decrypt the secret".to_string())?;
        return String::from_utf8(plaintext)
            .map_err(|_| "Decrypted secret is not valid UTF-8".to_string());
    }

    #[cfg(windows)]
    if let Some(stripped) = enc.strip_prefix("enc:dpapi:") {
        // Legacy-формат без app-specific entropy, читается для миграции:
        // при следующей записи токен будет переподписан в enc:dpapi:v2.
        let decoded = BASE64
            .decode(stripped)
            .map_err(|_| "DPAPI ciphertext is not valid base64".to_string())?;
        let plaintext = dpapi_unprotect_with_entropy(&decoded, None)
            .ok_or_else(|| "Windows DPAPI could not decrypt the secret".to_string())?;
        return String::from_utf8(plaintext)
            .map_err(|_| "Decrypted secret is not valid UTF-8".to_string());
    }

    #[cfg(not(windows))]
    if enc.starts_with("enc:dpapi:") {
        return Err(
            "This secret is protected by Windows DPAPI and cannot be read here".to_string(),
        );
    }

    if let Some(stripped) = enc.strip_prefix("enc:v2:") {
        return decrypt_aes_v2_checked(stripped);
    }
    if let Some(stripped) = enc.strip_prefix("enc:") {
        return decrypt_legacy_checked(stripped);
    }

    // Plaintext was used by early versions. It remains readable so that the
    // next successful save can migrate it to the current protected format.
    Ok(enc.to_string())
}

fn decrypt_aes_v2_checked(stripped: &str) -> Result<String, String> {
    let decoded = BASE64
        .decode(stripped)
        .map_err(|_| "AES ciphertext is not valid base64".to_string())?;
    if decoded.len() <= 12 {
        return Err("AES ciphertext is missing a nonce or authentication tag".to_string());
    }
    let (nonce_bytes, ciphertext) = decoded.split_at(12);
    let key = get_encryption_key();
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|_| "Could not initialize legacy secret encryption".to_string())?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "AES secret authentication failed".to_string())?;
    String::from_utf8(plaintext).map_err(|_| "Decrypted secret is not valid UTF-8".to_string())
}

fn decrypt_legacy_checked(stripped: &str) -> Result<String, String> {
    let decoded = BASE64
        .decode(stripped)
        .map_err(|_| "Legacy ciphertext is not valid base64".to_string())?;
    let key = get_encryption_key();
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|_| "Could not initialize legacy secret encryption".to_string())?;
    let nonce_bytes = [
        0x52, 0x65, 0x64, 0x50, 0x61, 0x6E, 0x64, 0x61, 0x53, 0x65, 0x63, 0x31,
    ];
    let nonce = Nonce::from_slice(&nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, decoded.as_ref())
        .map_err(|_| "Legacy secret authentication failed".to_string())?;
    String::from_utf8(plaintext).map_err(|_| "Decrypted secret is not valid UTF-8".to_string())
}

fn get_accounts_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Could not get app data dir: {}", e))?;

    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| format!("Could not create app data dir: {}", e))?;
    }

    path.push("accounts.json");
    Ok(path)
}

/// Современный формат секрета? Всё, что старее, мигрируется при следующей записи.
fn token_is_legacy_format(token: &str) -> bool {
    #[cfg(windows)]
    {
        !token.starts_with("enc:dpapi:v2:")
    }
    #[cfg(not(windows))]
    {
        !token.starts_with("enc:v2:")
    }
}

/// Изолирует сбой расшифровки конкретного аккаунта: вместо того, чтобы один
/// сбойный секрет валил весь vault, очищаем токены аккаунта и помечаем
/// needs_relogin. Пользователь может удалить аккаунт или войти заново,
/// остальные аккаунты продолжают работать.
fn isolate_account_token_failure(acc: &mut Account, error: &str, needs_migration: &mut bool) {
    log::warn!(
        "Account '{}' has unreadable credentials ({error}); clearing tokens and requiring re-login",
        acc.username
    );
    acc.access_token = None;
    acc.refresh_token = None;
    acc.needs_relogin = true;
    *needs_migration = true;
}

fn decrypt_account_tokens(acc: &mut Account, needs_migration: &mut bool) {
    if let Some(token) = acc.access_token.clone() {
        if token_is_legacy_format(&token) {
            *needs_migration = true;
        }
        match decrypt_secret_checked(&token) {
            Ok(plain) => acc.access_token = Some(plain),
            Err(error) => {
                isolate_account_token_failure(acc, &error, needs_migration);
                return;
            }
        }
    }
    if let Some(token) = acc.refresh_token.clone() {
        if token_is_legacy_format(&token) {
            *needs_migration = true;
        }
        match decrypt_secret_checked(&token) {
            Ok(plain) => acc.refresh_token = Some(plain),
            Err(error) => isolate_account_token_failure(acc, &error, needs_migration),
        }
    }
}

/// Читает vault БЕЗ захвата мьютекса: вызвать под замком ACCOUNTS_MUTEX.
fn load_accounts_data_unlocked(app: &AppHandle) -> Result<AccountsData, String> {
    let path = get_accounts_file_path(app)?;

    if !path.exists() {
        return Ok(AccountsData::default());
    }

    let mut data: AccountsData = crate::storage::read_json_with_backup(&path)?;

    let mut needs_migration = false;
    for acc in &mut data.accounts {
        decrypt_account_tokens(acc, &mut needs_migration);
    }

    if needs_migration {
        // Миграция (переподпись legacy-секретов либо изоляция сбойного
        // аккаунта) не должна блокировать чтение: неудачная запись просто
        // повторится при следующем запуске.
        if let Err(error) = save_accounts_data_unlocked(app, &data) {
            log::warn!("Could not persist accounts vault migration: {error}");
        }
    }

    Ok(data)
}

/// Сохраняет vault БЕЗ захвата мьютекса: вызвать под замком ACCOUNTS_MUTEX.
fn save_accounts_data_unlocked(app: &AppHandle, data: &AccountsData) -> Result<(), String> {
    let path = get_accounts_file_path(app)?;

    // Clone data to encrypt secrets before disk write
    let mut to_save = data.clone();
    for acc in &mut to_save.accounts {
        if let Some(token) = &acc.access_token {
            acc.access_token = Some(encrypt_secret_checked(token).map_err(|error| {
                format!(
                    "Could not protect access token for account '{}': {error}",
                    acc.username
                )
            })?);
        }
        if let Some(token) = &acc.refresh_token {
            acc.refresh_token = Some(encrypt_secret_checked(token).map_err(|error| {
                format!(
                    "Could not protect refresh token for account '{}': {error}",
                    acc.username
                )
            })?);
        }
    }

    let contents = serde_json::to_string_pretty(&to_save)
        .map_err(|e| format!("Failed to serialize accounts: {}", e))?;
    crate::storage::atomic_write(&path, contents.as_bytes())
        .map_err(|e| format!("Failed to write accounts.json: {e}"))
}

/// Read-modify-write vault'а под одним захваченным мьютексом.
///
/// Раньше команды делали `load` (лок) → изменение → `save` (лок заново),
/// из-за чего две параллельные команды могли молча перетирать данные
/// друг друга (lost update). Теперь весь цикл атомарен.
fn with_accounts_data<F>(app: &AppHandle, f: F) -> Result<(), String>
where
    F: FnOnce(&mut AccountsData) -> Result<(), String>,
{
    let _guard = ACCOUNTS_MUTEX
        .lock()
        .map_err(|_| "Failed to acquire accounts mutex lock".to_string())?;
    let mut data = load_accounts_data_unlocked(app)?;
    f(&mut data)?;
    save_accounts_data_unlocked(app, &data)
}

pub(crate) fn load_accounts_data(app: &AppHandle) -> Result<AccountsData, String> {
    let _guard = ACCOUNTS_MUTEX
        .lock()
        .map_err(|_| "Failed to acquire accounts mutex lock".to_string())?;
    load_accounts_data_unlocked(app)
}

/// Делает `incoming` активным и либо обновляет существующую запись того же
/// провайдер-профиля (тот же тип + uuid), либо добавляет новую.
/// Так повторный вход не плодит дубликаты со старыми токенами.
fn upsert_account(data: &mut AccountsData, mut incoming: Account) -> Account {
    for account in &mut data.accounts {
        account.is_active = false;
    }

    let existing = data.accounts.iter_mut().find(|account| {
        account.account_type == incoming.account_type
            && incoming.uuid.is_some()
            && account.uuid == incoming.uuid
    });

    if let Some(existing) = existing {
        incoming.id = existing.id.clone();
        *existing = incoming.clone();
        return incoming;
    }

    data.accounts.push(incoming.clone());
    incoming
}

#[tauri::command]
pub fn get_accounts(app: AppHandle) -> Result<Vec<Account>, String> {
    let data = load_accounts_data(&app)?;
    Ok(data
        .accounts
        .into_iter()
        .map(|mut account| {
            account.access_token = None;
            account.refresh_token = None;
            account
        })
        .collect())
}

#[tauri::command]
pub fn add_offline_account(app: AppHandle, username: String) -> Result<Account, String> {
    let mut created: Option<Account> = None;
    with_accounts_data(&app, |data| {
        for acc in &mut data.accounts {
            acc.is_active = false;
        }

        let new_account = Account {
            id: Uuid::new_v4().to_string(),
            username: username.clone(),
            account_type: "Offline".to_string(),
            is_active: true,
            uuid: None,
            access_token: None,
            refresh_token: None,
            expires_at: None,
            needs_relogin: false,
        };

        created = Some(upsert_account(data, new_account));
        Ok(())
    })?;

    let _ = app.emit("accounts_changed", ());
    Ok(public_account(
        created.expect("account created inside closure"),
    ))
}

#[tauri::command]
pub fn remove_account(app: AppHandle, id: String) -> Result<(), String> {
    // Работает и для аккаунта с нечитаемыми токенами: расшифровка при загрузке
    // теперь изолируется на аккаунт (needs_relogin), а не роняет весь vault.
    with_accounts_data(&app, |data| {
        let initial_len = data.accounts.len();
        data.accounts.retain(|acc| acc.id != id);

        if data.accounts.len() == initial_len {
            return Err("Account not found".to_string());
        }

        if !data.accounts.iter().any(|acc| acc.is_active) && !data.accounts.is_empty() {
            data.accounts[0].is_active = true;
        }

        Ok(())
    })?;

    let _ = app.emit("accounts_changed", ());
    Ok(())
}

#[tauri::command]
pub fn set_active_account(app: AppHandle, id: String) -> Result<(), String> {
    with_accounts_data(&app, |data| {
        let mut found = false;
        for acc in &mut data.accounts {
            if acc.id == id {
                acc.is_active = true;
                found = true;
            } else {
                acc.is_active = false;
            }
        }

        if !found {
            return Err("Account not found".to_string());
        }

        Ok(())
    })?;

    let _ = app.emit("accounts_changed", ());
    Ok(())
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[allow(non_snake_case)]
pub struct ElyByAuthResponse {
    pub accessToken: String,
    pub clientToken: String,
    pub selectedProfile: Option<ElyByProfile>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ElyByProfile {
    pub id: String,
    pub name: String,
}

#[tauri::command]
pub async fn add_elyby_account(
    app: AppHandle,
    email: String,
    password: String,
) -> Result<Account, String> {
    let client = crate::downloads::trusted_download_client("RedPandaLauncher/accounts")?;
    let payload = serde_json::json!({
        "agent": { "name": "Minecraft", "version": 1 },
        "username": email,
        "password": password,
        "clientToken": Uuid::new_v4().to_string()
    });

    let res = client
        .post("https://authserver.ely.by/auth/authenticate")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !res.status().is_success() {
        return Err("Invalid email or password".to_string());
    }

    let auth_data: ElyByAuthResponse = res
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    let profile = auth_data
        .selectedProfile
        .ok_or("No Minecraft profile found on this account")?;

    let mut created: Option<Account> = None;
    with_accounts_data(&app, |data| {
        for acc in &mut data.accounts {
            acc.is_active = false;
        }

        let new_account = Account {
            id: Uuid::new_v4().to_string(),
            username: profile.name,
            account_type: "ElyBy".to_string(),
            is_active: true,
            uuid: Some(profile.id),
            access_token: Some(auth_data.accessToken),
            refresh_token: None,
            expires_at: None,
            needs_relogin: false,
        };

        created = Some(upsert_account(data, new_account));
        Ok(())
    })?;

    let _ = app.emit("accounts_changed", ());
    Ok(public_account(
        created.expect("account created inside closure"),
    ))
}

#[derive(Serialize, Clone)]
pub struct DeviceCodeInfo {
    pub user_code: String,
    pub verification_uri: String,
    pub device_code: String,
    pub interval: u64,
    /// Сколько секунд код остаётся действительным (Microsoft отдаёт 900).
    pub expires_in: u64,
}

#[tauri::command]
pub async fn microsoft_device_code() -> Result<DeviceCodeInfo, String> {
    let client_id = "00000000402b5328";

    let client = crate::downloads::trusted_download_client("RedPandaLauncher/accounts")?;
    let res = client
        .post("https://login.live.com/oauth20_connect.srf")
        .form(&[
            ("client_id", client_id),
            ("scope", "service::user.auth.xboxlive.com::MBI_SSL"),
            ("response_type", "device_code"),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to request device code: {}", e))?;

    if !res.status().is_success() {
        return Err("Failed to get device code".to_string());
    }

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|_| "Invalid MS response".to_string())?;

    let user_code = json["user_code"]
        .as_str()
        .filter(|value| !value.is_empty())
        .ok_or("Microsoft device code response has no user_code")?;
    let verification_uri = json["verification_uri"]
        .as_str()
        .filter(|value| !value.is_empty())
        .ok_or("Microsoft device code response has no verification_uri")?;
    let device_code = json["device_code"]
        .as_str()
        .filter(|value| !value.is_empty())
        .ok_or("Microsoft device code response has no device_code")?;

    Ok(DeviceCodeInfo {
        user_code: user_code.to_string(),
        verification_uri: verification_uri.to_string(),
        device_code: device_code.to_string(),
        interval: json["interval"]
            .as_u64()
            .filter(|value| *value > 0)
            .unwrap_or(5),
        expires_in: json["expires_in"]
            .as_u64()
            .filter(|value| *value > 0)
            .unwrap_or(900),
    })
}

// Xbox Live & Minecraft Services helpers
async fn authenticate_xbox_live(
    client: &reqwest::Client,
    ms_access_token: &str,
) -> Result<(String, String), String> {
    let xbl_req = serde_json::json!({
        "Properties": {
            "AuthMethod": "RPS",
            "SiteName": "user.auth.xboxlive.com",
            "RpsTicket": format!("d={}", ms_access_token)
        },
        "RelyingParty": "http://auth.xboxlive.com",
        "TokenType": "JWT"
    });

    let xbl_res = client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .json(&xbl_req)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("XBL network error: {}", e))?;

    if !xbl_res.status().is_success() {
        return Err("Failed to authenticate with Xbox Live".to_string());
    }

    let xbl_data: serde_json::Value = xbl_res
        .json()
        .await
        .map_err(|_| "Invalid XBL response".to_string())?;
    let xbl_token = xbl_data["Token"]
        .as_str()
        .ok_or("No XBL token")?
        .to_string();
    let uhs = xbl_data["DisplayClaims"]["xui"][0]["uhs"]
        .as_str()
        .ok_or("No user hash")?
        .to_string();

    Ok((xbl_token, uhs))
}

async fn authenticate_xsts(client: &reqwest::Client, xbl_token: &str) -> Result<String, String> {
    let xsts_req = serde_json::json!({
        "Properties": {
            "SandboxId": "RETAIL",
            "UserTokens": [xbl_token]
        },
        "RelyingParty": "rp://api.minecraftservices.com/",
        "TokenType": "JWT"
    });

    let xsts_res = client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .json(&xsts_req)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("XSTS network error: {}", e))?;

    if !xsts_res.status().is_success() {
        return Err("Failed to authenticate with XSTS. Ensure Xbox account exists.".to_string());
    }

    let xsts_data: serde_json::Value = xsts_res
        .json()
        .await
        .map_err(|_| "Invalid XSTS response".to_string())?;
    let xsts_token = xsts_data["Token"]
        .as_str()
        .ok_or("No XSTS token")?
        .to_string();
    Ok(xsts_token)
}

async fn authenticate_minecraft(
    client: &reqwest::Client,
    uhs: &str,
    xsts_token: &str,
) -> Result<(String, i64), String> {
    let mc_req = serde_json::json!({
        "identityToken": format!("XBL3.0 x={};{}", uhs, xsts_token)
    });

    let mc_res = client
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .json(&mc_req)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Minecraft Auth network error: {}", e))?;

    if !mc_res.status().is_success() {
        return Err("Failed to authenticate with Minecraft API".to_string());
    }

    let mc_data: serde_json::Value = mc_res
        .json()
        .await
        .map_err(|_| "Invalid MC response".to_string())?;
    let mc_access_token = mc_data["access_token"]
        .as_str()
        .ok_or("No MC access token")?
        .to_string();
    let expires_in = mc_data["expires_in"].as_i64().unwrap_or(86400);

    Ok((mc_access_token, expires_in))
}

async fn get_minecraft_profile(
    client: &reqwest::Client,
    mc_access_token: &str,
) -> Result<ElyByProfile, String> {
    let profile_res = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(mc_access_token)
        .send()
        .await
        .map_err(|e| format!("MC Profile network error: {}", e))?;

    if !profile_res.status().is_success() {
        return Err("Failed to get Minecraft Profile. Check if game is purchased.".to_string());
    }

    let profile_data: serde_json::Value = profile_res
        .json()
        .await
        .map_err(|_| "Invalid MC Profile response".to_string())?;
    let profile_id = profile_data["id"]
        .as_str()
        .ok_or("No profile ID")?
        .to_string();
    let profile_name = profile_data["name"]
        .as_str()
        .ok_or("No profile name")?
        .to_string();

    Ok(ElyByProfile {
        id: profile_id,
        name: profile_name,
    })
}

#[tauri::command]
pub async fn poll_microsoft_device_code(
    app: AppHandle,
    device_code: String,
) -> Result<Account, String> {
    let client_id = "00000000402b5328";
    let client = crate::downloads::trusted_download_client("RedPandaLauncher/accounts")?;

    let token_res = client
        .post("https://login.live.com/oauth20_token.srf")
        .form(&[
            ("client_id", client_id),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ("device_code", &device_code),
        ])
        .send()
        .await
        .map_err(|e| format!("Device code network error: {}", e))?;

    // MSA device flow возвращает и HTTP 4xx, и 200 с {"error": ...} в теле —
    // разбираем тело независимо от статуса, иначе ожидание не различимо
    // от реального ответа с токеном.
    let status = token_res.status();
    let body = token_res
        .text()
        .await
        .map_err(|_| "Invalid MS token response".to_string())?;
    let token_data: serde_json::Value = match serde_json::from_str(&body) {
        Ok(value) => value,
        Err(_) => {
            // Прокси/шлюз может вернуть HTML или пустое тело на 5xx/429:
            // это временная ошибка, а не повод прекращать вход.
            if status.is_server_error() || status == reqwest::StatusCode::TOO_MANY_REQUESTS {
                return Err("authorization_pending".to_string());
            }
            return Err("Invalid MS token response".to_string());
        }
    };

    if let Some(err_code) = token_data["error"].as_str() {
        match err_code {
            "authorization_pending" => return Err("authorization_pending".to_string()),
            "slow_down" => return Err("slow_down".to_string()),
            "authorization_declined" => return Err("authorization_declined".to_string()),
            "expired_token" => return Err("expired_token".to_string()),
            _ => return Err(format!("Device code poll error: {}", err_code)),
        }
    }
    if !status.is_success() {
        return Err(format!("Device code poll error: HTTP {}", status));
    }

    let ms_access_token = token_data["access_token"]
        .as_str()
        .ok_or("No MS access token")?;
    let refresh_token = token_data["refresh_token"].as_str().map(|s| s.to_string());

    let (xbl_token, uhs) = authenticate_xbox_live(&client, ms_access_token).await?;
    let xsts_token = authenticate_xsts(&client, &xbl_token).await?;
    let (mc_access_token, expires_in) = authenticate_minecraft(&client, &uhs, &xsts_token).await?;
    let profile = get_minecraft_profile(&client, &mc_access_token).await?;
    let expires_at = chrono::Utc::now().timestamp() + expires_in;

    let mut created: Option<Account> = None;
    with_accounts_data(&app, |data| {
        for acc in &mut data.accounts {
            acc.is_active = false;
        }

        let new_account = Account {
            id: Uuid::new_v4().to_string(),
            username: profile.name,
            account_type: "Microsoft".to_string(),
            is_active: true,
            uuid: Some(profile.id),
            access_token: Some(mc_access_token),
            refresh_token: refresh_token.clone(),
            expires_at: Some(expires_at),
            needs_relogin: false,
        };

        created = Some(upsert_account(data, new_account));
        Ok(())
    })?;

    // Список на фронте мог уже «закрыть» окно входа: уведомляем UI об изменениях vault.
    let _ = app.emit("accounts_changed", ());
    Ok(public_account(
        created.expect("account created inside closure"),
    ))
}

#[tauri::command]
pub async fn add_microsoft_account(app: AppHandle, device_code: String) -> Result<Account, String> {
    poll_microsoft_device_code(app, device_code).await
}

#[tauri::command]
pub async fn add_elyby_account_oauth(app: AppHandle) -> Result<Account, String> {
    let client_id = "elyprism-launcher";
    // Ely.by ignores PKCE for this client: sending `code_verifier` back to the token
    // endpoint makes the exchange fail with `invalid_request`, so the flow stays plain.
    let auth_url_template = format!(
        "https://account.ely.by/oauth2/v1?client_id={}&response_type=code&scope=account_info+offline_access+minecraft_server_session&prompt=select_account&state={{STATE}}&redirect_uri={{REDIRECT_URI}}",
        client_id
    );

    let (code, redirect_uri, _code_verifier) =
        crate::oauth::start_oauth_flow(&app, &auth_url_template).await?;

    let client = crate::downloads::trusted_download_client("RedPandaLauncher/accounts")?;
    let token_res = client
        .post("https://account.ely.by/api/oauth2/v1/token")
        .form(&[
            ("client_id", client_id),
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("redirect_uri", &redirect_uri),
        ])
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    log::info!(
        "Ely.by: token exchange responded with {}",
        token_res.status()
    );

    if !token_res.status().is_success() {
        let status = token_res.status();
        let body = token_res.text().await.unwrap_or_default();
        let detail = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|json| {
                let error = json["error"].as_str().unwrap_or("").to_string();
                let message = json["message"].as_str().unwrap_or("").to_string();
                match (error.is_empty(), message.is_empty()) {
                    (false, false) => Some(format!("{error}: {message}")),
                    (false, true) => Some(error),
                    (true, false) => Some(message),
                    (true, true) => None,
                }
            })
            .unwrap_or(body);
        log::warn!("Ely.by token exchange failed: HTTP {status} body={detail}");
        return Err(format!(
            "Ely.by token exchange failed (HTTP {status}): {detail}"
        ));
    }

    let token_data: serde_json::Value = token_res
        .json()
        .await
        .map_err(|_| "Invalid token response".to_string())?;
    let access_token = token_data["access_token"]
        .as_str()
        .ok_or("No access token in response")?;
    let refresh_token = token_data["refresh_token"].as_str().map(|s| s.to_string());
    let expires_in = token_data["expires_in"].as_i64().unwrap_or(86400 * 30);
    let expires_at = chrono::Utc::now().timestamp() + expires_in;

    let profile_res = client
        .get("https://account.ely.by/api/mojang/services/minecraft/profile")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Profile network error: {}", e))?;

    if !profile_res.status().is_success() {
        let status = profile_res.status();
        let body = profile_res.text().await.unwrap_or_default();
        log::warn!("Ely.by profile fetch failed: HTTP {status} body={body}");
        return Err(format!(
            "Ely.by profile request failed (HTTP {status}): {body}"
        ));
    }

    let profile_data: serde_json::Value = profile_res
        .json()
        .await
        .map_err(|_| "Invalid profile response".to_string())?;

    let profile_id = profile_data["id"].as_str().ok_or("No profile ID")?;
    let profile_name = profile_data["name"].as_str().ok_or("No profile name")?;

    let mut created: Option<Account> = None;
    with_accounts_data(&app, |data| {
        for acc in &mut data.accounts {
            acc.is_active = false;
        }

        let new_account = Account {
            id: Uuid::new_v4().to_string(),
            username: profile_name.to_string(),
            account_type: "ElyBy".to_string(),
            is_active: true,
            uuid: Some(profile_id.to_string()),
            access_token: Some(access_token.to_string()),
            refresh_token: refresh_token.clone(),
            expires_at: Some(expires_at),
            needs_relogin: false,
        };

        created = Some(upsert_account(data, new_account));
        Ok(())
    })?;

    let _ = app.emit("accounts_changed", ());
    Ok(public_account(
        created.expect("account created inside closure"),
    ))
}

#[tauri::command]
pub async fn add_microsoft_account_oauth(app: AppHandle) -> Result<Account, String> {
    let client_id = "00000000402b5328";
    let auth_url_template = format!(
        "https://login.live.com/oauth20_authorize.srf?client_id={}&response_type=code&scope=service::user.auth.xboxlive.com::MBI_SSL&state={{STATE}}&code_challenge={{CODE_CHALLENGE}}&code_challenge_method=S256&redirect_uri={{REDIRECT_URI}}",
        client_id
    );

    let (code, redirect_uri, code_verifier) =
        crate::oauth::start_oauth_flow(&app, &auth_url_template).await?;

    let client = crate::downloads::trusted_download_client("RedPandaLauncher/accounts")?;
    let token_res = client
        .post("https://login.live.com/oauth20_token.srf")
        .form(&[
            ("client_id", client_id),
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("redirect_uri", &redirect_uri),
            ("code_verifier", &code_verifier),
        ])
        .send()
        .await
        .map_err(|e| format!("MS Token network error: {}", e))?;

    if !token_res.status().is_success() {
        return Err(format!(
            "Failed to exchange MS token: {}",
            token_res.status()
        ));
    }

    let token_data: serde_json::Value = token_res
        .json()
        .await
        .map_err(|_| "Invalid MS token response".to_string())?;
    let ms_access_token = token_data["access_token"]
        .as_str()
        .ok_or("No MS access token")?;
    let refresh_token = token_data["refresh_token"].as_str().map(|s| s.to_string());

    let (xbl_token, uhs) = authenticate_xbox_live(&client, ms_access_token).await?;
    let xsts_token = authenticate_xsts(&client, &xbl_token).await?;
    let (mc_access_token, expires_in) = authenticate_minecraft(&client, &uhs, &xsts_token).await?;
    let profile = get_minecraft_profile(&client, &mc_access_token).await?;
    let expires_at = chrono::Utc::now().timestamp() + expires_in;

    let mut created: Option<Account> = None;
    with_accounts_data(&app, |data| {
        for acc in &mut data.accounts {
            acc.is_active = false;
        }

        let new_account = Account {
            id: Uuid::new_v4().to_string(),
            username: profile.name,
            account_type: "Microsoft".to_string(),
            is_active: true,
            uuid: Some(profile.id),
            access_token: Some(mc_access_token),
            refresh_token: refresh_token.clone(),
            expires_at: Some(expires_at),
            needs_relogin: false,
        };

        created = Some(upsert_account(data, new_account));
        Ok(())
    })?;

    let _ = app.emit("accounts_changed", ());
    Ok(public_account(
        created.expect("account created inside closure"),
    ))
}

const TOKEN_REFRESH_SKEW_SECONDS: i64 = 5 * 60;

fn refresh_is_due(expires_at: Option<i64>, now: i64) -> bool {
    expires_at
        .is_some_and(|expires_at| now >= expires_at.saturating_sub(TOKEN_REFRESH_SKEW_SECONDS))
}

fn refresh_token_required(account: &Account) -> Result<&str, String> {
    account.refresh_token.as_deref().ok_or_else(|| {
        format!(
            "The {} session has expired and cannot be renewed. Please sign in again.",
            account.account_type
        )
    })
}

/// Refreshes an expiring online account in memory. The account is updated only
/// after every provider step succeeds, so a rotated refresh token is not left
/// half-applied when Xbox or Minecraft authentication subsequently fails.
pub async fn refresh_account_tokens(
    app: &AppHandle,
    account: &mut Account,
) -> Result<bool, String> {
    let now = chrono::Utc::now().timestamp();
    if !refresh_is_due(account.expires_at, now) {
        return Ok(false);
    }

    if !matches!(account.account_type.as_str(), "ElyBy" | "Microsoft") {
        // Offline and unknown account types have no provider refresh protocol.
        return Ok(false);
    }

    let refresh_token = refresh_token_required(account)?.to_string();
    let client = crate::downloads::trusted_download_client("RedPandaLauncher/accounts")?;
    let mut refreshed_account = account.clone();

    match account.account_type.as_str() {
        "ElyBy" => {
            let res = client
                .post("https://account.ely.by/api/oauth2/v1/token")
                .form(&[
                    ("client_id", "elyprism-launcher"),
                    ("grant_type", "refresh_token"),
                    ("refresh_token", &refresh_token),
                ])
                .send()
                .await
                .map_err(|error| format!("Ely.by token refresh failed: {error}"))?;
            if !res.status().is_success() {
                let status = res.status();
                if status.is_client_error() {
                    // Провайдер окончательно отверг refresh: сессия мертва.
                    mark_account_needs_relogin(app, &account.id);
                    account.needs_relogin = true;
                    account.access_token = None;
                    account.refresh_token = None;
                    account.expires_at = None;
                }
                return Err(format!(
                    "Ely.by rejected the token refresh (HTTP {}). Please sign in again.",
                    status
                ));
            }

            let token_data: serde_json::Value = res
                .json()
                .await
                .map_err(|error| format!("Invalid Ely.by token refresh response: {error}"))?;
            let access_token = token_data["access_token"]
                .as_str()
                .ok_or("Ely.by token refresh response has no access token")?;
            refreshed_account.access_token = Some(access_token.to_string());
            if let Some(new_refresh_token) = token_data["refresh_token"].as_str() {
                refreshed_account.refresh_token = Some(new_refresh_token.to_string());
            }
            let expires_in = token_data["expires_in"].as_i64().unwrap_or(86400 * 30);
            refreshed_account.expires_at = Some(now + expires_in);
        }
        "Microsoft" => {
            let res = client
                .post("https://login.live.com/oauth20_token.srf")
                .form(&[
                    ("client_id", "00000000402b5328"),
                    ("grant_type", "refresh_token"),
                    ("refresh_token", &refresh_token),
                ])
                .send()
                .await
                .map_err(|error| format!("Microsoft token refresh failed: {error}"))?;
            if !res.status().is_success() {
                let status = res.status();
                if status.is_client_error() {
                    // Провайдер окончательно отверг refresh: сессия мертва.
                    mark_account_needs_relogin(app, &account.id);
                    account.needs_relogin = true;
                    account.access_token = None;
                    account.refresh_token = None;
                    account.expires_at = None;
                }
                return Err(format!(
                    "Microsoft rejected the token refresh (HTTP {}). Please sign in again.",
                    status
                ));
            }

            let token_data: serde_json::Value = res
                .json()
                .await
                .map_err(|error| format!("Invalid Microsoft token refresh response: {error}"))?;
            let microsoft_access_token = token_data["access_token"]
                .as_str()
                .ok_or("Microsoft token refresh response has no access token")?;
            let rotated_refresh_token = token_data["refresh_token"].as_str().map(str::to_string);

            // MSA инвалидирует старый refresh token сразу после обмена, поэтому
            // сохраняем новый ДО XBL/XSTS/Minecraft: иначе сбой на любом шаге ниже
            // оставит аккаунт без рабочего refresh token.
            if let Some(rotated) = rotated_refresh_token.as_ref() {
                refreshed_account.refresh_token = Some(rotated.clone());
                let snapshot = refreshed_account.clone();
                if let Err(error) = persist_refreshed_credentials(app, &snapshot) {
                    log::warn!("Failed to persist rotated Microsoft refresh token: {error}");
                }
            }

            let (xbl_token, uhs) = authenticate_xbox_live(&client, microsoft_access_token).await?;
            let xsts_token = authenticate_xsts(&client, &xbl_token).await?;
            let (minecraft_access_token, expires_in) =
                authenticate_minecraft(&client, &uhs, &xsts_token).await?;

            refreshed_account.access_token = Some(minecraft_access_token);
            refreshed_account.expires_at = Some(now + expires_in);
        }
        _ => unreachable!("online account types were checked before refreshing"),
    }

    *account = refreshed_account;
    Ok(true)
}

fn persist_refreshed_credentials(app: &AppHandle, refreshed: &Account) -> Result<(), String> {
    with_accounts_data(app, |data| {
        let stored = data
            .accounts
            .iter_mut()
            .find(|account| account.id == refreshed.id)
            .ok_or_else(|| {
                "Account was removed while its session was being refreshed".to_string()
            })?;

        // Only replace values obtained from the refresh flow. This avoids clobbering
        // a concurrent profile or active-account change with an older in-memory copy.
        stored.access_token = refreshed.access_token.clone();
        stored.refresh_token = refreshed.refresh_token.clone();
        stored.expires_at = refreshed.expires_at;
        // Сессия подтверждена провайдером: сбой расшифровки уже не актуален.
        stored.needs_relogin = false;
        Ok(())
    })
}

/// Провайдер окончательно отверг refresh token: помечаем аккаунт как требующий
/// повторного входа и вычищаем мёртвые токены из хранилища.
fn mark_account_needs_relogin(app: &AppHandle, id: &str) {
    let result = with_accounts_data(app, |data| {
        if let Some(stored) = data.accounts.iter_mut().find(|account| account.id == id) {
            stored.needs_relogin = true;
            stored.access_token = None;
            stored.refresh_token = None;
            stored.expires_at = None;
        }
        Ok(())
    });
    if let Err(error) = result {
        log::warn!("Failed to mark account {id} as needing re-login: {error}");
    }
}

/// Refreshes an account and persists the new credentials before the launcher
/// uses them. Launcher code should call this instead of `refresh_account_tokens`
/// so a rotated refresh token survives the current game launch.
pub async fn refresh_account_tokens_and_persist(
    app: &AppHandle,
    account: &mut Account,
) -> Result<bool, String> {
    let changed = refresh_account_tokens(app, account).await?;
    if changed {
        persist_refreshed_credentials(app, account)?;
    }
    Ok(changed)
}

#[tauri::command]
pub async fn validate_and_refresh_account(app: AppHandle, id: String) -> Result<Account, String> {
    let mut account = load_accounts_data(&app)?
        .accounts
        .into_iter()
        .find(|account| account.id == id)
        .ok_or_else(|| "Account not found".to_string())?;
    refresh_account_tokens_and_persist(&app, &mut account).await?;

    if account.needs_relogin
        || (account.account_type != "Offline" && account.access_token.is_none())
    {
        return Err("The account session has expired. Please sign in again.".to_string());
    }

    Ok(public_account(account))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refresh_is_due_only_near_the_expiry_deadline() {
        let now = 10_000;
        assert!(!refresh_is_due(None, now));
        assert!(!refresh_is_due(
            Some(now + TOKEN_REFRESH_SKEW_SECONDS + 1),
            now
        ));
        assert!(refresh_is_due(Some(now + TOKEN_REFRESH_SKEW_SECONDS), now));
        assert!(refresh_is_due(Some(now - 1), now));
    }

    #[test]
    fn corrupt_ciphertext_is_an_error_not_an_access_token() {
        assert!(decrypt_secret_checked("enc:v2:not-base64").is_err());
        assert!(decrypt_secret_checked("enc:also-not-base64").is_err());
    }

    #[test]
    fn legacy_plaintext_remains_readable_for_migration() {
        assert_eq!(
            decrypt_secret_checked("legacy-access-token").expect("legacy plaintext"),
            "legacy-access-token"
        );
    }

    #[cfg(not(windows))]
    #[test]
    fn checked_secret_encryption_round_trips_on_non_windows() {
        let encrypted = encrypt_secret_checked("secret value").expect("encrypt secret");
        assert!(encrypted.starts_with("enc:v2:"));
        assert_eq!(
            decrypt_secret_checked(&encrypted).expect("decrypt secret"),
            "secret value"
        );
    }
}
