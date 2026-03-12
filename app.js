// ═══════════════════════════════════════════════════════════════════════════════
// Sebastian — Desktop AI Companion
// ═══════════════════════════════════════════════════════════════════════════════

// ── Config ────────────────────────────────────────────────────────────────────

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

// ── Personality Response Pools (renderer-side) ──────────────────────────────

function pickRendererLine(pool) {
  if (!pool || pool.length === 0) return ''
  return pool[Math.floor(Math.random() * pool.length)]
}

const RENDERER_LINES = {
  approve: [
    'Yes, sir. Proceeding.',
    'Very good, sir.',
    'Right away, sir.',
    'As you wish, sir. Approved.',
    'Proceeding at once, sir.',
    'Understood, sir.',
    'Consider it done, sir.',
    'Granted, sir.',
  ],
  deny: [
    'As you wish, sir. Denied.',
    'Understood. Request denied, sir.',
    'Very well, sir. That won\'t proceed.',
    'Noted, sir. Standing down.',
    'Denied, sir. Moving on.',
  ],
  approveAll: [
    'Very well, sir. All approved.',
    'Blanket approval granted, sir.',
    'All requests approved, sir.',
    'Everything approved. Carrying on, sir.',
    'Sweeping approval, sir. As you wish.',
  ],
  chatSent: [
    'Delivering your message, sir.',
    'Message dispatched, sir.',
    'Sent along, sir.',
    'Your words have been relayed, sir.',
    'Message delivered, sir.',
    'Right away, sir. Message sent.',
    'Passed along your instructions, sir.',
  ],
  compact: [
    'Compacting context, sir.',
    'Tidying up the context, sir.',
    'Trimming the conversation, sir.',
    'A bit of spring cleaning, sir.',
    'Context compression underway, sir.',
  ],
  wakeWord: [
    'Yes, sir?',
    'At your service, sir.',
    'How may I assist, sir?',
    'You called, sir?',
    'Right here, sir.',
    'At your command, sir.',
  ],
  noSession: [
    'No session selected, sir.',
    'Please select a session first, sir.',
    'I need a session to work with, sir.',
  ],
  autoAccept: [
    'Toggling auto-accept, sir.',
    'Auto-accept toggled, sir.',
    'As you wish, sir. Auto-accept updated.',
  ],
  errorOccurred: [
    'An error occurred, sir. Please check the details.',
    'Something went wrong, sir. Have a look.',
    'Oh dear. An error, sir.',
    'There seems to be an issue, sir.',
    'Trouble, sir. Worth investigating.',
  ],
  micDenied: [
    'Microphone access denied, sir.',
    'I\'m afraid the microphone is unavailable, sir.',
  ],
  noAudio: [
    'I did not hear anything, sir.',
    'Nothing came through, sir.',
    'Silence, sir. Try again perhaps?',
  ],
  noUnderstand: [
    'I could not understand, sir.',
    'That was unclear, sir. Shall we try again?',
    'I didn\'t quite catch that, sir.',
  ],
}

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
  // ── Extended emotes (100) ──
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
  // ── Extended emotes (100) ──
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

// ── Extended Emote Configs (data-driven rendering for 100 new emotes) ────────

