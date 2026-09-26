import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  Dices,
  ExternalLink,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Palette,
  RefreshCw,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react'

type StyleKey = 'cinematic' | 'neon' | 'survival'
type PaletteKey = 'ember' | 'ocean' | 'moss' | 'royal' | 'void'

type PaletteDefinition = {
  label: string
  base: string
  shadow: string
  highlight: string
  accent: string
  accentSoft: string
  ink: string
  skin: string
}

const paletteDefinitions: Record<PaletteKey, PaletteDefinition> = {
  ember: {
    label: 'Ember',
    base: '#b9462f',
    shadow: '#612019',
    highlight: '#f18a46',
    accent: '#f5b63d',
    accentSoft: '#6e3b21',
    ink: '#20191a',
    skin: '#c77c58',
  },
  ocean: {
    label: 'Ocean',
    base: '#237a86',
    shadow: '#123d52',
    highlight: '#66c8c1',
    accent: '#d3eddd',
    accentSoft: '#194c62',
    ink: '#111e2a',
    skin: '#ba795e',
  },
  moss: {
    label: 'Moss',
    base: '#56724a',
    shadow: '#25382a',
    highlight: '#adc36d',
    accent: '#ddcb75',
    accentSoft: '#344b37',
    ink: '#18201b',
    skin: '#b7795d',
  },
  royal: {
    label: 'Royal',
    base: '#554a9c',
    shadow: '#27244f',
    highlight: '#b186d7',
    accent: '#f5c56b',
    accentSoft: '#403a78',
    ink: '#1d1a2e',
    skin: '#c68163',
  },
  void: {
    label: 'Void',
    base: '#596070',
    shadow: '#20232f',
    highlight: '#a9b6c8',
    accent: '#d970bc',
    accentSoft: '#3c2f59',
    ink: '#15151e',
    skin: '#a66d64',
  },
}

const styles: Array<{
  id: StyleKey
  name: string
  description: string
  swatches: string[]
}> = [
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Контрастный герой',
    swatches: ['#f5b63d', '#b9462f', '#1d252b'],
  },
  {
    id: 'neon',
    name: 'Neon glitch',
    description: 'Город после полуночи',
    swatches: ['#d970bc', '#237a86', '#9ef0d9'],
  },
  {
    id: 'survival',
    name: 'Worn survival',
    description: 'Пыль, ткань и сталь',
    swatches: ['#adc36d', '#56724a', '#2c2925'],
  },
]

const promptSuggestions = [
  'лунный рыцарь с янтарным визором',
  'киберпанк-исследователь океанских руин',
  'лесной шаман с мхом на броне',
]

const recentSkins = [
  { name: 'Ashen scout', prompt: 'разведчик пустоши в рваном плаще', palette: 'ember' as PaletteKey, style: 'survival' as StyleKey },
  { name: 'Tide runner', prompt: 'пилот подводного города в сине-зелёной броне', palette: 'ocean' as PaletteKey, style: 'neon' as StyleKey },
  { name: 'Moss keeper', prompt: 'страж древнего леса с золотыми рунами', palette: 'moss' as PaletteKey, style: 'cinematic' as StyleKey },
]

const initialPrompt = 'лунный рыцарь с янтарным визором, тёмная сталь, немного потёртостей'

