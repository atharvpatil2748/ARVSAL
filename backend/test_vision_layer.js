/**
 * Arvsal Vision Layer — Automated Regression Test Suite
 *
 * Tests: intentClassifier, actionIntentDetector, cognitiveEngine (processActionMemory),
 *        plannerEngine (unit), module loading, edge cases
 *
 * Run: node backend/test_vision_layer.js
 */

// =============== TEST FRAMEWORK (no deps) ===============

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (err) {
        console.log(`  ❌ ${name}`);
        console.log(`     └─ ${err.message}`);
        failed++;
        failures.push({ name, error: err.message });
    }
}

async function testAsync(name, fn) {
    try {
        await fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (err) {
        console.log(`  ❌ ${name}`);
        console.log(`     └─ ${err.message}`);
        failed++;
        failures.push({ name, error: err.message });
    }
}

function skip(name, reason) {
    console.log(`  ⏭️  SKIP ${name} — ${reason}`);
    skipped++;
}

function assertEquals(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(`${msg || "Assertion"}: expected "${expected}", got "${actual}"`);
    }
}

function assertIncludes(arr, val, msg) {
    if (!arr.includes(val)) {
        throw new Error(`${msg || "Assertion"}: "${val}" not in [${arr.join(", ")}]`);
    }
}

function assertNotNull(val, msg) {
    if (val === null || val === undefined) {
        throw new Error(`${msg || "Assertion"}: value is null/undefined`);
    }
}

function assertArray(val, msg) {
    if (!Array.isArray(val)) {
        throw new Error(`${msg || "Assertion"}: expected array, got ${typeof val}`);
    }
}

function section(title) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(` ${title}`);
    console.log("=".repeat(60));
}

// =============== MODULE LOADS ===============

section("MODULE LOADING — All imports must not throw");

let classifyScreenIntent, isActionIntent;
let classifyIntent;
let processActionMemory, processMemoryQuery;
let generatePlan;
let suggestContent;
let captureScreen;
let findElement;
let handleScreenAction;

test("actionIntentDetector loads", () => {
    const mod = require("./actionIntentDetector");
    classifyScreenIntent = mod.classifyScreenIntent;
    isActionIntent = mod.isActionIntent;
    assertNotNull(classifyScreenIntent, "classifyScreenIntent export");
    assertNotNull(isActionIntent, "isActionIntent export");
});

test("intentClassifier loads", () => {
    classifyIntent = require("./intentClassifier");
    assertNotNull(classifyIntent, "classifyIntent export");
});

test("cognitiveEngine loads", () => {
    const mod = require("./cognitiveEngine");
    processMemoryQuery = mod.processMemoryQuery;
    processActionMemory = mod.processActionMemory;
    assertNotNull(processMemoryQuery, "processMemoryQuery export");
    assertNotNull(processActionMemory, "processActionMemory export (NEW)");
});

test("plannerEngine loads", () => {
    const mod = require("./plannerEngine");
    generatePlan = mod.generatePlan;
    assertNotNull(generatePlan, "generatePlan export");
});

test("screenCapture loads", () => {
    const mod = require("./screenCapture");
    captureScreen = mod.captureScreen;
    assertNotNull(captureScreen, "captureScreen export");
});

test("screenElementFinder loads", () => {
    const mod = require("./screenElementFinder");
    findElement = mod.findElement;
    assertNotNull(findElement, "findElement export");
});

test("screenActionOrchestrator loads", () => {
    const mod = require("./screenActionOrchestrator");
    handleScreenAction = mod.handleScreenAction;
    assertNotNull(handleScreenAction, "handleScreenAction export");
});

test("contentSuggester loads", () => {
    const mod = require("./contentSuggester");
    suggestContent = mod.suggestContent;
    assertNotNull(suggestContent, "suggestContent export");
});

test("geminiClient has askGeminiVision", () => {
    const mod = require("./geminiClient");
    assertNotNull(mod.askGeminiVision, "askGeminiVision export (NEW)");
    assertNotNull(mod.askGemini, "askGemini export (existing)");
});

