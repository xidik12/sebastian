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
  return { sound: true, voice: false, lockPosition: false, wakeWord: false }
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
  const args = []
  if (ttsVoiceName) args.push('-v', ttsVoiceName)
  args.push('-r', String(ttsRate))
  args.push(text)
  const { spawn } = require('child_process')
  sayProc = spawn('say', args, { stdio: 'ignore' })
  // Notify renderer to animate mouth
  broadcastToMain('speech-start', text)
  sayProc.on('close', () => {
    sayProc = null
    broadcastToMain('speech-end', null)
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

  // Check learned patterns — auto-approve after 3+ approvals with no denials
  const key = getApprovalKey(toolName, toolInput)
  const mem = approvalMemory.patterns[key]
  if (mem && mem.approved >= 3 && mem.denied === 0) {
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
    height: 490,
    x: wa.x + Math.floor(sw / 2 - 140),
    y: wa.y + sh - 490,
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

function sendEmotion(emotion, text) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('emotion-update', { emotion, text })
  }
  broadcastToMobile('emotion-update', { emotion, text })
}

function resetPosition() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  const wa = screen.getPrimaryDisplay().workArea
  win.setPosition(wa.x + Math.floor(sw / 2 - 140), wa.y + sh - 490)
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
  if (['Read', 'Glob', 'Grep'].includes(toolName)) return 'listening'
  if (['Edit', 'Write', 'NotebookEdit'].includes(toolName)) return 'speaking'
  if (['Agent', 'WebSearch', 'WebFetch'].includes(toolName)) return 'thinking'
  if (toolName === 'Bash') return 'excited'
  return null
}

function handleSessionStart(data) {
  sessions.set(data.session_id, {
    id: data.session_id,
    cwd: data.cwd,
    title: null,
    source: data.source,
    startTime: Date.now(),
    status: 'active',
    tools: [],
    lastActivity: Date.now(),
  })
  sendEmotion('happy', 'New session started')
  nativeSay('A new session has connected, sir.')
  broadcastToMobile('voice-event', 'A new session has connected, sir.')
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

    const notifyData = {
      sound: soundEnabled,
      voice: voiceEnabled,
      toolName,
      command: toolInput?.command || '',
      sessionName,
      sessionId,
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
  return {}
}

function handleStop(data) {
  const session = sessions.get(data.session_id)
  if (session) {
    session.status = 'idle'
    session.lastActivity = Date.now()
  }

  // Notify about task completion
  const shortId = data.session_id ? data.session_id.slice(0, 6) : ''
  sendEmotion('happy', 'Task complete')
  nativeSay('Sir, a task has been completed.')
  broadcastToMobile('voice-event', 'Sir, a task has been completed.')
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

          sessions.set(sessionId, {
            id: sessionId,
            cwd: cwd,
            title: null,
            source: 'discovered',
            startTime: fstat.birthtimeMs || fstat.ctimeMs,
            status: 'active',
            tools: [],
            lastActivity: fstat.mtimeMs,
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
