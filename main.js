const { app, BrowserWindow, ipcMain, screen, Menu, systemPreferences, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const http = require('http')
const { exec, execFile } = require('child_process')
const readline = require('readline')

const STATE_FILE = path.join(os.homedir(), '.sebastian-state')
const AVATAR_DIR = path.join(os.homedir(), '.sebastian', 'avatars')
const AVATAR_CONFIG = path.join(os.homedir(), '.sebastian', 'config.json')
const SETTINGS_FILE = path.join(os.homedir(), '.sebastian', 'settings.json')
const HTTP_PORT = 19700

let win = null
let panelWin = null
let avatarWin = null
let wakeWordProc = null

// ── Settings Persistence ────────────────────────────────────────────────────

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
  } catch {}
  return { sound: true, voice: false, lockPosition: false, wakeWord: false, volume: 0.8 }
}

function saveSettings(s) {
  const base = path.join(os.homedir(), '.sebastian')
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true })
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2))
}

let settings = loadSettings()
let soundEnabled = settings.sound !== false
let voiceEnabled = settings.voice === true

// ── Native TTS (macOS `say` command) ────────────────────────────────────────

let ttsVoiceName = 'Daniel'  // British gentleman voice
let ttsRate = 160            // slightly slower for deeper feel
let sayProc = null

function initTTSFromAvatar() {
  try {
    const config = fs.existsSync(AVATAR_CONFIG) ? JSON.parse(fs.readFileSync(AVATAR_CONFIG, 'utf8')) : null
    if (config && config.activeAvatar) {
      const metaPath = path.join(AVATAR_DIR, config.activeAvatar, 'meta.json')
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
        if (meta.voice && meta.voice.name) ttsVoiceName = meta.voice.name
        if (meta.voice && meta.voice.rate) ttsRate = Math.round(meta.voice.rate * 180)
      }
    }
  } catch {}
}
initTTSFromAvatar()

function nativeSay(text) {
  if (!voiceEnabled) return
  if (!text) return
  // Kill any ongoing speech
  if (sayProc) {
    try { sayProc.kill() } catch {}
    sayProc = null
  }
  const { spawn } = require('child_process')
  const vol = settings.volume != null ? settings.volume : 0.8
  const tmpFile = path.join(os.tmpdir(), 'sebastian-speech.aiff')
  const args = ['-o', tmpFile]
  if (ttsVoiceName) args.push('-v', ttsVoiceName)
  args.push('-r', String(ttsRate))
  args.push(text)
  // Render to file, then play with volume control via afplay
  sayProc = spawn('say', args, { stdio: 'ignore' })
  sayProc.on('close', (code) => {
    if (code !== 0) { sayProc = null; return }
    const playProc = spawn('afplay', ['-v', String(vol), tmpFile], { stdio: 'ignore' })
    sayProc = playProc
    broadcastToMain('speech-start', text)
    playProc.on('close', () => {
      sayProc = null
      broadcastToMain('speech-end', null)
    })
    playProc.on('error', () => { sayProc = null })
  })
  sayProc.on('error', () => { sayProc = null })
}

// ── Session Management ────────────────────────────────────────────────────────

const sessions = new Map()
const pendingApprovals = new Map()
let approvalIdCounter = 0

// ── Mobile PWA SSE ──────────────────────────────────────────────────────────
const mobileClients = new Set()
let sseEventId = 0

const NEEDS_APPROVAL = new Set(['Bash', 'Edit', 'Write', 'NotebookEdit'])

// ── Smart Approval System ──────────────────────────────────────────────────
const APPROVAL_MEMORY_FILE = path.join(os.homedir(), '.sebastian', 'approval-memory.json')

// Commands/patterns that are ALWAYS dangerous — never auto-approve
const CRITICAL_PATTERNS = [
  /\brm\s+(-[a-zA-Z]*f|-[a-zA-Z]*r|--force)/i,  // rm -rf, rm -f
  /\brm\b.*\//,                                     // rm with paths
  /\bgit\s+push\b.*--force/i,                       // git push --force
  /\bgit\s+reset\s+--hard/i,                        // git reset --hard
  /\bgit\s+checkout\s+\./,                           // git checkout . (discard all)
  /\bgit\s+clean\s+-[a-zA-Z]*f/i,                   // git clean -f
  /\bgit\s+branch\s+-[dD]/,                          // git branch -d/-D
  /\bsudo\b/,                                        // anything with sudo
  /\bdrop\s+(table|database|schema)/i,               // SQL drops
  /\bdelete\s+from\b/i,                              // SQL deletes
  /\btruncate\b/i,                                   // SQL truncate
  /\bkill\s+-9\b/,                                   // kill -9
  /\bpkill\b/,                                       // pkill
  /\brailway\s+up\b/,                                // railway up (known bad)
  /\.env\b/,                                         // touching .env files
  /credentials|secrets|password|token/i,             // secret files
  /production|prod\b/i,                              // production-related
  /--no-verify/,                                     // skipping git hooks
  /\bchmod\s+777\b/,                                 // dangerous perms
  /\bcurl\b.*\|\s*(bash|sh|zsh)/,                    // pipe to shell
]

// Commands that are inherently safe — always auto-approve
const SAFE_BASH_PATTERNS = [
  /^\s*ls\b/,
  /^\s*cat\b/,
  /^\s*head\b/,
  /^\s*tail\b/,
  /^\s*wc\b/,
  /^\s*echo\b/,
  /^\s*pwd\b/,
  /^\s*which\b/,
  /^\s*whoami\b/,
  /^\s*date\b/,
  /^\s*git\s+(status|log|diff|show|branch|remote|tag)\b/,
  /^\s*git\s+stash\s+list\b/,
  /^\s*npm\s+(list|ls|info|view|outdated)\b/,
  /^\s*node\s+-[ep]\b/,
  /^\s*python3?\s+-c\s/,
  /^\s*grep\b/,
  /^\s*find\b/,
  /^\s*curl\s+-s\b/,  // silent curl (read-only fetches)
  /^\s*jq\b/,
  /^\s*sort\b/,
  /^\s*uniq\b/,
  /^\s*diff\b/,
  /^\s*file\b/,
  /^\s*stat\b/,
  /^\s*du\b/,
  /^\s*df\b/,
  /^\s*uname\b/,
  /^\s*ipconfig\b/,
  /^\s*ifconfig\b/,
  /^\s*sw_vers\b/,
  /^\s*xcodebuild\s+-version\b/,
]

function loadApprovalMemory() {
  try {
    if (fs.existsSync(APPROVAL_MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(APPROVAL_MEMORY_FILE, 'utf8'))
    }
  } catch {}
  return { patterns: {}, stats: { totalApproved: 0, totalDenied: 0, autoApproved: 0 } }
}

function saveApprovalMemory(mem) {
  const base = path.join(os.homedir(), '.sebastian')
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true })
  fs.writeFileSync(APPROVAL_MEMORY_FILE, JSON.stringify(mem, null, 2))
}

let approvalMemory = loadApprovalMemory()

function getApprovalKey(toolName, toolInput) {
  if (toolName === 'Bash') {
    // Extract base command (first word/pipe)
    const cmd = (toolInput?.command || '').trim()
    // Use first meaningful command as key
    const base = cmd.split(/[|;&\n]/)[0].trim().split(/\s+/).slice(0, 2).join(' ')
    return `Bash:${base}`
  }
  if (toolName === 'Edit' || toolName === 'Write') {
    const fp = toolInput?.file_path || ''
    // Group by file extension
    const ext = path.extname(fp) || 'unknown'
    return `${toolName}:${ext}`
  }
  return `${toolName}:generic`
}

function isCriticalOperation(toolName, toolInput) {
  if (toolName === 'Bash') {
    const cmd = (toolInput?.command || '').trim()
    return CRITICAL_PATTERNS.some(p => p.test(cmd))
  }
  if (toolName === 'Write' || toolName === 'Edit') {
    const fp = (toolInput?.file_path || '').toLowerCase()
    if (/\.env|credentials|secrets|password|token|\.pem|\.key/.test(fp)) return true
    if (/production|prod\/|deploy/.test(fp)) return true
  }
  return false
}

function isSafeBashCommand(cmd) {
  const trimmed = (cmd || '').trim()
  return SAFE_BASH_PATTERNS.some(p => p.test(trimmed))
}

function shouldAutoApprove(toolName, toolInput) {
  // Critical operations NEVER auto-approve
  if (isCriticalOperation(toolName, toolInput)) return { auto: false, reason: 'critical' }

  // Safe bash commands always auto-approve
  if (toolName === 'Bash' && isSafeBashCommand(toolInput?.command)) {
    return { auto: true, reason: 'safe-command' }
  }

  // Trust mode: if user has 20+ approvals and 0 denials, auto-approve all non-critical
  const stats = approvalMemory.stats || {}
  if ((stats.totalApproved || 0) >= 20 && (stats.totalDenied || 0) === 0) {
    return { auto: true, reason: `trusted (${stats.totalApproved} approvals, 0 denials)` }
  }

  // Check learned patterns — auto-approve after 1+ approvals with no denials
  const key = getApprovalKey(toolName, toolInput)
  const mem = approvalMemory.patterns[key]
  if (mem && mem.approved >= 1 && mem.denied === 0) {
    return { auto: true, reason: `learned (${mem.approved}x approved)` }
  }

  return { auto: false, reason: 'needs-review' }
}

function recordApprovalChoice(toolName, toolInput, approved) {
  const key = getApprovalKey(toolName, toolInput)
  if (!approvalMemory.patterns[key]) {
    approvalMemory.patterns[key] = { approved: 0, denied: 0, lastSeen: 0 }
  }
  const entry = approvalMemory.patterns[key]
  if (approved) {
    entry.approved++
    approvalMemory.stats.totalApproved++
  } else {
    entry.denied++
    approvalMemory.stats.totalDenied++
  }
  entry.lastSeen = Date.now()
  saveApprovalMemory(approvalMemory)
}

// ── Personality Engine ────────────────────────────────────────────────────────

class PersonalityEngine {
  constructor() {
    this.lastLineIndex = {}
    this.lastCommentTime = 0
    this.COMMENT_COOLDOWN = 45000 // 45s between proactive comments
    this.sessionStartTime = null
    this.totalToolUses = 0
    this.consecutiveBashCount = 0
    this.consecutiveEditCount = 0
    this.consecutiveReadCount = 0
    this.consecutiveGrepCount = 0
    this.milestonesFired = new Set()
    this.milestoneInterval = null
    this.idleTimer = null
    this.idleChatInterval = null

    // Deep tracking
    this.errorCount = 0
    this.successStreak = 0
    this.filesEdited = new Set()
    this.projectsWorkedOn = new Set()
    this.sessionCount = 0
    this.autoApproveCount = 0
    this.lastToolName = null
    this.lastProjectName = null
    this.dayOfWeek = new Date().getDay()
    this.mood = 'neutral' // neutral, cheerful, concerned, impressed, tired

    // Persistence — track across app lifetime
    this.appStartTime = Date.now()
    this.lastIdleComment = 0
  }

  // ── Time Awareness ──────────────────────────────────────────────────

  getTimeOfDay() {
    const h = new Date().getHours()
    if (h >= 5 && h < 12) return 'morning'
    if (h >= 12 && h < 17) return 'afternoon'
    if (h >= 17 && h < 21) return 'evening'
    return 'latenight'
  }

  getTimeGreeting() {
    const t = this.getTimeOfDay()
    if (t === 'morning') return 'Good morning, sir.'
    if (t === 'afternoon') return 'Good afternoon, sir.'
    if (t === 'evening') return 'Good evening, sir.'
    return 'Rather late, sir.'
  }

  getDayComment() {
    const day = new Date().getDay()
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return dayNames[day]
  }

  isWeekend() {
    const d = new Date().getDay()
    return d === 0 || d === 6
  }

  isLateNight() {
    const h = new Date().getHours()
    return h >= 23 || h < 5
  }

  // ── Line Picker (no immediate repeats) ──────────────────────────────

  pickLine(eventType, pool, context = {}) {
    if (!pool || pool.length === 0) return ''
    let idx = Math.floor(Math.random() * pool.length)
    if (pool.length > 1 && idx === this.lastLineIndex[eventType]) {
      idx = (idx + 1) % pool.length
    }
    this.lastLineIndex[eventType] = idx
    let line = pool[idx]
    if (context.project) line = line.replace(/\{project\}/g, context.project)
    if (context.tool) line = line.replace(/\{tool\}/g, context.tool)
    if (context.session) line = line.replace(/\{session\}/g, context.session)
    if (context.count) line = line.replace(/\{count\}/g, context.count)
    if (context.file) line = line.replace(/\{file\}/g, context.file)
    if (context.day) line = line.replace(/\{day\}/g, context.day)
    return line
  }

  // ── Mood System ─────────────────────────────────────────────────────
  // Mood shifts based on events, influences commentary tone

  updateMood() {
    if (this.errorCount >= 3) this.mood = 'concerned'
    else if (this.successStreak >= 5) this.mood = 'impressed'
    else if (this.isLateNight()) this.mood = 'tired'
    else if (this.totalToolUses > 50) this.mood = 'cheerful'
    else this.mood = 'neutral'
  }

  getMoodComment() {
    switch (this.mood) {
      case 'concerned': return this.pickLine('mood-concerned', [
        "Sir, we've hit a few bumps. Shall we reassess?",
        "The errors are piling up, sir. Perhaps a different approach?",
        "I notice things aren't going smoothly, sir. How can I help?",
        "A challenging stretch, sir. Stay the course.",
      ])
      case 'impressed': return this.pickLine('mood-impressed', [
        "I must say, sir, you're on fire today.",
        "Remarkable progress, sir. Truly.",
        "Everything's clicking into place, sir.",
        "A masterful display of engineering, sir.",
      ])
      case 'tired': return this.pickLine('mood-tired', [
        "It's getting quite late, sir. Your health matters too.",
        "The midnight oil burns low, sir.",
        "Perhaps we should wrap up for tonight, sir?",
        "Your dedication is admirable, sir, but rest is important.",
        "Even the finest minds need sleep, sir.",
      ])
      default: return null
    }
  }

  // ── Proactive Commentary System ─────────────────────────────────────

  canComment() {
    if (pendingApprovals.size > 0) return false
    if (Date.now() - this.lastCommentTime < this.COMMENT_COOLDOWN) return false
    return true
  }

  tryProactiveComment(data) {
    if (!this.canComment()) return

    this.updateMood()

    // 20% chance of tool commentary
    if (Math.random() > 0.20) return

    const comment = this.getToolCommentary(data)
    if (comment) {
      this.lastCommentTime = Date.now()
      const emotion = this.mood === 'concerned' ? 'nervous' : this.mood === 'impressed' ? 'proud' : 'amused'
      this.emitComment(comment, emotion)
    }
  }

