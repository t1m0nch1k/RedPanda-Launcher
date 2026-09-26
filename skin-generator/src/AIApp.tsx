import { useEffect, useRef, useState } from 'react'
import { SkinViewer, IdleAnimation } from 'skinview3d'
import { Download, Sparkles, LoaderCircle, RefreshCw } from 'lucide-react'

function Preview({ image }: { image: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!canvas.current || !host.current) return
    let viewer: SkinViewer | undefined
    let observer: ResizeObserver | undefined
    let disposed = false
    setError('')
    try {
      viewer = new SkinViewer({ canvas: canvas.current, width: host.current.clientWidth, height: 440 })
      viewer.animation = new IdleAnimation()
      viewer.autoRotate = true
      viewer.controls.enableZoom = true
      viewer.loadSkin(image, { model: 'default' }).catch(() => { if (!disposed) setError('Не удалось загрузить текстуру. Откройте развёртку.') })
      observer = new ResizeObserver(() => { if (viewer && host.current) viewer.width = host.current.clientWidth })
      observer.observe(host.current)
    } catch { setError('3D недоступно в этом браузере. Откройте развёртку.') }
    return () => { disposed = true; observer?.disconnect(); viewer?.dispose() }
  }, [image])
  return <div ref={host} style={{ width: '100%', position: 'relative', zIndex: 1 }}><canvas ref={canvas} aria-label="Вращаемая 3D-модель с текущей текстурой" />{error && <p role="alert">{error}</p>}</div>
}

