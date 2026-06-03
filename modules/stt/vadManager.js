'use strict';
/**
 * ARVSAL VAD Manager
 * ==================
 * Node.js bridge between audio endpoints and the Silero VAD Python worker.
 *
 * Architecture per ARVSAL_SILERO_VAD_IMPLEMENTATION_SPEC.md:
 *   /audio/final  → spawn-per-request  (mode: 'spawn')
 *   /audio/stream → persistent worker  (mode: 'persistent')
 *   /audio        → spawn-per-request  (mode: 'spawn')
 *
 * ALL failure paths are FAIL-OPEN: if VAD cannot produce a result for any
 * reason, it returns PASS_THROUGH so Whisper handles audio as before.
 */

const { spawn, execFile } = require('child_process');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const readline = require('readline');

// ── Config accessors (read fresh per call so .env hot-changes work) ──────────

const isEnabled    = () => (process.env.ARVSAL_ENABLE_VAD ?? 'true') === 'true';
const getThreshold = () => parseFloat(process.env.ARVSAL_VAD_THRESHOLD   ?? '0.35');
const getMinMs     = () => parseInt(process.env.ARVSAL_VAD_MIN_SPEECH_MS  ?? '400', 10);
const getTimeoutMs = () => parseInt(process.env.ARVSAL_VAD_WORKER_TIMEOUT_MS ?? '3000', 10);

const WORKER_SCRIPT      = path.resolve(__dirname, '..', '..', 'backend', 'python_worker', 'vad_worker.py');
const MAX_RESTARTS       = 3;
const RESTART_BACKOFF_MS = 1000;

// ── Fail-open sentinel ───────────────────────────────────────────────────────

const PASS_THROUGH = Object.freeze({ pass: true, speechStartMs: null, speechEndMs: null });

// ── Python executable resolution ─────────────────────────────────────────────

function findPythonExec() {
  const override = process.env.ARVSAL_VAD_PYTHON_OVERRIDE;
  if (override && fs.existsSync(override)) return override;

  const localAppData = process.env.LOCALAPPDATA
    || path.join(os.homedir(), 'AppData', 'Local');
  const avaRoot = path.join(localAppData, 'AVAListener', 'runtime');

  const candidates = [
    path.join(avaRoot, 'python.exe'),
    path.join(avaRoot, 'Scripts', 'python.exe'),
    path.join(avaRoot, 'bin', 'python'),
    path.join(avaRoot, 'python', 'bin', 'python'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  return process.platform === 'win32' ? 'python' : 'python3';
}

// ── Persistent worker state ───────────────────────────────────────────────────

let _proc          = null;   // child process
let _rl            = null;   // readline interface
let _workerReady   = false;
let _restartCount  = 0;
let _pendingReq    = null;   // { id, resolve, timer }
let _workerQueue   = Promise.resolve();  // serialisation mutex

// ── Persistent worker startup ─────────────────────────────────────────────────

async function startPersistentWorker() {
  if (!isEnabled()) {
    console.log('[VAD] DISABLED — persistent worker not started');
    return;
  }
  if (_proc || _workerReady) return;
  await _spawnWorker();
}

async function _spawnWorker() {
  return new Promise((resolve) => {
    const python = findPythonExec();
    console.log(`[VAD] Spawning persistent worker: ${python} ${WORKER_SCRIPT}`);

    let proc;
    try {
      proc = spawn(python, [WORKER_SCRIPT, '--persistent'], {
        stdio: ['pipe', 'pipe', 'inherit'],
      });
    } catch (err) {
      console.warn('[VAD] Failed to spawn worker process:', err.message);
      return resolve();
    }

    const rl = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });

    // ── First line must be the ready signal ──────────────────────────────────
    const startupTimer = setTimeout(() => {
      console.warn('[VAD] Worker startup timeout — VAD disabled for stream endpoint');
      proc.kill();
      resolve();
    }, 15000);

    rl.once('line', (line) => {
      clearTimeout(startupTimer);
      try {
        const msg = JSON.parse(line.trim());
        if (msg.ready === true) {
          _proc        = proc;
          _rl          = rl;
          _workerReady = true;
          _restartCount = 0;
          console.log('[VAD] persistent worker ready ✓');
          rl.on('line', _onWorkerLine);
        } else {
          console.warn('[VAD] Worker startup failed:', msg.error || msg.message || line);
          proc.kill();
        }
      } catch {
        console.warn('[VAD] Worker sent invalid startup JSON:', line);
        proc.kill();
      }
      resolve();
    });

    proc.on('error', (err) => {
      clearTimeout(startupTimer);
      console.warn('[VAD] Worker spawn error:', err.message);
      resolve();
    });

    proc.on('exit', (code, signal) => {
      console.warn(`[VAD] Worker exited code=${code} signal=${signal}`);
      _proc        = null;
      _rl          = null;
      _workerReady = false;

      // Fail any in-flight request open
      if (_pendingReq) {
        const { resolve: res, timer } = _pendingReq;
        _pendingReq = null;
        clearTimeout(timer);
        res(PASS_THROUGH);
      }

      // Auto-restart
      if (_restartCount < MAX_RESTARTS) {
        _restartCount++;
        const delay = RESTART_BACKOFF_MS * _restartCount;
        console.log(`[VAD] Auto-restarting worker in ${delay}ms (${_restartCount}/${MAX_RESTARTS})`);
        setTimeout(() => _spawnWorker().catch(() => {}), delay);
      } else {
        console.error('[VAD] Max restarts reached. Persistent worker disabled; falling back to spawn-per-request.');
      }
    });
  });
}

