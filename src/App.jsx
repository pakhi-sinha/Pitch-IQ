import { useState, useRef, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import './App.css'

function AnimatedNumber({ value, suffix = "" }) {
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplayValue(0);
      return;
    }
    let start = 0;
    const end = value;
    const duration = 1000;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuad = (t) => t * (2 - t);
      const current = Math.floor(easeOutQuad(progress) * end);
      setDisplayValue(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [value]);

  return <span>{displayValue}{suffix}</span>;
}

const CRICKET_PROMPT = `Return ONLY valid JSON. No explanation, no markdown.

You are a cricket analyst AI. Analyze the image and detect:
* shotType (cover drive, pull, cut, sweep, defensive, etc.)
* ballType (yorker, bouncer, good length, full toss)
* battingHand (left or right)
* pitchLength (short, good length, full)
* shotDirection (0–360 degrees, where 0 = straight down the ground)
* shotZone (off-side, leg-side, straight)
* isBoundary (true/false)
* isDefensive (true/false)
* gamePhase (powerplay, middle, death)
* confidence (0 to 1)
* additionalNotes (short cricket reasoning)

Return in EXACT format:
{
"shotType": "...",
"ballType": "...",
"battingHand": "...",
"pitchLength": "...",
"shotDirection": 0,
"shotZone": "...",
"isBoundary": true,
"isDefensive": false,
"gamePhase": "...",
"confidence": 0.0,
"additionalNotes": "..."
}`;

function isValidCricketFrame(img) {
  return img.width >= 300 && img.height >= 300;
}

const MOCK_DATA = [
  { shotType: "forward defensive", ballType: "good length", shotDirection: 0, shotZone: "straight", isBoundary: false, isDefensive: true, gamePhase: "powerplay", confidence: 0.92, frameTime: 1.2 },
  { shotType: "cover drive", ballType: "half-volley", shotDirection: 45, shotZone: "off-side", isBoundary: true, isDefensive: false, gamePhase: "powerplay", confidence: 0.95, frameTime: 2.5 },
  { shotType: "pull shot", ballType: "short of length", shotDirection: 270, shotZone: "leg-side", isBoundary: true, isDefensive: false, gamePhase: "middle", confidence: 0.88, frameTime: 4.1 },
  { shotType: "straight drive", ballType: "good length", shotDirection: 0, shotZone: "straight", isBoundary: false, isDefensive: false, gamePhase: "middle", confidence: 0.91, frameTime: 5.8 },
  { shotType: "cut shot", ballType: "short of length", shotDirection: 90, shotZone: "off-side", isBoundary: false, isDefensive: false, gamePhase: "death", confidence: 0.85, frameTime: 7.3 },
  { shotType: "slog sweep", ballType: "full toss", shotDirection: 300, shotZone: "leg-side", isBoundary: true, isDefensive: false, gamePhase: "death", confidence: 0.78, frameTime: 8.9 }
];

function generateMatchStory(deliveries) {
  if (!deliveries || deliveries.length === 0) return "";
  const total = deliveries.length;
  const boundaries = deliveries.filter(d => d && d.isBoundary).length;
  const firstHalf = deliveries.slice(0, Math.ceil(total / 2));
  const secondHalf = deliveries.slice(Math.ceil(total / 2));
  const firstHalfAggro = firstHalf.filter(d => d && !d.isDefensive).length / firstHalf.length;
  const secondHalfAggro = secondHalf.length > 0 ? secondHalf.filter(d => d && !d.isDefensive).length / secondHalf.length : 0;
  
  let story = "";
  if (firstHalfAggro < 0.5) story += "The innings began cautiously with a focus on defensive stability. ";
  else story += "The batter took an aggressive stance right from the opening deliveries. ";
  
  const dominantZone = Object.entries(deliveries.reduce((acc, d) => {
    if (d && d.shotZone && d.shotZone !== 'unknown') acc[d.shotZone] = (acc[d.shotZone] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'various zones';
  
  story += `Play was primarily concentrated in the ${dominantZone} area, showing a clear regional preference. `;
  if (secondHalfAggro > firstHalfAggro) story += "As the session progressed, there was a noticeable shift toward high-risk, high-reward stroke play. ";
  
  if (boundaries > 0) story += `The performance was punctuated by ${boundaries} boundary-scoring shots that effectively disrupted the bowling rhythm.`;
  else story += "Despite the lack of boundaries, the batter maintained strike rotation through consistent placement.";
  return story;
}

async function callGeminiVision(base64, mimeType) {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: CRICKET_PROMPT }
            ]
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
        })
      }
    );
    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const clean = raw.replace(/```json|```/g, '').trim();
    try {
      return JSON.parse(clean);
    } catch (err) {
      return null;
    }
  } catch (error) {
    return null;
  }
}