const EMOTE_CONFIG = {
  // ── Emotional States (30) ── each has unique anim + effect + iris color
  grateful:     { eyeScale: 0.6, pupilR: 4, eyeDir: {x:0,y:1}, browType: 'normal', bodyAnim: 'bow', joyful: true, fx: 'hearts', irisColor: '#e879a0', mouthOpen: false },
  amused:       { eyeScale: 0.8, pupilR: 3.5, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'bounce', joyful: true, fx: 'music', irisColor: '#34d399', mouthOpen: false },
  determined:   { eyeScale: 0.7, pupilR: 2, eyeDir: {x:0,y:0}, browType: 'error', bodyAnim: 'swell', joyful: false, fx: 'lightning', irisColor: '#f97316', mouthOpen: false },
  hopeful:      { eyeScale: 1.3, pupilR: 4, eyeDir: {x:0,y:-3}, browType: 'surprised', bodyAnim: 'float', joyful: false, fx: 'sparkles', irisColor: '#38bdf8', mouthOpen: false },
  relieved:     { eyeScale: 0.4, pupilR: 3.5, eyeDir: {x:0,y:1}, browType: 'normal', bodyAnim: 'droop', joyful: false, fx: null, irisColor: '#34d399', mouthOpen: false },
  content:      { eyeScale: 0.5, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'float', joyful: false, fx: 'music', irisColor: '#2dd4bf', mouthOpen: false },
  nostalgic:    { eyeScale: 0.5, pupilR: 4, eyeDir: {x:-3,y:-3}, browType: 'sad', bodyAnim: 'droop', joyful: false, fx: null, irisColor: '#a78bfa', mouthOpen: false },
  jealous:      { eyeScale: 0.7, pupilR: 2, eyeDir: {x:3,y:0}, browType: 'error', bodyAnim: 'tilt-right', joyful: false, fx: 'anger', irisColor: '#84cc16', mouthOpen: false },
  guilty:       { eyeScale: 0.5, pupilR: 2, eyeDir: {x:-2,y:3}, browType: 'sad', bodyAnim: 'shrink-anim', joyful: false, fx: 'sweat', irisColor: '#6b9cc8', mouthOpen: false },
  ashamed:      { eyeScale: 0.3, pupilR: 2, eyeDir: {x:0,y:4}, browType: 'sad', bodyAnim: 'shrink-anim', joyful: false, fx: 'sweat', irisColor: '#fb7185', mouthOpen: false },
  embarrassed:  { eyeScale: 0.5, pupilR: 2.5, eyeDir: {x:3,y:2}, browType: 'confused', bodyAnim: 'wobble', joyful: false, fx: 'sweat', irisColor: '#f472b6', mouthOpen: false },
  disgusted:    { eyeScale: 0.4, pupilR: 1.5, eyeDir: {x:-2,y:-2}, browType: 'error', bodyAnim: 'tilt-left', joyful: false, fx: null, irisColor: '#84cc16', mouthOpen: false },
  contempt:     { eyeScale: 0.8, pupilR: 2, eyeDir: {x:3,y:-2}, browType: 'think', bodyAnim: 'tilt-right', joyful: false, fx: null, irisColor: '#a78bfa', mouthOpen: false },
  adoring:      { eyeScale: 1.2, pupilR: 5, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'swell', joyful: true, fx: 'hearts', irisColor: '#f472b6', mouthOpen: false },
  longing:      { eyeScale: 0.9, pupilR: 4, eyeDir: {x:4,y:-2}, browType: 'sad', bodyAnim: 'droop', joyful: false, fx: 'hearts', irisColor: '#818cf8', mouthOpen: false },
  melancholy:   { eyeScale: 0.5, pupilR: 3, eyeDir: {x:-2,y:3}, browType: 'sad', bodyAnim: 'droop', joyful: false, fx: null, irisColor: '#6b9cc8', mouthOpen: false },
  euphoric:     { eyeScale: 1.5, pupilR: 4.5, eyeDir: {x:0,y:0}, browType: 'surprised', bodyAnim: 'celebrate', joyful: true, fx: 'lightning', irisColor: '#f59e0b', mouthOpen: true },
  serene:       { eyeScale: 0.3, pupilR: 3.5, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'float', joyful: false, fx: 'music', irisColor: '#2dd4bf', mouthOpen: false },
  anxious:      { eyeScale: 1.2, pupilR: 1.5, eyeDir: 'dart', browType: 'confused', bodyAnim: 'tremble', joyful: false, fx: 'sweat', irisColor: '#fbbf24', mouthOpen: false },
  panicked:     { eyeScale: 1.5, pupilR: 1.5, eyeDir: 'dart', browType: 'surprised', bodyAnim: 'tremble', joyful: false, fx: 'alert', irisColor: '#ff7b72', mouthOpen: true },
  terrified:    { eyeScale: 1.5, pupilR: 1, eyeDir: {x:0,y:0}, browType: 'surprised', bodyAnim: 'tremble', joyful: false, fx: 'sweat', irisColor: '#ff7b72', mouthOpen: true },
  furious:      { eyeScale: 0.6, pupilR: 1.5, eyeDir: {x:0,y:0}, browType: 'error', bodyAnim: 'slam-anim', joyful: false, fx: 'anger', irisColor: '#ff7b72', mouthOpen: true },
  enraged:      { eyeScale: 0.5, pupilR: 1.5, eyeDir: {x:0,y:0}, browType: 'error', bodyAnim: 'shake', joyful: false, fx: 'anger', irisColor: '#dc2626', mouthOpen: true },
  devastated:   { eyeScale: 1.3, pupilR: 4, eyeDir: {x:0,y:4}, browType: 'sad', bodyAnim: 'droop', joyful: false, fx: null, irisColor: '#6b9cc8', mouthOpen: false },
  heartbroken:  { eyeScale: 0.8, pupilR: 3.5, eyeDir: {x:0,y:3}, browType: 'sad', bodyAnim: 'droop', joyful: false, fx: 'hearts', irisColor: '#fb7185', mouthOpen: false },
  ecstatic:     { eyeScale: 1.4, pupilR: 4.5, eyeDir: {x:0,y:0}, browType: 'surprised', bodyAnim: 'jump-anim', joyful: true, fx: 'sparkles', irisColor: '#f59e0b', mouthOpen: false },
  blissful:     { eyeScale: 0.3, pupilR: 4, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'swell', joyful: true, fx: 'sparkles', irisColor: '#f472b6', mouthOpen: false },
  gloomy:       { eyeScale: 0.5, pupilR: 2.5, eyeDir: {x:0,y:3}, browType: 'sad', bodyAnim: 'droop', joyful: false, fx: null, irisColor: '#6b7280', mouthOpen: false },
  grumpy:       { eyeScale: 0.6, pupilR: 2, eyeDir: {x:0,y:0}, browType: 'error', bodyAnim: 'tilt-left', joyful: false, fx: 'anger', irisColor: '#f97316', mouthOpen: false },
  irritated:    { eyeScale: 0.7, pupilR: 2, eyeDir: {x:0,y:0}, browType: 'error', bodyAnim: 'fidget', joyful: false, fx: 'anger', irisColor: '#f97316', mouthOpen: false },
  // ── Dev Activities (25) ── each has code/gear/arrow effects + unique anim
  coding:       { eyeScale: 1.0, pupilR: 2, eyeDir: {x:0,y:3}, browType: 'normal', bodyAnim: 'typing-anim', joyful: false, fx: 'code', irisColor: '#2dd4bf', mouthOpen: false },
  debugging:    { eyeScale: 0.7, pupilR: 2, eyeDir: {x:2,y:3}, browType: 'think', bodyAnim: 'typing-anim', joyful: false, fx: 'question', irisColor: '#f97316', mouthOpen: false },
  deploying:    { eyeScale: 1.1, pupilR: 3, eyeDir: {x:0,y:-3}, browType: 'normal', bodyAnim: 'swell', joyful: false, fx: 'arrowUp', irisColor: '#34d399', mouthOpen: false },
  testing:      { eyeScale: 1.0, pupilR: 2.5, eyeDir: {x:0,y:2}, browType: 'normal', bodyAnim: 'scan-anim', joyful: false, fx: 'code', irisColor: '#fbbf24', mouthOpen: false },
  researching:  { eyeScale: 1.2, pupilR: 3.5, eyeDir: {x:-3,y:-2}, browType: 'think', bodyAnim: 'scan-anim', joyful: false, fx: 'question', irisColor: '#818cf8', mouthOpen: false },
  downloading:  { eyeScale: 0.9, pupilR: 3, eyeDir: {x:0,y:3}, browType: 'normal', bodyAnim: 'pulse-anim', joyful: false, fx: 'arrowDown', irisColor: '#38bdf8', mouthOpen: false },
  uploading:    { eyeScale: 0.9, pupilR: 3, eyeDir: {x:0,y:-4}, browType: 'normal', bodyAnim: 'pulse-anim', joyful: false, fx: 'arrowUp', irisColor: '#38bdf8', mouthOpen: false },
  compiling:    { eyeScale: 0.8, pupilR: 2.5, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'pulse-anim', joyful: false, fx: 'gear', irisColor: '#fbbf24', mouthOpen: false },
  installing:   { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:2}, browType: 'normal', bodyAnim: 'pulse-anim', joyful: false, fx: 'arrowDown', irisColor: '#2dd4bf', mouthOpen: false },
  searching:    { eyeScale: 1.1, pupilR: 2, eyeDir: {x:3,y:-2}, browType: 'think', bodyAnim: 'scan-anim', joyful: false, fx: 'question', irisColor: '#818cf8', mouthOpen: false },
  calculating:  { eyeScale: 1.0, pupilR: 1.5, eyeDir: {x:-2,y:-3}, browType: 'think', bodyAnim: 'typing-anim', joyful: false, fx: 'thinkDots', irisColor: '#818cf8', mouthOpen: false },
  analyzing:    { eyeScale: 1.0, pupilR: 2, eyeDir: {x:0,y:2}, browType: 'think', bodyAnim: 'scan-anim', joyful: false, fx: 'gear', irisColor: '#a78bfa', mouthOpen: false },
  reviewing:    { eyeScale: 1.0, pupilR: 3, eyeDir: {x:2,y:2}, browType: 'normal', bodyAnim: 'reading', joyful: false, fx: 'code', irisColor: '#2dd4bf', mouthOpen: false },
  building:     { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'bounce', joyful: false, fx: 'gear', irisColor: '#f97316', mouthOpen: false },
  fixing:       { eyeScale: 0.8, pupilR: 2, eyeDir: {x:0,y:3}, browType: 'think', bodyAnim: 'typing-anim', joyful: false, fx: 'code', irisColor: '#f59e0b', mouthOpen: false },
  refactoring:  { eyeScale: 1.0, pupilR: 3, eyeDir: {x:-2,y:2}, browType: 'think', bodyAnim: 'typing-anim', joyful: false, fx: 'code', irisColor: '#a78bfa', mouthOpen: false },
  committing:   { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'nod-anim', joyful: false, fx: 'check', irisColor: '#3fb950', mouthOpen: false },
  pushing:      { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:-3}, browType: 'normal', bodyAnim: 'swell', joyful: false, fx: 'arrowUp', irisColor: '#34d399', mouthOpen: false },
  pulling:      { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:3}, browType: 'normal', bodyAnim: 'droop', joyful: false, fx: 'arrowDown', irisColor: '#38bdf8', mouthOpen: false },
  merging:      { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'swell', joyful: false, fx: 'code', irisColor: '#a78bfa', mouthOpen: false },
  branching:    { eyeScale: 1.0, pupilR: 3, eyeDir: {x:3,y:-2}, browType: 'normal', bodyAnim: 'tilt-right', joyful: false, fx: 'code', irisColor: '#84cc16', mouthOpen: false },
  'rolling-back': { eyeScale: 0.8, pupilR: 2.5, eyeDir: {x:0,y:0}, browType: 'confused', bodyAnim: 'wobble', joyful: false, fx: 'alert', irisColor: '#f59e0b', mouthOpen: false },
  monitoring:   { eyeScale: 1.2, pupilR: 2, eyeDir: {x:2,y:0}, browType: 'normal', bodyAnim: 'scan-anim', joyful: false, fx: 'gear', irisColor: '#22d3ee', mouthOpen: false },
  profiling:    { eyeScale: 1.0, pupilR: 1.5, eyeDir: {x:-2,y:2}, browType: 'think', bodyAnim: 'reading', joyful: false, fx: 'gear', irisColor: '#818cf8', mouthOpen: false },
  benchmarking: { eyeScale: 1.0, pupilR: 2.5, eyeDir: {x:0,y:2}, browType: 'normal', bodyAnim: 'pulse-anim', joyful: false, fx: 'clock', irisColor: '#f97316', mouthOpen: false },
  // ── Physical (20) ── unique body animations
  yawning:      { eyeScale: 0.2, pupilR: 4, eyeDir: {x:0,y:0}, browType: 'sad', bodyAnim: 'stretch', joyful: false, fx: null, irisColor: '#6b7280', mouthOpen: true },
  sneezing:     { eyeScale: 0.06, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'surprised', bodyAnim: 'slam-anim', joyful: false, fx: null, irisColor: null, mouthOpen: true },
  coughing:     { eyeScale: 0.3, pupilR: 2.5, eyeDir: {x:0,y:1}, browType: 'normal', bodyAnim: 'shake', joyful: false, fx: null, irisColor: null, mouthOpen: true },
  shivering:    { eyeScale: 0.6, pupilR: 2.5, eyeDir: {x:0,y:0}, browType: 'sad', bodyAnim: 'tremble', joyful: false, fx: null, irisColor: '#38bdf8', mouthOpen: false },
  sweating:     { eyeScale: 0.7, pupilR: 2.5, eyeDir: {x:-2,y:0}, browType: 'confused', bodyAnim: 'fidget', joyful: false, fx: 'sweat', irisColor: '#f59e0b', mouthOpen: false },
  dizzy:        { eyeScale: 1.2, pupilR: 2, eyeDir: 'dart', browType: 'confused', bodyAnim: 'wobble', joyful: false, fx: 'dizzy', irisColor: '#a78bfa', mouthOpen: false },
  fainting:     { eyeScale: 0.15, pupilR: 5, eyeDir: {x:0,y:-3}, browType: 'sad', bodyAnim: 'tilt-left', joyful: false, fx: 'dizzy', irisColor: '#6b7280', mouthOpen: true },
  'stretching-out': { eyeScale: 0.2, pupilR: 3.5, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'stretch', joyful: false, fx: null, irisColor: null, mouthOpen: false },
  nodding:      { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:1}, browType: 'normal', bodyAnim: 'nod-anim', joyful: false, fx: 'check', irisColor: '#3fb950', mouthOpen: false },
  'shaking-head': { eyeScale: 0.8, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'sad', bodyAnim: 'head-shake-anim', joyful: false, fx: 'x', irisColor: '#ff7b72', mouthOpen: false },
  facepalm:     { eyeScale: 0.06, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'sad', bodyAnim: 'droop', joyful: false, fx: null, irisColor: null, mouthOpen: false },
  saluting:     { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'swell', joyful: false, fx: null, irisColor: '#22d3ee', mouthOpen: false },
  clapping:     { eyeScale: 1.2, pupilR: 4, eyeDir: {x:0,y:0}, browType: 'surprised', bodyAnim: 'bounce', joyful: true, fx: 'sparkles', irisColor: '#3fb950', mouthOpen: false },
  'thumbs-up':  { eyeScale: 1.0, pupilR: 3.5, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'nod-anim', joyful: true, fx: 'check', irisColor: '#3fb950', mouthOpen: false },
  pointing:     { eyeScale: 1.0, pupilR: 3, eyeDir: {x:4,y:0}, browType: 'normal', bodyAnim: 'tilt-right', joyful: false, fx: 'alert', irisColor: '#22d3ee', mouthOpen: false },
  shrugging:    { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'confused', bodyAnim: 'wobble', joyful: false, fx: 'question', irisColor: '#6b7280', mouthOpen: false },
  flexing:      { eyeScale: 0.7, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'swell', joyful: true, fx: 'lightning', irisColor: '#f97316', mouthOpen: false },
  meditating:   { eyeScale: 0.06, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'float', joyful: false, fx: 'sparkles', irisColor: '#2dd4bf', mouthOpen: false },
  praying:      { eyeScale: 0.06, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'sad', bodyAnim: 'float', joyful: false, fx: null, irisColor: '#f59e0b', mouthOpen: false },
  'bowing-deep': { eyeScale: 0.2, pupilR: 3, eyeDir: {x:0,y:4}, browType: 'normal', bodyAnim: 'bow', joyful: false, fx: null, irisColor: null, mouthOpen: false },
  // ── Social/Reactions (15) ── personality-driven
  sarcastic:    { eyeScale: 0.8, pupilR: 2, eyeDir: {x:3,y:-2}, browType: 'think', bodyAnim: 'tilt-right', joyful: false, fx: null, irisColor: '#a78bfa', mouthOpen: false },
  smirking:     { eyeScale: 0.9, pupilR: 3, eyeDir: {x:2,y:0}, browType: 'think', bodyAnim: 'tilt-right', joyful: false, fx: null, irisColor: '#a78bfa', mouthOpen: false },
  winking:      { eyeScale: 1.0, pupilR: 3.5, eyeDir: {x:2,y:0}, browType: 'normal', bodyAnim: 'nod-anim', joyful: false, fx: 'sparkles', irisColor: '#f472b6', mouthOpen: false },
  'eye-rolling': { eyeScale: 0.8, pupilR: 2.5, eyeDir: {x:0,y:-4}, browType: 'normal', bodyAnim: 'tilt-left', joyful: false, fx: null, irisColor: '#6b7280', mouthOpen: false },
  skeptical:    { eyeScale: 0.7, pupilR: 2, eyeDir: {x:2,y:0}, browType: 'think', bodyAnim: 'tilt-left', joyful: false, fx: 'question', irisColor: '#fbbf24', mouthOpen: false },
  suspicious:   { eyeScale: 0.4, pupilR: 1.5, eyeDir: {x:3,y:0}, browType: 'error', bodyAnim: 'tilt-left', joyful: false, fx: 'question', irisColor: '#f59e0b', mouthOpen: false },
  intrigued:    { eyeScale: 1.3, pupilR: 4, eyeDir: {x:0,y:-2}, browType: 'think', bodyAnim: 'swell', joyful: false, fx: 'question', irisColor: '#818cf8', mouthOpen: false },
  fascinated:   { eyeScale: 1.4, pupilR: 4.5, eyeDir: {x:0,y:-2}, browType: 'surprised', bodyAnim: 'swell', joyful: false, fx: 'sparkles', irisColor: '#818cf8', mouthOpen: false },
  impressed:    { eyeScale: 1.3, pupilR: 4, eyeDir: {x:0,y:0}, browType: 'surprised', bodyAnim: 'jump-anim', joyful: false, fx: 'alert', irisColor: '#3fb950', mouthOpen: false },
  disappointed: { eyeScale: 0.6, pupilR: 2.5, eyeDir: {x:0,y:3}, browType: 'sad', bodyAnim: 'droop', joyful: false, fx: null, irisColor: '#6b9cc8', mouthOpen: false },
  apologetic:   { eyeScale: 0.7, pupilR: 3.5, eyeDir: {x:-2,y:2}, browType: 'sad', bodyAnim: 'bow', joyful: false, fx: 'sweat', irisColor: '#6b9cc8', mouthOpen: false },
  pleading:     { eyeScale: 1.4, pupilR: 5, eyeDir: {x:0,y:-2}, browType: 'sad', bodyAnim: 'tremble', joyful: false, fx: null, irisColor: '#fb7185', mouthOpen: false },
  commanding:   { eyeScale: 1.0, pupilR: 2, eyeDir: {x:0,y:0}, browType: 'error', bodyAnim: 'swell', joyful: false, fx: 'alert', irisColor: '#f97316', mouthOpen: false },
  reassuring:   { eyeScale: 0.8, pupilR: 3.5, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'nod-anim', joyful: false, fx: 'sparkles', irisColor: '#34d399', mouthOpen: false },
  encouraging:  { eyeScale: 1.2, pupilR: 4, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'bounce', joyful: true, fx: 'lightning', irisColor: '#3fb950', mouthOpen: false },
  // ── Status Indicators (10) ── system-oriented
  loading:      { eyeScale: 0.8, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'pulse-anim', joyful: false, fx: 'gear', irisColor: '#22d3ee', mouthOpen: false },
  syncing:      { eyeScale: 1.0, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'pulse-anim', joyful: false, fx: 'arrowUp', irisColor: '#38bdf8', mouthOpen: false },
  'error-critical': { eyeScale: 1.5, pupilR: 1.5, eyeDir: {x:0,y:0}, browType: 'error', bodyAnim: 'shake', joyful: false, fx: 'x', irisColor: '#dc2626', mouthOpen: true },
  warning:      { eyeScale: 1.2, pupilR: 2, eyeDir: {x:0,y:0}, browType: 'error', bodyAnim: 'wobble', joyful: false, fx: 'alert', irisColor: '#f59e0b', mouthOpen: false },
  success:      { eyeScale: 1.2, pupilR: 4, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'celebrate', joyful: true, fx: 'check', irisColor: '#34d399', mouthOpen: false },
  pending:      { eyeScale: 0.8, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'pulse-anim', joyful: false, fx: 'clock', irisColor: '#6b7280', mouthOpen: false },
  processing:   { eyeScale: 1.0, pupilR: 2.5, eyeDir: {x:-2,y:0}, browType: 'normal', bodyAnim: 'typing-anim', joyful: false, fx: 'gear', irisColor: '#22d3ee', mouthOpen: false },
  queued:       { eyeScale: 0.7, pupilR: 3, eyeDir: {x:0,y:0}, browType: 'normal', bodyAnim: 'float', joyful: false, fx: 'clock', irisColor: '#6b7280', mouthOpen: false },
  timeout:      { eyeScale: 0.6, pupilR: 2.5, eyeDir: {x:0,y:3}, browType: 'sad', bodyAnim: 'droop', joyful: false, fx: 'clock', irisColor: '#ff7b72', mouthOpen: false },
  'rate-limited': { eyeScale: 0.7, pupilR: 2.5, eyeDir: {x:0,y:0}, browType: 'confused', bodyAnim: 'wobble', joyful: false, fx: 'clock', irisColor: '#f59e0b', mouthOpen: false },
}

