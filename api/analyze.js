const CRICKET_PROMPT = `Return ONLY valid JSON. No markdown, no explanation, no extra text.

You are a senior cricket analyst. Analyze the cricket image and return this exact schema:
{
  "shotType": "",
  "ballType": "",
  "battingHand": "",
  "pitchLength": "",
  "shotDirection": 0,
  "shotZone": "",
  "isBoundary": false,
  "isDefensive": false,
  "gamePhase": "",
  "confidence": 0,
  "additionalNotes": ""
}

Use realistic cricket terminology. shotDirection is 0-360 degrees where 0 is straight down the ground, 90 is off-side square, and 270 is leg-side square.`

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  try {
    const { image, mimeType = 'image/jpeg' } = request.body || {}
    if (!image || typeof image !== 'string') {
      return response.status(400).json({ error: 'Image data is required.' })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return response.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' })
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mimeType, data: image } },
                { text: CRICKET_PROMPT }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 900,
            responseMimeType: 'application/json'
          }
        })
      }
    )

    const payload = await geminiResponse.json()
    if (!geminiResponse.ok) {
      return response.status(geminiResponse.status).json({
        error: payload?.error?.message || 'Gemini analysis failed.'
      })
    }

    const raw = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const analysis = normalizeAnalysis(parseJsonFromText(raw))
    return response.status(200).json({ analysis })
  } catch (error) {
    return response.status(500).json({ error: error.message || 'Unexpected analysis error.' })
  }
}

function parseJsonFromText(text) {
  const attempts = [
    text,
    String(text).replace(/^```json/i, '').replace(/```$/i, '').trim(),
    extractJsonObject(text),
    repairJson(extractJsonObject(text))
  ].filter(Boolean)

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt)
    } catch {
      // Try the next extraction strategy.
    }
  }

  throw new Error('AI returned invalid JSON.')
}

function extractJsonObject(text) {
  const source = String(text)
  const start = source.indexOf('{')
  if (start === -1) return ''

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '"') inString = !inString
    if (inString) continue
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }

  return ''
}

function repairJson(text) {
  return String(text)
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
}

function normalizeAnalysis(value = {}) {
  return {
    shotType: asText(value.shotType, 'unknown'),
    ballType: asText(value.ballType, 'unknown'),
    battingHand: asText(value.battingHand, 'unknown'),
    pitchLength: asText(value.pitchLength, 'unknown'),
    shotDirection: clamp(Number(value.shotDirection) || 0, 0, 360),
    shotZone: asText(value.shotZone, 'unknown'),
    isBoundary: Boolean(value.isBoundary),
    isDefensive: Boolean(value.isDefensive),
    gamePhase: asText(value.gamePhase, 'unknown'),
    confidence: clamp(Number(value.confidence) || 0.35, 0, 1),
    additionalNotes: asText(value.additionalNotes, 'No note returned.')
  }
}

function asText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}
