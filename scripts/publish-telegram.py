#!/usr/bin/env python3
"""
Telegram Publisher for RedPanda Launcher
Usage:
    python scripts/publish-telegram.py --test
    python scripts/publish-telegram.py --post-v020
    python scripts/publish-telegram.py --custom-text "Your text here" [--photo path/to/image.png]
"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.parse
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

def load_env():
    env_path = ROOT_DIR / ".env"
    if not env_path.exists():
        return {}
    config = {}
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                config[key.strip()] = val.strip()
    return config

ENV = load_env()
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", ENV.get("TELEGRAM_BOT_TOKEN", ""))
CHANNEL_ID = os.environ.get("TELEGRAM_CHANNEL_ID", ENV.get("TELEGRAM_CHANNEL_ID", "@redpanda_launcher"))

def make_request(method: str, data: dict, files=None):
    if not BOT_TOKEN:
        print("[ERROR] TELEGRAM_BOT_TOKEN is not set in .env")
        sys.exit(1)
        
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    
    if files:
        boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
        body = bytearray()
        for k, v in data.items():
            body.extend(f"--{boundary}\r\n".encode("utf-8"))
            body.extend(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode("utf-8"))
            body.extend(f"{v}\r\n".encode("utf-8"))
            
        for k, (filename, file_bytes) in files.items():
            body.extend(f"--{boundary}\r\n".encode("utf-8"))
            body.extend(f'Content-Disposition: form-data; name="{k}"; filename="{filename}"\r\n'.encode("utf-8"))
            body.extend(b"Content-Type: image/png\r\n\r\n")
            body.extend(file_bytes)
            body.extend(b"\r\n")
            
        body.extend(f"--{boundary}--\r\n".encode("utf-8"))
        req = urllib.request.Request(url, data=bytes(body), headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}"
        })
    else:
        json_bytes = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(url, data=json_bytes, headers={
            "Content-Type": "application/json"
        })
        
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"[ERROR] HTTP {e.code}: {err_body}")
        return json.loads(err_body)
    except Exception as e:
        print(f"[ERROR] Request failed: {e}")
        return {"ok": False, "error": str(e)}

def check_bot():
    res = make_request("getMe", {})
    if res.get("ok"):
        bot = res["result"]
        print(f"[OK] Bot authorized: @{bot.get('username')} ({bot.get('first_name')})")
        return True
    else:
        print(f"[FAIL] Bot authorization failed: {res}")
        return False

def send_post(text: str, photo_path: str = None, buttons: list = None):
    data = {
        "chat_id": CHANNEL_ID,
        "parse_mode": "HTML",
    }
    
    if buttons:
        data["reply_markup"] = json.dumps({
            "inline_keyboard": buttons
        })
        
    if photo_path and os.path.exists(photo_path):
        data["caption"] = text
        with open(photo_path, "rb") as f:
            photo_bytes = f.read()
        res = make_request("sendPhoto", data, files={"photo": (os.path.basename(photo_path), photo_bytes)})
    else:
        data["text"] = text
        res = make_request("sendMessage", data)
        
    if res.get("ok"):
        print(f"[SUCCESS] Post published to {CHANNEL_ID}! Message ID: {res['result']['message_id']}")
    else:
        print(f"[FAILED] Could not send post: {res}")
    return res

def post_v020_release():
    caption = (
        "🐼 <b>RedPanda Launcher v0.2.0 — Глобальное обновление!</b>\n\n"
        "Мы рады представить масштабный релиз с абсолютно новым функционалом, автономным установщиком и расширенными возможностями мультиплеера!\n\n"
        "✨ <b>Что нового в версии 0.2.0:</b>\n"
        "▫️ <b>Кастомный GUI-установщик</b> — стильный Cyber-Brutalist инсталлятор (<code>RedPanda_Setup_0.2.0.exe</code>) с авто-созданием ярлыков и деинсталлятором.\n"
        "▫️ <b>CurseForge + Modrinth</b> — единый каталог модов с автоматической рекурсивной установкой всех зависимостей.\n"
        "▫️ <b>Мультиплеер e4mc & Steam P2P</b> — играйте с друзьями в один клик без белых IP, открытия портов и сторонних программ.\n"
        "▫️ <b>Интерактивный 3D просмотр скинов</b> — с поддержкой Ely.by, Mojang и плащей.\n"
        "▫️ <b>Управление Java & RAM</b> — авто-поиск установленных JVM, экспорт и бэкап инстансов.\n"
        "▫️ <b>Ноль рекламы и телеметрии</b> — моментальный запуск на Rust & Tauri.\n\n"
        "🚀 <i>Лаунчер уже доступен для загрузки на официальном сайте и GitHub!</i>"
    )
    
    buttons = [
        [
            {"text": "📥 Скачать Setup v0.2.0 (.exe)", "url": "https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/v0.2.0/RedPanda_Setup_0.2.0.exe"},
        ],
        [
            {"text": "🌐 Официальный сайт", "url": "https://www.redlauncher.ru/"},
            {"text": "🐙 Репозиторий GitHub", "url": "https://github.com/t1m0nch1k/RedPanda-Launcher"}
        ]
    ]
    
    photo = ROOT_DIR / "installer" / "public" / "logo.png"
    if not photo.exists():
        photo = ROOT_DIR / "logo.png"
    return send_post(caption, str(photo) if photo.exists() else None, buttons)

def post_v021_release():
    caption = (
        "🐼 <b>RedPanda Launcher v0.2.1 — Безопасность, стабильность и новый установщик!</b>\n\n"
        "Мы провели глубокий аудит безопасности (Security Audit) и выпустили обновление <b>v0.2.1</b> с аппаратным шифрованием, авто-обновлением сессий и защитой от race conditions!\n\n"
        "🛡️ <b>Ключевые изменения версии 0.2.1:</b>\n"
        "▫️ <b>Крипто-сейф AES-256-GCM</b> — все токены авторизации шифруются на диске с генерацией криптографически стойких Nonce (<code>OsRng</code>).\n"
        "▫️ <b>Автоматический Refresh сессий</b> — токены Microsoft и Ely.by проверяются и обновляются на лету перед стартом Minecraft.\n"
        "▫️ <b>Microsoft Device Code Flow</b> — бесшовный вход через код устройства.\n"
        "▫️ <b>Потокобезопасность (Мьютексы)</b> — исключены сбои и повреждение конфигураций при одновременных файловых операциях.\n"
        "▫️ <b>Защита от Path Traversal</b> — безопасная распаковка манифестов Modrinth / CurseForge и санитизация путей.\n"
        "▫️ <b>Кастомные соцсети в настройках</b> — управление ссылками сообщества прямо в интерфейсе лаунчера.\n"
        "▫️ <b>Новый инсталлятор <code>RedPanda_Setup_0.2.1.exe</code></b> (38.6 МБ).\n\n"
        "🚀 <i>Скачивайте обновление на сайте или напрямую с GitHub!</i>"
    )
    
    buttons = [
        [
            {"text": "📥 Скачать Setup v0.2.1 (.exe)", "url": "https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/v0.2.1/RedPanda_Setup_0.2.1.exe"},
        ],
        [
            {"text": "🌐 Официальный сайт", "url": "https://www.redlauncher.ru/"},
            {"text": "🐙 Репозиторий GitHub", "url": "https://github.com/t1m0nch1k/RedPanda-Launcher"}
        ]
    ]
    
    photo = ROOT_DIR / "installer" / "public" / "logo.png"
    if not photo.exists():
        photo = ROOT_DIR / "logo.png"
        
    return send_post(caption, str(photo) if photo.exists() else None, buttons)

def main():
    parser = argparse.ArgumentParser(description="RedPanda Launcher Telegram Publisher")
    parser.add_argument("--test", action="store_true", help="Test bot authentication")
    parser.add_argument("--post-v020", action="store_true", help="Publish v0.2.0 release announcement")
    parser.add_argument("--post-v021", action="store_true", help="Publish v0.2.1 release announcement")
    parser.add_argument("--custom-text", type=str, help="Custom message text (HTML supported)")
    parser.add_argument("--photo", type=str, help="Path to photo")
    
    args = parser.parse_args()
    
    if args.test:
        check_bot()
    elif args.post_v020:
        if check_bot():
            post_v020_release()
    elif args.post_v021:
        if check_bot():
            post_v021_release()
    elif args.custom_text:
        if check_bot():
            send_post(args.custom_text, args.photo)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