function hashText(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function getPalette(prompt: string, style: StyleKey): PaletteKey {
  const normalized = prompt.toLowerCase()
  if (/океан|вода|мор|волна|подвод|лед|ледян|синий|голуб/.test(normalized)) return 'ocean'
  if (/лес|мох|природ|зелён|зелен|шаман|трав/.test(normalized)) return 'moss'
  if (/корол|золот|маг|руна|фиолет|цар/.test(normalized)) return 'royal'
  if (/космос|пустот|неон|кибер|ноч|туман|void/.test(normalized)) return 'void'
  if (style === 'survival') return 'moss'
  if (style === 'neon') return 'void'
  return 'ember'
}

function drawSkinTexture(
  canvas: HTMLCanvasElement,
  palette: PaletteDefinition,
  prompt: string,
  style: StyleKey,
  hasOverlay: boolean,
  highDetail: boolean,
) {
  const context = canvas.getContext('2d')
  if (!context) return

  const random = hashText(`${prompt}-${style}`)
  const pixel = (x: number, y: number, width: number, height: number, color: string) => {
    context.fillStyle = color
    context.fillRect(x, y, width, height)
  }
  const line = (x: number, y: number, width: number, color: string) => pixel(x, y, width, 1, color)

  context.clearRect(0, 0, 64, 64)
  context.imageSmoothingEnabled = false

  // The 64x64 canvas follows the classic Minecraft skin-sheet proportions.
  pixel(0, 0, 64, 64, palette.ink)

  // Head: top, front, sides and back.
  pixel(8, 0, 8, 8, palette.highlight)
  pixel(16, 0, 8, 8, palette.shadow)
  pixel(0, 8, 8, 8, palette.shadow)
  pixel(8, 8, 8, 8, palette.skin)
  pixel(16, 8, 8, 8, palette.base)
  pixel(24, 8, 8, 8, palette.shadow)
  pixel(8, 8, 8, 2, palette.highlight)
  pixel(10, 12, 2, 2, palette.ink)
  pixel(14, 12, 2, 2, palette.ink)
  pixel(11, 14, 4, 1, palette.shadow)
  pixel(8, 8, 8, 1, palette.ink)
  pixel(16, 8, 8, 1, palette.ink)

  // Torso and shoulders.
  pixel(20, 16, 8, 4, palette.highlight)
  pixel(20, 20, 8, 12, palette.base)
  pixel(28, 20, 4, 12, palette.shadow)
  pixel(16, 20, 4, 12, palette.shadow)
  pixel(22, 20, 4, 2, palette.highlight)
  pixel(20, 28, 8, 2, palette.accentSoft)
  pixel(23, 23, 2, 6, palette.accent)
  line(20, 31, 8, palette.ink)

  // Arms.
  pixel(36, 16, 4, 4, palette.highlight)
  pixel(36, 20, 4, 12, palette.base)
  pixel(40, 20, 4, 12, palette.shadow)
  pixel(44, 16, 4, 4, palette.shadow)
  pixel(44, 20, 4, 12, palette.base)
  pixel(48, 20, 4, 12, palette.shadow)
  pixel(36, 27, 4, 2, palette.accent)
  pixel(44, 25, 4, 2, palette.accentSoft)

  // Legs and boots.
  pixel(4, 16, 4, 4, palette.highlight)
  pixel(4, 20, 4, 12, palette.base)
  pixel(8, 20, 4, 12, palette.shadow)
  pixel(12, 16, 4, 4, palette.highlight)
  pixel(12, 20, 4, 12, palette.base)
  pixel(16, 20, 4, 12, palette.shadow)
  pixel(4, 29, 4, 3, palette.ink)
  pixel(12, 29, 4, 3, palette.ink)

  if (hasOverlay) {
    const overlay = style === 'neon' ? palette.accent : palette.highlight
    pixel(8, 8, 8, 1, overlay)
    pixel(20, 20, 8, 1, overlay)
    pixel(36, 20, 4, 1, overlay)
    pixel(44, 20, 4, 1, overlay)
    pixel(4, 20, 4, 1, overlay)
    pixel(12, 20, 4, 1, overlay)
  }

  if (highDetail) {
    const scratches = [
      [21, 22, 1, 3],
      [26, 24, 1, 4],
      [37, 23, 1, 3],
      [46, 22, 1, 5],
      [5, 23, 1, 4],
      [13, 24, 1, 3],
    ]
    scratches.forEach(([x, y, width, height], index) => {
      if ((random + index) % 3 !== 0) pixel(x, y, width, height, palette.accent)
    })
  }

  // Keep the texture intentionally crisp when it is previewed enlarged.
  context.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  context.lineWidth = 1
  context.strokeRect(0.5, 0.5, 63, 63)
}

function SkinFigure({ palette, style }: { palette: PaletteDefinition; style: StyleKey }) {
  const figureStyle = {
    '--figure-base': palette.base,
    '--figure-shadow': palette.shadow,
    '--figure-highlight': palette.highlight,
    '--figure-accent': palette.accent,
    '--figure-accent-soft': palette.accentSoft,
    '--figure-skin': palette.skin,
  } as CSSProperties

  return (
    <div className={`figure figure--${style}`} style={figureStyle} aria-label="Превью сгенерированного скина">
      <div className="figure__shadow" />
      <div className="figure__arm figure__arm--left" />
      <div className="figure__arm figure__arm--right" />
      <div className="figure__leg figure__leg--left" />
      <div className="figure__leg figure__leg--right" />
      <div className="figure__body">
        <span className="figure__chest-mark" />
        <span className="figure__belt" />
      </div>
      <div className="figure__neck" />
      <div className="figure__head">
        <span className="figure__visor" />
        <span className="figure__face-shadow" />
      </div>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button className={`toggle ${checked ? 'toggle--on' : ''}`} type="button" onClick={() => onChange(!checked)} aria-pressed={checked}>
      <span className="toggle__track"><span className="toggle__thumb" /></span>
      <span>{label}</span>
    </button>
  )
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [prompt, setPrompt] = useState(initialPrompt)
  const [selectedStyle, setSelectedStyle] = useState<StyleKey>('cinematic')
  const [hasOverlay, setHasOverlay] = useState(true)
  const [highDetail, setHighDetail] = useState(true)
  const [previewMode, setPreviewMode] = useState<'figure' | 'sheet'>('figure')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationCount, setGenerationCount] = useState(12)
  const [seed, setSeed] = useState('472819')
  const [copied, setCopied] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const paletteKey = useMemo(() => getPalette(prompt, selectedStyle), [prompt, selectedStyle])
  const palette = paletteDefinitions[paletteKey]

  useEffect(() => {
    if (!canvasRef.current) return
    drawSkinTexture(canvasRef.current, palette, prompt, selectedStyle, hasOverlay, highDetail)
  }, [palette, prompt, selectedStyle, hasOverlay, highDetail, seed])

  const generate = () => {
    if (isGenerating) return
    setIsGenerating(true)
    window.setTimeout(() => {
      const nextSeed = String(Math.floor(100000 + Math.random() * 899999))
      setSeed(nextSeed)
      setGenerationCount((count) => count + 1)
      setIsGenerating(false)
    }, 820)
  }

  const downloadSkin = () => {
    if (!canvasRef.current) return
    canvasRef.current.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `skinforge-${seed}.png`
      link.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const copySeed = async () => {
    await navigator.clipboard?.writeText(seed)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  const applyRecent = (recent: (typeof recentSkins)[number]) => {
    setPrompt(recent.prompt)
    setSelectedStyle(recent.style)
    setPreviewMode('figure')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="SkinForge">
          <span className="brand__mark" aria-hidden="true">
            <i /><i /><i /><i /><i /><i />
          </span>
          <span className="brand__word">SKINFORGE</span>
          <span className="brand__beta">BETA</span>
        </a>

        <nav className={`topnav ${mobileMenuOpen ? 'topnav--open' : ''}`}>
          <a className="topnav__link topnav__link--active" href="#generator">Генератор</a>
          <a className="topnav__link" href="#gallery">Галерея</a>
          <a className="topnav__link" href="#how-it-works">Как это работает</a>
        </nav>

        <div className="topbar__actions">
          <button className="icon-button icon-button--mobile" type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Открыть меню">
            {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <a className="topbar__link" href="#gallery">Мои скины <ArrowUpRight size={14} /></a>
          <button className="avatar-button" type="button" aria-label="Профиль пользователя">A</button>
        </div>
      </header>

      <main id="top" className="page-wrap">
        <section className="hero" id="generator">
          <div className="hero__eyebrow"><span className="eyebrow-dot" /> Локальный генератор · 64×64 ready</div>
          <div className="hero__heading-row">
            <div>
              <h1>Собери скин<br /><em>из одной мысли.</em></h1>
              <p className="hero__lead">Опиши персонажа — мы соберём его стиль,<br className="desktop-break" /> палитру и детали для Minecraft.</p>
            </div>
            <div className="hero__stamp" aria-hidden="true">
              <span>IDEAS</span>
              <strong>→</strong>
              <span>AVATARS</span>
            </div>
          </div>
        </section>

        <section className="workspace-grid">
          <aside className="controls-panel panel">
            <div className="panel__topline">
              <span className="panel__kicker">01 <span /> PROMPT</span>
              <CircleHelp size={15} className="muted-icon" />
            </div>

            <label className="field-label" htmlFor="prompt">Что должно быть на скине?</label>
            <div className="prompt-field">
              <textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={240} />
              <span className="prompt-field__count">{prompt.length}/240</span>
            </div>

            <div className="suggestions">
              {promptSuggestions.map((suggestion) => (
                <button key={suggestion} className="suggestion" type="button" onClick={() => setPrompt(suggestion)}>
                  <Sparkles size={12} /> {suggestion}
                </button>
              ))}
            </div>

            <div className="section-divider" />

            <div className="field-heading">
              <label className="field-label">Направление</label>
              <span className="field-meta">{selectedStyle === 'cinematic' ? '3 / 3' : '1 / 3'}</span>
            </div>
            <div className="style-grid">
              {styles.map((item) => (
                <button key={item.id} className={`style-card ${selectedStyle === item.id ? 'style-card--selected' : ''}`} type="button" onClick={() => setSelectedStyle(item.id)}>
                  <span className="style-card__swatches">
                    {item.swatches.map((swatch) => <i key={swatch} style={{ backgroundColor: swatch }} />)}
                  </span>
                  <span className="style-card__name">{item.name}</span>
                  <span className="style-card__description">{item.description}</span>
                  {selectedStyle === item.id && <Check size={14} className="style-card__check" />}
                </button>
              ))}
            </div>

            <button className="advanced-toggle" type="button" onClick={() => setHasOverlay(!hasOverlay)}>
              <span><Layers3 size={14} /> Детали слоя</span>
              <ChevronDown size={15} className={hasOverlay ? 'advanced-toggle__chevron advanced-toggle__chevron--open' : 'advanced-toggle__chevron'} />
            </button>
            <div className="toggles-row">
              <Toggle checked={hasOverlay} onChange={setHasOverlay} label="Overlays" />
              <Toggle checked={highDetail} onChange={setHighDetail} label="HD detail" />
            </div>

            <button className="generate-button" type="button" onClick={generate} disabled={isGenerating}>
              {isGenerating ? <LoaderCircle size={17} className="spin" /> : <WandSparkles size={17} />}
              <span>{isGenerating ? 'Собираем скин…' : 'Сгенерировать скин'}</span>
              <span className="generate-button__shortcut">⌘ ↵</span>
            </button>
            <p className="privacy-note"><LockKeyhole size={12} /> Описание остаётся на устройстве</p>
          </aside>

          <section className="preview-panel panel">
            <div className="preview-panel__header">
              <div>
                <div className="panel__kicker">02 <span /> LIVE PREVIEW</div>
                <div className="preview-title-row"><h2>{palette.label} sentinel</h2><span className="status-pill"><i /> READY</span></div>
              </div>
              <div className="preview-panel__actions">
                <button className="icon-button" type="button" onClick={() => setSeed(String(Math.floor(100000 + Math.random() * 899999)))} aria-label="Случайный вариант"><RefreshCw size={16} /></button>
                <button className="icon-button" type="button" aria-label="Дополнительные действия"><MoreHorizontal size={18} /></button>
              </div>
            </div>

            <div className="preview-tabs" role="tablist" aria-label="Режим просмотра">
              <button className={previewMode === 'figure' ? 'preview-tab preview-tab--active' : 'preview-tab'} type="button" onClick={() => setPreviewMode('figure')} role="tab" aria-selected={previewMode === 'figure'}>3D PREVIEW</button>
              <button className={previewMode === 'sheet' ? 'preview-tab preview-tab--active' : 'preview-tab'} type="button" onClick={() => setPreviewMode('sheet')} role="tab" aria-selected={previewMode === 'sheet'}>SKIN SHEET</button>
            </div>

            <div className={`preview-stage ${previewMode === 'sheet' ? 'preview-stage--sheet' : ''}`}>
              <div className="stage-grid" />
              <div className="stage-noise" />
              {previewMode === 'figure' ? <SkinFigure palette={palette} style={selectedStyle} /> : <canvas className="skin-sheet" ref={canvasRef} width={64} height={64} />}
              <div className="stage-label stage-label--top">{previewMode === 'figure' ? 'FRONT / IDLE' : '64 × 64 / CLASSIC'}</div>
              <div className="stage-label stage-label--bottom">SEED <button type="button" onClick={copySeed}>{copied ? <Check size={11} /> : <span>#</span>} {seed}</button></div>
              <span className="stage-corner stage-corner--one" /><span className="stage-corner stage-corner--two" /><span className="stage-corner stage-corner--three" /><span className="stage-corner stage-corner--four" />
            </div>

            <div className="preview-footer">
              <div className="palette-readout"><span className="palette-dot" style={{ backgroundColor: palette.accent }} /><span><b>Palette</b> {palette.label} <small>· 5 colors</small></span></div>
              <button className="download-button" type="button" onClick={downloadSkin}><Download size={15} /> Скачать PNG <ExternalLink size={12} /></button>
            </div>
          </section>
        </section>

        <section className="meta-strip">
          <div className="meta-stat"><span className="meta-stat__number">{generationCount}</span><span className="meta-stat__label">скина создано<br />в этой сессии</span></div>
          <div className="meta-note"><Palette size={17} /><span>Каждая генерация — новый<br /><b>seed</b>, но идея остаётся твоей.</span></div>
          <button className="meta-link" type="button" onClick={() => setPrompt('киберпанк-исследователь океанских руин')}><Dices size={15} /> Попробовать пример <ArrowUpRight size={14} /></button>
        </section>

        <section className="gallery-section" id="gallery">
          <div className="section-heading"><div><div className="panel__kicker">03 <span /> RECENT BUILDS</div><h2>Последние идеи</h2></div><button className="text-button" type="button">Открыть галерею <ArrowUpRight size={14} /></button></div>
          <div className="recent-grid">
            {recentSkins.map((recent) => (
              <button className="recent-card" type="button" key={recent.name} onClick={() => applyRecent(recent)}>
                <span className="recent-card__art" style={{ '--recent-base': paletteDefinitions[recent.palette].base, '--recent-shadow': paletteDefinitions[recent.palette].shadow, '--recent-accent': paletteDefinitions[recent.palette].accent } as CSSProperties}>
                  <span className="mini-figure"><i className="mini-figure__head" /><i className="mini-figure__body" /><i className="mini-figure__legs" /></span>
                </span>
                <span className="recent-card__info"><span className="recent-card__name">{recent.name}</span><span className="recent-card__prompt">{recent.prompt}</span><span className="recent-card__open">Открыть <ArrowUpRight size={13} /></span></span>
              </button>
            ))}
            <button className="new-build-card" type="button" onClick={() => document.getElementById('prompt')?.focus()}><span><Sparkles size={18} /></span><b>Новая идея</b><small>Начни с чистого листа</small></button>
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="how-section__copy"><div className="panel__kicker">MADE FOR MINECRAFT</div><h2>От мысли до<br /><em>персонажа</em> — три шага.</h2></div>
          <div className="how-steps"><div><span>01</span><h3>Опиши</h3><p>Характер, одежда, цвет — чем живее образ, тем точнее результат.</p></div><div><span>02</span><h3>Настрой</h3><p>Выбери настроение и добавь слои: от рун до потёртой брони.</p></div><div><span>03</span><h3>Играй</h3><p>Скачай PNG, загрузи в Minecraft и забери свой новый образ.</p></div></div>
        </section>
      </main>

      <footer className="footer"><span>SKINFORGE / 2026</span><span>crafted for block people <span className="footer__heart">♥</span></span><span>v0.1 LOCAL BUILD</span></footer>
    </div>
  )
}

export default App
