# Sebastian — Marketing Copy

---

## 1. Hacker News — Show HN Post

**Title:** Show HN: Sebastian – An AI butler that lives on your macOS desktop and manages Claude Code

**Body:**

I built an Electron + native Swift desktop companion that hooks into Claude Code's HTTP hook system and turns the CLI into something that feels alive.

The technical pitch: Claude Code fires HTTP hooks (SessionStart, PreToolUse, PostToolUse, Stop, Notification) to a local server on port 19700. Sebastian intercepts those hooks, presents approval/deny UI for tool calls, and responds with JSON that controls whether Claude Code proceeds. The approval system has three layers: a safe-command whitelist (ls, cat, grep, etc. — instant pass), a learned-pattern memory that persists across restarts (approve `npm install` once, it remembers), and a full auto-approve toggle that still flags critical operations (rm -rf, sudo, git push --force, DROP TABLE) with visual alerts.

The native bits are in Swift — macOS `say` command for TTS (British "Daniel" voice, rendered to AIFF then played via afplay for volume control), and a separate Swift process using SFSpeechRecognizer for on-device wake word detection. The wake word listener runs continuously, restarts every 50 seconds (Apple's 1-minute recognition limit), and handles phonetic variants ("sabastian", "sevastian"). Zero cloud dependencies for speech — everything goes through Apple's on-device recognition API.

The character has 116 emotion states, each with programmatic iris colors, eyebrow positions, mouth shapes, body animations, and SVG particle effects. A personality engine tracks consecutive tool patterns, error streaks, time of day, and day of week, then fires contextual commentary from pools of 4-10 alternatives per event (no immediate repeats). There's a mood system (cheerful/concerned/impressed/tired) that shifts based on your session activity.

Built for the MCP ecosystem — works alongside Ghost OS (native macOS computer-use via accessibility tree) and any other MCP server. Sebastian handles the coding side, Ghost OS handles native app interaction.

MIT licensed. Electron 34, no dependencies beyond electron-builder.

https://github.com/xidik12/sebastian

---

## 2. Reddit r/ClaudeAI Post

**Title:** I built a desktop butler that watches your Claude Code sessions, approves tool calls, and talks with a British accent

**Body:**

I've been using Claude Code daily and got tired of constantly switching to the terminal to approve tool calls. So I built Sebastian — a little animated butler that sits on your macOS desktop, manages approvals, and reacts to your coding sessions in real time.

Here's what makes it fun:

- **He talks.** Native macOS TTS with a British gentleman voice. "Sir, there's a Bash requiring your sign-off." You click approve. "Consider it done, sir."
- **He learns.** Approve a command type once, he remembers. After 20+ approvals with zero denials, he enters trust mode and handles everything. Critical ops (rm -rf, sudo, force push) always get flagged.
- **He reacts.** 116 different emotions with particle effects. Tests pass? Eyes light up, proud expression. 3 errors in a row? Nervous look. Working at 2 AM? "Your dedication is admirable, sir, but rest is important."
- **He listens.** Say "Sebastian" and he activates — on-device wake word, no cloud.
- **He has opinions.** "I sometimes wonder if code dreams of electric sheep, sir." / "Five commands deep, sir. Like peeling an onion."

It uses Claude Code's hook system — just add the HTTP hooks to your settings.json and Sebastian intercepts everything. Sessions are auto-discovered and color-coded. You can even type messages in Sebastian's chat bar that get sent directly to Claude Code.

Works alongside Ghost OS (native macOS computer-use) and Oculo (browser automation) for the full AI-powered desktop experience.

Open source, MIT licensed: **https://github.com/xidik12/sebastian**

Coding alone at 3 AM never felt the same.

---

## 3. Reddit r/programming Post

**Title:** Electron + native Swift: Building a personality engine and smart approval system for AI coding tools

**Body:**

I built an open-source desktop companion called Sebastian that hooks into Claude Code's HTTP hook system and adds a visual approval layer, smart command learning, and a full personality engine. The architecture ended up being an interesting Electron-Swift hybrid, so I thought r/programming might find the technical decisions worth discussing.

**Architecture overview:**

Electron handles the UI, HTTP server, and personality engine. Three Swift scripts handle native macOS APIs that Electron can't reach:

- `speech-helper.swift` — Uses SFSpeechRecognizer with on-device recognition (`requiresOnDeviceRecognition = true`) for voice-to-text input
- `wake-word.swift` — Continuous listener using SFSpeechAudioBufferRecognitionRequest. Restarts every 50 seconds to work around Apple's 1-minute recognition limit. Communicates via stdout protocol: `WAKE\n` on detection, `PROMPT:<text>\n` for captured commands, `STOP\n` on stdin to terminate
- TTS renders to AIFF via macOS `say`, then plays through `afplay` with volume control — two-stage pipeline to get adjustable volume

**The approval system** has three layers:

1. **Safe whitelist** — regex patterns for read-only commands (ls, cat, grep, git status...) → instant auto-approve
2. **Learned memory** — after you approve a command class once with zero denials, it persists to `~/.sebastian/approval-memory.json`. Command classes are bucketed by tool type + base command (for Bash) or file extension (for Edit/Write)
3. **Critical pattern guard** — regex patterns for destructive operations (rm -rf, sudo, DROP TABLE, curl|bash, chmod 777, git push --force, git reset --hard). These are never silently approved — the user always sees a visual alert

The approval key generation is the interesting part. For Bash commands, it extracts the first two tokens before any pipe/semicolon/ampersand. For file operations, it groups by extension. This means approving one `npm install` approves all future npm installs, but `rm` commands stay gated.

**The personality engine** tracks state across sessions: consecutive tool streaks, error counts, success streaks, files edited, time of day, day of week. It picks from pools of 4-10 response alternatives per event type with a no-immediate-repeat constraint. A mood FSM (neutral → cheerful → concerned → impressed → tired) shifts based on accumulated signals and influences which commentary pool gets sampled.

The character has 116 named emotion states. Each maps to programmatic SVG properties: iris color, pupil size, eyebrow angle, mouth shape, body position, and a particle effect. The avatar system is parts-based (swappable SVG elements) with a built-in visual editor.

**Hook protocol:** Claude Code sends POST requests to localhost:19700 at each lifecycle event. The PreToolUse hook is the critical one — Sebastian must respond within 300 seconds with `{"decision": "approve"}` or `{"decision": "deny"}`. The timeout is intentional; it gives you time to review.

MIT licensed, zero runtime dependencies beyond Electron: **https://github.com/xidik12/sebastian**

Curious about similar patterns people have built for other AI coding tools.

---

## 4. Reddit r/SideProject Post

**Title:** I built an AI butler named Sebastian because coding alone at 3 AM was getting depressing

**Body:**

I spend a lot of hours coding with Claude Code. It's incredibly powerful, but it's also... a CLI. No face. No voice. Just text scrolling in a terminal.

At some point I realized I wanted a companion. Not another chatbot — I have plenty of those. I wanted a *character*. Something with personality that sits on my desktop, watches what I'm doing, and occasionally says something that makes me smile.

So I built Sebastian.

He's a little animated butler that lives on your macOS desktop. He hooks into Claude Code and manages tool approvals for you. But the approval system was just the starting point — the real project was building a personality engine that makes him feel alive.

He has 116 emotions. Not just "happy" and "sad" — things like "facepalm" when you delete something you just created, "impressed" when you're on a success streak, "yawning" when you've been idle, "meditating" during long builds.

He tracks your coding patterns and comments on them: "Five commands deep, sir. Like peeling an onion." / "Quite the refactoring spree, sir. The code appreciates it." / "Even the finest minds need sleep, sir."

He speaks with a British butler voice (macOS TTS), and you can say "Sebastian" to get his attention — on-device wake word, no data leaves your machine.

The best moment was when I was debugging at 2 AM, hit my fourth consecutive error, and he said: "The errors are piling up, sir. Perhaps a different approach?" And he was right.

Building this taught me a lot about making software feel human without it being annoying. The 45-second cooldown between proactive comments was the key insight — too frequent and it's noise, too rare and he feels dead.

Open source, MIT license. If you use Claude Code on macOS: **https://github.com/xidik12/sebastian**

He's not going to make your code better. But he might make the process feel a little less lonely.

---

## 5. Reddit r/MacOS Post

**Title:** Built a native macOS desktop companion using SFSpeechRecognizer for wake word + Daniel TTS voice — no cloud, no API keys

**Body:**

I've been working on a desktop companion app called Sebastian that uses native macOS APIs pretty heavily, and I wanted to share it with the macOS community since the native integration was the hardest (and most rewarding) part.

**What it does:** Sebastian is an animated AI butler that sits on your desktop and manages tool approvals for Claude Code (Anthropic's coding CLI). But the macOS-native features work independently of that.

**Native macOS features:**

- **Wake word detection** — Swift script using `SFSpeechRecognizer` with `SFSpeechAudioBufferRecognitionRequest`. Continuously listens on-device for "Sebastian" (handles phonetic variants too). Restarts every 50 seconds to stay within Apple's 1-minute recognition window. Zero cloud, zero API keys. Just Accessibility + Microphone + Speech Recognition permissions.

- **Text-to-speech** — Uses the `say` command with the "Daniel" voice (British English) at a tuned rate of 160 WPM. Two-stage pipeline: render to AIFF, then play through `afplay` with volume control. Sequential queue system prevents overlapping speech. Per-character voice customization stored in `~/.sebastian/avatars/`.

- **On-device speech-to-text** — When `supportsOnDeviceRecognition` is available, forces `requiresOnDeviceRecognition = true`. Your audio never leaves your Mac.

- **Accessibility** — Transparent, click-through Electron window (frameless, alwaysOnTop, transparent background) that sits on your desktop like a widget. Lock position toggle to prevent accidental drags.

**Permissions needed:**

- Microphone (for wake word + voice input)
- Speech Recognition (SFSpeechRecognizer)
- Accessibility (optional, for Ghost OS integration)
- Screen Recording (optional, for Ghost OS integration)

The app is Electron-based but the speech components are pure Swift, compiled and executed as child processes. This hybrid approach lets the UI live in web tech while keeping the native APIs actually native.

Open source, MIT licensed: **https://github.com/xidik12/sebastian**

Works on Apple Silicon and Intel Macs. Requires macOS with SFSpeechRecognizer support (macOS 10.15+).

---

## 6. Twitter/X Thread (10 Tweets)

**Tweet 1 (Hook):**
I built an AI butler that lives on my macOS desktop, manages my Claude Code sessions, speaks with a British accent, and has 116 emotions.

His name is Sebastian. He's open source. And coding has never been the same.

Thread. 🧵

**Tweet 2:**
The problem: Claude Code is insanely powerful but it's a CLI. Every tool call needs approval. You're constantly switching to the terminal to click yes.

Sebastian intercepts those approvals, shows them in a desktop UI, and learns your patterns. Approve something once → he remembers forever.

**Tweet 3:**
The approval system has 3 layers:

- Safe commands (ls, cat, grep) → instant auto-approve
- Learned patterns → approve once, remembered across restarts
- Critical guard → rm -rf, sudo, force push ALWAYS get flagged

After 20+ approvals with 0 denials, he enters full trust mode.

**Tweet 4:**
But the approval system was just the excuse. The real project was the personality engine.

Sebastian tracks your:
- Consecutive tool patterns
- Error streaks
- Time of day
- Files edited
- Session duration

Then comments from pools of 4-10 alternatives. Never repeats.

**Tweet 5:**
116 emotions. Not just happy/sad.

Coding. Debugging. Deploying. Facepalm. Meditating. Sarcastic. Eye-rolling. Critical-error.

Each emotion has unique iris colors, eyebrow angles, mouth shapes, body animations, and SVG particle effects. All procedural, all code.

**Tweet 6:**
He speaks.

Native macOS TTS with the "Daniel" voice — a proper British gentleman.

"Sir, there's a Bash requiring your sign-off."
"Consider it done, sir."
"I sometimes wonder if code dreams of electric sheep, sir."

Sequential queue. No overlapping voices. Volume control.

**Tweet 7:**
He listens.

Say "Sebastian" and he activates. On-device wake word using Apple's SFSpeechRecognizer. Zero cloud. Zero API keys.

Swift process restarts every 50s (Apple's 1-min limit). Handles phonetic variants. Your audio never leaves your Mac.

**Tweet 8:**
The mood system makes it feel real.

- 5+ success streak → "Remarkable progress, sir. Truly."
- 3+ errors → "The errors are piling up, sir. Perhaps a different approach?"
- Past midnight → "Even the finest minds need sleep, sir."
- Weekend → "Working on a Saturday, sir? Dedication."

**Tweet 9:**
Works with the full AI desktop stack:

- Sebastian → Claude Code approvals + personality
- Ghost OS → native macOS app control via accessibility tree
- Oculo → AI browser automation
- Any MCP server → Sebastian approves all tool calls

Together: Claude Code can code AND operate your entire Mac.

**Tweet 10:**
Sebastian is open source. MIT licensed. Electron + Swift. Zero dependencies beyond electron-builder.

If you use Claude Code on macOS, give him a home:

github.com/xidik12/sebastian

Star if you think coding companions should exist. PRs welcome — especially new emotions, personality lines, and cross-platform TTS.

---

## 7. Dev.to Article

**Title:** I Built a Desktop AI Butler with 116 Emotions Because My Terminal Felt Too Lonely

---

There's a moment every developer knows. It's 2 AM. You've been staring at a terminal for hours. Claude Code just asked for permission to run yet another bash command. You approve it without reading. You approve the next one. And the next.

You're a human rubber stamp for an AI.

I wanted something better. Not a smarter AI — Claude Code is already brilliant. I wanted a *companion*. Something with a face, a voice, and enough personality to make the process feel like a collaboration instead of a conveyor belt.

So I built Sebastian.

### What Sebastian Is

Sebastian is an open-source desktop companion for Claude Code. He's an animated butler who lives on your macOS desktop, intercepts tool approval requests, speaks with a British accent, and reacts to your coding sessions with 116 unique emotions.

He's built with Electron for the UI and native Swift for macOS speech APIs. He communicates with Claude Code through the HTTP hook system — a set of lifecycle events that Claude Code fires as POST requests during a session.

### The Hook System

Claude Code exposes five hooks: `SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, and `Notification`. Sebastian runs an HTTP server on port 19700 and registers as the handler for all of them.

The configuration lives in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [{
          "type": "http",
          "url": "http://127.0.0.1:19700/hooks/pre-tool-use",
          "timeout": 300
        }]
      }
    ]
  }
}
```

The critical hook is `PreToolUse`. When Claude Code wants to run a Bash command, edit a file, or write something, it sends a POST with the tool name and input. Sebastian must respond within 300 seconds with either `{"decision": "approve"}` or `{"decision": "deny"}`.

That 300-second timeout is the entire UX. Sebastian shows the request in a desktop bubble, the user reviews and clicks approve/deny, and the response goes back to Claude Code. No terminal switching required.

### Smart Approval: Three Layers of Trust

A raw approval button would get old fast. So Sebastian has a three-layer system:

**Layer 1: Safe Commands.** Read-only operations like `ls`, `cat`, `grep`, `git status`, `git diff` — these are matched by regex and auto-approved instantly. The user never sees them.

**Layer 2: Learned Patterns.** Every approval and denial is recorded to `~/.sebastian/approval-memory.json`. Commands are bucketed by type: Bash commands by their first two tokens, file operations by extension. Approve `npm install` once with zero denials, and all future `npm install` variants are auto-approved. After 20+ total approvals with zero denials, Sebastian enters global trust mode.

**Layer 3: Critical Guard.** Destructive patterns are never silently approved:

```javascript
const CRITICAL_PATTERNS = [
  /\brm\s+(-[a-zA-Z]*f|-[a-zA-Z]*r|--force)/i,
  /\bgit\s+push\b.*--force/i,
  /\bgit\s+reset\s+--hard/i,
  /\bsudo\b/,
  /\bdrop\s+(table|database|schema)/i,
  /\bcurl\b.*\|\s*(bash|sh|zsh)/,
]
```

Even in full auto-approve mode, these trigger a visual alert. You can't accidentally `rm -rf /` through Sebastian without seeing it.

### The Personality Engine

This is where the project became something I didn't expect.

Sebastian tracks your session state: consecutive tool types, error counts, success streaks, files edited, time of day, day of week. A mood system with five states (neutral, cheerful, concerned, impressed, tired) shifts based on accumulated signals.

Commentary draws from pools of 4-10 alternatives per event type. A no-repeat constraint ensures he never says the same thing twice in a row. A 45-second cooldown prevents him from being annoying.

The result: after an hour of coding, Sebastian feels like he's *watching*. Not in a creepy way — in a "someone is paying attention to my work" way. When he says "Remarkable progress, sir. Truly." after a success streak, it lands differently than a notification would.

When he says "The errors are piling up, sir. Perhaps a different approach?" after your fourth failed attempt, he's not wrong.

### 116 Emotions, All Procedural

Each emotion state maps to SVG properties: iris color, pupil size, eyebrow angle and position, mouth shape, body position delta, and a particle effect type. The avatar is parts-based — eyes, brows, mouth, body are separate SVG elements that get parameterized per emotion.

Categories span core feelings (happy, sad, proud, nervous), developer activities (coding, debugging, deploying, testing), physical actions (yawning, stretching, facepalm, saluting), and social reactions (sarcastic, winking, eye-rolling, impressed).

The avatar editor lets you swap parts and create entirely new characters with custom voices. Each avatar stores its own TTS voice, rate, and pitch in a metadata file.

### Native Swift for Voice

Electron can't access macOS's SFSpeechRecognizer or the `say` command with volume control natively. Sebastian uses compiled Swift scripts as child processes:

- **Wake word detection** runs as a persistent process using `SFSpeechAudioBufferRecognitionRequest`. It listens continuously, restarts every 50 seconds to work around Apple's 1-minute recognition limit, and sends `WAKE` on stdout when it hears "Sebastian." Everything is on-device — `requiresOnDeviceRecognition = true`.

- **TTS** uses a two-stage pipeline: render speech to an AIFF file via `say -o`, then play it through `afplay -v` for volume control. A queue system in the main process prevents overlapping utterances.

### Why It Matters

Claude Code is one of the most powerful development tools I've used. But it's headless. It has no presence. When I approve 50 tool calls in a session, there's no ritual to it — just "y" in a terminal, over and over.

Sebastian adds ritual. He adds acknowledgment. He adds a character who says "Another commit for the history books, sir" when you ship, and "Perhaps we should wrap up for tonight, sir?" when you should stop.

Is it productive? The approval system genuinely saves time. The trust mode means most sessions run with zero manual approvals after the first few. The critical guard has saved me from at least one accidental force push.

Is it necessary? No. But neither are IDE themes, mechanical keyboards, or desktop wallpapers. Sometimes the tools that make you *feel* something are the ones that keep you going at 2 AM.

### Get Sebastian

Sebastian is open source, MIT licensed, and built for macOS.

```bash
git clone https://github.com/xidik12/sebastian.git
cd sebastian
npm install
npm run build
cp -R dist/mac-arm64/Sebastian.app /Applications/
```

Add the hooks to your Claude Code config, launch the app, and start coding. He'll introduce himself.

**GitHub:** [github.com/xidik12/sebastian](https://github.com/xidik12/sebastian)

Contributions welcome — especially new emotions, personality lines, avatar packs, and cross-platform support (Linux/Windows TTS backends are the big gaps).

He's just a butler. But he's *your* butler.

---

## 8. Product Hunt

**Tagline (60 chars max):**
An AI butler that lives on your desktop and codes with you

**Description (260 chars max):**
Sebastian hooks into Claude Code and turns your CLI into a living workspace. He approves tool calls, speaks with a British accent, reacts with 116 emotions, learns your patterns, and watches your sessions — all from a little animated butler on your macOS desktop.

**5 Key Features:**

- **Smart Approval System** — Learns your command patterns and auto-approves safe operations while flagging destructive ones like rm -rf and force push
- **116 Emotions with Particle Effects** — Every emotion has unique iris colors, animations, and SVG particles — from "coding" to "facepalm" to "deploying"
- **British Butler Voice + Wake Word** — Native macOS TTS with the Daniel voice and on-device wake word detection. Say "Sebastian" — zero cloud dependencies
- **Living Personality Engine** — Mood system, idle chatter, time awareness, coding pattern commentary. 4-10 response alternatives per event, never repeats
- **Open Source & Extensible** — MIT licensed. Custom avatar editor, swappable SVG parts, per-character voices. Works with Ghost OS and any MCP server
