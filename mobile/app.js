// =============================================================================
// Sebastian — Mobile PWA Client
// =============================================================================

// -- Server Connection --------------------------------------------------------

let SERVER_URL = '' // e.g. 'http://192.168.0.200:19700'

function apiUrl(path) {
  return SERVER_URL + path
}

function loadConnectionHistory() {
  try { return JSON.parse(localStorage.getItem('sebastian-servers') || '[]') } catch { return [] }
}

function saveConnectionHistory(url) {
  let history = loadConnectionHistory()
  history = history.filter(h => h !== url)
  history.unshift(url)
  if (history.length > 5) history = history.slice(0, 5)
  localStorage.setItem('sebastian-servers', JSON.stringify(history))
}

function removeFromHistory(url) {
  let history = loadConnectionHistory()
  history = history.filter(h => h !== url)
  localStorage.setItem('sebastian-servers', JSON.stringify(history))
}

async function testConnection(url) {
  try {
    const res = await fetch(url + '/mobile/sessions', { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return false
    await res.json()
    return true
  } catch { return false }
}

function renderConnectionHistory() {
  const history = loadConnectionHistory()
  const container = document.getElementById('connect-history')
  const savedDiv = document.getElementById('connect-saved')
  if (!history.length) { savedDiv.style.display = 'none'; return }
  savedDiv.style.display = ''
  container.innerHTML = ''
  for (const url of history) {
    const item = document.createElement('div')
    item.className = 'connect-history-item'
    const label = document.createElement('span')
    label.textContent = url.replace(/^https?:\/\//, '')
    const remove = document.createElement('span')
    remove.className = 'remove'
    remove.textContent = '\u00d7'
    remove.addEventListener('click', (e) => { e.stopPropagation(); removeFromHistory(url); renderConnectionHistory() })
    item.appendChild(label)
    item.appendChild(remove)
    item.addEventListener('click', () => {
      document.getElementById('connect-url').value = url
      attemptConnect()
    })
    container.appendChild(item)
  }
}

async function attemptConnect() {
  const input = document.getElementById('connect-url')
  const status = document.getElementById('connect-status')
  let url = input.value.trim().replace(/\/+$/, '')
  if (!url) { status.textContent = 'Enter a server address'; status.className = 'connect-status error'; return }
  if (!/^https?:\/\//.test(url)) url = 'http://' + url
  input.value = url

  status.textContent = 'Connecting...'
  status.className = 'connect-status'

  const ok = await testConnection(url)
  if (ok) {
    status.textContent = 'Connected!'
    status.className = 'connect-status success'
    SERVER_URL = url
    saveConnectionHistory(url)
    localStorage.setItem('sebastian-last-server', url)
    // Hide connect screen, show app
    document.getElementById('connect-screen').style.display = 'none'
    document.getElementById('app-main').style.display = ''
    init()
  } else {
    status.textContent = 'Could not connect. Check the address and ensure Sebastian is running.'
    status.className = 'connect-status error'
  }
}

function setupConnectionScreen() {
  document.getElementById('connect-btn').addEventListener('click', attemptConnect)
  document.getElementById('connect-url').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptConnect()
  })
  renderConnectionHistory()

  // Auto-connect to last server
  const lastServer = localStorage.getItem('sebastian-last-server')
  if (lastServer) {
    document.getElementById('connect-url').value = lastServer
    // Try silent auto-connect
    const status = document.getElementById('connect-status')
    status.textContent = 'Reconnecting...'
    testConnection(lastServer).then(ok => {
      if (ok) {
        SERVER_URL = lastServer
        document.getElementById('connect-screen').style.display = 'none'
        document.getElementById('app-main').style.display = ''
        init()
      } else {
        status.textContent = 'Previous server unavailable'
        status.className = 'connect-status error'
      }
    })
  }

  // If served from Sebastian directly, auto-detect
  if (window.location.port === '19700') {
    const selfUrl = window.location.origin
    document.getElementById('connect-url').value = selfUrl
    SERVER_URL = selfUrl
    document.getElementById('connect-screen').style.display = 'none'
    document.getElementById('app-main').style.display = ''
    init()
  }
}

document.addEventListener('DOMContentLoaded', setupConnectionScreen)

// -- Config -------------------------------------------------------------------

const WALK_SPEED = 1.2
const BLINK_MIN = 2200
const BLINK_MAX = 5500
const BLINK_DURATION = 120
const IDLE_MIN = 3000
const IDLE_MAX = 8000
const WALK_MIN = 2500
const WALK_MAX = 5000
const LOOK_MIN = 1500
const LOOK_MAX = 3000
const EXTERNAL_HOLD = 5000
const SLEEP_AFTER = 120000
const SPEAK_MOUTH_SPEED = 140

const MOUTH = {
  idle:      'M 92,66 Q 100,72 108,66',
  happy:     'M 88,65 Q 100,76 112,65',
  excited:   'M 88,65 Q 100,76 112,65',
  speaking:  ['M 92,66 Q 100,72 108,66', 'M 90,65 Q 100,76 110,65', 'M 94,67 Q 100,70 106,67'],
  thinking:  'M 95,68 Q 100,70 105,68',
  error:     'M 92,70 Q 100,65 108,70',
  sleeping:  'M 95,68 Q 100,70 105,68',
  listening: 'M 92,66 Q 100,72 108,66',
  angry:     'M 90,70 Q 100,64 110,70',
  sad:       'M 92,70 Q 100,67 108,70',
  bored:     'M 92,68 L 108,68',
  surprised: 'M 94,64 Q 100,72 106,64',
  confused:  'M 92,67 Q 97,70 100,66 Q 103,70 108,67',
  proud:     'M 86,65 Q 100,78 114,65',
  nervous:   'M 92,67 Q 96,69 100,66 Q 104,69 108,67',
  // -- Extended emotes (100) --
  grateful: 'M 89,64 Q 100,77 111,64',
  amused: 'M 90,65 Q 96,74 100,72 Q 104,74 110,65',
  determined: 'M 93,68 L 100,65 L 107,68',
  hopeful: 'M 91,66 Q 100,73 109,66',
  relieved: 'M 93,65 Q 100,74 107,65',
  content: 'M 93,66 Q 100,71 107,66',
  nostalgic: 'M 93,67 Q 100,70 107,67',
  jealous: 'M 91,69 Q 96,66 100,68 Q 104,66 109,69',
  guilty: 'M 94,69 Q 100,66 106,69',
  ashamed: 'M 95,69 Q 100,67 105,69',
  embarrassed: 'M 93,67 Q 97,70 100,67 Q 103,64 107,67',
  disgusted: 'M 91,70 Q 96,65 100,69 Q 104,65 109,70',
  contempt: 'M 91,68 L 100,68 Q 106,65 110,67',
  adoring: 'M 87,64 Q 100,78 113,64',
  longing: 'M 93,68 Q 100,71 107,68',
  melancholy: 'M 93,70 Q 100,66 107,70',
  euphoric: 'M 86,63 Q 100,80 114,63',
  serene: 'M 94,66 Q 100,70 106,66',
  anxious: 'M 93,67 Q 96,70 99,67 Q 102,70 105,67 Q 108,70 111,67',
  panicked: 'M 92,63 Q 100,74 108,63',
  terrified: 'M 93,62 Q 100,75 107,62',
  furious: 'M 89,71 Q 100,62 111,71',
  enraged: 'M 88,72 Q 100,60 112,72',
  devastated: 'M 91,72 Q 100,64 109,72',
  heartbroken: 'M 92,71 Q 100,65 108,71',
  ecstatic: 'M 87,64 Q 100,79 113,64',
  blissful: 'M 89,65 Q 100,75 111,65',
  gloomy: 'M 94,70 Q 100,67 106,70',
  grumpy: 'M 91,69 Q 100,65 109,69',
  irritated: 'M 90,69 L 96,67 L 104,67 L 110,69',
  coding: 'M 95,67 Q 100,69 105,67',
  debugging: 'M 93,68 Q 97,66 100,68 Q 103,66 107,68',
  deploying: 'M 92,66 Q 100,71 108,66',
  testing: 'M 94,67 Q 100,71 106,67',
  researching: 'M 95,68 L 100,66 L 105,68',
  downloading: 'M 94,68 Q 100,70 106,68',
  uploading: 'M 94,68 Q 100,66 106,68',
  compiling: 'M 96,68 Q 100,71 104,68',
  installing: 'M 93,67 Q 100,72 107,67',
  searching: 'M 96,68 Q 100,69 104,68',
  calculating: 'M 95,67 L 105,67',
  analyzing: 'M 94,67 Q 100,70 106,67',
  reviewing: 'M 93,68 Q 100,70 107,68',
  building: 'M 92,67 Q 100,71 108,67',
  fixing: 'M 93,66 Q 98,70 100,68 Q 102,70 107,66',
  refactoring: 'M 94,66 Q 100,72 106,66',
  committing: 'M 91,67 Q 100,72 109,67',
  pushing: 'M 92,67 Q 100,70 108,67',
  pulling: 'M 93,66 Q 100,73 107,66',
  merging: 'M 91,66 Q 96,71 100,68 Q 104,71 109,66',
  branching: 'M 93,67 Q 100,71 107,67',
  'rolling-back': 'M 92,69 Q 100,66 108,69',
  monitoring: 'M 95,68 Q 100,69 105,68',
  profiling: 'M 95,67 Q 100,70 105,67',
  benchmarking: 'M 94,68 L 106,68',
  yawning: 'M 93,62 Q 100,76 107,62',
  sneezing: 'M 92,63 Q 100,73 108,63',
  coughing: 'M 94,64 Q 100,71 106,64',
  shivering: 'M 93,68 Q 96,66 100,68 Q 104,66 107,68',
  sweating: 'M 92,67 Q 97,70 100,67 Q 103,70 108,67',
  dizzy: 'M 93,68 Q 97,66 100,69 Q 103,66 107,68',
  fainting: 'M 96,67 Q 100,71 104,67',
  'stretching-out': 'M 91,65 Q 100,73 109,65',
  nodding: 'M 91,66 Q 100,72 109,66',
  'shaking-head': 'M 93,69 Q 100,66 107,69',
  facepalm: 'M 94,69 Q 100,67 106,69',
  saluting: 'M 93,67 L 100,67 L 107,67',
  clapping: 'M 89,65 Q 100,74 111,65',
  'thumbs-up': 'M 90,65 Q 100,74 110,65',
  pointing: 'M 95,66 Q 100,70 105,66',
  shrugging: 'M 92,68 Q 97,66 100,68 Q 103,66 108,68',
  flexing: 'M 90,64 Q 100,75 110,64',
  meditating: 'M 96,67 Q 100,69 104,67',
  praying: 'M 96,66 Q 100,70 104,66',
  'bowing-deep': 'M 93,66 Q 100,70 107,66',
  sarcastic: 'M 90,68 L 97,66 L 103,68 L 110,65',
  smirking: 'M 92,68 L 100,67 Q 106,64 110,65',
  winking: 'M 90,66 Q 100,73 110,66',
  'eye-rolling': 'M 93,68 L 107,68',
  skeptical: 'M 91,68 L 100,67 L 109,69',
  suspicious: 'M 94,68 L 100,67 L 106,68',
  intrigued: 'M 93,66 Q 100,72 107,66',
  fascinated: 'M 91,65 Q 100,74 109,65',
  impressed: 'M 90,64 Q 100,76 110,64',
  disappointed: 'M 92,70 Q 100,66 108,70',
  apologetic: 'M 94,69 Q 100,65 106,69',
  pleading: 'M 93,69 Q 100,67 107,69',
  commanding: 'M 90,67 L 100,66 L 110,67',
  reassuring: 'M 90,66 Q 100,74 110,66',
  encouraging: 'M 90,65 Q 100,75 110,65',
  loading: 'M 95,68 Q 100,71 105,68',
  syncing: 'M 96,67 Q 100,72 104,67',
  'error-critical': 'M 90,72 Q 95,63 100,70 Q 105,63 110,72',
  warning: 'M 91,69 Q 100,66 109,69',
  success: 'M 88,64 Q 100,78 112,64',
  pending: 'M 96,68 Q 100,70 104,68',
  processing: 'M 94,68 Q 100,71 106,68',
  queued: 'M 95,68 L 105,68',
  timeout: 'M 91,70 Q 100,65 109,70',
  'rate-limited': 'M 92,69 L 100,67 L 108,69',
}

const MOOD_LABEL = {
  idle: 'At your service', thinking: 'Thinking...', speaking: 'Writing code...',
  happy: 'Very good, sir', listening: 'Reading...', sleeping: 'Resting...',
  error: 'My apologies...', excited: 'Running...', sad: 'Feeling down...',
  angry: 'Frustrated...', bored: 'Waiting...', sleepy: 'Getting drowsy...',
  surprised: 'Oh!', confused: 'Hmm...', proud: 'Well done, sir',
  nervous: 'A bit anxious...', jumping: 'Energized!', waving: 'Hello, sir!',
  dancing: 'In high spirits!', summersault: 'Showing off!',
  // -- Extended emotes (100) --
  grateful: 'Most grateful, sir', amused: 'How delightful!', determined: 'I shall see it done',
  hopeful: 'One remains hopeful', relieved: 'What a relief, sir', content: 'All is well',
  nostalgic: 'Ah, the memories...', jealous: 'How... fortunate for them', guilty: 'I must confess...',
  ashamed: 'I am deeply ashamed', embarrassed: 'How embarrassing...', disgusted: 'Most distasteful',
  contempt: 'How pedestrian', adoring: 'Simply wonderful', longing: 'If only...',
  melancholy: 'A heavy heart today', euphoric: 'Absolutely magnificent!', serene: 'Perfect tranquility',
  anxious: 'Rather unsettling...', panicked: 'This is most urgent!', terrified: 'Good heavens!',
  furious: 'This is unacceptable!', enraged: 'MOST DISPLEASED!', devastated: 'I am truly shattered',
  heartbroken: 'My heart aches, sir', ecstatic: 'Extraordinary, sir!', blissful: 'Pure bliss',
  gloomy: 'A dreary outlook...', grumpy: 'Hmph.', irritated: 'Rather vexing...',
  coding: 'Writing code...', debugging: 'Tracing the issue...', deploying: 'Deploying to production...',
  testing: 'Running test suite...', researching: 'Investigating, sir...', downloading: 'Downloading...',
  uploading: 'Uploading...', compiling: 'Compiling assets...', installing: 'Installing packages...',
  searching: 'Searching the codebase...', calculating: 'Crunching numbers...', analyzing: 'Analyzing patterns...',
  reviewing: 'Reviewing changes...', building: 'Building project...', fixing: 'Applying the fix...',
  refactoring: 'Refactoring elegantly...', committing: 'Committing changes...', pushing: 'Pushing to remote...',
  pulling: 'Pulling latest...', merging: 'Merging branches...', branching: 'Creating new branch...',
  'rolling-back': 'Rolling back changes...', monitoring: 'Monitoring systems...', profiling: 'Profiling performance...',
  benchmarking: 'Running benchmarks...', yawning: 'Pardon me... *yawn*', sneezing: 'A-ACHOO! Pardon!',
  coughing: '*ahem* Excuse me', shivering: 'B-b-brr... quite chilly', sweating: 'Getting rather warm...',
  dizzy: 'The room is spinning...', fainting: 'I feel... faint...', 'stretching-out': 'A good stretch...',
  nodding: 'Indeed, sir', 'shaking-head': 'I think not, sir', facepalm: 'Oh dear...',
  saluting: 'At your command, sir', clapping: 'Bravo! Well done!', 'thumbs-up': 'Splendid work, sir!',
  pointing: 'Right this way, sir', shrugging: 'I cannot say, sir', flexing: 'In peak form, sir!',
  meditating: 'Finding inner peace...', praying: 'A moment of grace...', 'bowing-deep': 'At your humble service',
  sarcastic: 'Oh, how original...', smirking: 'If I may say so...', winking: 'Between you and me...',
  'eye-rolling': 'If you insist, sir...', skeptical: 'Are you quite certain?', suspicious: 'Something seems off...',
  intrigued: 'Quite fascinating...', fascinated: 'Remarkable, sir!', impressed: 'Most impressive!',
  disappointed: 'I expected better, sir', apologetic: 'My sincerest apologies', pleading: 'Please, I implore you',
  commanding: 'Attention, if you please', reassuring: 'All shall be well, sir', encouraging: 'You can do this, sir!',
  loading: 'Loading, please wait...', syncing: 'Synchronizing...', 'error-critical': 'CRITICAL FAILURE!',
  warning: 'Caution advised, sir', success: 'Mission accomplished!', pending: 'Awaiting response...',
  processing: 'Processing request...', queued: 'In the queue, sir...', timeout: 'Request timed out...',
  'rate-limited': 'Throttled... patience, sir',
}

// -- Extended Emote Configs (data-driven rendering for 100 new emotes) --------

const EMOTE_CONFIG = {
  grateful: { eyeScale: 0.7, pupilR: 3.5, eyeDir: {x:0,y:1}, browType: 'normal', bodyAnim: 'bow', joyful: true, effects: {sparkles:true}, mouthOpen: false },
  amused: { eyeScale: 0.8, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'bounce', joyful: true, effects: {}, mouthOpen: false },
  determined: { eyeScale: 0.8, pupilR: 2.5, eyeDir: {x:0,y:0}, browType: 'error', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  hopeful: { eyeScale: 1.2, pupilR: 3.5, eyeDir: {x:0,y:-2}, browType: 'surprised', bodyAnim: 'float', joyful: false, effects: {sparkles:true}, mouthOpen: false },
  relieved: { eyeScale: 0.6, pupilR: 3, eyeDir: {x:0,y:1}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  content: { eyeScale: 0.7, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  nostalgic: { eyeScale: 0.7, pupilR: 3.5, eyeDir: {x:-2,y:-2}, browType: 'sad', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  jealous: { eyeScale: 0.8, pupilR: 2.5, eyeDir: {x:2,y:0}, browType: 'error', bodyAnim: 'fidget', joyful: false, effects: {}, mouthOpen: false },
  guilty: { eyeScale: 0.7, pupilR: 2.5, eyeDir: {x:-1,y:2}, browType: 'sad', bodyAnim: 'fidget', joyful: false, effects: {}, mouthOpen: false },
  ashamed: { eyeScale: 0.5, pupilR: 2, eyeDir: {x:0,y:3}, browType: 'sad', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  embarrassed: { eyeScale: 0.6, pupilR: 2.5, eyeDir: {x:2,y:1}, browType: 'confused', bodyAnim: 'fidget', joyful: false, effects: {}, mouthOpen: false },
  disgusted: { eyeScale: 0.6, pupilR: 2, eyeDir: {x:-1,y:-1}, browType: 'error', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  contempt: { eyeScale: 0.8, pupilR: 2.5, eyeDir: {x:2,y:-1}, browType: 'think', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  adoring: { eyeScale: 1.0, pupilR: 4.5, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'float', joyful: true, effects: {sparkles:true}, mouthOpen: false },
  longing: { eyeScale: 0.9, pupilR: 3.5, eyeDir: {x:3,y:-1}, browType: 'sad', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  melancholy: { eyeScale: 0.7, pupilR: 3, eyeDir: {x:-1,y:2}, browType: 'sad', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  euphoric: { eyeScale: 1.4, pupilR: 4, eyeDir: {x:0,y:0}, browType: 'surprised', bodyAnim: 'celebrate', joyful: true, effects: {sparkles:true}, mouthOpen: true },
  serene: { eyeScale: 0.5, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  anxious: { eyeScale: 1.1, pupilR: 2, eyeDir: 'dart', browType: 'confused', bodyAnim: 'fidget', joyful: false, effects: {}, mouthOpen: false },
  panicked: { eyeScale: 1.4, pupilR: 2, eyeDir: 'dart', browType: 'surprised', bodyAnim: 'shake', joyful: false, effects: {}, mouthOpen: true },
  terrified: { eyeScale: 1.4, pupilR: 1.5, eyeDir: {x:0,y:0}, browType: 'surprised', bodyAnim: 'shake', joyful: false, effects: {}, mouthOpen: true },
  furious: { eyeScale: 0.7, pupilR: 2, eyeDir: {x:0,y:0}, browType: 'error', bodyAnim: 'shake', joyful: false, effects: {}, mouthOpen: true },
  enraged: { eyeScale: 0.6, pupilR: 2, eyeDir: {x:0,y:0}, browType: 'error', bodyAnim: 'shake', joyful: false, effects: {}, mouthOpen: true },
  devastated: { eyeScale: 1.2, pupilR: 3.5, eyeDir: {x:0,y:3}, browType: 'sad', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  heartbroken: { eyeScale: 0.9, pupilR: 3, eyeDir: {x:0,y:2}, browType: 'sad', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  ecstatic: { eyeScale: 1.3, pupilR: 4, eyeDir: {x:0,y:0}, browType: 'surprised', bodyAnim: 'celebrate', joyful: true, effects: {sparkles:true}, mouthOpen: false },
  blissful: { eyeScale: 0.5, pupilR: 3.5, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'float', joyful: true, effects: {sparkles:true}, mouthOpen: false },
  gloomy: { eyeScale: 0.6, pupilR: 2.5, eyeDir: {x:0,y:2}, browType: 'sad', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  grumpy: { eyeScale: 0.7, pupilR: 2.5, eyeDir: {x:0,y:0}, browType: 'error', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  irritated: { eyeScale: 0.8, pupilR: 2.5, eyeDir: {x:0,y:0}, browType: 'error', bodyAnim: 'fidget', joyful: false, effects: {}, mouthOpen: false },
  coding: { eyeScale: 1.0, pupilR: 2.5, eyeDir: {x:0,y:2}, browType: 'normal', bodyAnim: 'reading', joyful: false, effects: {}, mouthOpen: false },
  debugging: { eyeScale: 0.8, pupilR: 2.5, eyeDir: {x:1,y:2}, browType: 'think', bodyAnim: 'reading', joyful: false, effects: {thinkDots:true}, mouthOpen: false },
  deploying: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:-2}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {sparkles:true}, mouthOpen: false },
  testing: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:1}, browType: 'normal', bodyAnim: 'reading', joyful: false, effects: {}, mouthOpen: false },
  researching: { eyeScale: 1.1, pupilR: 3, eyeDir: {x:-2,y:-1}, browType: 'think', bodyAnim: 'reading', joyful: false, effects: {thinkDots:true}, mouthOpen: false },
  downloading: { eyeScale: 0.9, pupilR: 3, eyeDir: {x:0,y:2}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  uploading: { eyeScale: 0.9, pupilR: 3, eyeDir: {x:0,y:-3}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  compiling: { eyeScale: 0.9, pupilR: 2.5, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'fidget', joyful: false, effects: {thinkDots:true}, mouthOpen: false },
  installing: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:1}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  searching: { eyeScale: 1.0, pupilR: 2.5, eyeDir: {x:2,y:-1}, browType: 'think', bodyAnim: 'reading', joyful: false, effects: {}, mouthOpen: false },
  calculating: { eyeScale: 1.0, pupilR: 2, eyeDir: {x:-1,y:-2}, browType: 'think', bodyAnim: 'float', joyful: false, effects: {thinkDots:true}, mouthOpen: false },
  analyzing: { eyeScale: 1.0, pupilR: 2.5, eyeDir: {x:0,y:1}, browType: 'think', bodyAnim: 'reading', joyful: false, effects: {thinkDots:true}, mouthOpen: false },
  reviewing: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:1,y:1}, browType: 'normal', bodyAnim: 'reading', joyful: false, effects: {}, mouthOpen: false },
  building: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'bounce', joyful: false, effects: {}, mouthOpen: false },
  fixing: { eyeScale: 0.9, pupilR: 2.5, eyeDir: {x:0,y:2}, browType: 'think', bodyAnim: 'reading', joyful: false, effects: {}, mouthOpen: false },
  refactoring: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:-1,y:1}, browType: 'think', bodyAnim: 'reading', joyful: false, effects: {thinkDots:true}, mouthOpen: false },
  committing: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  pushing: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:-2}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {sparkles:true}, mouthOpen: false },
  pulling: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:2}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  merging: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  branching: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:2,y:-1}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  'rolling-back': { eyeScale: 0.9, pupilR: 2.5, eyeDir: {x:0,y:0}, browType: 'confused', bodyAnim: 'fidget', joyful: false, effects: {}, mouthOpen: false },
  monitoring: { eyeScale: 1.1, pupilR: 2.5, eyeDir: {x:1,y:0}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  profiling: { eyeScale: 1.0, pupilR: 2, eyeDir: {x:-1,y:1}, browType: 'think', bodyAnim: 'reading', joyful: false, effects: {thinkDots:true}, mouthOpen: false },
  benchmarking: { eyeScale: 1.0, pupilR: 2.5, eyeDir: {x:0,y:1}, browType: 'normal', bodyAnim: 'reading', joyful: false, effects: {}, mouthOpen: false },
  yawning: { eyeScale: 0.3, pupilR: 3.5, eyeDir: {x:0,y:0}, browType: 'sad', bodyAnim: 'stretch', joyful: false, effects: {}, mouthOpen: true },
  sneezing: { eyeScale: 0.06, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'surprised', bodyAnim: 'shake', joyful: false, effects: {}, mouthOpen: true },
  coughing: { eyeScale: 0.5, pupilR: 2.5, eyeDir: {x:0,y:1}, browType: 'normal', bodyAnim: 'shake', joyful: false, effects: {}, mouthOpen: true },
  shivering: { eyeScale: 0.7, pupilR: 2.5, eyeDir: {x:0,y:0}, browType: 'sad', bodyAnim: 'shake', joyful: false, effects: {}, mouthOpen: false },
  sweating: { eyeScale: 0.8, pupilR: 2.5, eyeDir: {x:-1,y:0}, browType: 'confused', bodyAnim: 'fidget', joyful: false, effects: {}, mouthOpen: false },
  dizzy: { eyeScale: 1.1, pupilR: 2, eyeDir: 'dart', browType: 'confused', bodyAnim: 'fidget', joyful: false, effects: {}, mouthOpen: false },
  fainting: { eyeScale: 0.2, pupilR: 4, eyeDir: {x:0,y:-2}, browType: 'sad', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: true },
  'stretching-out': { eyeScale: 0.3, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'stretch', joyful: false, effects: {}, mouthOpen: false },
  nodding: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:1}, browType: 'normal', bodyAnim: 'bounce', joyful: false, effects: {}, mouthOpen: false },
  'shaking-head': { eyeScale: 0.9, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'sad', bodyAnim: 'shake', joyful: false, effects: {}, mouthOpen: false },
  facepalm: { eyeScale: 0.06, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'sad', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  saluting: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  clapping: { eyeScale: 1.1, pupilR: 3.5, eyeDir: {x:0,y:0}, browType: 'surprised', bodyAnim: 'bounce', joyful: true, effects: {sparkles:true}, mouthOpen: false },
  'thumbs-up': { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'float', joyful: true, effects: {}, mouthOpen: false },
  pointing: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:3,y:0}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  shrugging: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'confused', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  flexing: { eyeScale: 0.8, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'bounce', joyful: true, effects: {}, mouthOpen: false },
  meditating: { eyeScale: 0.06, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  praying: { eyeScale: 0.06, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'sad', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  'bowing-deep': { eyeScale: 0.3, pupilR: 3, eyeDir: {x:0,y:3}, browType: 'normal', bodyAnim: 'bow', joyful: false, effects: {}, mouthOpen: false },
  sarcastic: { eyeScale: 0.8, pupilR: 2.5, eyeDir: {x:2,y:-1}, browType: 'think', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  smirking: { eyeScale: 0.9, pupilR: 3, eyeDir: {x:1,y:0}, browType: 'think', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  winking: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:1,y:0}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  'eye-rolling': { eyeScale: 0.9, pupilR: 2.5, eyeDir: {x:0,y:-3.5}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  skeptical: { eyeScale: 0.8, pupilR: 2.5, eyeDir: {x:1,y:0}, browType: 'think', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  suspicious: { eyeScale: 0.6, pupilR: 2, eyeDir: {x:2,y:0}, browType: 'error', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  intrigued: { eyeScale: 1.2, pupilR: 3.5, eyeDir: {x:0,y:-1}, browType: 'think', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  fascinated: { eyeScale: 1.3, pupilR: 4, eyeDir: {x:0,y:-1}, browType: 'surprised', bodyAnim: 'float', joyful: false, effects: {sparkles:true}, mouthOpen: false },
  impressed: { eyeScale: 1.2, pupilR: 3.5, eyeDir: {x:0,y:0}, browType: 'surprised', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  disappointed: { eyeScale: 0.7, pupilR: 2.5, eyeDir: {x:0,y:2}, browType: 'sad', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  apologetic: { eyeScale: 0.8, pupilR: 3.5, eyeDir: {x:-1,y:1}, browType: 'sad', bodyAnim: 'bow', joyful: false, effects: {}, mouthOpen: false },
  pleading: { eyeScale: 1.3, pupilR: 4.5, eyeDir: {x:0,y:-1}, browType: 'sad', bodyAnim: 'fidget', joyful: false, effects: {}, mouthOpen: false },
  commanding: { eyeScale: 1.0, pupilR: 2.5, eyeDir: {x:0,y:0}, browType: 'error', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  reassuring: { eyeScale: 0.9, pupilR: 3.5, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  encouraging: { eyeScale: 1.1, pupilR: 3.5, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'bounce', joyful: true, effects: {sparkles:true}, mouthOpen: false },
  loading: { eyeScale: 0.9, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'fidget', joyful: false, effects: {thinkDots:true}, mouthOpen: false },
  syncing: { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'fidget', joyful: false, effects: {}, mouthOpen: false },
  'error-critical': { eyeScale: 1.4, pupilR: 2, eyeDir: {x:0,y:0}, browType: 'error', bodyAnim: 'shake', joyful: false, effects: {}, mouthOpen: true },
  warning: { eyeScale: 1.1, pupilR: 2.5, eyeDir: {x:0,y:0}, browType: 'error', bodyAnim: 'fidget', joyful: false, effects: {}, mouthOpen: false },
  success: { eyeScale: 1.1, pupilR: 3.5, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'celebrate', joyful: true, effects: {sparkles:true}, mouthOpen: false },
  pending: { eyeScale: 0.9, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'fidget', joyful: false, effects: {thinkDots:true}, mouthOpen: false },
  processing: { eyeScale: 1.0, pupilR: 2.5, eyeDir: {x:-1,y:0}, browType: 'normal', bodyAnim: 'reading', joyful: false, effects: {thinkDots:true}, mouthOpen: false },
  queued: { eyeScale: 0.8, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  timeout: { eyeScale: 0.7, pupilR: 2.5, eyeDir: {x:0,y:2}, browType: 'sad', bodyAnim: 'float', joyful: false, effects: {}, mouthOpen: false },
  'rate-limited': { eyeScale: 0.8, pupilR: 2.5, eyeDir: {x:0,y:0}, browType: 'confused', bodyAnim: 'fidget', joyful: false, effects: {}, mouthOpen: false },
}

// -- State --------------------------------------------------------------------

const S = {
  emotion: 'idle',
  behavior: 'idle',
  behaviorTimer: 0,
  direction: 1,
  isBlinking: false,
  lookX: 0,
  lookY: 0,
  mouthPhase: 0,
  walkOffset: 0,
  externalEmotion: null,
  externalTimer: 0,
  lastInteraction: Date.now(),
  isSleeping: false,
  pendingCount: 0,
  soundEnabled: true,
  voiceEnabled: false,
}

// Approval queue (shown in bubble)
let approvalQueue = []
let activeSessions = []
let selectedSessionId = null
let customAvatar = null  // { id, name, states: { idle: 'file://...', ... } }

// -- DOM refs -----------------------------------------------------------------

const $ = (id) => document.getElementById(id)

let el = {}

// -- SSE connection -----------------------------------------------------------

let eventSource = null

function connectSSE() {
  if (eventSource) {
    try { eventSource.close() } catch {}
  }

  eventSource = new EventSource(apiUrl('/mobile/events'))

  eventSource.onopen = () => {
    console.log('[SSE] Connected')
    el.connectionStatus.style.display = 'none'
  }

  eventSource.onerror = () => {
    console.log('[SSE] Connection error')
    el.connectionStatus.style.display = ''
  }

  // Init event — full state snapshot
  eventSource.addEventListener('init', (e) => {
    const data = JSON.parse(e.data)
    console.log('[SSE] init', data)

    if (data.sessions) {
      activeSessions = data.sessions
      updateSessionSelect()
    }

    if (data.approvals) {
      approvalQueue = data.approvals
      if (approvalQueue.length > 0) showCurrentApproval()
    }

    if (data.settings) {
      S.soundEnabled = data.settings.sound !== false
      S.voiceEnabled = data.settings.voice === true
      el.settingSound.checked = S.soundEnabled
      el.settingVoice.checked = S.voiceEnabled
    }

    if (data.emotion) {
      setExternalEmotion(data.emotion.emotion, data.emotion.text)
    }
  })

  // Emotion updates
  eventSource.addEventListener('emotion-update', (e) => {
    const data = JSON.parse(e.data)
    setExternalEmotion(data.emotion, data.text)
  })

  // Session list updates
  eventSource.addEventListener('sessions-updated', (e) => {
    const list = JSON.parse(e.data)
    activeSessions = list
    updateSessionSelect()
    // Auto-select the most recently active session if none selected
    if (!selectedSessionId && list.length > 0) {
      const sorted = [...list].sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0))
      selectedSessionId = sorted[0].id
      el.sessionSelect.value = selectedSessionId
      console.log('[sessions] Auto-selected:', selectedSessionId, sessionDisplayName(sorted[0]))
    }
  })

  // Approval count badge
  eventSource.addEventListener('approval-count', (e) => {
    const count = JSON.parse(e.data)
    S.pendingCount = count
    updateBadge()
  })

  // New approval -> show in bubble + speak
  eventSource.addEventListener('new-approval', (e) => {
    const data = JSON.parse(e.data)
    approvalQueue.push(data)
    showCurrentApproval()
  })

  // Approvals list updated (after approve/deny)
  eventSource.addEventListener('approvals-updated', (e) => {
    const list = JSON.parse(e.data)
    approvalQueue = list
    if (approvalQueue.length > 0) {
      showCurrentApproval()
    } else {
      hideBubble()
    }
  })

  // Notification sound/voice trigger
  eventSource.addEventListener('notify-approval', (e) => {
    const data = JSON.parse(e.data)
    if (data.taskDone) {
      playCompletionSound()
    } else {
      playNotificationSound()
      const name = data.sessionName || 'a session'
      sebastianSay(`Sir, ${name} needs your approval.`)
    }
  })

  // Session response (from chat or completion) -> show in bubble + speak it
  eventSource.addEventListener('session-response', (e) => {
    const data = JSON.parse(e.data)
    const text = (data.response || '').trim()
    if (!text) return

    if (data.isCompletion) {
      // Task completion -- show briefly in bubble
      showResponseBubble(text, data.sessionId)
      return // voice event handles the speech separately
    }

    showResponseBubble(text, data.sessionId)
    // Speak a short summary -- don't read full errors
    if (text.startsWith('Error:') || text.startsWith('error:') || text.includes('Error:')) {
      sebastianSay('An error occurred, sir. Please check the details.')
    } else {
      const spoken = text.length > 120 ? text.slice(0, 120) + '...' : text
      sebastianSay(spoken)
    }
  })

  // Voice events from server
  eventSource.addEventListener('voice-event', (e) => {
    const text = JSON.parse(e.data)
    console.log('[voice-event received]', text)
    sebastianSay(text)
  })

  // Setting changed (from desktop or another client)
  eventSource.addEventListener('setting-changed', (e) => {
    const data = JSON.parse(e.data)
    if (data.sound !== undefined) { S.soundEnabled = data.sound; el.settingSound.checked = data.sound }
    if (data.voice !== undefined) { S.voiceEnabled = data.voice; el.settingVoice.checked = data.voice }
  })
}

// -- Init ---------------------------------------------------------------------

async function init() {
  el = {
    character: $('character'),
    bodyGroup: $('body-group'),
    breatheGroup: $('breathe-group'),
    glow: $('glow'),
    shadow: $('shadow'),
    core: $('core'),
    leftEye: $('left-eye'),
    rightEye: $('right-eye'),
    leftIrisGroup: $('left-iris-group'),
    rightIrisGroup: $('right-iris-group'),
    leftPupil: $('left-pupil'),
    rightPupil: $('right-pupil'),
    leftCrescent: $('left-crescent'),
    rightCrescent: $('right-crescent'),
    leftEyeClosed: $('left-eye-closed'),
    rightEyeClosed: $('right-eye-closed'),
    leftBlush: $('left-blush'),
    rightBlush: $('right-blush'),
    mouth: $('mouth'),
    mouthOpen: $('mouth-open'),
    errorBrows: $('error-brows'),
    thinkBrows: $('think-brows'),
    normalBrows: $('normal-brows'),
    leftFoot: $('left-foot'),
    rightFoot: $('right-foot'),
    leftArm: $('left-arm'),
    rightArm: $('right-arm'),
    thinkingDots: $('thinking-dots'),
    sleepingZzz: $('sleeping-zzz'),
    sparkles: $('sparkles'),
    particles: $('particles'),
    statusDot: $('status-dot'),
    statusMood: $('status-mood'),
    notifBadge: $('notif-badge'),
    notifCount: $('notif-count'),
    bubble: $('bubble'),
    bubbleTool: $('bubble-tool'),
    bubbleCmd: $('bubble-cmd'),
    bubbleMeta: $('bubble-meta'),
    bubbleApprove: $('bubble-approve'),
    bubbleDeny: $('bubble-deny'),
    bubbleCount: $('bubble-count'),
    chatInput: $('chat-input'),
    chatSend: $('chat-send'),
    chatMic: $('chat-mic'),
    sessionSelect: $('session-select'),
    bubbleLabel: $('bubble-label'),
    bubbleActions: $('bubble-actions'),
    bubbleDismiss: $('bubble-dismiss'),
    bubbleQuestion: $('bubble-question'),
    bubbleApproveAllBtn: $('bubble-approve-all-btn'),
    customAvatarWrap: $('custom-avatar'),
    customAvatarImg: $('custom-avatar-img'),
    sadBrows: $('sad-brows'),
    surprisedBrows: $('surprised-brows'),
    confusedBrows: $('confused-brows'),
    settingsBtn: $('settings-btn'),
    settingsPopover: $('settings-popover'),
    settingSound: $('setting-sound'),
    settingVoice: $('setting-voice'),
    connectionStatus: $('connection-status'),
  }

  // iOS AudioContext requires user gesture -- create on first touch
  setupAudioContextUnlock()

  // Events
  setupClick()
  setupChat()
  setupBubbleActions()
  setupSettings()
  setupTouchTracking()
  initVoice()

  // Load initial settings
  try {
    const res = await fetch(apiUrl('/mobile/settings'))
    if (res.ok) {
      const savedSettings = await res.json()
      S.soundEnabled = savedSettings.sound !== false
      S.voiceEnabled = savedSettings.voice === true
      el.settingSound.checked = S.soundEnabled
      el.settingVoice.checked = S.voiceEnabled
    }
  } catch (err) {
    console.log('[init] Failed to load settings:', err)
  }

  // Load initial sessions
  try {
    const res = await fetch(apiUrl('/mobile/sessions'))
    if (res.ok) {
      activeSessions = await res.json()
      updateSessionSelect()
    }
  } catch (err) {
    console.log('[init] Failed to load sessions:', err)
  }

  // Connect SSE for real-time updates
  connectSSE()

  // Start
  pickBehavior()
  scheduleBlink()
  requestAnimationFrame(loop)
}

// -- iOS AudioContext unlock --------------------------------------------------

let audioContextUnlocked = false

function setupAudioContextUnlock() {
  const unlock = () => {
    if (audioContextUnlocked) return
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const buf = ctx.createBuffer(1, 1, 22050)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      src.start(0)
      ctx.resume().then(() => {
        audioContextUnlocked = true
        console.log('[audio] AudioContext unlocked via user gesture')
      })
    } catch {}
  }

  document.addEventListener('touchstart', unlock, { once: true })
  document.addEventListener('click', unlock, { once: true })
}

// -- Main loop ----------------------------------------------------------------

let lastTime = 0

function loop(time) {
  const dt = time - lastTime
  lastTime = time

  updateBehavior(dt)
  updateMouth(dt)
  updateSleep()
  render()

  requestAnimationFrame(loop)
}

// -- Behavior system ----------------------------------------------------------

function updateBehavior(dt) {
  if (S.externalEmotion) {
    S.externalTimer -= dt
    if (S.externalTimer <= 0) {
      S.externalEmotion = null
      S.emotion = behaviorEmotion(S.behavior)
    }
    return
  }

  S.behaviorTimer -= dt
  if (S.behaviorTimer <= 0) {
    pickBehavior()
  }

  if (S.behavior === 'walking') {
    moveWindow()
  }
}

function pickBehavior() {
  if (S.isSleeping) {
    S.behavior = 'sleeping'
    S.emotion = 'sleeping'
    S.behaviorTimer = 999999
    return
  }

  // When approvals pending -> stay in place, alert mode
  if (S.pendingCount > 0) {
    setBehavior('alert', rand(2000, 4000))
    return
  }

  const r = Math.random()
  if (r < 0.40) {
    setBehavior('idle', rand(IDLE_MIN, IDLE_MAX))
  } else if (r < 0.48) {
    S.direction = Math.random() < 0.5 ? -1 : 1
    setBehavior('walking', rand(WALK_MIN, WALK_MAX))
  } else if (r < 0.62) {
    setBehavior('looking', rand(LOOK_MIN, LOOK_MAX))
  } else if (r < 0.70) {
    setBehavior('hop', 500)
  } else if (r < 0.76) {
    setBehavior('wave', 1800)
  } else if (r < 0.82) {
    setBehavior('fidget', rand(1500, 3000))
  } else if (r < 0.87) {
    setBehavior('stretch', 2000)
  } else if (r < 0.91) {
    setBehavior('bow', 1500)
  } else if (r < 0.95) {
    setBehavior('reading', rand(3000, 6000))
  } else {
    setBehavior('celebrate', 2500)
  }
}

function setBehavior(behavior, duration) {
  S.behavior = behavior
  S.behaviorTimer = duration
  if (!S.externalEmotion) {
    S.emotion = behaviorEmotion(behavior)
  }
}

function behaviorEmotion(behavior) {
  switch (behavior) {
    case 'walking': return 'idle'
    case 'looking': return 'listening'
    case 'hop': return 'excited'
    case 'wave': return 'happy'
    case 'alert': return 'thinking'
    case 'fidget': return 'bored'
    case 'stretch': return 'idle'
    case 'bow': return 'happy'
    case 'celebrate': return 'excited'
    case 'reading': return 'listening'
    default: return 'idle'
  }
}

// -- Walking (CSS transform instead of window move) ---------------------------

function moveWindow() {
  S.walkOffset += WALK_SPEED * S.direction

  const vw = window.innerWidth
  const charWidth = 200  // approximate character element width
  const maxOffset = (vw - charWidth) / 2

  if (S.walkOffset <= -maxOffset) {
    S.walkOffset = -maxOffset
    S.direction = 1
  } else if (S.walkOffset >= maxOffset) {
    S.walkOffset = maxOffset
    S.direction = -1
  }

  el.character.style.transform = `translateX(${S.walkOffset}px)`
}

// -- Sleep --------------------------------------------------------------------

function updateSleep() {
  if (S.externalEmotion) return
  if (S.pendingCount > 0) return  // Don't sleep with pending approvals
  const idle = Date.now() - S.lastInteraction
  if (idle > SLEEP_AFTER && !S.isSleeping) {
    S.isSleeping = true
    S.behavior = 'sleeping'
    S.emotion = 'sleeping'
    S.behaviorTimer = 999999
  }
}

function wake() {
  S.lastInteraction = Date.now()
  if (S.isSleeping) {
    S.isSleeping = false
    S.emotion = 'idle'
    S.behavior = 'idle'
    pickBehavior()
  }
}

// -- External emotion ---------------------------------------------------------

function setExternalEmotion(emotion, text) {
  if (!MOOD_LABEL[emotion] && !EMOTE_CONFIG[emotion] && !customAvatar) return
  wake()
  S.externalEmotion = emotion
  S.externalTimer = EXTERNAL_HOLD
  S.emotion = emotion
  if (text) {
    el.statusMood.textContent = text
  }
}

// -- Blink --------------------------------------------------------------------

function scheduleBlink() {
  setTimeout(() => {
    if (S.emotion !== 'sleeping') {
      S.isBlinking = true
      setTimeout(() => {
        S.isBlinking = false
        scheduleBlink()
      }, BLINK_DURATION + Math.random() * 50)
    } else {
      scheduleBlink()
    }
  }, rand(BLINK_MIN, BLINK_MAX))
}

// -- Mouth (speaking) ---------------------------------------------------------

let mouthInterval = null

function updateMouth() {
  if (S.emotion === 'speaking' && !mouthInterval) {
    mouthInterval = setInterval(() => {
      S.mouthPhase = (S.mouthPhase + 1) % 3
    }, SPEAK_MOUTH_SPEED + Math.random() * 50)
  } else if (S.emotion !== 'speaking' && mouthInterval) {
    clearInterval(mouthInterval)
    mouthInterval = null
    S.mouthPhase = 0
  }
}

// -- Render -------------------------------------------------------------------

function render() {
  const e = S.emotion
  const joyful = e === 'happy' || e === 'excited' || e === 'proud'
  const asleep = e === 'sleeping'
  const alerting = S.behavior === 'alert'

  // Emotion -> glow color map
  const GLOW_MAP = {
    error: '#ff7b72', angry: '#ff7b72',
    happy: '#3fb950', excited: '#3fb950', proud: '#3fb950',
    sleeping: '#6b7280', bored: '#6b7280',
    sad: '#6b9cc8',
    surprised: '#fbbf24', nervous: '#fbbf24',
    confused: '#a78bfa',
    // -- Extended emotes (100) --
    grateful: '#3fb950', amused: '#3fb950', determined: '#f97316', hopeful: '#38bdf8',
    relieved: '#34d399', content: '#34d399', nostalgic: '#a78bfa', jealous: '#84cc16',
    guilty: '#6b9cc8', ashamed: '#fb7185', embarrassed: '#f472b6', disgusted: '#84cc16',
    contempt: '#a78bfa', adoring: '#f472b6', longing: '#818cf8', melancholy: '#6b9cc8',
    euphoric: '#f59e0b', serene: '#2dd4bf', anxious: '#fbbf24', panicked: '#ff7b72',
    terrified: '#ff7b72', furious: '#ff7b72', enraged: '#ff7b72', devastated: '#6b9cc8',
    heartbroken: '#fb7185', ecstatic: '#f59e0b', blissful: '#f472b6', gloomy: '#6b7280',
    grumpy: '#f97316', irritated: '#f97316',
    coding: '#2dd4bf', debugging: '#f97316', deploying: '#34d399', testing: '#fbbf24',
    researching: '#818cf8', downloading: '#38bdf8', uploading: '#38bdf8', compiling: '#fbbf24',
    installing: '#2dd4bf', searching: '#818cf8', calculating: '#818cf8', analyzing: '#a78bfa',
    reviewing: '#2dd4bf', building: '#f97316', fixing: '#f59e0b', refactoring: '#a78bfa',
    committing: '#3fb950', pushing: '#34d399', pulling: '#38bdf8', merging: '#a78bfa',
    branching: '#84cc16', 'rolling-back': '#f59e0b', monitoring: '#22d3ee', profiling: '#818cf8',
    benchmarking: '#f97316',
    yawning: '#6b7280', sneezing: '#fbbf24', coughing: '#f59e0b', shivering: '#38bdf8',
    sweating: '#f59e0b', dizzy: '#a78bfa', fainting: '#6b7280', 'stretching-out': '#22d3ee',
    nodding: '#3fb950', 'shaking-head': '#ff7b72', facepalm: '#f97316', saluting: '#22d3ee',
    clapping: '#3fb950', 'thumbs-up': '#3fb950', pointing: '#22d3ee', shrugging: '#6b7280',
    flexing: '#f97316', meditating: '#2dd4bf', praying: '#f59e0b', 'bowing-deep': '#22d3ee',
    sarcastic: '#a78bfa', smirking: '#a78bfa', winking: '#f472b6', 'eye-rolling': '#6b7280',
    skeptical: '#fbbf24', suspicious: '#f59e0b', intrigued: '#818cf8', fascinated: '#818cf8',
    impressed: '#3fb950', disappointed: '#6b9cc8', apologetic: '#6b9cc8', pleading: '#fb7185',
    commanding: '#f97316', reassuring: '#34d399', encouraging: '#3fb950',
    loading: '#22d3ee', syncing: '#38bdf8', 'error-critical': '#ff7b72', warning: '#f59e0b',
    success: '#34d399', pending: '#6b7280', processing: '#22d3ee', queued: '#6b7280',
    timeout: '#ff7b72', 'rate-limited': '#f59e0b',
  }

  // Custom avatar mode -- just swap image + animation, skip SVG rendering
  if (customAvatar) {
    updateCustomAvatarImage()
    const statusColor = e === 'error' || e === 'angry' ? '#ff7b72' : asleep ? '#6b7280' : alerting ? '#fbbf24' : '#22d3ee'
    el.statusDot.style.background = statusColor
    el.statusDot.style.boxShadow = asleep ? 'none' : `0 0 6px ${statusColor}40`
    if (!S.externalEmotion || !el.statusMood.textContent || el.statusMood.textContent === MOOD_LABEL[e]) {
      el.statusMood.textContent = MOOD_LABEL[e] || 'Ready'
    }
    return
  }

  // -- Data-driven emote handling for extended emotes --
  const emoteConfig = EMOTE_CONFIG[e]
  if (emoteConfig) {
    // Body animation
    const bg = el.bodyGroup
    bg.classList.remove('float', 'bounce', 'shake', 'hop', 'walk', 'alert-bounce', 'fidget', 'stretch', 'bow', 'celebrate', 'reading')
    if (alerting) bg.classList.add('alert-bounce')
    else bg.classList.add(emoteConfig.bodyAnim || 'float')

    // Walking direction (reset)
    el.character.style.transform = S.walkOffset !== 0 ? `translateX(${S.walkOffset}px)` : ''
    el.leftFoot.classList.toggle('walk-left-foot', false)
    el.rightFoot.classList.toggle('walk-right-foot', false)

    // Arm wave for joyful or celebrate
    el.rightArm.classList.toggle('wave-arm', alerting || emoteConfig.bodyAnim === 'celebrate' || emoteConfig.joyful)

    // Eye visibility (always show for config emotes)
    el.leftEye.style.display = ''
    el.rightEye.style.display = ''
    el.leftEyeClosed.style.display = 'none'
    el.rightEyeClosed.style.display = 'none'

    // Eye scale
    let scY = S.isBlinking ? 0.06 : emoteConfig.eyeScale
    el.leftEye.style.transform = `scaleY(${scY})`
    el.rightEye.style.transform = `scaleY(${scY})`
    el.leftEye.style.transition = 'transform 0.1s ease-out'
    el.rightEye.style.transition = 'transform 0.1s ease-out'

    // Pupil
    el.leftPupil.setAttribute('r', emoteConfig.pupilR)
    el.rightPupil.setAttribute('r', emoteConfig.pupilR)

    // Eye direction
    let lx, ly
    if (emoteConfig.eyeDir === 'dart') {
      lx = Math.sin(Date.now() / 200) * 3; ly = 0
    } else {
      lx = emoteConfig.eyeDir.x; ly = emoteConfig.eyeDir.y
    }
    el.leftIrisGroup.style.transform = `translate(${lx}px, ${ly}px)`
    el.rightIrisGroup.style.transform = `translate(${lx}px, ${ly}px)`
    el.leftIrisGroup.style.transition = emoteConfig.eyeDir === 'dart' ? 'none' : 'transform 0.25s ease-out'
    el.rightIrisGroup.style.transition = emoteConfig.eyeDir === 'dart' ? 'none' : 'transform 0.25s ease-out'

    // Brows
    const allBrows = [el.normalBrows, el.errorBrows, el.thinkBrows, el.sadBrows, el.surprisedBrows, el.confusedBrows]
    allBrows.forEach(b => { if (b) b.style.display = 'none' })
    const browMap = { normal: el.normalBrows, error: el.errorBrows, think: el.thinkBrows, sad: el.sadBrows, surprised: el.surprisedBrows, confused: el.confusedBrows }
    const browEl = browMap[emoteConfig.browType] || el.normalBrows
    if (browEl) browEl.style.display = ''

    // Joyful effects
    el.leftCrescent.style.display = emoteConfig.joyful ? '' : 'none'
    el.rightCrescent.style.display = emoteConfig.joyful ? '' : 'none'
    const blushOp = emoteConfig.joyful ? 0.18 : 0.04
    el.leftBlush.setAttribute('opacity', blushOp)
    el.rightBlush.setAttribute('opacity', blushOp)

    // Mouth
    el.mouth.setAttribute('d', MOUTH[e] || MOUTH.idle)
    el.mouth.setAttribute('stroke', '#b08060')
    if (emoteConfig.mouthOpen) {
      el.mouthOpen.style.display = ''
      el.mouthOpen.setAttribute('opacity', '0.4')
    } else {
      el.mouthOpen.style.display = 'none'
    }

    // Effects
    el.thinkingDots.style.display = (emoteConfig.effects && emoteConfig.effects.thinkDots) ? '' : 'none'
    el.sleepingZzz.style.display = 'none'
    el.sparkles.style.display = (emoteConfig.effects && emoteConfig.effects.sparkles) ? '' : 'none'
    el.particles.style.display = ''

    // Glow color
    const glowColor = GLOW_MAP[e] || (alerting ? '#fbbf24' : '#22d3ee')
    $('glow-stop-0').setAttribute('stop-color', glowColor)
    $('glow-stop-1').setAttribute('stop-color', glowColor)
    $('glow-stop-2').setAttribute('stop-color', glowColor)
    el.core.setAttribute('fill', glowColor)

    // Status
    const statusColor = alerting ? '#fbbf24' : glowColor
    el.statusDot.style.background = statusColor
    el.statusDot.style.boxShadow = `0 0 6px ${statusColor}40`
    if (!S.externalEmotion || !el.statusMood.textContent || el.statusMood.textContent === MOOD_LABEL[e]) {
      el.statusMood.textContent = MOOD_LABEL[e] || 'Ready'
    }
    return
  }

  // Body animation class
  const bg = el.bodyGroup
  bg.classList.remove('float', 'bounce', 'shake', 'hop', 'walk', 'alert-bounce', 'fidget', 'stretch', 'bow', 'celebrate', 'reading')

  if (alerting) bg.classList.add('alert-bounce')
  else if (e === 'excited' || S.behavior === 'celebrate') bg.classList.add(S.behavior === 'celebrate' ? 'celebrate' : 'bounce')
  else if (e === 'error' || e === 'angry') bg.classList.add('shake')
  else if (S.behavior === 'hop') bg.classList.add('hop')
  else if (S.behavior === 'walking') bg.classList.add('walk')
  else if (S.behavior === 'fidget') bg.classList.add('fidget')
  else if (S.behavior === 'stretch') bg.classList.add('stretch')
  else if (S.behavior === 'bow') bg.classList.add('bow')
  else if (S.behavior === 'reading') bg.classList.add('reading')
  else bg.classList.add('float')

  // Walking direction (flip character via scaleX, but walking uses translateX for position)
  if (S.behavior === 'walking') {
    el.character.style.transform = `translateX(${S.walkOffset}px)` + (S.direction === -1 ? ' scaleX(-1)' : '')
    el.character.style.transformOrigin = '100px 100px'
  } else {
    el.character.style.transform = S.walkOffset !== 0 ? `translateX(${S.walkOffset}px)` : ''
  }

  // Foot animation
  el.leftFoot.classList.toggle('walk-left-foot', S.behavior === 'walking')
  el.rightFoot.classList.toggle('walk-right-foot', S.behavior === 'walking')

  // Arm wave -- wave during alert, wave behavior, celebrate, or joyful
  el.rightArm.classList.toggle('wave-arm', alerting || S.behavior === 'wave' || S.behavior === 'celebrate' || joyful)

  // Eye visibility
  const showEyes = !asleep
  el.leftEye.style.display = showEyes ? '' : 'none'
  el.rightEye.style.display = showEyes ? '' : 'none'
  el.leftEyeClosed.style.display = asleep ? '' : 'none'
  el.rightEyeClosed.style.display = asleep ? '' : 'none'

  // Blink
  if (showEyes) {
    let scY = S.isBlinking ? 0.06 : 1
    // Special eye shapes for emotions
    if (e === 'sad') scY = S.isBlinking ? 0.06 : 0.7
    else if (e === 'bored') scY = S.isBlinking ? 0.06 : 0.6
    else if (e === 'surprised') scY = S.isBlinking ? 0.06 : 1.2
    else if (e === 'angry') scY = S.isBlinking ? 0.06 : 0.8

    el.leftEye.style.transform = `scaleY(${scY})`
    el.rightEye.style.transform = `scaleY(${scY})`
    el.leftEye.style.transition = 'transform 0.1s ease-out'
    el.rightEye.style.transition = 'transform 0.1s ease-out'
  }

  // Eye look direction
  let lx = S.lookX, ly = S.lookY
  if (e === 'thinking') { lx = -2; ly = -3.5 }
  else if (joyful || e === 'error' || e === 'angry' || e === 'surprised') { lx = 0; ly = 0 }
  else if (e === 'nervous') { lx = Math.sin(Date.now() / 200) * 3; ly = 0 }
  else if (S.behavior === 'walking') { lx = S.direction * 2; ly = 0 }
  else if (S.behavior === 'looking' || S.behavior === 'reading') { lx = S.direction * 3; ly = S.behavior === 'reading' ? 2 : -1 }

  el.leftIrisGroup.style.transform = `translate(${lx}px, ${ly}px)`
  el.leftIrisGroup.style.transition = e === 'nervous' ? 'none' : 'transform 0.25s ease-out'
  el.rightIrisGroup.style.transform = `translate(${lx}px, ${ly}px)`
  el.rightIrisGroup.style.transition = e === 'nervous' ? 'none' : 'transform 0.25s ease-out'

  // Pupil size
  let pr = 3
  if (e === 'listening') pr = 4
  else if (e === 'surprised') pr = 2
  else if (e === 'angry') pr = 2.5
  el.leftPupil.setAttribute('r', pr)
  el.rightPupil.setAttribute('r', pr)

  // Happy crescents -- show for joyful emotions
  el.leftCrescent.style.display = joyful ? '' : 'none'
  el.rightCrescent.style.display = joyful ? '' : 'none'

  // Blush
  const blushOp = joyful ? 0.18 : e === 'nervous' ? 0.12 : 0.04
  el.leftBlush.setAttribute('opacity', blushOp)
  el.rightBlush.setAttribute('opacity', blushOp)

  // Mouth
  if (e === 'speaking') {
    el.mouth.setAttribute('d', MOUTH.speaking[S.mouthPhase])
    el.mouthOpen.style.display = S.mouthPhase === 1 ? '' : 'none'
    el.mouthOpen.setAttribute('opacity', S.mouthPhase === 1 ? '0.6' : '0')
  } else if (e === 'surprised') {
    el.mouth.setAttribute('d', MOUTH.surprised)
    el.mouthOpen.style.display = ''
    el.mouthOpen.setAttribute('opacity', '0.4')
  } else {
    el.mouth.setAttribute('d', MOUTH[e] || MOUTH.idle)
    el.mouthOpen.style.display = 'none'
  }
  el.mouth.setAttribute('stroke', asleep ? '#c8a880' : '#b08060')

  // Eyebrows -- determine which set to show
  const allBrows = [el.normalBrows, el.errorBrows, el.thinkBrows, el.sadBrows, el.surprisedBrows, el.confusedBrows]
  allBrows.forEach(b => { if (b) b.style.display = 'none' })

  if (e === 'error' || e === 'angry') el.errorBrows.style.display = ''
  else if (e === 'thinking' || e === 'nervous') el.thinkBrows.style.display = ''
  else if (e === 'sad') { if (el.sadBrows) el.sadBrows.style.display = '' }
  else if (e === 'surprised') { if (el.surprisedBrows) el.surprisedBrows.style.display = '' }
  else if (e === 'confused') { if (el.confusedBrows) el.confusedBrows.style.display = '' }
  else el.normalBrows.style.display = ''

  // Effects
  el.thinkingDots.style.display = e === 'thinking' ? '' : 'none'
  el.sleepingZzz.style.display = asleep ? '' : 'none'
  el.sparkles.style.display = (e === 'excited' || S.behavior === 'celebrate') ? '' : 'none'
  el.particles.style.display = asleep ? 'none' : ''

  // Glow color
  const glowColor = GLOW_MAP[e] || (alerting ? '#fbbf24' : '#22d3ee')
  $('glow-stop-0').setAttribute('stop-color', glowColor)
  $('glow-stop-1').setAttribute('stop-color', glowColor)
  $('glow-stop-2').setAttribute('stop-color', glowColor)

  // Core glow
  el.core.setAttribute('fill', glowColor)

  // Status
  const statusColor = (e === 'error' || e === 'angry') ? '#ff7b72' : asleep ? '#6b7280' : alerting ? '#fbbf24' : '#22d3ee'
  el.statusDot.style.background = statusColor
  el.statusDot.style.boxShadow = asleep ? 'none' : `0 0 6px ${statusColor}40`
  if (!S.externalEmotion || !el.statusMood.textContent || el.statusMood.textContent === MOOD_LABEL[e]) {
    el.statusMood.textContent = MOOD_LABEL[e] || 'Ready'
  }
}

// -- Notification Badge -------------------------------------------------------

function updateBadge() {
  if (S.pendingCount > 0) {
    el.notifBadge.style.display = ''
    el.notifCount.textContent = S.pendingCount > 9 ? '9+' : S.pendingCount
  } else {
    el.notifBadge.style.display = 'none'
  }
}

// -- Speech Bubble ------------------------------------------------------------

function showCurrentApproval() {
  if (approvalQueue.length === 0) {
    hideBubble()
    return
  }

  // Clear any response dismiss timer
  if (responseDismissTimer) { clearTimeout(responseDismissTimer); responseDismissTimer = null }

  const current = approvalQueue[0]
  const approvalSession = activeSessions.find(s => s.id === current.sessionId)
  const approvalName = approvalSession ? sessionDisplayName(approvalSession) : current.sessionId?.slice(0, 8)
  el.bubbleLabel.textContent = `${current.toolName} \u00b7 ${approvalName}`
  el.bubbleTool.textContent = current.toolName === 'Bash' ? 'Bash command' : `${current.toolName} operation`
  el.bubbleCmd.textContent = formatToolInput(current.toolName, current.toolInput)
  el.bubbleCmd.style.maxHeight = '60px'
  el.bubbleMeta.textContent = current.cwd ? current.cwd.replace(/^\/Users\/[^/]+/, '~') : ''
  el.bubbleQuestion.style.display = ''
  el.bubbleActions.style.display = ''
  el.bubbleDismiss.style.display = 'none'

  if (approvalQueue.length > 1) {
    el.bubbleCount.style.display = ''
    el.bubbleCount.textContent = `+${approvalQueue.length - 1} more`
  } else {
    el.bubbleCount.style.display = 'none'
  }

  el.bubble.style.display = ''

  // Auto-select the session this approval is from
  if (!selectedSessionId) {
    selectedSessionId = current.sessionId
    el.sessionSelect.value = selectedSessionId
  }
}

function hideBubble() {
  el.bubble.style.display = 'none'
}

function formatToolInput(toolName, input) {
  if (!input) return ''
  if (toolName === 'Bash' && input.command) return input.command
  if (input.file_path) return `${toolName}: ${input.file_path}`
  return JSON.stringify(input).slice(0, 100)
}

let responseDismissTimer = null

function showResponseBubble(text, sessionId) {
  // Clear any pending auto-dismiss
  if (responseDismissTimer) clearTimeout(responseDismissTimer)

  // Don't override pending approvals
  if (approvalQueue.length > 0) return

  const session = activeSessions.find(s => s.id === sessionId)
  const label = session ? sessionDisplayName(session) : 'session'
  el.bubbleLabel.textContent = `Response from ${label}`
  el.bubbleTool.textContent = ''
  el.bubbleCmd.textContent = text.slice(0, 300) + (text.length > 300 ? '...' : '')
  el.bubbleCmd.style.maxHeight = '80px'
  el.bubbleMeta.textContent = ''
  el.bubbleQuestion.style.display = 'none'
  el.bubbleActions.style.display = 'none'
  el.bubbleCount.style.display = 'none'
  el.bubbleDismiss.style.display = ''
  el.bubble.style.display = ''

  // Auto-dismiss after 12 seconds
  responseDismissTimer = setTimeout(() => {
    if (approvalQueue.length === 0) hideBubble()
  }, 12000)
}

function setupBubbleActions() {
  el.bubbleApprove.addEventListener('click', (e) => {
    e.stopPropagation()
    if (approvalQueue.length === 0) return
    const current = approvalQueue.shift()
    fetch(apiUrl('/mobile/approve'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: current.id })
    })
    sebastianSay('Yes, sir. Proceeding.')
    showCurrentApproval()
  })

  el.bubbleDeny.addEventListener('click', (e) => {
    e.stopPropagation()
    if (approvalQueue.length === 0) return
    const current = approvalQueue.shift()
    fetch(apiUrl('/mobile/deny'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: current.id, reason: 'Denied by user' })
    })
    sebastianSay('As you wish, sir. Denied.')
    showCurrentApproval()
  })

  el.bubbleDismiss.addEventListener('click', (e) => {
    e.stopPropagation()
    hideBubble()
  })

  el.bubbleApproveAllBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    fetch(apiUrl('/mobile/approve-all'), { method: 'POST' })
    approvalQueue = []
    hideBubble()
    sebastianSay('Very well, sir. All approved.')
  })

  // Click anywhere on bubble body to dismiss response (not approvals)
  el.bubble.querySelector('.bubble-body').addEventListener('click', (e) => {
    if (approvalQueue.length === 0 && el.bubbleActions.style.display === 'none') {
      hideBubble()
    }
  })
}

// -- Session Selector ---------------------------------------------------------

function sessionDisplayName(s) {
  if (s.title) {
    const t = s.title.length > 30 ? s.title.slice(0, 28) + '\u2026' : s.title
    return t
  }
  // Fallback: folder name, but skip if it's the home dir username
  if (s.cwd) {
    const folder = s.cwd.split('/').pop()
    // Detect home directory -- /Users/<name> on macOS
    const isHome = s.cwd.split('/').length <= 3 && s.cwd.startsWith('/Users/')
    if (folder && !isHome) return folder
  }
  // Last resort: short ID
  return s.id ? s.id.slice(0, 8) : '???'
}

function updateSessionSelect() {
  const prev = el.sessionSelect.value
  el.sessionSelect.innerHTML = '<option value="">No session</option>'

  for (const s of activeSessions) {
    const opt = document.createElement('option')
    opt.value = s.id
    opt.textContent = sessionDisplayName(s)
    if (s.id === prev || s.id === selectedSessionId) opt.selected = true
    el.sessionSelect.appendChild(opt)
  }

  // Keep selection valid
  if (prev && !activeSessions.find(s => s.id === prev)) {
    selectedSessionId = activeSessions.length ? activeSessions[0].id : null
    el.sessionSelect.value = selectedSessionId || ''
  }
}

// -- Chat Input ---------------------------------------------------------------

function setupChat() {
  el.chatSend.addEventListener('click', sendChat)
  el.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) sendChat()
  })
  el.sessionSelect.addEventListener('change', () => {
    selectedSessionId = el.sessionSelect.value || null
  })

  // Mic button -- click to toggle recording
  el.chatMic.addEventListener('click', (e) => {
    e.stopPropagation()
    startRecording()
  })
}

function sendChat() {
  const msg = el.chatInput.value.trim()
  if (!msg) { console.log('[sendChat] Empty message, ignoring'); return }

  const targetId = selectedSessionId || (activeSessions.length === 1 ? activeSessions[0].id : null)
  console.log('[sendChat] msg:', msg.slice(0, 60), 'targetId:', targetId, 'selectedSessionId:', selectedSessionId, 'sessions:', activeSessions.length)

  if (targetId) {
    fetch(apiUrl('/mobile/send-message'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: targetId, message: msg })
    })
    el.chatInput.value = ''
    const targetSession = activeSessions.find(s => s.id === targetId)
    const targetName = targetSession ? sessionDisplayName(targetSession) : 'session'
    console.log('[sendChat] Sent to:', targetName, targetId)
    el.statusMood.textContent = `Sent to ${targetName}...`
    sebastianSay('Delivering your message, sir.')
    setExternalEmotion('speaking', 'Delivering...')
  } else {
    console.log('[sendChat] No session selected!')
    el.statusMood.textContent = 'Select a session first'
    sebastianSay('No session selected, sir.')
  }
}

// -- Settings Popover ---------------------------------------------------------

function setupSettings() {
  const btn = el.settingsBtn
  const pop = el.settingsPopover

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const visible = pop.style.display !== 'none'
    pop.style.display = visible ? 'none' : ''
    btn.classList.toggle('active', !visible)
  })

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (pop.style.display !== 'none' && !pop.contains(e.target) && e.target !== btn) {
      pop.style.display = 'none'
      btn.classList.remove('active')
    }
  })

  // Toggle handlers
  el.settingSound.addEventListener('change', () => {
    S.soundEnabled = el.settingSound.checked
    fetch(apiUrl('/mobile/update-setting'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'sound', value: S.soundEnabled })
    })
  })

  el.settingVoice.addEventListener('change', () => {
    S.voiceEnabled = el.settingVoice.checked
    fetch(apiUrl('/mobile/update-setting'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'voice', value: S.voiceEnabled })
    })
  })

  // Show server URL in settings
  const serverUrlEl = document.getElementById('settings-server-url')
  if (serverUrlEl) serverUrlEl.textContent = SERVER_URL.replace(/^https?:\/\//, '')

  // Disconnect button
  document.getElementById('settings-disconnect').addEventListener('click', () => {
    if (eventSource) { try { eventSource.close() } catch {} }
    SERVER_URL = ''
    localStorage.removeItem('sebastian-last-server')
    document.getElementById('app-main').style.display = 'none'
    document.getElementById('connect-screen').style.display = ''
    pop.style.display = 'none'
    renderConnectionHistory()
  })
}

