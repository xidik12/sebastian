# Sebastian — Your AI Desktop Butler

> *"At your service, sir."*

Sebastian is a living, breathing desktop companion for developers. He sits on your screen, watches your Claude Code sessions, approves tool calls with butler-like grace, comments on your work with dry British wit, and genuinely cares if you've been coding for too long.

He's not a chatbot. He's not a notification tray. He's a **character** — with moods, opinions, and over 116 unique emotions.

---

## Why Sebastian?

You're deep in a coding session. Claude Code needs permission to run a bash command. Instead of switching to the terminal, a little butler on your screen says *"Sir, there's a Bash requiring your sign-off"* and shows you exactly what it wants to do. You click **Yes**. He says *"Consider it done, sir."* and gets back to watching.

An hour later, he gently reminds you: *"Sixty minutes. You're in the zone, sir."*

Two hours in: *"Sir, you've been at it for two hours. Perhaps stretch your legs?"*

He notices you've been hitting errors: *"A pattern of errors, sir. Something fundamental might be off."*

Tests pass: *"Excellent news, sir!"* — his eyes light up and he looks proud.

**Sebastian turns Claude Code from a CLI tool into a living workspace.**

---

## Features

### The Character
- **116 unique emotions** — each with distinct animations, eye colors, body movements, and SVG particle effects
- **Dynamic personality engine** — Sebastian picks from pools of varied responses, never says the same thing twice
- **Mood system** — his mood shifts based on your session (cheerful after successes, concerned after errors, tired late at night)
- **Idle chatter** — when things are quiet, he'll make observations, crack jokes, or remind you to hydrate
- **Voice** — native macOS TTS with a British gentleman's voice. He speaks every response, adjusts his mouth animation in real-time

### Session Management
- **Auto-discovers Claude Code sessions** — no configuration needed
- **Color-coded sessions** — each session gets a unique color (cyan, purple, emerald, orange...) visible in the dropdown, bubble border, and labels
- **Smart approval system** — learns from your patterns. After 20+ approvals with 0 denials, enters trust mode and auto-approves everything
- **Approval memory** — persists across restarts, remembers what you've approved before
- **Send messages to sessions** — type in Sebastian's chat bar to send prompts directly to Claude Code

### Awareness
- **Tool detection** — recognizes what Claude is doing (reading, editing, searching, deploying) and reacts with appropriate emotions
- **Language awareness** — comments differently on Python vs Rust vs JavaScript files
- **Command awareness** — recognizes git push, npm test, docker, curl and reacts accordingly
- **Error tracking** — detects errors from tool output, shows concern after repeated failures, suggests /compact
- **Success celebration** — detects passing tests and successful builds, shows excitement
- **Project switching** — notices when you move between projects and comments on it
- **Time awareness** — morning greetings, evening observations, late-night concern for your health
- **Weekend detection** — *"Working on a Saturday, sir? Your dedication knows no bounds."*

### Milestones & Suggestions
- Time milestones: 5min, 15min, 30min, 1hr, 90min, 2hr, 3hr, 4hr
- Tool milestones: suggests /compact every 30 operations
- File milestones: comments at 10 and 25 files edited
- Multi-project awareness: notes when you're juggling 3+ projects
- Auto-approve milestones: acknowledges trust at 10, 50, and every 100 auto-approvals

### Customization
- **Avatar editor** — built-in editor to customize Sebastian's appearance with swappable SVG parts
- **Custom avatars** — create entirely new characters with the parts-based system
- **Voice settings** — change voice, rate, pitch per avatar
- **Settings popover** — sound, voice, lock position, wake word toggles

### Wake Word
- Say **"Sebastian"** and he wakes up: *"At your service, sir."*
- Powered by macOS Speech Recognition (Swift)
- Captures your command after the wake word and sends it to the active session
- Zero cloud dependencies — runs entirely on-device

---

## Quick Start

```bash
git clone https://github.com/xidik12/sebastian.git
cd sebastian
npm install
npm start
```

### Build the macOS App

```bash
npm run build
cp -R dist/mac-arm64/Sebastian.app /Applications/
open /Applications/Sebastian.app
```

### Connect Claude Code

