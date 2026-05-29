import requests
import json
import time
import re
import os
from typing import List

from config import (
    OLLAMA_EXE,
    OLLAMA_MODEL,
    OLLAMA_TIMEOUT_SEC,
)


# ── ANSI escape strip (matches llmRunner.js stripAnsi) ───────────────────────
_ANSI_RE = re.compile(r"\x1B\[[0-9;]*[A-Za-z]")

def _strip_ansi(text):
    # type: (str) -> str
    return _ANSI_RE.sub("", text)


# ── Thinking-tag stripper (Task 3) ────────────────────────────────────────────
#
# Pattern inventory — all known Ollama / gemma4 reasoning leakage forms:
#
#   1. <think> ... </think>          — standard XML-style block
#   2. <thinking> ... </thinking>    — alternate tag name
#   3. [thinking] ... [/thinking]    — bracket variant
#   4. **Thinking:** ... **Done**    — bold markdown variant
#   5. Thinking:\n ... \nDone.       — plain-text variant
#   6. --- thinking --- ... ---      — horizontal-rule fence
#
# All patterns use re.DOTALL so newlines inside the block are consumed.
# re.IGNORECASE handles mixed-case "Thinking" / "THINKING".

_THINK_PATTERNS = [
    # XML-style: <think>...</think> or <thinking>...</thinking>
    re.compile(r"<think(?:ing)?>\s*.*?\s*</think(?:ing)?>", re.DOTALL | re.IGNORECASE),

    # Bracket-style: [thinking]...[/thinking]
    re.compile(r"\[thinking\]\s*.*?\s*\[/thinking\]", re.DOTALL | re.IGNORECASE),

    # "Thinking..." fence: "Thinking..." ... "...done thinking."
    re.compile(
        r"Thinking\.{2,}\s*.*?\s*\.{2,}done thinking\.",
        re.DOTALL | re.IGNORECASE,
    ),

    # Plain-text "Thinking:\n...\nDone thinking." or "Done."
    re.compile(
        r"^Thinking:\s*.*?(?:Done thinking\.|Done\.)\s*$",
        re.DOTALL | re.MULTILINE | re.IGNORECASE,
    ),

    # Bold markdown: **Thinking:**...**Done**
    re.compile(
        r"\*\*Thinking:\*\*\s*.*?\s*\*\*Done\*\*",
        re.DOTALL | re.IGNORECASE,
    ),

    # Horizontal-rule fence: --- thinking ---...--- or similar
    re.compile(
        r"-{2,}\s*thinking\s*-{2,}\s*.*?\s*-{2,}",
        re.DOTALL | re.IGNORECASE,
    ),
]


def strip_thinking_tags(text):
    # type: (str) -> str
    """
    Remove ALL internal reasoning / thinking blocks from LLM output.

    This is the primary defence against gemma4:e4b leaking its chain-of-
    thought onto the manuscript page. Applied as the very first step after
    receiving raw Ollama output, before any other cleaning.

    Returns:
        Clean text with all reasoning blocks removed. Whitespace normalized.
    """
    if not text:
        return ""

    result = text
    for pattern in _THINK_PATTERNS:
        result = pattern.sub("", result)

    # Collapse runs of blank lines left behind after stripping blocks
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()


