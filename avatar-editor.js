// Avatar Editor — Part-based customization system
// Backward-compatible with legacy v1 (flat states:{}) format

let avatars = []
let activeAvatarId = null
let selectedAvatarId = null
let selectedPartId = null
let previewEmotion = 'idle'
let playAnimations = true
let activeCategory = 'body'
let partsData = {}  // from getPartsData: { partId: { image, imageUrl, offset, scale, variants, variantUrls } }
let dragState = null

// Legacy mode states list (v1 compat)
const LEGACY_STATES = [
  'idle', 'happy', 'sad', 'angry', 'thinking', 'speaking',
  'excited', 'listening', 'sleeping', 'sleepy', 'bored',
  'error', 'surprised', 'confused', 'proud', 'nervous',
  'jumping', 'waving', 'dancing', 'summersault',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function isLegacyAvatar(av) {
  // v2 avatars have mode === 'parts', everything else is legacy
  return !av || av.mode !== 'parts'
}

function getPartSlot(partId) {
  return PART_SLOTS.find(p => p.id === partId) || null
}

function getPartVariantTypes(partId) {
  const slot = getPartSlot(partId)
  if (!slot || !slot.animated) return []
  return PART_VARIANTS[slot.animated] || []
}

function getCategoryParts(catId) {
  const cat = PART_CATEGORIES.find(c => c.id === catId)
  return cat ? cat.parts : []
}

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  avatars = await window.avatarApi.getAvatars()
  activeAvatarId = await window.avatarApi.getActive()

  buildEmotionSelector()
  buildLegacyStatesGrid()
  buildCategoryTabs()
  buildPartSlots()
  renderList()
  setupEvents()
  populateVoices()

  if (avatars.length > 0) {
    selectAvatar(avatars[0].id)
  }
}

// ── Sidebar List ─────────────────────────────────────────────────────────────

function renderList() {
  const list = document.getElementById('avatar-list')
  list.innerHTML = ''

  for (const av of avatars) {
    const div = document.createElement('div')
    div.className = 'avatar-item' +
      (av.id === selectedAvatarId ? ' active' : '') +
      (av.id === activeAvatarId ? ' applied' : '')
    div.dataset.id = av.id

    const thumb = document.createElement('img')
    thumb.className = 'avatar-item-thumb'
    let thumbSrc = null
    if (av.mode === 'parts' && av.parts) {
      // Try head imageUrl first, then body
      if (av.parts.head && av.parts.head.imageUrl) thumbSrc = av.parts.head.imageUrl
      else if (av.parts.body && av.parts.body.imageUrl) thumbSrc = av.parts.body.imageUrl
    } else if (av.states && av.states.idle) {
      thumbSrc = av.states.idle
    }

    if (thumbSrc) {
      thumb.src = thumbSrc
    } else {
      thumb.style.display = 'none'
    }

    const name = document.createElement('span')
    name.className = 'avatar-item-name'
    name.textContent = av.name + (av.id === activeAvatarId ? ' (active)' : '')

    div.appendChild(thumb)
    div.appendChild(name)
    div.addEventListener('click', () => selectAvatar(av.id))
    list.appendChild(div)
  }
}

// ── Avatar Selection ─────────────────────────────────────────────────────────

async function selectAvatar(id) {
  selectedAvatarId = id
  selectedPartId = null
  renderList()

  const av = avatars.find(a => a.id === id)
  if (!av) return

  document.getElementById('editor-empty').style.display = 'none'
  document.getElementById('editor-main').style.display = ''

  document.getElementById('avatar-name').value = av.name || ''

  const legacy = isLegacyAvatar(av)

  // Toggle legacy vs parts mode visibility
  document.getElementById('legacy-badge').style.display = legacy ? '' : 'none'
  document.getElementById('legacy-editor').style.display = legacy ? '' : 'none'
  document.getElementById('personality-section').style.display = legacy ? 'none' : ''
  document.getElementById('parts-editor').style.display = legacy ? 'none' : ''
  document.getElementById('part-bar').style.display = legacy ? 'none' : ''
  document.getElementById('inspector').style.display = 'none'

  if (legacy) {
    showLegacyEditor(av)
  } else {
    await showPartsEditor(av)
  }
}