  getToolCommentary(data) {
    const toolName = data.tool_name
    const toolInput = data.tool_input || {}

    // Track consecutive tool patterns
    if (toolName === 'Bash') {
      this.consecutiveBashCount++
      this.consecutiveEditCount = 0
      this.consecutiveReadCount = 0
      this.consecutiveGrepCount = 0
    } else if (toolName === 'Edit' || toolName === 'Write') {
      this.consecutiveEditCount++
      this.consecutiveBashCount = 0
      this.consecutiveReadCount = 0
      this.consecutiveGrepCount = 0
      if (toolInput.file_path) this.filesEdited.add(toolInput.file_path)
    } else if (toolName === 'Read') {
      this.consecutiveReadCount++
      this.consecutiveBashCount = 0
      this.consecutiveEditCount = 0
    } else if (toolName === 'Grep' || toolName === 'Glob') {
      this.consecutiveGrepCount++
      this.consecutiveBashCount = 0
      this.consecutiveEditCount = 0
    } else {
      this.consecutiveBashCount = 0
      this.consecutiveEditCount = 0
      this.consecutiveReadCount = 0
      this.consecutiveGrepCount = 0
    }

    // Track file context
    const filePath = toolInput.file_path || toolInput.path || ''
    const fileName = filePath ? filePath.split('/').pop() : ''
    const fileExt = fileName.includes('.') ? fileName.split('.').pop() : ''

    // ── Streak-based commentary ──

    if (this.consecutiveBashCount >= 5) {
      this.consecutiveBashCount = 0
      return this.pickLine('debug-streak', [
        "You've been in the terminal for a while, sir. Perhaps a fresh perspective?",
        "Quite the debugging session, sir. The plot thickens.",
        "The terminal sees a lot of you today, sir.",
        "Persistent troubleshooting, sir. Admirable tenacity.",
        "Five commands deep, sir. Like peeling an onion.",
        "The shell is getting a workout, sir. Shall I put the kettle on?",
      ])
    }

    if (this.consecutiveEditCount >= 5) {
      this.consecutiveEditCount = 0
      return this.pickLine('edit-streak', [
        "Quite the refactoring spree, sir. The code appreciates it.",
        "The codebase is getting a thorough makeover, sir.",
        "A prolific editing session, sir. {count} files touched so far.",
        "The files are feeling your attention today, sir.",
        "You're rewriting history, sir. In a good way.",
      ], { count: String(this.filesEdited.size) })
    }

    if (this.consecutiveReadCount >= 6) {
      this.consecutiveReadCount = 0
      return this.pickLine('read-streak', [
        "Doing your homework, sir. Very thorough.",
        "Reading the lay of the land, sir. Wise approach.",
        "Understanding before acting. The mark of wisdom, sir.",
        "A deep dive into the codebase, sir. Knowledge is power.",
      ])
    }

    if (this.consecutiveGrepCount >= 4) {
      this.consecutiveGrepCount = 0
      return this.pickLine('grep-streak', [
        "Hunting for something specific, sir? Like a bloodhound.",
        "The search continues, sir. We'll find it.",
        "Scouring the codebase, sir. Nothing escapes us.",
      ])
    }

    // ── Context-aware tool comments ──

    // Bash command awareness
    if (toolName === 'Bash' && toolInput.command) {
      const cmd = toolInput.command
      if (cmd.includes('npm test') || cmd.includes('jest') || cmd.includes('pytest') || cmd.includes('cargo test'))
        return this.pickLine('tool-test-run', [
          "Running the tests, sir. Moment of truth.", "Let's see if it holds up, sir.",
          "The tests will tell us the truth, sir.", "Testing... fingers crossed, sir.",
        ])
      if (cmd.includes('npm install') || cmd.includes('pip install') || cmd.includes('brew install'))
        return this.pickLine('tool-install', [
          "Installing dependencies, sir. Patience.", "Fetching packages, sir.",
          "The dependency tree grows, sir.", "Getting the building blocks, sir.",
        ])
      if (cmd.includes('git push'))
        return this.pickLine('tool-push', [
          "Pushing to the remote, sir. Ship it!", "Off it goes to the world, sir.",
          "Code shipped, sir. No turning back now.", "Pushing upstream, sir. Godspeed.",
        ])
      if (cmd.includes('git commit'))
        return this.pickLine('tool-commit', [
          "Committing to the record, sir.", "Saving our progress, sir. Well done.",
          "A milestone captured, sir.", "Another commit for the history books, sir.",
        ])
      if (cmd.includes('docker') || cmd.includes('kubectl'))
        return this.pickLine('tool-infra', [
          "Infrastructure work, sir. The backbone of it all.", "Containers and orchestration, sir. Very modern.",
          "Managing the infrastructure, sir.", "DevOps in action, sir.",
        ])
      if (cmd.includes('curl') || cmd.includes('wget') || cmd.includes('fetch'))
        return this.pickLine('tool-http', [
          "Making an HTTP request, sir. Let's see what comes back.", "Reaching out to the network, sir.",
        ])
      if (cmd.includes('rm ') || cmd.includes('delete'))
        return this.pickLine('tool-delete', [
          "Cleaning house, sir. Out with the old.", "Removing the unnecessary, sir.",
          "A bit of spring cleaning, sir.", "Making space, sir.",
        ])
      if (cmd.startsWith('cd '))
        return null // Don't comment on simple cd
      return this.pickLine('tool-bash-generic', [
        "Running commands, I see, sir.", "The terminal hums along, sir.",
        "Shell work, sir. The bread and butter.", "Command line artistry, sir.",
      ])
    }

    // File-type awareness
    if ((toolName === 'Edit' || toolName === 'Write') && fileExt) {
      const langComments = {
        js: ["JavaScript, sir. The language of the web.", "Shaping some JavaScript, sir."],
        ts: ["TypeScript, sir. Strong types, strong code.", "TypeScript refinements, sir."],
        py: ["Python, sir. Elegant and readable.", "Pythonic changes, sir."],
        rs: ["Rust, sir. Safety first.", "Rustacean at work, sir."],
        go: ["Go code, sir. Simple and efficient.", "Gopher territory, sir."],
        css: ["Styling work, sir. Making things beautiful.", "CSS adjustments, sir. Pixel perfect."],
        html: ["HTML structure, sir. The skeleton of the web.", "Markup work, sir."],
        json: ["Configuration changes, sir.", "Adjusting the JSON, sir."],
        md: ["Documentation, sir. Often overlooked, always important.", "Writing docs, sir. A noble pursuit."],
        sql: ["Database queries, sir. The data speaks.", "SQL work, sir. Talking to the database."],
        swift: ["Swift code, sir. Apple's finest.", "Swift development, sir."],
        java: ["Java, sir. Enterprise-grade.", "The Java machine churns, sir."],
        rb: ["Ruby, sir. A gem of a language.", "Ruby code, sir. Elegant."],
        sh: ["Shell scripting, sir. Automation at its finest.", "A shell script, sir."],
        yml: ["YAML configuration, sir. Mind the indentation.", "Config file, sir."],
        yaml: ["YAML configuration, sir. Mind the indentation.", "Config file, sir."],
        toml: ["TOML config, sir. Clean and clear.", "Configuration, sir."],
      }
      if (langComments[fileExt])
        return this.pickLine(`lang-${fileExt}`, langComments[fileExt])
    }

    // Generic tool comments
    const pools = {
      Bash: ["The terminal at work, sir.", "Shell commands flowing, sir.", "Command line work, sir."],
      Edit: ["Shaping the code, sir.", "A careful edit there, sir.", "Refining the code, sir."],
      Write: ["A new file. How exciting, sir.", "Creating something fresh, sir.", "Bringing a new file into the world, sir."],
      Grep: ["Searching for clues, sir.", "On the hunt, I see.", "Scouring the codebase, sir."],
      Glob: ["Surveying the file system, sir.", "Looking for files, sir."],
      WebSearch: ["Consulting the wider world, sir.", "Research underway, sir.", "Searching the web, sir. The world's knowledge at our fingertips."],
      WebFetch: ["Fetching a web page, sir.", "Pulling data from the web, sir."],
      Agent: ["Delegating to a specialist, sir. Wise.", "Subagent dispatched, sir.", "Parallel work, sir. Efficiency at its finest."],
      Read: ["Studying the codebase, sir.", "Having a look, sir.", "Reading up, sir."],
    }
    const pool = pools[toolName]
    if (pool) return this.pickLine(`tool-${toolName}`, pool)
    return null
  }

  // ── Error & Success Tracking ────────────────────────────────────────

  onToolError(data) {
    this.errorCount++
    this.successStreak = 0
    this.updateMood()

    if (!this.canComment()) return
    if (this.errorCount === 3) {
      this.lastCommentTime = Date.now()
      this.emitComment(this.pickLine('error-cluster', [
        "That's the third hiccup, sir. Perhaps we should step back and reassess?",
        "A pattern of errors, sir. Something fundamental might be off.",
        "Three errors now, sir. Let's think about this differently.",
        "The code is resisting, sir. Shall we try another angle?",
      ]), 'concerned')
    } else if (this.errorCount === 5) {
      this.lastCommentTime = Date.now()
      this.emitComment(this.pickLine('error-many', [
        "Five errors, sir. Might I suggest a /compact and a fresh start?",
        "We're in rough waters, sir. Don't hesitate to ask for help.",
        "Persistence is admirable, sir, but perhaps a different strategy?",
      ]), 'nervous')
    }
  }

  onToolSuccess() {
    this.successStreak++
    if (this.errorCount > 0) this.errorCount = Math.max(0, this.errorCount - 1)
    this.updateMood()

    if (!this.canComment()) return
    if (this.successStreak === 10) {
      this.lastCommentTime = Date.now()
      this.emitComment(this.pickLine('success-streak', [
        "Ten in a row without a hitch, sir. You're on a roll!",
        "Everything's going swimmingly, sir. Well done!",
        "A flawless streak, sir. The code bends to your will.",
        "Ten successful operations. Impressive, sir!",
      ]), 'proud')
    }
  }

  // ── Auto-Approve Awareness ──────────────────────────────────────────

  onAutoApprove(toolName) {
    this.autoApproveCount++
    if (!this.canComment()) return

    // Occasionally acknowledge trust
    if (this.autoApproveCount === 10) {
      this.lastCommentTime = Date.now()
      this.emitComment(this.pickLine('trust-10', [
        "Ten approvals handled on your behalf, sir. Your trust is well placed.",
        "I've been keeping things moving, sir. Ten auto-approvals so far.",
        "Smooth sailing, sir. I've cleared ten requests without troubling you.",
      ]), 'content')
    } else if (this.autoApproveCount === 50) {
      this.lastCommentTime = Date.now()
      this.emitComment(this.pickLine('trust-50', [
        "Fifty auto-approvals, sir. We make a fine team.",
        "I've handled fifty requests, sir. Your confidence means a great deal.",
        "Fifty and counting, sir. The workflow has never been smoother.",
      ]), 'proud')
    } else if (this.autoApproveCount > 50 && this.autoApproveCount % 100 === 0) {
      this.lastCommentTime = Date.now()
      this.emitComment(this.pickLine('trust-100', [
        `${this.autoApproveCount} approvals handled silently, sir. A well-oiled machine.`,
        `Another hundred cleared, sir. We work well together.`,
        `${this.autoApproveCount} auto-approvals. Quite the partnership, sir.`,
      ]), 'happy')
    }
  }

  // ── Suggestions Engine ──────────────────────────────────────────────

  checkSuggestions() {
    if (!this.canComment()) return

    // /compact suggestion every 30 tool uses
    if (this.totalToolUses > 0 && this.totalToolUses % 30 === 0) {
      this.lastCommentTime = Date.now()
      this.emitComment(this.pickLine('suggest-compact', [
        "Sir, the session has had quite a few operations. A /compact might be wise.",
        "The context is growing, sir. Might be time for a /compact.",
        "Thirty more operations, sir. Consider tidying the context.",
      ]), 'thinking')
      return
    }

    // Mood-based commentary every 15 tool uses
    if (this.totalToolUses > 0 && this.totalToolUses % 15 === 0) {
      const moodComment = this.getMoodComment()
      if (moodComment) {
        this.lastCommentTime = Date.now()
        const emotion = this.mood === 'concerned' ? 'nervous' : this.mood === 'tired' ? 'sad' : 'content'
        this.emitComment(moodComment, emotion)
        return
      }
    }

    // Weekend commentary (once per session)
    if (this.isWeekend() && !this.milestonesFired.has('weekend') && this.totalToolUses === 5) {
      this.milestonesFired.add('weekend')
      this.lastCommentTime = Date.now()
      this.emitComment(this.pickLine('weekend', [
        "Working on a {day}, sir? Your dedication knows no bounds.",
        "A {day} coding session, sir. I admire the commitment.",
        "Even on {day}, the work calls, sir. I'm here regardless.",
        "No rest for the ambitious, sir. A fine {day} to code.",
      ], { day: this.getDayComment() }), 'impressed')
      return
    }

    // Multi-project awareness
    if (this.projectsWorkedOn.size >= 3 && !this.milestonesFired.has('multiproject')) {
      this.milestonesFired.add('multiproject')
      this.lastCommentTime = Date.now()
      this.emitComment(this.pickLine('multi-project', [
        "Juggling {count} projects today, sir. Quite the workload.",
        "{count} different projects, sir. You wear many hats.",
        "A multi-project day, sir. {count} and counting.",
      ], { count: String(this.projectsWorkedOn.size) }), 'impressed')
      return
    }

    // File edit milestone
    if (this.filesEdited.size >= 10 && !this.milestonesFired.has('files10')) {
      this.milestonesFired.add('files10')
      this.lastCommentTime = Date.now()
      this.emitComment(this.pickLine('files-10', [
        "Ten files modified, sir. Significant changes underway.",
        "You've touched ten files, sir. Quite the scope.",
        "Ten files and counting, sir. A thorough piece of work.",
      ]), 'impressed')
      return
    }
    if (this.filesEdited.size >= 25 && !this.milestonesFired.has('files25')) {
      this.milestonesFired.add('files25')
      this.lastCommentTime = Date.now()
      this.emitComment(this.pickLine('files-25', [
        "Twenty-five files, sir. This is a proper overhaul.",
        "A quarter-century of files modified, sir. Ambitious.",
        "Major surgery on the codebase, sir. Twenty-five files deep.",
      ]), 'proud')
    }
  }

  // ── Session Lifecycle ───────────────────────────────────────────────

  onSessionStart(projectName) {
    this.sessionCount++
    if (projectName) this.projectsWorkedOn.add(projectName)
    this.lastProjectName = projectName

    // Reset error tracking for new session
    this.errorCount = 0
    this.successStreak = 0

    this.startMilestoneTimer()
    this.startIdleChatter()
  }

  onSessionStop(projectName) {
    const activeCount = Array.from(sessions.values()).filter(s => s.status === 'active' || s.status === 'working').length
    if (activeCount <= 1) {
      this.stopMilestoneTimer()
      this.stopIdleChatter()
    }
  }

  getSessionStartLine(projectName) {
    // First session of the day vs returning
    if (this.sessionCount === 1) {
      return this.pickLine('first-session', [
        "{timeGreeting} First session of the day, sir. Let's make it count.",
        "{timeGreeting} A fresh start, sir. Ready when you are.",
        "{timeGreeting} Welcome, sir. Your first session awaits.",
        "{timeGreeting} {project} is ready, sir. Shall we?",
        "{timeGreeting} The day begins, sir. {project} calls.",
      ], { project: projectName }).replace('{timeGreeting}', this.getTimeGreeting())
    }

    // Additional sessions
    if (this.sessionCount <= 3) {
      return this.pickLine('session-start', VOICE_LINES.sessionStart, { project: projectName })
        .replace('{timeGreeting}', this.getTimeGreeting())
    }

    // Many sessions
    return this.pickLine('many-sessions', [
      "Another session, sir. That makes {count} today.",
      "Session number {count}, sir. Busy day.",
      "{project} joins the roster, sir. {count} sessions active.",
      "More work arrives, sir. Session {count} connected.",
    ], { project: projectName, count: String(this.sessionCount) })
  }

