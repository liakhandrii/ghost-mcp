import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { execFile } from 'child_process'
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

const isMac = process.platform === 'darwin'

/** Sign Safari into the test Ghost instance so session cookies are available */
async function signInSafari(ghostUrl: string) {
  // Use a synchronous XMLHttpRequest so AppleScript can capture the result
  const js = `(function(){var x=new XMLHttpRequest();x.open("POST","${ghostUrl}/ghost/api/admin/session/",false);x.setRequestHeader("Content-Type","application/json");x.withCredentials=true;x.send(JSON.stringify({username:"test@example.com",password:"T3st!ng_Gh0st_S3tup"}));return x.status.toString();})()`

  const script = `
tell application "Safari"
  if (count of windows) = 0 then make new document
  set URL of current tab of front window to "${ghostUrl}/ghost/"
  delay 3
  return do JavaScript "${js.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" in current tab of front window
end tell
  `
  return new Promise<string>((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: 20000 }, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout.trim())
    })
  })
}

describe.runIf(isMac)('snippets tools', () => {
  let client: Client
  const createdIds: string[] = []

  beforeAll(async () => {
    client = await createTestClient()
    // Sign Safari into the test Ghost instance
    const ghostUrl = process.env.GHOST_API_URL || 'http://localhost:2368'
    await signInSafari(ghostUrl)
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
      const result = await callTool(client, 'snippets_add', {
        name: 'Add Test String',
        lexical: '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
      })
      const snippet = parseResult(result)
      createdIds.push(snippet.id)
      expect(snippet.name).toBe('Add Test String')
      expect(snippet.id).toBeDefined()
    })

    it('creates a snippet with lexical as an object (auto-stringified)', async () => {
      const result = await callTool(client, 'snippets_add', {
        name: 'Add Test Object',
        lexical: { root: { children: [], direction: null, format: '', indent: 0, type: 'root', version: 1 } },
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

      const result = await callTool(client, 'snippets_edit', { id: added.id, name: 'Edit After' })
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
      const result = await callTool(client, 'snippets_edit', { id: added.id, lexical: newLexical })
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

      const readResult = await callTool(client, 'snippets_read', { id: added.id })
      const readText = resultText(readResult)
      expect(readText.toLowerCase()).toMatch(/not found|error/)
    })
  })

  describe('authentication', () => {
    it('returns error mentioning Safari when not authenticated', async () => {
      // Validates error message format — either succeeds or tells user to sign in via Safari
      const result = await callTool(client, 'snippets_browse')
      const text = resultText(result)
      if (text.startsWith('Error:')) {
        expect(text.toLowerCase()).toMatch(/safari|sign.?in|not signed/)
      }
    })
  })
})

describe.runIf(!isMac)('snippets tools (non-macOS)', () => {
  it('does not register snippet tools on non-macOS', async () => {
    const client = await createTestClient()
    const result = await client.listTools()
    const snippetTools = result.tools.filter(t => t.name.startsWith('snippets_'))
    expect(snippetTools).toHaveLength(0)
  })
})
