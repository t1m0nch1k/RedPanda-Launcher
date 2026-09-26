# SkinForge

Отдельный MVP-генератор Minecraft-скинов по текстовому описанию.

Проект подключён к Google AI Studio (Nano Banana 2) через локальный сервер. Инструкции по ключу, проверке и ограничениям: [AI-STUDIO.md](AI-STUDIO.md). Превью использует настоящую 3D-модель с той же текстурой, которая скачивается.

## Запуск

Из корня репозитория:

```bash
npm install --prefix skin-generator
npm run dev --prefix skin-generator
```

Сборка:

```bash
npm run build --prefix skin-generator
```

Проект не меняет исходники лаунчера и живёт в собственной папке `skin-generator`.