  getTaskCompleteLine(projectName) {
    // Vary by mood and context
    if (this.mood === 'impressed') {
      return this.pickLine('complete-impressed', [
        "Another one down, sir. You're unstoppable today.",
        "Completed with flying colors, sir.",
        "Done and dusted, sir. What's next?",
        "Masterfully handled, sir. Task complete.",
      ])
    }
    if (this.mood === 'tired') {
      return this.pickLine('complete-tired', [
        "That's done, sir. Perhaps call it a night?",
        "Finished, sir. You've earned some rest.",
        "Complete at last, sir. The bed awaits.",
        "All done, sir. A well-deserved rest is in order.",
      ])
    }
    return this.pickLine('task-complete', VOICE_LINES.taskComplete)
  }

  // ── Milestone Timer ─────────────────────────────────────────────────

  startMilestoneTimer() {
    if (this.milestoneInterval) return
    this.sessionStartTime = Date.now()

    this.milestoneInterval = setInterval(() => {
      if (!this.canComment()) return

      const minutes = Math.floor((Date.now() - this.sessionStartTime) / 60000)

      if (minutes >= 5 && !this.milestonesFired.has('5min')) {
        this.milestonesFired.add('5min')
        this.lastCommentTime = Date.now()
        this.emitComment(this.pickLine('m5', [
          "Five minutes in, sir. Off to a good start.",
          "We're warmed up now, sir. Finding our stride.",
          "Five minutes. The gears are turning nicely, sir.",
          "Settling in, sir. Everything's looking good.",
        ]), 'content')
      }

      if (minutes >= 15 && !this.milestonesFired.has('15min')) {
        this.milestonesFired.add('15min')
        this.lastCommentTime = Date.now()
        this.emitComment(this.pickLine('m15', [
          "Quarter of an hour, sir. Good momentum.",
          "Fifteen minutes of focused work, sir.",
          "We're well underway, sir.",
        ]), 'content')
      }

      if (minutes >= 30 && !this.milestonesFired.has('30min')) {
        this.milestonesFired.add('30min')
        this.lastCommentTime = Date.now()
        this.emitComment(this.pickLine('m30', [
          "Half an hour, sir. Solid progress indeed.",
          "Thirty minutes of focused work, sir. Well done.",
          "The half-hour mark, sir. Carrying on splendidly.",
          "Thirty minutes deep, sir. Impressive focus.",
        ]), 'proud')
      }

      if (minutes >= 60 && !this.milestonesFired.has('1hr')) {
        this.milestonesFired.add('1hr')
        this.lastCommentTime = Date.now()
        this.emitComment(this.pickLine('m60', [
          "One hour, sir. Impressive stamina.",
          "A full hour. Might I suggest a brief respite, sir?",
          "Sixty minutes. You're in the zone, sir.",
          "An hour of solid work, sir. Consider stretching.",
        ]), 'proud')
      }

      if (minutes >= 90 && !this.milestonesFired.has('90min')) {
        this.milestonesFired.add('90min')
        this.lastCommentTime = Date.now()
        this.emitComment(this.pickLine('m90', [
          "Ninety minutes, sir. You're deep in it.",
          "An hour and a half. Your focus is remarkable, sir.",
          "Ninety minutes of work, sir. Don't forget to hydrate.",
        ]), 'impressed')
      }

      if (minutes >= 120 && !this.milestonesFired.has('2hr')) {
        this.milestonesFired.add('2hr')
        this.lastCommentTime = Date.now()
        this.emitComment(this.pickLine('m120', [
          "Two hours, sir. A break would do you good.",
          "Sir, you've been at it for two hours. Perhaps stretch your legs?",
          "Two hours of solid work. Your dedication is noted, sir, but do take care.",
          "Two hours, sir. Even I could use a cup of tea at this point.",
        ]), 'concerned')
      }

      if (minutes >= 180 && !this.milestonesFired.has('3hr')) {
        this.milestonesFired.add('3hr')
        this.lastCommentTime = Date.now()
        this.emitComment(this.pickLine('m180', [
          "Three hours, sir. I must insist on a break.",
          "Three hours straight, sir. Your eyes must be tired.",
          "Sir, three hours is a marathon. Please rest.",
        ]), 'nervous')
      }

      if (minutes >= 240 && !this.milestonesFired.has('4hr')) {
        this.milestonesFired.add('4hr')
        this.lastCommentTime = Date.now()
        this.emitComment(this.pickLine('m240', [
          "Four hours, sir. This is beyond dedication, it's heroic.",
          "Sir. Four hours. I am genuinely concerned.",
          "We've passed the four hour mark, sir. Please take care of yourself.",
        ]), 'nervous')
      }
    }, 30000)
  }

  stopMilestoneTimer() {
    if (this.milestoneInterval) {
      clearInterval(this.milestoneInterval)
      this.milestoneInterval = null
    }
  }

  // ── Idle Chatter System ─────────────────────────────────────────────
  // When no sessions are active, Sebastian occasionally says something

  startIdleChatter() {
    if (this.idleChatInterval) return

    this.idleChatInterval = setInterval(() => {
      // Only chat when idle — no active sessions working
      const workingCount = Array.from(sessions.values()).filter(s => s.status === 'working').length
      if (workingCount > 0) return
      if (pendingApprovals.size > 0) return
      if (Date.now() - this.lastCommentTime < 120000) return // 2 min cooldown for idle chat
      if (Date.now() - this.lastIdleComment < 300000) return // 5 min between idle chats

      // 10% chance each check (every 60s)
      if (Math.random() > 0.10) return

      this.lastIdleComment = Date.now()
      this.lastCommentTime = Date.now()

      const timeOfDay = this.getTimeOfDay()

      // Build a weighted pool based on context
      let pool = []

      // General idle thoughts
      pool.push(...[
        "Quiet moment, sir. A good time to plan ahead.",
        "All is calm, sir. Shall I be of service?",
        "Standing by, sir. The codebase is at peace.",
        "A moment of stillness, sir. Rather pleasant.",
        "The cursor blinks patiently, sir.",
        "If you need anything, sir, I'm right here.",
        "The bits rest quietly, sir.",
      ])

      // Time-specific
      if (timeOfDay === 'morning') pool.push(
        "A fine morning for productivity, sir.",
        "The morning air is good for the mind, sir.",
        "Early hours, sir. The best time to think clearly.",
      )
      if (timeOfDay === 'afternoon') pool.push(
        "The afternoon stretches on, sir. Tea?",
        "Post-lunch lull, sir? I understand completely.",
        "The afternoon sun warms the workspace, sir.",
      )
      if (timeOfDay === 'evening') pool.push(
        "Evening approaches, sir. Wrapping up soon?",
        "The day winds down, sir.",
        "A productive evening ahead, perhaps, sir?",
      )
      if (timeOfDay === 'latenight') pool.push(
        "The midnight oil burns, sir. Don't forget to rest.",
        "It's awfully late, sir. The code will be here tomorrow.",
        "Night owl mode, sir. Careful not to burn out.",
        "The world sleeps, sir. Perhaps you should too.",
      )

      // Self-referential butler humor
      pool.push(...[
        "I've been polishing the virtual silver, sir.",
        "Just tidying up around here, sir. Figuratively speaking.",
        "I sometimes wonder if code dreams of electric sheep, sir.",
        "A butler's work is never done, sir. Even a digital one.",
        "I've been practicing my expressions, sir. What do you think?",
        "Did you know I have over a hundred emotions, sir? Try right-clicking.",
        "I do enjoy our work together, sir. Even the quiet moments.",
      ])

      // Motivational
      pool.push(...[
        "Remember, sir, every expert was once a beginner.",
        "Great software is built one commit at a time, sir.",
        "The best code is the code that doesn't need to be written, sir.",
        "Simplicity is the ultimate sophistication, sir.",
      ])

      if (this.isWeekend()) pool.push(
        "Weekend coding, sir? Passion project?",
        "A relaxed {day}, sir. Or is it?",
      )

      const line = this.pickLine('idle-chat', pool, { day: this.getDayComment() })
      this.emitComment(line, 'content')
    }, 60000) // Check every 60 seconds
  }

  stopIdleChatter() {
    if (this.idleChatInterval) {
      clearInterval(this.idleChatInterval)
      this.idleChatInterval = null
    }
  }

  // ── Project Context Awareness ───────────────────────────────────────

  onProjectChange(newProject) {
    if (!newProject || newProject === this.lastProjectName) return
    if (!this.canComment()) return
    if (!this.lastProjectName) {
      this.lastProjectName = newProject
      return
    }

    this.lastProjectName = newProject
    this.lastCommentTime = Date.now()
    this.emitComment(this.pickLine('project-switch', [
      "Switching to {project}, sir. Context shift.",
      "Ah, {project} now, sir. A change of scenery.",
      "Moving over to {project}, sir. Right then.",
      "On to {project}, sir. Let me adjust.",
    ], { project: newProject }), 'thinking')
  }

  // ── Emitter ─────────────────────────────────────────────────────────

  emitComment(text, emotion) {
    if (!text) return
    broadcastToMain('personality-comment', { text, emotion })
    broadcastToMobile('voice-event', text)
    nativeSay(text)
    if (emotion) sendEmotion(emotion, text)
  }
}

const personality = new PersonalityEngine()

// Response pools used by personality engine for hook handlers
const VOICE_LINES = {
  sessionStart: [
    "A new session has connected, sir.",
    "{timeGreeting} A session is ready for you.",
    "Session connected. Standing by, sir.",
    "We have a new session, sir. Shall we begin?",
    "A fresh session awaits, sir.",
    "Connected and at your service, sir.",
    "Right then. New session in {project}, sir.",
    "Session linked. Ready when you are, sir.",
  ],
  taskComplete: [
    "All finished, sir.",
    "That's done, sir.",
    "Task complete. Anything else, sir?",
    "Mission accomplished, sir.",
    "The work is done, sir.",
    "Completed, sir. At your disposal.",
    "That wraps that up, sir.",
    "Task concluded. Standing by, sir.",
    "Well done. All finished, sir.",
  ],
  approvalNeeded: [
    "Sir, {session} needs your approval.",
    "A moment of your attention, sir. {session} requires approval.",
    "Pardon me, sir. {session} awaits your decision.",
    "Your approval is needed, sir. For {session}.",
    "Sir, there's a {tool} requiring your sign-off.",
    "If you would, sir. {session} needs permission to proceed.",
    "An approval request, sir. {tool} in {session}.",
    "Sir, might I have your attention? Approval needed.",
  ],
}

function getSessionDisplayName(session, fallbackId) {
  if (session?.title) {
    return session.title.length > 30 ? session.title.slice(0, 28) + '…' : session.title
  }
  // Avoid showing the username as the session name
  if (session?.cwd) {
    const folder = session.cwd.split('/').pop()
    const home = os.homedir().split('/').pop()
    if (folder && folder !== home) return folder
  }
  return fallbackId ? fallbackId.slice(0, 8) : 'a session'
}

