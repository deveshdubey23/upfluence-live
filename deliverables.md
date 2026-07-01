### 1. Project Architecture Overview

The platform uses a secure, split-level system built to protect our API data access and deliver an ultra-fast user interface:

* **Secure Backend Engine:** Handles server-to-server data collection, automated credential handshakes, and a 15-minute data cache. This ensures we don't leak private API keys to the browser and keeps our data pipeline optimized.
* **Reactive Marketer Dashboard:** Built as a single-page interface that processes real-time math. When weight sliders are shifted, all scores and ranks update instantly in the user's browser.

---

### 2. Tech Stack & AI Workspace

* **Core Code Base:** Bun (Runtime), TanStack Start & Router (Full-stack Framework), TypeScript.
* **Design & Styling:** Tailwind CSS v4 using high-fidelity color spaces for crisp visual contrast.
* **Data Export:** Live browser-to-spreadsheet data conversion engine (`xlsx`).
* **AI Accelerators:** * *Lovable.dev:* For hyper-rapid dashboard layout creation and baseline responsive views.
* *Gemini:* Used as specialized architectural pairs to map out data models and write formulas.
---

### 3. Key Prompts Used During Development

* *Data Setup:* "Configure a secure server function that handles the token handshake with Upfluence and pulls creators with real time data."
* *Algorithm Design:* "Build a dynamic scoring calculator that balances follower metrics, engagement percentages, and keyword matches into a single index."
* *Bug Correction:* "Fix the Instagram field calculation so that empty video stats default to zero instead of printing a `NaN` text error in the browser."

---

### 4. Ranking Methodology & Rationale

Creators are evaluated on a 0–100 index called the **Upfluence Synergy Score (USS)** across five customized marketing vectors:

1. **Reach (25% Weight):** Audience size. Uses a logarithmic scale so massive creators don't mathematically drown out highly active macro-influencers.
2. **Engagement (30% Weight):** The real audience interaction level (likes, comments, and shares).
3. **Resonance (15% Weight):** Viewership momentum, matching actual video plays against baseline subscriber scale.
4. **Relevance (20% Weight):** Structural alignment between creator categorizations and our target brand criteria.
5. **Professionalism (10% Weight):** Account verification status and outreach availability (direct email access).

**Marketing Flexibility:** Because campaign priorities change, your team can adjust these percentages directly on the panel. The engine immediately re-ranks the entire creator list based on the new target goal.

---

### 5. Setup Instructions

To initialize the software environment locally:

1. Run `bun install` at the project folder root to resolve core dependencies.
2. Add a standard `.env` configuration file to the root directory containing your credential parameters:
```env
UPFLUENCE_CLIENT_ID=your_id_here
UPFLUENCE_CLIENT_SECRET=your_secret_here
```
3. Execute `bun run dev` to boot up the live local workspace environment.

---

### 6. Core Strategic Assumptions

* **Instagram as a baseline:** We assumed Instagram verification and tracking was the safest baseline requirement for identifying modern lifestyle and consumer-focused creators.
* **Multi-Platform Extensions:** We assumed cross-channel health matters to brands. If an influencer has an attached TikTok or YouTube channel, our system automatically tracks and displays those stats.

---

### 7. Challenges Encountered & Solutions

* **Sandbox API Cap Exhaustion:**
* *The Issue:* To prove our logic, we load-tested the live engine across all industries. This continuous real-time verification completely exhausted our standard developer sandbox credit limits, triggering system restrictions.
* *The Fix:* We built a dual-tiered presentation strategy. While the live backend data pipeline is verified and code-complete, we concurrently deployed a flawless **Interactive Design Prototype** populated with representative industry datasets. This allows the executive team to inspect the entire unconstrained UI layout and feature set without being blocked by sandbox access limits. You can find it here: https://upfluence-henna.vercel.app/
  