def _build_prompt(raw_text, current_paragraph_content):
    # type: (str, List[str]) -> str
    """
    Construct the LLM prompt using the Active Paragraph History model.
    Ironclad separation prevents the model from echoing old context.
    """
    paragraph_so_far = " ".join(current_paragraph_content) if current_paragraph_content else "(हा नवीन परिच्छेदाची सुरुवात आहे. आधीचा कोणताही संदर्भ नाही.)"

    prompt = (
        "तुम्ही एक प्रतिभावान मराठी कादंबरीकार आणि भावूक लेखक आहात. तुमचे काम वापरकर्त्याच्या कच्या ओळींना अतिशय सुंदर, भावनिक आणि साहित्यिक भाषेत रूपांतरित करणे आहे.\n\n"
        "**महत्त्वाचे नियम:**\n"
        "१. पार्श्वभूमी (BACKGROUND CONTEXT): खाली दिलेला मजकूर पुस्तकात आधीच लिहून झाला आहे. हा केवळ तुमच्या संदर्भासाठी (Reference) आहे जेणेकरून कथेचा प्रवाह कायम राहील. हा मजकूर तुमच्या उत्तरात पुन्हा कधीही लिहू नका (DO NOT REPEAT OR INCLUDE THIS TEXT IN THE OUTPUT).\n"
        "   - आधीचा मजकूर: \"{0}\"\n\n"
        "२. नवीन ओळ (NEW INPUT TO PROCESS): वापरकर्त्याने आत्ता पाठवलेली नवीन ओळ खालीलप्रमाणे आहे. तुम्हाला फक्त आणि फक्त याच ओळीचे सुंदर, साहित्यिक मराठीत रूपांतर करायचे आहे:\n"
        "   - कचा मसुदा: \"{1}\"\n\n"
        "३. विरामचिन्हे आणि भावना (Punctuation & Emotion): वाक्याचा मूळ गाभा आणि सेजल बद्दलच्या भावना तशाच ठेवा, पण भाषा अधिक ओघवती करा. मराठीतील योग्य विरामचिन्हे (उदा. स्वल्पविराम (,), अर्धविराम (;), उद्गारवाचक चिन्ह (!), किंवा अपूर्णविराम) यांचा प्रभावी वापर करा जेणेकरून वाचताना भावना थेट मनाला भिडतील.\n\n"
        "उत्तराचा नियम: तुमच्या उत्तरात कोणतीही पूर्वपीठिका, स्पष्टीकरण किंवा जुन्या वाक्यांची पुनरावृत्ती नसावी. विचार प्रक्रिया (<think>) वगळा. तसेच \"next_paragraph\", \"next_chapter\", \"पुढील परिच्छेद\", किंवा \"पुढील धडा\" असे कोणतेही आदेश (commands) तुमच्या उत्तरात कधीही समाविष्ट करू नका. फक्त नवीन संपादित केलेली ओळच आउटपुट म्हणून द्या."
    ).format(paragraph_so_far, raw_text)

    return prompt


# ── Input sanitizer ───────────────────────────────────────────────────────────

