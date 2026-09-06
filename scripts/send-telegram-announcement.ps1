# Send RedPanda Launcher v0.3.0 Update Announcement to Telegram Channel
param(
    [string]$BotToken = "8692133625:AAGFpKAi5-4Jed2vpJqjc-wcJhMvIQqGAUg",
    [string]$ChatId = "@redpanda_launcher"
)

$ErrorActionPreference = "Stop"

$postText = @"
🔥 <b>ВСТРЕЧАЙТЕ REDPANDA LAUNCHER v0.3.0!</b> 🔥

Мы подготовили масштабное обновление лаунчера! Добавлены долгожданные возможности, улучшена стабильность и полностью обновлен движок версий.

Что нового:
✨ <b>Умный конструктор сборок [BETA]</b>
Больше не нужно вручную подбирать моды и разбираться в крашах! Просто выберите версию (например, 1.20.1 или 1.19.2) и любимые тематики: <b>Магия</b>, <b>Приключения</b>, <b>Технологии</b>, <b>RPG</b>, <b>Оптимизация FPS</b> или <b>Строительство</b>. Лаунчер сам найдет лучшие моды, автоматически подтянет все зависимости и вспомогательные библиотеки (Fabric API, Curios, Architectury и др.) и создаст готовую сборку в 1 клик!

🚀 <b>Поддержка Minecraft 26.x и снапшотов</b>
Разблокирован доступ ко всем современным версиям Minecraft (включая ветку 26.x) и тестовым снапшотам прямо в окне создания инстанса.

☕ <b>Умная привязка Java 21</b>
Лаунчер автоматически выбирает корректную версию среды выполнения для новых релизов и снапшотов — никаких ошибок несовместимости классов.

🎨 <b>Кастомный Color Picker</b>
В настройки добавлен выбор любого HEX-цвета: настраивайте акцентную тему лаунчера под своё настроение!

🛡️ <b>Стабильный поиск CurseForge & Modrinth</b>
Восстановлена стабильная работа каталога CurseForge v1, ускорена многопоточная загрузка файлов и проверка хешей.

⚡ <b>Улучшения стабильности и UI</b>
Снижено потребление памяти лаунчером, оптимизирован интерфейс и ускорен запуск игры.

━━━━━━━━━━━━━━━━━━━━━
🌐 <b>Официальный сайт:</b> <a href="https://redlauncher.ru">redlauncher.ru</a>
📥 <b>Скачать обновление:</b> <a href="https://redlauncher.ru/download">redlauncher.ru/download</a>

Обновляйтесь прямо сейчас и делитесь впечатлениями! 🐾
"@

$uri = "https://api.telegram.org/bot${BotToken}/sendMessage"

$body = @{
    chat_id = $ChatId
    text = $postText
    parse_mode = "HTML"
    disable_web_page_preview = $false
} | ConvertTo-Json -Depth 5

$response = Invoke-RestMethod -Uri $uri -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -ContentType "application/json; charset=utf-8"

if ($response.ok) {
    Write-Host "SUCCESS: Telegram announcement published successfully to $ChatId (Message ID: $($response.result.message_id))" -ForegroundColor Green
    $response.result | ConvertTo-Json
} else {
    Write-Error "FAILED: Telegram API returned error: $($response.description)"
}
