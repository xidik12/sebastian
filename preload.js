const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Window control
  moveWindow: (x, y) => ipcRenderer.send('move-window', x, y),
  bubbleResize: (expanded) => ipcRenderer.send('bubble-resize', expanded),
  onBubbleSide: (cb) => ipcRenderer.on('bubble-side', (_, side) => cb(side)),
  getPosition: () => ipcRenderer.invoke('get-position'),
  getScreen: () => ipcRenderer.invoke('get-screen'),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),

  // Panel
  openPanel: () => ipcRenderer.send('open-panel'),
  openTerminal: (sessionId) => ipcRenderer.send('open-terminal', sessionId),

  // Approvals
  approveRequest: (id) => ipcRenderer.send('approve-request', id),
  approveAll: () => ipcRenderer.send('approve-all'),
  denyRequest: (id, reason) => ipcRenderer.send('deny-request', id, reason),

  // Chat
  getSessions: () => ipcRenderer.invoke('get-sessions'),
  sendMessage: (sessionId, message) => ipcRenderer.send('send-to-session', sessionId, message),
  sendCommand: (sessionId, command) => ipcRenderer.send('send-command-to-session', sessionId, command),
  transcribeAudio: (buffer) => ipcRenderer.invoke('transcribe-audio', buffer),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSetting: (key, value) => ipcRenderer.send('update-setting', key, value),
  openAvatarEditor: () => ipcRenderer.send('open-avatar-editor'),
  quitApp: () => ipcRenderer.send('quit-app'),

  // Events
  onEmotion: (cb) => ipcRenderer.on('emotion-update', (_, data) => cb(data)),
  onSessionsUpdated: (cb) => ipcRenderer.on('sessions-updated', (_, data) => cb(data)),
  onApprovalCount: (cb) => ipcRenderer.on('approval-count', (_, count) => cb(count)),
  onNewApproval: (cb) => ipcRenderer.on('new-approval', (_, data) => cb(data)),
  onApprovalsUpdated: (cb) => ipcRenderer.on('approvals-updated', (_, data) => cb(data)),
  onNotifyApproval: (cb) => ipcRenderer.on('notify-approval', (_, data) => cb(data)),
  onSessionResponse: (cb) => ipcRenderer.on('session-response', (_, data) => cb(data)),
  onSettingChanged: (cb) => ipcRenderer.on('setting-changed', (_, data) => cb(data)),
  onVoiceEvent: (cb) => ipcRenderer.on('voice-event', (_, text) => cb(text)),
  onAvatarChanged: (cb) => ipcRenderer.on('avatar-changed', (_, data) => cb(data)),
  onPersonalityChanged: (cb) => ipcRenderer.on('personality-changed', (_, data) => cb(data)),
  onPersonalityComment: (cb) => ipcRenderer.on('personality-comment', (_, data) => cb(data)),
  getActiveAvatar: () => ipcRenderer.invoke('avatar-get-active-data'),

  // Native TTS
  nativeSpeak: (text) => ipcRenderer.send('native-speak', text),
  onSpeechStart: (cb) => ipcRenderer.on('speech-start', (_, text) => cb(text)),
  onSpeechEnd: (cb) => ipcRenderer.on('speech-end', () => cb()),

  // Wake word
  onWakeWordDetected: (cb) => ipcRenderer.on('wake-word-detected', (_, data) => cb(data)),
  onWakeWordPrompt: (cb) => ipcRenderer.on('wake-word-prompt', (_, text) => cb(text)),
})