// -- Voice System -------------------------------------------------------------

let preferredVoice = null
let voiceReady = false

function initVoice() {
  const loadVoices = () => {
    const voices = speechSynthesis.getVoices()
    if (!voices.length) return false

    // Prefer a British English voice for the butler character
    preferredVoice =
      voices.find(v => v.lang === 'en-GB' && /daniel|james|arthur/i.test(v.name)) ||
      voices.find(v => v.lang === 'en-GB') ||
      voices.find(v => v.lang === 'en-AU') ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0]

    voiceReady = true
    console.log('[voice] ready, using:', preferredVoice?.name, preferredVoice?.lang)
    return true
  }

  if (loadVoices()) return
  speechSynthesis.onvoiceschanged = loadVoices

  // Mobile sometimes doesn't fire onvoiceschanged -- retry with polling
  let retries = 0
  const poll = setInterval(() => {
    retries++
    if (voiceReady || retries > 20) { clearInterval(poll); return }
    loadVoices()
  }, 500)
}

function sebastianSay(text) {
  if (!S.voiceEnabled) return
  if (!voiceReady) return

  // Cancel any ongoing speech to avoid overlap
  speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  if (preferredVoice) utterance.voice = preferredVoice
  utterance.rate = 1.0
  utterance.pitch = 0.85
  utterance.volume = 0.7

  // Sync mouth animation with speech
  utterance.onstart = () => {
    S.externalEmotion = 'speaking'
    S.externalTimer = 999999  // hold until speech ends
    S.emotion = 'speaking'
  }

  utterance.onend = () => {
    S.externalEmotion = null
    S.externalTimer = 0
    S.emotion = behaviorEmotion(S.behavior)
  }

  utterance.onerror = () => {
    S.externalEmotion = null
    S.externalTimer = 0
  }

  speechSynthesis.speak(utterance)
}