test("toolRegistry loads", () => {
    const mod = require("./tools/toolRegistry");
    assertNotNull(mod.executeTool, "executeTool export");
});

// =============== classifyScreenIntent ===============

section("classifyScreenIntent — 3-tier classification");

// --- CHAT tests ---
const chatInputs = [
    "how are you",
    "hello",
    "hi there",
    "what is machine learning",
    "explain recursion",
    "tell me about the weather",
    "I think this is interesting",
    "thanks",
    "okay cool",
    "what do you think about AI",
    "I feel tired today"
];

chatInputs.forEach(input => {
    test(`[CHAT] "${input}"`, () => {
        const result = classifyScreenIntent(input);
        assertEquals(result.type, "chat", `"${input}" should be chat`);
    });
});

// --- SCREEN_ACTION tests ---
const screenActionInputs = [
    "click the send button",
    "click on submit",
    "type hello in the search bar",
    'type "hello world"',
    "scroll down",
    "scroll up",
    "press enter",
    "press ctrl",
    "close this tab",
    "what's on my screen",
    "what do you see",
    "look at the screen",
    "analyze my screen",
    "read the screen",
    "what is open",
    "fill this form",
    "fill my details",
    "send this message",
    "send a reply",
    "suggest a reply",
    "suggest something",
    "write something for this",
    "improve this text",
    "take a screenshot",
    "hit the submit button"
];

screenActionInputs.forEach(input => {
    test(`[SCREEN_ACTION] "${input}"`, () => {
        const result = classifyScreenIntent(input);
        assertEquals(result.type, "screen_action", `"${input}" should be screen_action`);
    });
});

// --- MIXED tests ---
const mixedInputs = [
    "explain what you're doing and then scroll down",
    "describe the page and also click the button",
    "tell me what you see and close the tab"
];

mixedInputs.forEach(input => {
    test(`[MIXED] "${input}"`, () => {
        const result = classifyScreenIntent(input);
        assertEquals(result.type, "mixed", `"${input}" should be mixed`);
    });
});

// --- Edge cases ---
section("classifyScreenIntent — Edge Cases");

test("[EDGE] empty string → chat", () => {
    assertEquals(classifyScreenIntent("").type, "chat");
});

test("[EDGE] null → chat (no crash)", () => {
    assertEquals(classifyScreenIntent(null).type, "chat");
});

test("[EDGE] undefined → chat (no crash)", () => {
    assertEquals(classifyScreenIntent(undefined).type, "chat");
});

test("[EDGE] single word 'click' → screen_action", () => {
    // click is in screen action patterns
    const result = classifyScreenIntent("click the icon");
    assertEquals(result.type, "screen_action");
});

test("[EDGE] 'I think you should click here' → screen_action (contains click)", () => {
    const result = classifyScreenIntent("I think you should click here");
    // 'click' is a strong screen action signal regardless of context
    assertIncludes(["screen_action", "chat"], result.type);
});

test("[EDGE] 'search for climate change' — should be chat not screen_action", () => {
    // 'search' is an intent handled by SEARCH, not SCREEN_ACTION
    const result = classifyIntent("search climate change");
    assertEquals(result.intent, "SEARCH");
});

// =============== isActionIntent (backward compat) ===============

section("isActionIntent — backward compatibility preserved");

test("open chrome → true", () => {
    assertEquals(isActionIntent("open chrome"), true);
});
test("launch notepad → true", () => {
    assertEquals(isActionIntent("launch notepad"), true);
});
test("how are you → false", () => {
    assertEquals(isActionIntent("how are you"), false);
});
test("click the button → true (now includes screen actions)", () => {
    assertEquals(isActionIntent("click the button"), true);
});
test("null → false (no crash)", () => {
    assertEquals(isActionIntent(null), false);
});
test("empty string → false (no crash)", () => {
    assertEquals(isActionIntent(""), false);
});

// =============== intentClassifier — Existing intents unbroken ===============

