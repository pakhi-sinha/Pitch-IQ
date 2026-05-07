import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import './App.css'

const DEMO_ANALYSIS = [
  {
    shotType: 'cover drive',
    ballType: 'half volley',
    battingHand: 'right',
    pitchLength: 'full',
    shotDirection: 48,
    shotZone: 'off-side',
    isBoundary: true,
    isDefensive: false,
    gamePhase: 'powerplay',
    confidence: 0.94,
    additionalNotes: 'The batter commits forward early and opens the face through extra cover.',
    frameTime: 1.4
  },
  {
    shotType: 'pull shot',
    ballType: 'short of length',
    battingHand: 'right',
    pitchLength: 'short',
    shotDirection: 252,
    shotZone: 'leg-side',
    isBoundary: true,
    isDefensive: false,
    gamePhase: 'middle',
    confidence: 0.88,
    additionalNotes: 'Weight transfers quickly onto the back foot, creating power square of the wicket.',
    frameTime: 3.8
  },
  {
    shotType: 'forward defensive',
    ballType: 'good length',
    battingHand: 'right',
    pitchLength: 'good length',
    shotDirection: 5,
    shotZone: 'straight',
    isBoundary: false,
    isDefensive: true,
    gamePhase: 'middle',
    confidence: 0.9,
    additionalNotes: 'Compact shape and soft hands suggest risk control against seam movement.',
    frameTime: 6.2
  },
  {
    shotType: 'sweep shot',
    ballType: 'full',
    battingHand: 'right',
    pitchLength: 'full',
    shotDirection: 302,
    shotZone: 'leg-side',
    isBoundary: false,
    isDefensive: false,
    gamePhase: 'death',
    confidence: 0.82,
    additionalNotes: 'The shot targets the vacant deep square region and forces a field adjustment.',
    frameTime: 8.1
  }
]

const SHOT_COLORS = {
  'cover drive': '#14b8a6',
  'straight drive': '#22c55e',
  'pull shot': '#f97316',
  'hook shot': '#fb7185',
  'cut shot': '#60a5fa',
  'sweep shot': '#a78bfa',
  'forward defensive': '#94a3b8',
  unknown: '#64748b'
}

const BALL_COLORS = ['#14b8a6', '#f97316', '#60a5fa', '#a78bfa', '#f43f5e', '#eab308']

