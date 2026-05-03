# 🏏 PitchIQ — AI Cricket Intelligence Platform ⚡

> Transforming cricket footage into actionable insights using AI

---

## 🚀 Overview

PitchIQ is an AI-powered cricket analytics platform that converts **unstructured match footage (images/videos)** into **structured, insightful data**.

Instead of manually tracking every shot and delivery, PitchIQ uses AI to:

* Detect shot types and ball types
* Analyze player behavior
* Generate match statistics
* Visualize insights through charts and shot maps
* Produce human-like match summaries

---

## 🎯 Problem Statement

Tracking detailed cricket data manually is inefficient and incomplete.
We typically only get:

* Runs scored
* Ball speed
* Basic commentary

👉 But not:

* Shot type
* Player intent
* Field direction patterns

**PitchIQ solves this by analyzing raw cricket footage using AI.**

---

## ✨ Features

### 📥 Smart Input System

* Upload cricket images or short video clips
* YouTube match preview integration (for reference)

---

### 🧠 AI-Powered Analysis

* Shot Type Detection (cover drive, pull, sweep, etc.)
* Ball Type Classification (yorker, bouncer, good length)
* Batting Hand Detection
* Shot Direction (0–360°)
* Game Phase Identification
* Confidence Scoring

---

### 📊 Match Analytics Dashboard

* Total Runs, Strike Rate, Boundaries, Dot Balls
* Shot Distribution (Bar Chart)
* Ball Type Breakdown (Pie Chart)
* Run Progress & Aggression Insights

---

### 🎯 Wagon Wheel Visualization

* Interactive cricket field shot map
* Color-coded shot directions:

  * 🟢 Boundary
  * 🔵 Singles
  * ⚪ Defensive

---

### 🕒 Timeline Tracking

Ball-by-ball structured log:

* Timestamp
* Shot Type
* Ball Type
* Runs
* Confidence Level

---

### 🤖 AI Match Insights

* Generates analytical summaries of player behavior
* Highlights patterns like:

  * Off-side dominance
  * Aggressive phases
  * Defensive strategies

---

### 📖 Story Mode

* Converts raw analysis into a **human-readable match narrative**

---

### 🔥 Highlight Moment Detection

* Automatically identifies the best shot of the session

---

### ⚡ Demo Mode (Hackathon Ready)

* One-click demo with preloaded match data
* Ensures smooth presentations without dependency on uploads

---

### 🎨 Modern UI/UX

* Glassmorphism design
* Neon gradient accents
* Animated stats & AI typing effects
* Fully responsive dashboard

---

## 🛠 Tech Stack

* **Frontend:** React + Vite
* **Charts:** Recharts
* **AI Model:** Gemini 1.5 Flash (Vision API)
* **Video Processing:** HTML5 Video + Canvas
* **Styling:** CSS (Glassmorphism + Neon UI)

---

## ⚙️ How It Works

1. Upload an image or short video clip
2. Extract frames (for videos)
3. Send frames to Gemini Vision API
4. Receive structured JSON analysis
5. Generate:

   * Stats
   * Charts
   * Wagon Wheel
   * Timeline
   * AI Insights
6. Display everything in an interactive dashboard

---

## 🧪 Demo

👉 Click **⚡ Run Demo** inside the app to instantly view a full analysis.

---

## 📦 Setup Instructions

```bash
# Clone the repository
git clone https://github.com/your-username/pitchiq.git

# Navigate to project folder
cd pitchiq

# Install dependencies
npm install

# Run development server
npm run dev
```

---

## 🔐 Environment Variables

Create a `.env` file:

```env
VITE_GEMINI_API_KEY=your_api_key_here
```

⚠️ Do NOT expose your API key publicly.

---

## 🚧 Limitations

* Requires clear cricket action frames for accurate analysis
* Cannot directly extract frames from YouTube (browser restrictions)
* Runs are estimated (not official scoring system)

---

## 🚀 Future Scope

* Real-time full match analysis (backend processing)
* Player comparison dashboards
* Advanced ball tracking & trajectory prediction
* Integration with live match feeds

---

## 💡 Why PitchIQ?

* Converts unstructured video → structured intelligence
* Saves hours of manual analysis
* Enables data-driven cricket strategy
* Useful for coaches, analysts, and players

---

## 👩💻 Author

**Pakhi Sinha**
BCA (AI/ML) — Galgotias University

---

## ⭐ Acknowledgements

* Google Gemini API
* Recharts
* Open-source community

---

## 🏁 Final Note

PitchIQ is not just a project —
it’s a step toward **AI-powered sports analytics**.

> “Turning cricket footage into actionable intelligence.”
