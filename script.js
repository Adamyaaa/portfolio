/*
  Adamya.OS - Core JavaScript Engine
  Includes Draggable Windows, Audio Synthesis, Boot Loader, and Terminal Parser
*/

// 1. STATE & GLOBAL VARIABLES
const state = {
  activeTheme: 'cyberpunk',
  soundEnabled: true,
  audioCtx: null,
  focusedWindow: null,
  windowPositions: {},
  terminalHistory: []
};

// 2. AUDIO SYNTHESIZER (WEB AUDIO API)
function initAudio() {
  if (state.audioCtx) return;
  try {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.error("Web Audio API not supported in this browser", e);
  }
}

function playTone(freq, type, duration, volume = 0.1) {
  if (!state.soundEnabled || !state.audioCtx) return;
  
  // Resume context if suspended (browser security)
  if (state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }

  try {
    const osc = state.audioCtx.createOscillator();
    const gainNode = state.audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(state.audioCtx.destination);
    
    osc.type = type; // sine, square, sawtooth, triangle
    osc.frequency.setValueAtTime(freq, state.audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(volume, state.audioCtx.currentTime);
    // Smooth ramp down to prevent speaker popping/clicking sounds
    gainNode.gain.exponentialRampToValueAtTime(0.00001, state.audioCtx.currentTime + duration);
    
    osc.start();
    osc.stop(state.audioCtx.currentTime + duration);
  } catch (err) {
    console.warn("Could not play synthesized audio tone", err);
  }
}

// Sound Profiles
const sounds = {
  click: () => playTone(600, 'sine', 0.04, 0.05),
  tick: () => playTone(300 + Math.random() * 200, 'triangle', 0.02, 0.02),
  error: () => playTone(140, 'sawtooth', 0.22, 0.06),
  success: () => {
    playTone(523.25, 'sine', 0.08, 0.05); // C5
    setTimeout(() => playTone(659.25, 'sine', 0.08, 0.05), 80); // E5
    setTimeout(() => playTone(783.99, 'sine', 0.15, 0.05), 160); // G5
  },
  windowOpen: () => {
    playTone(261.63, 'square', 0.06, 0.03); // C4
    setTimeout(() => playTone(329.63, 'square', 0.06, 0.03), 60); // E4
    setTimeout(() => playTone(392.00, 'square', 0.06, 0.03), 120); // G4
    setTimeout(() => playTone(523.25, 'square', 0.12, 0.03), 180); // C5
  },
  bootSweep: () => {
    if (!state.soundEnabled || !state.audioCtx) return;
    try {
      const osc = state.audioCtx.createOscillator();
      const gainNode = state.audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(state.audioCtx.destination);
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, state.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, state.audioCtx.currentTime + 1.2);
      
      gainNode.gain.setValueAtTime(0.06, state.audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, state.audioCtx.currentTime + 1.2);
      
      osc.start();
      osc.stop(state.audioCtx.currentTime + 1.2);
    } catch (e) {}
  }
};

// 3. SYSTEM DIGITAL CLOCK
function startClock() {
  const clockEl = document.getElementById('clock');
  
  function updateTime() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const hoursStr = String(hours).padStart(2, '0');
    
    clockEl.textContent = `${hoursStr}:${minutes}:${seconds} ${ampm}`;
  }
  
  updateTime();
  setInterval(updateTime, 1000);
}

// 4. BOOT LOADER DIAGNOSTICS SEQUENCER
const bootLines = [
  "ADAMYA.OS BIOS v1.0.8 (C) 2026",
  "CPU: ANTIGRAVITY SE-3600 x8 CORES @ 4.20GHz",
  "RAM MODULE: 655,360 BYTES TOTAL SYSTEM BASE MEMORY",
  "TESTING BASE MEMORY... OK",
  "INIT DISK DRIVES: C: (RETRO-POP) MOUNTED [FAIL-SAFE MODE]",
  "RETRIEVING PROFILE ARCHIVES... FOUND DATA_SECTOR_0",
  "LOADING CUSTOM CSS CUSTOMIZER TOKENS... DONE",
  "VERIFYING DIRECTORY CHECKSUM PROTOCOLS... 100% VALID",
  "CONNECTING Web Audio SYNTH CO-PROCESSOR... SUCCESS",
  "ENVIRONMENT PREPARED SUCCESSFULLY."
];