// ── State ─────────────────────────────────────────────────────────────────────

const S = {
  emotion: 'idle',
  behavior: 'idle',
  behaviorTimer: 0,
  direction: 1,
  isBlinking: false,
  lookX: 0,
  lookY: 0,
  mouthPhase: 0,
  isDragging: false,
  dragScreenX: 0,
  dragScreenY: 0,
  dragWinX: 0,
  dragWinY: 0,
  externalEmotion: null,
  externalTimer: 0,
  lastInteraction: Date.now(),
  isSleeping: false,
  isSpeaking: false,
  windowX: 0,
  windowY: 0,
  screenW: 0,
  screenH: 0,
  screenX: 0,
  screenY: 0,
  pendingCount: 0,
  soundEnabled: true,
  voiceEnabled: false,
  lockPosition: false,
  volume: 0.8,
}

// Approval queue (shown in bubble)
let approvalQueue = []
let activeSessions = []
let selectedSessionId = null
let customAvatar = null  // { id, name, mode?, states?, parts?, butlerName?, voice? }

// ── DOM refs ──────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id)

let el = {}

// ── Init ──────────────────────────────────────────────────────────────────────

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
    bubbleOpen: $('bubble-open'),
    bubbleQuestion: $('bubble-question'),
    bubbleApproveAllBtn: $('bubble-approve-all-btn'),
    customAvatarWrap: $('custom-avatar'),
    customAvatarImg: $('custom-avatar-img'),
    customAvatarParts: $('custom-avatar-parts'),
    statusName: $('status-name'),
    sadBrows: $('sad-brows'),
    surprisedBrows: $('surprised-brows'),
    confusedBrows: $('confused-brows'),
    settingsBtn: $('settings-btn'),
    settingsPopover: $('settings-popover'),
    settingSound: $('setting-sound'),
    settingVoice: $('setting-voice'),
    settingLock: $('setting-lock'),
    settingWake: $('setting-wake'),
    settingVolume: $('setting-volume'),
    volumeValue: $('volume-value'),
    settingsAvatarBtn: $('settings-avatar-btn'),
    settingsPanelBtn: $('settings-panel-btn'),
    settingsQuitBtn: $('settings-quit-btn'),
    quickActions: $('quick-actions'),
    qaCompact: $('qa-compact'),
    qaAccept: $('qa-accept'),
    // Extended effects
    heartsEffect: $('hearts-effect'),
    sweatEffect: $('sweat-effect'),
    angerEffect: $('anger-effect'),
    questionEffect: $('question-effect'),
    alertEffect: $('alert-effect'),
    musicEffect: $('music-effect'),
    dizzyEffect: $('dizzy-effect'),
    arrowUpEffect: $('arrow-up-effect'),
    arrowDownEffect: $('arrow-down-effect'),
    codeEffect: $('code-effect'),
    checkEffect: $('check-effect'),
    xEffect: $('x-effect'),
    lightningEffect: $('lightning-effect'),
    gearEffect: $('gear-effect'),
    clockEffect: $('clock-effect'),
    leftIris: $('left-iris'),
    rightIris: $('right-iris'),
  }

  // Get screen info
  const screen = await window.api.getScreen()
  S.screenW = screen.width
  S.screenH = screen.height
  S.screenX = screen.x
  S.screenY = screen.y

  const [wx, wy] = await window.api.getPosition()
  S.windowX = wx
  S.windowY = wy

  // Events
  setupDrag()
  setupClick()
  setupChat()
  setupBubbleActions()
  setupSettings()
  setupQuickActions()
  initVoice()

  // Load settings
  const savedSettings = await window.api.getSettings()
  S.soundEnabled = savedSettings.sound !== false
  S.voiceEnabled = savedSettings.voice === true
  S.lockPosition = savedSettings.lockPosition === true
  el.settingSound.checked = S.soundEnabled
  el.settingVoice.checked = S.voiceEnabled
  el.settingLock.checked = S.lockPosition
  el.settingWake.checked = savedSettings.wakeWord === true
  S.volume = savedSettings.volume != null ? savedSettings.volume : 0.8
  el.settingVolume.value = Math.round(S.volume * 100)
  el.volumeValue.textContent = Math.round(S.volume * 100) + '%'

  // Load initial sessions
  const initialSessions = await window.api.getSessions()
  activeSessions = initialSessions
  updateSessionSelect()

  // External emotion listener
  window.api.onEmotion((data) => {
    setExternalEmotion(data.emotion, data.text)
  })

  // Session list updates
  window.api.onSessionsUpdated((list) => {
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
  window.api.onApprovalCount((count) => {
    S.pendingCount = count
    updateBadge()
  })

  // New approval → show in bubble + speak
  window.api.onNewApproval((data) => {
    approvalQueue.push(data)
    showCurrentApproval()
  })

  // Approvals list updated (after approve/deny)
  window.api.onApprovalsUpdated((list) => {
    approvalQueue = list
    if (approvalQueue.length > 0) {
      showCurrentApproval()
    } else {
      hideBubble()
    }
  })

  // Notification sound/voice trigger
  window.api.onNotifyApproval((data) => {
    if (data.taskDone) {
      playCompletionSound()
    } else {
      playNotificationSound()
      sebastianSay(data.voiceLine || `Sir, ${data.sessionName || 'a session'} needs your approval.`)
    }
  })

  // Settings from menu bar or popover
  window.api.onSettingChanged((data) => {
    if (data.sound !== undefined) { S.soundEnabled = data.sound; el.settingSound.checked = data.sound }
    if (data.voice !== undefined) { S.voiceEnabled = data.voice; el.settingVoice.checked = data.voice }
    if (data.lockPosition !== undefined) { S.lockPosition = data.lockPosition; el.settingLock.checked = data.lockPosition }
    if (data.wakeWord !== undefined) { el.settingWake.checked = data.wakeWord }
    if (data.volume !== undefined) { S.volume = data.volume; el.settingVolume.value = Math.round(data.volume * 100); el.volumeValue.textContent = Math.round(data.volume * 100) + '%' }
  })

  // Session response (from chat or completion) — show in bubble + speak with emotion
  window.api.onSessionResponse((data) => {
    const text = (data.response || '').trim()
    if (!text) return

    if (data.isCompletion) {
      showResponseBubble(text, data.sessionId)
      return
    }

    showResponseBubble(text, data.sessionId)

    // Detect sentiment from response and set appropriate emotion + voice
    const lower = text.toLowerCase()
    if (lower.includes('error') || lower.includes('failed') || lower.includes('not found') || lower.includes('exception')) {
      setExternalEmotion('nervous', 'Error detected')
      sebastianSay(pickRendererLine(RENDERER_LINES.errorOccurred))
    } else if (lower.includes('success') || lower.includes('passed') || lower.includes('complete') || lower.includes('done')) {
      setExternalEmotion('happy', 'Success')
      sebastianSay(pickRendererLine([
        'Excellent news, sir!', 'Wonderful, sir!', 'Splendid result, sir!',
        'That went well, sir!', 'Brilliant, sir!',
      ]))
    } else if (lower.includes('warning') || lower.includes('deprecated') || lower.includes('caution')) {
      setExternalEmotion('confused', 'Warning')
      sebastianSay(pickRendererLine([
        'A word of caution, sir.', 'Something to keep an eye on, sir.',
        'A warning, sir. Worth noting.', 'Proceed carefully, sir.',
      ]))
    } else if (lower.includes('installed') || lower.includes('built') || lower.includes('compiled') || lower.includes('deployed')) {
      setExternalEmotion('excited', 'Build complete')
      sebastianSay(pickRendererLine([
        'All set, sir!', 'Built and ready, sir!', 'Deployed, sir!',
        'Everything is in place, sir!',
      ]))
    } else if (data.isPaste) {
      // Message was pasted into terminal
      sebastianSay(pickRendererLine(RENDERER_LINES.chatSent))
    } else {
      const spoken = text.length > 120 ? text.slice(0, 120) + '...' : text
      sebastianSay(spoken)
    }
  })

  // Voice events from main process (legacy, for mobile PWA forwarding)
  window.api.onVoiceEvent((text) => {
    console.log('[voice-event received]', text)
    sebastianSay(text)
  })

  // Native TTS mouth animation sync — keep current emote, just animate mouth
  window.api.onSpeechStart(() => {
    S.isSpeaking = true
    // Only override to 'speaking' if we're idle — otherwise keep the current emote
    if (!S.externalEmotion || S.emotion === 'idle') {
      S.externalEmotion = 'speaking'
      S.externalTimer = 999999
      S.emotion = 'speaking'
    } else {
      // Keep current emote, just extend its hold time so it doesn't expire during speech
      S.externalTimer = 999999
    }
  })
  window.api.onSpeechEnd(() => {
    S.isSpeaking = false
    S.externalEmotion = null
    S.externalTimer = 0
    S.emotion = behaviorEmotion(S.behavior)
  })

  // Bubble side positioning — shift content so Sebastian stays in place
  window.api.onBubbleSide((side) => {
    el.bubble.classList.remove('bubble-left', 'bubble-right')
    if (side === 'left') {
      // Window expanded to left, Sebastian on right, bubble on left
      el.bubble.classList.add('bubble-left')
      document.body.style.alignItems = 'flex-end'
    } else {
      // Window expanded to right, Sebastian on left, bubble on right
      el.bubble.classList.add('bubble-right')
      document.body.style.alignItems = 'flex-start'
    }
  })

  // Avatar system
  const activeAvatar = await window.api.getActiveAvatar()
  if (activeAvatar) applyCustomAvatar(activeAvatar)

  window.api.onAvatarChanged((data) => {
    if (data) applyCustomAvatar(data)
    else removeCustomAvatar()
  })

  // Personality updates (name, voice)
  window.api.onPersonalityChanged((data) => {
    if (data.butlerName) {
      el.statusName.textContent = data.butlerName
    }
    if (data.voice) {
      loadVoiceFromSettings(data.voice)
    }
  })

  // Proactive personality comments from main process
  window.api.onPersonalityComment((data) => {
    if (approvalQueue.length > 0) return
    showResponseBubble(data.text)
  })

  // Wake word
  window.api.onWakeWordDetected(() => {
    wake()
    setExternalEmotion('listening', 'Listening...')
    sebastianSay(pickRendererLine(RENDERER_LINES.wakeWord))
  })

  window.api.onWakeWordPrompt((text) => {
    if (text) {
      el.chatInput.value = text
      sendChat()
    }
  })

  // Start
  pickBehavior()
  scheduleBlink()
  requestAnimationFrame(loop)
}

// ── Main loop ─────────────────────────────────────────────────────────────────

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

// ── Behavior system ───────────────────────────────────────────────────────────

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

  if (S.behavior === 'walking' && !S.isDragging) {
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

  // When approvals pending → stay in place, alert mode
  if (S.pendingCount > 0) {
    setBehavior('alert', rand(2000, 4000))
    return
  }

  const r = Math.random()
  if (r < 0.40) {
    setBehavior('idle', rand(IDLE_MIN, IDLE_MAX))
  } else if (r < 0.48 && !S.lockPosition) {
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

// ── Walking ───────────────────────────────────────────────────────────────────

function moveWindow() {
  S.windowX += WALK_SPEED * S.direction

  const minX = S.screenX
  const maxX = S.screenX + S.screenW - 280

  if (S.windowX <= minX) {
    S.windowX = minX
    S.direction = 1
  } else if (S.windowX >= maxX) {
    S.windowX = maxX
    S.direction = -1
  }

  window.api.moveWindow(Math.round(S.windowX), Math.round(S.windowY))
}

// ── Sleep ─────────────────────────────────────────────────────────────────────

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

// ── External emotion ──────────────────────────────────────────────────────────

function setExternalEmotion(emotion, text) {
  if (!MOOD_LABEL[emotion] && !customAvatar) return
  wake()
  S.externalEmotion = emotion
  S.externalTimer = EXTERNAL_HOLD
  S.emotion = emotion
  if (text) {
    el.statusMood.textContent = text
  }
}

// ── Blink ─────────────────────────────────────────────────────────────────────

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

// ── Mouth (speaking) ──────────────────────────────────────────────────────────

let mouthInterval = null

function updateMouth() {
  const shouldAnimate = S.emotion === 'speaking' || S.isSpeaking
  if (shouldAnimate && !mouthInterval) {
    mouthInterval = setInterval(() => {
      S.mouthPhase = (S.mouthPhase + 1) % 3
    }, SPEAK_MOUTH_SPEED + Math.random() * 50)
  } else if (!shouldAnimate && mouthInterval) {
    clearInterval(mouthInterval)
    mouthInterval = null
    S.mouthPhase = 0
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  const e = S.emotion
  const joyful = e === 'happy' || e === 'excited' || e === 'proud'
  const asleep = e === 'sleeping'
  const alerting = S.behavior === 'alert'

  // Emotion → glow color map
  const GLOW_MAP = {
    error: '#ff7b72', angry: '#ff7b72',
    happy: '#3fb950', excited: '#3fb950', proud: '#3fb950',
    sleeping: '#6b7280', bored: '#6b7280',
    sad: '#6b9cc8',
    surprised: '#fbbf24', nervous: '#fbbf24',
    confused: '#a78bfa',
    // ── Extended emotes (100) ──
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

  // Custom avatar mode — skip SVG rendering
  if (customAvatar) {
    if (customAvatar.mode === 'parts') {
      updatePartsAvatar()
    } else {
      updateCustomAvatarImage()
    }
    const statusColor = e === 'error' || e === 'angry' ? '#ff7b72' : asleep ? '#6b7280' : alerting ? '#fbbf24' : '#22d3ee'
    el.statusDot.style.background = statusColor
    el.statusDot.style.boxShadow = asleep ? 'none' : `0 0 6px ${statusColor}40`
    if (!S.externalEmotion || !el.statusMood.textContent || el.statusMood.textContent === MOOD_LABEL[e]) {
      el.statusMood.textContent = MOOD_LABEL[e] || 'Ready'
    }
    return
  }

  // All body animation classes (including extended)
  const ALL_ANIMS = ['float','bounce','shake','hop','walk','alert-bounce','fidget','stretch','bow','celebrate','reading','tremble','droop','swell','shrink-anim','spin-anim','wobble','nod-anim','head-shake-anim','pulse-anim','typing-anim','scan-anim','slam-anim','tilt-left','tilt-right','jump-anim']
  // All SVG effect elements
  const ALL_FX = [el.heartsEffect, el.sweatEffect, el.angerEffect, el.questionEffect, el.alertEffect, el.musicEffect, el.dizzyEffect, el.arrowUpEffect, el.arrowDownEffect, el.codeEffect, el.checkEffect, el.xEffect, el.lightningEffect, el.gearEffect, el.clockEffect]
  const FX_MAP = { hearts: el.heartsEffect, sweat: el.sweatEffect, anger: el.angerEffect, question: el.questionEffect, alert: el.alertEffect, music: el.musicEffect, dizzy: el.dizzyEffect, arrowUp: el.arrowUpEffect, arrowDown: el.arrowDownEffect, code: el.codeEffect, check: el.checkEffect, x: el.xEffect, lightning: el.lightningEffect, gear: el.gearEffect, clock: el.clockEffect }
  const DEFAULT_IRIS = 'url(#iris-grad)'

  // ── Data-driven emote handling for extended emotes ──
  const emoteConfig = EMOTE_CONFIG[e]
  if (emoteConfig) {
    // Body animation
    const bg = el.bodyGroup
    bg.classList.remove(...ALL_ANIMS)
    if (alerting) bg.classList.add('alert-bounce')
    else bg.classList.add(emoteConfig.bodyAnim || 'float')

    // Walking direction (reset)
    el.character.style.transform = ''
    el.leftFoot.classList.toggle('walk-left-foot', false)
    el.rightFoot.classList.toggle('walk-right-foot', false)

    // Arm wave for joyful or celebrate
    el.rightArm.classList.toggle('wave-arm', alerting || emoteConfig.bodyAnim === 'celebrate' || emoteConfig.joyful)

    // Eye visibility
    const showEyes = emoteConfig.eyeScale > 0.06
    el.leftEye.style.display = showEyes ? '' : 'none'
    el.rightEye.style.display = showEyes ? '' : 'none'
    el.leftEyeClosed.style.display = showEyes ? 'none' : ''
    el.rightEyeClosed.style.display = showEyes ? 'none' : ''

    // Eye scale
    if (showEyes) {
      let scY = S.isBlinking ? 0.06 : emoteConfig.eyeScale
      el.leftEye.style.transform = `scaleY(${scY})`
      el.rightEye.style.transform = `scaleY(${scY})`
      el.leftEye.style.transition = 'transform 0.1s ease-out'
      el.rightEye.style.transition = 'transform 0.1s ease-out'
    }

    // Iris color (most visible differentiator)
    if (emoteConfig.irisColor) {
      el.leftIris.setAttribute('fill', emoteConfig.irisColor)
      el.rightIris.setAttribute('fill', emoteConfig.irisColor)
    } else {
      el.leftIris.setAttribute('fill', DEFAULT_IRIS)
      el.rightIris.setAttribute('fill', DEFAULT_IRIS)
    }

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

    // Joyful effects (crescents + blush)
    el.leftCrescent.style.display = emoteConfig.joyful ? '' : 'none'
    el.rightCrescent.style.display = emoteConfig.joyful ? '' : 'none'
    const blushOp = emoteConfig.joyful ? 0.25 : emoteConfig.fx === 'sweat' ? 0.15 : 0.04
    el.leftBlush.setAttribute('opacity', blushOp)
    el.rightBlush.setAttribute('opacity', blushOp)

    // Mouth — animate if speaking over the emote
    if (S.isSpeaking) {
      el.mouth.setAttribute('d', MOUTH.speaking[S.mouthPhase])
      el.mouthOpen.style.display = S.mouthPhase === 1 ? '' : 'none'
      el.mouthOpen.setAttribute('opacity', S.mouthPhase === 1 ? '0.6' : '0')
    } else {
      el.mouth.setAttribute('d', MOUTH[e] || MOUTH.idle)
      if (emoteConfig.mouthOpen) {
        el.mouthOpen.style.display = ''
        el.mouthOpen.setAttribute('opacity', '0.5')
      } else {
        el.mouthOpen.style.display = 'none'
      }
    }
    el.mouth.setAttribute('stroke', '#b08060')

    // Extended effects (SVG overlays)
    ALL_FX.forEach(fx => { if (fx) fx.style.display = 'none' })
    el.thinkingDots.style.display = emoteConfig.fx === 'thinkDots' ? '' : 'none'
    el.sleepingZzz.style.display = 'none'
    el.sparkles.style.display = emoteConfig.fx === 'sparkles' ? '' : 'none'
    el.particles.style.display = ''
    if (emoteConfig.fx && FX_MAP[emoteConfig.fx]) {
      FX_MAP[emoteConfig.fx].style.display = ''
    }

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

  // Reset iris color and extended effects for original emotes
  el.leftIris.setAttribute('fill', DEFAULT_IRIS)
  el.rightIris.setAttribute('fill', DEFAULT_IRIS)
  ALL_FX.forEach(fx => { if (fx) fx.style.display = 'none' })

  // Body animation class
  const bg = el.bodyGroup
  bg.classList.remove(...ALL_ANIMS)

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

  // Walking direction
  if (S.behavior === 'walking') {
    el.character.style.transform = S.direction === -1 ? 'scaleX(-1)' : ''
    el.character.style.transformOrigin = '100px 100px'
  } else {
    el.character.style.transform = ''
  }

  // Foot animation
  el.leftFoot.classList.toggle('walk-left-foot', S.behavior === 'walking')
  el.rightFoot.classList.toggle('walk-right-foot', S.behavior === 'walking')

  // Arm wave — wave during alert, wave behavior, celebrate, or joyful
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

  // Happy crescents — show for joyful emotions
  el.leftCrescent.style.display = joyful ? '' : 'none'
  el.rightCrescent.style.display = joyful ? '' : 'none'

  // Blush
  const blushOp = joyful ? 0.18 : e === 'nervous' ? 0.12 : 0.04
  el.leftBlush.setAttribute('opacity', blushOp)
  el.rightBlush.setAttribute('opacity', blushOp)

  // Mouth — animate speaking even when showing another emote
  if (e === 'speaking' || S.isSpeaking) {
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

  // Eyebrows — determine which set to show
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

// ── Notification Badge ────────────────────────────────────────────────────────

function updateBadge() {
  if (S.pendingCount > 0) {
    el.notifBadge.style.display = ''
    el.notifCount.textContent = S.pendingCount > 9 ? '9+' : S.pendingCount
  } else {
    el.notifBadge.style.display = 'none'
  }
}

// ── Speech Bubble ─────────────────────────────────────────────────────────────

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
  const sessionColor = approvalSession?.color || '#fbbf24'
  el.bubbleLabel.textContent = `${current.toolName} · ${approvalName}`
  el.bubbleLabel.style.color = sessionColor
  el.bubble.querySelector('.bubble-body').style.borderLeftColor = sessionColor
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
  window.api.bubbleResize(true)

  // Auto-select the session this approval is from
  if (!selectedSessionId) {
    selectedSessionId = current.sessionId
    el.sessionSelect.value = selectedSessionId
  }
}

function hideBubble() {
  el.bubble.style.display = 'none'
  el.bubble.classList.remove('bubble-left', 'bubble-right')
  document.body.style.alignItems = 'center'
  window.api.bubbleResize(false)
  // Reset session color styling
  el.bubbleLabel.style.color = ''
  el.bubble.querySelector('.bubble-body').style.borderLeftColor = ''
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
  const sessionColor = session?.color || '#fbbf24'
  el.bubbleLabel.textContent = `Response from ${label}`
  el.bubbleLabel.style.color = sessionColor
  el.bubble.querySelector('.bubble-body').style.borderLeftColor = sessionColor
  el.bubbleTool.textContent = ''
  el.bubbleCmd.textContent = text.slice(0, 300) + (text.length > 300 ? '...' : '')
  el.bubbleCmd.style.maxHeight = '80px'
  el.bubbleMeta.textContent = ''
  el.bubbleQuestion.style.display = 'none'
  el.bubbleActions.style.display = 'none'
  el.bubbleCount.style.display = 'none'
  el.bubbleDismiss.style.display = ''
  el.bubble.style.display = ''
  window.api.bubbleResize(true)

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
    window.api.approveRequest(current.id)
    sebastianSay(pickRendererLine(RENDERER_LINES.approve))
    showCurrentApproval()
  })

  el.bubbleDeny.addEventListener('click', (e) => {
    e.stopPropagation()
    if (approvalQueue.length === 0) return
    const current = approvalQueue.shift()
    window.api.denyRequest(current.id, 'Denied by user')
    sebastianSay(pickRendererLine(RENDERER_LINES.deny))
    showCurrentApproval()
  })

  el.bubbleOpen.addEventListener('click', (e) => {
    e.stopPropagation()
    if (approvalQueue.length > 0) {
      window.api.openTerminal(approvalQueue[0].sessionId)
    }
  })

  el.bubbleDismiss.addEventListener('click', (e) => {
    e.stopPropagation()
    hideBubble()
  })

  el.bubbleApproveAllBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    window.api.approveAll()
    approvalQueue = []
    hideBubble()
    sebastianSay(pickRendererLine(RENDERER_LINES.approveAll))
  })

  // Click anywhere on bubble body to dismiss response (not approvals)
  el.bubble.querySelector('.bubble-body').addEventListener('click', (e) => {
    if (approvalQueue.length === 0 && el.bubbleActions.style.display === 'none') {
      hideBubble()
    }
  })
}

// ── Session Selector ──────────────────────────────────────────────────────────

function sessionDisplayName(s) {
  if (s.title) {
    const t = s.title.length > 30 ? s.title.slice(0, 28) + '…' : s.title
    return t
  }
  // Fallback: folder name, but skip if it's the home dir username
  if (s.cwd) {
    const folder = s.cwd.split('/').pop()
    // Detect home directory — /Users/<name> on macOS
    const isHome = s.cwd.split('/').length <= 3 && s.cwd.startsWith('/Users/')
    if (folder && !isHome) return folder
  }
  // Last resort: short ID
  return s.id ? s.id.slice(0, 8) : '???'
}

function getSessionColor(sessionId) {
  const s = activeSessions.find(s => s.id === sessionId)
  return s?.color || '#9ca3af'
}

function updateSessionSelect() {
  const prev = el.sessionSelect.value
  el.sessionSelect.innerHTML = '<option value="">No session</option>'

  for (const s of activeSessions) {
    const opt = document.createElement('option')
    opt.value = s.id
    const dot = s.color ? '\u25CF ' : ''
    opt.textContent = dot + sessionDisplayName(s)
    opt.style.color = s.color || '#e4e4e7'
    if (s.id === prev || s.id === selectedSessionId) opt.selected = true
    el.sessionSelect.appendChild(opt)
  }

  // Tint the select border to match current session
  const currentSession = activeSessions.find(s => s.id === (el.sessionSelect.value || selectedSessionId))
  if (currentSession?.color) {
    el.sessionSelect.style.borderColor = currentSession.color
    el.sessionSelect.style.color = currentSession.color
  } else {
    el.sessionSelect.style.borderColor = ''
    el.sessionSelect.style.color = ''
  }

  // Keep selection valid
  if (prev && !activeSessions.find(s => s.id === prev)) {
    selectedSessionId = activeSessions.length ? activeSessions[0].id : null
    el.sessionSelect.value = selectedSessionId || ''
  }
}

// ── Chat Input ────────────────────────────────────────────────────────────────

function setupChat() {
  el.chatSend.addEventListener('click', sendChat)
  el.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) sendChat()
  })
  el.sessionSelect.addEventListener('change', () => {
    selectedSessionId = el.sessionSelect.value || null
    // Update select border color to match session
    const s = activeSessions.find(s => s.id === selectedSessionId)
    if (s?.color) {
      el.sessionSelect.style.borderColor = s.color
      el.sessionSelect.style.color = s.color
    } else {
      el.sessionSelect.style.borderColor = ''
      el.sessionSelect.style.color = ''
    }
  })

  // Mic button — click to toggle recording
  el.chatMic.addEventListener('click', (e) => {
    e.stopPropagation()
    startRecording()
  })

  // Prevent drag when clicking in chat input / select / mic
  el.chatInput.addEventListener('mousedown', (e) => e.stopPropagation())
  el.sessionSelect.addEventListener('mousedown', (e) => e.stopPropagation())
  el.chatMic.addEventListener('mousedown', (e) => e.stopPropagation())
}

