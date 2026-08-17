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
use tauri::{AppHandle, Manager};
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

fn encrypt_secret(plain: &str) -> String {
    if plain.is_empty() {
        return String::new();
    }
    let key = get_encryption_key();
    if let Ok(cipher) = Aes256Gcm::new_from_slice(&key) {
        let nonce_bytes = [0x52, 0x65, 0x64, 0x50, 0x61, 0x6E, 0x64, 0x61, 0x53, 0x65, 0x63, 0x31]; // "RedPandaSec1"
        let nonce = Nonce::from_slice(&nonce_bytes);
        if let Ok(ciphertext) = cipher.encrypt(nonce, plain.as_bytes()) {
            return format!("enc:{}", BASE64.encode(ciphertext));
        }
    }
    plain.to_string()
}

fn decrypt_secret(enc: &str) -> String {
    if let Some(stripped) = enc.strip_prefix("enc:") {
        if let Ok(decoded) = BASE64.decode(stripped) {
            let key = get_encryption_key();
            if let Ok(cipher) = Aes256Gcm::new_from_slice(&key) {
                let nonce_bytes = [0x52, 0x65, 0x64, 0x50, 0x61, 0x6E, 0x64, 0x61, 0x53, 0x65, 0x63, 0x31];
                let nonce = Nonce::from_slice(&nonce_bytes);
                if let Ok(plaintext) = cipher.decrypt(nonce, decoded.as_ref()) {
                    if let Ok(s) = String::from_utf8(plaintext) {
                        return s;
                    }
                }
            }
        }
    }
    enc.to_string()
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

fn load_accounts_data(app: &AppHandle) -> Result<AccountsData, String> {
    let _guard = ACCOUNTS_MUTEX
        .lock()
        .map_err(|_| "Failed to acquire accounts mutex lock".to_string())?;

    let path = get_accounts_file_path(app)?;

    if !path.exists() {
        return Ok(AccountsData::default());
    }

    let contents =
        fs::read_to_string(path).map_err(|e| format!("Failed to read accounts.json: {}", e))?;
    let mut data: AccountsData = serde_json::from_str(&contents).unwrap_or_default();

    // Decrypt sensitive tokens transparently
    for acc in &mut data.accounts {
        if let Some(token) = &acc.access_token {
            acc.access_token = Some(decrypt_secret(token));
        }
        if let Some(token) = &acc.refresh_token {
            acc.refresh_token = Some(decrypt_secret(token));
        }
    }

    Ok(data)
}

fn save_accounts_data(app: &AppHandle, data: &AccountsData) -> Result<(), String> {
    let _guard = ACCOUNTS_MUTEX
        .lock()
        .map_err(|_| "Failed to acquire accounts mutex lock".to_string())?;

    let path = get_accounts_file_path(app)?;

    // Clone data to encrypt secrets before disk write
    let mut to_save = data.clone();
    for acc in &mut to_save.accounts {
        if let Some(token) = &acc.access_token {
            acc.access_token = Some(encrypt_secret(token));
        }
        if let Some(token) = &acc.refresh_token {
            acc.refresh_token = Some(encrypt_secret(token));
        }
    }

    let contents = serde_json::to_string_pretty(&to_save)
        .map_err(|e| format!("Failed to serialize accounts: {}", e))?;
    fs::write(path, contents).map_err(|e| format!("Failed to write accounts.json: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_accounts(app: AppHandle) -> Result<Vec<Account>, String> {
    let data = load_accounts_data(&app)?;
    Ok(data.accounts)
}

#[tauri::command]
pub fn add_offline_account(app: AppHandle, username: String) -> Result<Account, String> {
    let mut data = load_accounts_data(&app)?;

    let is_active = data.accounts.is_empty();

    if is_active {
        for acc in &mut data.accounts {
            acc.is_active = false;
        }
    }

    let new_account = Account {
        id: Uuid::new_v4().to_string(),
        username: username.clone(),
        account_type: "Offline".to_string(),
        is_active,
        uuid: None,
        access_token: None,
        refresh_token: None,
        expires_at: None,
    };

    data.accounts.push(new_account.clone());
    save_accounts_data(&app, &data)?;

    Ok(new_account)
}

#[tauri::command]
pub fn remove_account(app: AppHandle, id: String) -> Result<(), String> {
    let mut data = load_accounts_data(&app)?;

    let initial_len = data.accounts.len();
    data.accounts.retain(|acc| acc.id != id);

    if data.accounts.len() == initial_len {
        return Err("Account not found".to_string());
    }

    if !data.accounts.iter().any(|acc| acc.is_active) && !data.accounts.is_empty() {
        data.accounts[0].is_active = true;
    }

    save_accounts_data(&app, &data)?;
    Ok(())
}

#[tauri::command]
pub fn set_active_account(app: AppHandle, id: String) -> Result<(), String> {
    let mut data = load_accounts_data(&app)?;

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

    save_accounts_data(&app, &data)?;
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
    let client = reqwest::Client::new();
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

    let mut data = load_accounts_data(&app)?;
    let is_active = data.accounts.is_empty();
    if is_active {
        for acc in &mut data.accounts {
            acc.is_active = false;
        }
    }

    let new_account = Account {
        id: Uuid::new_v4().to_string(),
        username: profile.name,
        account_type: "ElyBy".to_string(),
        is_active,
        uuid: Some(profile.id),
        access_token: Some(auth_data.accessToken),
        refresh_token: None,
        expires_at: None,
    };

    data.accounts.push(new_account.clone());
    save_accounts_data(&app, &data)?;

    Ok(new_account)
}

#[derive(Serialize, Clone)]
pub struct DeviceCodeInfo {
    pub user_code: String,
    pub verification_uri: String,
    pub device_code: String,
    pub interval: u64,
}

#[tauri::command]
pub async fn microsoft_device_code() -> Result<DeviceCodeInfo, String> {
    let client_id = "00000000402b5328";

    let client = reqwest::Client::new();
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

    Ok(DeviceCodeInfo {
        user_code: json["user_code"].as_str().unwrap_or("").to_string(),
        verification_uri: json["verification_uri"].as_str().unwrap_or("").to_string(),
        device_code: json["device_code"].as_str().unwrap_or("").to_string(),
        interval: json["interval"].as_u64().unwrap_or(5),
    })
}

// Xbox Live & Minecraft Services helpers
async fn authenticate_xbox_live(client: &reqwest::Client, ms_access_token: &str) -> Result<(String, String), String> {
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
    let xbl_token = xbl_data["Token"].as_str().ok_or("No XBL token")?.to_string();
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
    let xsts_token = xsts_data["Token"].as_str().ok_or("No XSTS token")?.to_string();
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
    let profile_id = profile_data["id"].as_str().ok_or("No profile ID")?.to_string();
    let profile_name = profile_data["name"].as_str().ok_or("No profile name")?.to_string();

    Ok(ElyByProfile {
        id: profile_id,
        name: profile_name,
    })
}

#[tauri::command]
pub async fn poll_microsoft_device_code(app: AppHandle, device_code: String) -> Result<Account, String> {
    let client_id = "00000000402b5328";
    let client = reqwest::Client::new();

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

    if !token_res.status().is_success() {
        let err_json: serde_json::Value = token_res.json().await.unwrap_or_default();
        let err_code = err_json["error"].as_str().unwrap_or("authorization_pending");
        if err_code == "authorization_pending" {
            return Err("authorization_pending".to_string());
        } else if err_code == "authorization_declined" {
            return Err("authorization_declined".to_string());
        } else if err_code == "expired_token" {
            return Err("expired_token".to_string());
        }
        return Err(format!("Device code poll error: {}", err_code));
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

    let mut data = load_accounts_data(&app)?;
    let is_active = data.accounts.is_empty();
    if is_active {
        for acc in &mut data.accounts {
            acc.is_active = false;
        }
    }

    let new_account = Account {
        id: Uuid::new_v4().to_string(),
        username: profile.name,
        account_type: "Microsoft".to_string(),
        is_active,
        uuid: Some(profile.id),
        access_token: Some(mc_access_token),
        refresh_token,
        expires_at: Some(expires_at),
    };

    data.accounts.push(new_account.clone());
    save_accounts_data(&app, &data)?;

    Ok(new_account)
}

#[tauri::command]
pub async fn add_microsoft_account(app: AppHandle, device_code: String) -> Result<Account, String> {
    poll_microsoft_device_code(app, device_code).await
}

#[tauri::command]
pub async fn add_elyby_account_oauth(app: AppHandle) -> Result<Account, String> {
    let client_id = "elyprism-launcher";
    let auth_url_template = format!(
        "https://account.ely.by/oauth2/v1?client_id={}&response_type=code&scope=account_info+offline_access+minecraft_server_session&prompt=select_account&redirect_uri={{REDIRECT_URI}}",
        client_id
    );

    let (code, redirect_uri) = crate::oauth::start_oauth_flow(&app, &auth_url_template).await?;

    let client = reqwest::Client::new();
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

    if !token_res.status().is_success() {
        return Err(format!("Failed to exchange token: {}", token_res.status()));
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
        return Err("Failed to fetch Minecraft profile".to_string());
    }

    let profile_data: serde_json::Value = profile_res
        .json()
        .await
        .map_err(|_| "Invalid profile response".to_string())?;

    let profile_id = profile_data["id"].as_str().ok_or("No profile ID")?;
    let profile_name = profile_data["name"].as_str().ok_or("No profile name")?;

    let mut data = load_accounts_data(&app)?;
    let is_active = data.accounts.is_empty();
    if is_active {
        for acc in &mut data.accounts {
            acc.is_active = false;
        }
    }

    let new_account = Account {
        id: Uuid::new_v4().to_string(),
        username: profile_name.to_string(),
        account_type: "ElyBy".to_string(),
        is_active,
        uuid: Some(profile_id.to_string()),
        access_token: Some(access_token.to_string()),
        refresh_token,
        expires_at: Some(expires_at),
    };

    data.accounts.push(new_account.clone());
    save_accounts_data(&app, &data)?;

    Ok(new_account)
}

#[tauri::command]
pub async fn add_microsoft_account_oauth(app: AppHandle) -> Result<Account, String> {
    let client_id = "00000000402b5328";
    let auth_url_template = format!(
        "https://login.live.com/oauth20_authorize.srf?client_id={}&response_type=code&scope=service::user.auth.xboxlive.com::MBI_SSL&redirect_uri={{REDIRECT_URI}}",
        client_id
    );

    let (code, redirect_uri) = crate::oauth::start_oauth_flow(&app, &auth_url_template).await?;

    let client = reqwest::Client::new();
    let token_res = client
        .post("https://login.live.com/oauth20_token.srf")
        .form(&[
            ("client_id", client_id),
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("redirect_uri", &redirect_uri),
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

    let mut data = load_accounts_data(&app)?;
    let is_active = data.accounts.is_empty();
    if is_active {
        for acc in &mut data.accounts {
            acc.is_active = false;
        }
    }

    let new_account = Account {
        id: Uuid::new_v4().to_string(),
        username: profile.name,
        account_type: "Microsoft".to_string(),
        is_active,
        uuid: Some(profile.id),
        access_token: Some(mc_access_token),
        refresh_token,
        expires_at: Some(expires_at),
    };

    data.accounts.push(new_account.clone());
    save_accounts_data(&app, &data)?;

    Ok(new_account)
}

pub async fn refresh_account_tokens(app: &AppHandle, account: &mut Account) -> Result<bool, String> {
    let now = chrono::Utc::now().timestamp();
    // Only refresh if expired or about to expire in next 5 minutes
    if let Some(exp) = account.expires_at {
        if now < (exp - 300) {
            return Ok(false);
        }
    }

    let client = reqwest::Client::new();

    if account.account_type == "ElyBy" {
        if let Some(ref_tok) = &account.refresh_token {
            let client_id = "elyprism-launcher";
            let res = client
                .post("https://account.ely.by/api/oauth2/v1/token")
                .form(&[
                    ("client_id", client_id),
                    ("grant_type", "refresh_token"),
                    ("refresh_token", ref_tok),
                ])
                .send()
                .await
                .map_err(|e| format!("Ely.by refresh error: {}", e))?;

            if res.status().is_success() {
                let token_data: serde_json::Value = res.json().await.unwrap_or_default();
                if let Some(acc_tok) = token_data["access_token"].as_str() {
                    account.access_token = Some(acc_tok.to_string());
                    if let Some(new_ref) = token_data["refresh_token"].as_str() {
                        account.refresh_token = Some(new_ref.to_string());
                    }
                    let expires_in = token_data["expires_in"].as_i64().unwrap_or(86400 * 30);
                    account.expires_at = Some(now + expires_in);
                    return Ok(true);
                }
            }
        }
    } else if account.account_type == "Microsoft" {
        if let Some(ref_tok) = &account.refresh_token {
            let client_id = "00000000402b5328";
            let res = client
                .post("https://login.live.com/oauth20_token.srf")
                .form(&[
                    ("client_id", client_id),
                    ("grant_type", "refresh_token"),
                    ("refresh_token", ref_tok),
                ])
                .send()
                .await
                .map_err(|e| format!("MS refresh error: {}", e))?;

            if res.status().is_success() {
                let token_data: serde_json::Value = res.json().await.unwrap_or_default();
                if let Some(ms_acc_tok) = token_data["access_token"].as_str() {
                    if let Some(new_ref) = token_data["refresh_token"].as_str() {
                        account.refresh_token = Some(new_ref.to_string());
                    }
                    let (xbl_token, uhs) = authenticate_xbox_live(&client, ms_acc_tok).await?;
                    let xsts_token = authenticate_xsts(&client, &xbl_token).await?;
                    let (mc_access_token, expires_in) = authenticate_minecraft(&client, &uhs, &xsts_token).await?;
                    account.access_token = Some(mc_access_token);
                    account.expires_at = Some(now + expires_in);
                    return Ok(true);
                }
            }
        }
    }

    Ok(false)
}

#[tauri::command]
pub async fn validate_and_refresh_account(app: AppHandle, id: String) -> Result<Account, String> {
    let mut data = load_accounts_data(&app)?;
    let mut updated_account = None;
    let mut needs_save = false;

    for acc in &mut data.accounts {
        if acc.id == id {
            let changed = refresh_account_tokens(&app, acc).await?;
            if changed {
                needs_save = true;
            }
            updated_account = Some(acc.clone());
            break;
        }
    }

    if needs_save {
        save_accounts_data(&app, &data)?;
    }

    updated_account.ok_or_else(|| "Account not found".to_string())
}
