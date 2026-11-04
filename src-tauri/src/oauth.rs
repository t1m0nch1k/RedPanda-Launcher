use aes_gcm::aead::{rand_core::RngCore, OsRng};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use reqwest::Url;
use sha2::{Digest, Sha256};
use std::net::SocketAddr;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::time::timeout;
use uuid::Uuid;

/// Starts a temporary local HTTP server on a random port, opens the given authorization URL in the browser,
/// and waits for a callback with the `code` query parameter.
pub async fn start_oauth_flow(
    app: &tauri::AppHandle,
    auth_url_template: &str, // e.g. "https://login.live.com/oauth20_authorize.srf?client_id=...&response_type=code&redirect_uri={REDIRECT_URI}"
) -> Result<(String, String, String), String> {
    // Returns (code, redirect_uri, PKCE code_verifier)
    // 1. Start a local TCP listener on a random port
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind to local port: {}", e))?;

    let local_addr: SocketAddr = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?;

    let redirect_uri = format!("http://127.0.0.1:{}/auth/callback", local_addr.port());
    let state = Uuid::new_v4().to_string();
    let mut verifier_bytes = [0u8; 32];
    OsRng.fill_bytes(&mut verifier_bytes);
    let code_verifier = URL_SAFE_NO_PAD.encode(verifier_bytes);
    let code_challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(code_verifier.as_bytes()));

    // 2. Format the URL and open the browser
    let auth_url = auth_url_template
        .replace("{REDIRECT_URI}", &urlencoding::encode(&redirect_uri))
        .replace("{STATE}", &urlencoding::encode(&state))
        .replace("{CODE_CHALLENGE}", &urlencoding::encode(&code_challenge));

    // Use tauri-plugin-opener to open the URL
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    // 3. Wait for the browser to redirect back to us
    // We set a timeout of 5 minutes just in case the user closes the browser
    let result: Result<std::io::Result<String>, tokio::time::error::Elapsed> = timeout(Duration::from_secs(300), async {
        loop {
            let (mut socket, _) = listener.accept().await?;
            let mut buffer: Vec<u8> = Vec::with_capacity(2048);
            let mut chunk = [0u8; 2048];

            // Один «зависший» клиент не должен блокировать колбэк: читаем с
            // таймаутом на соединение и ограничиваем запрос 16 КиБ.
            loop {
                match tokio::time::timeout(Duration::from_secs(5), socket.read(&mut chunk)).await {
                    Ok(Ok(0)) => break,
                    Ok(Ok(bytes_read)) => {
                        buffer.extend_from_slice(&chunk[..bytes_read]);
                        if buffer.windows(4).any(|window| window == b"\r\n\r\n")
                            || buffer.len() >= 16 * 1024
                        {
                            break;
                        }
                    }
                    Ok(Err(_)) | Err(_) => break,
                }
            }

            if !buffer.is_empty() {
                {
                    let request_line = String::from_utf8_lossy(&buffer);

                    if let Some(line) = request_line.lines().next() {
                        let mut code = None;
                        if let Some(target) = line
                            .strip_prefix("GET ")
                            .and_then(|value| value.split_whitespace().next())
                        {
                            if let Ok(url) = Url::parse(&format!("http://localhost{target}")) {
                                let callback_state = url
                                    .query_pairs()
                                    .find(|(key, _)| key == "state")
                                    .map(|(_, value)| value.into_owned());
                                if url.path() != "/auth/callback"
                                    || callback_state.as_deref() != Some(state.as_str())
                                {
                                    let response = "HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                                    let _ = socket.write_all(response.as_bytes()).await;
                                    continue;
                                }
                                // Authorization codes are opaque and may contain '+'
                                // (Ely.by issues base64 codes). `query_pairs` applies
                                // form decoding, turning '+' into a space and corrupting
                                // the code, so we percent-decode the raw value ourselves.
                                code = extract_query_param_raw(target, "code");
                            }
                        }

                        if let Some(code) = code {
                            // Send success response to browser
                            let response_body = r#"
                                <!DOCTYPE html>
                                <html>
                                <head>
                                    <meta charset="utf-8">
                                    <title>Авторизация успешна / Auth successful</title>
                                    <style>
                                        body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #121212; color: #ffffff; }
                                        .container { text-align: center; padding: 40px; background: #1e1e1e; border-radius: 16px; border: 1px solid #333; }
                                        h1 { margin-top: 0; color: #4ade80; }
                                    </style>
                                </head>
                                <body>
                                    <div class="container">
                                        <h1>Успешный вход!</h1>
                                        <p>Вы успешно авторизовались.</p>
                                        <p>Теперь вы можете закрыть эту вкладку и вернуться в лаунчер.</p>
                                    </div>
                                    <script>window.close();</script>
                                </body>
                                </html>
                            "#;

                            let response = format!(
                                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",
                                response_body.len(),
                                response_body
                            );

                            let _ = socket.write_all(response.as_bytes()).await;
                            let _ = socket.flush().await;

                            return Ok(code);
                        }
                    }

                    // Send 404 for favicon and other requests
                    let not_found = "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n";
                    let _ = socket.write_all(not_found.as_bytes()).await;
                }
            }
        }
    }).await;

    match result {
        Ok(Ok(code)) => Ok((code, redirect_uri, code_verifier)),
        Ok(Err(e)) => Err(format!("Socket error: {}", e)),
        Err(_) => Err("Timeout waiting for authorization".to_string()),
    }
}

/// Extracts a query parameter from a raw request target without applying
/// `application/x-www-form-urlencoded` semantics, so a literal `+` stays `+`.
fn extract_query_param_raw(target: &str, name: &str) -> Option<String> {
    let query = target.split_once('?')?.1;
    let query = query.split('#').next().unwrap_or(query);
    for pair in query.split('&') {
        let (key, value) = match pair.split_once('=') {
            Some(parts) => parts,
            None => continue,
        };
        if key == name {
            return Some(percent_decode_keep_plus(value));
        }
    }
    None
}

fn percent_decode_keep_plus(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let (Some(high), Some(low)) =
                (hex_digit(bytes[index + 1]), hex_digit(bytes[index + 2]))
            {
                out.push(high * 16 + low);
                index += 3;
                continue;
            }
        }
        out.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn hex_digit(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}
