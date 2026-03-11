// ═══════════════════════════════════════════════════════════════════════════════
// Sebastian — Session Panel
// ═══════════════════════════════════════════════════════════════════════════════

let sessions = []
let approvals = []
let activityLog = []
let selectedSession = null

const MAX_ACTIVITY = 100

// ── DOM refs ──────────────────────────────────────────────────────────────────

const el = {
  approvalsSection: document.getElementById('approvals-section'),
  approvalsList: document.getElementById('approvals-list'),
  approveAllBtn: document.getElementById('approve-all-btn'),
  sessionsList: document.getElementById('sessions-list'),
  sessionCount: document.getElementById('session-count'),
  activityLog: document.getElementById('activity-log'),
  sessionSelect: document.getElementById('session-select'),
  chatInput: document.getElementById('chat-input'),
  chatSend: document.getElementById('chat-send'),
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  sessions = await window.panel.getSessions()
  approvals = await window.panel.getApprovals()

  renderSessions()
  renderApprovals()
  updateSessionSelect()

  // Event listeners
  el.approveAllBtn.addEventListener('click', () => {
    window.panel.approveAll()
    addActivity('system', 'Approved all pending requests', 'approved')
  })

  el.sessionSelect.addEventListener('change', () => {
    const val = el.sessionSelect.value
    el.chatInput.disabled = !val
    el.chatSend.disabled = !val
    selectedSession = val || null
  })

  el.chatSend.addEventListener('click', sendChat)
  el.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) sendChat()
  })

  // IPC listeners
  window.panel.onSessionsUpdated((data) => {
    sessions = data
    renderSessions()
    updateSessionSelect()
  })

  window.panel.onApprovalsUpdated((data) => {
    approvals = data
    renderApprovals()
  })

  window.panel.onNewApproval((data) => {
    approvals.push(data)
    renderApprovals()
    addActivity('approval', `${data.toolName} in ${shortId(data.sessionId)}`, 'pending')
  })

  window.panel.onSessionResponse((data) => {
    addActivity('response', `${shortId(data.sessionId)}: ${truncate(data.response, 80)}`)
  })
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderApprovals() {
  el.approvalsSection.style.display = approvals.length ? '' : 'none'

  el.approvalsList.innerHTML = approvals.map(a => `
    <div class="approval-card" data-id="${a.id}">
      <div class="approval-header">
        <span class="approval-tool">${a.toolName}</span>
        <span class="approval-session">${shortId(a.sessionId)}</span>
      </div>
      <div class="approval-command">${escapeHtml(formatToolInput(a.toolName, a.toolInput))}</div>
      <div class="approval-cwd">${a.cwd || ''}</div>
      <div class="approval-actions">
        <button class="btn btn-sm btn-approve" onclick="approveOne(${a.id})">Approve</button>
        <button class="btn btn-sm btn-deny" onclick="denyOne(${a.id})">Deny</button>
      </div>
    </div>
  `).join('')
}

function renderSessions() {
  el.sessionCount.textContent = sessions.length

  if (sessions.length === 0) {
    el.sessionsList.innerHTML = '<div class="empty-state">No active sessions. Start a Claude Code session to see it here.</div>'
    return
  }

  el.sessionsList.innerHTML = sessions.map(s => {
    const age = timeAgo(s.startTime)
    const lastTool = s.tools.length ? s.tools[s.tools.length - 1].name : '-'
    const cwdShort = s.cwd ? s.cwd.replace(/^\/Users\/[^/]+/, '~') : ''

    return `
      <div class="session-card ${selectedSession === s.id ? 'selected' : ''}" onclick="selectSession('${s.id}')">
        <div class="session-top">
          <div class="session-id">
            <span class="session-dot ${s.status}"></span>
            <span class="session-name">${escapeHtml(sessionDisplayName(s))}</span>
          </div>
          <span class="session-time">${age}</span>
        </div>
        <div class="session-bottom">
          <span class="session-cwd">${cwdShort}</span>
          <span class="session-tools">${s.tools.length} tools · last: ${lastTool}</span>
        </div>
        <div class="session-actions">
          <button class="btn btn-xs btn-action" onclick="event.stopPropagation(); sendSessionCommand('${s.id}', '/compact')" title="Compact context">&#8644; Compact</button>
          <button class="btn btn-xs btn-action" onclick="event.stopPropagation(); sendSessionCommand('${s.id}', '/auto-accept')" title="Toggle auto-accept">&#10003; Auto-accept</button>
        </div>
      </div>
    `
  }).join('')
}