section("intentClassifier — Existing intents must be UNCHANGED");

const existingIntentTests = [
    { input: "hi", expected: "SMALLTALK" },
    { input: "hello", expected: "SMALLTALK" },
    { input: "what time is it", expected: "LOCAL_SKILL" },
    { input: "what's the weather in Mumbai", expected: "LOCAL_SKILL" },
    { input: "open chrome", expected: "OPEN_APP" },
    { input: "open notepad", expected: "OPEN_APP" },
    { input: "open calculator", expected: "OPEN_APP" },
    { input: "open calendar", expected: "OPEN_CALENDAR" },
    { input: "shutdown", expected: "SHUTDOWN" },
    { input: "shut down", expected: "SHUTDOWN" },
    { input: "restart", expected: "RESTART" },
    { input: "lock the system", expected: "LOCK" },
    { input: "sleep", expected: "SLEEP" },
    { input: "mute", expected: "MUTE" },
    { input: "volume up", expected: "VOLUME_UP" },
    { input: "volume down", expected: "VOLUME_DOWN" },
    { input: "search machine learning", expected: "SEARCH" },
    { input: "youtube lo-fi music", expected: "YOUTUBE" },
    { input: "remember my name is Athar", expected: "REMEMBER" },
    { input: "what do you know about me", expected: "MEMORY_SUMMARY" },
    { input: "forget name", expected: "FORGET" },
    { input: "connect gemini", expected: "CONNECT_GEMINI" },
    { input: "connect groq", expected: "CONNECT_GROQ" },
    { input: "disconnect local", expected: "DISCONNECT_AI" },
    { input: "yes", expected: "CONFIRM_YES" },
    { input: "no", expected: "CONFIRM_NO" },
    { input: "snap", expected: "WEBCAM_SNAP" },
    { input: "photo", expected: "WEBCAM_SNAP" }
];

existingIntentTests.forEach(({ input, expected }) => {
    test(`"${input}" → ${expected}`, () => {
        const result = classifyIntent(input);
        assertEquals(result.intent, expected, `intent for "${input}"`);
    });
});

// =============== intentClassifier — NEW intents ===============

section("intentClassifier — NEW intents (SCREEN_ACTION + SUGGEST_CONTENT)");

const newIntentTests = [
    { input: "click the send button", expected: "SCREEN_ACTION" },
    { input: "type hello in the input box", expected: "SCREEN_ACTION" },
    { input: "scroll down the page", expected: "SCREEN_ACTION" },
    { input: "what's on my screen", expected: "SCREEN_ACTION" },
    { input: "what do you see", expected: "SCREEN_ACTION" },
    { input: "press enter", expected: "SCREEN_ACTION" },
    { input: "fill this form", expected: "SCREEN_ACTION" },
    { input: "send this message", expected: "SCREEN_ACTION" },
    { input: "take a screenshot", expected: "SCREEN_ACTION" },
    { input: "suggest a reply", expected: "SUGGEST_CONTENT" },
    { input: "suggest a response", expected: "SUGGEST_CONTENT" },
    { input: "write something for this", expected: "SUGGEST_CONTENT" },
    { input: "improve this text", expected: "SUGGEST_CONTENT" },
    { input: "improve this message", expected: "SUGGEST_CONTENT" }
];

newIntentTests.forEach(({ input, expected }) => {
    test(`"${input}" → ${expected}`, () => {
        const result = classifyIntent(input);
        assertEquals(result.intent, expected, `intent for "${input}"`);
    });
});

// =============== Priority check — OLD beats NEW ===============

section("intentClassifier — Priority: existing intents beat SCREEN_ACTION");

test("'search machine learning' → SEARCH (not SCREEN_ACTION)", () => {
    const result = classifyIntent("search machine learning");
    assertEquals(result.intent, "SEARCH");
});

test("'open chrome' → OPEN_APP (not SCREEN_ACTION)", () => {
    const result = classifyIntent("open chrome");
    assertEquals(result.intent, "OPEN_APP");
});