// ── Legacy Editor (v1 compat) ────────────────────────────────────────────────

function buildLegacyStatesGrid() {
  const grid = document.getElementById('states-grid')
  grid.innerHTML = ''
  for (const state of LEGACY_STATES) {
    const card = document.createElement('div')
    card.className = 'state-card'
    card.dataset.state = state
    card.innerHTML = `
      <div class="state-dropzone" id="drop-${state}">
        <span class="state-placeholder">Drop image</span>
        <img class="state-preview" style="display:none">
      </div>
      <div class="state-label">${state}</div>
    `
    grid.appendChild(card)
  }
}

function showLegacyEditor(av) {
  for (const state of LEGACY_STATES) {
    const zone = document.getElementById('drop-' + state)
    if (!zone) continue
    const img = zone.querySelector('.state-preview')
    const placeholder = zone.querySelector('.state-placeholder')

    if (av.states && av.states[state]) {
      img.src = av.states[state]
      img.style.display = ''
      placeholder.style.display = 'none'
      zone.classList.add('has-image')
    } else {
      img.style.display = 'none'
      img.src = ''
      placeholder.style.display = ''
      zone.classList.remove('has-image')
    }
  }
}

// ── Parts Editor ─────────────────────────────────────────────────────────────

async function showPartsEditor(av) {
  // Load parts data from backend (resolved URLs)
  try {
    const data = await window.avatarApi.getPartsData(selectedAvatarId)
    partsData = data || {}
  } catch {
    partsData = {}
  }

  // Load personality from avatar data
  loadPersonality(av)

  // Show parts UI
  document.getElementById('part-bar').style.display = ''
  buildPartSlots()
  updatePreview()
}

function loadPersonality(av) {
  document.getElementById('butler-name').value = av.butlerName || ''

  const voice = av.voice || {}
  const rateSlider = document.getElementById('voice-rate')
  const pitchSlider = document.getElementById('voice-pitch')
  const volumeSlider = document.getElementById('voice-volume')

  rateSlider.value = voice.rate != null ? voice.rate : DEFAULT_VOICE_PREFS.rate
  pitchSlider.value = voice.pitch != null ? voice.pitch : DEFAULT_VOICE_PREFS.pitch
  volumeSlider.value = voice.volume != null ? voice.volume : DEFAULT_VOICE_PREFS.volume

  document.getElementById('voice-rate-val').textContent = parseFloat(rateSlider.value).toFixed(2)
  document.getElementById('voice-pitch-val').textContent = parseFloat(pitchSlider.value).toFixed(2)
  document.getElementById('voice-volume-val').textContent = parseFloat(volumeSlider.value).toFixed(2)

  // Set voice dropdown
  const voiceSelect = document.getElementById('voice-select')
  if (voice.name) {
    let found = false
    for (let i = 0; i < voiceSelect.options.length; i++) {
      if (voiceSelect.options[i].value === voice.name) {
        voiceSelect.selectedIndex = i
        found = true
        break
      }
    }
    if (!found) voiceSelect.selectedIndex = 0
  } else {
    voiceSelect.selectedIndex = 0
  }
}

async function populateVoices() {
  const voiceSelect = document.getElementById('voice-select')
  try {
    const voices = await window.avatarApi.getVoices()
    if (voices && voices.length) {
      for (const v of voices) {
        const opt = document.createElement('option')
        opt.value = v.name || v
        const label = v.name ? (v.name + (v.lang ? ' (' + v.lang + ')' : '')) : String(v)
        opt.textContent = label
        voiceSelect.appendChild(opt)
      }
    }
  } catch {
    // getVoices might not be implemented yet on some platforms
  }
}

// ── Emotion Selector ─────────────────────────────────────────────────────────