function sendChat() {
  const msg = el.chatInput.value.trim()
  if (!msg) { console.log('[sendChat] Empty message, ignoring'); return }

  const targetId = selectedSessionId || (activeSessions.length === 1 ? activeSessions[0].id : null)
  console.log('[sendChat] msg:', msg.slice(0, 60), 'targetId:', targetId, 'selectedSessionId:', selectedSessionId, 'sessions:', activeSessions.length)

  if (targetId) {
    window.api.sendMessage(targetId, msg)
    el.chatInput.value = ''
    const targetSession = activeSessions.find(s => s.id === targetId)
    const targetName = targetSession ? sessionDisplayName(targetSession) : 'session'
    console.log('[sendChat] Sent to:', targetName, targetId)
    el.statusMood.textContent = `Sent to ${targetName}...`
    sebastianSay(pickRendererLine(RENDERER_LINES.chatSent))
    setExternalEmotion('speaking', 'Delivering...')
  } else {
    console.log('[sendChat] No session selected!')
    el.statusMood.textContent = 'Select a session first'
    sebastianSay(pickRendererLine(RENDERER_LINES.noSession))
  }
}

// ── Settings Popover ──────────────────────────────────────────────────────────

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

  // Prevent drag from popover
  pop.addEventListener('mousedown', (e) => e.stopPropagation())
  btn.addEventListener('mousedown', (e) => e.stopPropagation())

  // Toggle handlers
  el.settingSound.addEventListener('change', () => {
    S.soundEnabled = el.settingSound.checked
    window.api.updateSetting('sound', S.soundEnabled)
  })

  el.settingVoice.addEventListener('change', () => {
    S.voiceEnabled = el.settingVoice.checked
    window.api.updateSetting('voice', S.voiceEnabled)
  })

  el.settingLock.addEventListener('change', () => {
    S.lockPosition = el.settingLock.checked
    window.api.updateSetting('lockPosition', S.lockPosition)
  })

  el.settingWake.addEventListener('change', () => {
    window.api.updateSetting('wakeWord', el.settingWake.checked)
  })

  el.settingVolume.addEventListener('input', () => {
    const vol = parseInt(el.settingVolume.value, 10) / 100
    S.volume = vol
    el.volumeValue.textContent = Math.round(vol * 100) + '%'
    window.api.updateSetting('volume', vol)
  })

  // Action buttons
  el.settingsAvatarBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    window.api.openAvatarEditor()
    pop.style.display = 'none'
    btn.classList.remove('active')
  })

  el.settingsPanelBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    window.api.openPanel()
    pop.style.display = 'none'
    btn.classList.remove('active')
  })

  el.settingsQuitBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    window.api.quitApp()
  })
}

