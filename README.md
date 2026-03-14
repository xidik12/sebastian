# Sebastian — The AI Butler That Lives On Your Desktop

[![macOS](https://img.shields.io/badge/macOS-arm64%20%7C%20Intel-black?logo=apple)](https://github.com/xidik12/sebastian/releases)
[![Electron](https://img.shields.io/badge/Electron-34-47848F?logo=electron)](https://www.electronjs.org/)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Hook%20System-F97316?logo=anthropic)](https://docs.anthropic.com/en/docs/claude-code)
[![License: MIT](https://img.shields.io/badge/License-MIT-22d3ee.svg)](LICENSE)

> *"At your service, sir."*

**Sebastian** is a desktop AI companion that turns [Claude Code](https://docs.anthropic.com/en/docs/claude-code) from a CLI tool into a living workspace. He watches your coding sessions, approves tool calls with butler-like grace, speaks with a British accent, and reacts to your work with **116 unique emotions**.

He's not a chatbot. He's not a notification tray. He's a **character** with moods, opinions, and dry British wit.

<p align="center">
  <img src="https://raw.githubusercontent.com/xidik12/sebastian/main/screenshots/sebastian-hero.png" alt="Sebastian AI Butler Desktop Companion" width="600">
</p>

---

## Why Developers Love Sebastian

You're deep in a coding session. Claude Code needs permission to run a bash command. Instead of switching to the terminal, a little butler on your screen says:

> *"Sir, there's a Bash requiring your sign-off."*

You click **Yes**. He says *"Consider it done, sir."* and gets back to watching.

An hour later: *"Sixty minutes. You're in the zone, sir."*

Two hours: *"Sir, you've been at it for two hours. Perhaps stretch your legs?"*

Tests pass: His eyes light up. *"Excellent news, sir!"*

**Sebastian is the developer experience layer that Claude Code deserves.**

---

## Key Features

### Intelligent Approval System
- **Auto-approve mode** — toggle in settings to let Sebastian handle all approvals automatically
- **Smart learning** — learns your patterns after 20+ approvals, enters trust mode
- **Critical operation alerts** — even in auto-approve, flags destructive commands (`rm -rf`, `sudo`, `git push --force`) with visual warnings
- **Approval memory** — persists across restarts, remembers what you've approved before

### 116 Emotions with Particle Effects
Every emotion has unique iris colors, body animations, eyebrow positions, mouth shapes, and SVG particle effects:

| Category | Examples |
|----------|---------|
| **Core** | happy, excited, thinking, angry, sad, proud, nervous, sleeping |
| **Feelings** | grateful, euphoric, melancholy, anxious, blissful, furious |
| **Dev Activities** | coding, debugging, deploying, testing, building, refactoring |
| **Physical** | yawning, stretching, facepalm, saluting, meditating |
| **Social** | sarcastic, winking, eye-rolling, impressed, encouraging |
| **Status** | loading, syncing, critical-error, success, rate-limited |

### Living Personality Engine
- **Dynamic responses** — 4-10 alternatives per situation, never repeats back-to-back
- **Mood system** — cheerful after successes, concerned after errors, tired late at night
- **Time awareness** — morning greetings, weekend observations, late-night health reminders
- **Idle chatter** — *"I sometimes wonder if code dreams of electric sheep, sir."*
- **Language awareness** — reacts differently to Python, Rust, JavaScript, Go

### Voice & Wake Word
- **Native macOS TTS** — British gentleman's voice (Daniel) with real-time lip sync
- **Volume control** — adjustable TTS and sound effect levels
- **Sequential speech queue** — no overlapping voices, proper queue management
- **Wake word: "Sebastian"** — say his name and he activates, powered by on-device Speech Recognition (zero cloud dependencies)

### Session Management
- **Auto-discovers** Claude Code sessions — zero configuration
- **Color-coded sessions** — cyan, purple, emerald, orange... each gets a unique identity
- **Send messages** — type in Sebastian's chat bar to send prompts directly to Claude Code
- **Multi-session support** — monitor and approve across multiple parallel sessions

### Full Customization
- **Avatar editor** — built-in visual editor with swappable SVG parts
- **Custom characters** — create entirely new personas with the parts-based system
- **Per-avatar voice** — customize voice, rate, and pitch for each character
- **Settings popover** — auto-approve, sound, voice, lock position, wake word, volume

---

## Works With Ghost OS & MCP Ecosystem

Sebastian is designed to work alongside the modern AI tool ecosystem:

### Ghost OS Integration
[Ghost OS](https://github.com/ghostwright/ghost-os) provides native macOS computer-use capabilities via the accessibility tree and vision AI. When paired with Sebastian:

- **Sebastian** handles Claude Code approvals, personality, and session management
- **Ghost OS** handles native app interaction — clicking buttons, filling forms, reading screens
- Together they give Claude Code **full desktop autonomy**: coding in the terminal + operating any macOS app

**Setup Ghost OS:**
```bash
brew install ghostwright/ghost-os/ghost-os
```

Add to your Claude Code MCP config (`~/.claude/settings.json`):
```json
{
  "mcpServers": {
    "ghost-os": {
      "command": "ghost-os",
      "args": ["--stdio"]
    }
  }
}
```

Grant **Accessibility** and **Screen Recording** permissions in System Settings > Privacy & Security.

### MCP Server Compatibility
Sebastian works alongside any MCP (Model Context Protocol) server:

| MCP Server | Purpose | Integration |
|-----------|---------|-------------|
| **Ghost OS** | Native macOS app control | Desktop automation |
| **Oculo** | AI-powered browser control | Web automation |
| **mcp-unity** | Unity Editor integration | Game development |
| Any custom MCP | Your tools | Sebastian approves all tool calls |

---

## Quick Start

### 1. Install

```bash
git clone https://github.com/xidik12/sebastian.git
cd sebastian
npm install
```

### 2. Build & Install the macOS App

```bash
npm run build
cp -R dist/mac-arm64/Sebastian.app /Applications/
open /Applications/Sebastian.app
```

### 3. Connect Claude Code

Sebastian listens on port `19700`. Add these hooks to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      { "matcher": "", "hooks": [{ "type": "http", "url": "http://127.0.0.1:19700/hooks/session-start", "timeout": 5 }] }
    ],
    "PreToolUse": [
      { "matcher": "", "hooks": [{ "type": "http", "url": "http://127.0.0.1:19700/hooks/pre-tool-use", "timeout": 300 }] }
    ],
    "PostToolUse": [
      { "matcher": "", "hooks": [{ "type": "http", "url": "http://127.0.0.1:19700/hooks/post-tool-use", "timeout": 5 }] }
    ],
    "Stop": [
      { "matcher": "", "hooks": [{ "type": "http", "url": "http://127.0.0.1:19700/hooks/stop", "timeout": 5 }] }
    ],
    "Notification": [
      { "matcher": "", "hooks": [{ "type": "http", "url": "http://127.0.0.1:19700/hooks/notification", "timeout": 5 }] }
    ]
  }
}
```

### 4. Start Coding

Launch any Claude Code session. Sebastian detects it automatically and starts managing approvals, tracking your progress, and providing commentary.

**Enable auto-approve:** Click the gear icon in Sebastian's UI and toggle "Auto-approve" to let him handle all routine approvals automatically. Critical operations (like `rm -rf` or `sudo`) will still trigger visual alerts.

---

## The Personality Engine

Sebastian doesn't just display information. He **reacts** to your work:

| What Happens | Sebastian's Reaction |
|---|---|
| Session connects | *"Good evening, sir. A session is ready for you."* |
| 5 consecutive bash commands | *"You've been in the terminal for a while, sir."* |
| Tests pass | Eyes light up, proud expression, *"Excellent news!"* |
| 3 errors in a row | Nervous look, *"A pattern of errors, sir."* |
| Build succeeds | Excited animation, *"All set, sir!"* |
| 2 hours of coding | Concerned face, *"Perhaps stretch your legs?"* |
| Working on weekend | *"Working on a Saturday, sir? Dedication."* |
| Auto-approve milestone | *"Fifty auto-approvals. We make a fine team."* |
| Idle for a while | *"I sometimes wonder if code dreams of electric sheep."* |
| Auto-approve toggled ON | *"Full autonomy granted. Critical ops will still require your blessing."* |

Every response draws from pools of 4-10 alternatives. He never says the same thing twice in a row.

---

## Architecture

```
Sebastian (Electron + Native Swift)
├── main.js              — HTTP hook server, personality engine, approval system
├── app.js               — Character animation, bubble UI, emotion system
├── preload.js           — Secure IPC bridge
├── index.html           — SVG character + UI shell
├── style.css            — Animations, effects, dark UI
├── avatar-parts.js      — Avatar customization system
├── avatar-editor.*      — Visual avatar editor
├── panel.*              — Session history panel
├── speech-helper.swift  — Native macOS TTS
├── wake-word.swift      — On-device wake word detection
└── mobile/              — PWA remote control (beta)
```

**HTTP API** (port 19700):
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/hooks/session-start` | POST | Claude Code session connected |
| `/hooks/pre-tool-use` | POST | Tool approval request |
| `/hooks/post-tool-use` | POST | Tool execution complete |
| `/hooks/stop` | POST | Session ended |
| `/hooks/notification` | POST | Claude Code notification |
| `/emotion` | POST | Set emotion externally |
| `/health` | GET | Health check |

---

## Smart Approval System

Sebastian's approval system has three layers:

1. **Safe commands** — `ls`, `cat`, `git status`, `grep`, etc. — always auto-approved instantly
2. **Learned patterns** — after you approve a command type once with no denials, Sebastian remembers
3. **Auto-approve mode** — when enabled, approves everything with visual alerts for critical operations

**Critical operations** (never silently auto-approved without the toggle):
- `rm -rf` / `rm -f` — destructive file deletion
- `git push --force` — history rewrite
- `git reset --hard` — discard changes
- `sudo` — elevated privileges
- `DROP TABLE/DATABASE` — database destruction
- `railway up` — accidental deployment
- `chmod 777` — dangerous permissions
- `curl | bash` — pipe to shell

With auto-approve **ON**, even these are approved but Sebastian shows an `alert` emotion and broadcasts a warning — you see it, but you're not blocked.

---

## Requirements

- **macOS** (Apple Silicon or Intel)
- **Node.js 18+**
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** CLI

### Optional
- **Ghost OS** — for native macOS app control alongside Sebastian
- **Oculo** — for AI-powered browser automation

---

## Roadmap

- [ ] Linux support (alternative TTS + wake word backends)
- [ ] Windows support
- [ ] Plugin system for custom hooks and reactions
- [ ] Theme system (dark/light/custom)
- [ ] Mobile PWA remote control (in progress)
- [ ] More avatar packs and characters
- [ ] Integration with more AI coding tools

---

## Contributing

Sebastian is MIT licensed and open source. Contributions welcome!

**Ideas:**
- New emotion animations and particle effects
- Additional personality lines and reactions
- Cross-platform TTS and speech recognition
- New avatar packs and character designs
- Plugin system for custom tool reactions

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <i>Built with care by <a href="https://github.com/xidik12">Salakhitdinov Khidayotullo</a></i>
  <br>
  <i>Sebastian is powered by <a href="https://www.anthropic.com">Claude</a> and the <a href="https://modelcontextprotocol.io">Model Context Protocol</a></i>
</p>