function runBootLoader() {
  const logEl = document.getElementById('boot-log');
  const promptEl = document.getElementById('boot-prompt');
  let lineIdx = 0;
  
  function printNextLine() {
    if (lineIdx < bootLines.length) {
      logEl.innerHTML += bootLines[lineIdx] + "\n";
      lineIdx++;
      logEl.scrollTop = logEl.scrollHeight;
      
      // Random slight delay to mimic vintage computing speeds
      const delay = 100 + Math.random() * 200;
      setTimeout(printNextLine, delay);
    } else {
      setTimeout(() => {
        promptEl.classList.remove('hidden');
        document.addEventListener('keydown', startOS);
        document.addEventListener('click', startOS);
      }, 300);
    }
  }
  
  printNextLine();
}

function startOS() {
  // Remove keyboard/click listeners for boot
  document.removeEventListener('keydown', startOS);
  document.removeEventListener('click', startOS);
  
  // Initialize Sound synthesizer
  initAudio();
  if (state.audioCtx && state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
  
  sounds.bootSweep();
  
  const bootLoader = document.getElementById('boot-loader');
  bootLoader.classList.add('fade-out');
  
  setTimeout(() => {
    bootLoader.style.display = 'none';
    const desktop = document.getElementById('desktop');
    desktop.classList.remove('hidden');
    
    // Force a resize event to initialize canvas background dimensions now that desktop is visible
    window.dispatchEvent(new Event('resize'));
    
    // Launch Digital Clock
    startClock();
    
    // Set up dragging and window actions
    setupWindows();
    
    // Run terminal welcoming typing effect
    runTerminalWelcome();
    
    // Play window opening arpeggio
    setTimeout(sounds.windowOpen, 300);
  }, 800);
}

// 5. WINDOW MANAGEMENT & SMOOTH DRAGGING
function setupWindows() {
  const workspace = document.getElementById('workspace');
  const windows = document.querySelectorAll('.window');
  const shortcutBtns = document.querySelectorAll('.shortcut-btn');
  const startBtn = document.getElementById('start-btn');
  
  // Toggle Start Menu state (visual effect)
  startBtn.addEventListener('click', () => {
    sounds.click();
    startBtn.classList.toggle('active');
  });

  windows.forEach(win => {
    const header = win.querySelector('.window-header');
    const closeBtn = win.querySelector('.win-btn.close');
    const minBtn = win.querySelector('.win-btn.minimize');
    const maxBtn = win.querySelector('.win-btn.maximize');
    
    // Focus window on click
    win.addEventListener('mousedown', () => {
      focusWindow(win);
    });
    
    win.addEventListener('touchstart', () => {
      focusWindow(win);
    }, {passive: true});

    // Close window action
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sounds.click();
        win.classList.add('minimized');
        updateShortcutState(win.id, false);
      });
    }

    // Minimize window action
    if (minBtn) {
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sounds.click();
        win.classList.add('minimized');
        updateShortcutState(win.id, false);
      });
    }

    // Maximize window action
    if (maxBtn) {
      maxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sounds.click();
        win.classList.toggle('maximized');
      });
    }

    // Drag-and-drop mechanics (Desktop only, media query disables drag offsets)
    let isDragging = false;
    let startX, startY;
    let origX, origY;

    header.addEventListener('mousedown', (e) => {
      if (window.innerWidth <= 768) return; // Disable dragging on mobile
      if (e.target.classList.contains('win-btn')) return; // Ignore drag if button clicked
      
      isDragging = true;
      focusWindow(win);
      win.style.transition = 'none'; // Instant movement

      startX = e.clientX;
      startY = e.clientY;
      
      origX = win.offsetLeft;
      origY = win.offsetTop;
      
      document.addEventListener('mousemove', dragMove);
      document.addEventListener('mouseup', dragEnd);
      e.preventDefault();
    });

    function dragMove(e) {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      let newX = origX + dx;
      let newY = origY + dy;
      
      // Boundaries check relative to workspace
      const workspaceWidth = workspace.clientWidth;
      const workspaceHeight = workspace.clientHeight;
      
      // Prevent title bar from leaving top boundary
      if (newY < 44) newY = 44; 
      if (newY > workspaceHeight - 40) newY = workspaceHeight - 40;
      if (newX < -win.clientWidth + 100) newX = -win.clientWidth + 100;
      if (newX > workspaceWidth - 100) newX = workspaceWidth - 100;

      win.style.left = `${newX}px`;
      win.style.top = `${newY}px`;
    }

    function dragEnd() {
      if (!isDragging) return;
      isDragging = false;
      win.style.transition = ''; // Restore transitions
      document.removeEventListener('mousemove', dragMove);
      document.removeEventListener('mouseup', dragEnd);
    }
  });

  // Taskbar buttons listener
  shortcutBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sounds.click();
      const targetId = btn.getAttribute('data-target');
      const win = document.getElementById(targetId);
      
      if (win.classList.contains('minimized')) {
        win.classList.remove('minimized');
        focusWindow(win);
      } else if (state.focusedWindow === win) {
        win.classList.add('minimized');
        updateShortcutState(targetId, false);
      } else {
        focusWindow(win);
      }
    });
  });
}