function buildEmotionSelector() {
  const sel = document.getElementById('emotion-select')
  sel.innerHTML = ''
  for (const em of EMOTION_STATES) {
    const opt = document.createElement('option')
    opt.value = em
    opt.textContent = em.charAt(0).toUpperCase() + em.slice(1)
    sel.appendChild(opt)
  }
  sel.value = 'idle'
}

// ── Category Tabs ────────────────────────────────────────────────────────────

function buildCategoryTabs() {
  const container = document.getElementById('category-tabs')
  container.innerHTML = ''

  for (const cat of PART_CATEGORIES) {
    const tab = document.createElement('button')
    tab.className = 'category-tab' + (cat.id === activeCategory ? ' active' : '')
    tab.textContent = cat.label
    tab.dataset.catId = cat.id
    tab.addEventListener('click', () => {
      activeCategory = cat.id
      buildCategoryTabs()
      buildPartSlots()
    })
    container.appendChild(tab)
  }
}

// ── Part Slot Buttons ────────────────────────────────────────────────────────

function buildPartSlots() {
  const container = document.getElementById('part-slots')
  container.innerHTML = ''

  const partIds = getCategoryParts(activeCategory)

  for (const partId of partIds) {
    const slot = getPartSlot(partId)
    if (!slot) continue

    const btn = document.createElement('div')
    const pd = partsData[partId]
    const hasImg = pd && pd.imageUrl
    btn.className = 'part-slot' +
      (hasImg ? ' has-image' : '') +
      (partId === selectedPartId ? ' selected' : '')
    btn.title = slot.label

    if (hasImg) {
      const img = document.createElement('img')
      img.className = 'part-slot-thumb'
      img.src = pd.imageUrl
      btn.appendChild(img)
    } else {
      const empty = document.createElement('span')
      empty.className = 'part-slot-empty'
      empty.textContent = '+'
      btn.appendChild(empty)
    }

    const label = document.createElement('span')
    label.className = 'part-slot-label'
    label.textContent = slot.label.split('/')[0].trim()
    btn.appendChild(label)

    btn.addEventListener('click', () => selectPart(partId))
    container.appendChild(btn)
  }
}

// ── Preview Rendering ────────────────────────────────────────────────────────

function buildPreview(data) {
  const area = document.getElementById('preview-area')
  area.innerHTML = ''

  // Sort parts by layer
  const sortedSlots = [...PART_SLOTS].sort((a, b) => a.layer - b.layer)

  for (const slot of sortedSlots) {
    const pd = data[slot.id]
    if (!pd || !pd.imageUrl) continue

    // Determine which image to show based on emotion + variants
    let imgSrc = pd.imageUrl
    if (previewEmotion !== 'idle' && pd.variantUrls) {
      const variantImg = pd.variantUrls[previewEmotion]
      if (variantImg) imgSrc = variantImg
    }

    const img = document.createElement('img')
    img.className = 'preview-part'
    img.dataset.partId = slot.id
    img.src = imgSrc
    img.draggable = false

    if (slot.id === selectedPartId) {
      img.classList.add('selected')
    }

    // Calculate position and size
    const offset = pd.offset || { x: 0, y: 0 }
    const scale = pd.scale != null ? pd.scale : 1.0
    const w = slot.size.w * scale
    const h = slot.size.h * scale
    const left = slot.anchor.x + offset.x - w / 2
    const top = slot.anchor.y + offset.y - h / 2

    img.style.left = left + 'px'
    img.style.top = top + 'px'
    img.style.width = w + 'px'
    img.style.height = h + 'px'

    // Animation classes
    if (playAnimations) {
      if (slot.animGroup === 'float') img.classList.add('anim-float')
      if (slot.animGroup === 'breathe') img.classList.add('anim-breathe')
    }

    // Click to select part, mousedown to start drag
    img.addEventListener('mousedown', (e) => {
      e.preventDefault()
      selectPart(slot.id)
      startDrag(e, slot.id)
    })

    area.appendChild(img)
  }
}

function updatePreview() {
  buildPreview(partsData)
}