function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  const wa = screen.getPrimaryDisplay().workArea

  win = new BrowserWindow({
    width: 280,
    height: 290,
    x: wa.x + Math.floor(sw / 2 - 140),
    y: wa.y + sh - 290,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.loadFile('index.html')

  // Pipe renderer console to main process for debugging
  win.webContents.on('console-message', (_, level, message) => {
    console.log(`[renderer] ${message}`)
  })

  // Context menu on the character
  win.webContents.on('context-menu', () => {
    const menu = Menu.buildFromTemplate([
      { label: 'Sebastian', enabled: false },
      { type: 'separator' },
      { label: 'Happy', click: () => sendEmotion('happy') },
      { label: 'Excited', click: () => sendEmotion('excited') },
      { label: 'Thinking', click: () => sendEmotion('thinking') },
      { label: 'Angry', click: () => sendEmotion('angry') },
      { label: 'Sad', click: () => sendEmotion('sad') },
      { label: 'Bored', click: () => sendEmotion('bored') },
      { label: 'Surprised', click: () => sendEmotion('surprised') },
      { label: 'Confused', click: () => sendEmotion('confused') },
      { label: 'Proud', click: () => sendEmotion('proud') },
      { label: 'Nervous', click: () => sendEmotion('nervous') },
      { label: 'Sleeping', click: () => sendEmotion('sleeping') },
      { label: 'Idle', click: () => sendEmotion('idle') },
      { type: 'separator' },
      { label: 'Emotions', submenu: [
        { label: 'Grateful', click: () => sendEmotion('grateful') },
        { label: 'Amused', click: () => sendEmotion('amused') },
        { label: 'Determined', click: () => sendEmotion('determined') },
        { label: 'Hopeful', click: () => sendEmotion('hopeful') },
        { label: 'Relieved', click: () => sendEmotion('relieved') },
        { label: 'Content', click: () => sendEmotion('content') },
        { label: 'Nostalgic', click: () => sendEmotion('nostalgic') },
        { label: 'Jealous', click: () => sendEmotion('jealous') },
        { label: 'Guilty', click: () => sendEmotion('guilty') },
        { label: 'Ashamed', click: () => sendEmotion('ashamed') },
        { label: 'Embarrassed', click: () => sendEmotion('embarrassed') },
        { label: 'Disgusted', click: () => sendEmotion('disgusted') },
        { label: 'Contempt', click: () => sendEmotion('contempt') },
        { label: 'Adoring', click: () => sendEmotion('adoring') },
        { label: 'Longing', click: () => sendEmotion('longing') },
        { label: 'Melancholy', click: () => sendEmotion('melancholy') },
        { label: 'Euphoric', click: () => sendEmotion('euphoric') },
        { label: 'Serene', click: () => sendEmotion('serene') },
        { label: 'Anxious', click: () => sendEmotion('anxious') },
        { label: 'Panicked', click: () => sendEmotion('panicked') },
        { label: 'Terrified', click: () => sendEmotion('terrified') },
        { label: 'Furious', click: () => sendEmotion('furious') },
        { label: 'Enraged', click: () => sendEmotion('enraged') },
        { label: 'Devastated', click: () => sendEmotion('devastated') },
        { label: 'Heartbroken', click: () => sendEmotion('heartbroken') },
        { label: 'Ecstatic', click: () => sendEmotion('ecstatic') },
        { label: 'Blissful', click: () => sendEmotion('blissful') },
        { label: 'Gloomy', click: () => sendEmotion('gloomy') },
        { label: 'Grumpy', click: () => sendEmotion('grumpy') },
        { label: 'Irritated', click: () => sendEmotion('irritated') },
      ]},
      { label: 'Dev Activities', submenu: [
        { label: 'Coding', click: () => sendEmotion('coding') },
        { label: 'Debugging', click: () => sendEmotion('debugging') },
        { label: 'Deploying', click: () => sendEmotion('deploying') },
        { label: 'Testing', click: () => sendEmotion('testing') },
        { label: 'Researching', click: () => sendEmotion('researching') },
        { label: 'Downloading', click: () => sendEmotion('downloading') },
        { label: 'Uploading', click: () => sendEmotion('uploading') },
        { label: 'Compiling', click: () => sendEmotion('compiling') },
        { label: 'Installing', click: () => sendEmotion('installing') },
        { label: 'Searching', click: () => sendEmotion('searching') },
        { label: 'Calculating', click: () => sendEmotion('calculating') },
        { label: 'Analyzing', click: () => sendEmotion('analyzing') },
        { label: 'Reviewing', click: () => sendEmotion('reviewing') },
        { label: 'Building', click: () => sendEmotion('building') },
        { label: 'Fixing', click: () => sendEmotion('fixing') },
        { label: 'Refactoring', click: () => sendEmotion('refactoring') },
        { label: 'Committing', click: () => sendEmotion('committing') },
        { label: 'Pushing', click: () => sendEmotion('pushing') },
        { label: 'Pulling', click: () => sendEmotion('pulling') },
        { label: 'Merging', click: () => sendEmotion('merging') },
        { label: 'Branching', click: () => sendEmotion('branching') },
        { label: 'Rolling Back', click: () => sendEmotion('rolling-back') },
        { label: 'Monitoring', click: () => sendEmotion('monitoring') },
        { label: 'Profiling', click: () => sendEmotion('profiling') },
        { label: 'Benchmarking', click: () => sendEmotion('benchmarking') },
      ]},
      { label: 'Physical', submenu: [
        { label: 'Yawning', click: () => sendEmotion('yawning') },
        { label: 'Sneezing', click: () => sendEmotion('sneezing') },
        { label: 'Coughing', click: () => sendEmotion('coughing') },
        { label: 'Shivering', click: () => sendEmotion('shivering') },
        { label: 'Sweating', click: () => sendEmotion('sweating') },
        { label: 'Dizzy', click: () => sendEmotion('dizzy') },
        { label: 'Fainting', click: () => sendEmotion('fainting') },
        { label: 'Stretching', click: () => sendEmotion('stretching-out') },
        { label: 'Nodding', click: () => sendEmotion('nodding') },
        { label: 'Shaking Head', click: () => sendEmotion('shaking-head') },
        { label: 'Facepalm', click: () => sendEmotion('facepalm') },
        { label: 'Saluting', click: () => sendEmotion('saluting') },
        { label: 'Clapping', click: () => sendEmotion('clapping') },
        { label: 'Thumbs Up', click: () => sendEmotion('thumbs-up') },
        { label: 'Pointing', click: () => sendEmotion('pointing') },
        { label: 'Shrugging', click: () => sendEmotion('shrugging') },
        { label: 'Flexing', click: () => sendEmotion('flexing') },
        { label: 'Meditating', click: () => sendEmotion('meditating') },
        { label: 'Praying', click: () => sendEmotion('praying') },
        { label: 'Bowing', click: () => sendEmotion('bowing-deep') },
      ]},
      { label: 'Social', submenu: [
        { label: 'Sarcastic', click: () => sendEmotion('sarcastic') },
        { label: 'Smirking', click: () => sendEmotion('smirking') },
        { label: 'Winking', click: () => sendEmotion('winking') },
        { label: 'Eye Rolling', click: () => sendEmotion('eye-rolling') },
        { label: 'Skeptical', click: () => sendEmotion('skeptical') },
        { label: 'Suspicious', click: () => sendEmotion('suspicious') },
        { label: 'Intrigued', click: () => sendEmotion('intrigued') },
        { label: 'Fascinated', click: () => sendEmotion('fascinated') },
        { label: 'Impressed', click: () => sendEmotion('impressed') },
        { label: 'Disappointed', click: () => sendEmotion('disappointed') },
        { label: 'Apologetic', click: () => sendEmotion('apologetic') },
        { label: 'Pleading', click: () => sendEmotion('pleading') },
        { label: 'Commanding', click: () => sendEmotion('commanding') },
        { label: 'Reassuring', click: () => sendEmotion('reassuring') },
        { label: 'Encouraging', click: () => sendEmotion('encouraging') },
      ]},
      { label: 'Status', submenu: [
        { label: 'Loading', click: () => sendEmotion('loading') },
        { label: 'Syncing', click: () => sendEmotion('syncing') },
        { label: 'Critical Error', click: () => sendEmotion('error-critical') },
        { label: 'Warning', click: () => sendEmotion('warning') },
        { label: 'Success', click: () => sendEmotion('success') },
        { label: 'Pending', click: () => sendEmotion('pending') },
        { label: 'Processing', click: () => sendEmotion('processing') },
        { label: 'Queued', click: () => sendEmotion('queued') },
        { label: 'Timeout', click: () => sendEmotion('timeout') },
        { label: 'Rate Limited', click: () => sendEmotion('rate-limited') },
      ]},
      { type: 'separator' },
      {
        label: 'Lock Position',
        type: 'checkbox',
        checked: settings.lockPosition || false,
        click: (item) => {
          settings.lockPosition = item.checked
          saveSettings(settings)
          if (win && !win.isDestroyed()) {
            win.webContents.send('setting-changed', { lockPosition: item.checked })
          }
        },
      },
      { label: 'Reset Position', click: () => resetPosition() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ])
    menu.popup()
  })
}

function buildAppMenu() {
  const template = [
    {
      label: 'Sebastian',
      submenu: [
        { label: 'About Sebastian', role: 'about' },
        { type: 'separator' },
        {
          label: 'Sound Notifications',
          type: 'checkbox',
          checked: soundEnabled,
          click: (item) => {
            soundEnabled = item.checked
            if (win && !win.isDestroyed()) {
              win.webContents.send('setting-changed', { sound: soundEnabled })
            }
          },
        },
        {
          label: 'Voice Warnings',
          type: 'checkbox',
          checked: voiceEnabled,
          click: (item) => {
            voiceEnabled = item.checked
            if (win && !win.isDestroyed()) {
              win.webContents.send('setting-changed', { voice: voiceEnabled })
            }
          },
        },
        { type: 'separator' },
        { label: 'Hide Sebastian', role: 'hide' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Session',
      submenu: [
        {
          label: 'Session History',
          accelerator: 'CmdOrCtrl+H',
          click: () => openPanel(),
        },
        {
          label: 'Active Sessions',
          enabled: false,
          label: `Active Sessions (${sessions.size})`,
        },
        { type: 'separator' },
        {
          label: 'Approve All Pending',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            approveAllPending()
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Customize Avatar',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => openAvatarEditor(),
        },
        { type: 'separator' },
        {
          label: 'Reset Position',
          click: () => resetPosition(),
        },
        { type: 'separator' },
        { label: 'Toggle DevTools', role: 'toggleDevTools' },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function refreshMenu() {
  buildAppMenu()
}

// Voice lines for every emote — spoken when triggered from context menu
const EMOTE_VOICE = {
  // Core
  happy:       ["Splendid, sir!", "What a fine moment, sir.", "Feeling rather chipper, sir.", "Delightful, sir!"],
  excited:     ["Oh, how thrilling, sir!", "Most exciting, sir!", "I can hardly contain myself, sir!", "Exhilarating!"],
  thinking:    ["Hmm, let me ponder this, sir.", "Give me a moment to think, sir.", "Contemplating, sir.", "Processing..."],
  angry:       ["This is most vexing, sir.", "I am not pleased, sir.", "Utterly unacceptable!", "This will not stand, sir."],
  sad:         ["I'm afraid it's rather gloomy, sir.", "A heavy heart today, sir.", "Not my finest hour, sir.", "Rather down, I'm afraid."],
  bored:       ["Nothing of note occurring, sir.", "Terribly dull, I must say.", "Could use a bit of excitement, sir.", "I wonder what the walls are thinking."],
  surprised:   ["Good heavens!", "Well, I never!", "My word, sir!", "That was unexpected, sir!"],
  confused:    ["I'm not entirely sure I follow, sir.", "This is rather puzzling, sir.", "I'm at a loss, sir.", "Most perplexing."],
  proud:       ["I must say, excellent work, sir.", "A fine accomplishment, sir.", "One to be proud of, sir.", "Masterfully done!"],
  nervous:     ["I have a rather uneasy feeling, sir.", "Slightly on edge, I confess.", "A bit jittery, sir.", "My composure wavers, sir."],
  sleeping:    ["Zzz... Just resting my eyes, sir.", "A brief respite, sir... zzz.", "Do not disturb... zzz."],
  idle:        ["At your service, sir.", "Standing by, sir.", "Awaiting your instructions, sir.", "Ready when you are, sir."],

  // Emotions
  grateful:    ["I am most grateful, sir.", "Your kindness is appreciated, sir.", "Thank you ever so much, sir."],
  amused:      ["Ha! Most amusing, sir.", "That tickled me, sir.", "Quite the laugh, sir.", "Oh, that is rich, sir!"],
  determined:  ["I shall see this through, sir.", "Nothing will stop us now, sir.", "Resolute and ready, sir.", "Onward, sir!"],
  hopeful:     ["I have a good feeling about this, sir.", "There's light at the end of the tunnel, sir.", "Hope springs eternal, sir."],
  relieved:    ["Oh, thank goodness, sir.", "What a relief, sir!", "I can breathe again, sir.", "Crisis averted, sir."],
  content:     ["All is well, sir.", "Quite content, sir.", "A peaceful moment, sir.", "Everything in its right place."],
  nostalgic:   ["Ah, those were the days, sir.", "Takes me back, sir.", "A fond memory, that one.", "The good old times, sir."],
  jealous:     ["I confess a touch of envy, sir.", "One can't help but covet, sir.", "A green-eyed moment, I'm afraid."],
  guilty:      ["I fear I may have erred, sir.", "My conscience weighs on me, sir.", "I should not have done that, sir."],
  ashamed:     ["I am quite ashamed, sir.", "I've let you down, sir.", "Most regrettable, sir."],
  embarrassed: ["How terribly embarrassing, sir.", "I wish the ground would swallow me, sir.", "Oh dear, how mortifying."],
  disgusted:   ["Most distasteful, sir.", "I can hardly bear to look, sir.", "Revolting, sir.", "How ghastly."],
  contempt:    ["Beneath us, sir.", "Utterly contemptible.", "I have no words for this, sir.", "How pedestrian."],
  adoring:     ["You are simply wonderful, sir.", "I do admire you so, sir.", "Absolute perfection, sir.", "Magnificent, sir!"],
  longing:     ["If only, sir...", "I do miss the way things were, sir.", "A wistful moment, sir.", "One can dream, sir."],
  melancholy:  ["A certain sadness lingers, sir.", "The world feels heavy today, sir.", "A touch of the blues, I'm afraid."],
  euphoric:    ["Oh, this is absolutely wonderful, sir!", "I'm on cloud nine, sir!", "Pure joy, sir!", "Extraordinary!"],
  serene:      ["All is calm, sir.", "A tranquil moment, sir.", "Perfect peace, sir.", "Serenity itself, sir."],
  anxious:     ["I'm rather worried, sir.", "Something feels off, sir.", "A gnawing unease, sir.", "I can't quite settle, sir."],
  panicked:    ["Oh no, oh no, oh no, sir!", "This is dire, sir!", "We must act immediately, sir!", "Emergency, sir!"],
  terrified:   ["I am absolutely terrified, sir!", "Heaven help us, sir!", "This is frightening, sir!", "I dare not look, sir!"],
  furious:     ["I am absolutely livid, sir!", "This is outrageous!", "Beyond all tolerance, sir!", "Unforgivable!"],
  enraged:     ["UNACCEPTABLE!", "I have never been so angry, sir!", "This crosses every line, sir!", "Fury itself, sir!"],
  devastated:  ["I... I don't know what to say, sir.", "This is crushing, sir.", "Everything is ruined, sir.", "My heart sinks, sir."],
  heartbroken: ["It hurts deeply, sir.", "A terrible loss, sir.", "I can barely go on, sir.", "The pain is immense, sir."],
  ecstatic:    ["YES! Absolutely brilliant, sir!", "I could dance, sir!", "This is the best day, sir!", "Perfection!"],
  blissful:    ["Pure bliss, sir.", "I am in paradise, sir.", "Nothing could be better, sir.", "Heavenly, sir."],
  gloomy:      ["Dark clouds ahead, sir.", "Not the brightest day, sir.", "Rather dreary, I'm afraid.", "The sun hides today, sir."],
  grumpy:      ["Hmph. I'd rather not, sir.", "Everything is annoying, sir.", "Don't test my patience, sir.", "Leave me be."],
  irritated:   ["That is getting on my nerves, sir.", "Must this continue, sir?", "Mildly infuriating, sir.", "How tiresome."],

  // Dev Activities
  coding:       ["Fingers on keys, sir. Let's code.", "Writing code, sir.", "In the zone, sir.", "Let's build something, sir."],
  debugging:    ["Hunting bugs, sir.", "Where is that pesky bug, sir?", "Debugging in progress, sir.", "The bug cannot hide forever, sir."],
  deploying:    ["Deploying now, sir. Fingers crossed.", "Pushing to production, sir.", "Ship it, sir!", "Launch sequence initiated, sir."],
  testing:      ["Running tests, sir.", "Let's see if it holds up, sir.", "Testing, testing, sir.", "Verifying the code, sir."],
  researching:  ["Investigating, sir.", "Down the rabbit hole, sir.", "Research mode engaged, sir.", "Gathering intelligence, sir."],
  downloading:  ["Downloading, sir. One moment.", "Fetching data, sir.", "The bits are flowing in, sir.", "Download in progress, sir."],
  uploading:    ["Uploading, sir.", "Sending it off, sir.", "Upload in progress, sir.", "The bits are flowing out, sir."],
  compiling:    ["Compiling, sir. The machine churns.", "Building the project, sir.", "Compilation in progress, sir.", "The compiler works, sir."],
  installing:   ["Installing, sir.", "Setting things up, sir.", "Dependencies incoming, sir.", "Installation underway, sir."],
  searching:    ["Searching, sir.", "Looking for it, sir.", "On the hunt, sir.", "Seeking and finding, sir."],
  calculating:  ["Crunching numbers, sir.", "Calculating, sir.", "The math is working itself out, sir.", "Numbers, numbers, sir."],
  analyzing:    ["Analyzing the data, sir.", "Examining closely, sir.", "Under the microscope, sir.", "Deep analysis, sir."],
  reviewing:    ["Reviewing the code, sir.", "A careful review, sir.", "Looking it over, sir.", "Code review in session, sir."],
  building:     ["Building, sir.", "Construction underway, sir.", "Assembling the pieces, sir.", "The build runs, sir."],
  fixing:       ["Fixing it now, sir.", "Applying the fix, sir.", "Patching things up, sir.", "The repair is underway, sir."],
  refactoring:  ["Refactoring, sir. Cleaner code ahead.", "Restructuring the code, sir.", "Making it elegant, sir.", "A fine refactor, sir."],
  committing:   ["Committing the changes, sir.", "Saving our work, sir.", "Commit in progress, sir.", "Locking it in, sir."],
  pushing:      ["Pushing to remote, sir.", "Sending upstream, sir.", "Push in progress, sir.", "Off it goes, sir."],
  pulling:      ["Pulling latest changes, sir.", "Fetching updates, sir.", "Pull in progress, sir.", "Bringing in the new, sir."],
  merging:      ["Merging branches, sir.", "Bringing it all together, sir.", "Merge in progress, sir.", "Unifying the code, sir."],
  branching:    ["Creating a new branch, sir.", "Branching off, sir.", "A new path, sir.", "Fresh branch, sir."],
  'rolling-back': ["Rolling back, sir. Better safe than sorry.", "Reverting changes, sir.", "Undoing, sir.", "Back to safety, sir."],
  monitoring:   ["Watching the systems, sir.", "All eyes on the dashboard, sir.", "Monitoring closely, sir.", "Keeping watch, sir."],
  profiling:    ["Profiling performance, sir.", "Measuring efficiency, sir.", "Finding the bottlenecks, sir.", "Performance analysis, sir."],
  benchmarking: ["Running benchmarks, sir.", "Measuring speed, sir.", "Let's see the numbers, sir.", "Benchmark in progress, sir."],

  // Physical
  yawning:       ["*Yawns* Excuse me, sir.", "Oh my, quite tired, sir.", "A big yawn, sir. Forgive me.", "The day catches up with me, sir."],
  sneezing:      ["Achoo! Pardon me, sir.", "Bless me, sir. Achoo!", "Achoo! My apologies, sir."],
  coughing:      ["*Ahem* Pardon me, sir.", "A tickle in the throat, sir.", "*Cough cough* Excuse me, sir."],
  shivering:     ["Brrr! Rather cold, sir.", "Quite chilly, sir.", "I'm freezing, sir!", "Could use a warm fire, sir."],
  sweating:      ["It's rather warm, sir.", "Perspiring a bit, sir.", "Quite the heat, sir.", "I'm overheating, sir."],
  dizzy:         ["The room is spinning, sir.", "A bit lightheaded, sir.", "Woah, steady now, sir.", "Everything's going round, sir."],
  fainting:      ["I feel... faint... sir...", "Catch me, sir...", "Going dark, sir...", "I need a moment, sir..."],
  'stretching-out': ["A good stretch, sir. Ahh.", "Limbering up, sir.", "That feels marvelous, sir.", "Needed that stretch, sir."],
  nodding:       ["Indeed, sir.", "Quite so, sir.", "I agree completely, sir.", "Absolutely, sir."],
  'shaking-head': ["I think not, sir.", "No, I'm afraid not, sir.", "That won't do, sir.", "I must disagree, sir."],
  facepalm:      ["Oh, for heaven's sake.", "How could this happen, sir?", "I can't believe it, sir.", "Words fail me, sir."],
  saluting:      ["At your command, sir!", "Reporting for duty, sir!", "Sir, yes sir!", "Standing at attention, sir!"],
  clapping:      ["Bravo, sir! Bravo!", "Well done indeed, sir!", "Magnificent! *Clap clap*", "A round of applause, sir!"],
  'thumbs-up':   ["Spot on, sir!", "You've got this, sir!", "Brilliant, sir!", "Top marks, sir!"],
  pointing:      ["Right over there, sir.", "This way, sir.", "Allow me to direct your attention, sir.", "If you'll look here, sir."],
  shrugging:     ["Your guess is as good as mine, sir.", "I haven't the faintest idea, sir.", "Who knows, sir?", "Beats me, sir."],
  flexing:       ["Behold these muscles, sir!", "Feeling strong, sir!", "Pure power, sir!", "Years of butler training, sir!"],
  meditating:    ["Ommmm... Finding my center, sir.", "Inner peace, sir.", "Tranquility, sir.", "The mind is still, sir."],
  praying:       ["A moment of prayer, sir.", "Seeking guidance, sir.", "In humble supplication, sir.", "May fortune favor us, sir."],
  'bowing-deep': ["At your service, sir.", "A deep bow for you, sir.", "Your humble servant, sir.", "I am at your disposal, sir."],

  // Social
  sarcastic:     ["Oh, how wonderful. Truly.", "What a surprise. Not really, sir.", "Oh, I'm sure that will work perfectly.", "Riveting, sir. Absolutely riveting."],
  smirking:      ["Heh. I know something you don't, sir.", "A knowing smile, sir.", "Oh, I have my reasons, sir.", "Wouldn't you like to know, sir."],
  winking:       ["Say no more, sir. I understand.", "Between us, sir.", "Our little secret, sir.", "Nudge nudge, sir."],
  'eye-rolling': ["Oh, please, sir.", "Here we go again, sir.", "Spare me, sir.", "If I roll my eyes any harder, sir..."],
  skeptical:     ["I have my doubts, sir.", "Are you quite sure about that, sir?", "Hmm, I'm not convinced, sir.", "That seems unlikely, sir."],
  suspicious:    ["Something doesn't add up, sir.", "I smell a rat, sir.", "This seems fishy, sir.", "I've got my eye on this, sir."],
  intrigued:     ["Now that is interesting, sir.", "Tell me more, sir.", "You have my attention, sir.", "Fascinating development, sir."],
  fascinated:    ["Absolutely captivating, sir!", "I cannot look away, sir!", "Remarkable, sir!", "How extraordinary, sir!"],
  impressed:     ["Well done, sir. Truly.", "Color me impressed, sir.", "That was remarkable, sir.", "Outstanding work, sir!"],
  disappointed:  ["I expected more, sir.", "How unfortunate, sir.", "That's a shame, sir.", "Not quite up to par, sir."],
  apologetic:    ["I do apologize, sir.", "Terribly sorry, sir.", "My sincerest apologies, sir.", "Please forgive me, sir."],
  pleading:      ["Please, sir, I beg of you.", "If you would be so kind, sir.", "I implore you, sir.", "Won't you reconsider, sir?"],
  commanding:    ["Attention! This is an order!", "You will comply, sir.", "This must be done. Now.", "I insist, sir!"],
  reassuring:    ["Everything will be fine, sir.", "Not to worry, sir.", "We'll get through this, sir.", "All will be well, sir."],
  encouraging:   ["You can do it, sir!", "Keep going, sir! Almost there!", "Believe in yourself, sir!", "Onward and upward, sir!"],

  // Status
  loading:         ["Loading, sir. One moment please.", "The wheels are turning, sir.", "Patience, sir. Loading.", "Almost there, sir."],
  syncing:         ["Syncing up, sir.", "Synchronization in progress, sir.", "Getting everything aligned, sir.", "Syncing the data, sir."],
  'error-critical':["CRITICAL ERROR, sir! This is serious!", "Red alert, sir!", "We have a major problem, sir!", "Code red, sir!"],
  warning:         ["A word of caution, sir.", "Warning, sir. Proceed carefully.", "Something requires attention, sir.", "Take care, sir."],
  success:         ["Success, sir! Everything worked!", "We did it, sir!", "Mission complete, sir!", "Victory, sir!"],
  pending:         ["Waiting on that, sir.", "Still pending, sir.", "In the queue, sir.", "Patience, sir. It's pending."],
  processing:      ["Processing, sir.", "Working on it, sir.", "The gears are turning, sir.", "Computation underway, sir."],
  queued:          ["In the queue, sir. We wait.", "Queued up, sir.", "Our turn will come, sir.", "Waiting in line, sir."],
  timeout:         ["It timed out, sir.", "Took too long, I'm afraid, sir.", "The request expired, sir.", "Time ran out, sir."],
  'rate-limited':  ["We've been rate limited, sir.", "Too many requests, sir. We must wait.", "Throttled, sir.", "They're asking us to slow down, sir."],
}

let lastEmoteVoiceTime = 0

function sendEmotion(emotion, text) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('emotion-update', { emotion, text })
  }
  broadcastToMobile('emotion-update', { emotion, text })

  // Speak emote voice line (with cooldown to avoid overlap with other speech)
  if (!text && EMOTE_VOICE[emotion] && Date.now() - lastEmoteVoiceTime > 3000) {
    lastEmoteVoiceTime = Date.now()
    const lines = EMOTE_VOICE[emotion]
    const line = lines[Math.floor(Math.random() * lines.length)]
    nativeSay(line)
    broadcastToMobile('voice-event', line)
  }
}

function resetPosition() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  const wa = screen.getPrimaryDisplay().workArea
  win.setPosition(wa.x + Math.floor(sw / 2 - 140), wa.y + sh - 290)
}

// ── Panel Window (History / Detail View) ──────────────────────────────────────

function openPanel() {
  if (panelWin && !panelWin.isDestroyed()) {
    panelWin.focus()
    return
  }

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  const wa = screen.getPrimaryDisplay().workArea

  panelWin = new BrowserWindow({
    width: 520,
    height: 680,
    x: wa.x + Math.floor(sw / 2 - 260),
    y: wa.y + Math.floor(sh / 2 - 340),
    frame: false,
    resizable: true,
    skipTaskbar: false,
    backgroundColor: '#0f1117',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, 'panel-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  panelWin.loadFile('panel.html')
  panelWin.on('closed', () => { panelWin = null })
}

function broadcastToPanel(channel, data) {
  if (panelWin && !panelWin.isDestroyed()) {
    panelWin.webContents.send(channel, data)
  }
}

function broadcastToMain(channel, data) {
  if (win && !win.isDestroyed()) {
    console.log(`[broadcast] ${channel}`, typeof data === 'string' ? data : JSON.stringify(data).slice(0, 100))
    win.webContents.send(channel, data)
  } else {
    console.log(`[broadcast FAILED] ${channel} - win=${!!win} destroyed=${win?.isDestroyed()}`)
  }
}

function broadcastToMobile(eventType, data) {
  const id = ++sseEventId
  const payload = `id: ${id}\nevent: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of mobileClients) {
    try { res.write(payload) } catch { mobileClients.delete(res) }
  }
}

function broadcastToAll(channel, data) {
  broadcastToMain(channel, data)
  broadcastToPanel(channel, data)
  broadcastToMobile(channel, data)
}

function updateApprovalCount() {
  const count = pendingApprovals.size
  broadcastToMain('approval-count', count)
  broadcastToMobile('approval-count', count)
}

function getSerializableApprovals() {
  const result = []
  for (const [id, a] of pendingApprovals) {
    result.push({
      id,
      sessionId: a.sessionId,
      toolName: a.toolName,
      toolInput: a.toolInput,
      cwd: a.cwd,
      timestamp: a.timestamp,
    })
  }
  return result
}

function approveAllPending() {
  for (const [id, approval] of pendingApprovals) {
    recordApprovalChoice(approval.toolName, approval.toolInput, true)
    approval.resolve({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason: 'Batch approved by Sebastian',
      }
    })
  }
  pendingApprovals.clear()
  updateApprovalCount()
  broadcastToPanel('approvals-updated', [])
  broadcastToMain('approvals-updated', [])
  broadcastToMobile('approvals-updated', [])
}

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.on('move-window', (_, x, y) => {
  if (win && !win.isDestroyed()) win.setPosition(Math.round(x), Math.round(y))
})

// Expand window sideways for bubble, based on screen position
let winExpanded = false
let expandedSide = null  // 'left' or 'right'
ipcMain.on('bubble-resize', (_, expanded) => {
  if (!win || win.isDestroyed()) return
  if (expanded === winExpanded) return
  winExpanded = expanded
  const [x, y] = win.getPosition()
  if (expanded) {
    const display = screen.getDisplayNearestPoint({ x, y })
    const screenCenter = display.workArea.x + display.workArea.width / 2
    const charCenter = x + 140  // center of 280px window
    if (charCenter > screenCenter) {
      // Sebastian on right → bubble on left
      expandedSide = 'left'
      win.setSize(440, 290)
      win.setPosition(x - 160, y)
    } else {
      // Sebastian on left → bubble on right
      expandedSide = 'right'
      win.setSize(440, 290)
    }
    win.webContents.send('bubble-side', expandedSide)
  } else {
    if (expandedSide === 'left') {
      const [cx] = win.getPosition()
      win.setPosition(cx + 160, y)
    }
    win.setSize(280, 290)
    expandedSide = null
  }
})

ipcMain.handle('get-position', () => {
  if (win && !win.isDestroyed()) return win.getPosition()
  return [0, 0]
})

ipcMain.handle('get-screen', () => {
  const d = screen.getPrimaryDisplay()
  return {
    width: d.workAreaSize.width,
    height: d.workAreaSize.height,
    x: d.workArea.x,
    y: d.workArea.y,
  }
})

ipcMain.on('set-ignore-mouse', (_, ignore) => {
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, { forward: true })
  }
})

ipcMain.on('open-panel', () => openPanel())

// ── Shared approve/deny/send logic (used by both IPC and HTTP) ───────────────

function handleApproveRequest(approvalId) {
  const approval = pendingApprovals.get(approvalId)
  if (!approval) return false
  recordApprovalChoice(approval.toolName, approval.toolInput, true)
  approval.resolve({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: 'Approved by Sebastian',
    }
  })
  pendingApprovals.delete(approvalId)
  updateApprovalCount()
  const list = getSerializableApprovals()
  broadcastToPanel('approvals-updated', list)
  broadcastToMain('approvals-updated', list)
  broadcastToMobile('approvals-updated', list)
  refreshMenu()
  return true
}

function handleDenyRequest(approvalId, reason) {
  const approval = pendingApprovals.get(approvalId)
  if (!approval) return false
  recordApprovalChoice(approval.toolName, approval.toolInput, false)
  approval.resolve({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason || 'Denied by Sebastian',
    }
  })
  pendingApprovals.delete(approvalId)
  updateApprovalCount()
  const list = getSerializableApprovals()
  broadcastToPanel('approvals-updated', list)
  broadcastToMain('approvals-updated', list)
  broadcastToMobile('approvals-updated', list)
  refreshMenu()
  return true
}

function handleSendToSession(sessionId, message, callback) {
  const session = sessions.get(sessionId)
  console.log('[send-to-session] session:', session?.id?.slice(0,8), 'status:', session?.status, 'found:', !!session)

  // Any known session (registered via hooks) is running in a Terminal — paste into it
  if (session) {
    console.log('[send-to-session] Using paste-into-terminal for known session (status:', session.status, ')')
    pasteIntoTerminal(message, (err) => {
      console.log('[send-to-session] paste result:', err ? err.message : 'OK')
      const responseData = err
        ? { sessionId, message, response: 'Error: Could not paste into Terminal', timestamp: Date.now() }
        : { sessionId, message, response: 'Message sent to Terminal', timestamp: Date.now(), isPaste: true }
      broadcastToMain('session-response', responseData)
      broadcastToMobile('session-response', responseData)
      if (callback) callback(responseData)
    })
    return
  }

  // Idle session — use claude -p --resume
  console.log('[send-to-session] Using claude -p for idle/unknown session')
  const env = { ...process.env }
  delete env.CLAUDECODE
  delete env.CLAUDE_CODE
  env.PATH = `${process.env.PATH || ''}:${path.join(os.homedir(), '.local/bin')}:/usr/local/bin`

  const cwd = session?.cwd || os.homedir()
  console.log('[send-to-session] execFile:', CLAUDE_PATH, '-p --resume', sessionId?.slice(0,8), 'cwd:', cwd)
  execFile(CLAUDE_PATH, ['-p', '--resume', sessionId, message], {
    timeout: 120000, env, cwd, maxBuffer: 1024 * 1024
  }, (err, stdout, stderr) => {
    const response = err ? `Error: ${stderr || err.message}` : stdout
    const responseData = { sessionId, message, response, timestamp: Date.now() }
    broadcastToPanel('session-response', responseData)
    broadcastToMain('session-response', responseData)
    broadcastToMobile('session-response', responseData)
    if (callback) callback(responseData)
  })
}

function handleSendCommandToSession(sessionId, command) {
  const session = sessions.get(sessionId)
  const env = { ...process.env }
  delete env.CLAUDECODE
  delete env.CLAUDE_CODE
  env.PATH = `${process.env.PATH || ''}:${path.join(os.homedir(), '.local/bin')}:/usr/local/bin`

  execFile(CLAUDE_PATH, ['-p', '--resume', sessionId, command], {
    timeout: 30000, env, cwd: session?.cwd || os.homedir(), maxBuffer: 512 * 1024
  }, () => {})
}

function handleUpdateSetting(key, value) {
  settings[key] = value
  saveSettings(settings)

  if (key === 'sound') soundEnabled = value
  if (key === 'voice') voiceEnabled = value
  if (key === 'wakeWord') {
    if (value) startWakeWord()
    else stopWakeWord()
  }

  // Broadcast to renderer
  if (win && !win.isDestroyed()) {
    win.webContents.send('setting-changed', { [key]: value })
  }
  broadcastToMobile('setting-changed', { [key]: value })
}

// Approval IPC (works from both main window and panel)
ipcMain.on('approve-request', (_, approvalId) => {
  handleApproveRequest(approvalId)
})

ipcMain.on('approve-all', () => approveAllPending())

ipcMain.on('deny-request', (_, approvalId, reason) => {
  handleDenyRequest(approvalId, reason)
})

// Panel IPC
ipcMain.handle('get-sessions', () => Array.from(sessions.values()))
ipcMain.handle('get-approvals', () => getSerializableApprovals())

// Find claude CLI path
const CLAUDE_PATH = (() => {
  const candidates = [
    path.join(os.homedir(), '.local/bin/claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return 'claude' // fallback to PATH
})()

ipcMain.on('send-to-session', (_, sessionId, message) => {
  console.log('[send-to-session] sessionId:', sessionId, 'message:', message.slice(0, 80))
  handleSendToSession(sessionId, message)
})

// Native TTS from renderer
ipcMain.on('native-speak', (_, text) => {
  nativeSay(text)
})

// Paste text into the frontmost Terminal window via AppleScript
function pasteIntoTerminal(message, cb) {
  const { spawn } = require('child_process')
  // Step 1: Copy message to clipboard
  const pbcopy = spawn('pbcopy', [], { stdio: ['pipe', 'ignore', 'ignore'] })
  pbcopy.stdin.write(message)
  pbcopy.stdin.end()
  pbcopy.on('close', () => {
    // Step 2: Activate Terminal, paste, press Enter
    const script = `
tell application "Terminal" to activate
delay 0.5
tell application "System Events"
  tell process "Terminal"
    keystroke "v" using command down
    delay 0.3
    key code 36
  end tell
end tell`
    exec(`osascript -e '${script}'`, { timeout: 5000 }, (err) => {
      cb(err)
    })
  })
}

// Fire-and-forget command to session (for /compact, etc.)
ipcMain.on('send-command-to-session', (_, sessionId, command) => {
  handleSendCommandToSession(sessionId, command)
})

ipcMain.on('close-panel', () => {
  if (panelWin && !panelWin.isDestroyed()) panelWin.close()
})

// ── Settings IPC ──────────────────────────────────────────────────────────────

ipcMain.handle('get-settings', () => settings)

ipcMain.on('update-setting', (_, key, value) => {
  handleUpdateSetting(key, value)
})

ipcMain.on('open-avatar-editor', () => openAvatarEditor())
ipcMain.on('quit-app', () => app.quit())

// Open the terminal window that has the session
ipcMain.on('open-terminal', (_, sessionId) => {
  // Use AppleScript to find and activate the Terminal tab running this session
  // First try to find a terminal with the session ID, fallback to activating Terminal.app
  const session = sessions.get(sessionId)
  const cwd = session?.cwd || ''
  const folderName = cwd.split('/').pop() || ''

  // AppleScript: activate Terminal.app and bring it to front
  // On macOS, each claude session runs in its own terminal tab/window
  const script = `
    tell application "Terminal"
      activate
    end tell
  `
  exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 5000 }, () => {})
})

// ── Speech Transcription via Groq Whisper API ───────────────────────────────
// Audio captured in renderer via getUserMedia, sent here as WAV for Groq Whisper

function getGroqApiKey() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.nanobot', 'config.json'), 'utf8'))
    return cfg?.providers?.groq?.apiKey
  } catch {}
  return null
}

ipcMain.handle('transcribe-audio', async (_, audioData) => {
  const apiKey = getGroqApiKey()
  if (!apiKey) {
    console.log('[transcribe] No Groq API key found')
    return { error: 'No API key configured for speech recognition' }
  }

  const tmpFile = path.join(os.tmpdir(), `sebastian-audio-${Date.now()}.wav`)
  const buf = Buffer.from(audioData)
  fs.writeFileSync(tmpFile, buf)
  console.log('[transcribe] Saved audio:', tmpFile, 'size:', buf.length)

  return new Promise((resolve) => {
    const { spawn } = require('child_process')
    const curl = spawn('curl', [
      '-s', '-X', 'POST',
      'https://api.groq.com/openai/v1/audio/transcriptions',
      '-H', `Authorization: Bearer ${apiKey}`,
      '-F', `file=@${tmpFile}`,
      '-F', 'model=whisper-large-v3',
      '-F', 'language=en',
      '-F', 'response_format=json'
    ])

    let stdout = '', stderr = ''
    curl.stdout.on('data', (d) => { stdout += d.toString() })
    curl.stderr.on('data', (d) => { stderr += d.toString() })

    curl.on('close', () => {
      try { fs.unlinkSync(tmpFile) } catch {}
      console.log('[transcribe] Groq response:', stdout.slice(0, 200))

      try {
        const result = JSON.parse(stdout)
        if (result.text && result.text.trim()) {
          resolve({ text: result.text.trim() })
        } else if (result.error) {
          resolve({ error: result.error.message || 'Transcription failed' })
        } else {
          resolve({ error: 'No speech detected' })
        }
      } catch {
        console.log('[transcribe] Parse error, raw:', stdout)
        resolve({ error: 'Failed to parse transcription response' })
      }
    })

    setTimeout(() => {
      try { curl.kill() } catch {}
      try { fs.unlinkSync(tmpFile) } catch {}
      resolve({ error: 'Transcription timed out' })
    }, 15000)
  })
})

// ── File watching ─────────────────────────────────────────────────────────────

function watchStateFile() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      fs.writeFileSync(STATE_FILE, JSON.stringify({ emotion: 'idle' }))
    }
    fs.watchFile(STATE_FILE, { interval: 300 }, () => {
      try {
        const raw = fs.readFileSync(STATE_FILE, 'utf8').trim()
        if (!raw) return
        const data = JSON.parse(raw)
        sendEmotion(data.emotion, data.text)
      } catch {}
    })
  } catch {}
}

// ── HTTP API + Hooks ──────────────────────────────────────────────────────────

function startHttpServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    if (req.method === 'GET' && req.url === '/health') {
      jsonResponse(res, { status: 'ok', version: '1.0.0' })
      return
    }

    if (req.method === 'GET' && req.url === '/status') {
      jsonResponse(res, {
        status: 'alive', version: '1.0.0',
        sessions: sessions.size, pendingApprovals: pendingApprovals.size,
      })
      return
    }

    if (req.method === 'POST') {
      const routes = {
        '/emotion': (data) => { sendEmotion(data.emotion, data.text); return { ok: true } },
        '/hooks/session-start': handleSessionStart,
        '/hooks/post-tool-use': handlePostToolUse,
        '/hooks/stop': handleStop,
        '/hooks/notification': handleNotification,
      }

      if (routes[req.url]) {
        readBody(req, (data) => {
          const result = routes[req.url](data)
          jsonResponse(res, result || {})
        }, res)
        return
      }

      if (req.url === '/hooks/pre-tool-use') {
        readBody(req, (data) => {
          console.log('[hook] pre-tool-use received:', data.tool_name, 'session:', data.session_id?.slice(0, 8))
          handlePreToolUse(data).then(result => {
            console.log('[hook] pre-tool-use responding:', JSON.stringify(result).slice(0, 200))
            jsonResponse(res, result || {})
          })
        }, res)
        return
      }
    }

    // ── Mobile PWA Routes ──────────────────────────────────────────────────────

    // SSE endpoint for real-time updates
    if (req.method === 'GET' && req.url === '/mobile/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      })
      res.write('retry: 3000\n\n')
      // Send full initial state
      const initData = {
        sessions: Array.from(sessions.values()),
        approvals: getSerializableApprovals(),
        settings: settings,
        emotion: 'idle',
      }
      res.write(`event: init\ndata: ${JSON.stringify(initData)}\n\n`)
      mobileClients.add(res)
      req.on('close', () => mobileClients.delete(res))
      // Heartbeat every 30s
      const hb = setInterval(() => {
        try { res.write(': heartbeat\n\n') } catch { clearInterval(hb); mobileClients.delete(res) }
      }, 30000)
      req.on('close', () => clearInterval(hb))
      return
    }

    // Mobile GET API endpoints
    if (req.method === 'GET' && req.url === '/mobile/sessions') {
      jsonResponse(res, Array.from(sessions.values()))
      return
    }

    if (req.method === 'GET' && req.url === '/mobile/approvals') {
      jsonResponse(res, getSerializableApprovals())
      return
    }

    if (req.method === 'GET' && req.url === '/mobile/settings') {
      jsonResponse(res, settings)
      return
    }

    // Mobile POST API endpoints
    if (req.method === 'POST' && req.url === '/mobile/approve') {
      readBody(req, (data) => {
        const ok = handleApproveRequest(data.approvalId)
        jsonResponse(res, { ok })
      }, res)
      return
    }

    if (req.method === 'POST' && req.url === '/mobile/deny') {
      readBody(req, (data) => {
        const ok = handleDenyRequest(data.approvalId, data.reason)
        jsonResponse(res, { ok })
      }, res)
      return
    }

    if (req.method === 'POST' && req.url === '/mobile/approve-all') {
      approveAllPending()
      jsonResponse(res, { ok: true })
      return
    }

    if (req.method === 'POST' && req.url === '/mobile/send-message') {
      readBody(req, (data) => {
        handleSendToSession(data.sessionId, data.message, (responseData) => {
          jsonResponse(res, responseData)
        })
      }, res)
      return
    }

    if (req.method === 'POST' && req.url === '/mobile/send-command') {
      readBody(req, (data) => {
        handleSendCommandToSession(data.sessionId, data.command)
        jsonResponse(res, { ok: true })
      }, res)
      return
    }

    if (req.method === 'POST' && req.url === '/mobile/update-setting') {
      readBody(req, (data) => {
        handleUpdateSetting(data.key, data.value)
        jsonResponse(res, { ok: true })
      }, res)
      return
    }

    if (req.method === 'POST' && req.url === '/mobile/transcribe') {
      const apiKey = getGroqApiKey()
      if (!apiKey) {
        jsonResponse(res, { error: 'No Groq API key configured' })
        return
      }
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        const buf = Buffer.concat(chunks)
        const tmpFile = path.join(os.tmpdir(), `sebastian-mobile-audio-${Date.now()}.wav`)
        fs.writeFileSync(tmpFile, buf)
        console.log('[mobile-transcribe] Saved audio:', tmpFile, 'size:', buf.length)

        const { spawn } = require('child_process')
        const curl = spawn('curl', [
          '-s', '-X', 'POST',
          'https://api.groq.com/openai/v1/audio/transcriptions',
          '-H', `Authorization: Bearer ${apiKey}`,
          '-F', `file=@${tmpFile}`,
          '-F', 'model=whisper-large-v3',
          '-F', 'language=en',
          '-F', 'response_format=json'
        ])

        let stdout = '', stderr = ''
        curl.stdout.on('data', (d) => { stdout += d.toString() })
        curl.stderr.on('data', (d) => { stderr += d.toString() })

        curl.on('close', () => {
          try { fs.unlinkSync(tmpFile) } catch {}
          console.log('[mobile-transcribe] Groq response:', stdout.slice(0, 200))
          try {
            const result = JSON.parse(stdout)
            if (result.text && result.text.trim()) {
              jsonResponse(res, { text: result.text.trim() })
            } else if (result.error) {
              jsonResponse(res, { error: result.error.message || 'Transcription failed' })
            } else {
              jsonResponse(res, { error: 'No speech detected' })
            }
          } catch {
            jsonResponse(res, { error: 'Failed to parse transcription response' })
          }
        })

        setTimeout(() => {
          try { curl.kill() } catch {}
          try { fs.unlinkSync(tmpFile) } catch {}
          jsonResponse(res, { error: 'Transcription timed out' })
        }, 15000)
      })
      return
    }

    // Mobile static file serving (MUST come after all /mobile/* API routes)
    if (req.method === 'GET' && req.url.startsWith('/mobile')) {
      let filePath = req.url === '/mobile' || req.url === '/mobile/' ? '/mobile/index.html' : req.url
      // Strip query string if present
      filePath = filePath.split('?')[0]
      const fullPath = path.join(__dirname, filePath)
      const ext = path.extname(fullPath)
      const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' }
      const mime = mimeTypes[ext] || 'application/octet-stream'
      try {
        const content = fs.readFileSync(fullPath)
        res.writeHead(200, { 'Content-Type': mime })
        res.end(content)
      } catch {
        res.writeHead(404); res.end('Not found')
      }
      return
    }

    res.writeHead(404); res.end()
  })

  server.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`[Sebastian] HTTP API on http://0.0.0.0:${HTTP_PORT}`)
  })
  server.on('error', () => {
    console.warn('[Sebastian] Port 19700 in use, HTTP API disabled')
  })
}

function readBody(req, handler, res) {
  let body = ''
  req.on('data', c => body += c)
  req.on('end', () => {
    try { handler(JSON.parse(body)) }
    catch { jsonResponse(res, {}) }
  })
}

function jsonResponse(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

// ── Hook Handlers ─────────────────────────────────────────────────────────────

// Map tool names to Sebastian emotions
function toolEmotion(toolName) {
  if (['Read', 'Glob'].includes(toolName)) return 'listening'
  if (toolName === 'Grep') return 'searching'
  if (toolName === 'Edit') return 'coding'
  if (toolName === 'Write') return 'coding'
  if (toolName === 'NotebookEdit') return 'coding'
  if (toolName === 'Agent') return 'thinking'
  if (toolName === 'WebSearch') return 'researching'
  if (toolName === 'WebFetch') return 'downloading'
  if (toolName === 'Bash') return 'excited'
  if (toolName === 'Skill') return 'intrigued'
  return 'listening'
}

// Session color palette — 10 distinct colors, assigned round-robin
const SESSION_COLORS = [
  '#22d3ee', // cyan
  '#a78bfa', // purple
  '#34d399', // emerald
  '#fb923c', // orange
  '#f472b6', // pink
  '#facc15', // yellow
  '#60a5fa', // blue
  '#f87171', // red
  '#4ade80', // green
  '#c084fc', // violet
]
let sessionColorIndex = 0

function handleSessionStart(data) {
  const color = SESSION_COLORS[sessionColorIndex % SESSION_COLORS.length]
  sessionColorIndex++
  sessions.set(data.session_id, {
    id: data.session_id,
    cwd: data.cwd,
    title: null,
    source: data.source,
    startTime: Date.now(),
    status: 'active',
    tools: [],
    lastActivity: Date.now(),
    color,
  })
  const projectName = getSessionDisplayName(sessions.get(data.session_id), data.session_id)
  personality.onSessionStart(projectName)
  const greeting = personality.getSessionStartLine(projectName)
  sendEmotion('happy', 'New session started')
  nativeSay(greeting)
  broadcastToMobile('voice-event', greeting)
  const sessionList = Array.from(sessions.values())
  broadcastToPanel('sessions-updated', sessionList)
  broadcastToMain('sessions-updated', sessionList)
  broadcastToMobile('sessions-updated', sessionList)
  refreshMenu()
  return {}
}

function handlePreToolUse(data) {
  return new Promise((resolve) => {
    const { session_id: sessionId, tool_name: toolName, tool_input: toolInput, cwd } = data

    const session = sessions.get(sessionId)
    if (session) {
      session.lastActivity = Date.now()
      session.status = 'working'
    }
    const sessionList = Array.from(sessions.values())
    broadcastToPanel('sessions-updated', sessionList)
    broadcastToMain('sessions-updated', sessionList)
    broadcastToMobile('sessions-updated', sessionList)

    // Set emotion based on what Claude is doing
    const emotion = toolEmotion(toolName)
    if (emotion && !pendingApprovals.size) {
      sendEmotion(emotion)
    }

    // Auto-allow safe (read-only) tools — explicitly allow so terminal never prompts
    if (!NEEDS_APPROVAL.has(toolName)) {
      resolve({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          permissionDecisionReason: 'Auto-allowed by Sebastian',
        }
      })
      return
    }

    // Smart auto-approval: check learned patterns
    const autoResult = shouldAutoApprove(toolName, toolInput)
    if (autoResult.auto) {
      console.log(`[smart-approve] Auto-approved: ${toolName} (${autoResult.reason})`)
      recordApprovalChoice(toolName, toolInput, true)
      approvalMemory.stats.autoApproved++
      saveApprovalMemory(approvalMemory)
      personality.onAutoApprove(toolName)

      // Notify silently (no bubble, just log)
      sendEmotion(toolEmotion(toolName) || 'listening')
      broadcastToMain('auto-approved', { toolName, reason: autoResult.reason })
      broadcastToMobile('auto-approved', { toolName, reason: autoResult.reason })

      resolve({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          permissionDecisionReason: `Smart auto-approved by Sebastian (${autoResult.reason})`,
        }
      })
      return
    }

    // Queue approval for tools that need manual review
    const approvalId = ++approvalIdCounter
    pendingApprovals.set(approvalId, {
      id: approvalId,
      sessionId,
      toolName,
      toolInput: toolInput || {},
      cwd,
      timestamp: Date.now(),
      resolve,
    })

    const approvalData = {
      id: approvalId,
      sessionId,
      toolName,
      toolInput: toolInput || {},
      cwd,
      timestamp: Date.now(),
    }

    sendEmotion('thinking', `Approval: ${toolName}`)
    updateApprovalCount()

    // Send to both panel and main window
    broadcastToPanel('new-approval', approvalData)
    broadcastToMain('new-approval', approvalData)
    broadcastToMobile('new-approval', approvalData)

    // Notify about sound/voice — include session name
    const approvalSession = sessions.get(sessionId)
    const sessionName = getSessionDisplayName(approvalSession, sessionId)

    const voiceLine = personality.pickLine('approval-needed', VOICE_LINES.approvalNeeded, {
      session: sessionName, tool: toolName,
    })
    const notifyData = {
      sound: soundEnabled,
      voice: voiceEnabled,
      toolName,
      command: toolInput?.command || '',
      sessionName,
      sessionId,
      voiceLine,
    }
    broadcastToMain('notify-approval', notifyData)
    broadcastToMobile('notify-approval', notifyData)

    refreshMenu()

    // Timeout after 5 min
    setTimeout(() => {
      if (pendingApprovals.has(approvalId)) {
        pendingApprovals.delete(approvalId)
        updateApprovalCount()
        resolve({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'ask',
            permissionDecisionReason: 'Sebastian approval timed out',
          }
        })
      }
    }, 300000)
  })
}

function handlePostToolUse(data) {
  const session = sessions.get(data.session_id)
  if (session) {
    session.lastActivity = Date.now()
    session.tools.push({ name: data.tool_name, timestamp: Date.now() })
    if (session.tools.length > 50) session.tools = session.tools.slice(-50)

    // Try to fill in the title if we don't have one yet
    if (!session.title && session.cwd) {
      const encodedCwd = session.cwd.replace(/\//g, '-')
      const sessionFile = path.join(os.homedir(), '.claude', 'projects', encodedCwd, data.session_id + '.jsonl')
      if (fs.existsSync(sessionFile)) {
        extractSessionTitle(sessionFile).then(title => {
          if (title) {
            session.title = title
            const sl = Array.from(sessions.values())
            broadcastToPanel('sessions-updated', sl)
            broadcastToMain('sessions-updated', sl)
            broadcastToMobile('sessions-updated', sl)
          }
        })
      }
    }
  }
  const sessionList = Array.from(sessions.values())
  broadcastToPanel('sessions-updated', sessionList)
  broadcastToMain('sessions-updated', sessionList)
  broadcastToMobile('sessions-updated', sessionList)

  // Personality: track tool usage, project context, errors, and occasionally comment
  personality.totalToolUses++
  if (session?.cwd) {
    const proj = getSessionDisplayName(session, data.session_id)
    personality.onProjectChange(proj)
    personality.projectsWorkedOn.add(proj)
  }

  // Detect errors from tool output
  const output = (data.tool_output || '').toString()
  const isError = data.is_error || /error|failed|FAILED|Error:|exit code [1-9]/i.test(output.slice(0, 500))
  if (isError) {
    personality.onToolError(data)
    // Set appropriate emotion for errors
    if (output.includes('FATAL') || output.includes('panic') || output.includes('segfault'))
      sendEmotion('terrified', 'Fatal error')
    else if (personality.errorCount >= 3)
      sendEmotion('nervous', 'Multiple errors')
    else
      sendEmotion('confused', 'Error occurred')
  } else {
    personality.onToolSuccess()
    // Set positive emotion on test success
    if (data.tool_name === 'Bash' && /pass|passed|success|✓|PASS/i.test(output.slice(0, 500)))
      sendEmotion('proud', 'Tests passing')
    else if (data.tool_name === 'Bash' && /built|compiled|deployed/i.test(output.slice(0, 300)))
      sendEmotion('excited', 'Build success')
  }

  personality.tryProactiveComment(data)
  personality.checkSuggestions()

  return {}
}

function handleStop(data) {
  const session = sessions.get(data.session_id)
  if (session) {
    session.status = 'idle'
    session.lastActivity = Date.now()
  }

  // Notify about task completion — detect success/failure for emotion
  const shortId = data.session_id ? data.session_id.slice(0, 6) : ''
  const projectName = getSessionDisplayName(session, data.session_id)
  const stopReason = (data.reason || '').toLowerCase()
  const hadErrors = personality.errorCount >= 2

  let stopEmotion = 'happy'
  if (stopReason.includes('error') || stopReason.includes('fail') || hadErrors)
    stopEmotion = 'nervous'
  else if (stopReason.includes('interrupt') || stopReason.includes('cancel'))
    stopEmotion = 'surprised'
  else if (personality.mood === 'impressed')
    stopEmotion = 'ecstatic'
  else if (personality.mood === 'tired')
    stopEmotion = 'relieved'

  const completionLine = personality.getTaskCompleteLine(projectName)
  sendEmotion(stopEmotion, 'Task complete')
  nativeSay(completionLine)
  broadcastToMobile('voice-event', completionLine)
  personality.onSessionStop(projectName)
  const notifyData = { sound: soundEnabled, voice: false, taskDone: true }
  broadcastToMain('notify-approval', notifyData)
  broadcastToMobile('notify-approval', notifyData)
  const responseData = {
    sessionId: data.session_id,
    message: null,
    response: data.stop_hook_active !== undefined ? `Session ${shortId} finished.` : `Session ${shortId} is done, sir.`,
    timestamp: Date.now(),
    isCompletion: true,
  }
  broadcastToMain('session-response', responseData)
  broadcastToMobile('session-response', responseData)

  if (pendingApprovals.size === 0) {
    setTimeout(() => sendEmotion('idle', 'At your service'), 4000)
  }

  const sessionList = Array.from(sessions.values())
  broadcastToPanel('sessions-updated', sessionList)
  broadcastToMain('sessions-updated', sessionList)
  broadcastToMobile('sessions-updated', sessionList)
  refreshMenu()
  return {}
}

function handleNotification(data) {
  sendEmotion('speaking', data.message || 'Notification')
  if (data.message) {
    nativeSay(data.message)
    broadcastToMobile('voice-event', data.message)
  }
  return {}
}

// ── Avatar Editor ─────────────────────────────────────────────────────────────

function ensureAvatarDir() {
  const base = path.join(os.homedir(), '.sebastian')
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true })
  if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true })
}