type Result = { image: string; model: string; warning: string; prompt: string }
export default function AIApp() {
  const [prompt, setPrompt] = useState('Лунный рыцарь с янтарным визором, тёмная сталь, потёртая броня')
  const [style, setStyle] = useState('cinematic')
  const [status, setStatus] = useState<{ configured: boolean; model: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [result, setResult] = useState<Result | null>(null)
  const [history, setHistory] = useState<Result[]>([])
  const [mode, setMode] = useState('3d')
  const [seconds, setSeconds] = useState(0)
  const check = async () => {
    try {
      const response = await fetch('/api/status')
      if (!response.ok) throw new Error()
      setStatus(await response.json()); setError('')
    } catch { setError('Сервер недоступен. Запустите npm run dev в папке skin-generator.') }
  }
  useEffect(() => { void check() }, [])
  useEffect(() => {
    if (!busy) return
    setSeconds(0)
    const timer = window.setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(timer)
  }, [busy])
  async function generate() {
    if (busyRef.current || !prompt.trim() || !status?.configured) return
    busyRef.current = true; setBusy(true); setError('')
    try {
      const response = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style }), signal: AbortSignal.timeout(195000),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Ошибка генерации')
      const next = { ...data, prompt } as Result
      setResult(next); setHistory(old => [next, ...old].slice(0, 8))
    } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка соединения') }
    finally { busyRef.current = false; setBusy(false) }
  }
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand__word">SKINFORGE</span><span className="brand__beta">AI STUDIO</span></a><span className="hero__eyebrow" style={{ margin: 0 }}>Nano Banana 2</span></header>
    <main className="page-wrap">
      <section className="hero"><div className="hero__eyebrow">Твой персонаж начинается с идеи</div><h1>Опиши скин.<br /><em>Оживи его в игре.</em></h1><p className="hero__lead">Генерация с Google AI Studio · Minecraft Classic · PNG 64×64</p></section>
      <section className="workspace-grid">
        <form className="controls-panel panel" style={{ display: 'block' }} onSubmit={e => { e.preventDefault(); void generate() }}>
          <div className="panel__topline"><span className="panel__kicker">01 — ТВОЯ ИДЕЯ</span><Sparkles size={18} /></div>
          <label className="field-label" htmlFor="prompt">Каким будет персонаж?</label>
          <div className="prompt-field"><textarea id="prompt" value={prompt} maxLength={1000} required disabled={busy} onChange={e => setPrompt(e.target.value)} /><span className="prompt-field__count">{prompt.length}/1000</span></div>
          <div className="suggestions">{['Лесной шаман в плаще из мха', 'Киберпанк-пилот с голубым визором', 'Кот в чёрном худи'].map(text => <button className="suggestion" type="button" disabled={busy} key={text} onClick={() => setPrompt(text)}>{text}</button>)}</div>
          <div className="section-divider" />
          <label className="field-label" htmlFor="style">Стиль</label>
          <select id="style" value={style} disabled={busy} onChange={e => setStyle(e.target.value)} style={{ width: '100%', padding: 12, marginTop: 10, background: '#191b1d', color: '#f1f0eb', border: '1px solid #383d3f' }}><option value="cinematic">Детализированный</option><option value="neon">Неон / киберпанк</option><option value="survival">Приключения / выживание</option></select>
          <div className="section-divider" />
          <p className="field-label" role="status">{status === null ? 'Проверяем подключение…' : status.configured ? 'Ключ настроен' : 'Добавьте API-ключ'}</p>
          {status && !status.configured && <p className="hero__lead" style={{ fontSize: 13, marginTop: 10 }}>Откройте <code>skin-generator/.env</code> и вставьте ключ после <code>GEMINI_API_KEY=</code>. Затем проверьте подключение.</p>}
          <button type="button" className="download-button" style={{ margin: '14px 0' }} onClick={() => void check()} disabled={busy}><RefreshCw size={14} /> Проверить подключение</button>
          <button className="generate-button" type="submit" disabled={busy || !status?.configured || !prompt.trim()}>{busy ? <LoaderCircle size={18} className="spin" /> : <Sparkles size={18} />}{busy ? `Генерация · ${seconds} с` : 'Сгенерировать скин'}</button>
          <p className="privacy-note" style={{ display: 'block', lineHeight: 1.6 }}>Описание отправляется Google. Запрос расходует квоту вашего проекта. Ключ хранится только на сервере.</p>
          {error && <p role="alert" style={{ color: '#ffb1a3', marginTop: 16, lineHeight: 1.6 }}>{error}</p>}
        </form>
        <section className="preview-panel panel">
          <div className="panel__kicker">02 — {result ? 'РЕЗУЛЬТАТ' : 'ШАБЛОН ПЕРЕД ГЕНЕРАЦИЕЙ'}</div>
          <div className="preview-tabs">{[['3d', '3D-модель'], ['sheet', 'Развёртка']].map(([id, label]) => <button key={id} type="button" className={`preview-tab ${mode === id ? 'preview-tab--active' : ''}`} aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>)}</div>
          <div className="preview-stage"><div className="stage-grid" />{mode === '3d' ? <Preview image={result?.image || '/api/template'} /> : <img className="skin-sheet" src={result?.image || '/api/template'} alt="Развёртка текущего скина 64 на 64 пикселя" />}</div>
          <div className="preview-footer"><span className="palette-readout">Classic · 64×64 · основной слой</span>{result && <a className="download-button" href={result.image} download="skinforge-skin.png"><Download size={16} /> Скачать PNG</a>}</div>
          <p className="privacy-note" style={{ display: 'block', lineHeight: 1.6 }}>{result ? result.warning : 'Вращайте модель мышью, приближайте колёсиком. Сейчас показан технический шаблон.'}</p>
        </section>
      </section>
      <section className="gallery-section"><div className="section-heading"><h2>Скины этой сессии</h2><span>{history.length}</span></div>{history.length === 0 ? <p className="hero__lead">Здесь появятся ваши генерации. Скачайте понравившиеся скины перед закрытием страницы.</p> : <div className="recent-grid">{history.map((item, i) => <button className="recent-card" key={i} onClick={() => setResult(item)}><img src={item.image} alt="Сохранённая развёртка" style={{ width: '45%', objectFit: 'contain', imageRendering: 'pixelated' }} /><span className="recent-card__info">{item.prompt}</span></button>)}</div>}</section>
    </main><footer className="footer">SKINFORGE · LOCAL AI STUDIO BUILD</footer>
  </div>
}