const SHOT_COLORS = {
  "cover drive": "#10b981",
  "off drive": "#34d399",
  "on drive": "#6ee7b7",
  "straight drive": "#059669",
  "pull shot": "#f59e0b",
  "hook shot": "#fbbf24",
  "cut shot": "#3b82f6",
  "sweep shot": "#60a5fa",
  "flick": "#8b5cf6",
  "slog": "#ef4444",
  "defensive push": "#6b7280",
  "forward defensive": "#9ca3af",
  "leave": "#374151",
  "loft": "#f97316",
  "scoop": "#fb923c",
  "ramp": "#fdba74",
};

const BALL_COLORS = {
  "yorker": "#ef4444",
  "full toss": "#f97316",
  "good length": "#3b82f6",
  "short of length": "#8b5cf6",
  "bouncer": "#ec4899",
  "half-volley": "#22c55e",
  "wide": "#f59e0b",
  "unknown": "#94a3b8",
};

function WagonWheel({ analyses }) {
  const cx = 155, cy = 155, r = 130;
  const angleToXY = (deg, radius) => ({
    x: cx + radius * Math.sin(deg * Math.PI / 180),
    y: cy - radius * Math.cos(deg * Math.PI / 180)
  });
  const getC = (shot) => SHOT_COLORS[(shot || "").toLowerCase()] || "#94a3b8";
  const zones = [
    { label: "Fine Leg", a: -155 },
    { label: "Sq Leg", a: -90 },
    { label: "Mid-Wkt", a: -50 },
    { label: "Mid-On", a: -22 },
    { label: "Straight", a: 0 },
    { label: "Mid-Off", a: 22 },
    { label: "Cover", a: 55 },
    { label: "Point", a: 90 },
    { label: "3rd Man", a: 155 },
  ];
  const valid = analyses.filter(a => a && a.shotZone !== "unknown" && a.confidence !== "low");
  return (
    <svg viewBox="0 0 310 310" width="100%" style={{ maxWidth: 280, display: "block", margin: "0 auto" }}>
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.82} fill="#14532d" stroke="#4ade80" strokeWidth={1.5} />
      <ellipse cx={cx} cy={cy} rx={r * 0.45} ry={r * 0.37} fill="none" stroke="#4ade80" strokeWidth={0.8} strokeDasharray="5,3" opacity={0.5} />
      <rect x={cx - 8} y={cy - 42} width={16} height={84} rx={2} fill="#a8a29e" opacity={0.5} />
      <rect x={cx - 8} y={cy - 44} width={16} height={4} rx={1} fill="#fbbf24" />
      <rect x={cx - 8} y={cy + 40} width={16} height={4} rx={1} fill="#fbbf24" />
      {zones.map(z => {
        const e = angleToXY(z.a, r * 0.82);
        const l = angleToXY(z.a, r * 0.96);
        return (
          <g key={z.label}>
            <line x1={cx} y1={cy} x2={e.x} y2={e.y} stroke="#4ade80" strokeWidth={0.4} opacity={0.2} />
            <text x={l.x} y={l.y + 2} textAnchor="middle" fontSize="7" fill="#86efac" fontFamily="monospace">{z.label}</text>
          </g>
        );
      })}
      {valid.map((s, i) => {
        const ang = typeof s.shotDirection === "number" ? s.shotDirection : 0;
        const dist = s.isBoundary ? 0.82 : 0.55;
        const e = angleToXY(ang, r * dist);
        const c = getC(s.shotType);
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={e.x} y2={e.y} stroke={c} strokeWidth={1.8} opacity={0.85} />
            <circle cx={e.x} cy={e.y} r={3.5} fill={c} stroke="white" strokeWidth={0.5} />
          </g>
        );
      })}
      {valid.length === 0 && (
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fill="#86efac" fontFamily="monospace" opacity={0.5}>Analyze shots to plot</text>
      )}
    </svg>
  );
}