function App() {
  const [media, setMedia] = useState(null)
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaType, setMediaType] = useState('')
  const [analyses, setAnalyses] = useState([])
  const [activeFrame, setActiveFrame] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState('')
  const [notice, setNotice] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [youtubeId, setYoutubeId] = useState('')
  const [commentary, setCommentary] = useState('')
  const [isCommentaryLoading, setIsCommentaryLoading] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl)
    }
  }, [mediaUrl])

  const stats = useMemo(() => buildStats(analyses), [analyses])
  const shotData = useMemo(() => groupByCount(analyses, 'shotType'), [analyses])
  const ballData = useMemo(() => groupByCount(analyses, 'ballType'), [analyses])
  const story = useMemo(() => createStory(analyses), [analyses])

  const handleFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setNotice('Please upload a cricket image or video file.')
      return
    }

    if (mediaUrl) URL.revokeObjectURL(mediaUrl)
    setMedia(file)
    setMediaUrl(URL.createObjectURL(file))
    setMediaType(file.type.startsWith('image/') ? 'image' : 'video')
    setAnalyses([])
    setCommentary('')
    setNotice('')
    setProgress('')
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setDragOver(false)
    handleFile(event.dataTransfer.files?.[0])
  }

  const handleYoutubeChange = (event) => {
    const value = event.target.value
    setYoutubeUrl(value)
    setYoutubeId(extractYoutubeId(value))
  }

  const runDemo = () => {
    setMedia(null)
    if (mediaUrl) URL.revokeObjectURL(mediaUrl)
    setMediaUrl('')
    setMediaType('')
    setAnalyses(DEMO_ANALYSIS)
    setCommentary('')
    setProgress('Demo analysis loaded.')
    setNotice('Demo mode uses curated cricket data and works without an API key.')
  }

  const analyzeMedia = async () => {
    if (!media) {
      setNotice('Upload match footage first, or run the demo.')
      return
    }

    setIsAnalyzing(true)
    setAnalyses([])
    setCommentary('')
    setNotice('')

    try {
      if (mediaType === 'image') {
        setProgress('Reading image...')
        const frame = await fileToFrame(media)
        setProgress('Sending image to PitchIQ AI...')
        const result = await analyzeFrame(frame.base64, frame.mimeType)
        setAnalyses([{ ...result, frameTime: 0 }])
        setProgress('Analysis complete.')
      } else {
        setProgress('Extracting video frames...')
        const frames = await extractVideoFrames(media, 6)
        if (!frames.length) throw new Error('No usable frames were found in this video.')

        const results = []
        for (let index = 0; index < frames.length; index += 1) {
          setActiveFrame(index)
          setProgress(`Analyzing frame ${index + 1} of ${frames.length}...`)
          const result = await analyzeFrame(frames[index].base64, 'image/jpeg')
          results.push({ ...result, frameTime: frames[index].time })
          setAnalyses([...results])
        }
        setProgress(`Analysis complete. ${results.length} frames processed.`)
      }
    } catch (error) {
      setNotice(`${error.message} Loaded demo data so the dashboard stays usable.`)
      setAnalyses(DEMO_ANALYSIS)
      setProgress('Demo fallback loaded.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const generateCommentary = async () => {
    if (!analyses.length) return
    setIsCommentaryLoading(true)
    setCommentary('')
    try {
      const response = await fetch('/api/commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analyses })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Commentary service unavailable.')
      setCommentary(payload.commentary)
    } catch (error) {
      setCommentary(createCommentaryFallback(analyses))
      setNotice(`${error.message} Showing local commentary instead.`)
    } finally {
      setIsCommentaryLoading(false)
    }
  }

  const exportReport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      stats,
      analyses,
      story,
      commentary
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'pitchiq-report.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI Cricket Intelligence</p>
          <h1>PitchIQ</h1>
          <p className="subtitle">Turn cricket footage into shot maps, tactical reads, and analyst-ready reports.</p>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" onClick={runDemo}>Run demo</button>
          <button className="primary-button" onClick={() => fileInputRef.current?.click()}>Upload footage</button>
        </div>
      </header>

      <section className="hero-grid">
        <div className="panel upload-panel">
          <div
            className={`drop-zone${dragOver ? ' is-dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex="0"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={(event) => handleFile(event.target.files?.[0])}
              hidden
            />
            <span className="drop-kicker">Match footage</span>
            <strong>Drop an image or short clip</strong>
            <p>PitchIQ samples visual action frames, extracts structured cricket data, and builds the dashboard below.</p>
          </div>

          {mediaUrl && (
            <div className="preview-card">
              {mediaType === 'image' ? (
                <img src={mediaUrl} alt="Uploaded cricket frame preview" />
              ) : (
                <video src={mediaUrl} controls />
              )}
              <button className="primary-button full-width" disabled={isAnalyzing} onClick={analyzeMedia}>
                {isAnalyzing ? 'Analyzing...' : 'Analyze footage'}
              </button>
            </div>
          )}

          <div className="youtube-card">
            <label htmlFor="youtube">YouTube reference</label>
            <input
              id="youtube"
              value={youtubeUrl}
              onChange={handleYoutubeChange}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            {youtubeUrl && !youtubeId && <p className="field-error">Enter a valid YouTube match URL.</p>}
            {youtubeId && (
              <div className="youtube-frame">
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}`}
                  title="YouTube cricket reference"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        </div>

        <div className="panel command-panel">
          <p className="eyebrow">Dashboard state</p>
          <h2>{analyses.length ? 'Analysis ready' : 'Ready for match intelligence'}</h2>
          <p>{progress || 'Upload footage, run a demo, or paste a YouTube link for reference.'}</p>
          {notice && <div className="notice">{notice}</div>}
          <div className="stat-grid">
            <Metric label="Frames" value={stats.frames} />
            <Metric label="Boundaries" value={stats.boundaries} />
            <Metric label="Attack rate" value={`${stats.attackRate}%`} />
            <Metric label="Avg confidence" value={`${stats.confidence}%`} />
          </div>
        </div>
      </section>

      {analyses.length > 0 && (
        <section className="results">
          <div className="panel span-two">
            <div className="section-heading">
              <p className="eyebrow">Match story</p>
              <button className="ghost-button small" onClick={exportReport}>Export JSON</button>
            </div>
            <p className="story">{story}</p>
          </div>

          <div className="panel">
            <p className="eyebrow">Wagon wheel</p>
            <WagonWheel analyses={analyses} />
          </div>

          <div className="panel">
            <p className="eyebrow">Shot distribution</p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={shotData}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.16)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#14b8a6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel">
            <p className="eyebrow">Ball mix</p>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={ballData} dataKey="count" nameKey="name" innerRadius={55} outerRadius={86} paddingAngle={3}>
                  {ballData.map((entry, index) => (
                    <Cell key={entry.name} fill={BALL_COLORS[index % BALL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="panel">
            <div className="section-heading">
              <p className="eyebrow">AI commentary</p>
              <button className="ghost-button small" disabled={isCommentaryLoading} onClick={generateCommentary}>
                {isCommentaryLoading ? 'Writing...' : 'Generate'}
              </button>
            </div>
            <p className="commentary">{commentary || createCommentaryFallback(analyses)}</p>
          </div>

          <div className="panel span-two">
            <p className="eyebrow">Delivery timeline</p>
            <div className="timeline">
              {analyses.map((item, index) => (
                <button
                  key={`${item.shotType}-${index}`}
                  className={`timeline-row${activeFrame === index ? ' is-active' : ''}`}
                  onClick={() => setActiveFrame(index)}
                >
                  <span>{item.frameTime ? `${item.frameTime.toFixed(1)}s` : `#${index + 1}`}</span>
                  <strong>{titleCase(item.shotType)}</strong>
                  <span>{titleCase(item.ballType)}</span>
                  <span>{item.isBoundary ? 'Boundary' : item.isDefensive ? 'Defensive' : 'Scoring option'}</span>
                  <span>{Math.round((Number(item.confidence) || 0) * 100)}%</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel span-two">
            <p className="eyebrow">Analyst notes</p>
            <div className="notes-grid">
              {analyses.map((item, index) => (
                <article key={`${item.additionalNotes}-${index}`} className="note-card">
                  <strong>Delivery {index + 1}: {titleCase(item.shotType)}</strong>
                  <p>{item.additionalNotes || 'No additional note returned for this frame.'}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function WagonWheel({ analyses }) {
  const cx = 155
  const cy = 155
  const radius = 128

  const angleToPoint = (degrees, distance) => ({
    x: cx + Math.sin((degrees * Math.PI) / 180) * distance,
    y: cy - Math.cos((degrees * Math.PI) / 180) * distance
  })

  return (
    <svg className="wagon-wheel" viewBox="0 0 310 310" role="img" aria-label="Cricket wagon wheel shot map">
      <ellipse cx={cx} cy={cy} rx={radius} ry={radius * 0.82} className="field-outer" />
      <ellipse cx={cx} cy={cy} rx={radius * 0.48} ry={radius * 0.34} className="field-inner" />
      <rect x={cx - 8} y={cy - 43} width="16" height="86" rx="2" className="pitch-strip" />
      {[-150, -90, -45, 0, 45, 90, 150].map((angle) => {
        const end = angleToPoint(angle, radius * 0.82)
        return <line key={angle} x1={cx} y1={cy} x2={end.x} y2={end.y} className="field-guide" />
      })}
      {analyses.map((shot, index) => {
        const direction = Number(shot.shotDirection) || 0
        const end = angleToPoint(direction, radius * (shot.isBoundary ? 0.82 : 0.56))
        const color = SHOT_COLORS[String(shot.shotType || '').toLowerCase()] || SHOT_COLORS.unknown
        return (
          <g key={`${direction}-${index}`}>
            <line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke={color} className="shot-line" />
            <circle cx={end.x} cy={end.y} r={shot.isBoundary ? 5 : 4} fill={color} className="shot-dot" />
          </g>
        )
      })}
    </svg>
  )
}

async function analyzeFrame(base64, mimeType) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64, mimeType })
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'AI analysis failed.')
  return normalizeAnalysis(payload.analysis)
}

function normalizeAnalysis(value) {
  return {
    shotType: String(value?.shotType || 'unknown'),
    ballType: String(value?.ballType || 'unknown'),
    battingHand: String(value?.battingHand || 'unknown'),
    pitchLength: String(value?.pitchLength || 'unknown'),
    shotDirection: clamp(Number(value?.shotDirection) || 0, 0, 360),
    shotZone: String(value?.shotZone || 'unknown'),
    isBoundary: Boolean(value?.isBoundary),
    isDefensive: Boolean(value?.isDefensive),
    gamePhase: String(value?.gamePhase || 'unknown'),
    confidence: clamp(Number(value?.confidence) || 0.35, 0, 1),
    additionalNotes: String(value?.additionalNotes || 'No note returned.')
  }
}

function fileToFrame(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ base64: String(reader.result).split(',')[1], mimeType: file.type })
    reader.onerror = () => reject(new Error('Could not read the uploaded file.'))
    reader.readAsDataURL(file)
  })
}

function extractVideoFrames(file, count) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    const objectUrl = URL.createObjectURL(file)
    const frames = []

    video.preload = 'auto'
    video.muted = true
    video.src = objectUrl

    video.onloadedmetadata = async () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      if (canvas.width < 240 || canvas.height < 240) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Video resolution is too low for reliable analysis.'))
        return
      }

      const timestamps = Array.from({ length: count }, (_, index) => ((index + 1) * video.duration) / (count + 1))

      for (const time of timestamps) {
        video.currentTime = time
        await new Promise((resolveSeek, rejectSeek) => {
          const timeout = window.setTimeout(() => rejectSeek(new Error('Frame seek timed out.')), 5000)
          video.onseeked = () => {
            window.clearTimeout(timeout)
            resolveSeek()
          }
        })
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        frames.push({ time, base64: canvas.toDataURL('image/jpeg', 0.78).split(',')[1] })
      }

      URL.revokeObjectURL(objectUrl)
      resolve(frames)
    }

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not load this video file.'))
    }
  })
}