function focusWindow(win) {
  if (state.focusedWindow === win) return;
  
  if (state.focusedWindow) {
    state.focusedWindow.classList.remove('active-focus');
  }
  
  state.focusedWindow = win;
  win.classList.remove('minimized');
  win.classList.add('active-focus');
  
  updateShortcutState(win.id, true);
}

function updateShortcutState(winId, isActive) {
  const btn = document.querySelector(`.shortcut-btn[data-target="${winId}"]`);
  if (!btn) return;
  
  if (isActive) {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }
}

// 6. INTERACTIVE TERMINAL ENGINE
const terminalWelcomeText = `==================================================
    ___    ____  ___    __  _____  _____ 
   /   |  / __ \\/   |  /  |/  /\\ \\/ /   |
  / /| | / / / / /| | / /|_/ /  \\  / /| |
 / ___ |/ /_/ / ___ |/ /  / /   / / ___ |
/_/  |_/_____/_/  |_/_/  /_/   /_/_/  |_|
                                         
Welcome to Adamya Terminal Core [Version 1.0.8]
Host sector: localhost:3000 (Secure SSL Encrypted)
Session status: CONNECTED AS GUEST_USER

Type "help" to get a directory list of command modules.
==================================================`;

const commands = {
  help: () => {
    return `Available command routines:
  about    - Query Developer background system variables
  skills   - Display skills catalog mapping and ratings
  projects - Query listing of deployed sub-routines
  contact  - View mail link endpoint contact form rules
  theme    - Switch desktop stylesheet skins.
             Usage: theme [cyber / matrix / classic / vapor]
  beep     - Trigger audio oscillator beep test
  date     - Query local system real-time clock
  clear    - Flush console buffer log
  bebop    - Run C:\\SYSTEM\\BEBOP.EXE secret module
  help     - Display this command dictionary`;
  },
  
  about: () => {
    return `[SYSTEM DESCRIPTION DATA RETRIEVED]
--------------------------------------------------
USERID: Adamya
CLASSIFICATION: Full-Stack Software Developer
CORE PROTOCOLS: Web Architect, Frontend Designer, System Architect
LOCATION: New Delhi, India

BIO TRANSMISSION:
  Highly passionate developer focused on responsive UI, smooth UX,
  and scalable server interfaces. Love building projects that blend
  high-end interactive aesthetics with top-tier logic execution.
  
CONTACT POINT: your.email@example.com
--------------------------------------------------`;
  },
  
  skills: () => {
    return `[SKILLS SYSTEM MAP INDEX]
--------------------------------------------------
FRONTEND INTEGRATION:
  HTML5 / CSS3  [====================] 95%
  JavaScript    [==================..] 90%
  React/NextJS  [=================...] 85%
  
BACKEND ENGINE:
  NodeJS/Express [================...] 80%
  Python/Django  [===============.....] 75%
  SQL/MongoDB    [================...] 80%
  
UTILITY SHELL:
  Git Versioning [==================..] 90%
  Docker Container [==============......] 70%
--------------------------------------------------`;
  },
  
  projects: () => {
    return `[PROJECT LOG DIRECTORY FETCHED]
--------------------------------------------------
[1] NEURAL CHAT CONSOLE
    Description: Retro style LLM chat screen simulating rolling text lines.
    Stack: React, Express, OpenAI API
    Repository: https://github.com/Adamyaaa

[2] SYNTH-WAVE CHIPTRACK
    Description: Synthesizer loop sequencer built with browser AudioNodes.
    Stack: HTML5 Canvas, Web Audio API
    Repository: https://github.com/Adamyaaa

[3] RETRO-OS SHELL DATABASE
    Description: Dashboard for custom styling configurations and profile data.
    Stack: Next.js, Tailwinds, MongoDB
    Repository: https://github.com/Adamyaaa
--------------------------------------------------`;
  },
  
  contact: () => {
    return `[ENDPOINT CONTACT INSTRUCTIONS]
--------------------------------------------------
To transmit packets directly to Adamya:
  Option A: Fill details in C:\\SYSTEM\\CONTACT.EXE form UI.
  Option B: Send standard SMTP electronic mail to your.email@example.com
  Option C: Establish direct sockets at LinkedIn / GitHub.
--------------------------------------------------`;
  },
  
  date: () => {
    return `System Clock: ${new Date().toString()}`;
  },
  
  beep: () => {
    sounds.windowOpen();
    return `Synth Oscillator beep test triggered... Done.`;
  },
  
  bebop: () => {
    sounds.success();
    return `
   🚀 C:\\SYSTEM\\BEBOP.EXE
   --------------------------------------------------
   "Whatever happens, happens." — Spike Spiegel
   
            _____     ______     ____     ____     _____  
           |  __ \\   |  ____|   |  _ \\   / __ \\   |  __ \\ 
           | |__) |  | |__      | |_) | | |  | |  | |__) |
           |  _  /   |  __|     |  _ <  | |  | |  |  ___/ 
           | | \\ \\   | |____    | |_) | | |__| |  | |     
           |_|  \\_\\  |______|   |____/   \\____/   |_|     
                                                          
   Transmission Terminated: SEE YOU SPACE COWBOY...
   --------------------------------------------------`;
  }
};