function App() {
  // ===== State =====
  const [media, setMedia] = useState(null)
  const [mediaType, setMediaType] = useState(null)        // 'image' | 'video'
  const [mediaURL, setMediaURL] = useState('')
  const [analyses, setAnalyses] = useState([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState('')
  const [activeFrame, setActiveFrame] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [commentary, setCommentary] = useState('')
  const [isCommentaryLoading, setIsCommentaryLoading] = useState(false)
  const [warningMessage, setWarningMessage] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [youtubeId, setYoutubeId] = useState(null)
  const [youtubeError, setYoutubeError] = useState('')
  const [youtubeTimestamp, setYoutubeTimestamp] = useState('')
  const [youtubeClipMessage, setYoutubeClipMessage] = useState('')
  const [displayInsight, setDisplayInsight] = useState('')
  const [displayStory, setDisplayStory] = useState('')

  const fileInputRef = useRef(null)

  // Typing effect for Match Story
  useEffect(() => {
    if (analyses.length > 0) {
      const story = generateMatchStory(analyses);
      let i = 0;
      setDisplayStory('');
      const timer = setInterval(() => {
        setDisplayStory(story.slice(0, i + 1));
        i++;
        if (i >= story.length) clearInterval(timer);
      }, 20);
      return () => clearInterval(timer);
    }
  }, [analyses]);

  // Typing effect for Match Insights
  useEffect(() => {
    if (analyses.length > 0) {
      const dominantZone = Object.entries(analyses.reduce((acc, a) => {
        if (a && a.shotZone && a.shotZone !== 'unknown') acc[a.shotZone] = (acc[a.shotZone] || 0) + 1;
        return acc;
      }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'various';

      const dominantPhase = Object.entries(analyses.reduce((acc, a) => {
        if (a && a.gamePhase && a.gamePhase !== 'unknown') acc[a.gamePhase] = (acc[a.gamePhase] || 0) + 1;
        return acc;
      }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'all phases';

      const dominantShot = Object.entries(analyses.reduce((acc, a) => {
        if (a && a.shotType && a.shotType !== 'unknown') acc[a.shotType] = (acc[a.shotType] || 0) + 1;
        return acc;
      }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed shots';

      const text = `This batter prefers ${dominantZone} shots during ${dominantPhase} with a tendency toward ${dominantShot}.`;
      
      let i = 0;
      setDisplayInsight('');
      const timer = setInterval(() => {
        setDisplayInsight(text.slice(0, i + 1));
        i++;
        if (i >= text.length) clearInterval(timer);
      }, 30);
      return () => clearInterval(timer);
    }
  }, [analyses]);

  // ===== File Handling =====
  const handleFile = (file) => {
    if (!file) return
    if (mediaURL) URL.revokeObjectURL(mediaURL)
    const url = URL.createObjectURL(file)
    setMedia(file)
    setMediaURL(url)
    setAnalyses([])
    setProgress('')
    setActiveFrame(0)
    setWarningMessage('')
    if (file.type.startsWith('image/')) setMediaType('image')
    else if (file.type.startsWith('video/')) setMediaType('video')
    else setMediaType(null)
  }

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    const files = e.dataTransfer.files
    if (files && files.length > 0) handleFile(files[0])
  }

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }
  const handleInputChange = (e) => { if (e.target.files && e.target.files.length > 0) handleFile(e.target.files[0]) }

  const handleYoutubeChange = (e) => {
    const url = e.target.value; setYoutubeUrl(url); setYoutubeError('');
    if (!url) { setYoutubeId(null); return; }
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) setYoutubeId(match[2]);
    else { setYoutubeId(null); setYoutubeError('Invalid YouTube URL'); }
  };

  const extractVideoFrames = (file, count = 6) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const url = URL.createObjectURL(file)
      const frames = []
      video.preload = 'auto'; video.muted = true; video.src = url
      video.onloadedmetadata = async () => {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight
        if (!isValidCricketFrame(canvas)) { URL.revokeObjectURL(url); return resolve([]); }
        const duration = video.duration; const timestamps = []
        for (let i = 0; i < count; i++) timestamps.push((duration / (count + 1)) * (i + 1))
        for (let i = 0; i < timestamps.length; i++) {
          try {
            video.currentTime = timestamps[i]
            await new Promise((res, rej) => {
              video.onseeked = res; video.onerror = rej;
              setTimeout(() => rej(new Error("Seek timeout")), 5000);
            })
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const base64 = canvas.toDataURL('image/jpeg', 0.75).split(',')[1]
            frames.push({ time: timestamps[i], base64: base64 })
          } catch (e) {}
        }
        URL.revokeObjectURL(url); resolve(frames)
      }
      video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load video')); }
    })
  }

  const handleAnalyze = async () => {
    if (!media) return
    setIsAnalyzing(true); setAnalyses([]); setWarningMessage(''); setProgress('Preparing analysis...')
    try {
      if (mediaType === 'image') {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = () => reject(new Error('Failed to read image')); reader.readAsDataURL(media)
        })
        const img = new Image(); img.src = `data:${media.type};base64,${base64}`
        await new Promise(r => { img.onload = r; img.onerror = r })
        if (!isValidCricketFrame(img)) { setWarningMessage('⚠️ Please upload a clear cricket action image.'); setProgress(''); return; }
        const result = await callGeminiVision(base64, media.type)
        if (!result) { setWarningMessage('Analysis failed.'); setProgress(''); return; }
        setAnalyses([result]); setProgress('Analysis complete.')
      } else if (mediaType === 'video') {
        const frames = await extractVideoFrames(media, 6)
        if (frames.length === 0) { setWarningMessage('⚠️ Please upload a clear cricket action video.'); setProgress(''); return; }
        const results = []
        for (let i = 0; i < frames.length; i++) {
          const frame = frames[i]; setActiveFrame(i); setProgress(`Analyzing frame ${i + 1} of ${frames.length}...`)
          const result = await callGeminiVision(frame.base64, 'image/jpeg')
          if (result) results.push({ ...result, frameTime: frame.time })
          setAnalyses([...results])
        }
        if (results.length === 0) { setWarningMessage('⚠️ Analysis failed. Please ensure the footage is clear.'); setProgress(''); return; }
        setProgress(`Analysis complete — ${results.length} frames processed.`)
      }
    } catch (err) { setWarningMessage(`⚠️ Analysis error: ${err.message}`); setProgress(``) }
    finally { setIsAnalyzing(false) }
  }

  const generateCommentary = async () => {
    try {
      setIsCommentaryLoading(true)
      const summaryText = analyses.map((a, i) =>
        `Ball ${i + 1}${a?.frameTime ? " (" + a.frameTime + "s)" : ""}: ${a?.shotType || 'unknown'} off a ${a?.ballType || 'unknown'}, direction ${a?.shotDirection || 0}°, zone: ${a?.shotZone || 'unknown'}${a?.isBoundary ? ", BOUNDARY" : ""}${a?.isDefensive ? ", defensive" : ""}`
      ).join('\n');
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "You are legendary cricket commentator Harsha Bhogle. Based on this ball-by-ball data:\n\n" + summaryText + "\n\nWrite dramatic exciting commentary." }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 1000 }
        })
      });
      const data = await response.json(); const fullText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate commentary.';
      setCommentary('');
      for (let i = 0; i < fullText.length; i++) {
        await new Promise(r => setTimeout(r, 18)); setCommentary(prev => prev + fullText[i]);
      }
    } catch (err) { setCommentary('Error generating commentary: ' + err.message); }
    finally { setIsCommentaryLoading(false) }
  };

  const exportReport = () => {
    const reportText = "PitchIQ Analysis Report\n" + analyses.map((a, i) =>
      `Ball ${i + 1}: ${a?.shotType} | Ball: ${a?.ballType} | Zone: ${a?.shotZone}`
    ).join('\n') + "\n\nCommentary: " + commentary;
    const blob = new Blob([reportText], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pitchiq-report.txt'; a.click();
  };

  const handleRunDemo = () => {
    setIsAnalyzing(true); setAnalyses([]); setProgress('Simulating neural analysis...');
    setTimeout(() => { setAnalyses(MOCK_DATA); setIsAnalyzing(false); }, 1500);
  };

  return (
    <>
      <style>{`@keyframes slide { 0% { transform: translateX(-100%); } 50% { transform: translateX(200%); } 100% { transform: translateX(-100%); } }`}</style>
      {isAnalyzing && (
        <div className="analysis-overlay">
          <div className="analysis-spinner-large"></div>
          <div className="analysis-step-text">{progress}</div>
        </div>
      )}
      <div className="app-container">
        <header className="header">
          <div className="header-inner">
            <div className="header-brand">
              <span className="header-icon">🏏</span>
              <div className="header-title-group">
                <h1 className="header-title glow-text">PitchIQ ⚡</h1>
                <span className="header-subtitle">AI CRICKET INTELLIGENCE PLATFORM</span>
              </div>
            </div>
            <div className="header-status">
              <span className="status-dot"></span>
              <span>SYSTEM ONLINE</span>
              <button onClick={handleRunDemo} disabled={isAnalyzing} className="hover-lift" style={{ marginLeft: '16px', padding: '6px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', color: '#38bdf8', fontSize: '10px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em' }}>⚡ Run Demo</button>
            </div>
          </div>
          <div className="section-divider" style={{ margin: '0' }}></div>
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem 2rem 0.5rem' }}>
            <h2 className="section-heading">Match Analytics</h2>
          </div>
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem 1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {[
              { label: 'Total Runs', value: analyses.length > 0 ? analyses.reduce((sum, a) => sum + (a && a.isBoundary ? 4 : (a && a.isDefensive ? 0 : 1)), 0) : 0, icon: '🏏', color: '#22c55e' },
              { label: 'Strike Rate', value: analyses.length > 0 ? Math.round((analyses.reduce((sum, a) => sum + (a && a.isBoundary ? 4 : (a && a.isDefensive ? 0 : 1)), 0) / analyses.length) * 100) : 0, icon: '⚡', color: '#38bdf8' },
              { label: 'Boundaries', value: analyses.length > 0 ? analyses.filter(a => a && a.isBoundary).length : 0, icon: '🎯', color: '#f59e0b' },
              { label: 'Dot Balls', value: analyses.length > 0 ? analyses.filter(a => a && a.isDefensive).length : 0, icon: '🛑', color: '#ef4444' }
            ].map((stat, i) => (
              <div key={i} className="glass-card hover-lift" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '2rem', filter: `drop-shadow(0 0 10px ${stat.color}40)` }}>{stat.icon}</div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{stat.label}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: stat.color }}>
                    <AnimatedNumber value={stat.value} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="loading-bar-container"><div className="loading-bar"></div></div>
        </header>

        <main className="main-content">
          <section className="youtube-section" style={{ marginBottom: '24px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(74, 222, 128, 0.15)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '13px', color: '#4ade80', fontFamily: 'monospace', fontWeight: 600 }}>📺 Paste YouTube Match Link</label>
              <input type="text" value={youtubeUrl} onChange={handleYoutubeChange} placeholder="https://www.youtube.com/watch?v=..." style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.2)', border: youtubeError ? '1px solid #ef4444' : '1px solid rgba(74, 222, 128, 0.3)', color: 'white', fontFamily: 'monospace', fontSize: '13px' }} />
              {youtubeId && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px' }}>
                    <iframe style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} src={`https://www.youtube.com/embed/${youtubeId}`} title="YouTube Match" frameBorder="0" allowFullScreen></iframe>
                  </div>
                  <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid #f59e0b', borderRadius: '4px 8px 8px 4px', color: '#fbbf24', fontFamily: 'monospace', fontSize: '12px' }}>
                    <strong>⚠️ NOTE:</strong> Scrub through the video and upload a 5-10s clip for analysis.
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="upload-section">
            <div className={`upload-zone${dragOver ? ' drag-over' : ''}`} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
              <div className="upload-icon">📂</div>
              <p className="upload-text">Drag & drop cricket footage here</p>
              <button className="upload-browse-btn" onClick={() => fileInputRef.current?.click()}>Browse Files</button>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleInputChange} style={{ display: 'none' }} />
            </div>
          </section>

          {analyses.length === 0 && !mediaURL && (
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '32px' }}>
              {[
                { emoji: '🎯', title: 'Shot Detection', desc: 'Identifies cover drives, pull shots, sweeps, and more.' },
                { emoji: '🏏', title: 'Ball Analysis', desc: 'Detects delivery type like yorker, bouncer, etc.' },
                { emoji: '🗺️', title: 'Wagon Wheel', desc: 'Plots shot direction on a live cricket field map.' }
              ].map((card, i) => (
                <div key={i} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(74, 222, 128, 0.15)', borderRadius: '12px', padding: '20px' }}>
                  <span style={{ fontSize: '28px' }}>{card.emoji}</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#4ade80' }}>{card.title}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{card.desc}</div>
                </div>
              ))}
            </section>
          )}

          {mediaURL && (
            <section className="preview-section">
              <div className="preview-card">
                <div className="preview-media" style={{ marginBottom: '1.25rem' }}>
                  {mediaType === 'image' ? <img src={mediaURL} alt="Preview" className="preview-img" /> : <video src={mediaURL} controls className="preview-video" />}
                </div>
                <button className={`analyze-btn${isAnalyzing ? ' analyzing' : ''}`} onClick={handleAnalyze} disabled={isAnalyzing}>
                  {isAnalyzing ? 'Analyzing...' : '🔍 Analyze with AI'}
                </button>
                {warningMessage && <div style={{ color: '#ef4444', textAlign: 'center', marginTop: '16px' }}>{warningMessage}</div>}
              </div>
            </section>
          )}

          {analyses.length > 0 && (
            <section className="results-section">
              <h2 className="results-heading">Analysis Results</h2>
              {analyses.map((a, i) => (
                <div key={i} className="glass-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ color: '#4ade80', fontWeight: 700 }}>BALL {i + 1}</span>
                    <span style={{ color: '#94a3b8' }}>{((parseFloat(a?.confidence) || 0) * 100).toFixed(0)}% Confidence</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
                    <div><div style={{ fontSize: '10px', color: '#6b7280' }}>SHOT</div><div style={{ color: '#10b981', fontWeight: 700 }}>{a?.shotType}</div></div>
                    <div><div style={{ fontSize: '10px', color: '#6b7280' }}>BALL</div><div style={{ color: '#ef4444', fontWeight: 700 }}>{a?.ballType}</div></div>
                    <div><div style={{ fontSize: '10px', color: '#6b7280' }}>ZONE</div><div style={{ color: '#4ade80', fontWeight: 700 }}>{a?.shotZone}</div></div>
                  </div>
                </div>
              ))}

              <div className="section-divider"></div>
              <h2 className="section-heading">AI Insights</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                <div className="glass-card story-card" style={{ padding: '24px' }}>
                  <div style={{ color: 'var(--secondary)', fontWeight: 700, marginBottom: '8px' }}>📖 MATCH STORY</div>
                  <div style={{ color: '#e2e8f0', lineHeight: 1.6 }}>{displayStory}</div>
                </div>
                <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid #4ade80' }}>
                  <div style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '8px' }}>🤖 MATCH INSIGHTS</div>
                  <div className="typing-cursor" style={{ color: '#e2e8f0' }}>{displayInsight}</div>
                </div>
              </div>

              <div className="section-divider"></div>
              <h2 className="section-heading">Shot Intelligence</h2>
              <div style={{ display: 'grid', gridTemplateColumns: analyses.length > 1 ? '1fr 1.5fr' : '1fr', gap: '24px' }}>
                <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '16px' }}>WAGON WHEEL</div>
                  <WagonWheel analyses={analyses} />
                </div>
                {analyses.length > 1 && (
                  <div className="glass-card" style={{ padding: '24px' }}>
                    <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '16px' }}>TIMELINE LOG</div>
                    <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                      <table className="timeline-table">
                        <thead><tr><th>Time</th><th>Shot</th><th>Ball</th><th>Runs</th></tr></thead>
                        <tbody>
                          {analyses.map((a, idx) => (
                            <tr key={idx} className={activeFrame === a?.frameTime ? 'active-row' : ''} onClick={() => setActiveFrame(a?.frameTime)}>
                              <td>{a?.frameTime?.toFixed(1)}s</td>
                              <td>{a?.shotType}</td>
                              <td>{a?.ballType}</td>
                              <td>{a?.isBoundary ? '4/6' : (a?.isDefensive ? '0' : '1s/2s')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {analyses.length > 1 && (() => {
                const shotData = Object.entries(analyses.reduce((acc, a) => {
                  if (!a) return acc;
                  const key = (a.shotType || 'unknown').toLowerCase();
                  acc[key] = (acc[key] || 0) + 1;
                  return acc;
                }, {})).map(([name, count]) => ({ name, count }));
                return (
                  <div className="glass-card" style={{ padding: '24px', marginTop: '24px' }}>
                    <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '16px' }}>SHOT DISTRIBUTION</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={shotData}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="var(--accent)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button onClick={generateCommentary} disabled={isCommentaryLoading || isAnalyzing} style={{ padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #166534, #15803d)', color: 'white', border: 'none', cursor: 'pointer' }}>
                  {isCommentaryLoading ? '⏳ Generating...' : '🎙️ Generate Commentary'}
                </button>
                <button onClick={exportReport} disabled={analyses.length === 0 || isAnalyzing} style={{ padding: '10px 20px', borderRadius: '8px', background: 'transparent', color: analyses.length === 0 || isAnalyzing ? '#4b5563' : '#4ade80', border: `1px solid ${analyses.length === 0 || isAnalyzing ? '#374151' : '#4ade80'}`, cursor: 'pointer' }}>📄 Export Report</button>
              </div>

              {commentary && (
                <div style={{ marginTop: '16px', background: '#000', border: '1px solid #4ade80', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>🎙️ AI COMMENTARY</div>
                  <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '12px', color: '#4ade80', whiteSpace: 'pre-wrap' }}>{commentary}</pre>
                </div>
              )}

              <div className="section-divider"></div>
              <div className="glass-card why-pitchiq-card" style={{ padding: '32px' }}>
                <h2 className="section-heading" style={{ color: 'var(--secondary)' }}>Why PitchIQ?</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginTop: '24px' }}>
                  {[
                    { icon: '💎', title: 'Actionable Intelligence', desc: 'Converts raw footage into structured analytics.' },
                    { icon: '📈', title: 'Coaching Optimization', desc: 'Analyze player technique with precision.' },
                    { icon: '🎯', title: 'Strategic Edge', desc: 'Data-driven decision making for matches.' }
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '16px' }}>
                      <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, color: '#e2e8f0' }}>{item.title}</div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </main>

        <footer style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280', fontSize: '12px', fontFamily: 'monospace' }}>
          &copy; 2026 PITCHIQ AI CRICKET INTELLIGENCE. ALL RIGHTS RESERVED.
        </footer>
      </div>
    </>
  )
}

export default App;