// ── Preview Drag ─────────────────────────────────────────────────────────────

function startDrag(e, partId) {
  const pd = partsData[partId] || {}
  const startOffset = { x: pd.offset ? pd.offset.x : 0, y: pd.offset ? pd.offset.y : 0 }
  const startMouse = { x: e.clientX, y: e.clientY }

  const area = document.getElementById('preview-area')
  const partEl = area.querySelector(`[data-part-id="${partId}"]`)
  if (partEl) partEl.classList.add('dragging')

  dragState = { partId, startOffset, startMouse }

  const onMove = (ev) => {
    if (!dragState) return
    const dx = ev.clientX - dragState.startMouse.x
    const dy = ev.clientY - dragState.startMouse.y
    const newX = Math.round(Math.max(-50, Math.min(50, dragState.startOffset.x + dx)))
    const newY = Math.round(Math.max(-50, Math.min(50, dragState.startOffset.y + dy)))

    if (!partsData[partId]) partsData[partId] = { offset: { x: 0, y: 0 }, scale: 1.0 }
    if (!partsData[partId].offset) partsData[partId].offset = { x: 0, y: 0 }
    partsData[partId].offset.x = newX
    partsData[partId].offset.y = newY

    updatePreview()
    if (selectedPartId === partId) updateInspectorSliders()
  }

  const onUp = async () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)

    if (dragState && partsData[partId]) {
      const pd2 = partsData[partId]
      try {
        await window.avatarApi.updatePartConfig(selectedAvatarId, partId, {
          offset: pd2.offset || { x: 0, y: 0 },
          scale: pd2.scale != null ? pd2.scale : 1.0,
        })
      } catch {}
    }
    dragState = null
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ── Part Selection ───────────────────────────────────────────────────────────

function selectPart(partId) {
  selectedPartId = partId
  buildPartSlots()
  updatePreview()
  updateInspector()
}

// ── Inspector Panel ──────────────────────────────────────────────────────────

function updateInspector() {
  const panel = document.getElementById('inspector')

  if (!selectedPartId || !selectedAvatarId) {
    panel.style.display = 'none'
    return
  }

  const av = avatars.find(a => a.id === selectedAvatarId)
  if (!av || isLegacyAvatar(av)) {
    panel.style.display = 'none'
    return
  }

  panel.style.display = ''

  const slot = getPartSlot(selectedPartId)
  document.getElementById('inspector-title').textContent = slot ? slot.label : selectedPartId

  // Thumbnail
  const thumbWrap = document.getElementById('inspector-thumb')
  const pd = partsData[selectedPartId]
  thumbWrap.innerHTML = ''
  if (pd && pd.imageUrl) {
    const img = document.createElement('img')
    img.src = pd.imageUrl
    thumbWrap.appendChild(img)
  } else {
    const span = document.createElement('span')
    span.className = 'inspector-no-image'
    span.textContent = 'No image'
    thumbWrap.appendChild(span)
  }

  // Update sliders
  updateInspectorSliders()

  // Build variants section
  buildVariantsSection()
}

function updateInspectorSliders() {
  const pd = partsData[selectedPartId] || {}
  const offset = pd.offset || { x: 0, y: 0 }
  const scale = pd.scale != null ? pd.scale : 1.0

  const oxSlider = document.getElementById('part-offset-x')
  const oySlider = document.getElementById('part-offset-y')
  const scaleSlider = document.getElementById('part-scale')

  oxSlider.value = offset.x
  oySlider.value = offset.y
  scaleSlider.value = scale

  document.getElementById('part-offset-x-val').textContent = Math.round(offset.x)
  document.getElementById('part-offset-y-val').textContent = Math.round(offset.y)
  document.getElementById('part-scale-val').textContent = scale.toFixed(2)
}

