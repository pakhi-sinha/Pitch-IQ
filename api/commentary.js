export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  try {
    const { analyses } = request.body || {}
    if (!Array.isArray(analyses) || analyses.length === 0) {
      return response.status(400).json({ error: 'Analysis data is required.' })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return response.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' })
    }

    const summary = analyses
      .map((item, index) => {
        const time = item.frameTime ? ` at ${Number(item.frameTime).toFixed(1)}s` : ''
        return `Delivery ${index + 1}${time}: ${item.shotType} against ${item.ballType}, zone ${item.shotZone}, confidence ${item.confidence}.`
      })
      .join('\n')

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-pro'
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a premium cricket commentator and tactical analyst. Write one concise paragraph for this PitchIQ analysis. Avoid hype and keep it useful for coaches.\n\n${summary}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.65,
            maxOutputTokens: 450
          }
        })
      }
    )

    const payload = await geminiResponse.json()
    if (!geminiResponse.ok) {
      return response.status(geminiResponse.status).json({
        error: payload?.error?.message || 'Gemini commentary failed.'
      })
    }

    const commentary = payload?.candidates?.[0]?.content?.parts?.[0]?.text || 'No commentary returned.'
    return response.status(200).json({ commentary: commentary.trim() })
  } catch (error) {
    return response.status(500).json({ error: error.message || 'Unexpected commentary error.' })
  }
}