// ── Quick-Action Buttons ──────────────────────────────────────────────────────

function setupQuickActions() {
  el.qaCompact.addEventListener('mousedown', (e) => e.stopPropagation())
  el.qaAccept.addEventListener('mousedown', (e) => e.stopPropagation())

  el.qaCompact.addEventListener('click', (e) => {
    e.stopPropagation()
    const targetId = selectedSessionId || (activeSessions.length === 1 ? activeSessions[0].id : null)
    if (targetId) {
      window.api.sendCommand(targetId, '/compact')
      sebastianSay(pickRendererLine(RENDERER_LINES.compact))
      setExternalEmotion('thinking', 'Compacting...')
    }
  })

  el.qaAccept.addEventListener('click', (e) => {
    e.stopPropagation()
    const targetId = selectedSessionId || (activeSessions.length === 1 ? activeSessions[0].id : null)
    if (targetId) {
      window.api.sendCommand(targetId, '/auto-accept')
      sebastianSay(pickRendererLine(RENDERER_LINES.autoAccept))
    }
  })

  // Show/hide quick actions based on session selection
  el.sessionSelect.addEventListener('change', () => {
    el.quickActions.style.display = el.sessionSelect.value ? '' : 'none'
  })
}

// ── Voice System ──────────────────────────────────────────────────────────────