function buildVariantsSection() {
  const section = document.getElementById('variants-section')
  const list = document.getElementById('variants-list')
  const variantTypes = getPartVariantTypes(selectedPartId)

  if (!variantTypes.length) {
    section.style.display = 'none'
    return
  }

  section.style.display = ''
  list.innerHTML = ''

  const pd = partsData[selectedPartId] || {}
  const variantUrls = pd.variantUrls || {}

  for (const vName of variantTypes) {
    const row = document.createElement('div')
    row.className = 'variant-row'

    const status = document.createElement('span')
    status.className = 'variant-status ' + (variantUrls[vName] ? 'has' : 'missing')

    const nameEl = document.createElement('span')
    nameEl.className = 'variant-name'
    nameEl.textContent = vName

    row.appendChild(status)
    row.appendChild(nameEl)

    if (variantUrls[vName]) {
      const thumb = document.createElement('img')
      thumb.className = 'variant-thumb'
      thumb.src = variantUrls[vName]
      row.appendChild(thumb)
    }

    const uploadBtn = document.createElement('button')
    uploadBtn.className = 'btn-variant-upload'
    uploadBtn.textContent = variantUrls[vName] ? 'Replace' : 'Upload'
    uploadBtn.addEventListener('click', async () => {
      const filePath = await window.avatarApi.pickFile()
      if (!filePath) return
      try {
        await window.avatarApi.savePartVariant(selectedAvatarId, selectedPartId, vName, filePath)
        await reloadPartsData()
        updateInspector()
        updatePreview()
      } catch (err) {
        console.error('Failed to save variant:', err)
      }
    })
    row.appendChild(uploadBtn)

    list.appendChild(row)
  }
}

// ── Reload Helpers ───────────────────────────────────────────────────────────

async function reloadPartsData() {
  try {
    const data = await window.avatarApi.getPartsData(selectedAvatarId)
    partsData = data || {}
  } catch {
    // Keep existing data if reload fails
  }
}

async function reloadAvatars() {
  avatars = await window.avatarApi.getAvatars()
  activeAvatarId = await window.avatarApi.getActive()
}

// ── Events ───────────────────────────────────────────────────────────────────