function buildStats(analyses) {
  const frames = analyses.length
  const boundaries = analyses.filter((item) => item.isBoundary).length
  const attacking = analyses.filter((item) => !item.isDefensive).length
  const confidence = frames
    ? Math.round((analyses.reduce((sum, item) => sum + (Number(item.confidence) || 0), 0) / frames) * 100)
    : 0

  return {
    frames,
    boundaries,
    attackRate: frames ? Math.round((attacking / frames) * 100) : 0,
    confidence
  }
}

function groupByCount(items, key) {
  const grouped = items.reduce((accumulator, item) => {
    const name = titleCase(item?.[key] || 'unknown')
    accumulator[name] = (accumulator[name] || 0) + 1
    return accumulator
  }, {})

  return Object.entries(grouped).map(([name, count]) => ({ name, count }))
}

function createStory(analyses) {
  if (!analyses.length) return ''
  const stats = buildStats(analyses)
  const topZone = topValue(analyses, 'shotZone')
  const topShot = topValue(analyses, 'shotType')
  const phase = topValue(analyses, 'gamePhase')

  return `PitchIQ reads this passage as a ${stats.attackRate}% attacking sequence, led by ${titleCase(topShot)} options through the ${titleCase(topZone)} region. The most common match phase is ${titleCase(phase)}, with ${stats.boundaries} boundary signal${stats.boundaries === 1 ? '' : 's'} and an average confidence of ${stats.confidence}%.`
}

function createCommentaryFallback(analyses) {
  if (!analyses.length) return ''
  const first = analyses[0]
  const best = [...analyses].sort((a, b) => Number(b.confidence) - Number(a.confidence))[0]
  return `The sequence opens with a ${titleCase(first.shotType)}, and the strongest read is ${titleCase(best.shotType)} against ${titleCase(best.ballType)}. The pattern suggests a batter looking to control scoring zones while still punishing loose length.`
}

function topValue(items, key) {
  return groupByCount(items, key).sort((a, b) => b.count - a.count)[0]?.name || 'unknown'
}

function extractYoutubeId(url) {
  const match = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match?.[1] || ''
}

function titleCase(value) {
  return String(value || 'unknown')
    .replace(/[-_]/g, ' ')
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

export default App
