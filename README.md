# Sebastian -- Your AI Desktop Butler

![Sebastian](screenshot.png)

A floating desktop companion that manages your Claude Code sessions, approves tool calls, and speaks with a gentleman's voice. Sebastian lives on your screen as an always-on-top animated character, acting as a visual and interactive front-end for AI-powered development workflows.

## Features

- **120 unique emotes** with visual effects (particles, screen shake, glow)
- **Voice** powered by native macOS TTS -- Sebastian speaks to you
- **Drag anywhere** on screen -- always-on-top transparent window
- **Mobile PWA remote control** -- control Sebastian from your phone
- **Session management** -- monitor and interact with Claude Code sessions
- **Customizable avatar** -- built-in avatar editor with swappable parts
- **Wake word detection** -- hands-free voice activation via Swift speech recognition

## Requirements

- macOS
- Node.js 18+
- Claude Code CLI

## Quick Start

```bash
git clone https://github.com/xidik12/sebastian.git
cd sebastian
npm install
npm start
```

To build a packaged macOS app:

```bash
npm run build
```

The built app will be in the `dist/` directory.

## Mobile Access

Sebastian includes a built-in mobile web interface for remote control. Once running, visit:

```
http://<your-ip>:19700/mobile/
```

from your phone on the same network.

## Tech Stack

- Electron 34
- Vanilla JavaScript
- SVG character with dynamic animation
- Native macOS TTS (via Swift helpers)
- Wake word detection (Swift speech recognition)

## License

MIT -- see [LICENSE](LICENSE) for details.