// -- Voice Input (getUserMedia + server transcription) ------------------------

let isRecording = false
let recordingCountdown = null
let mediaStream = null
let audioCtx = null
let audioProcessor = null
let audioChunks = []
let recordingAutoStop = null
let recordingStopFn = null

async function startRecording() {
  if (isRecording) {
    stopRecording()
    return
  }

  isRecording = true
  el.chatMic.classList.add('recording')
  el.chatInput.value = ''
  setExternalEmotion('listening', 'Listening...')

  // Countdown UI
  let remaining = 8
  el.chatInput.placeholder = `Speak now... (${remaining}s)`
  recordingCountdown = setInterval(() => {
    remaining--
    if (remaining > 0) {
      el.chatInput.placeholder = `Listening... (${remaining}s)`
    } else {
      el.chatInput.placeholder = 'Processing...'
      clearInterval(recordingCountdown)
      recordingCountdown = null
    }
  }, 1000)

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const source = audioCtx.createMediaStreamSource(mediaStream)
    audioProcessor = audioCtx.createScriptProcessor(4096, 1, 1)
    audioChunks = []

    audioProcessor.onaudioprocess = (e) => {
      audioChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
    }

    source.connect(audioProcessor)
    // Connect through silent gain so the processor fires without playing audio back
    const silentGain = audioCtx.createGain()
    silentGain.gain.value = 0
    audioProcessor.connect(silentGain)
    silentGain.connect(audioCtx.destination)

    console.log('[recording] Started, sampleRate:', audioCtx.sampleRate)

    // Auto-stop after 8 seconds
    recordingAutoStop = setTimeout(() => finishRecording(), 8000)
    recordingStopFn = () => {
      clearTimeout(recordingAutoStop)
      finishRecording()
    }
  } catch (err) {
    console.log('[recording] getUserMedia failed:', err.message)
    clearCountdown()
    isRecording = false
    el.chatMic.classList.remove('recording')
    el.chatInput.placeholder = 'Talk to Claude...'
    sebastianSay('Microphone access denied, sir.')
  }
}

