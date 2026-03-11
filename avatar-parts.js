// Shared constants for avatar part-based customization system
// Used by both the avatar editor and the main renderer

const PART_SLOTS = [
  { id: 'shadow',      label: 'Shadow',        layer: 0,  anchor: { x: 100, y: 190 }, size: { w: 52, h: 8 },   animGroup: 'root' },
  { id: 'glow',        label: 'Glow Aura',     layer: 1,  anchor: { x: 100, y: 100 }, size: { w: 120, h: 170 }, animGroup: 'root' },
  { id: 'coat-tails',  label: 'Coat Tails',    layer: 10, anchor: { x: 100, y: 155 }, size: { w: 80, h: 30 },  animGroup: 'breathe' },
  { id: 'left-leg',    label: 'Left Leg',      layer: 11, anchor: { x: 87, y: 163 },  size: { w: 22, h: 35 },  animGroup: 'breathe' },
  { id: 'right-leg',   label: 'Right Leg',     layer: 12, anchor: { x: 113, y: 163 }, size: { w: 22, h: 35 },  animGroup: 'breathe' },
  { id: 'left-arm',    label: 'Left Arm',      layer: 13, anchor: { x: 56, y: 108 },  size: { w: 24, h: 44 },  animGroup: 'breathe' },
  { id: 'body',        label: 'Body / Torso',  layer: 20, anchor: { x: 100, y: 116 }, size: { w: 72, h: 68 },  animGroup: 'breathe' },
  { id: 'right-arm',   label: 'Right Arm',     layer: 25, anchor: { x: 143, y: 108 }, size: { w: 24, h: 44 },  animGroup: 'breathe', animated: 'arm' },
  { id: 'neck',        label: 'Neck',          layer: 28, anchor: { x: 100, y: 79 },  size: { w: 16, h: 13 },  animGroup: 'breathe' },
  { id: 'head',        label: 'Head / Face',   layer: 30, anchor: { x: 100, y: 44 },  size: { w: 60, h: 60 },  animGroup: 'breathe' },
  { id: 'hair',        label: 'Hair',          layer: 31, anchor: { x: 100, y: 30 },  size: { w: 70, h: 40 },  animGroup: 'breathe' },
  { id: 'left-ear',    label: 'Left Ear',      layer: 29, anchor: { x: 70, y: 50 },   size: { w: 12, h: 16 },  animGroup: 'breathe' },
  { id: 'right-ear',   label: 'Right Ear',     layer: 29, anchor: { x: 130, y: 50 },  size: { w: 12, h: 16 },  animGroup: 'breathe' },
  { id: 'left-eye',    label: 'Left Eye',      layer: 35, anchor: { x: 88, y: 48 },   size: { w: 20, h: 22 },  animGroup: 'breathe', animated: 'eye' },
  { id: 'right-eye',   label: 'Right Eye',     layer: 36, anchor: { x: 112, y: 48 },  size: { w: 20, h: 22 },  animGroup: 'breathe', animated: 'eye' },
  { id: 'left-brow',   label: 'Left Eyebrow',  layer: 37, anchor: { x: 87, y: 37 },   size: { w: 16, h: 6 },   animGroup: 'breathe', animated: 'brow' },
  { id: 'right-brow',  label: 'Right Eyebrow', layer: 38, anchor: { x: 113, y: 37 },  size: { w: 16, h: 6 },   animGroup: 'breathe', animated: 'brow' },
  { id: 'nose',        label: 'Nose',          layer: 38, anchor: { x: 100, y: 56 },  size: { w: 10, h: 12 },  animGroup: 'breathe' },
  { id: 'mouth',       label: 'Mouth',         layer: 39, anchor: { x: 100, y: 68 },  size: { w: 20, h: 10 },  animGroup: 'breathe', animated: 'mouth' },
  { id: 'accessory',   label: 'Accessory',     layer: 50, anchor: { x: 100, y: 100 }, size: { w: 40, h: 40 },  animGroup: 'float' },
]

const EMOTION_STATES = [
  'idle', 'happy', 'sad', 'angry', 'thinking', 'speaking',
  'excited', 'listening', 'sleeping', 'sleepy', 'bored',
  'error', 'surprised', 'confused', 'proud', 'nervous',
  // ── Extended emotes (100) ──
  'grateful', 'amused', 'determined', 'hopeful', 'relieved', 'content',
  'nostalgic', 'jealous', 'guilty', 'ashamed', 'embarrassed', 'disgusted',
  'contempt', 'adoring', 'longing', 'melancholy', 'euphoric', 'serene',
  'anxious', 'panicked', 'terrified', 'furious', 'enraged', 'devastated',
  'heartbroken', 'ecstatic', 'blissful', 'gloomy', 'grumpy', 'irritated',
  'coding', 'debugging', 'deploying', 'testing', 'researching', 'downloading',
  'uploading', 'compiling', 'installing', 'searching', 'calculating', 'analyzing',
  'reviewing', 'building', 'fixing', 'refactoring', 'committing', 'pushing',
  'pulling', 'merging', 'branching', 'rolling-back', 'monitoring', 'profiling',
  'benchmarking', 'yawning', 'sneezing', 'coughing', 'shivering', 'sweating',
  'dizzy', 'fainting', 'stretching-out', 'nodding', 'shaking-head', 'facepalm',
  'saluting', 'clapping', 'thumbs-up', 'pointing', 'shrugging', 'flexing',
  'meditating', 'praying', 'bowing-deep', 'sarcastic', 'smirking', 'winking',
  'eye-rolling', 'skeptical', 'suspicious', 'intrigued', 'fascinated', 'impressed',
  'disappointed', 'apologetic', 'pleading', 'commanding', 'reassuring', 'encouraging',
  'loading', 'syncing', 'error-critical', 'warning', 'success', 'pending',
  'processing', 'queued', 'timeout', 'rate-limited',
]

// Variant types that animated parts can have
const PART_VARIANTS = {
  eye: ['blink', 'happy', 'sad', 'angry', 'sleeping', 'surprised'],
  mouth: ['happy', 'sad', 'angry', 'speaking-0', 'speaking-1', 'speaking-2', 'surprised', 'sleeping'],
  brow: ['angry', 'sad', 'thinking', 'surprised', 'confused'],
  arm: ['wave-0', 'wave-1'],
}

// Available system voices (populated at runtime)
const DEFAULT_VOICE_PREFS = {
  name: null,        // null = auto-select
  rate: 1.0,
  pitch: 0.85,
  volume: 0.7,
}

// For the editor: part categories for organized display
const PART_CATEGORIES = [
  { id: 'body', label: 'Body', parts: ['body', 'neck', 'left-arm', 'right-arm', 'left-leg', 'right-leg', 'coat-tails'] },
  { id: 'head', label: 'Head', parts: ['head', 'hair', 'left-ear', 'right-ear', 'nose'] },
  { id: 'face', label: 'Face', parts: ['left-eye', 'right-eye', 'left-brow', 'right-brow', 'mouth'] },
  { id: 'effects', label: 'Effects', parts: ['glow', 'shadow', 'accessory'] },
]

if (typeof module !== 'undefined') {
  module.exports = { PART_SLOTS, EMOTION_STATES, PART_VARIANTS, DEFAULT_VOICE_PREFS, PART_CATEGORIES }
}
