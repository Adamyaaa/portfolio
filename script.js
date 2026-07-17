/*
  Adamya.OS - Core JavaScript Engine
  Includes Draggable Windows, Audio Synthesis, Boot Loader, and Terminal Parser
*/

// 1. STATE & GLOBAL VARIABLES
const state = {
  activeTheme: 'classic',
  soundEnabled: true,
  audioCtx: null,
  focusedWindow: null,
  windowPositions: {},
  terminalHistory: [],
  commandHistory: [],
  historyPointer: 0
};

// 1.5 HTML ESCAPING (prevents injected markup from user-typed input)
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

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
  windowClose: () => {
    playTone(392.00, 'triangle', 0.08, 0.03); // G4
    setTimeout(() => playTone(261.63, 'triangle', 0.12, 0.03), 80); // C4
  },
  windowMinimize: () => {
    playTone(329.63, 'triangle', 0.05, 0.03); // E4
    setTimeout(() => playTone(196.00, 'triangle', 0.1, 0.03), 50); // G3
  },
  windowMaximize: () => {
    playTone(261.63, 'triangle', 0.06, 0.03); // C4
    setTimeout(() => playTone(392.00, 'triangle', 0.06, 0.03), 60); // G4
    setTimeout(() => playTone(523.25, 'triangle', 0.12, 0.03), 120); // C5
  },
  powerOn: () => {
    if (!state.soundEnabled || !state.audioCtx) return;
    playTone(196.00, 'sine', 0.08, 0.05); // G3
    setTimeout(() => playTone(261.63, 'sine', 0.08, 0.05), 80); // C4
    setTimeout(() => playTone(329.63, 'sine', 0.08, 0.05), 160); // E4
    setTimeout(() => playTone(392.00, 'sine', 0.08, 0.05), 240); // G4
    setTimeout(() => playTone(523.25, 'sine', 0.25, 0.05), 320); // C5
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

    // Only the terminal is open by default; focus it
    focusWindow(document.getElementById('window-terminal'));

    // Run terminal welcoming typing effect
    runTerminalWelcome();
    
    // Play window opening arpeggio
    setTimeout(sounds.windowOpen, 300);
  }, 800);
}

// 4.5 SYSTEM POWER AND PROCESS CONTROLLERS
function shutdownOS() {
  initAudio();
  sounds.windowClose();
  const desktop = document.getElementById('desktop');
  desktop.classList.add('shutdown');
  
  setTimeout(() => {
    desktop.classList.add('hidden');
    desktop.classList.remove('shutdown');
    
    // Reset windows so only the terminal is open on next boot
    const windows = document.querySelectorAll('.window');
    windows.forEach(win => {
      win.classList.remove('maximized');
      win.classList.toggle('minimized', win.id !== 'window-terminal');
    });

    document.getElementById('power-screen').classList.remove('hidden');
  }, 650);
}

function rebootOS() {
  initAudio();
  sounds.windowClose();
  const desktop = document.getElementById('desktop');
  desktop.classList.add('shutdown');
  
  setTimeout(() => {
    desktop.classList.add('hidden');
    desktop.classList.remove('shutdown');
    
    // Clear terminal history
    const history = document.getElementById('terminal-history');
    if (history) history.innerHTML = '';
    
    // Reset windows so only the terminal is open on next boot
    const windows = document.querySelectorAll('.window');
    windows.forEach(win => {
      win.classList.remove('maximized');
      win.classList.toggle('minimized', win.id !== 'window-terminal');
    });

    // Boot loader reset and launch
    const bootLoader = document.getElementById('boot-loader');
    const bootLog = document.getElementById('boot-log');
    const bootPrompt = document.getElementById('boot-prompt');
    
    bootLog.innerHTML = '';
    bootPrompt.classList.add('hidden');
    bootLoader.classList.remove('fade-out');
    bootLoader.style.display = 'flex';
    
    runBootLoader();
  }, 650);
}