function runTerminalWelcome() {
  const history = document.getElementById('terminal-history');
  history.innerHTML = '';
  
  // Simulate typing character by character for high retro immersive feel
  let idx = 0;
  function typeWelcome() {
    if (idx < terminalWelcomeText.length) {
      history.innerHTML += terminalWelcomeText[idx];
      idx++;
      history.scrollTop = history.scrollHeight;
      setTimeout(typeWelcome, 1);
    }
  }
  typeWelcome();
}

function handleCommand(cmdLine) {
  const history = document.getElementById('terminal-history');
  const sanitized = cmdLine.trim();
  
  // Output prompt command line
  history.innerHTML += `\n<span class="terminal-prompt">guest@adamya:~$</span> ${sanitized}\n`;
  
  if (sanitized === '') {
    history.scrollTop = history.scrollHeight;
    return;
  }
  
  const tokens = sanitized.split(/\s+/);
  const cmd = tokens[0].toLowerCase();
  
  if (cmd === 'clear') {
    history.innerHTML = '';
    return;
  }
  
  if (cmd === 'theme') {
    if (tokens.length < 2) {
      history.innerHTML += `Usage: theme [cyber / matrix / classic / vapor]\nCurrent theme: ${state.activeTheme}\n`;
    } else {
      const selected = tokens[1].toLowerCase();
      const themes = {
        cyber: 'cyberpunk',
        matrix: 'matrix',
        classic: 'classic',
        vapor: 'vaporwave',
        cyberpunk: 'cyberpunk',
        vaporwave: 'vaporwave'
      };
      
      if (themes[selected]) {
        changeTheme(themes[selected]);
        history.innerHTML += `Stylesheet loaded: ${themes[selected].toUpperCase()} Skin initialized.\n`;
      } else {
        history.innerHTML += `Theme "${tokens[1]}" not found. Try cyber, matrix, classic, or vapor.\n`;
        sounds.error();
      }
    }
    history.scrollTop = history.scrollHeight;
    return;
  }
  
  if (commands[cmd]) {
    const output = commands[cmd]();
    history.innerHTML += output + "\n";
  } else {
    history.innerHTML += `Command "${cmd}" not found. Type "help" to list valid sub-routines.\n`;
    sounds.error();
  }
  
  history.scrollTop = history.scrollHeight;
}

// 7. THEME MANAGER
function changeTheme(themeName) {
  const body = document.body;
  const selector = document.getElementById('theme-selector');
  
  // Remove existing themes
  body.classList.remove('theme-matrix', 'theme-classic', 'theme-vaporwave');
  
  state.activeTheme = themeName;
  selector.value = themeName === 'cyberpunk' ? 'cyberpunk' : 
                   themeName === 'matrix' ? 'matrix' : 
                   themeName === 'classic' ? 'classic' : 'vaporwave';
  
  if (themeName !== 'cyberpunk') {
    body.classList.add(`theme-${themeName}`);
  }
  
  // Re-emit tone to signal change
  sounds.windowOpen();
}