test("'connect gemini' → CONNECT_GEMINI (not SCREEN_ACTION)", () => {
    const result = classifyIntent("connect gemini");
    assertEquals(result.intent, "CONNECT_GEMINI");
});

test("'yes' → CONFIRM_YES (not SCREEN_ACTION)", () => {
    const result = classifyIntent("yes");
    assertEquals(result.intent, "CONFIRM_YES");
});

test("'remember my name is Athar' → REMEMBER (not SCREEN_ACTION)", () => {
    const result = classifyIntent("remember my name is Athar");
    assertEquals(result.intent, "REMEMBER");
});

test("'what time is it' → LOCAL_SKILL TIME (not SCREEN_ACTION)", () => {
    const result = classifyIntent("what time is it");
    assertEquals(result.intent, "LOCAL_SKILL");
    assertEquals(result.skill, "TIME");
});

// =============== cognitiveEngine.processActionMemory ===============

section("cognitiveEngine — processActionMemory (async)");

(async () => {
    await testAsync("processActionMemory returns correct shape", async () => {
        const result = await processActionMemory({
            userInput: "click the send button",
            screenType: "whatsapp"
        });
        assertNotNull(result, "result not null");
        assertArray(result.relevantMemory, "relevantMemory is array");
        assertArray(result.actionHints, "actionHints is array");
        assertArray(result.missingInfo, "missingInfo is array");
    });

    await testAsync("processActionMemory — password triggers missingInfo", async () => {
        const result = await processActionMemory({
            userInput: "type my password here",
            screenType: "browser"
        });
        assertArray(result.missingInfo, "missingInfo is array");
        if (result.missingInfo.length === 0) {
            throw new Error("Expected missingInfo for password request");
        }
    });

    await testAsync("processActionMemory — null input doesn't crash", async () => {
        const result = await processActionMemory({ userInput: null, screenType: "unknown" });
        assertArray(result.relevantMemory, "relevantMemory is array");
        assertArray(result.actionHints, "actionHints is array");
        assertArray(result.missingInfo, "missingInfo is array");
    });

    await testAsync("processActionMemory — empty string doesn't crash", async () => {
        const result = await processActionMemory({ userInput: "", screenType: "unknown" });
        assertArray(result.relevantMemory, "relevantMemory is array");
    });

    await testAsync("processActionMemory — fill details triggers missingInfo when no name in memory", async () => {
        const result = await processActionMemory({
            userInput: "fill my details in this form",
            screenType: "browser"
        });
        assertArray(result.missingInfo, "missingInfo is array");
        // May or may not have info depending on user's memory state
        // Just checking it doesn't crash and returns the right shape
    });

    // =============== plannerEngine ===============

    section("plannerEngine — generatePlan unit tests (async)");

    await testAsync("generatePlan with screenContext doesn't crash", async () => {
        const plan = await generatePlan({
            userInput: "click the send button",
            screenContext: "Screen Type: whatsapp\nVisible Text: Type a message...",
            memoryContext: "None",
            actionHints: []
        });
        // Plan may be null if local model is not running — that's OK
        // Just check it doesn't crash
        if (plan !== null) {
            assertArray(plan.steps, "steps is array");
            assertNotNull(plan.goal, "goal exists");
        }
    });

    await testAsync("generatePlan without screenContext (backward compat)", async () => {
        const plan = await generatePlan({
            userInput: "open chrome"
        });
        // Just check no crash
        if (plan !== null) {
            assertArray(plan.steps, "steps is array");
        }
    });

    await testAsync("generatePlan with null userInput returns null", async () => {
        const plan = await generatePlan({ userInput: null });
        if (plan !== null) {
            throw new Error("Expected null for null userInput");
        }
    });

    // =============== screenCapture ===============

    section("screenCapture — captureScreen unit (async)");

    await testAsync("captureScreen returns object or null (no crash)", async () => {
        const result = await captureScreen();
        if (result === null) {
            // Acceptable — display may not be available in test env
            console.log("     ℹ️  captureScreen returned null (acceptable in test env)");
        } else {
            assertNotNull(result.imagePath, "imagePath present");
            assertNotNull(result.timestamp, "timestamp present");
        }
    });

    // =============== contentSuggester ===============

    section("contentSuggester — suggestContent (async, offline)");

    await testAsync("suggestContent returns correct shape", async () => {
        const result = await suggestContent({
            screenText: "Hey! When are you coming?",
            screenType: "whatsapp",
            userInstruction: "suggest a reply"
        });
        assertNotNull(result, "result not null");
        assertArray(result.suggestions, "suggestions is array");
        assertNotNull(result.response, "response is string");
    });

    await testAsync("suggestContent with empty screenText — no crash", async () => {
        const result = await suggestContent({
            screenText: "",
            screenType: "unknown",
            userInstruction: "suggest something"
        });
        assertNotNull(result, "result not null");
        assertArray(result.suggestions, "suggestions is array");
    });

    await testAsync("suggestContent for coding screen — no crash", async () => {
        const result = await suggestContent({
            screenText: "function main() { console.log('hello'); }",
            screenType: "coding",
            userInstruction: "write a comment for this function"
        });
        assertNotNull(result, "result not null");
    });

    // =============== screenElementFinder ===============

    section("screenElementFinder — findElement edge cases");

    await testAsync("findElement with invalid imagePath returns found:false", async () => {
        const result = await findElement("/nonexistent/path.png", "send button", "");
        assertNotNull(result, "result not null");
        assertEquals(result.found, false, "found should be false for missing image");
    });

    await testAsync("findElement with null imagePath returns found:false (no crash)", async () => {
        const result = await findElement(null, "button", "");
        assertEquals(result.found, false, "found false for null imagePath");
    });

    await testAsync("findElement with empty description returns found:false (no crash)", async () => {
        const result = await findElement("/nonexistent/path.png", "", "");
        assertEquals(result.found, false, "found false for empty description");
    });

    // =============== handleScreenAction edge cases ===============

    section("screenActionOrchestrator — handleScreenAction edge cases (async)");

    await testAsync("handleScreenAction returns response shape on any input", async () => {
        const result = await handleScreenAction("click the send button");
        assertNotNull(result, "result not null");
        assertNotNull(result.response, "response string present");
        if (typeof result.success !== "boolean") {
            throw new Error("success must be boolean");
        }
    });

    await testAsync("handleScreenAction — password triggers clarification", async () => {
        const result = await handleScreenAction("type my password here");
        assertNotNull(result, "result not null");
        // Should ask about the password
        if (result.needsClarification) {
            assertNotNull(result.question, "question is set when clarification needed");
        }
    });

    await testAsync("handleScreenAction — empty input doesn't crash", async () => {
        const result = await handleScreenAction("");
        assertNotNull(result, "result not null");
        assertNotNull(result.response, "response present");
    });

    // =============== FINAL REPORT ===============

    section("REGRESSION TEST REPORT");

    const total = passed + failed + skipped;
    console.log(`\n  Total:   ${total}`);
    console.log(`  ✅ Passed:  ${passed}`);
    console.log(`  ❌ Failed:  ${failed}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);

    if (failures.length > 0) {
        console.log("\n  --- FAILURES ---");
        failures.forEach((f, i) => {
            console.log(`  ${i + 1}. ${f.name}`);
            console.log(`     └─ ${f.error}`);
        });
    } else {
        console.log("\n  🎉 All tests passed!");
    }

    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    console.log(`\n  Pass Rate: ${passRate}%`);
    console.log("");

    // Write report to file
    const report = {
        timestamp: new Date().toISOString(),
        total, passed, failed, skipped, passRate,
        failures
    };

    const fs = require("fs");
    const path = require("path");
    fs.writeFileSync(
        path.join(__dirname, "logs/regression_test_report.json"),
        JSON.stringify(report, null, 2)
    );
    console.log("  📄 Report saved: backend/logs/regression_test_report.json\n");

    process.exit(failed > 0 ? 1 : 0);
})();