function executeProject(projectId) {
  initAudio();
  sounds.windowOpen();
  
  // Check if already open
  const existing = document.getElementById(`window-exec-${projectId}`);
  if (existing) {
    focusWindow(existing);
    return;
  }
  
  const execWindow = document.createElement('div');
  execWindow.id = `window-exec-${projectId}`;
  execWindow.className = 'window active';
  execWindow.style.top = '20%';
  execWindow.style.left = '25%';
  execWindow.style.width = '42%';
  execWindow.style.height = '50%';
  execWindow.setAttribute('data-workspace', '');
  
  let title = '';
  let customBodyHTML = '';
  let runLogic = () => {};
  let cleanupLogic = () => {};
  
  if (projectId === 'chat') {
    title = 'C:\\SYSTEM\\CHAT_SIMULATOR.EXE';
    customBodyHTML = `
      <div class="terminal-body" style="height: 100%; display: flex; flex-direction: column;">
        <div class="exec-log" style="flex-grow: 1; overflow-y: auto; font-family: var(--font-pixel); font-size: 18px; margin-bottom: 8px;"></div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span>guest@neural:~$</span>
          <input type="text" class="exec-input" style="flex-grow: 1; background: none; border: none; outline: none; color: inherit; font-family: inherit; font-size: inherit;" placeholder="Ask AI something..." autofocus>
        </div>
      </div>
    `;
    runLogic = (container) => {
      const log = container.querySelector('.exec-log');
      const input = container.querySelector('.exec-input');
      
      log.innerHTML = `[NEURAL CHAT CONSOLE INITIALIZED]\nCONNECTING SECURE API ENDPOINT... CONNECTED.\nTYPE A PROMPT BELOW AND TRANSMIT.\n\n`;
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const prompt = input.value.trim();
          if (prompt === '') return;
          input.value = '';
          sounds.tick();
          
          log.innerHTML += `\nuser> ${escapeHtml(prompt)}\n`;
          log.scrollTop = log.scrollHeight;
          
          setTimeout(() => {
            sounds.success();
            const responses = [
              "PROCESSING VECTOR SHIFTS... HELLO GUEST. I AM THE NEURAL CORE INTELLECT.",
              "RETRIEVING FROM DATABASE SECTOR 9... DATA VERIFIED.",
              "ERROR 404: EMOTION CHIP NOT DETECTED. RETURNING PURE MATHEMATICAL LOGIC.",
              "ANALYZING NEURAL DYNAMICS... THE ANSWER IS 42.",
              "RETRO MONITOR SHIFT... INCOMING SIGNALS DETECTED. ENJOYING THE INTERFACE?"
            ];
            const resp = responses[Math.floor(Math.random() * responses.length)];
            log.innerHTML += `system> ${resp}\n`;
            log.scrollTop = log.scrollHeight;
          }, 600);
        }
      });
    };
  } else if (projectId === 'synth') {
    title = 'C:\\SYSTEM\\SYNTH_CHIPTRACK.EXE';
    customBodyHTML = `
      <div class="default-body" style="height: 100%; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center;">
        <h3 class="section-title" style="width:100%;">Web Audio Sequencer</h3>
        <div class="synth-visualizer" style="display: flex; gap: 6px; height: 80px; align-items: flex-end; margin-bottom: 20px; width: 100%; justify-content: center;">
          <div class="visual-bar" style="width: 20px; height: 10px; background-color: var(--text-color);"></div>
          <div class="visual-bar" style="width: 20px; height: 10px; background-color: var(--text-secondary);"></div>
          <div class="visual-bar" style="width: 20px; height: 10px; background-color: var(--theme-color);"></div>
          <div class="visual-bar" style="width: 20px; height: 10px; background-color: var(--text-color);"></div>
          <div class="visual-bar" style="width: 20px; height: 10px; background-color: var(--text-secondary);"></div>
          <div class="visual-bar" style="width: 20px; height: 10px; background-color: var(--theme-color);"></div>
        </div>
        <p style="font-size: 12px; margin-bottom: 12px;">Synthesizing 8-Bit Chiptune loops...</p>
        <button class="synth-play-btn" style="padding: 8px 16px; border: 2px solid var(--btn-border); background-color: var(--btn-bg); color: var(--btn-text); font-family: var(--font-retro); font-size: 10px; box-shadow: var(--btn-shadow);">PLAY LOOP</button>
      </div>
    `;
    runLogic = (container) => {
      const playBtn = container.querySelector('.synth-play-btn');
      const bars = container.querySelectorAll('.visual-bar');
      let playInterval = null;
      let isPlaying = false;
      let notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
      
      playBtn.addEventListener('click', () => {
        initAudio();
        if (isPlaying) {
          isPlaying = false;
          playBtn.textContent = 'PLAY LOOP';
          clearInterval(playInterval);
          bars.forEach(b => b.style.height = '10px');
        } else {
          isPlaying = true;
          playBtn.textContent = 'STOP LOOP';
          playInterval = setInterval(() => {
            const freq = notes[Math.floor(Math.random() * notes.length)];
            playTone(freq, 'square', 0.15, 0.04);
            
            bars.forEach((b) => {
              const h = 10 + Math.random() * 60;
              b.style.height = `${h}px`;
            });
          }, 180);
        }
      });
      
      cleanupLogic = () => {
        if (playInterval) clearInterval(playInterval);
      };
    };
  } else {
    title = 'C:\\SYSTEM\\DATABASE_SHELL.EXE';
    customBodyHTML = `
      <div class="terminal-body" style="height: 100%; display: flex; flex-direction: column; font-size:16px;">
        <div class="db-log" style="flex-grow: 1; overflow-y: auto; font-family: var(--font-pixel);"></div>
        <button class="db-query-btn" style="align-self: center; margin-top: 10px; padding: 6px 12px; border: 2px solid var(--btn-border); background-color: var(--btn-bg); color: var(--btn-text); font-family: var(--font-retro); font-size: 8px;">GET CUSTOM_STYLES</button>
      </div>
    `;
    runLogic = (container) => {
      const log = container.querySelector('.db-log');
      const btn = container.querySelector('.db-query-btn');
      
      log.innerHTML = `[CONNECTING TO MONGODB LOCALHOST SHELL...]\nCONNECTED SECTOR: portfolio_db_shard_01\n\n`;
      
      btn.addEventListener('click', () => {
        sounds.click();
        log.innerHTML += `> db.custom_settings.find().pretty()\n`;
        setTimeout(() => {
          sounds.success();
          const jsonStr = JSON.stringify({
            _id: "6a89c91b4ffc",
            active_theme: state.activeTheme,
            sound_enabled: state.soundEnabled,
            user_session: "GUEST_USER_101",
            host: "localhost:3000",
            os_version: "ADAMYA.OS v1.0.8",
            network_protocol: "SSL Secure Node"
          }, null, 2);
          log.innerHTML += `${jsonStr}\n\n`;
          log.scrollTop = log.scrollHeight;
        }, 300);
      });
    };
  }
  
  execWindow.innerHTML = `
    <div class="window-header">
      <div class="window-title">
        <span class="win-icon">⚙️</span> ${title}
      </div>
      <div class="window-controls">
        <button class="win-btn close" title="Close">X</button>
      </div>
    </div>
    <div class="window-body" style="display:flex; flex-direction:column; overflow:hidden;">
      ${customBodyHTML}
    </div>
  `;
  
  const workspace = document.getElementById('workspace');
  workspace.appendChild(execWindow);
  
  // Draggable header
  const header = execWindow.querySelector('.window-header');
  const closeBtn = execWindow.querySelector('.win-btn.close');
  
  execWindow.addEventListener('mousedown', () => {
    focusWindow(execWindow);
  });
  
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sounds.windowClose();
    cleanupLogic();
    execWindow.remove();
  });
  
  // Drag setup
  let isDragging = false;
  let startX, startY;
  let origX, origY;

  header.addEventListener('mousedown', (e) => {
    if (window.innerWidth <= 768) return;
    if (e.target.classList.contains('win-btn')) return;
    
    isDragging = true;
    focusWindow(execWindow);
    execWindow.style.transition = 'none';

    startX = e.clientX;
    startY = e.clientY;
    
    origX = execWindow.offsetLeft;
    origY = execWindow.offsetTop;
    
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
    
    if (newY < 44) newY = 44;
    execWindow.style.left = `${newX}px`;
    execWindow.style.top = `${newY}px`;
  }

  function dragEnd() {
    isDragging = false;
    execWindow.style.transition = '';
    document.removeEventListener('mousemove', dragMove);
    document.removeEventListener('mouseup', dragEnd);
  }
  
  focusWindow(execWindow);
  runLogic(execWindow);
}