// 8. EVENT EVENT BINDINGS
document.addEventListener('DOMContentLoaded', () => {
  // Run Boot sequence
  runBootLoader();
  
  const termInput = document.getElementById('terminal-input');
  const termHistory = document.getElementById('terminal-history');
  const soundToggle = document.getElementById('sound-toggle');
  const soundIcon = document.getElementById('sound-icon');
  const themeSelector = document.getElementById('theme-selector');
  const contactForm = document.getElementById('contact-form');
  const contactSuccess = document.getElementById('contact-success');
  const cursor = document.getElementById('custom-cursor');
  
  // Terminal keyboard events
  termInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = termInput.value;
      handleCommand(val);
      termInput.value = '';
    } else if (e.key.length === 1) {
      // Play mechanical typewriter ticks
      sounds.tick();
    }
  });

  // Focus terminal input if terminal window clicked
  document.getElementById('window-terminal').addEventListener('click', () => {
    termInput.focus();
  });

  // Sound Toggle Control
  soundToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    state.soundEnabled = !state.soundEnabled;
    soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
    initAudio();
    sounds.click();
  });

  // Dropdown Theme Selector
  themeSelector.addEventListener('change', () => {
    changeTheme(themeSelector.value);
  });

  // Contact Form Submission Action
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    initAudio();
    
    const name = document.getElementById('form-name').value;
    const email = document.getElementById('form-email').value;
    const message = document.getElementById('form-message').value;
    
    // Print submission details directly in terminal for an immersive OS experience
    const consoleLog = `\n[INCOMING DATA PACKET RECEIVED]
--------------------------------------------------
ROUTING: C:\\MAILBOX\\GUEST_MESSAGES\\
SENDER: ${name} (${email})
BODY: "${message}"
STATUS: INBOX PACKET ROUTED SUCCESSFULLY.
--------------------------------------------------`;
    
    termHistory.innerHTML += consoleLog + "\n";
    termHistory.scrollTop = termHistory.scrollHeight;
    
    sounds.success();
    
    // Transition form to success message
    contactForm.classList.add('hidden');
    contactSuccess.classList.remove('hidden');
  });

  // Custom Cursor mouse tracking
  document.addEventListener('mousemove', (e) => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
    
    // Check if hovering over interactive items to animate cursor scaling
    const target = e.target;
    const isClickable = target.matches('button, a, select, option, input, textarea, .window-header, .win-btn, .shortcut-btn');
    if (isClickable) {
      cursor.style.width = '24px';
      cursor.style.height = '24px';
      cursor.style.borderRadius = '50%';
      cursor.style.transform = 'translate(-50%, -50%) rotate(45deg)';
    } else {
      cursor.style.width = '12px';
      cursor.style.height = '20px';
      cursor.style.borderRadius = '0';
      cursor.style.transform = 'translate(-50%, -50%)';
    }
  });

  // Hide custom cursor when mouse leaves browser window
  document.addEventListener('mouseleave', () => {
    cursor.style.display = 'none';
  });
  document.addEventListener('mouseenter', () => {
    cursor.style.display = 'block';
  });

  // Start the live interactive canvas background
  initInteractiveBackground();
});