function _onWorkerLine(line) {
  if (!line.trim()) return;
  if (!_pendingReq) {
    console.warn('[VAD] Unexpected worker output (no pending request):', line);
    return;
  }
  const { resolve, timer, id } = _pendingReq;
  _pendingReq = null;
  clearTimeout(timer);

  try {
    const msg = JSON.parse(line.trim());
    if (msg.error) {
      console.warn(`[VAD] Worker error id=${id}: ${msg.error}`);
      resolve(PASS_THROUGH);
    } else {
      resolve(_buildResult(msg));
    }
  } catch {
    console.warn('[VAD] Worker invalid JSON response:', line);
    resolve(PASS_THROUGH);
  }
}

function _buildResult(msg) {
  return {
    pass:            msg.pass === true,
    speechStartMs:   msg.speechStartMs  ?? null,
    speechEndMs:     msg.speechEndMs    ?? null,
    maxProb:         msg.maxProb        ?? 0,
    speechDurationMs: msg.speechDurationMs ?? 0,
  };
}

// ── Persistent-mode request (serialised via Promise queue) ────────────────────

function _checkSpeechPersistent(wavPath) {
  if (!_workerReady || !_proc) {
    console.warn('[VAD] Persistent worker unavailable — falling back to spawn-per-request');
    return _checkSpeechSpawn(wavPath);
  }

  // Serialise: each call waits for the previous to finish before writing to stdin
  return new Promise((outerResolve) => {
    _workerQueue = _workerQueue.then(() => new Promise((innerResolve) => {
      const id      = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const timeout = getTimeoutMs();

      const timer = setTimeout(() => {
        console.warn(`[VAD] TIMEOUT id=${id} (${timeout}ms) — failing open`);
        if (_pendingReq && _pendingReq.id === id) _pendingReq = null;
        innerResolve(PASS_THROUGH);
        outerResolve(PASS_THROUGH);
      }, timeout);

      _pendingReq = {
        id,
        resolve: (result) => { innerResolve(result); outerResolve(result); },
        timer,
      };

      const payload = JSON.stringify({
        id,
        wavPath:      path.resolve(wavPath),
        threshold:    getThreshold(),
        minSpeechMs:  getMinMs(),
      }) + '\n';

      try {
        _proc.stdin.write(payload);
      } catch (err) {
        clearTimeout(timer);
        _pendingReq = null;
        console.warn('[VAD] stdin write error:', err.message);
        innerResolve(PASS_THROUGH);
        outerResolve(PASS_THROUGH);
      }
    }));
  });
}

// ── Spawn-per-request mode ────────────────────────────────────────────────────

function _checkSpeechSpawn(wavPath) {
  return new Promise((resolve) => {
    const python  = findPythonExec();
    const id      = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = JSON.stringify({
      id,
      wavPath:     path.resolve(wavPath),
      threshold:   getThreshold(),
      minSpeechMs: getMinMs(),
    });

    execFile(
      python,
      [WORKER_SCRIPT, '--oneshot', payload],
      { timeout: getTimeoutMs(), maxBuffer: 64 * 1024 },
      (err, stdout) => {
        if (err) {
          console.warn(`[VAD] spawn error id=${id}:`, err.message, '— failing open');
          return resolve(PASS_THROUGH);
        }
        const line = (stdout || '').trim();
        if (!line) return resolve(PASS_THROUGH);
        try {
          const msg = JSON.parse(line);
          if (msg.error) {
            console.warn(`[VAD] spawn result error id=${id}: ${msg.error}`);
            resolve(PASS_THROUGH);
          } else {
            resolve(_buildResult(msg));
          }
        } catch {
          console.warn('[VAD] spawn invalid JSON:', line);
          resolve(PASS_THROUGH);
        }
      }
    );
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Evaluate a WAV file for speech content.
 *
 * @param {string} wavPath  Absolute path to a 16kHz mono PCM WAV.
 * @param {{ mode?: 'spawn' | 'persistent' }} [opts]
 * @returns {Promise<{ pass: boolean, speechStartMs: number|null, speechEndMs: number|null }>}
 */
async function checkSpeech(wavPath, opts = {}) {
  if (!isEnabled()) return PASS_THROUGH;

  const mode = opts.mode || 'spawn';
  try {
    if (mode === 'persistent') return await _checkSpeechPersistent(wavPath);
    return await _checkSpeechSpawn(wavPath);
  } catch (err) {
    console.warn('[VAD] Unexpected error in checkSpeech:', err.message, '— failing open');
    return PASS_THROUGH;
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function stopPersistentWorker() {
  if (!_proc) return;
  const proc = _proc;
  _proc = null;
  _workerReady = false;

  try { proc.stdin.write(JSON.stringify({ shutdown: true }) + '\n'); } catch {}
  try { proc.stdin.end(); } catch {}

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      try { proc.kill('SIGTERM'); } catch {}
      resolve();
    }, 3000);
    proc.once('exit', () => { clearTimeout(timer); resolve(); });
  });
  console.log('[VAD] persistent worker stopped');
}

module.exports = { startPersistentWorker, stopPersistentWorker, checkSpeech, findPythonExec };
