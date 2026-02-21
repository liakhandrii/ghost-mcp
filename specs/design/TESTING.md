# Testing Design

## Framework: Vitest

Vitest is the clear choice. The MCP TypeScript SDK itself uses vitest for its own tests. It has native TypeScript support (no `ts-jest` config needed), a Jest-compatible API, and works well with CommonJS projects. It's fast and requires minimal setup.

## Testing Approach: Narrow Integration Tests via `InMemoryTransport`

The MCP SDK (v1.x) exports `InMemoryTransport` from `@modelcontextprotocol/sdk/inMemory.js` and `Client` from `@modelcontextprotocol/sdk/client/index.js`. The pattern is:

1. Create the real `McpServer` (the same one from `server.ts`)
2. Create an `InMemoryTransport.createLinkedPair()` — two transports wired together in memory
3. Connect the server to one end, a `Client` to the other
4. Call `client.callTool({ name: "posts_browse", arguments: {...} })` and assert on the result

Tests run against a real Ghost instance (not mocks):
- Require the Ghost Docker container running (via `./scripts/start-ghost.sh`)
- Load real API credentials from env vars (`GHOST_API_URL`, `GHOST_ADMIN_API_KEY`)
- Call tools through the MCP client → server → real Ghost API pipeline
- Assert on real responses

## Ghost Test Instance

Tests require a local Ghost instance. The container is created and destroyed automatically with each test run via npm `pretest`/`posttest` hooks:

- `pretest` runs `./scripts/start-ghost.sh` — starts a Ghost 6 Docker container, creates an admin user, and writes API keys to `.ghost-api-key`
- `posttest` runs `./scripts/stop-ghost.sh` — removes the container

The `.ghost-api-key` file uses standard `KEY=VALUE` format:

```
GHOST_API_URL=http://localhost:2368
GHOST_ADMIN_API_KEY=<id>:<secret>
GHOST_CONTENT_API_KEY=<key>
```

The test setup file (`test/setup.ts`) reads `.ghost-api-key` and loads the values into `process.env` before tests run. No manual sourcing or extra dependencies required.

To use a different port: `GHOST_PORT=3000 npm test`

For iterative development, start Ghost manually with `npm run ghost:start`, then use `npm run test:watch` (npm only runs pre/post hooks for exact script name matches, so the container stays up across re-runs).

## Installation

```
npm install -D vitest
```

No extra transform plugins needed — vitest handles TypeScript natively.

## NPM Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

## Config File (`vitest.config.ts`)

Minimal — just set a longer timeout since these are integration tests hitting a real API:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
```

## Test File Structure

```
test/
  tools/
    posts.test.ts
    members.test.ts
    tags.test.ts
    ...
  setup.ts              # shared: create server + client via InMemoryTransport
```

## Test Pattern

```ts
// test/setup.ts — shared helper
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"

// Build the real server (same registrations as server.ts)
// Connect client ↔ server via InMemoryTransport
// Export a helper that gives tests a connected client
```

```ts
// test/tools/posts.test.ts
import { describe, it, expect } from 'vitest'

describe('posts_browse', () => {
  it('returns posts from Ghost', async () => {
    const result = await client.callTool({ name: 'posts_browse', arguments: {} })
    const posts = JSON.parse(result.content[0].text)
    expect(Array.isArray(posts)).toBe(true)
  })
})
```

## Key Decisions

- **`InMemoryTransport` over `StdioClientTransport`** — avoids subprocess spawning overhead, still exercises the full MCP JSON-RPC serialization, tool dispatch, and Zod validation
- **Real Ghost API, no mocks** — these are integration tests that validate the tools actually work against Ghost
- **Vitest over Jest** — native TS, zero config, same API, and it's what the MCP SDK itself uses
- **Longer timeouts (30s)** — network calls to Docker Ghost can be slow, especially on first run