let preferredVoice = null
let voiceReady = false

function initVoice() {
  const loadVoices = () => {
    const voices = speechSynthesis.getVoices()
    if (!voices.length) return false

    // Check if personality voice is set via custom avatar
    if (customAvatar && customAvatar.voice && customAvatar.voice.name) {
      const match = voices.find(v => v.name === customAvatar.voice.name) ||
                    voices.find(v => v.name.toLowerCase().includes(customAvatar.voice.name.toLowerCase()))
      if (match) {
        preferredVoice = match
        voiceReady = true
        console.log('[voice] personality voice:', match.name, match.lang)
        return true
      }
    }

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

  // Electron sometimes doesn't fire onvoiceschanged — retry with polling
  let retries = 0
  const poll = setInterval(() => {
    retries++
    if (voiceReady || retries > 20) { clearInterval(poll); return }
    loadVoices()
  }, 500)
}

function sebastianSay(text) {
  if (!S.voiceEnabled) return
  if (!text) return

  // Delegate TTS to main process (native macOS `say` command)
  // Mouth animation is triggered by speech-start/speech-end events from main
  window.api.nativeSpeak(text)
}

// ── Voice Input (getUserMedia + file-based macOS transcription) ──────────────

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
    audioCtx = new AudioContext()
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
    sebastianSay(pickRendererLine(RENDERER_LINES.micDenied))
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
    sebastianSay(pickRendererLine(RENDERER_LINES.noAudio))
    return
  }

  const pcm = new Float32Array(totalLength)
  let offset = 0
  for (const chunk of audioChunks) {
    pcm.set(chunk, offset)
    offset += chunk.length
  }
  audioChunks = []

  // Create WAV buffer and send for transcription
  const wavBuffer = createWavBuffer(pcm, sampleRate)
  console.log('[recording] WAV size:', wavBuffer.byteLength, 'bytes')

  try {
    const result = await window.api.transcribeAudio(wavBuffer)
    el.chatMic.classList.remove('recording')
    el.chatInput.placeholder = 'Talk to Claude...'

    if (result.text) {
      console.log('[recording] Transcribed:', result.text)
      el.chatInput.value = result.text
      sendChat()
    } else if (result.error) {
      console.log('[recording] Error:', result.error)
      sebastianSay(pickRendererLine(RENDERER_LINES.noUnderstand))
    } else {
      sebastianSay(pickRendererLine(RENDERER_LINES.noAudio))
    }
  } catch (err) {
    console.log('[recording] Transcription failed:', err)
    el.chatMic.classList.remove('recording')
    el.chatInput.placeholder = 'Talk to Claude...'
    sebastianSay(pickRendererLine(RENDERER_LINES.noAudio))
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

// ── WAV Buffer Creation ─────────────────────────────────────────────────────

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

  // PCM samples (float32 → int16)
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

// ── Notification Sound ────────────────────────────────────────────────────────

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
    const vol = S.volume != null ? S.volume : 0.8
    gain.gain.setValueAtTime(0.2 * vol, ctx.currentTime)
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
    // Ascending pleasant chime — distinct from approval ping
    osc.frequency.setValueAtTime(523, ctx.currentTime)       // C5
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1) // E5
    osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2) // G5
    osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.3) // C6
    const vol = S.volume != null ? S.volume : 0.8
    gain.gain.setValueAtTime(0.2 * vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  } catch {}
}