function updateSessionSelect() {
  const current = el.sessionSelect.value
  el.sessionSelect.innerHTML = '<option value="">Select session...</option>' +
    sessions.map(s => `<option value="${s.id}" ${s.id === current ? 'selected' : ''}>${escapeHtml(sessionDisplayName(s))}</option>`).join('')

  if (current && !sessions.find(s => s.id === current)) {
    selectedSession = null
    el.chatInput.disabled = true
    el.chatSend.disabled = true
  }
}

function addActivity(type, text, status) {
  const entry = { type, text, status, time: Date.now() }
  activityLog.unshift(entry)
  if (activityLog.length > MAX_ACTIVITY) activityLog.pop()

  const icon = type === 'approval' ? '!' : type === 'response' ? '>' : '*'
  const statusClass = status === 'approved' ? 'approved' : status === 'denied' ? 'denied' : ''

  const html = `
    <div class="activity-entry">
      <span class="activity-time">${formatTime(entry.time)}</span>
      <span class="activity-icon">${icon}</span>
      <span class="activity-text ${statusClass}">${escapeHtml(text)}</span>
    </div>
  `
  el.activityLog.insertAdjacentHTML('afterbegin', html)

  // Trim old entries
  while (el.activityLog.children.length > MAX_ACTIVITY) {
    el.activityLog.removeChild(el.activityLog.lastChild)
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

function approveOne(id) {
  window.panel.approveRequest(id)
  approvals = approvals.filter(a => a.id !== id)
  renderApprovals()
  addActivity('system', `Approved request #${id}`, 'approved')
}

function denyOne(id) {
  window.panel.denyRequest(id, 'Denied by user')
  approvals = approvals.filter(a => a.id !== id)
  renderApprovals()
  addActivity('system', `Denied request #${id}`, 'denied')
}

function selectSession(id) {
  selectedSession = id
  el.sessionSelect.value = id
  el.chatInput.disabled = false
  el.chatSend.disabled = false
  renderSessions()
}

function sendSessionCommand(sessionId, command) {
  window.panel.sendCommand(sessionId, command)
  addActivity('chat', `Command → ${sessionDisplayName(sessions.find(s => s.id === sessionId) || { id: sessionId })}: ${command}`)
}

function sendChat() {
  const msg = el.chatInput.value.trim()
  if (!msg || !selectedSession) return

  window.panel.sendMessage(selectedSession, msg)
  addActivity('chat', `You → ${shortId(selectedSession)}: ${truncate(msg, 60)}`)
  el.chatInput.value = ''
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function sessionDisplayName(s) {
  if (s.title) {
    return s.title.length > 40 ? s.title.slice(0, 38) + '…' : s.title
  }
  if (s.cwd) {
    const folder = s.cwd.split('/').pop()
    const isHome = s.cwd.split('/').length <= 3 && s.cwd.startsWith('/Users/')
    if (folder && !isHome) return folder
  }
  return s.id ? s.id.slice(0, 8) : '???'
}

function shortId(id) {
  if (!id) return '???'
  return id.length > 12 ? id.slice(0, 8) + '...' : id
}

function truncate(str, max) {
  if (!str) return ''
  const clean = str.replace(/\n/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max) + '...' : clean
}

function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatToolInput(toolName, input) {
  if (!input) return ''
  if (toolName === 'Bash' && input.command) return input.command
  if (toolName === 'Edit' && input.file_path) return `Edit: ${input.file_path}`
  if (toolName === 'Write' && input.file_path) return `Write: ${input.file_path}`
  return JSON.stringify(input, null, 2)
}

function timeAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Start ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init)