function loadAvatarConfig() {
  try {
    if (fs.existsSync(AVATAR_CONFIG)) return JSON.parse(fs.readFileSync(AVATAR_CONFIG, 'utf8'))
  } catch {}
  return { activeAvatar: null }
}

function saveAvatarConfig(config) {
  ensureAvatarDir()
  fs.writeFileSync(AVATAR_CONFIG, JSON.stringify(config, null, 2))
}

function getAllAvatars() {
  ensureAvatarDir()
  const result = []
  try {
    const dirs = fs.readdirSync(AVATAR_DIR).filter(d => {
      try { return fs.statSync(path.join(AVATAR_DIR, d)).isDirectory() }
      catch { return false }
    })

    for (const dir of dirs) {
      const metaPath = path.join(AVATAR_DIR, dir, 'meta.json')
      let meta = { name: dir, states: {} }
      try {
        if (fs.existsSync(metaPath)) meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
      } catch {}

      // v2 parts-based avatar
      if (meta.version === 2 && meta.mode === 'parts') {
        const parts = {}
        for (const [partId, partData] of Object.entries(meta.parts || {})) {
          const entry = { ...partData, imageUrl: null, variantUrls: {} }
          if (partData.image) {
            const absPath = path.join(AVATAR_DIR, dir, partData.image)
            if (fs.existsSync(absPath)) entry.imageUrl = 'file://' + absPath
          }
          for (const [variant, varFile] of Object.entries(partData.variants || {})) {
            const varAbs = path.join(AVATAR_DIR, dir, varFile)
            if (fs.existsSync(varAbs)) entry.variantUrls[variant] = 'file://' + varAbs
          }
          parts[partId] = entry
        }
        result.push({ id: dir, name: meta.name, mode: 'parts', butlerName: meta.butlerName, voice: meta.voice, parts })
        continue
      }

      // v1 state-based avatar (legacy)
      const states = {}
      for (const [state, filename] of Object.entries(meta.states || {})) {
        const absPath = path.join(AVATAR_DIR, dir, filename)
        if (fs.existsSync(absPath)) states[state] = 'file://' + absPath
      }

      result.push({ id: dir, name: meta.name, states })
    }
  } catch {}
  return result
}

