use std::net::SocketAddr;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::time::timeout;

/// Starts a temporary local HTTP server on a random port, opens the given authorization URL in the browser,
/// and waits for a callback with the `code` query parameter.
pub async fn start_oauth_flow(
    app: &tauri::AppHandle,
    auth_url_template: &str, // e.g. "https://login.live.com/oauth20_authorize.srf?client_id=...&response_type=code&redirect_uri={REDIRECT_URI}"
) -> Result<(String, String), String> {
    // Returns (code, redirect_uri)
    // 1. Start a local TCP listener on a random port
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind to local port: {}", e))?;

    let local_addr: SocketAddr = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?;

    let redirect_uri = format!("http://127.0.0.1:{}/auth/callback", local_addr.port());

    // 2. Format the URL and open the browser
    let auth_url = auth_url_template.replace("{REDIRECT_URI}", &urlencoding::encode(&redirect_uri));

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
            let mut buffer = [0; 2048];
            
            if let Ok(bytes_read) = socket.read(&mut buffer).await {
                if bytes_read > 0 {
                    let request_line = String::from_utf8_lossy(&buffer[..bytes_read]);
                    
                    // Parse the GET request line e.g., "GET /auth/callback?code=abc... HTTP/1.1"
                    if let Some(line) = request_line.lines().next() {
                        if line.starts_with("GET /auth/callback") {
                            // Extract code
                            let mut code = None;
                            if let Some(query_start) = line.find('?') {
                                if let Some(query_end) = line.find(" HTTP") {
                                    let query = &line[query_start + 1..query_end];
                                    for pair in query.split('&') {
                                        if let Some((k, v)) = pair.split_once('=') {
                                            if k == "code" {
                                                code = Some(v.to_string());
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                            
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
                            
                            if let Some(c) = code {
                                return Ok(c);
                            }
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
        Ok(Ok(code)) => Ok((code, redirect_uri)),
        Ok(Err(e)) => Err(format!("Socket error: {}", e)),
        Err(_) => Err("Timeout waiting for authorization".to_string()),
    }
}
