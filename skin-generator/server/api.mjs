import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { normalizeSkin, template, parts, faces } from './skin.mjs'

function settings() {
  let env = {}
  try { env = parse(readFileSync(new URL('../.env', import.meta.url))) } catch {}
  return { key: env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || env.GEMINI_MODEL || 'gemini-3.1-flash-image' }
}
export function createApi({ fetchImpl = fetch, getSettings = settings } = {}) {
  let busy = false
  return async (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (!path?.startsWith('/api/')) return next()
    const reply = (status, body) => {
      res.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store' })
      res.end(JSON.stringify(body))
    }
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return reply(403, {error:'Запрос с другого сайта отклонён.'})
    const {key, model} = getSettings()
    if (path === '/api/status' && req.method === 'GET') return reply(200, {configured: Boolean(key), model})
    if (path === '/api/template' && req.method === 'GET') {
      const png = await normalizeSkin(await template())
      res.writeHead(200, {'Content-Type':'image/png'}); return res.end(png)
    }
    if (path !== '/api/generate') return reply(404, {error:'Маршрут не найден.'})
    if (req.method !== 'POST') return reply(405, {error:'Используйте POST.'})
    if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, {error:'Ожидается JSON.'})
    if (!key) return reply(503, {error:'Добавьте GEMINI_API_KEY в skin-generator/.env и нажмите «Проверить подключение».'})
    if (busy) return reply(429, {error:'Генерация уже выполняется. Дождитесь результата.'})
    busy = true
    try {
      let body = ''
      for await (const chunk of req) {
        body += chunk
        if (body.length > 8192) return reply(413, {error:'Слишком длинный запрос.'})
      }
      let payload
      try { payload=JSON.parse(body) } catch { return reply(400, {error:'Некорректный JSON.'}) }
      if (typeof payload?.prompt !== 'string' || !payload.prompt.trim() || payload.prompt.length > 1000) return reply(400, {error:'Введите описание от 1 до 1000 символов.'})
      const style = ['cinematic','neon','survival'].includes(payload.style) ? payload.style : 'cinematic'
      const layout = parts.map(p => `${p.name}: ${JSON.stringify(faces(p))}`).join('\n')
      const guide = await template()
      const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`, {
        method:'POST', headers:{'Content-Type':'application/json','x-goog-api-key':key},
        signal:AbortSignal.timeout(180000),
        body:JSON.stringify({contents:[{parts:[
          {text:`Paint a Minecraft CLASSIC 64x64 UV skin atlas, enlarged to a square 1024x1024 image. Use the attached template as exact geometry, never move or resize its islands. Flat pixel art only: no perspective, character render, labels, borders or grid. Each logical pixel is a uniform 16x16 block. Paint ALL SIX faces of ALL SIX body parts, keeping seams consistent. Background and all unused/outer-layer regions must remain pure magenta #ff00ff. Only the opaque base layer is supported. Face rectangles [x,y,width,height] in logical 64x64 coordinates, ordered top,bottom,right,front,left,back:\n${layout}\nStyle: ${style}. Character description: ${payload.prompt.trim()}`},
          {inlineData:{mimeType:'image/png',data:guide.toString('base64')}}
        ]}],generationConfig:{responseModalities:['TEXT','IMAGE']}})
      })
      if (!response.ok) {
        const messages = {400:'Google отклонил параметры запроса. Проверьте доступность модели.',401:'Google отклонил API-ключ.',403:'Нет доступа к модели: проверьте ключ, проект и регион.',404:'Модель недоступна. Проверьте GEMINI_MODEL в .env.',429:'Превышена квота Google. Проверьте лимиты и биллинг AI Studio.'}
        return reply(502, {error:messages[response.status] || 'Ошибка сервиса Google. Попробуйте позже.'})
      }
      const result = await response.json()
      const image = result.candidates?.[0]?.content?.parts?.find(p => !p.thought && p.inlineData?.mimeType?.startsWith('image/'))?.inlineData
      if (!image?.data) return reply(422, {error:'Google не вернул изображение. Описание могло быть отклонено; попробуйте изменить его.'})
      if (image.data.length > 25000000) return reply(502, {error:'Слишком большое изображение от модели.'})
      const skin = await normalizeSkin(Buffer.from(image.data,'base64'))
      reply(200,{image:`data:image/png;base64,${skin.toString('base64')}`,model,
        warning:'Размер и прозрачность проверены автоматически. Перед использованием осмотрите лицо, спину и швы на 3D-модели.'})
    } catch (error) {
      const message = error.name === 'TimeoutError' ? 'Google не ответил за 3 минуты. Попробуйте позже.' : error.message?.startsWith('Модель ') ? error.message : 'Не удалось получить скин. Проверьте соединение и повторите запрос.'
      reply(502,{error:message})
    } finally { busy=false }
  }
}