async function finishRecording() {
  if (!isRecording) return
  isRecording = false
  recordingStopFn = null
  clearCountdown()
  el.chatInput.placeholder = 'Transcribing...'

  // Stop audio capture
  const sampleRate = audioCtx ? audioCtx.sampleRate : 44100
  if (audioProcessor) { try { audioProcessor.disconnect() } catch {} }
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop())
  if (audioCtx) { try { audioCtx.close() } catch {} }
  audioProcessor = null
  mediaStream = null
  audioCtx = null

  // Merge audio chunks
  const totalLength = audioChunks.reduce((acc, c) => acc + c.length, 0)
  console.log('[recording] Captured', totalLength, 'samples at', sampleRate, 'Hz')

  if (totalLength === 0) {
    el.chatMic.classList.remove('recording')
    el.chatInput.placeholder = 'Talk to Claude...'
    sebastianSay('I did not hear anything, sir.')
    return
  }

  const pcm = new Float32Array(totalLength)
  let offset = 0
  for (const chunk of audioChunks) {
    pcm.set(chunk, offset)
    offset += chunk.length
  }
  audioChunks = []

  // Create WAV buffer and send for transcription via HTTP
  const wavBuffer = createWavBuffer(pcm, sampleRate)
  console.log('[recording] WAV size:', wavBuffer.byteLength, 'bytes')

  try {
    const res = await fetch(apiUrl('/mobile/transcribe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: wavBuffer
    })
    const result = await res.json()
    el.chatMic.classList.remove('recording')
    el.chatInput.placeholder = 'Talk to Claude...'

    if (result.text) {
      console.log('[recording] Transcribed:', result.text)
      el.chatInput.value = result.text
      sendChat()
    } else if (result.error) {
      console.log('[recording] Error:', result.error)
      sebastianSay('I could not understand, sir.')
    } else {
      sebastianSay('I did not hear anything, sir.')
    }
  } catch (err) {
    console.log('[recording] Transcription failed:', err)
    el.chatMic.classList.remove('recording')
    el.chatInput.placeholder = 'Talk to Claude...'
    sebastianSay('Voice input is not available, sir.')
  }
}