function setupEvents() {
  // Create new avatar
  document.getElementById('btn-new').addEventListener('click', async () => {
    const name = 'New Avatar ' + (avatars.length + 1)
    const result = await window.avatarApi.createAvatar(name)
    await reloadAvatars()
    renderList()
    selectAvatar(result.id)
  })

  // Reset to default butler
  document.getElementById('btn-reset').addEventListener('click', async () => {
    await window.avatarApi.resetAvatar()
    activeAvatarId = null
    renderList()
  })

  // Delete avatar
  document.getElementById('btn-delete').addEventListener('click', async () => {
    if (!selectedAvatarId) return
    await window.avatarApi.deleteAvatar(selectedAvatarId)
    await reloadAvatars()
    selectedAvatarId = null
    selectedPartId = null
    document.getElementById('editor-empty').style.display = ''
    document.getElementById('editor-main').style.display = 'none'
    document.getElementById('inspector').style.display = 'none'
    document.getElementById('part-bar').style.display = 'none'
    renderList()
  })

  // Apply avatar
  document.getElementById('btn-apply').addEventListener('click', async () => {
    if (!selectedAvatarId) return
    await window.avatarApi.applyAvatar(selectedAvatarId)
    activeAvatarId = selectedAvatarId
    renderList()
  })

  // Rename on blur/change
  document.getElementById('avatar-name').addEventListener('change', async (e) => {
    if (!selectedAvatarId) return
    await window.avatarApi.renameAvatar(selectedAvatarId, e.target.value)
    await reloadAvatars()
    renderList()
  })

  // Emotion selector
  document.getElementById('emotion-select').addEventListener('change', (e) => {
    previewEmotion = e.target.value
    updatePreview()
  })

  // Play animations checkbox
  document.getElementById('play-animations').addEventListener('change', (e) => {
    playAnimations = e.target.checked
    updatePreview()
  })

  // Convert legacy to parts mode
  document.getElementById('btn-convert').addEventListener('click', async () => {
    if (!selectedAvatarId) return
    try {
      // Initialize parts mode by saving a minimal part config
      // The backend will set version:2 and mode:'parts' on meta
      await window.avatarApi.updatePartConfig(selectedAvatarId, 'body', {
        offset: { x: 0, y: 0 },
        scale: 1.0,
      })
      await reloadAvatars()
      selectAvatar(selectedAvatarId)
    } catch (err) {
      console.error('Convert failed:', err)
    }
  })

  // ── Personality Events ───────────────────────────────────────────────────

  document.getElementById('butler-name').addEventListener('change', async (e) => {
    if (!selectedAvatarId) return
    try {
      await window.avatarApi.updatePersonality(selectedAvatarId, {
        butlerName: e.target.value,
        voice: getCurrentVoiceConfig(),
      })
    } catch {}
  })

  document.getElementById('voice-select').addEventListener('change', async () => {
    if (!selectedAvatarId) return
    try {
      await window.avatarApi.updatePersonality(selectedAvatarId, {
        butlerName: document.getElementById('butler-name').value,
        voice: getCurrentVoiceConfig(),
      })
    } catch {}
  })

  // Voice sliders
  setupVoiceSlider('voice-rate', 'voice-rate-val', 2)
  setupVoiceSlider('voice-pitch', 'voice-pitch-val', 2)
  setupVoiceSlider('voice-volume', 'voice-volume-val', 2)

  // ── Part Inspector Sliders ────────────────────────────────────────────────

  setupPartSlider('part-offset-x', 'part-offset-x-val', 0, (val) => {
    if (!selectedPartId || !selectedAvatarId) return
    if (!partsData[selectedPartId]) partsData[selectedPartId] = { offset: { x: 0, y: 0 }, scale: 1.0 }
    if (!partsData[selectedPartId].offset) partsData[selectedPartId].offset = { x: 0, y: 0 }
    partsData[selectedPartId].offset.x = parseInt(val)
    updatePreview()
  })

  setupPartSlider('part-offset-y', 'part-offset-y-val', 0, (val) => {
    if (!selectedPartId || !selectedAvatarId) return
    if (!partsData[selectedPartId]) partsData[selectedPartId] = { offset: { x: 0, y: 0 }, scale: 1.0 }
    if (!partsData[selectedPartId].offset) partsData[selectedPartId].offset = { x: 0, y: 0 }
    partsData[selectedPartId].offset.y = parseInt(val)
    updatePreview()
  })

  setupPartSlider('part-scale', 'part-scale-val', 2, (val) => {
    if (!selectedPartId || !selectedAvatarId) return
    if (!partsData[selectedPartId]) partsData[selectedPartId] = { offset: { x: 0, y: 0 }, scale: 1.0 }
    partsData[selectedPartId].scale = parseFloat(val)
    updatePreview()
  })

  // Part slider mouseup/change → persist to backend
  for (const sliderId of ['part-offset-x', 'part-offset-y', 'part-scale']) {
    document.getElementById(sliderId).addEventListener('mouseup', async () => {
      await persistPartConfig()
    })
    document.getElementById(sliderId).addEventListener('change', async () => {
      await persistPartConfig()
    })
  }

  // ── Inspector Choose / Remove / Drop ──────────────────────────────────────

  document.getElementById('inspector-choose').addEventListener('click', async () => {
    if (!selectedPartId || !selectedAvatarId) return
    const filePath = await window.avatarApi.pickFile()
    if (!filePath) return
    try {
      await window.avatarApi.savePart(selectedAvatarId, selectedPartId, filePath)
      await reloadPartsData()
      updateInspector()
      updatePreview()
      buildPartSlots()
    } catch (err) {
      console.error('Failed to save part:', err)
    }
  })

  document.getElementById('inspector-remove').addEventListener('click', async () => {
    if (!selectedPartId || !selectedAvatarId) return
    try {
      await window.avatarApi.removePart(selectedAvatarId, selectedPartId)
      await reloadPartsData()
      updateInspector()
      updatePreview()
      buildPartSlots()
    } catch (err) {
      console.error('Failed to remove part:', err)
    }
  })

  // Inspector dropzone
  const dropzone = document.getElementById('inspector-dropzone')
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault()
    dropzone.classList.add('drag-over')
  })
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over')
  })
  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault()
    dropzone.classList.remove('drag-over')
    const file = e.dataTransfer.files[0]
    if (!file || !selectedPartId || !selectedAvatarId) return
    try {
      await window.avatarApi.savePart(selectedAvatarId, selectedPartId, file.path)
      await reloadPartsData()
      updateInspector()
      updatePreview()
      buildPartSlots()
    } catch (err) {
      console.error('Failed to save part from drop:', err)
    }
  })
  // Click on dropzone also opens file picker
  dropzone.addEventListener('click', async () => {
    if (!selectedPartId || !selectedAvatarId) return
    const filePath = await window.avatarApi.pickFile()
    if (!filePath) return
    try {
      await window.avatarApi.savePart(selectedAvatarId, selectedPartId, filePath)
      await reloadPartsData()
      updateInspector()
      updatePreview()
      buildPartSlots()
    } catch (err) {
      console.error('Failed to save part:', err)
    }
  })

  // ── Legacy Drag & Drop + Click ────────────────────────────────────────────

  for (const state of LEGACY_STATES) {
    const zone = document.getElementById('drop-' + state)
    if (!zone) continue

    zone.addEventListener('dragover', (e) => {
      e.preventDefault()
      zone.classList.add('drag-over')
    })

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over')
    })

    zone.addEventListener('drop', async (e) => {
      e.preventDefault()
      zone.classList.remove('drag-over')
      const file = e.dataTransfer.files[0]
      if (!file || !selectedAvatarId) return
      await handleLegacyFile(file.path, state)
    })

    zone.addEventListener('click', async () => {
      if (!selectedAvatarId) return
      const filePath = await window.avatarApi.pickFile()
      if (filePath) await handleLegacyFile(filePath, state)
    })
  }
}

