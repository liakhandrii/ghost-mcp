# Snippets Tools

## Overview

Tools for managing Ghost CMS snippets through the MCP server. The snippets API is undocumented and not supported by `@tryghost/admin-api`. It requires session-based (cookie) authentication — integration API tokens are explicitly denied.

## Authentication Prerequisite

The snippets endpoint rejects JWT/integration tokens with a `NoPermissionError`. All snippets tools require session-based authentication.

When `GHOST_USERNAME` and `GHOST_PASSWORD` environment variables are configured, the system shall authenticate via `POST /ghost/api/admin/session/` and manage the session cookie for subsequent requests.

Where `GHOST_USERNAME` or `GHOST_PASSWORD` is not configured, the system shall return an error explaining that snippets require session-based authentication and listing the required environment variables.

Where session creation fails, the system shall return the error from Ghost (e.g., device verification failure) and suggest checking Ghost's `security.staffDeviceVerification` setting for self-hosted instances.

Where a session cookie expires or returns 401 on a subsequent request, the system shall re-authenticate once and retry the request. If re-authentication fails, the system shall return an error.

## Tool Requirements (EARS)

### snippets_browse

When the user requests to list snippets, the system shall return snippet data including id, name, created_at, and updated_at.

The system shall request `?formats=mobiledoc,lexical` to include content fields in the response.

Where pagination parameters are provided, the system shall return snippets according to the specified limit and page.

### snippets_read

When the user requests a specific snippet by ID, the system shall return the full snippet including id, name, mobiledoc, lexical, created_at, and updated_at.

The system shall request `?formats=mobiledoc,lexical` to include content fields in the response.

### snippets_add

When the user requests to create a snippet, the system shall accept name and lexical parameters.

Where a lexical value is provided, the system shall JSON-stringify it if it is an object before sending to the API.

The system shall send the payload as `{ snippets: [{ name, mobiledoc: "{}", lexical }] }`.

### snippets_edit

When the user requests to update a snippet by ID, the system shall accept updated name and/or lexical parameters.

Where a lexical value is provided, the system shall JSON-stringify it if it is an object before sending to the API.

The system shall send the payload via `PUT /snippets/:id`.

### snippets_delete

When the user requests to delete a snippet by ID, the system shall permanently remove the snippet from Ghost.

If a snippet is deleted, then the system shall return a confirmation message with the deleted snippet ID.

## Implementation Notes

### Direct HTTP Calls

Since `@tryghost/admin-api` does not support snippets, all requests shall be made directly via HTTP (e.g., `fetch`) to `/ghost/api/admin/snippets/`.

### Session Management

The system shall store the session cookie in memory and reuse it across requests. A helper module should handle:

1. Initial login (`POST /ghost/api/admin/session/`) — extract `Set-Cookie` header
2. Attaching the cookie to all snippets API requests
3. Re-authentication on 401 responses

### Ghost(Pro) Limitation

Ghost 6+ enables `security.staffDeviceVerification` by default, which requires email-based verification on session login. Self-hosted instances can disable this; Ghost(Pro) instances cannot. Session auth may be unreliable on Ghost(Pro).