// 9. LIVE INTERACTIVE CANVAS BACKGROUND ENGINE
function initInteractiveBackground() {
  const canvas = document.getElementById('workspace-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const workspace = document.getElementById('workspace');

  let width, height;
  const mouse = { x: 0, y: 0, active: false };

  function resize() {
    width = canvas.width = workspace.clientWidth;
    height = canvas.height = workspace.clientHeight;
  }
  resize();
  window.addEventListener('resize', resize);



  // State caches for animations
  let matrixDrops = [];
  let cyberpunkGridPhase = 0;
  let vaporwaveGridPhase = 0;
  let classicParticles = [];
  let stars = [];

  // A. Matrix Setup
  function initMatrix() {
    matrixDrops = [];
    const columns = Math.ceil(width / 16);
    for (let i = 0; i < columns; i++) {
      matrixDrops.push({
        x: i * 16,
        y: Math.random() * -height,
        speed: 2 + Math.random() * 4,
        chars: "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ1234567890QWERTYUIOPASDFGHJKLZXCVBNM".split("")
      });
    }
  }

  // B. Classic Constellation Setup
  function initClassic() {
    classicParticles = [];
    const count = Math.min(50, Math.floor((width * height) / 18000));
    for (let i = 0; i < count; i++) {
      classicParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: 1.5 + Math.random() * 2
      });
    }
  }

  // C. Cyberpunk & Vaporwave Stars Setup
  function initStars() {
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({
        x: (Math.random() - 0.5) * width,
        y: (Math.random() - 0.5) * height,
        z: Math.random() * width,
        color: Math.random() > 0.45 ? '#00e5ff' : '#ff2d78'
      });
    }
  }

  function setupActiveTheme() {
    if (state.activeTheme === 'matrix') {
      initMatrix();
    } else if (state.activeTheme === 'classic') {
      initClassic();
    } else {
      initStars();
    }
  }
  
  setupActiveTheme();

  // Intercept external theme switching to re-seed state structures
  const originalChangeTheme = changeTheme;
  changeTheme = function(themeName) {
    originalChangeTheme(themeName);
    setupActiveTheme();
  };

  // 1. Theme: MATRIX (Digital Rain)
  function drawMatrix() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, width, height);

    ctx.font = '16px monospace';
    const isClassic = document.body.classList.contains('theme-classic');
    ctx.fillStyle = isClassic ? '#1a1a1a' : '#39ff14';
    
    if (matrixDrops.length === 0) initMatrix();

    for (let i = 0; i < matrixDrops.length; i++) {
      const drop = matrixDrops[i];
      const char = drop.chars[Math.floor(Math.random() * drop.chars.length)];
      ctx.fillText(char, drop.x, drop.y);
      drop.y += drop.speed;

      if (drop.y > height && Math.random() > 0.975) {
        drop.y = Math.random() * -100;
      }
    }
  }

  // 2. Theme: CYBERPUNK (3D Grid & Starfield)
  function drawCyberpunk() {
    ctx.fillStyle = '#080312';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height * 0.4;
    
    // Starfield Warp - Update positions
    if (stars.length === 0) initStars();
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.z -= 3;
      if (s.z <= 0) {
        s.z = width;
        s.x = (Math.random() - 0.5) * width;
        s.y = (Math.random() - 0.5) * height;
      }
    }

    // Draw Cyan stars (Batch 1)
    ctx.fillStyle = '#00e5ff';
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      if (s.color !== '#00e5ff') continue;
      const k = 100 / s.z;
      const px = Math.round(s.x * k + centerX);
      const py = Math.round(s.y * k + centerY);
      const size = Math.max(1, Math.round((1 - s.z / width) * 4));
      ctx.fillRect(px - Math.round(size/2), py - Math.round(size/2), size, size);
    }

    // Draw Pink stars (Batch 2)
    ctx.fillStyle = '#ff2d78';
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      if (s.color !== '#ff2d78') continue;
      const k = 100 / s.z;
      const px = Math.round(s.x * k + centerX);
      const py = Math.round(s.y * k + centerY);
      const size = Math.max(1, Math.round((1 - s.z / width) * 4));
      ctx.fillRect(px - Math.round(size/2), py - Math.round(size/2), size, size);
    }

    const gridStartY = height * 0.45;
    const vanishX = centerX;
    const vanishY = centerY;

    // 3D Perspective Grid - Vertical lines batched
    ctx.strokeStyle = '#ff2d78';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const lineCount = 20;
    for (let i = 0; i <= lineCount; i++) {
      const angleRatio = i / lineCount;
      const endX = Math.round(width * (angleRatio * 2 - 0.5));
      ctx.moveTo(vanishX, vanishY);
      ctx.lineTo(endX, height);
    }
    ctx.stroke();

    // Horizontal sliding gridlines - batched and Y perspective rounded to prevent subpixel anti-aliasing lag
    cyberpunkGridPhase += 0.6;
    if (cyberpunkGridPhase >= 40) cyberpunkGridPhase = 0;

    const baseOffset = Math.round(cyberpunkGridPhase);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let yOffset = baseOffset; yOffset < height - gridStartY; yOffset += 28) {
      const normY = yOffset / (height - gridStartY);
      const gridY = Math.round(gridStartY + (height - gridStartY) * Math.pow(normY, 2.2));
      
      const widthRatio = (gridY - vanishY) / (height - vanishY);
      const startX = Math.round(vanishX + (-width * 0.5 - vanishX) * widthRatio);
      const endX = Math.round(vanishX + (width * 1.5 - vanishX) * widthRatio);

      ctx.moveTo(startX, gridY);
      ctx.lineTo(endX, gridY);
    }
    ctx.stroke();
  }

  // 3. Theme: VAPORWAVE (Sunset Horizon & Drift)
  function drawVaporwave() {
    ctx.fillStyle = '#0a0212';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height * 0.45;
    const sunRadius = Math.min(90, width * 0.15);

    // Sunset Gradient (Orange to Magenta)
    const sunGrad = ctx.createLinearGradient(centerX, centerY - sunRadius, centerX, centerY + sunRadius);
    sunGrad.addColorStop(0, '#f5d020');
    sunGrad.addColorStop(1, '#ff2d78');
    ctx.fillStyle = sunGrad;

    ctx.beginPath();
    ctx.arc(centerX, centerY, sunRadius, 0, Math.PI, true);
    ctx.fill();

    // Retro stripe slices - rounded Y and height for sharpness
    ctx.fillStyle = '#0a0212';
    for (let y = centerY - sunRadius; y < centerY; y += 8) {
      const sliceHeight = Math.max(1, (y - (centerY - sunRadius)) / 12);
      ctx.fillRect(Math.round(centerX - sunRadius - 10), Math.round(y), Math.round(sunRadius * 2 + 20), Math.round(sliceHeight));
    }

    const vanishX = centerX;
    const vanishY = centerY;

    // Grid wireframe - batched and rounded
    ctx.strokeStyle = '#b44fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const lineCount = 18;
    for (let i = 0; i <= lineCount; i++) {
      const ratio = i / lineCount;
      const endX = Math.round(width * (ratio * 1.8 - 0.4));
      ctx.moveTo(vanishX, vanishY);
      ctx.lineTo(endX, height);
    }
    ctx.stroke();

    // Sliding horizontal lines - Y perspective rounded for crisp renders
    vaporwaveGridPhase += 0.4;
    if (vaporwaveGridPhase >= 25) vaporwaveGridPhase = 0;
    
    const baseOffset = Math.round(vaporwaveGridPhase);
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = baseOffset; i < height - vanishY; i += 20) {
      const normY = i / (height - vanishY);
      const gridY = Math.round(vanishY + (height - vanishY) * Math.pow(normY, 2));
      
      const widthRatio = (gridY - vanishY) / (height - vanishY);
      const startX = Math.round(vanishX + (-width * 0.4 - vanishX) * widthRatio);
      const endX = Math.round(vanishX + (width * 1.4 - vanishX) * widthRatio);

      ctx.moveTo(startX, gridY);
      ctx.lineTo(endX, gridY);
    }
    ctx.stroke();

    // Drifting float particles - drawn as small squares at rounded coordinates
    if (stars.length === 0) initStars();
    ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
    for (let i = 0; i < 25; i++) {
      const p = stars[i];
      p.y -= 0.6;
      if (p.y < 0) {
        p.y = height;
        p.x = Math.random() * width;
      }
      ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 1), 2, 2);
    }
  }

  // 4. Theme: CLASSIC (Constellation Grid)
  function drawClassic() {
    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(0, 0, width, height);

    if (classicParticles.length === 0) initClassic();

    const isClassicMode = document.body.classList.contains('theme-classic');
    const pColor = isClassicMode ? 'rgba(26, 26, 26, 0.65)' : 'rgba(0, 85, 255, 0.65)';
    const lColor = isClassicMode ? 'rgba(26, 26, 26, 0.12)' : 'rgba(0, 85, 255, 0.1)';

    for (let i = 0; i < classicParticles.length; i++) {
      const p = classicParticles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;

      ctx.fillStyle = pColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render connection lines - Batched into a single stroke call (massive speedup)
    ctx.strokeStyle = lColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < classicParticles.length; i++) {
      const p1 = classicParticles[i];
      for (let j = i + 1; j < classicParticles.length; j++) {
        const p2 = classicParticles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 100) {
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
        }
      }
    }
    ctx.stroke();
  }

  function loop() {
    if (state.activeTheme === 'matrix') {
      drawMatrix();
    } else if (state.activeTheme === 'classic') {
      drawClassic();
    } else if (state.activeTheme === 'vaporwave') {
      drawVaporwave();
    } else {
      drawCyberpunk();
    }
    requestAnimationFrame(loop);
  }

  loop();
}
