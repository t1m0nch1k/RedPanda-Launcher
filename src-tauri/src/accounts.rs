use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Account {
    pub id: String,
    pub username: String,
    pub account_type: String, // "Offline", "Microsoft", "ElyBy"
    pub is_active: bool,
    pub uuid: Option<String>,
    pub access_token: Option<String>,
}

#[derive(Serialize, Deserialize, Default, Clone, Debug)]
pub struct AccountsData {
    pub accounts: Vec<Account>,
}

fn get_accounts_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Could not get app data dir: {}", e))?;

    // Ensure the directory exists
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| format!("Could not create app data dir: {}", e))?;
    }

    path.push("accounts.json");
    Ok(path)
}

fn load_accounts_data(app: &AppHandle) -> Result<AccountsData, String> {
    let path = get_accounts_file_path(app)?;

    if !path.exists() {
        return Ok(AccountsData::default());
    }

    let contents =
        fs::read_to_string(path).map_err(|e| format!("Failed to read accounts.json: {}", e))?;
    let data: AccountsData = serde_json::from_str(&contents).unwrap_or_default();

    Ok(data)
}

fn save_accounts_data(app: &AppHandle, data: &AccountsData) -> Result<(), String> {
    let path = get_accounts_file_path(app)?;
    let contents = serde_json::to_string_pretty(data)
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

    // If this is the first account, make it active
    let is_active = data.accounts.is_empty();

    // If we're making this one active, deactivate all others (just in case, though it's the first)
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

    // If we removed the active account and there are still accounts, make the first one active
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
    // Basic Yggdrasil Auth for Ely.by
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
    // Generate Device Code for Microsoft OAuth (clientId for standard Minecraft Launcher)
    let client_id = "00000000402b5328"; // Standard MS Xbox clientId for Minecraft

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

#[tauri::command]
pub async fn add_microsoft_account(app: AppHandle, device_code: String) -> Result<Account, String> {
    Err("Microsoft auth completion logic requires full Xbox/MC flow implementation. Coming in next step!".to_string())
}

#[tauri::command]
pub async fn add_elyby_account_oauth(app: AppHandle) -> Result<Account, String> {
    let client_id = "elyprism-launcher";
    let auth_url_template = format!(
        "https://account.ely.by/oauth2/v1?client_id={}&response_type=code&scope=account_info+offline_access+minecraft_server_session&prompt=select_account&redirect_uri={{REDIRECT_URI}}",
        client_id
    );

    // 1. Start OAuth flow in browser
    let (code, redirect_uri) = crate::oauth::start_oauth_flow(&app, &auth_url_template).await?;

    // 2. Exchange code for token
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

    // 3. Get profile
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

    // 4. Save account
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

    // 1. Start OAuth flow in browser
    let (code, redirect_uri) = crate::oauth::start_oauth_flow(&app, &auth_url_template).await?;

    // 2. Exchange code for MS access token
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

    // 3. Authenticate with Xbox Live
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
    let xbl_token = xbl_data["Token"].as_str().ok_or("No XBL token")?;
    let uhs = xbl_data["DisplayClaims"]["xui"][0]["uhs"]
        .as_str()
        .ok_or("No user hash")?;

    // 4. Authenticate with XSTS
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
    let xsts_token = xsts_data["Token"].as_str().ok_or("No XSTS token")?;

    // 5. Authenticate with Minecraft
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
        .ok_or("No MC access token")?;

    // 6. Get Profile
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
    let profile_id = profile_data["id"].as_str().ok_or("No profile ID")?;
    let profile_name = profile_data["name"].as_str().ok_or("No profile name")?;

    // 7. Save account
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
        account_type: "Microsoft".to_string(),
        is_active,
        uuid: Some(profile_id.to_string()),
        access_token: Some(mc_access_token.to_string()),
    };

    data.accounts.push(new_account.clone());
    save_accounts_data(&app, &data)?;

    Ok(new_account)
}
