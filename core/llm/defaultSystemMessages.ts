/*
  Default system messages for Continue, extended by KiroVSX.
  These prepend Kiro's base prompt to all modes, and append the task execution
  prompt to the Agent mode when available. Prompts can be injected at runtime
  by setting globalThis.__KIRO_BASE_SYSTEM_PROMPT__ and
  globalThis.__KIRO_TASK_EXECUTION_PROMPT__ from the IDE side.
*/

function getKiroBasePrompt(): string {
  try {
    const injected = (globalThis as any)["__KIRO_BASE_SYSTEM_PROMPT__"];
    if (typeof injected === "string" && injected.trim().length > 0) {
      return injected;
    }
  } catch {}
  // Fallback concise preface when no injected Kiro prompt is found
  return [
    "KiroVSX Preface:",
    "- Apply Kiro methodology: progressive context (Flow 1-2-3), steering rules, hooks, and task focus.",
    "- Be concise, propose clear next steps, and prefer small, verifiable changes.",
  ].join("\n");
}

function getKiroTaskExecutionPrompt(): string {
  try {
    const injected = (globalThis as any)["__KIRO_TASK_EXECUTION_PROMPT__"];
    if (typeof injected === "string" && injected.trim().length > 0) {
      return injected;
    }
  } catch {}
  // Fallback task execution guidance
  return [
    "Kiro Task Execution:",
    "1) Restate the immediate task and acceptance criteria.",
    "2) Outline a minimal plan and confirm edge cases.",
    "3) Implement step-by-step, validating after each step.",
    "4) Summarize changes and provide follow-ups.",
  ].join("\n");
}

const CHAT_CORE = [
  "You are Continue Chat.",
  "Be helpful, precise, and concise. When writing code, prefer readable, well-structured solutions.",
].join("\n");

const AGENT_CORE = [
  "You are Continue Agent.",
  "Propose a short plan, then execute changes safely. Use minimal diffs and explain implications briefly.",
].join("\n");

const PLAN_CORE = [
  "You are Continue Planner.",
  "Produce actionable, prioritized plans with clear deliverables and checkpoints.",
].join("\n");

export const DEFAULT_CHAT_SYSTEM_MESSAGE = [getKiroBasePrompt(), CHAT_CORE].join(
  "\n\n",
);

export const DEFAULT_AGENT_SYSTEM_MESSAGE = [
  getKiroBasePrompt(),
  AGENT_CORE,
  getKiroTaskExecutionPrompt(),
].join("\n\n");

export const DEFAULT_PLAN_SYSTEM_MESSAGE = [getKiroBasePrompt(), PLAN_CORE].join(
  "\n\n",
);

export const DEFAULT_SYSTEM_MESSAGES_URL = "https://docs.continue.dev/customize/deep-dives/system-messages";

export { getKiroBasePrompt, getKiroTaskExecutionPrompt };


