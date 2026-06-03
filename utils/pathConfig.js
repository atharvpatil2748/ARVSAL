// utils/pathConfig.js — Single source of truth for all runtime paths
require('dotenv').config();
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

function resolve(envVar, fallback) {
  const v = process.env[envVar];
  if (v) return path.isAbsolute(v) ? v : path.resolve(ROOT, v);
  return path.resolve(ROOT, fallback);
}

module.exports = {
  FFMPEG_EXE:         resolve("ARVSAL_FFMPEG_PATH",         "runtime/ffmpeg/bin/ffmpeg.exe"),
  PIPER_EXE:          resolve("ARVSAL_PIPER_PATH",           "runtime/piper/piper.exe"),
  PIPER_MODEL:        resolve("ARVSAL_PIPER_MODEL",          "runtime/piper/models/en_US-ryan-high.onnx"),
  TTS_WAV:            resolve("ARVSAL_TTS_WAV",              "runtime/temp/tts/arvsal.wav"),
  WHISPER_EXE:        resolve("ARVSAL_WHISPER_EXE",          "runtime/whisper/build/bin/whisper-cli.exe"),
  SMALL_MODEL_PATH:   resolve("ARVSAL_WHISPER_SMALL_MODEL",  "runtime/whisper/models/ggml-small.bin"),
  MEDIUM_MODEL_PATH:  resolve("ARVSAL_WHISPER_MEDIUM_MODEL", "runtime/whisper/models/ggml-medium.bin"),
  DOWNLOAD_DIR:       resolve("ARVSAL_DOWNLOAD_DIR",         "runtime/downloads"),
  TEMP_DIR:           resolve("ARVSAL_TEMP_DIR",             "runtime/temp"),
  LOG_DIR:            resolve("ARVSAL_LOG_DIR",              "runtime/logs"),
  EMAIL_COOKIES_PATH: resolve("ARVSAL_EMAIL_COOKIES",        "data/sessions/email/cookies.json"),
  MEMORY_DIR:         resolve("ARVSAL_MEMORY_DIR",           "data/memory"),
  NIRCMD_EXE:         resolve("ARVSAL_NIRCMD_PATH",          "runtime/nircmd/nircmd.exe"),
};
