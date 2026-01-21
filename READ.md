# ARVSAL 🤖🧠
**Autonomous Response & Virtual System Analysis Layer**

[![Version](https://img.shields.io/badge/Version-1.x-blue.svg)](https://github.com/yourusername/arvsal)
[![Status](https://img.shields.io/badge/Status-Stable-green.svg)]()
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()

> **"If Arvsal says 'I don’t know', that is a feature, not a failure."**

ARVSAL is a deterministic, memory-aware, and system-capable conversational AI layer created by **Atharv**. Unlike standard chatbots, ARVSAL is designed as a personal AI system layer—behaving with human-like empathy while remaining strictly explainable and non-hallucinatory.

---

## 📑 Table of Contents
* [Who is Arvsal?](#-who-is-arvsal)
* [Current Version & Guarantees](#-current-version-stable)
* [Core Architecture](#-core-architecture-conceptual)
* [Memory System Mastery](#-memory-system--how-to-use-it-properly)
* [System Commands](#-system-commands)
* [Addressing & Etiquette](#-addressing--respect)
* [Safety & Constraints](#-what-not-to-do)

---

## 🧠 Who is Arvsal?

Arvsal is not a toy; it is a **Personal AI Operating Layer**. It bridges the gap between fluid conversational AI and rigid system logic. It excels at:

* **Responsible Memory:** Recalls facts and conversations with timestamped proof.
* **System Mastery:** Direct control over applications, media, and power states.
* **Contextual Intelligence:** Maintains short-term awareness for natural "it/that" follow-ups.
* **Explainable Logic:** Always ready to explain *how* and *when* it learned a specific detail.

---

## 🧬 Current Version (Stable)

### **Arvsal v1.x — Deterministic Memory Core**

| Feature | Status |
| :--- | :--- |
| **Hallucination Protection** | ❌ Blocked |
| **Guessed Dates/Times** | ❌ Disabled |
| **Autonomous Actions** | ✅ Manual/Explicit Only |
| **Memory Persistence** | ✅ Explicit & Deterministic |
| **Backend** | ✅ Electron-Safe / JSON-driven |

---

## 🧩 Core Architecture (Conceptual)

Arvsal operates through **four distinct isolation layers** to ensure data integrity:

1.  **Semantic Memory:** Long-term storage for verified facts (Names, preferences).
2.  **Episodic Memory:** Event-based storage for past interactions and conversations.
3.  **Context Memory:** Transient buffer for pronouns and immediate references (Expires in ~2m).
4.  **Chat History:** Verbatim logs for transparency and audit.

---

## 🧠 Memory System — How to Use It Properly

### 1. Semantic (Fact) Memory
*For stable, long-term information.*

* **Store:** `remember my name is Atharv` or `remember my age is 19`.
* **Recall:** `what is my name?` or `what do you know about me?`
* **Explain:** `how do you know this?` or `when did i tell you?`
* **Forget:** `forget my name` or `forget it` (context-aware).

### 2. Episodic Memory (Events)
*For remembering the "flow" of life.*

* **Example:** `what did we chat about earlier?` or `what was the last thing I mentioned?`
* **Guarantee:** Arvsal will only recall stored logs; it will never "invent" a past event.

### 3. Context Memory
*For natural dialogue.*

* **Example:** * *User:* "What is Sahil's favorite color?" 
    * *Arvsal:* "Yellow." 
    * *User:* "Forget **it**." (Arvsal knows "it" refers to the color).

### 🛑 What Arvsal Will NEVER Store
To prevent logic loops and data corruption, the following are blocked from memory storage:
* Dynamic Time/Dates (`remember it is 5pm` ❌)
* Calculations or temporary emotional outbursts.
* Assumptions or "guessed" user intent.

---

## 🖥️ System Commands

Arvsal acts as a bridge to your OS. Commands require explicit phrasing.

### 📂 Applications
> `open chrome`, `open notepad`, `open calculator`, `open calendar`

### 🎵 Media Control
> `mute`, `volume up / down`, `play / pause`, `next track`

### ⚡ Power Management
> `shutdown`, `restart`, `sleep`, `lock`
> *Note: Dangerous actions always trigger a confirmation prompt.*

---

## 👑 Addressing & Respect

Arvsal is programmed with a specific social protocol for its creator, **Atharv Sir**.

* **Preferred Address:** "Atharv Sir" or "Sir".
* **Logic:**
    * Address is used primarily in long explanations or teaching sessions.
    * Address is **never** repeated back-to-back or used in short, "yes/no" style replies to maintain a natural flow.

---

## 🔍 Search & Web Integration

Quickly query external platforms:
* `search black holes`
* `youtube quantum mechanics`

---

## ⚠️ What Not To Do

1.  **Don't expect guessing:** If info is missing, Arvsal will ask rather than assume.
2.  **Don't bypass safety:** Confirmations are mandatory for system-level changes.
3.  **Don't rely on hallucinations:** Arvsal values **truth over pleasing answers**.

---

## 🛠️ Roadmap (Future)

* [ ] Multi-user identity isolation.
* [ ] Advanced Teaching/Tutor modes.
* [ ] Integrated Voice I/O.
* [ ] Native Electron GUI.

---

## 📜 License & Copyright

**© 2026 Atharv. All rights reserved.**

This software is **proprietary**. No part of this system may be redistributed, modified, or used for commercial purposes without explicit written permission from **Atharv**.

---

**Designed for trust. Built for control.** — *Atharv & Arvsal*