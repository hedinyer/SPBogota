import assert from "node:assert";
import {
  appendTextDelta,
  applyToolProgress,
  applyToolProgressToParts,
  completeRunningTools,
  completeRunningToolsInParts,
  parseToolProgress,
  textFromParts,
  toolsFromParts,
  type AssistantStreamPart,
} from "./tool-progress.ts";

assert.equal(parseToolProgress("nope"), null);
assert.equal(parseToolProgress("[]"), null);

const started = parseToolProgress(
  JSON.stringify({
    tool: "search_clients",
    emoji: "🔍",
    label: "`juan`",
    toolCallId: "call_1",
    status: "running",
  }),
);
assert.ok(started);
let tools = applyToolProgress([], started);
assert.equal(tools.length, 1);
assert.equal(tools[0].id, "call_1");
assert.equal(tools[0].status, "running");
assert.equal(tools[0].label, "`juan`");

tools = applyToolProgress(tools, {
  tool: "search_clients",
  toolCallId: "call_1",
  status: "completed",
});
assert.equal(tools[0].status, "completed");
assert.equal(tools[0].label, "`juan`");

assert.deepEqual(applyToolProgress([], { tool: "_thinking", status: "running" }), []);

tools = applyToolProgress([], { name: "inbox_queues", status: "running" });
tools = applyToolProgress(tools, { name: "inbox_queues", status: "completed" });
assert.equal(tools.length, 1);
assert.equal(tools[0].status, "completed");

const hanging = applyToolProgress([], {
  tool: "get_caja_hoy",
  toolCallId: "call_2",
  status: "running",
});
assert.equal(completeRunningTools(hanging)[0].status, "completed");

// Interleaved parts: text → tool → text
let parts: AssistantStreamPart[] = [];
parts = appendTextDelta(parts, "Busco…");
parts = applyToolProgressToParts(parts, {
  tool: "list_licencias",
  toolCallId: "t1",
  status: "running",
});
parts = applyToolProgressToParts(parts, {
  tool: "list_licencias",
  toolCallId: "t1",
  status: "completed",
  label: "12",
});
parts = appendTextDelta(parts, " Hay 12.");
assert.equal(parts.length, 3);
assert.equal(parts[0].kind, "text");
assert.equal(parts[1].kind, "tools");
assert.equal(parts[2].kind, "text");
assert.equal(textFromParts(parts), "Busco… Hay 12.");
assert.equal(toolsFromParts(parts)[0].status, "completed");

// Consecutive tools stay in one block; text after opens a new segment
parts = applyToolProgressToParts(parts, {
  tool: "tool_search",
  toolCallId: "t2",
  status: "running",
});
assert.equal(parts.length, 4);
assert.equal(parts[3].kind, "tools");
parts = completeRunningToolsInParts(parts);
assert.equal(toolsFromParts(parts).every((t) => t.status === "completed"), true);

console.log("tool-progress.check OK");