function stopRecording() {
  if (recordingStopFn) {
    recordingStopFn()
  }
}

function clearCountdown() {
  if (recordingCountdown) {
    clearInterval(recordingCountdown)
    recordingCountdown = null
  }
}

// -- WAV Buffer Creation ------------------------------------------------------

function createWavBuffer(pcmData, sampleRate) {
  const numChannels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = pcmData.length * bytesPerSample
  const headerSize = 44

  const buffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  wavWriteString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  wavWriteString(view, 8, 'WAVE')

  // fmt chunk
  wavWriteString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data chunk
  wavWriteString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // PCM samples (float32 -> int16)
  let pos = 44
  for (let i = 0; i < pcmData.length; i++) {
    const sample = Math.max(-1, Math.min(1, pcmData[i]))
    view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
    pos += 2
  }

  return buffer
}

function wavWriteString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

// -- Notification Sound -------------------------------------------------------

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08)
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.16)
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.35)
  } catch {}
}

function playCompletionSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    // Ascending pleasant chime -- distinct from approval ping
    osc.frequency.setValueAtTime(523, ctx.currentTime)       // C5
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1) // E5
    osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2) // G5
    osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.3) // C6
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  } catch {}
}

// -- Custom Avatar ------------------------------------------------------------

function applyCustomAvatar(data) {
  customAvatar = data
  el.customAvatarWrap.style.display = ''
  $('scene').style.display = 'none'
  updateCustomAvatarImage()
}

