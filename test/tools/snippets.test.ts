import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { createTestClient } from '../setup'

function callTool(client: Client, name: string, args: Record<string, unknown> = {}) {
  return client.callTool({ name, arguments: args })
}

function parseResult(result: Awaited<ReturnType<Client['callTool']>>): any {
  const content = result.content as Array<{ type: string; text: string }>
  return JSON.parse(content[0].text)
}

function resultText(result: Awaited<ReturnType<Client['callTool']>>): string {
  const content = result.content as Array<{ type: string; text: string }>
  return content[0].text
}

describe('snippets tools', () => {
  let client: Client
  const createdIds: string[] = []

  beforeAll(async () => {
    client = await createTestClient()
  })

  afterAll(async () => {
    for (const id of createdIds) {
      try {
        await callTool(client, 'snippets_delete', { id })
      } catch {}
    }
  })

  describe('snippets_browse', () => {
    it('returns an array of snippets', async () => {
      const result = await callTool(client, 'snippets_browse')
      const data = parseResult(result)
      expect(Array.isArray(data)).toBe(true)
    })

    it('respects pagination parameters', async () => {
      const result = await callTool(client, 'snippets_browse', { limit: 1, page: 1 })
      const data = parseResult(result)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeLessThanOrEqual(1)
    })

    it('includes content fields (mobiledoc, lexical)', async () => {
      // Create a snippet so there's at least one to browse
      const addResult = await callTool(client, 'snippets_add', {
        name: 'Browse Content Test',
        lexical: '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
      })
      const added = parseResult(addResult)
      createdIds.push(added.id)

      const result = await callTool(client, 'snippets_browse')
      const data = parseResult(result)
      const snippet = data.find((s: any) => s.id === added.id)
      expect(snippet).toBeDefined()
      expect(snippet).toHaveProperty('mobiledoc')
      expect(snippet).toHaveProperty('lexical')
    })
  })

  describe('snippets_read', () => {
    it('returns a snippet by ID with full fields', async () => {
      const addResult = await callTool(client, 'snippets_add', {
        name: 'Read Test Snippet',
        lexical: '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
      })
      const added = parseResult(addResult)
      createdIds.push(added.id)

      const result = await callTool(client, 'snippets_read', { id: added.id })
      const snippet = parseResult(result)
      expect(snippet.id).toBe(added.id)
      expect(snippet.name).toBe('Read Test Snippet')
      expect(snippet).toHaveProperty('mobiledoc')
      expect(snippet).toHaveProperty('lexical')
      expect(snippet).toHaveProperty('created_at')
      expect(snippet).toHaveProperty('updated_at')
    })
  })

  describe('snippets_add', () => {
    it('creates a snippet with name and lexical string', async () => {
      const lexical = '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}'
      const result = await callTool(client, 'snippets_add', {
        name: 'Add Test String',
        lexical,
      })
      const snippet = parseResult(result)
      createdIds.push(snippet.id)

      expect(snippet.name).toBe('Add Test String')
      expect(snippet.id).toBeDefined()
    })

    it('creates a snippet with lexical as an object (auto-stringified)', async () => {
      const lexical = { root: { children: [], direction: null, format: '', indent: 0, type: 'root', version: 1 } }
      const result = await callTool(client, 'snippets_add', {
        name: 'Add Test Object',
        lexical,
      })
      const snippet = parseResult(result)
      createdIds.push(snippet.id)

      expect(snippet.name).toBe('Add Test Object')
      expect(snippet.id).toBeDefined()
    })

    it('sends mobiledoc as empty JSON string', async () => {
      const result = await callTool(client, 'snippets_add', {
        name: 'Mobiledoc Check',
        lexical: '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
      })
      const snippet = parseResult(result)
      createdIds.push(snippet.id)

      // Read it back to verify mobiledoc was set
      const readResult = await callTool(client, 'snippets_read', { id: snippet.id })
      const full = parseResult(readResult)
      expect(full.mobiledoc).toBe('{}')
    })
  })

  describe('snippets_edit', () => {
    it('updates snippet name', async () => {
      const addResult = await callTool(client, 'snippets_add', {
        name: 'Edit Before',
        lexical: '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
      })
      const added = parseResult(addResult)
      createdIds.push(added.id)

      const result = await callTool(client, 'snippets_edit', {
        id: added.id,
        name: 'Edit After',
      })
      const updated = parseResult(result)
      expect(updated.name).toBe('Edit After')
    })

    it('updates snippet lexical content', async () => {
      const addResult = await callTool(client, 'snippets_add', {
        name: 'Edit Lexical Test',
        lexical: '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
      })
      const added = parseResult(addResult)
      createdIds.push(added.id)

      const newLexical = '{"root":{"children":[{"type":"paragraph","children":[{"text":"updated"}]}],"direction":null,"format":"","indent":0,"type":"root","version":1}}'
      const result = await callTool(client, 'snippets_edit', {
        id: added.id,
        lexical: newLexical,
      })
      const updated = parseResult(result)
      expect(updated.id).toBe(added.id)
    })
  })

  describe('snippets_delete', () => {
    it('deletes a snippet and returns confirmation with ID', async () => {
      const addResult = await callTool(client, 'snippets_add', {
        name: 'Delete Me',
        lexical: '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
      })
      const added = parseResult(addResult)

      const result = await callTool(client, 'snippets_delete', { id: added.id })
      const text = resultText(result)
      expect(text).toContain(added.id)

      // Verify it's gone — read should error or return not found
      const readResult = await callTool(client, 'snippets_read', { id: added.id })
      const readText = resultText(readResult)
      expect(readText.toLowerCase()).toMatch(/not found|error/)
    })
  })

  describe('authentication errors', () => {
    it('returns error when GHOST_USERNAME is not set', async () => {
      const origUser = process.env.GHOST_USERNAME
      const origPass = process.env.GHOST_PASSWORD
      delete process.env.GHOST_USERNAME
      delete process.env.GHOST_PASSWORD

      try {
        // Create a fresh client without credentials
        const freshClient = await createTestClient()
        const result = await callTool(freshClient, 'snippets_browse')
        const text = resultText(result)
        expect(text.toLowerCase()).toMatch(/ghost_username|ghost_password|session|authentication/)
      } finally {
        if (origUser) process.env.GHOST_USERNAME = origUser
        if (origPass) process.env.GHOST_PASSWORD = origPass
      }
    })
  })
})