// ── Slider Helpers ───────────────────────────────────────────────────────────

function setupVoiceSlider(sliderId, valId, decimals) {
  const slider = document.getElementById(sliderId)
  const valEl = document.getElementById(valId)

  slider.addEventListener('input', () => {
    valEl.textContent = parseFloat(slider.value).toFixed(decimals)
  })

  slider.addEventListener('change', async () => {
    if (!selectedAvatarId) return
    try {
      await window.avatarApi.updatePersonality(selectedAvatarId, {
        butlerName: document.getElementById('butler-name').value,
        voice: getCurrentVoiceConfig(),
      })
    } catch {}
  })
}

function setupPartSlider(sliderId, valId, decimals, onInput) {
  const slider = document.getElementById(sliderId)
  const valEl = document.getElementById(valId)

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value)
    valEl.textContent = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString()
    if (onInput) onInput(slider.value)
  })
}

function getCurrentVoiceConfig() {
  return {
    name: document.getElementById('voice-select').value || null,
    rate: parseFloat(document.getElementById('voice-rate').value),
    pitch: parseFloat(document.getElementById('voice-pitch').value),
    volume: parseFloat(document.getElementById('voice-volume').value),
  }
}

async function persistPartConfig() {
  if (!selectedPartId || !selectedAvatarId) return
  const pd = partsData[selectedPartId]
  if (!pd) return
  try {
    await window.avatarApi.updatePartConfig(selectedAvatarId, selectedPartId, {
      offset: pd.offset || { x: 0, y: 0 },
      scale: pd.scale != null ? pd.scale : 1.0,
    })
  } catch {}
}

// ── Legacy File Handling ─────────────────────────────────────────────────────

async function handleLegacyFile(filePath, state) {
  const result = await window.avatarApi.saveState(selectedAvatarId, state, filePath)
  if (result && result.saved) {
    await reloadAvatars()
    const av = avatars.find(a => a.id === selectedAvatarId)
    if (av) showLegacyEditor(av)
    renderList()
  }
}

// ── Start ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init)
