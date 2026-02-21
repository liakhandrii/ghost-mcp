# Project Overview

Ghost MCP Server — a TypeScript MCP server that lets LLM clients (like Claude Desktop) manage a Ghost CMS blog via the Admin API.

## Architecture

- `src/server.ts` — entry point, creates `McpServer`, registers all resources/tools/prompts, connects via `StdioServerTransport`
- `src/config.ts` — reads `GHOST_API_URL`, `GHOST_ADMIN_API_KEY`, `GHOST_API_VERSION` from env vars
- `src/ghostApi.ts` — initializes a single `@tryghost/admin-api` client instance
- `src/models.ts` — TypeScript interfaces for Post, User, Member, Tier, Offer, Newsletter
- `src/resources.ts` — MCP resource handlers (mostly stubs with TODOs — not yet wired to real API calls)
- `src/prompts.ts` — one prompt: `summarize-post`

## Tools

10 modules in `src/tools/` covering all Ghost resources:

- `posts.ts` — browse, read, add, edit, delete + sync_from_ghost and sync_to_ghost (bidirectional local filesystem sync with conflict detection)
- `members.ts`, `tags.ts`, `newsletters.ts`, `offers.ts`, `tiers.ts`, `users.ts` — standard CRUD (browse/read/add/edit/delete)
- `roles.ts` — browse/read only
- `invites.ts` — browse/add/delete
- `webhooks.ts` — add/edit/delete (no browse)

All tools follow the same pattern: Zod schemas for params → call `ghostApiClient.<resource>.<method>()` → return JSON. Browse operations use optimized field lists to keep responses lightweight.
