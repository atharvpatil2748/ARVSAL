'use strict';
/**
 * AVAWakeAdapter — Node.js Wake Word Engine Bridge
 * Wraps the 'ava-listener' package to preserve the existing ARVSAL API contract.
 *
 * Usage:
 *   const WakeWordEngine = require('@modules/wake/wakeWord');
 *   const wake = new WakeWordEngine();
 *   wake.on('ready', () => console.log('engine ready'));
 *   wake.on('wake',  (e) => console.log('WAKE:', e.phrase, e.confidence));
 *   wake.on('error', (e) => console.error('error:', e.message));
 *   wake.start();
 */

const { spawn }      = require('child_process');
const path           = require('path');
const fs             = require('fs');
const EventEmitter   = require('events');
const { AVAListener } = require('ava-listener');

const PACKAGE_PROFILE_PATH = path.resolve(__dirname, '../../node_modules/ava-listener/profiles/arvsal.json');
const LOCAL_PROFILE_PATH = path.resolve(__dirname, 'profiles/arvsal.json');

class WakeWordEngine extends EventEmitter {
  constructor () {
    super();
    this._listener        = null;
    this._ready           = false;
    this._isPaused        = false;  // idempotent pause guard
    
    this._ensureProfile();
  }

  _ensureProfile() {
    const profilesDir = path.dirname(LOCAL_PROFILE_PATH);
    const packageProfilesDir = path.dirname(PACKAGE_PROFILE_PATH);

    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
    }

    // Copy all built-in profiles if they don't exist
    if (fs.existsSync(packageProfilesDir)) {
      const files = fs.readdirSync(packageProfilesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const destPath = path.join(profilesDir, file);
          const srcPath = path.join(packageProfilesDir, file);
          if (!fs.existsSync(destPath)) {
            try {
              fs.copyFileSync(srcPath, destPath);
            } catch (err) {
              console.error(`[AVAWakeAdapter] Failed to copy profile ${file}.`, err);
            }
          }
        }
      }
    }

    if (fs.existsSync(LOCAL_PROFILE_PATH) && fs.existsSync(PACKAGE_PROFILE_PATH)) {
      // Version-Aware Migration for arvsal.json
      try {
        const localData = JSON.parse(fs.readFileSync(LOCAL_PROFILE_PATH, 'utf8'));
        const pkgData = JSON.parse(fs.readFileSync(PACKAGE_PROFILE_PATH, 'utf8'));
        
        const localVersion = localData.profileVersion || 0;
        const pkgVersion = pkgData.profileVersion || 0;

        if (localVersion < pkgVersion) {
          console.log(`[AVAWakeAdapter] Upgrading local profile from v${localVersion} to v${pkgVersion}...`);
          
          const localPhrases = {};
          if (Array.isArray(localData.wakePhrases)) {
            for (const phrase of localData.wakePhrases) {
              localPhrases[phrase.phraseId] = phrase;
            }
          }

          const mergedPhrases = [];
          if (Array.isArray(pkgData.wakePhrases)) {
            for (const pkgPhrase of pkgData.wakePhrases) {
              if (localPhrases[pkgPhrase.phraseId]) {
                const local = localPhrases[pkgPhrase.phraseId];
                // Keep local variants and thresholds
                mergedPhrases.push({
                  ...pkgPhrase,
                  variants: local.variants,
                  threshold: local.threshold,
                  cooldownMs: local.cooldownMs !== undefined ? local.cooldownMs : pkgPhrase.cooldownMs,
                  enabled: local.enabled !== undefined ? local.enabled : pkgPhrase.enabled
                });
                delete localPhrases[pkgPhrase.phraseId];
              } else {
                mergedPhrases.push(pkgPhrase);
              }
            }
          }

          for (const remainingPhrase of Object.values(localPhrases)) {
            mergedPhrases.push(remainingPhrase);
          }

          const upgradedData = {
            ...pkgData,
            assistantName: localData.assistantName || pkgData.assistantName,
            profileVersion: pkgVersion,
            wakePhrases: mergedPhrases
          };

          fs.writeFileSync(LOCAL_PROFILE_PATH, JSON.stringify(upgradedData, null, 2));
          console.log(`[AVAWakeAdapter] Profile upgraded successfully.`);
        }
      } catch (err) {
        console.error(`[AVAWakeAdapter] Error during profile migration:`, err.message);
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  start () {
    if (!this._listener) {
      this._listener = new AVAListener({
        profile: LOCAL_PROFILE_PATH,
        debug: process.env.ARVSAL_WAKE_DEBUG === '1'
      });

      this._listener.on('ready', () => {
        if (!this._ready) {
          this._ready = true;
          this.emit('ready');
        }
      });
      
      this._listener.on('running', () => {
        if (!this._ready) {
          this._ready = true;
          this.emit('ready');
        }
      });

      this._listener.on('wake', (e) => {
        if (this._isPaused) return; 
        
        // Normalize payload to existing ARVSAL contract
        const raw = e.raw_confidence ?? e.raw_conf ?? e.confidence;
        const smooth = e.smooth_confidence ?? e.smooth_conf ?? raw;
        
        this.emit('wake', {
          phrase:            e.phrase,
          raw_confidence:    raw,
          smooth_confidence: smooth,
          confidence:        raw, // Backward-compat alias
          latency_ms:        e.latency_ms || 0,
          ts:                e.ts || Date.now(),
        });
      });

      this._listener.on('error', (err) => {
        this.emit('error', err);
      });
      
      this._listener.on('statechange', ({ from, to }) => {
        if (to === 'STOPPED' || to === 'FAILED') {
            this._ready = false;
        }
      });
    }

    this._isPaused = false;
    this._listener.start().catch(err => {
      this.emit('error', err);
    });
  }

  stop () {
    this._ready = false;
    if (this._listener) {
      this._listener.stop();
      this._listener = null;
    }
  }

  isReady () { return this._ready; }

  /**
   * Pause wake detection. The audio pipeline stays fully warm (VAD, Silero, Sherpa).
   * Only wake event emission is suppressed. Resume is instantaneous.
   * Called on: arvsal:stopWake (renderer is about to record user voice).
   */
  pause () {
    if (this._isPaused) return;   // idempotent — ignore duplicate calls
    this._isPaused = true;
    if (this._listener) {
      this._listener.pause();
    }
  }

  /**
   * Resume wake detection after a pause.
   * Called on: arvsal:resumeWake (renderer has finished recording).
   */
  resume () {
    if (!this._isPaused) return;  // idempotent — already active
    this._isPaused = false;
    if (this._listener) {
      this._listener.resume();
    }
  }

  /**
   * Suppress wake detection during assistant TTS playback to prevent self-wake.
   * Functionally identical to pause() but semantically distinct for state tracking.
   * Called on: arvsal:ttsStart.
   */
  suppress () {
    // Implemented as an alias to pause() as per AVA-Listener capabilities
    this.pause();
  }
}

module.exports = WakeWordEngine;