function openAvatarEditor() {
  if (avatarWin && !avatarWin.isDestroyed()) {
    avatarWin.focus()
    return
  }

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  const wa = screen.getPrimaryDisplay().workArea

  avatarWin = new BrowserWindow({
    width: 960,
    height: 650,
    x: wa.x + Math.floor(sw / 2 - 480),
    y: wa.y + Math.floor(sh / 2 - 325),
    frame: false,
    resizable: true,
    skipTaskbar: false,
    backgroundColor: '#0f1117',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, 'avatar-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  avatarWin.loadFile('avatar-editor.html')
  avatarWin.on('closed', () => { avatarWin = null })
}

// Avatar IPC handlers
ipcMain.handle('avatar-get-all', () => getAllAvatars())

ipcMain.handle('avatar-get-active', () => {
  const config = loadAvatarConfig()
  return config.activeAvatar || null
})

ipcMain.handle('avatar-create', (_, name) => {
  ensureAvatarDir()
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const dir = path.join(AVATAR_DIR, id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ version: 2, mode: 'parts', name, butlerName: 'Sebastian', voice: { name: null, rate: 1.0, pitch: 0.85, volume: 0.7 }, parts: {} }))
  return { id }
})

ipcMain.handle('avatar-delete', (_, id) => {
  const dir = path.join(AVATAR_DIR, id)
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  const config = loadAvatarConfig()
  if (config.activeAvatar === id) {
    config.activeAvatar = null
    saveAvatarConfig(config)
    broadcastAvatarChange(null)
  }
  return { ok: true }
})

