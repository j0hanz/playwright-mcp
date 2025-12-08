# AGENTS

Guidance for AI agents working in this repository (MCP Playwright Server).

## Mission & Scope

- Provide a robust MCP server that drives Playwright (v1.57+) for browser automation, accessibility scans, and test authoring.
- Keep changes TypeScript-first (ESM) and align with existing action/handler patterns.
- Default runtime: Node.js 18+, headless Chromium unless overridden by env.

## How to Run

- Install deps: `npm install && npm run install:browsers`.
- Dev server (stdio for MCP clients): `npm run dev`.
- Build + start: `npm run build && npm start`.
- Typical MCP client config (local stdio):

  ```json
  {
    "servers": {
      "playwright": {
        "type": "stdio",
        "command": "npm",
        "args": ["run", "dev"]
      }
    }
  }
  ```

## Coding Rules

- Follow the handler pattern: register tools with `server.registerTool(..., createToolHandler(...))`; keep schemas in `src/server/handlers/schemas.ts`.
- Extend `BaseAction` and use `executePageOperation` for page work; avoid duplicating session/error logic.
- Locator priority: role → label → placeholder → text → testId → selector (last resort). Prefer semantic locators and `expect`-based assertions.
- Avoid `waitForTimeout`; rely on Playwright auto-wait and web-first assertions.
- Keep ASCII, respect existing lint/format rules (`npm run lint`, `npm run format`).

## Key Commands

- Lint: `npm run lint` | Auto-fix: `npm run lint:fix`
- Type check: `npm run type-check`
- Tests: `npm test` (UI: `npm run test:ui`, headed: `npm run test:headed`)
- Build: `npm run build`

## Configuration Facts (see `src/config/server-config.ts`)

- Default browser `chromium`, headless `true`, viewport 1366x900.
- Timeouts (ms): action 20_000, navigation 30_000, assertion 5_000.
- Session limits: maxConcurrentSessions 5, maxSessionsPerMinute 10; uploads capped at 50 MB.
- Test ID attribute: `data-testid`; HTTPS errors blocked unless `IGNORE_HTTPS_ERRORS=true`.

## Tooling Overview (for prompt grounding)

- Browser/session: launch/close/list tabs, storage state, reset.
- Navigation: goto/back/forward/reload/dialog handling.
- Interaction: unified click/fill/hover (role/text/testid/selector), select options, drag-drop, checkbox_set, keyboard_press/type, file_upload.
- Assertions: visibility, text/value/url/title/attribute/css/checked/count/viewport.
- Page ops: screenshots, content snapshot, wait_for_selector/load state, accessibility scan.

## When adding tools/features

- Put schemas in `schemas.ts`; reuse enums (ARIA roles, mouse buttons, elementIndex).
- Return both `content` (human text) and `structuredContent` (typed result).
- Add retries via `withRetry` when flakiness is likely; include retry metadata in responses.

## GitHub MCP Server (for Copilot/Codex setups)

- Remote GitHub MCP endpoint: `https://api.githubcopilot.com/mcp/` (use OAuth or PAT in client config) citeturn0search3
- Limit exposed GitHub capabilities with toolsets, e.g. `GITHUB_TOOLSETS="repos,issues"` to reduce surface area and context size. citeturn0search0
- Prefer OAuth over PAT; if using PAT, grant minimum scopes required for selected toolsets. citeturn0search3

## Safety Notes for Agents

- Do not store secrets or tokens in the repo; pass via env.
- Validate upload paths (`file_upload` uses `validateUploadPath`) and only accept absolute paths you trust.
- Keep sessions isolated; avoid reusing contexts across users.
- Before calling destructive tools (clear, checkbox_set false, etc.), restate intent to the user.

## Useful References

- Patterns and coding standards: `.github/copilot-instructions.md`
- Playwright agent prompt guidance: `docs/playwright.agent.md`
- Best practices for stable tests: `docs/best-practices.md`
