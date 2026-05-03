import { useState, useRef, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import './App.css'

/**
 * AnimatedNumber Component
 * Animates a numeric value from 0 to the target value.
 */
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

const CRICKET_PROMPT = `Return ONLY valid JSON. No explanation, no markdown, no extra text.

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

Return EXACTLY this JSON schema:
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

/**
 * isValidCricketFrame
 * Guards against low-resolution or non-action frames.
 */
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

/**
 * generateMatchStory
 * Derives a narrative from ball-by-ball data.
 */
function generateMatchStory(deliveries) {
  if (!deliveries || deliveries.length === 0) return "";
  const validDeliveries = deliveries.filter(d => d !== null);
  if (validDeliveries.length === 0) return "";

  const total = validDeliveries.length;
  const boundaries = validDeliveries.filter(d => d.isBoundary).length;
  const firstHalf = validDeliveries.slice(0, Math.ceil(total / 2));
  const secondHalf = validDeliveries.slice(Math.ceil(total / 2));
  const firstHalfAggro = firstHalf.filter(d => !d.isDefensive).length / (firstHalf.length || 1);
  const secondHalfAggro = secondHalf.length > 0 ? secondHalf.filter(d => !d.isDefensive).length / secondHalf.length : 0;
  
  let story = "";
  if (firstHalfAggro < 0.5) story += "The innings began cautiously with a focus on defensive stability. ";
  else story += "The batter took an aggressive stance right from the opening deliveries. ";
  
  const dominantZone = Object.entries(validDeliveries.reduce((acc, d) => {
    if (d.shotZone && d.shotZone !== 'unknown') acc[d.shotZone] = (acc[d.shotZone] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'various zones';
  
  story += `Play was primarily concentrated in the ${dominantZone} area, showing a clear regional preference. `;
  if (secondHalfAggro > firstHalfAggro) story += "As the session progressed, there was a noticeable shift toward high-risk, high-reward stroke play. ";
  
  if (boundaries > 0) story += `The performance was punctuated by ${boundaries} boundary-scoring shots that effectively disrupted the bowling rhythm.`;
  else story += "Despite the lack of boundaries, the batter maintained strike rotation through consistent placement.";
  return story;
}

/**
 * callGeminiVision
 * Handles API communication with Gemini 3 Flash.
 */
async function callGeminiVision(base64, mimeType) {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing API Key");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${apiKey}`,
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
          generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
        })
      }
    );

    const fallbackData = {
      shotType: "unknown",
      ballType: "unknown",
      battingHand: "unknown",
      pitchLength: "unknown",
      shotDirection: 0,
      shotZone: "unknown",
      isBoundary: false,
      isDefensive: false,
      gamePhase: "unknown",
      confidence: 0.2,
      additionalNotes: "AI uncertain"
    };

    if (!response.ok) {
      const errData = await response.json();
      console.error("API error:", errData.error?.message);
      return null;
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    try {
      return JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch (err) {
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e2) {
        console.error("Gemini raw response:", raw);
      }
      return fallbackData;
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

/**
 * WagonWheel Component
 * Plots shots on a cricket field.
 */
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
  const valid = (analyses || []).filter(a => a && a.shotZone !== "unknown" && (parseFloat(a.confidence) || 0) > 0.4);
  
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
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fill="#86efac" fontFamily="monospace" opacity={0.5}>No valid shots plotted</text>
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
      const validA = analyses.filter(a => a !== null);
      if (validA.length === 0) return;

      const dominantZone = Object.entries(validA.reduce((acc, a) => {
        if (a.shotZone && a.shotZone !== 'unknown') acc[a.shotZone] = (acc[a.shotZone] || 0) + 1;
        return acc;
      }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'various';

      const dominantPhase = Object.entries(validA.reduce((acc, a) => {
        if (a.gamePhase && a.gamePhase !== 'unknown') acc[a.gamePhase] = (acc[a.gamePhase] || 0) + 1;
        return acc;
      }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'all phases';

      const dominantShot = Object.entries(validA.reduce((acc, a) => {
        if (a.shotType && a.shotType !== 'unknown') acc[a.shotType] = (acc[a.shotType] || 0) + 1;
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
    setCommentary('')
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

  /**
   * extractVideoFrames
   * Extracts up to 'count' frames from a video file.
   */
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
          } catch (e) {
            // Skip frame on failure
          }
        }
        URL.revokeObjectURL(url); resolve(frames)
      }
      video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load video')); }
    })
  }

  const handleAnalyze = async () => {
    if (!media) return
    setIsAnalyzing(true); setAnalyses([]); setWarningMessage(''); setProgress('Preparing neural analysis...')
    try {
      if (mediaType === 'image') {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = () => reject(new Error('Failed to read image')); reader.readAsDataURL(media)
        })
        const img = new Image(); img.src = `data:${media.type};base64,${base64}`
        await new Promise(r => { img.onload = r; img.onerror = r })
        if (!isValidCricketFrame(img)) { setWarningMessage('⚠️ Image resolution too low for accurate analysis.'); setProgress(''); return; }
        const result = await callGeminiVision(base64, media.type)
        if (!result) { setWarningMessage('⚠️ Unable to extract structured data. Showing best-effort analysis.'); setProgress(''); return; }
        setAnalyses([result]); setProgress('Analysis complete.')
      } else if (mediaType === 'video') {
        const frames = await extractVideoFrames(media, 6)
        if (frames.length === 0) { setWarningMessage('⚠️ No valid action frames could be extracted.'); setProgress(''); return; }
        const results = []
        for (let i = 0; i < frames.length; i++) {
          const frame = frames[i]; setActiveFrame(i); setProgress(`Analyzing frame ${i + 1} of ${frames.length}...`)
          const result = await callGeminiVision(frame.base64, 'image/jpeg')
          if (result) results.push({ ...result, frameTime: frame.time })
          setAnalyses([...results])
        }
        if (results.length === 0) { setWarningMessage('⚠️ Unable to extract structured data. Showing best-effort analysis.'); setProgress(''); return; }
        setProgress(`Analysis complete — ${results.length} insights derived.`)
      }
    } catch (err) { setWarningMessage(`⚠️ Analysis error: ${err.message}`); setProgress(``) }
    finally { setIsAnalyzing(false) }
  }

  const generateCommentary = async () => {
    if (analyses.length === 0) return;
    try {
      setIsCommentaryLoading(true)
      const summaryText = analyses.map((a, i) =>
        `Ball ${i + 1}${a?.frameTime ? " (" + a.frameTime.toFixed(1) + "s)" : ""}: ${a?.shotType || 'unknown'} off a ${a?.ballType || 'unknown'}, direction ${a?.shotDirection || 0}°, zone: ${a?.shotZone || 'unknown'}${a?.isBoundary ? ", BOUNDARY" : ""}${a?.isDefensive ? ", defensive" : ""}`
      ).join('\n');
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "You are legendary cricket commentator Harsha Bhogle. Based on this ball-by-ball data:\n\n" + summaryText + "\n\nWrite dramatic exciting commentary." }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 1000 }
        })
      });
      const data = await response.json(); const fullText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate commentary.';
      setCommentary('');
      for (let i = 0; i < fullText.length; i++) {
        await new Promise(r => setTimeout(r, 15)); setCommentary(prev => prev + fullText[i]);
      }
    } catch (err) { setCommentary('Error generating commentary: ' + err.message); }
    finally { setIsCommentaryLoading(false) }
  };

  const exportReport = () => {
    if (analyses.length === 0) return;
    const reportText = "========================================\nPITCHIQ — AI CRICKET ANALYSIS REPORT\n========================================\nGenerated: " + new Date().toLocaleString() + "\n\n--- BALL-BY-BALL DATA ---\n" + analyses.map((a, i) =>
      `Ball ${i + 1}: ${a?.shotType || 'unknown'} | Ball: ${a?.ballType || 'unknown'} | Zone: ${a?.shotZone || 'unknown'} | Direction: ${a?.shotDirection || 0}° | Runs: ${a?.isBoundary ? '4/6' : (a?.isDefensive ? '0' : '1s/2s')}`
    ).join('\n') + "\n\n--- AI COMMENTARY ---\n" + (commentary || 'Not generated') + "\n\n========================================\nPowered by PitchIQ x Gemini 3 Flash\n========================================";
    const blob = new Blob([reportText], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `pitchiq-analysis-${Date.now()}.txt`; a.click();
  };

  const handleRunDemo = () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true); setAnalyses([]); setWarningMessage(''); setProgress('Simulating neural analysis from pre-cached match data...');
    setTimeout(() => { setAnalyses(MOCK_DATA); setIsAnalyzing(false); setProgress('Demo data loaded successfully.'); }, 1500);
  };

  return (
    <>
      <style>{`@keyframes slide { 0% { transform: translateX(-100%); } 50% { transform: translateX(200%); } 100% { transform: translateX(-100%); } }`}</style>
      
      {/* Analysis Overlay */}
      {isAnalyzing && (
        <div className="analysis-overlay">
          <div className="analysis-spinner-large"></div>
          <div className="analysis-step-text">
            {progress}
            <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '12px' }}>This may take a few seconds...</div>
          </div>
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
              <button 
                onClick={handleRunDemo} 
                disabled={isAnalyzing} 
                className="hover-lift" 
                style={{ 
                  marginLeft: '16px', 
                  padding: '6px 12px', 
                  background: 'rgba(56, 189, 248, 0.1)', 
                  border: '1px solid rgba(56, 189, 248, 0.3)', 
                  borderRadius: '6px', 
                  color: '#38bdf8', 
                  fontSize: '10px', 
                  fontWeight: 700, 
                  cursor: isAnalyzing ? 'not-allowed' : 'pointer', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.1em' 
                }}
              >
                ⚡ Run Demo
              </button>
            </div>
          </div>
          
          <div className="section-divider" style={{ margin: '0' }}></div>
          
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem 2rem 0.5rem' }}>
            <h2 className="section-heading">Match Analytics</h2>
          </div>
          
          {/* Hero Stat Cards */}
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
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
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
          {/* YouTube Section */}
          <section className="youtube-section" style={{ marginBottom: '24px' }}>
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', color: '#4ade80', fontFamily: 'monospace', fontWeight: 600, display: 'block', marginBottom: '8px' }}>📺 Paste YouTube Match Link</label>
                <input 
                  type="text" 
                  value={youtubeUrl} 
                  onChange={handleYoutubeChange} 
                  placeholder="https://www.youtube.com/watch?v=..." 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.2)', border: youtubeError ? '1px solid #ef4444' : '1px solid rgba(74, 222, 128, 0.3)', color: 'white', fontFamily: 'monospace', fontSize: '13px' }} 
                />
                {youtubeError && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', fontFamily: 'monospace' }}>{youtubeError}</div>}
              </div>
              
              {youtubeId && (
                <div style={{ marginTop: '8px', animation: 'fade-in 0.5s ease' }}>
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <iframe style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} src={`https://www.youtube.com/embed/${youtubeId}`} title="YouTube Match" frameBorder="0" allowFullScreen></iframe>
                  </div>
                  
                  <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.08)', borderLeft: '4px solid #f59e0b', borderRadius: '4px 12px 12px 4px', color: '#fbbf24', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.6 }}>
                      <strong>💡 TIP:</strong> Scrub to a key delivery, pause, and upload a short clip of that moment for AI analysis.
                    </div>
                    
                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Select Moment (mm:ss)</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                          type="text" 
                          value={youtubeTimestamp} 
                          onChange={(e) => setYoutubeTimestamp(e.target.value)} 
                          placeholder="01:45" 
                          style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border)', color: 'white', fontFamily: 'monospace' }}
                        />
                        <button 
                          onClick={() => setYoutubeClipMessage(`Upload the clip corresponding to ${youtubeTimestamp || 'the selected moment'} below.`)}
                          style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--accent)', color: 'var(--bg-primary)', border: 'none', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
                        >
                          SET MOMENT
                        </button>
                      </div>
                      {youtubeClipMessage && <div style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: 'monospace' }}>{youtubeClipMessage}</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Upload Section */}
          <section className="upload-section">
            <div className={`upload-zone${dragOver ? ' drag-over' : ''}`} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
              <div className="upload-icon">📂</div>
              <p className="upload-text">Drag & drop match footage here</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>Supports clear batting/bowling action clips (MP4, JPG, PNG)</p>
              <button className="upload-browse-btn" onClick={() => fileInputRef.current?.click()}>Browse Files</button>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleInputChange} style={{ display: 'none' }} />
            </div>
          </section>

          {/* Value Proposition Section (visible when no media) */}
          {analyses.length === 0 && !mediaURL && (
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '32px' }}>
              {[
                { emoji: '🎯', title: 'Shot Detection', desc: 'Identifies 15+ shot types including cover drives, pulls, and sweeps instantly.' },
                { emoji: '🏏', title: 'Ball Analysis', desc: 'Detects delivery types like yorkers, bouncers, and full tosses automatically.' },
                { emoji: '🗺️', title: 'Wagon Wheel', desc: 'Plots every shot direction on a virtual cricket field with boundary detection.' }
              ].map((card, i) => (
                <div key={i} className="glass-card hover-lift" style={{ padding: '24px' }}>
                  <span style={{ fontSize: '32px', marginBottom: '12px', display: 'block' }}>{card.emoji}</span>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent)', marginBottom: '8px', textTransform: 'uppercase' }}>{card.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{card.desc}</div>
                </div>
              ))}
            </section>
          )}

          {/* Preview Section */}
          {mediaURL && (
            <section className="preview-section">
              <div className="preview-card glass-card" style={{ padding: '20px' }}>
                <div className="preview-media" style={{ marginBottom: '1.25rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
                  {mediaType === 'image' ? <img src={mediaURL} alt="Preview" className="preview-img" style={{ maxHeight: '400px', width: '100%', objectFit: 'contain' }} /> : <video src={mediaURL} controls className="preview-video" style={{ maxHeight: '400px', width: '100%' }} />}
                </div>
                <button className={`analyze-btn${isAnalyzing ? ' analyzing' : ''}`} onClick={handleAnalyze} disabled={isAnalyzing} style={{ height: '48px' }}>
                  {isAnalyzing ? <><span className="analyze-spinner"></span> Processing...</> : '🔍 Analyze with Gemini 3 Flash'}
                </button>
                {warningMessage && <div style={{ color: '#ef4444', textAlign: 'center', marginTop: '16px', fontSize: '12px', fontFamily: 'monospace', background: 'rgba(239, 68, 68, 0.05)', padding: '10px', borderRadius: '8px' }}>{warningMessage}</div>}
              </div>
            </section>
          )}

          {/* Results Section */}
          {analyses.length > 0 && (
            <section className="results-section">
              <h2 className="results-heading">
                <span className="results-icon">📊</span>
                Analysis Results
              </h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                {analyses.map((a, i) => (
                  <div key={i} className="glass-card hover-lift" style={{ padding: '20px', borderLeft: `4px solid ${a?.isBoundary ? '#ef4444' : '#4ade80'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>DELIVERY {i + 1} {a?.frameTime ? `— ${a.frameTime.toFixed(1)}s` : ''}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{(parseFloat(a?.confidence) * 100 || 0).toFixed(0)}% Match</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                      <div><div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>SHOT</div><div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '13px', textTransform: 'capitalize' }}>{a?.shotType || 'unknown'}</div></div>
                      <div><div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>BALL</div><div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '13px', textTransform: 'capitalize' }}>{a?.ballType || 'unknown'}</div></div>
                      <div><div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ZONE</div><div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '13px', textTransform: 'capitalize' }}>{a?.shotZone || 'unknown'}</div></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="section-divider"></div>
              
              {/* AI Narrative Section */}
              <h2 className="section-heading">AI Narrative Insights</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                <div className="glass-card story-card hover-lift" style={{ padding: '24px', borderLeft: '4px solid var(--secondary)' }}>
                  <div style={{ color: 'var(--secondary)', fontWeight: 700, marginBottom: '12px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>📖 MATCH STORY</div>
                  <div style={{ color: '#e2e8f0', lineHeight: 1.7, fontSize: '14px' }}>{displayStory || 'Awaiting narrative generation...'}</div>
                </div>
                <div className="glass-card hover-lift" style={{ padding: '24px', borderLeft: '4px solid var(--accent)' }}>
                  <div style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '12px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>🤖 STRATEGIC INSIGHTS</div>
                  <div className="typing-cursor" style={{ color: '#e2e8f0', lineHeight: 1.7, fontSize: '14px' }}>{displayInsight || 'Deriving intelligence...'}</div>
                </div>
              </div>

              <div className="section-divider"></div>
              
              {/* Shot Intelligence Section */}
              <h2 className="section-heading">Spatial Intelligence</h2>
              <div style={{ display: 'grid', gridTemplateColumns: analyses.length > 1 ? '1fr 1.5fr' : '1fr', gap: '24px', marginBottom: '32px' }}>
                <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '20px', fontSize: '13px', textTransform: 'uppercase' }}>WAGON WHEEL MAP</div>
                  <WagonWheel analyses={analyses} />
                </div>
                
                {analyses.length > 1 && (
                  <div className="glass-card" style={{ padding: '24px' }}>
                    <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '16px', fontSize: '13px', textTransform: 'uppercase' }}>SESSION TIMELINE</div>
                    <div style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '8px' }}>
                      <table className="timeline-table">
                        <thead><tr><th>Time</th><th>Shot</th><th>Ball</th><th>Runs</th></tr></thead>
                        <tbody>
                          {analyses.map((a, idx) => (
                            <tr key={idx} className={activeFrame === idx ? 'active-row' : ''} onClick={() => setActiveFrame(idx)}>
                              <td style={{ color: 'var(--accent)' }}>{a?.frameTime ? a.frameTime.toFixed(1) + 's' : (idx + 1)}</td>
                              <td style={{ textTransform: 'capitalize' }}>{a?.shotType || 'unknown'}</td>
                              <td style={{ textTransform: 'capitalize' }}>{a?.ballType || 'unknown'}</td>
                              <td style={{ fontWeight: 700, color: a?.isBoundary ? '#ef4444' : '#e2e8f0' }}>{a?.isBoundary ? '4/6' : (a?.isDefensive ? '0' : '1s/2s')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Statistical Breakdown */}
              {analyses.length > 1 && (() => {
                const shotData = Object.entries(analyses.reduce((acc, a) => {
                  if (!a) return acc;
                  const key = (a.shotType || 'unknown').toLowerCase();
                  acc[key] = (acc[key] || 0) + 1;
                  return acc;
                }, {})).map(([name, count]) => ({ name, count }));
                
                return (
                  <div className="glass-card" style={{ padding: '24px', marginTop: '24px' }}>
                    <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '24px', fontSize: '13px', textTransform: 'uppercase' }}>SHOT DISTRIBUTION ANALYTICS</div>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={shotData}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} allowDecimals={false} />
                        <Tooltip 
                          contentStyle={{ background: '#0f172a', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff' }}
                          itemStyle={{ color: 'var(--accent)' }}
                        />
                        <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <button 
                  onClick={generateCommentary} 
                  disabled={isCommentaryLoading || isAnalyzing} 
                  style={{ padding: '12px 24px', borderRadius: '10px', background: 'linear-gradient(135deg, #166534, #15803d)', color: 'white', border: 'none', cursor: (isCommentaryLoading || isAnalyzing) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px', transition: 'all 0.2s ease', boxShadow: '0 4px 15px rgba(22, 101, 52, 0.3)' }}
                >
                  {isCommentaryLoading ? '🎙️ GENERATING...' : '🎙️ HARSHA BHOGLE AI'}
                </button>
                <button 
                  onClick={exportReport} 
                  disabled={analyses.length === 0 || isAnalyzing} 
                  style={{ padding: '12px 24px', borderRadius: '10px', background: 'transparent', color: (analyses.length === 0 || isAnalyzing) ? '#4b5563' : '#4ade80', border: `1px solid ${(analyses.length === 0 || isAnalyzing) ? '#374151' : '#4ade80'}`, cursor: (analyses.length === 0 || isAnalyzing) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px', transition: 'all 0.2s ease' }}
                >
                  📄 EXPORT REPORT
                </button>
              </div>

              {/* Commentary Box */}
              {commentary && (
                <div style={{ marginTop: '20px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid var(--accent)', borderRadius: '12px', padding: '24px', boxShadow: '0 0 30px rgba(34, 197, 94, 0.1)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.2em', fontWeight: 800 }}>🎙️ LIVE AI COMMENTARY</div>
                  <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '13px', color: 'var(--accent)', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{commentary}</pre>
                </div>
              )}

              <div className="section-divider" style={{ margin: '48px 0' }}></div>
              
              {/* Why PitchIQ Card */}
              <div className="glass-card why-pitchiq-card" style={{ padding: '40px', borderRadius: '24px' }}>
                <h2 className="section-heading" style={{ color: 'var(--secondary)', marginBottom: '32px' }}>Why PitchIQ?</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
                  {[
                    { icon: '💎', title: 'Actionable Intelligence', desc: 'Converts unstructured video into structured, searchable analytics instantly.' },
                    { icon: '📈', title: 'Coaching Optimization', desc: 'Identify technique patterns and optimize player performance with AI precision.' },
                    { icon: '🎯', title: 'Strategic Edge', desc: 'Empower your team with data-driven decision making for every match.' }
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '20px' }}>
                      <span style={{ fontSize: '2rem' }}>{item.icon}</span>
                      <div>
                        <div style={{ fontWeight: 800, color: '#f1f5f9', marginBottom: '6px', fontSize: '15px' }}>{item.title}</div>
                        <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </main>

        <footer style={{ padding: '60px 20px 40px', textAlign: 'center', color: '#475569', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
          &copy; 2026 PITCHIQ AI CRICKET INTELLIGENCE &bull; POWERED BY GEMINI 3 FLASH &bull; ALL RIGHTS RESERVED.
        </footer>
      </div>
    </>
  )
}

export default App;