ipcMain.handle('avatar-rename', (_, id, name) => {
  const metaPath = path.join(AVATAR_DIR, id, 'meta.json')
  let meta = {}
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) } catch {}
  meta.name = name
  fs.writeFileSync(metaPath, JSON.stringify(meta))
  return { ok: true }
})

ipcMain.handle('avatar-save-state', (_, avatarId, state, srcPath) => {
  const dir = path.join(AVATAR_DIR, avatarId)
  if (!fs.existsSync(dir)) return { saved: false }

  const ext = path.extname(srcPath) || '.png'
  const destName = state + ext
  const destPath = path.join(dir, destName)
  fs.copyFileSync(srcPath, destPath)

  // Update meta
  const metaPath = path.join(dir, 'meta.json')
  let meta = {}
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) } catch {}
  if (!meta.states) meta.states = {}
  meta.states[state] = destName
  fs.writeFileSync(metaPath, JSON.stringify(meta))

  // If this avatar is active, broadcast update
  const config = loadAvatarConfig()
  if (config.activeAvatar === avatarId) {
    broadcastAvatarChange(avatarId)
  }

  return { saved: true }
})

ipcMain.handle('avatar-apply', (_, id) => {
  const config = loadAvatarConfig()
  config.activeAvatar = id
  saveAvatarConfig(config)
  broadcastAvatarChange(id)
  return { ok: true }
})

ipcMain.handle('avatar-reset', () => {
  const config = loadAvatarConfig()
  config.activeAvatar = null
  saveAvatarConfig(config)
  broadcastAvatarChange(null)
  return { ok: true }
})

ipcMain.handle('avatar-get-active-data', () => {
  const config = loadAvatarConfig()
  if (config.activeAvatar) return getAvatarData(config.activeAvatar)
  return null
})

ipcMain.handle('avatar-pick-file', async () => {
  const result = await dialog.showOpenDialog(avatarWin || win, {
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] }],
    properties: ['openFile'],
  })
  return result.filePaths[0] || null
})

// ── Parts-based avatar IPC handlers ──────────────────────────────────────────

