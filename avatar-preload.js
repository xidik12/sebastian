const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('avatarApi', {
  // Existing v1 state-based methods
  getAvatars: () => ipcRenderer.invoke('avatar-get-all'),
  getActive: () => ipcRenderer.invoke('avatar-get-active'),
  saveState: (avatarId, state, filePath) => ipcRenderer.invoke('avatar-save-state', avatarId, state, filePath),
  createAvatar: (name) => ipcRenderer.invoke('avatar-create', name),
  deleteAvatar: (id) => ipcRenderer.invoke('avatar-delete', id),
  renameAvatar: (id, name) => ipcRenderer.invoke('avatar-rename', id, name),
  applyAvatar: (id) => ipcRenderer.invoke('avatar-apply', id),
  resetAvatar: () => ipcRenderer.invoke('avatar-reset'),
  pickFile: () => ipcRenderer.invoke('avatar-pick-file'),

  // v2 parts-based methods
  savePart: (avatarId, partId, srcPath) => ipcRenderer.invoke('avatar-save-part', avatarId, partId, srcPath),
  savePartVariant: (avatarId, partId, variant, srcPath) => ipcRenderer.invoke('avatar-save-part-variant', avatarId, partId, variant, srcPath),
  removePart: (avatarId, partId) => ipcRenderer.invoke('avatar-remove-part', avatarId, partId),
  updatePartConfig: (avatarId, partId, config) => ipcRenderer.invoke('avatar-update-part-config', avatarId, partId, config),
  getPartsData: (avatarId) => ipcRenderer.invoke('avatar-get-parts-data', avatarId),

  // Personality & voice
  getVoices: () => ipcRenderer.invoke('avatar-get-voices'),
  updatePersonality: (avatarId, personality) => ipcRenderer.invoke('avatar-update-personality', avatarId, personality),
})
