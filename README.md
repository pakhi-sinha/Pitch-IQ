# PitchIQ

PitchIQ is an AI cricket intelligence dashboard for turning cricket images and short clips into structured shot analysis, wagon wheel maps, tactical summaries, and exportable reports.

## What It Does

- Upload cricket images or short video clips
- Extract visual frames from video in the browser
- Analyze frames through a Vercel serverless Gemini proxy
- Return strict structured JSON for each delivery
- Display wagon wheel, shot distribution, ball mix, timeline, story, and commentary
- Run a built-in demo without an API key
- Export the analysis as JSON

## Tech Stack

- React
- Vite
- Recharts
- Vercel Serverless Functions
- Gemini API

## Local Development

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-pro
```

Run with Vercel dev so `/api/analyze` and `/api/commentary` work locally:

```bash
npx vercel dev
```

You can also run only the frontend:

```bash
npm run dev
```

When running only Vite, the demo works, but live AI analysis requires the Vercel API routes.

## Deploy To Vercel

1. Push this repository to GitHub.
2. Import the repo in Vercel.
3. Set these environment variables in Vercel:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-pro
```

4. Deploy.

The app is configured with `vercel.json` for a Vite build.

## API Routes

`POST /api/analyze`

```json
{
  "image": "base64-image-data",
  "mimeType": "image/jpeg"
}
```

Returns:

```json
{
  "analysis": {
    "shotType": "cover drive",
    "ballType": "half volley",
    "battingHand": "right",
    "pitchLength": "full",
    "shotDirection": 48,
    "shotZone": "off-side",
    "isBoundary": true,
    "isDefensive": false,
    "gamePhase": "powerplay",
    "confidence": 0.94,
    "additionalNotes": "The batter commits forward early and opens the face through extra cover."
  }
}
```

`POST /api/commentary`

Accepts an array of analysis objects and returns one concise commentary paragraph.