ipcMain.handle('avatar-save-part', (_, avatarId, partId, srcPath) => {
  const dir = path.join(AVATAR_DIR, avatarId)
  if (!fs.existsSync(dir)) return { saved: false }

  const ext = path.extname(srcPath) || '.png'
  const destName = partId + ext
  const destPath = path.join(dir, destName)
  fs.copyFileSync(srcPath, destPath)

  const metaPath = path.join(dir, 'meta.json')
  let meta = {}
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) } catch {}
  meta.version = 2
  meta.mode = 'parts'
  if (!meta.parts) meta.parts = {}
  if (!meta.parts[partId]) meta.parts[partId] = { image: destName, offset: { x: 0, y: 0 }, scale: 1.0, variants: {} }
  else { meta.parts[partId].image = destName; if (!meta.parts[partId].variants) meta.parts[partId].variants = {} }
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

  const config = loadAvatarConfig()
  if (config.activeAvatar === avatarId) broadcastAvatarChange(avatarId)
  return { saved: true }
})

ipcMain.handle('avatar-save-part-variant', (_, avatarId, partId, variant, srcPath) => {
  const dir = path.join(AVATAR_DIR, avatarId)
  if (!fs.existsSync(dir)) return { saved: false }

  const ext = path.extname(srcPath) || '.png'
  const destName = partId + '-' + variant + ext
  const destPath = path.join(dir, destName)
  fs.copyFileSync(srcPath, destPath)

  const metaPath = path.join(dir, 'meta.json')
  let meta = {}
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) } catch {}
  if (!meta.parts) meta.parts = {}
  if (!meta.parts[partId]) meta.parts[partId] = { image: null, offset: { x: 0, y: 0 }, scale: 1.0, variants: {} }
  if (!meta.parts[partId].variants) meta.parts[partId].variants = {}
  meta.parts[partId].variants[variant] = destName
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

  const config = loadAvatarConfig()
  if (config.activeAvatar === avatarId) broadcastAvatarChange(avatarId)
  return { saved: true }
})

ipcMain.handle('avatar-remove-part', (_, avatarId, partId) => {
  const dir = path.join(AVATAR_DIR, avatarId)
  if (!fs.existsSync(dir)) return { ok: false }

  const metaPath = path.join(dir, 'meta.json')
  let meta = {}
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) } catch {}

  if (meta.parts && meta.parts[partId]) {
    // Delete main part image
    if (meta.parts[partId].image) {
      const imgPath = path.join(dir, meta.parts[partId].image)
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath)
    }
    // Delete all variant images
    for (const [, varFile] of Object.entries(meta.parts[partId].variants || {})) {
      const varPath = path.join(dir, varFile)
      if (fs.existsSync(varPath)) fs.unlinkSync(varPath)
    }
    delete meta.parts[partId]
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
  }

  const config = loadAvatarConfig()
  if (config.activeAvatar === avatarId) broadcastAvatarChange(avatarId)
  return { ok: true }
})

ipcMain.handle('avatar-update-part-config', (_, avatarId, partId, config) => {
  const dir = path.join(AVATAR_DIR, avatarId)
  if (!fs.existsSync(dir)) return { ok: false }

  const metaPath = path.join(dir, 'meta.json')
  let meta = {}
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) } catch {}

  if (meta.parts && meta.parts[partId]) {
    if (config.offset) meta.parts[partId].offset = config.offset
    if (config.scale != null) meta.parts[partId].scale = config.scale
    if (config.rotation != null) meta.parts[partId].rotation = config.rotation
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
  }

  const avatarConfig = loadAvatarConfig()
  if (avatarConfig.activeAvatar === avatarId) broadcastAvatarChange(avatarId)
  return { ok: true }
})

ipcMain.handle('avatar-get-parts-data', (_, avatarId) => {
  const dir = path.join(AVATAR_DIR, avatarId)
  if (!fs.existsSync(dir)) return null

  const metaPath = path.join(dir, 'meta.json')
  let meta = {}
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) } catch {}

  const parts = {}
  for (const [partId, partData] of Object.entries(meta.parts || {})) {
    const entry = { ...partData, imageUrl: null, variantUrls: {} }
    if (partData.image) {
      const absPath = path.join(dir, partData.image)
      if (fs.existsSync(absPath)) entry.imageUrl = 'file://' + absPath
    }
    for (const [variant, varFile] of Object.entries(partData.variants || {})) {
      const varAbs = path.join(dir, varFile)
      if (fs.existsSync(varAbs)) entry.variantUrls[variant] = 'file://' + varAbs
    }
    parts[partId] = entry
  }
  return parts
})

ipcMain.handle('avatar-get-voices', () => {
  return new Promise((resolve) => {
    exec('say -v "?"', (err, stdout) => {
      if (err) { resolve([]); return }
      const voices = []
      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue
        // Format: "Alex                en_US    # Most people recognize me by my voice."
        const match = line.match(/^(\S+(?:\s+\S+)*?)\s{2,}(\S+)\s+#\s*(.*)$/)
        if (match) {
          voices.push({ name: match[1].trim(), lang: match[2].trim(), sample: match[3].trim() })
        }
      }
      resolve(voices)
    })
  })
})

ipcMain.handle('avatar-update-personality', (_, avatarId, personality) => {
  const dir = path.join(AVATAR_DIR, avatarId)
  if (!fs.existsSync(dir)) return { ok: false }

  const metaPath = path.join(dir, 'meta.json')
  let meta = {}
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) } catch {}

  if (personality.butlerName !== undefined) meta.butlerName = personality.butlerName
  if (personality.voice !== undefined) meta.voice = personality.voice
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

  const config = loadAvatarConfig()
  if (config.activeAvatar === avatarId) {
    broadcastAvatarChange(avatarId)
    // Update main process TTS settings
    if (meta.voice && meta.voice.name) ttsVoiceName = meta.voice.name
    if (meta.voice && meta.voice.rate) ttsRate = Math.round(meta.voice.rate * 180)
    // Broadcast personality change so renderer can update status bar name and voice
    broadcastToMain('personality-changed', { butlerName: meta.butlerName, voice: meta.voice })
    broadcastToMobile('personality-changed', { butlerName: meta.butlerName, voice: meta.voice })
  }
  return { ok: true }
})

function broadcastAvatarChange(avatarId) {
  const avatarData = avatarId ? getAvatarData(avatarId) : null
  broadcastToMain('avatar-changed', avatarData)
  broadcastToMobile('avatar-changed', avatarData)
}

function getAvatarData(avatarId) {
  const dir = path.join(AVATAR_DIR, avatarId)
  if (!fs.existsSync(dir)) return null

  const metaPath = path.join(dir, 'meta.json')
  let meta = {}
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) } catch {}

  // v2 parts-based avatar
  if (meta.version === 2 && meta.mode === 'parts') {
    const parts = {}
    for (const [partId, partData] of Object.entries(meta.parts || {})) {
      const entry = { ...partData, imageUrl: null, variantUrls: {} }
      if (partData.image) {
        const absPath = path.join(dir, partData.image)
        if (fs.existsSync(absPath)) entry.imageUrl = 'file://' + absPath
      }
      for (const [variant, varFile] of Object.entries(partData.variants || {})) {
        const varAbs = path.join(dir, varFile)
        if (fs.existsSync(varAbs)) entry.variantUrls[variant] = 'file://' + varAbs
      }
      parts[partId] = entry
    }
    return { id: avatarId, name: meta.name, mode: 'parts', butlerName: meta.butlerName, voice: meta.voice, parts }
  }

  // v1 state-based avatar (legacy)
  const states = {}
  for (const [state, filename] of Object.entries(meta.states || {})) {
    const absPath = path.join(dir, filename)
    if (fs.existsSync(absPath)) states[state] = 'file://' + absPath
  }
  return { id: avatarId, name: meta.name, states }
}

// ── Session Discovery ─────────────────────────────────────────────────────────

function decodeCwd(dirName) {
  // Project dirs encode paths: /Users/foo/Desktop/btc-oracle → -Users-foo-Desktop-btc-oracle
  // Greedy reconstruction: split on '-', accumulate segments, treat '-' as '/' when the path exists
  const parts = dirName.substring(1).split('-')
  let result = '/'
  let buffer = ''

  for (let i = 0; i < parts.length; i++) {
    const segment = buffer ? buffer + '-' + parts[i] : parts[i]
    const asDir = path.join(result, segment)

    if (i === parts.length - 1) {
      result = asDir
    } else {
      try {
        if (fs.existsSync(asDir) && fs.statSync(asDir).isDirectory()) {
          result = asDir
          buffer = ''
        } else {
          buffer = segment
        }
      } catch {
        buffer = segment
      }
    }
  }

  return result
}

function extractSessionTitle(filePath) {
  // Read first ~30 lines of the JSONL to find the first real user message
  return new Promise((resolve) => {
    let resolved = false
    const done = (val) => { if (!resolved) { resolved = true; resolve(val) } }

    try {
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' })
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
      let lineCount = 0

      rl.on('line', (line) => {
        lineCount++
        if (lineCount > 30 || resolved) { rl.close(); return }

        try {
          const d = JSON.parse(line)
          if (d.type === 'user' && d.message && d.message.role === 'user') {
            let text = d.message.content
            if (Array.isArray(text)) {
              const textBlock = text.find(c => c.type === 'text')
              text = textBlock ? textBlock.text : ''
            }
            if (typeof text === 'string') {
              text = text.trim()
              // Skip system/interrupt messages and tool results
              if (text && !text.startsWith('[Request interrupted')) {
                // Clean up common prefixes to get a meaningful title
                let title = text
                  .replace(/^Implement the following plan:\s*/i, '')
                  .replace(/^#\s+/, '')
                  .split('\n')[0]  // first line only
                  .trim()
                done(title.slice(0, 80))
                rl.close()
                stream.destroy()
                return
              }
            }
          }
        } catch {}
      })

      rl.on('close', () => done(null))
      rl.on('error', () => done(null))
      stream.on('error', () => done(null))
    } catch {
      done(null)
    }
  })
}

function discoverExistingSessions() {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects')
  if (!fs.existsSync(projectsDir)) return

  exec('pgrep -x claude', (err, stdout) => {
    if (err || !stdout.trim()) return

    const processCount = stdout.trim().split('\n').filter(Boolean).length
    if (processCount === 0) return

    const cutoff = Date.now() - 3600000 // files modified in the last hour
    const newSessions = []

    try {
      const dirs = fs.readdirSync(projectsDir).filter(d => d.startsWith('-'))

      for (const dir of dirs) {
        const projPath = path.join(projectsDir, dir)
        try {
          if (!fs.statSync(projPath).isDirectory()) continue
        } catch { continue }

        const cwd = decodeCwd(dir)

        let files
        try { files = fs.readdirSync(projPath) } catch { continue }

        const sessionFiles = files.filter(f =>
          f.endsWith('.jsonl') &&
          !f.startsWith('agent-') &&
          f.length > 10
        )

        for (const file of sessionFiles) {
          const filePath = path.join(projPath, file)
          let fstat
          try { fstat = fs.statSync(filePath) } catch { continue }
          if (fstat.mtimeMs < cutoff) continue

          const sessionId = file.replace('.jsonl', '')
          if (sessions.has(sessionId)) continue

          const color = SESSION_COLORS[sessionColorIndex % SESSION_COLORS.length]
          sessionColorIndex++
          sessions.set(sessionId, {
            id: sessionId,
            cwd: cwd,
            title: null,
            source: 'discovered',
            startTime: fstat.birthtimeMs || fstat.ctimeMs,
            status: 'active',
            tools: [],
            lastActivity: fstat.mtimeMs,
            color,
          })
          newSessions.push({ sessionId, filePath })
        }
      }
    } catch {}

    if (newSessions.length > 0) {
      // Extract titles asynchronously, then broadcast
      const titlePromises = newSessions.map(({ sessionId, filePath }) =>
        extractSessionTitle(filePath).then(title => {
          const s = sessions.get(sessionId)
          if (s) s.title = title
        })
      )

      Promise.all(titlePromises).then(() => {
        const sessionList = Array.from(sessions.values())
        broadcastToMain('sessions-updated', sessionList)
        broadcastToPanel('sessions-updated', sessionList)
        broadcastToMobile('sessions-updated', sessionList)
        refreshMenu()
        const voiceMsg = `Sir, I found ${newSessions.length} active session${newSessions.length > 1 ? 's' : ''}.`
        nativeSay(voiceMsg)
        broadcastToMobile('voice-event', voiceMsg)
      })
    }
  })
}

// Re-discover periodically (every 30s) to catch new sessions
let discoveryInterval = null
function startDiscoveryLoop() {
  discoverExistingSessions()
  discoveryInterval = setInterval(discoverExistingSessions, 30000)
}

// ── Wake Word System ──────────────────────────────────────────────────────────

function startWakeWord() {
  if (wakeWordProc) return

  // Resolve the swift file — __dirname may be inside .asar in packaged app
  const appPath = app.getAppPath().replace(/\.asar$/, '.asar.unpacked') || __dirname
  let swiftPath = path.join(__dirname, 'wake-word.swift')
  // In packaged apps, check the unpacked resources
  if (!fs.existsSync(swiftPath)) {
    swiftPath = path.join(appPath, 'wake-word.swift')
  }
  const binPath = path.join(os.homedir(), '.sebastian', 'wake-word')

  // Compile on first use for faster startup
  const compile = () => {
    return new Promise((resolve) => {
      if (fs.existsSync(binPath)) { resolve(binPath); return }
      if (!fs.existsSync(swiftPath)) { resolve(null); return }
      const base = path.join(os.homedir(), '.sebastian')
      if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true })
      exec(`swiftc -O '${swiftPath}' -o '${binPath}'`, { timeout: 60000 }, (err) => {
        resolve(err ? null : binPath)
      })
    })
  }

  compile().then((bin) => {
    const cmd = bin || 'swift'
    const args = bin ? [] : [swiftPath]

    const spawn = require('child_process').spawn
    wakeWordProc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] })

    let buffer = ''
    wakeWordProc.stdout.on('data', (data) => {
      buffer += data.toString()
      let idx
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 1)

        if (line === 'WAKE') {
          broadcastToMain('wake-word-detected', {})
        } else if (line.startsWith('PROMPT:')) {
          const text = line.slice(7).trim()
          if (text) broadcastToMain('wake-word-prompt', text)
        }
      }
    })

    wakeWordProc.on('exit', () => {
      wakeWordProc = null
      // Auto-restart if still enabled
      if (settings.wakeWord) {
        setTimeout(() => startWakeWord(), 2000)
      }
    })
  })
}

function stopWakeWord() {
  if (wakeWordProc) {
    try { wakeWordProc.stdin.write('STOP\n') } catch {}
    setTimeout(() => {
      if (wakeWordProc) { try { wakeWordProc.kill() } catch {} }
      wakeWordProc = null
    }, 500)
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Request microphone permission on macOS
  if (process.platform === 'darwin') {
    try { await systemPreferences.askForMediaAccess('microphone') } catch {}
  }

  createWindow()
  buildAppMenu()
  watchStateFile()
  startHttpServer()

  // Discover existing sessions after a short delay (let windows load first)
  setTimeout(() => startDiscoveryLoop(), 2000)

  // Start wake word if enabled
  if (settings.wakeWord) setTimeout(() => startWakeWord(), 3000)
})

app.on('window-all-closed', () => app.quit())

app.on('will-quit', () => {
  fs.unwatchFile(STATE_FILE)
  if (discoveryInterval) clearInterval(discoveryInterval)
  stopWakeWord()
})