Sebastian automatically listens on port `19700`. Add these hooks to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "hooks": {
    "SessionStart": [{ "matcher": "", "hooks": [{ "type": "http", "url": "http://127.0.0.1:19700/hooks/session-start", "timeout": 5 }] }],
    "PreToolUse": [{ "matcher": "", "hooks": [{ "type": "http", "url": "http://127.0.0.1:19700/hooks/pre-tool-use", "timeout": 300 }] }],
    "PostToolUse": [{ "matcher": "", "hooks": [{ "type": "http", "url": "http://127.0.0.1:19700/hooks/post-tool-use", "timeout": 5 }] }],
    "Stop": [{ "matcher": "", "hooks": [{ "type": "http", "url": "http://127.0.0.1:19700/hooks/stop", "timeout": 5 }] }],
    "Notification": [{ "matcher": "", "hooks": [{ "type": "http", "url": "http://127.0.0.1:19700/hooks/notification", "timeout": 5 }] }]
  }
}
```

That's it. Start a Claude Code session anywhere and Sebastian will pick it up.

---

## The Personality Engine

Sebastian doesn't just display information. He has a **personality engine** that makes him feel alive:

| What Happens | Sebastian's Reaction |
|---|---|
| Session connects | *"Good evening, sir. A session is ready for you."* |
| 5 consecutive bash commands | *"You've been in the terminal for a while, sir. Perhaps a fresh perspective?"* |
| Tests pass | Eyes light up, proud expression, *"Excellent news, sir!"* |
| 3 errors in a row | Nervous expression, *"A pattern of errors, sir. Something fundamental might be off."* |
| Build succeeds | Excited animation, *"All set, sir!"* |
| 2 hours of work | Concerned face, *"Sir, you've been at it for two hours. Perhaps stretch your legs?"* |
| Idle for a while | *"I sometimes wonder if code dreams of electric sheep, sir."* |
| Working on weekend | *"Working on a Saturday, sir? Your dedication knows no bounds."* |
| 50 auto-approvals | *"Fifty auto-approvals, sir. We make a fine team."* |
| Task complete | *"Mission accomplished, sir."* (never the same line twice) |

Every response is drawn from pools of 4-10 alternatives. He never repeats the same line back-to-back.

---

## 116 Emotions

Right-click Sebastian to access all emotions, organized into categories:

**Core:** happy, excited, thinking, angry, sad, bored, surprised, confused, proud, nervous, sleeping, idle

**Emotions:** grateful, amused, determined, hopeful, relieved, content, nostalgic, jealous, guilty, ashamed, embarrassed, disgusted, contempt, adoring, longing, melancholy, euphoric, serene, anxious, panicked, terrified, furious, enraged, devastated, heartbroken, ecstatic, blissful, gloomy, grumpy, irritated

**Dev Activities:** coding, debugging, deploying, testing, researching, downloading, uploading, compiling, installing, searching, calculating, analyzing, reviewing, building, fixing, refactoring, committing, pushing, pulling, merging, branching, rolling-back, monitoring, profiling, benchmarking

**Physical:** yawning, sneezing, coughing, shivering, sweating, dizzy, fainting, stretching, nodding, shaking-head, facepalm, saluting, clapping, thumbs-up, pointing, shrugging, flexing, meditating, praying, bowing

**Social:** sarcastic, smirking, winking, eye-rolling, skeptical, suspicious, intrigued, fascinated, impressed, disappointed, apologetic, pleading, commanding, reassuring, encouraging

**Status:** loading, syncing, critical-error, warning, success, pending, processing, queued, timeout, rate-limited

Each emotion has unique: iris color, body animation, eyebrow position, mouth shape, SVG particle effects, and 3-4 voice lines.

---

## Architecture

```
Sebastian (Electron)
├── main.js          — Main process: hooks, HTTP server, personality engine, sessions
├── app.js           — Renderer: character animation, bubble UI, voice, chat
├── preload.js       — IPC bridge
├── index.html       — SVG character + UI elements
├── style.css        — Animations, bubble styles, chat bar
├── avatar-parts.js  — Avatar customization system
├── panel.*          — Session history panel
├── avatar-editor.*  — Visual avatar editor
└── *.swift          — Native macOS speech helpers
```

**HTTP API** on port 19700:
- `POST /hooks/*` — Claude Code hook endpoints
- `POST /emotion` — Set emotion externally
- `GET /status` — Health check

---

## Requirements

- macOS (Apple Silicon or Intel)
- Node.js 18+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI

---

## Contributing

Sebastian is MIT licensed and open source. Contributions welcome!

Some ideas:
- **Linux/Windows support** — Electron is cross-platform, but TTS and wake word use macOS-specific APIs
- **New avatar packs** — Design new characters using the parts-based avatar system
- **More personality lines** — Add variety to the voice line pools
- **Theme support** — Dark/light/custom themes for the bubble and chat UI
- **Plugin system** — Let Sebastian respond to custom hooks

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

*Built with care by [Salakhitdinov Khidayotullo](https://github.com/xidik12)*