def sanitize_transcript(raw_text):
    # type: (str) -> str
    """
    Normalize raw whisper output before it reaches the LLM or document builder.

    Steps:
      1. Strip leading/trailing whitespace.
      2. Collapse internal whitespace runs (spaces, tabs, zero-width chars).
      3. Normalize multiple newlines to single.
      4. Remove lone trailing punctuation artefacts whisper commonly appends
         (periods, commas, semicolons at the very end — not Devanagari danda ।).
    """
    if not raw_text:
        return ""

    text = raw_text.strip()
    text = re.sub(r"[ \t\u200b\u200c\u200d\ufeff]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    text = re.sub(r"[,;:\.]$", "", text.rstrip())
    return text.strip()


# ── Stutter cleaner (Task 2) ──────────────────────────────────────────────────

def clean_token_stutter(text):
    # type: (str) -> str
    """
    Remove partial-word token stutters caused by LLM decoding loops.
    E.g. "आण आणि" -> "आणि", "आह आहे" -> "आहे", "म मी" -> "मी".
    Preserves exact word repetitions (e.g. "लहान लहान").
    """
    if not text:
        return ""
    
    words = text.split()
    cleaned = []
    i = 0
    while i < len(words):
        w = words[i]
        if i + 1 < len(words):
            next_w = words[i+1]
            
            # Strip common punctuation for the prefix check so we can catch "आण, आणि"
            # Do NOT use \w regex because it strips Devanagari vowel marks (matras)
            punct = ".,;:!?()\"'"
            w_clean = w.strip(punct)
            next_w_clean = next_w.strip(punct)
            
            if w_clean and next_w_clean.startswith(w_clean) and w_clean != next_w_clean:
                # w is a partial stutter of next_w, skip it
                i += 1
                continue
        
        cleaned.append(w)
        i += 1
        
    return " ".join(cleaned)


# ── Core LLM call ─────────────────────────────────────────────────────────────

def polish_transcript(raw_text, current_paragraph_content):
    # type: (str, List[str]) -> str
    """
    Run gemma4:e4b on the sanitized raw transcript and return prose that
    seamlessly continues the current paragraph.

    Pipeline:
      sanitize -> build prompt -> ollama -> strip_thinking_tags -> clean_output

    Args:
        raw_text:                   Raw whisper output for this clip.
        current_paragraph_content:  All polished sentences in the current
                                    paragraph so far (from context_buffer.json).

    Returns:
        Polished continuation string. Falls back to sanitized raw on failure.
    """
    sanitized = sanitize_transcript(raw_text)
    if not sanitized:
        return ""

    prompt = _build_prompt(sanitized, current_paragraph_content)

    print("[LLM] Sending to {} via API ({} chars, {} prior sentences) ...".format(
        OLLAMA_MODEL, len(sanitized), len(current_paragraph_content)
    ))
    t0 = time.monotonic()

    try:
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "repeat_penalty": 1.15,
                "num_predict": 1024
            }
        }
        
        resp = requests.post(
            "http://127.0.0.1:11434/api/generate",
            json=payload,
            timeout=OLLAMA_TIMEOUT_SEC
        )
        resp.raise_for_status()
        
        data = resp.json()
        raw_output = data.get("response", "")

        elapsed = time.monotonic() - t0

        # Step 1: Strip ANSI just in case, though API shouldn't have it
        raw_output = _strip_ansi(raw_output).strip()

        # Step 2: Strip ALL thinking/reasoning blocks (Task 3 — must be first)
        deduced = strip_thinking_tags(raw_output)

        # Step 3: Strip remaining LLM meta-commentary (labels, markdown, etc.)
        polished = _clean_output(deduced, sanitized)
        
        # Step 4: De-duplicate stutters (Task 2)
        polished = clean_token_stutter(polished)

        print("[LLM] Done ({:.1f}s): \"{}\"".format(elapsed, polished[:80]))
        return polished

    except requests.Timeout:
        print("[LLM] TIMEOUT after {}s — using sanitized raw transcript.".format(
            OLLAMA_TIMEOUT_SEC
        ))
        return sanitized

    except Exception as exc:
        print("[LLM] Error: {} — using sanitized raw transcript.".format(exc))
        return sanitized


# ── Output cleaner ─────────────────────────────────────────────────────────────

def _clean_output(llm_output, raw_fallback):
    # type: (str, str) -> str
    """
    Final pass: remove prompt-label echoes, markdown headings, and
    leading blank lines from the (already thinking-stripped) output.
    Falls back to raw_fallback if the result is suspiciously empty.
    """
    if not llm_output:
        return raw_fallback.strip()

    lines = llm_output.split("\n")
    filtered = []
    for line in lines:
        stripped = line.strip()
        # Drop leading blank lines
        if not filtered and not stripped:
            continue
        # Drop prompt labels echoed back: "[सातत्य गद्य]", "[कच्चे प्रतिलेखन]"
        if stripped.startswith("[") and stripped.endswith("]"):
            continue
        # Drop markdown heading lines (## Chapter, ### Section, etc.)
        if re.match(r"^#{1,6}\s", stripped):
            continue
        # Drop separator lines (----, ====)
        if re.match(r"^[-=]{3,}$", stripped):
            continue
        filtered.append(line)

    result = "\n".join(filtered).strip()

    # Safety net: if result is < 10% of raw input length, fallback
    if len(result) < max(5, int(len(raw_fallback) * 0.1)):
        print("[LLM] Output suspiciously short — falling back to raw transcript.")
        return raw_fallback.strip()

    return result