function removeCustomAvatar() {
  customAvatar = null
  el.customAvatarWrap.style.display = 'none'
  $('scene').style.display = ''
}

function updateCustomAvatarImage() {
  if (!customAvatar) return
  const e = S.emotion
  // Try exact state, then fall back to idle
  const src = customAvatar.states[e] || customAvatar.states.idle || ''
  if (src && el.customAvatarImg.src !== src) {
    el.customAvatarImg.src = src
  }

  // Apply animation class to the wrapper
  const wrap = el.customAvatarWrap
  wrap.classList.remove('float', 'bounce', 'shake', 'hop', 'alert-bounce')

  const alerting = S.behavior === 'alert'
  if (alerting) wrap.classList.add('alert-bounce')
  else if (e === 'excited' || e === 'jumping' || e === 'summersault') wrap.classList.add('bounce')
  else if (e === 'error' || e === 'angry') wrap.classList.add('shake')
  else if (S.behavior === 'hop') wrap.classList.add('hop')
  else wrap.classList.add('float')
}

// -- Mouse + Touch tracking for eyes -----------------------------------------

document.addEventListener('mousemove', (e) => {
  if (S.emotion === 'sleeping' || S.emotion === 'thinking') return
  if (S.behavior === 'walking' || S.behavior === 'looking') return

  const svg = $('scene')
  if (!svg) return
  const r = svg.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const dx = (e.clientX - cx) / (r.width || 1)
  const dy = (e.clientY - cy) / (r.height || 1)
  S.lookX = clamp(dx * 6, -3.5, 3.5)
  S.lookY = clamp(dy * 4, -2.5, 2.5)
}, { passive: true })

function setupTouchTracking() {
  document.addEventListener('touchmove', (e) => {
    if (S.emotion === 'sleeping' || S.emotion === 'thinking') return
    if (S.behavior === 'walking' || S.behavior === 'looking') return

    const touch = e.touches[0]
    if (!touch) return
    const svg = $('scene')
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const dx = (touch.clientX - cx) / (r.width || 1)
    const dy = (touch.clientY - cy) / (r.height || 1)
    S.lookX = clamp(dx * 6, -3.5, 3.5)
    S.lookY = clamp(dy * 4, -2.5, 2.5)
  }, { passive: true })
}

// -- Click (tap-to-wake) ------------------------------------------------------

function setupClick() {
  const svg = $('scene')
  if (!svg) return

  // Tap to wake (replaces desktop drag + double-click)
  svg.addEventListener('click', () => {
    wake()
  })

  // Also wake on touch for custom avatar
  const customWrap = $('custom-avatar')
  if (customWrap) {
    customWrap.addEventListener('click', () => {
      wake()
    })
  }
}

// -- Util ---------------------------------------------------------------------

function rand(min, max) { return min + Math.random() * (max - min) }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }

// -- Start --------------------------------------------------------------------
// init() is called by setupConnectionScreen after successful connection