// ── Custom Avatar ────────────────────────────────────────────────────────────

function applyCustomAvatar(data) {
  customAvatar = data
  el.customAvatarWrap.style.display = ''
  $('scene').style.display = 'none'

  if (data.mode === 'parts') {
    // Parts-based avatar
    el.customAvatarImg.style.display = 'none'
    el.customAvatarParts.style.display = ''
    buildPartsDOM(data.parts)
  } else {
    // Legacy single-image avatar
    el.customAvatarImg.style.display = ''
    el.customAvatarParts.style.display = 'none'
    updateCustomAvatarImage()
  }

  // Personality: custom name
  if (data.butlerName) {
    el.statusName.textContent = data.butlerName
  }

  // Personality: custom voice
  if (data.voice) {
    loadVoiceFromSettings(data.voice)
  }
}

function removeCustomAvatar() {
  customAvatar = null
  el.customAvatarWrap.style.display = 'none'
  el.customAvatarImg.style.display = ''
  el.customAvatarParts.style.display = 'none'
  el.customAvatarParts.innerHTML = ''
  $('scene').style.display = ''
  el.statusName.textContent = 'Sebastian'
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

// ── Parts-based Avatar ──────────────────────────────────────────────────────

function buildPartsDOM(parts) {
  const container = el.customAvatarParts
  container.innerHTML = ''

  const floatGroup = document.createElement('div')
  floatGroup.className = 'ca-float-group float'

  const breatheGroup = document.createElement('div')
  breatheGroup.className = 'ca-breathe-group'

  // Sort PART_SLOTS by layer
  const sorted = [...PART_SLOTS].sort((a, b) => a.layer - b.layer)

  for (const slot of sorted) {
    const partData = parts[slot.id]
    if (!partData) continue

    const img = document.createElement('img')
    img.className = 'ca-part'
    img.id = `ca-${slot.id}`
    img.draggable = false

    // Resolve image URL
    const src = typeof partData === 'string' ? partData : (partData.imageUrl || '')
    if (!src) continue  // skip parts with no image
    img.src = src

    // Store variant URLs and default src for animation
    if (partData.variantUrls) img.dataset.variants = JSON.stringify(partData.variantUrls)
    img.dataset.defaultSrc = src

    const scale = partData.scale || 1
    const offsetX = (partData.offset && partData.offset.x) || 0
    const offsetY = (partData.offset && partData.offset.y) || 0
    const w = slot.size.w * scale
    const h = slot.size.h * scale
    const left = slot.anchor.x - w / 2 + offsetX
    const top = slot.anchor.y - h / 2 + offsetY

    img.style.left = `${left}px`
    img.style.top = `${top}px`
    img.style.width = `${w}px`
    img.style.height = `${h}px`
    img.style.zIndex = slot.layer

    // Parts in 'root' animGroup go directly in floatGroup, others in breatheGroup
    if (slot.animGroup === 'root' || slot.animGroup === 'float') {
      floatGroup.appendChild(img)
    } else {
      breatheGroup.appendChild(img)
    }
  }

  floatGroup.appendChild(breatheGroup)
  container.appendChild(floatGroup)
}

let partsMouthFrame = 0
let partsMouthTimer = 0

function updatePartsAvatar() {
  if (!customAvatar || customAvatar.mode !== 'parts') return
  const e = S.emotion
  const parts = customAvatar.parts || {}

  // ── Float group animations ──
  const floatGroup = el.customAvatarParts.querySelector('.ca-float-group')
  if (floatGroup) {
    floatGroup.classList.remove('float', 'bounce', 'shake', 'hop', 'alert-bounce')

    const alerting = S.behavior === 'alert'
    if (alerting) floatGroup.classList.add('alert-bounce')
    else if (e === 'excited' || S.behavior === 'celebrate') floatGroup.classList.add('bounce')
    else if (e === 'error' || e === 'angry') floatGroup.classList.add('shake')
    else if (S.behavior === 'hop') floatGroup.classList.add('hop')
    else floatGroup.classList.add('float')
  }

  // ── Eye tracking ──
  const leftEye = $('ca-left-eye')
  const rightEye = $('ca-right-eye')
  if (leftEye) {
    leftEye.style.transform = `translate(${S.lookX}px, ${S.lookY}px)`
    leftEye.style.transition = 'transform 0.25s ease-out'
  }
  if (rightEye) {
    rightEye.style.transform = `translate(${S.lookX}px, ${S.lookY}px)`
    rightEye.style.transition = 'transform 0.25s ease-out'
  }

  // ── Blinking ──
  if (leftEye && rightEye) {
    if (S.isBlinking) {
      const leftVariants = getPartVariants('left-eye')
      const rightVariants = getPartVariants('right-eye')
      if (leftVariants && leftVariants.blink) {
        leftEye.src = leftVariants.blink
      } else {
        leftEye.style.transform = `translate(${S.lookX}px, ${S.lookY}px) scaleY(0.06)`
      }
      if (rightVariants && rightVariants.blink) {
        rightEye.src = rightVariants.blink
      } else {
        rightEye.style.transform = `translate(${S.lookX}px, ${S.lookY}px) scaleY(0.06)`
      }
    } else {
      // Restore default eye images
      restorePartDefault('left-eye', leftEye)
      restorePartDefault('right-eye', rightEye)
    }
  }

  // ── Mouth ──
  const mouthEl = $('ca-mouth')
  if (mouthEl) {
    const mouthVariants = getPartVariants('mouth')
    if (e === 'speaking' && mouthVariants) {
      // Cycle through speaking variants
      partsMouthTimer += 16 // approx frame time
      if (partsMouthTimer >= SPEAK_MOUTH_SPEED) {
        partsMouthTimer = 0
        partsMouthFrame = (partsMouthFrame + 1) % 3
      }
      const speakKey = `speaking-${partsMouthFrame}`
      if (mouthVariants[speakKey]) {
        mouthEl.src = mouthVariants[speakKey]
      }
    } else if (mouthVariants && mouthVariants[e]) {
      mouthEl.src = mouthVariants[e]
      partsMouthTimer = 0
      partsMouthFrame = 0
    } else {
      restorePartDefault('mouth', mouthEl)
      partsMouthTimer = 0
      partsMouthFrame = 0
    }
  }

  // ── Eyebrows ──
  const leftBrow = $('ca-left-brow')
  const rightBrow = $('ca-right-brow')
  if (leftBrow && rightBrow) {
    const browVariants = getPartVariants('left-brow')
    const rightBrowVariants = getPartVariants('right-brow')

    if (e === 'angry') {
      if (browVariants && browVariants.angry) {
        leftBrow.src = browVariants.angry
      } else {
        leftBrow.style.transform = 'rotate(8deg)'
      }
      if (rightBrowVariants && rightBrowVariants.angry) {
        rightBrow.src = rightBrowVariants.angry
      } else {
        rightBrow.style.transform = 'rotate(-8deg)'
      }
    } else if (e === 'sad') {
      if (browVariants && browVariants.sad) {
        leftBrow.src = browVariants.sad
      } else {
        leftBrow.style.transform = 'rotate(-5deg) translateY(2px)'
      }
      if (rightBrowVariants && rightBrowVariants.sad) {
        rightBrow.src = rightBrowVariants.sad
      } else {
        rightBrow.style.transform = 'rotate(5deg) translateY(2px)'
      }
    } else if (e === 'thinking' || e === 'confused') {
      const variantKey = e === 'thinking' ? 'thinking' : 'confused'
      if (browVariants && browVariants[variantKey]) {
        leftBrow.src = browVariants[variantKey]
      } else {
        leftBrow.style.transform = 'translateY(-2px)'
      }
      if (rightBrowVariants && rightBrowVariants[variantKey]) {
        rightBrow.src = rightBrowVariants[variantKey]
      } else {
        rightBrow.style.transform = e === 'confused' ? 'translateY(-4px)' : 'translateY(-2px)'
      }
    } else if (e === 'surprised') {
      if (browVariants && browVariants.surprised) {
        leftBrow.src = browVariants.surprised
      } else {
        leftBrow.style.transform = 'translateY(-4px)'
      }
      if (rightBrowVariants && rightBrowVariants.surprised) {
        rightBrow.src = rightBrowVariants.surprised
      } else {
        rightBrow.style.transform = 'translateY(-4px)'
      }
    } else {
      // Default position
      restorePartDefault('left-brow', leftBrow)
      restorePartDefault('right-brow', rightBrow)
      leftBrow.style.transform = ''
      rightBrow.style.transform = ''
    }
  }
}

function getPartVariants(slotId) {
  if (!customAvatar || !customAvatar.parts) return null
  const partData = customAvatar.parts[slotId]
  if (!partData) return null
  if (typeof partData === 'string') return null
  return partData.variantUrls || null
}

function restorePartDefault(slotId, imgEl) {
  if (!imgEl) return
  if (imgEl.dataset.defaultSrc) {
    imgEl.src = imgEl.dataset.defaultSrc
  } else if (customAvatar && customAvatar.parts) {
    const partData = customAvatar.parts[slotId]
    if (partData) {
      const src = typeof partData === 'string' ? partData : (partData.imageUrl || '')
      if (src) imgEl.src = src
    }
  }
}

// ── Voice from personality settings ─────────────────────────────────────────

function loadVoiceFromSettings(voiceSettings) {
  if (!voiceSettings) return
  const loadWithSettings = () => {
    const voices = speechSynthesis.getVoices()
    if (!voices.length) return false

    if (voiceSettings.name) {
      // Try exact name match
      const match = voices.find(v => v.name === voiceSettings.name) ||
                    voices.find(v => v.name.toLowerCase().includes(voiceSettings.name.toLowerCase()))
      if (match) {
        preferredVoice = match
        voiceReady = true
        console.log('[voice] personality voice:', match.name, match.lang)
        return true
      }
    }

    // Fall back to default selection if name not found
    return false
  }

  if (!loadWithSettings()) {
    // Retry after voices load
    const poll = setInterval(() => {
      if (loadWithSettings() || voiceReady) clearInterval(poll)
    }, 300)
    setTimeout(() => clearInterval(poll), 6000)
  }
}

// ── Mouse tracking for eyes ───────────────────────────────────────────────────

document.addEventListener('mousemove', (e) => {
  if (S.emotion === 'sleeping' || S.emotion === 'thinking') return
  if (S.behavior === 'walking' || S.behavior === 'looking') return

  const svg = $('scene')
  const r = svg.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const dx = (e.clientX - cx) / (r.width || 1)
  const dy = (e.clientY - cy) / (r.height || 1)
  S.lookX = clamp(dx * 6, -3.5, 3.5)
  S.lookY = clamp(dy * 4, -2.5, 2.5)
}, { passive: true })

// ── Drag ──────────────────────────────────────────────────────────────────────

function setupDrag() {
  const startDrag = async (e) => {
    if (e.button !== 0) return
    wake()
    S.isDragging = true
    const [wx, wy] = await window.api.getPosition()
    S.dragScreenX = e.screenX
    S.dragScreenY = e.screenY
    S.dragWinX = wx
    S.dragWinY = wy
  }

  // Drag from either the SVG scene or custom avatar
  $('scene').addEventListener('mousedown', startDrag)
  $('custom-avatar').addEventListener('mousedown', startDrag)

  document.addEventListener('mousemove', (e) => {
    if (!S.isDragging) return
    const x = S.dragWinX + (e.screenX - S.dragScreenX)
    const y = S.dragWinY + (e.screenY - S.dragScreenY)
    S.windowX = x
    S.windowY = y
    window.api.moveWindow(x, y)
  })

  document.addEventListener('mouseup', () => {
    if (S.isDragging) {
      S.isDragging = false
    }
  })
}

// ── Click reactions ───────────────────────────────────────────────────────────

function setupClick() {
  let lastClick = 0
  const handleClick = () => {
    wake()
    const now = Date.now()
    if (now - lastClick < 400) {
      // Double-click → open session panel (history/details)
      window.api.openPanel()
    }
    lastClick = now
  }
  $('scene').addEventListener('click', handleClick)
  $('custom-avatar').addEventListener('click', handleClick)
}

// ── Util ──────────────────────────────────────────────────────────────────────

function rand(min, max) { return min + Math.random() * (max - min) }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }

// ── Start ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init)
