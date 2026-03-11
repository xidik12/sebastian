const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('panel', {
  getSessions: () => ipcRenderer.invoke('get-sessions'),
  getApprovals: () => ipcRenderer.invoke('get-approvals'),
  approveRequest: (id) => ipcRenderer.send('approve-request', id),
  approveAll: () => ipcRenderer.send('approve-all'),
  denyRequest: (id, reason) => ipcRenderer.send('deny-request', id, reason),
  sendMessage: (sessionId, message) => ipcRenderer.send('send-to-session', sessionId, message),
  sendCommand: (sessionId, command) => ipcRenderer.send('send-command-to-session', sessionId, command),
  closePanel: () => ipcRenderer.send('close-panel'),
  onSessionsUpdated: (cb) => ipcRenderer.on('sessions-updated', (_, data) => cb(data)),
  onApprovalsUpdated: (cb) => ipcRenderer.on('approvals-updated', (_, data) => cb(data)),
  onNewApproval: (cb) => ipcRenderer.on('new-approval', (_, data) => cb(data)),
  onSessionResponse: (cb) => ipcRenderer.on('session-response', (_, data) => cb(data)),
})