// 5. WINDOW MANAGEMENT & SMOOTH DRAGGING
function setupWindows() {
  const workspace = document.getElementById('workspace');
  const windows = document.querySelectorAll('.window');
  const shortcutBtns = document.querySelectorAll('.shortcut-btn');
  const startBtn = document.getElementById('start-btn');
  
  // Toggle Start Menu state
  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sounds.click();
    const startMenu = document.getElementById('start-menu');
    const isHidden = startMenu.classList.toggle('hidden');
    if (!isHidden) {
      startBtn.classList.add('active');
    } else {
      startBtn.classList.remove('active');
    }
  });

  // Close Start Menu on outside click
  document.addEventListener('click', (e) => {
    const startMenu = document.getElementById('start-menu');
    const startBtn = document.getElementById('start-btn');
    if (!startMenu.classList.contains('hidden')) {
      if (!startMenu.contains(e.target) && !startBtn.contains(e.target)) {
        startMenu.classList.add('hidden');
        startBtn.classList.remove('active');
      }
    }
  });

  // Start menu items click actions
  const startMenuItems = document.querySelectorAll('.start-menu-item');
  startMenuItems.forEach(item => {
    if (item.classList.contains('system-control')) return;
    item.addEventListener('click', () => {
      sounds.click();
      const targetId = item.getAttribute('data-target');
      const win = document.getElementById(targetId);
      if (win) {
        win.classList.remove('minimized');
        focusWindow(win);
      }
      document.getElementById('start-menu').classList.add('hidden');
      document.getElementById('start-btn').classList.remove('active');
    });
  });

  // Mobile submenu touch expansion
  const submenuTrigger = document.querySelector('.start-menu-submenu-trigger');
  if (submenuTrigger) {
    submenuTrigger.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        e.stopPropagation();
        submenuTrigger.classList.toggle('active-submenu');
      }
    });
  }

  // Theme submenu items
  const themeSubmenuItems = document.querySelectorAll('.submenu-item');
  themeSubmenuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      sounds.click();
      const newTheme = item.getAttribute('data-theme');
      changeTheme(newTheme);
      document.getElementById('start-menu').classList.add('hidden');
      document.getElementById('start-btn').classList.remove('active');
    });
  });

  // Restart System
  document.getElementById('menu-restart').addEventListener('click', () => {
    sounds.click();
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('start-btn').classList.remove('active');
    rebootOS();
  });

  // Shut Down System
  document.getElementById('menu-shutdown').addEventListener('click', () => {
    sounds.click();
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('start-btn').classList.remove('active');
    shutdownOS();
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
        sounds.windowClose();
        win.classList.add('minimized');
        updateShortcutState(win.id, false);
      });
    }

    // Minimize window action
    if (minBtn) {
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sounds.windowMinimize();
        win.classList.add('minimized');
        updateShortcutState(win.id, false);
      });
    }

    // Maximize window action
    if (maxBtn) {
      maxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sounds.windowMaximize();
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
             Usage: theme [classic / vapor]
  beep     - Trigger audio oscillator beep test
  date     - Query local system real-time clock
  clear    - Flush console buffer log
  restart  - Warm reboot the system diagnostics sequencer
  shutdown - Perform screen collapse system power down
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
PROGRAMMING LANGUAGES:
  C, C++, Python, JavaScript, TypeScript, SQL

FRONTEND:
  React.js, Next.js, TailwindCSS, HTML, CSS

BACKEND:
  Node.js, Express.js, REST APIs, Microservices

DATABASE SYSTEMS:
  MongoDB, MySQL, PostgreSQL

TOOLS & PLATFORMS:
  Git, GitHub, Docker, Vercel, Figma

CORE CS:
  DSA, OOPS, DBMS, OS, Computer Networks
--------------------------------------------------`;
  },

  projects: () => {
    return `[PROJECT LOG DIRECTORY FETCHED]
--------------------------------------------------
[1] LLM FAILOVER & CONTEXT HANDOVER EXTENSION
    Description: Chrome Extension automating conversation migration
    across Claude, ChatGPT, and Gemini with 6 failover paths and full
    chat-history preservation.
    Stack: JavaScript, Manifest V3, Chrome APIs, Shadow DOM, Puppeteer
    Repository: https://github.com/Adamyaaa/LLM-failover-handover

[2] VERICODE (DIGITAL LOGIC & HDL PLATFORM)
    Description: Cloud-based Verilog compiler generating interactive
    signal waveforms in under 2 seconds, with a nested-reply discussion
    forum and role-based moderation.
    Stack: React, Node.js, Express, MongoDB, Firebase, JDoodle API
    Live Link: https://ece-platform.vercel.app

[3] SUBSCRIPTION MANAGEMENT BACKEND
    Description: RESTful Node.js/Express backend with 16 endpoints,
    MVC and microservices patterns, JWT auth, and bcrypt hashing.
    Stack: Node.js, Express.js, MongoDB, Mongoose, JWT, Bcrypt
    Repository: https://github.com/Adamyaaa/subsciption-manager

[4] SHOP-LEE (SHOPPING PLATFORM)
    Description: Next.js e-commerce storefront with product browsing,
    cart management, and checkout flows.
    Stack: Next.js
    Repository: https://github.com/Adamyaaa/Shop-lee
    Live Link: https://shoplee-three.vercel.app/

[5] SUPERVISOR MULTI-AGENT WORKFLOW
    Description: LangGraph multi-agent demos - subgraphs with shared
    and transformed state, plus a Supervisor-Worker system routing
    between Enhancer, Researcher, and Coder agents with a Validator
    quality-check loop.
    Stack: Python, LangGraph, LangChain, OpenAI, Tavily
    Repository: https://github.com/Adamyaaa/Supervisor-multi-agent-workflow
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
  history.innerHTML += `\n<span class="terminal-prompt">guest@adamya:~$</span> ${escapeHtml(sanitized)}\n`;
  
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

  if (cmd === 'reboot' || cmd === 'restart') {
    history.innerHTML += `Initializing system warm reboot...\n`;
    setTimeout(rebootOS, 600);
    return;
  }
  
  if (cmd === 'shutdown' || cmd === 'off') {
    history.innerHTML += `Terminating Adamya.OS processes... Goodbye.\n`;
    setTimeout(shutdownOS, 600);
    return;
  }
  
  if (cmd === 'theme') {
    if (tokens.length < 2) {
      history.innerHTML += `Usage: theme [classic / vapor]\nCurrent theme: ${state.activeTheme}\n`;
    } else {
      const selected = tokens[1].toLowerCase();
      const themes = {
        classic: 'classic',
        vapor: 'vaporwave',
        vaporwave: 'vaporwave'
      };

      if (themes[selected]) {
        changeTheme(themes[selected]);
        history.innerHTML += `Stylesheet loaded: ${themes[selected].toUpperCase()} Skin initialized.\n`;
      } else {
        history.innerHTML += `Theme "${escapeHtml(tokens[1])}" not found. Try classic or vapor.\n`;
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
    history.innerHTML += `Command "${escapeHtml(cmd)}" not found. Type "help" to list valid sub-routines.\n`;
    sounds.error();
  }
  
  history.scrollTop = history.scrollHeight;
}

// 7. THEME MANAGER
function changeTheme(themeName) {
  const body = document.body;
  const selector = document.getElementById('theme-selector');

  // Remove existing themes
  body.classList.remove('theme-vaporwave');

  state.activeTheme = themeName;
  selector.value = themeName;

  if (themeName !== 'classic') {
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
  
  // Terminal keyboard events (with history and autocomplete)
  termInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = termInput.value;
      if (val.trim() !== '') {
        if (state.commandHistory.length === 0 || state.commandHistory[state.commandHistory.length - 1] !== val) {
          state.commandHistory.push(val);
        }
        state.historyPointer = state.commandHistory.length;
      }
      handleCommand(val);
      termInput.value = '';
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (state.commandHistory.length > 0 && state.historyPointer > 0) {
        state.historyPointer--;
        termInput.value = state.commandHistory[state.historyPointer];
      }
      sounds.tick();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (state.historyPointer < state.commandHistory.length - 1) {
        state.historyPointer++;
        termInput.value = state.commandHistory[state.historyPointer];
      } else {
        state.historyPointer = state.commandHistory.length;
        termInput.value = '';
      }
      sounds.tick();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const val = termInput.value.trim().toLowerCase();
      const availableCmds = Object.keys(commands).concat(['clear', 'theme', 'reboot', 'restart', 'shutdown', 'off']);
      
      if (val === '') {
        termHistory.innerHTML += `\nAvailable commands: ${availableCmds.join(', ')}\n`;
        termHistory.scrollTop = termHistory.scrollHeight;
        sounds.tick();
        return;
      }

      const matches = availableCmds.filter(c => c.startsWith(val));
      if (matches.length === 1) {
        termInput.value = matches[0] + ' ';
        sounds.success();
      } else if (matches.length > 1) {
        termHistory.innerHTML += `\nMatches: ${matches.join(', ')}\n`;
        termHistory.scrollTop = termHistory.scrollHeight;
        sounds.tick();
      } else {
        sounds.error();
      }
    } else if (e.key.length === 1) {
      sounds.tick();
    }
  });

  // Focus terminal input if terminal window clicked
  document.getElementById('window-terminal').addEventListener('click', () => {
    termInput.focus();
  });

  // Project Executor Triggers
  const projectTriggers = document.querySelectorAll('.exec-project-trigger');
  projectTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const pId = trigger.getAttribute('data-project');
      executeProject(pId);
    });
  });

  // Power Screen Turn On Trigger
  document.getElementById('power-on-btn').addEventListener('click', () => {
    document.getElementById('power-screen').classList.add('hidden');
    
    initAudio();
    if (state.audioCtx && state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }
    sounds.powerOn();
    
    const bootLoader = document.getElementById('boot-loader');
    const bootLog = document.getElementById('boot-log');
    const bootPrompt = document.getElementById('boot-prompt');
    
    bootLog.innerHTML = '';
    bootPrompt.classList.add('hidden');
    bootLoader.classList.remove('fade-out');
    bootLoader.style.display = 'flex';
    
    runBootLoader();
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
    
    const name = escapeHtml(document.getElementById('form-name').value);
    const email = escapeHtml(document.getElementById('form-email').value);
    const message = escapeHtml(document.getElementById('form-message').value);

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
  let vaporwaveGridPhase = 0;
  let classicParticles = [];
  let stars = [];

  // A. Classic Constellation Setup
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

  // B. Vaporwave Drifting Particles Setup
  function initStars() {
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({
        x: (Math.random() - 0.5) * width,
        y: (Math.random() - 0.5) * height,
        z: Math.random() * width
      });
    }
  }

  function setupActiveTheme() {
    if (state.activeTheme === 'classic') {
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

  // 1. Theme: VAPORWAVE (Sunset Horizon & Drift)
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

    const pColor = 'rgba(26, 26, 26, 0.65)';
    const lColor = 'rgba(26, 26, 26, 0.12)';

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
    if (state.activeTheme === 'classic') {
      drawClassic();
    } else {
      drawVaporwave();
    }
    requestAnimationFrame(loop);
  }

  loop();
}
