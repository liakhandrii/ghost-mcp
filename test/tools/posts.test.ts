import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { createTestClient } from '../setup'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const GHOST_DIR = path.resolve('ghost/posts')

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

function readMeta(slug: string) {
  return JSON.parse(fs.readFileSync(path.join(GHOST_DIR, slug, 'meta.json'), 'utf-8'))
}

function readLexical(slug: string) {
  return JSON.parse(fs.readFileSync(path.join(GHOST_DIR, slug, 'lexical.json'), 'utf-8'))
}

function readHtml(slug: string) {
  return fs.readFileSync(path.join(GHOST_DIR, slug, 'html.html'), 'utf-8')
}

function readMarkdown(slug: string) {
  return fs.readFileSync(path.join(GHOST_DIR, slug, 'markdown.md'), 'utf-8')
}

function writeMeta(slug: string, data: Record<string, unknown>) {
  const dir = path.join(GHOST_DIR, slug)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(data, null, 2))
}

function writeLexical(slug: string, data: Record<string, unknown>) {
  const dir = path.join(GHOST_DIR, slug)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'lexical.json'), JSON.stringify(data, null, 2))
}

function writeHtml(slug: string, content: string) {
  const dir = path.join(GHOST_DIR, slug)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'html.html'), content)
}

function writeMarkdown(slug: string, content: string) {
  const dir = path.join(GHOST_DIR, slug)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'markdown.md'), content)
}

function cleanGhostDir() {
  if (fs.existsSync(GHOST_DIR)) {
    fs.rmSync(GHOST_DIR, { recursive: true, force: true })
  }
}

describe('posts sync tools', () => {
  let client: Client
  let testPost: any

  beforeAll(async () => {
    client = await createTestClient()

    // Create a test post with HTML content
    const result = await callTool(client, 'posts_add', {
      title: 'Sync Test Post',
      html: '<p>Hello sync world</p>',
      status: 'draft',
    })
    testPost = parseResult(result)
  })

  afterEach(() => {
    cleanGhostDir()
  })

  // --- posts_sync_from_ghost ---

  describe('posts_sync_from_ghost', () => {
    it('creates ghost/posts/ directory if it does not exist', async () => {
      await callTool(client, 'posts_sync_from_ghost')
      expect(fs.existsSync(GHOST_DIR)).toBe(true)
    })

    it('syncs all posts into slug-named directories with meta.json and lexical.json', async () => {
      await callTool(client, 'posts_sync_from_ghost')

      const slugDir = path.join(GHOST_DIR, testPost.slug)
      expect(fs.existsSync(slugDir)).toBe(true)
      expect(fs.existsSync(path.join(slugDir, 'meta.json'))).toBe(true)
      expect(fs.existsSync(path.join(slugDir, 'lexical.json'))).toBe(true)
    })

    it('meta.json contains post fields but not the lexical field', async () => {
      await callTool(client, 'posts_sync_from_ghost')
      const meta = readMeta(testPost.slug)

      expect(meta.id).toBe(testPost.id)
      expect(meta.title).toBe('Sync Test Post')
      expect(meta.updated_at).toBeDefined()
      expect(meta).not.toHaveProperty('lexical')
    })

    it('lexical.json contains parsed JSON (not a string)', async () => {
      await callTool(client, 'posts_sync_from_ghost')
      const lexical = readLexical(testPost.slug)

      // lexical should be an object (parsed from the JSON string Ghost returns)
      expect(typeof lexical).toBe('object')
      expect(lexical).not.toBeNull()
    })

    it('syncs only specified post IDs when provided', async () => {
      // Create a second post
      const result2 = await callTool(client, 'posts_add', {
        title: 'Sync Test Post 2',
        status: 'draft',
      })
      const post2 = parseResult(result2)

      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      expect(fs.existsSync(path.join(GHOST_DIR, testPost.slug))).toBe(true)
      expect(fs.existsSync(path.join(GHOST_DIR, post2.slug))).toBe(false)
    })

    it('skips a post when local updated_at equals Ghost and content is identical', async () => {
      // First sync to populate local files
      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      // Second sync — should skip since nothing changed
      const result = await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })
      const report = resultText(result)

      expect(report).toContain('skip')
    })

    it('updates local files when local updated_at is older than Ghost', async () => {
      // Sync first
      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      // Tamper local updated_at to be older
      const meta = readMeta(testPost.slug)
      meta.updated_at = '2000-01-01T00:00:00.000Z'
      writeMeta(testPost.slug, meta)

      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      const updatedMeta = readMeta(testPost.slug)
      expect(updatedMeta.updated_at).not.toBe('2000-01-01T00:00:00.000Z')
    })

    it('errors for a post when local updated_at equals Ghost but content differs', async () => {
      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      // Modify local content but keep same updated_at
      const meta = readMeta(testPost.slug)
      meta.title = 'Locally Modified Title'
      writeMeta(testPost.slug, meta)

      const result = await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })
      const report = resultText(result)

      expect(report.toLowerCase()).toContain('conflict')
    })

    it('errors for a post when local updated_at is newer than Ghost and content differs', async () => {
      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      // Set local updated_at to the future and change content
      const meta = readMeta(testPost.slug)
      meta.updated_at = '2099-01-01T00:00:00.000Z'
      meta.title = 'Future Modified Title'
      writeMeta(testPost.slug, meta)

      const result = await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })
      const report = resultText(result)

      expect(report.toLowerCase()).toContain('conflict')
    })

    it('errors for a post when meta.json contains invalid JSON', async () => {
      // Create local dir with bad meta.json
      const dir = path.join(GHOST_DIR, testPost.slug)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'meta.json'), '{invalid json')

      const result = await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })
      const report = resultText(result)

      expect(report.toLowerCase()).toContain('error')
    })

    it('errors for a post when meta.json is missing id or updated_at', async () => {
      writeMeta(testPost.slug, { title: 'No ID or updated_at' })

      const result = await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })
      const report = resultText(result)

      expect(report.toLowerCase()).toContain('error')
    })

    it('returns a sync report with synced and skipped counts', async () => {
      const result = await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })
      const report = resultText(result)

      expect(report).toMatch(/sync/i)
      expect(report).toMatch(/skip/i)
    })

    it('preserves existing ghost/posts/ directory on network failure', async () => {
      // Sync first to populate
      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })
      const metaBefore = readMeta(testPost.slug)

      // Try syncing a non-existent post ID to trigger an error
      await callTool(client, 'posts_sync_from_ghost', { ids: ['nonexistent_id_000'] })

      // Original files should still be intact
      const metaAfter = readMeta(testPost.slug)
      expect(metaAfter.id).toBe(metaBefore.id)
    })
  })

  // --- posts_sync_to_ghost ---

  describe('posts_sync_to_ghost', () => {
    it('syncs local changes to Ghost', async () => {
      // Pull from Ghost first
      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      // Modify local title
      const meta = readMeta(testPost.slug)
      meta.title = 'Updated Via Sync To Ghost'
      writeMeta(testPost.slug, meta)

      await callTool(client, 'posts_sync_to_ghost', { ids: [testPost.id] })

      // Verify in Ghost
      const readResult = await callTool(client, 'posts_read', { id: testPost.id })
      const ghostPost = parseResult(readResult)
      expect(ghostPost.title).toBe('Updated Via Sync To Ghost')
    })

    it('combines meta.json and lexical.json when syncing to Ghost', async () => {
      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      // Modify lexical content
      const lexical = readLexical(testPost.slug)
      writeLexical(testPost.slug, lexical) // re-write same content to ensure it's sent

      const meta = readMeta(testPost.slug)
      meta.title = 'Lexical Combo Test'
      writeMeta(testPost.slug, meta)

      await callTool(client, 'posts_sync_to_ghost', { ids: [testPost.id] })

      const readResult = await callTool(client, 'posts_read', { id: testPost.id })
      const ghostPost = parseResult(readResult)
      expect(ghostPost.title).toBe('Lexical Combo Test')
    })

    it('ignores lexical field in meta.json and never sends it to Ghost API', async () => {
      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      // Inject a lexical field into meta.json — it should be ignored
      const meta = readMeta(testPost.slug)
      meta.lexical = '{"bogus": true}'
      meta.title = 'Lexical In Meta Ignored'
      writeMeta(testPost.slug, meta)

      const result = await callTool(client, 'posts_sync_to_ghost', { ids: [testPost.id] })
      // Should succeed without error — the bogus lexical in meta is ignored
      const report = resultText(result)
      expect(report.toLowerCase()).not.toContain('error')
    })

    it('does not include lexical field when lexical.json does not exist', async () => {
      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      // Remove lexical.json
      fs.unlinkSync(path.join(GHOST_DIR, testPost.slug, 'lexical.json'))

      const meta = readMeta(testPost.slug)
      meta.title = 'No Lexical File'
      writeMeta(testPost.slug, meta)

      const result = await callTool(client, 'posts_sync_to_ghost', { ids: [testPost.id] })
      const report = resultText(result)
      expect(report.toLowerCase()).not.toContain('error')
    })

    it('syncs only specified post IDs when provided', async () => {
      const result2 = await callTool(client, 'posts_add', {
        title: 'Sync To Ghost Post 2',
        status: 'draft',
      })
      const post2 = parseResult(result2)

      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id, post2.id] })

      // Modify both locally
      const meta1 = readMeta(testPost.slug)
      meta1.title = 'Only This One Synced'
      writeMeta(testPost.slug, meta1)

      const meta2 = readMeta(post2.slug)
      meta2.title = 'This Should Not Sync'
      writeMeta(post2.slug, meta2)

      // Sync only the first
      await callTool(client, 'posts_sync_to_ghost', { ids: [testPost.id] })

      const read1 = parseResult(await callTool(client, 'posts_read', { id: testPost.id }))
      const read2 = parseResult(await callTool(client, 'posts_read', { id: post2.id }))

      expect(read1.title).toBe('Only This One Synced')
      expect(read2.title).toBe('Sync To Ghost Post 2')
    })

    it('skips a post when local updated_at equals Ghost and content is identical', async () => {
      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      // Sync without changes
      const result = await callTool(client, 'posts_sync_to_ghost', { ids: [testPost.id] })
      const report = resultText(result)

      expect(report).toContain('skip')
    })

    it('errors when local updated_at does not match Ghost updated_at', async () => {
      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      // Tamper updated_at to mismatch
      const meta = readMeta(testPost.slug)
      meta.updated_at = '2000-01-01T00:00:00.000Z'
      meta.title = 'Stale Update'
      writeMeta(testPost.slug, meta)

      const result = await callTool(client, 'posts_sync_to_ghost', { ids: [testPost.id] })
      const report = resultText(result)

      expect(report.toLowerCase()).toContain('error')
    })

    it('errors when meta.json contains invalid JSON', async () => {
      const dir = path.join(GHOST_DIR, testPost.slug)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'meta.json'), 'not json{{{')

      const result = await callTool(client, 'posts_sync_to_ghost', { ids: [testPost.id] })
      const report = resultText(result)

      expect(report.toLowerCase()).toContain('error')
    })

    it('errors when lexical.json contains invalid JSON', async () => {
      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      fs.writeFileSync(
        path.join(GHOST_DIR, testPost.slug, 'lexical.json'),
        'broken json!!!'
      )

      const result = await callTool(client, 'posts_sync_to_ghost', { ids: [testPost.id] })
      const report = resultText(result)

      expect(report.toLowerCase()).toContain('error')
    })

    it('skips with info message when meta.json is missing the id field', async () => {
      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      const meta = readMeta(testPost.slug)
      delete meta.id
      writeMeta(testPost.slug, meta)

      const result = await callTool(client, 'posts_sync_to_ghost', { ids: [testPost.id] })
      const report = resultText(result)

      // Should suggest using posts_add
      expect(report.toLowerCase()).toMatch(/posts_add|create/)
    })

    it('errors when meta.json is missing the updated_at field', async () => {
      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      const meta = readMeta(testPost.slug)
      delete meta.updated_at
      writeMeta(testPost.slug, meta)

      const result = await callTool(client, 'posts_sync_to_ghost', { ids: [testPost.id] })
      const report = resultText(result)

      expect(report.toLowerCase()).toContain('error')
    })

    it('skips with warning when post is not found in Ghost (404)', async () => {
      // Create a local post dir with a fake ID
      writeMeta('fake-deleted-post', {
        id: 'aaaaaaaaaaaaaaaaaaaaaa00',
        title: 'Deleted Post',
        updated_at: '2025-01-01T00:00:00.000Z',
      })

      const result = await callTool(client, 'posts_sync_to_ghost')
      const report = resultText(result)

      expect(report.toLowerCase()).toMatch(/not found|deleted|warning/)
    })

    it('does not create new posts in Ghost', async () => {
      // Local-only post with no id
      writeMeta('brand-new-post', {
        title: 'Brand New Post',
        updated_at: '2025-01-01T00:00:00.000Z',
      })

      const result = await callTool(client, 'posts_sync_to_ghost')
      const report = resultText(result)

      // Should not have created it — should suggest posts_add
      expect(report.toLowerCase()).toMatch(/posts_add|create|skip/)
    })

    it('returns a sync report with synced and skipped counts', async () => {
      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      const result = await callTool(client, 'posts_sync_to_ghost', { ids: [testPost.id] })
      const report = resultText(result)

      expect(report).toMatch(/sync/i)
      expect(report).toMatch(/skip/i)
    })
  })
})

describe('posts file:// support', () => {
  let client: Client
  let tmpDir: string

  beforeAll(async () => {
    client = await createTestClient()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-mcp-test-'))
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  // --- posts_add with file:// ---

  describe('posts_add', () => {
    it('reads html content from an absolute file:// path', async () => {
      const filePath = path.join(tmpDir, 'add-html.html')
      fs.writeFileSync(filePath, '<p>Content from file</p>')

      const result = await callTool(client, 'posts_add', {
        title: 'File HTML Add Test',
        html: `file://${filePath}`,
        status: 'draft',
      })
      const post = parseResult(result)
      expect(post.html).toContain('Content from file')
    })

    it('reads markdown content from an absolute file:// path', async () => {
      const filePath = path.join(tmpDir, 'add-markdown.md')
      fs.writeFileSync(filePath, '# Markdown from file\n\nContent from file')

      const result = await callTool(client, 'posts_add', {
        title: 'File Markdown Add Test',
        markdown: `file://${filePath}`,
        status: 'draft',
      })
      const post = parseResult(result)
      expect(post.html).toContain('Markdown from file')
    })

    it('reads lexical content from an absolute file:// path', async () => {
      const lexicalData = JSON.stringify({ root: { children: [{ children: [], direction: null, format: '', indent: 0, type: 'paragraph', version: 1 }], direction: null, format: '', indent: 0, type: 'root', version: 1 } })
      const filePath = path.join(tmpDir, 'add-lexical.json')
      fs.writeFileSync(filePath, lexicalData)

      const result = await callTool(client, 'posts_add', {
        title: 'File Lexical Add Test',
        lexical: `file://${filePath}`,
        status: 'draft',
      })
      const post = parseResult(result)
      expect(post.lexical).toBeDefined()
    })

    it('returns an error for a relative file:// path', async () => {
      const result = await callTool(client, 'posts_add', {
        title: 'Relative Path Test',
        html: 'file://relative/path.html',
        status: 'draft',
      })
      expect(result.isError).toBe(true)
    })

    it('returns an error when the file:// path does not exist', async () => {
      const result = await callTool(client, 'posts_add', {
        title: 'Missing File Test',
        html: 'file:///nonexistent/path/to/file.html',
        status: 'draft',
      })
      expect(result.isError).toBe(true)
    })
  })

  // --- posts_edit with file:// ---

  describe('posts_edit', () => {
    let editPost: any

    beforeAll(async () => {
      const result = await callTool(client, 'posts_add', {
        title: 'File Edit Test Post',
        html: '<p>Original content</p>',
        status: 'draft',
      })
      editPost = parseResult(result)
    })

    it('reads html content from an absolute file:// path', async () => {
      const filePath = path.join(tmpDir, 'edit-html.html')
      fs.writeFileSync(filePath, '<p>Edited from file</p>')

      const result = await callTool(client, 'posts_edit', {
        id: editPost.id,
        html: `file://${filePath}`,
        updated_at: editPost.updated_at,
      })
      const post = parseResult(result)
      expect(post.html).toContain('Edited from file')
      editPost = post
    })

    it('reads markdown content from an absolute file:// path', async () => {
      const filePath = path.join(tmpDir, 'edit-markdown.md')
      fs.writeFileSync(filePath, '# Edited markdown\n\nEdited from file')

      const result = await callTool(client, 'posts_edit', {
        id: editPost.id,
        markdown: `file://${filePath}`,
        updated_at: editPost.updated_at,
      })
      const post = parseResult(result)
      expect(post.html).toContain('Edited markdown')
      editPost = post
    })

    it('reads lexical content from an absolute file:// path', async () => {
      const lexicalData = JSON.stringify({ root: { children: [{ children: [], direction: null, format: '', indent: 0, type: 'paragraph', version: 1 }], direction: null, format: '', indent: 0, type: 'root', version: 1 } })
      const filePath = path.join(tmpDir, 'edit-lexical.json')
      fs.writeFileSync(filePath, lexicalData)

      const result = await callTool(client, 'posts_edit', {
        id: editPost.id,
        lexical: `file://${filePath}`,
        updated_at: editPost.updated_at,
      })
      const post = parseResult(result)
      expect(post.lexical).toBeDefined()
    })

    it('returns an error for a relative file:// path', async () => {
      const result = await callTool(client, 'posts_edit', {
        id: editPost.id,
        html: 'file://relative/path.html',
        updated_at: editPost.updated_at,
      })
      expect(result.isError).toBe(true)
    })

    it('returns an error when the file:// path does not exist', async () => {
      const result = await callTool(client, 'posts_edit', {
        id: editPost.id,
        html: 'file:///nonexistent/path/to/file.html',
        updated_at: editPost.updated_at,
      })
      expect(result.isError).toBe(true)
    })
  })
})

describe('posts markdown support', () => {
  let client: Client

  beforeAll(async () => {
    client = await createTestClient()
  })

  describe('posts_add', () => {
    it('converts markdown to HTML and uploads with source: "html"', async () => {
      const result = await callTool(client, 'posts_add', {
        title: 'Markdown Add Test',
        markdown: '# Hello Markdown\n\nThis is **bold** text.',
        status: 'draft',
      })
      const post = parseResult(result)
      expect(post.html).toContain('Hello Markdown')
      expect(post.html).toContain('<strong>bold</strong>')
    })
  })

  describe('posts_edit', () => {
    let editPost: any

    beforeAll(async () => {
      const result = await callTool(client, 'posts_add', {
        title: 'Markdown Edit Test Post',
        html: '<p>Original content</p>',
        status: 'draft',
      })
      editPost = parseResult(result)
    })

    it('converts markdown to HTML and updates with source: "html"', async () => {
      const result = await callTool(client, 'posts_edit', {
        id: editPost.id,
        markdown: '# Updated Markdown\n\nThis is *italic* text.',
        updated_at: editPost.updated_at,
      })
      const post = parseResult(result)
      expect(post.html).toContain('Updated Markdown')
      expect(post.html).toContain('<em>italic</em>')
    })
  })
})

describe('posts sync tools with format: "html"', () => {
  let client: Client
  let testPost: any

  beforeAll(async () => {
    client = await createTestClient()

    const result = await callTool(client, 'posts_add', {
      title: 'HTML Format Sync Test',
      html: '<p>Hello html format</p>',
      status: 'draft',
    })
    testPost = parseResult(result)
  })

  afterEach(() => {
    cleanGhostDir()
  })

  // --- posts_sync_from_ghost with format: "html" ---

  describe('posts_sync_from_ghost', () => {
    it('creates html.html instead of lexical.json when format is "html"', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'html' })

      const slugDir = path.join(GHOST_DIR, testPost.slug)
      expect(fs.existsSync(path.join(slugDir, 'meta.json'))).toBe(true)
      expect(fs.existsSync(path.join(slugDir, 'html.html'))).toBe(true)
      expect(fs.existsSync(path.join(slugDir, 'lexical.json'))).toBe(false)
    })

    it('meta.json excludes html field when format is "html"', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'html', ids: [testPost.id] })
      const meta = readMeta(testPost.slug)

      expect(meta.id).toBe(testPost.id)
      expect(meta).not.toHaveProperty('html')
    })

    it('html.html contains the post html content', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'html', ids: [testPost.id] })
      const html = readHtml(testPost.slug)

      expect(html).toContain('Hello html format')
    })

    it('syncs only specified post IDs with format "html"', async () => {
      const result2 = await callTool(client, 'posts_add', {
        title: 'HTML Format Post 2',
        html: '<p>Second post</p>',
        status: 'draft',
      })
      const post2 = parseResult(result2)

      await callTool(client, 'posts_sync_from_ghost', { format: 'html', ids: [testPost.id] })

      expect(fs.existsSync(path.join(GHOST_DIR, testPost.slug, 'html.html'))).toBe(true)
      expect(fs.existsSync(path.join(GHOST_DIR, post2.slug))).toBe(false)
    })

    it('defaults to lexical format when format is not specified', async () => {
      await callTool(client, 'posts_sync_from_ghost', { ids: [testPost.id] })

      const slugDir = path.join(GHOST_DIR, testPost.slug)
      expect(fs.existsSync(path.join(slugDir, 'lexical.json'))).toBe(true)
      expect(fs.existsSync(path.join(slugDir, 'html.html'))).toBe(false)
    })

    it('skips when local updated_at equals Ghost and html content is identical', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'html', ids: [testPost.id] })

      const result = await callTool(client, 'posts_sync_from_ghost', { format: 'html', ids: [testPost.id] })
      const report = resultText(result)

      expect(report).toContain('skip')
    })

    it('errors when local updated_at equals Ghost but html content differs', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'html', ids: [testPost.id] })

      // Modify html.html but keep same meta
      writeHtml(testPost.slug, '<p>Locally modified html</p>')

      const result = await callTool(client, 'posts_sync_from_ghost', { format: 'html', ids: [testPost.id] })
      const report = resultText(result)

      expect(report.toLowerCase()).toContain('conflict')
    })

    it('updates local files when local updated_at is older than Ghost', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'html', ids: [testPost.id] })

      const meta = readMeta(testPost.slug)
      meta.updated_at = '2000-01-01T00:00:00.000Z'
      writeMeta(testPost.slug, meta)

      await callTool(client, 'posts_sync_from_ghost', { format: 'html', ids: [testPost.id] })

      const updatedMeta = readMeta(testPost.slug)
      expect(updatedMeta.updated_at).not.toBe('2000-01-01T00:00:00.000Z')
      expect(fs.existsSync(path.join(GHOST_DIR, testPost.slug, 'html.html'))).toBe(true)
    })
  })

  // --- posts_sync_to_ghost with format: "html" ---

  describe('posts_sync_to_ghost', () => {
    it('reads html.html and syncs to Ghost with source: "html"', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'html', ids: [testPost.id] })

      const meta = readMeta(testPost.slug)
      meta.title = 'HTML Sync To Ghost Test'
      writeMeta(testPost.slug, meta)
      writeHtml(testPost.slug, '<p>Updated html content</p>')

      await callTool(client, 'posts_sync_to_ghost', { format: 'html', ids: [testPost.id] })

      // Verify title via posts_read
      const readResult = await callTool(client, 'posts_read', { id: testPost.id })
      const ghostPost = parseResult(readResult)
      expect(ghostPost.title).toBe('HTML Sync To Ghost Test')

      // Verify html content by syncing back from Ghost
      cleanGhostDir()
      await callTool(client, 'posts_sync_from_ghost', { format: 'html', ids: [testPost.id] })
      const html = readHtml(testPost.slug)
      expect(html).toContain('Updated html content')
    })

    it('ignores html field in meta.json when format is "html"', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'html', ids: [testPost.id] })

      const meta = readMeta(testPost.slug)
      meta.html = '<p>Bogus html in meta</p>'
      meta.title = 'HTML In Meta Ignored'
      writeMeta(testPost.slug, meta)

      const result = await callTool(client, 'posts_sync_to_ghost', { format: 'html', ids: [testPost.id] })
      const report = resultText(result)
      expect(report.toLowerCase()).not.toContain('error')
    })

    it('does not include html field when html.html does not exist', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'html', ids: [testPost.id] })

      // Remove html.html
      fs.unlinkSync(path.join(GHOST_DIR, testPost.slug, 'html.html'))

      const meta = readMeta(testPost.slug)
      meta.title = 'No HTML File'
      writeMeta(testPost.slug, meta)

      const result = await callTool(client, 'posts_sync_to_ghost', { format: 'html', ids: [testPost.id] })
      const report = resultText(result)
      expect(report.toLowerCase()).not.toContain('error')
    })

    it('skips when local updated_at equals Ghost and html content is identical', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'html', ids: [testPost.id] })

      const result = await callTool(client, 'posts_sync_to_ghost', { format: 'html', ids: [testPost.id] })
      const report = resultText(result)

      expect(report).toContain('skip')
    })

    it('errors when local updated_at does not match Ghost updated_at', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'html', ids: [testPost.id] })

      const meta = readMeta(testPost.slug)
      meta.updated_at = '2000-01-01T00:00:00.000Z'
      meta.title = 'Stale HTML Update'
      writeMeta(testPost.slug, meta)

      const result = await callTool(client, 'posts_sync_to_ghost', { format: 'html', ids: [testPost.id] })
      const report = resultText(result)

      expect(report.toLowerCase()).toContain('error')
    })

    it('returns a sync report with synced and skipped counts', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'html', ids: [testPost.id] })

      const meta = readMeta(testPost.slug)
      meta.title = 'HTML Report Test'
      writeMeta(testPost.slug, meta)

      const result = await callTool(client, 'posts_sync_to_ghost', { format: 'html', ids: [testPost.id] })
      const report = resultText(result)

      expect(report).toMatch(/sync/i)
      expect(report).toMatch(/skip/i)
    })
  })
})

describe('posts sync tools with format: "markdown"', () => {
  let client: Client
  let testPost: any

  beforeAll(async () => {
    client = await createTestClient()

    const result = await callTool(client, 'posts_add', {
      title: 'Markdown Format Sync Test',
      html: '<h1>Hello markdown format</h1><p>This is <strong>bold</strong> text.</p>',
      status: 'draft',
    })
    testPost = parseResult(result)
  })

  afterEach(() => {
    cleanGhostDir()
  })

  // --- posts_sync_from_ghost with format: "markdown" ---

  describe('posts_sync_from_ghost', () => {
    it('creates markdown.md instead of lexical.json when format is "markdown"', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'markdown' })

      const slugDir = path.join(GHOST_DIR, testPost.slug)
      expect(fs.existsSync(path.join(slugDir, 'meta.json'))).toBe(true)
      expect(fs.existsSync(path.join(slugDir, 'markdown.md'))).toBe(true)
      expect(fs.existsSync(path.join(slugDir, 'lexical.json'))).toBe(false)
    })

    it('meta.json excludes html field when format is "markdown"', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'markdown', ids: [testPost.id] })
      const meta = readMeta(testPost.slug)

      expect(meta.id).toBe(testPost.id)
      expect(meta).not.toHaveProperty('html')
    })

    it('markdown.md contains converted markdown content', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'markdown', ids: [testPost.id] })
      const markdown = readMarkdown(testPost.slug)

      expect(markdown).toContain('# Hello markdown format')
      expect(markdown).toContain('**bold**')
    })

    it('syncs only specified post IDs with format "markdown"', async () => {
      const result2 = await callTool(client, 'posts_add', {
        title: 'Markdown Format Post 2',
        html: '<p>Second post</p>',
        status: 'draft',
      })
      const post2 = parseResult(result2)

      await callTool(client, 'posts_sync_from_ghost', { format: 'markdown', ids: [testPost.id] })

      expect(fs.existsSync(path.join(GHOST_DIR, testPost.slug, 'markdown.md'))).toBe(true)
      expect(fs.existsSync(path.join(GHOST_DIR, post2.slug))).toBe(false)
    })

    it('skips when local updated_at equals Ghost and markdown content is identical', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'markdown', ids: [testPost.id] })

      const result = await callTool(client, 'posts_sync_from_ghost', { format: 'markdown', ids: [testPost.id] })
      const report = resultText(result)

      expect(report).toContain('skip')
    })

    it('errors when local updated_at equals Ghost but markdown content differs', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'markdown', ids: [testPost.id] })

      writeMarkdown(testPost.slug, '# Locally modified markdown')

      const result = await callTool(client, 'posts_sync_from_ghost', { format: 'markdown', ids: [testPost.id] })
      const report = resultText(result)

      expect(report.toLowerCase()).toContain('conflict')
    })

    it('updates local files when local updated_at is older than Ghost', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'markdown', ids: [testPost.id] })

      const meta = readMeta(testPost.slug)
      meta.updated_at = '2000-01-01T00:00:00.000Z'
      writeMeta(testPost.slug, meta)

      await callTool(client, 'posts_sync_from_ghost', { format: 'markdown', ids: [testPost.id] })

      const updatedMeta = readMeta(testPost.slug)
      expect(updatedMeta.updated_at).not.toBe('2000-01-01T00:00:00.000Z')
      expect(fs.existsSync(path.join(GHOST_DIR, testPost.slug, 'markdown.md'))).toBe(true)
    })
  })

  // --- posts_sync_to_ghost with format: "markdown" ---

  describe('posts_sync_to_ghost', () => {
    it('converts markdown to HTML and syncs to Ghost with source: "html"', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'markdown', ids: [testPost.id] })

      const meta = readMeta(testPost.slug)
      meta.title = 'Markdown Sync To Ghost Test'
      writeMeta(testPost.slug, meta)
      writeMarkdown(testPost.slug, '# Updated Markdown\n\nThis is **updated** content.')

      await callTool(client, 'posts_sync_to_ghost', { format: 'markdown', ids: [testPost.id] })

      const readResult = await callTool(client, 'posts_read', { id: testPost.id })
      const ghostPost = parseResult(readResult)
      expect(ghostPost.title).toBe('Markdown Sync To Ghost Test')
      expect(ghostPost.html).toContain('Updated Markdown')
      expect(ghostPost.html).toContain('<strong>updated</strong>')
    })

    it('ignores html field in meta.json when format is "markdown"', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'markdown', ids: [testPost.id] })

      const meta = readMeta(testPost.slug)
      meta.html = '<p>Bogus html in meta</p>'
      meta.title = 'HTML In Meta Ignored'
      writeMeta(testPost.slug, meta)

      const result = await callTool(client, 'posts_sync_to_ghost', { format: 'markdown', ids: [testPost.id] })
      const report = resultText(result)
      expect(report.toLowerCase()).not.toContain('error')
    })

    it('does not include html field when markdown.md does not exist', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'markdown', ids: [testPost.id] })

      fs.unlinkSync(path.join(GHOST_DIR, testPost.slug, 'markdown.md'))

      const meta = readMeta(testPost.slug)
      meta.title = 'No Markdown File'
      writeMeta(testPost.slug, meta)

      const result = await callTool(client, 'posts_sync_to_ghost', { format: 'markdown', ids: [testPost.id] })
      const report = resultText(result)
      expect(report.toLowerCase()).not.toContain('error')
    })

    it('errors when markdown.md does not exist', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'markdown', ids: [testPost.id] })

      fs.unlinkSync(path.join(GHOST_DIR, testPost.slug, 'markdown.md'))

      const result = await callTool(client, 'posts_sync_to_ghost', { format: 'markdown', ids: [testPost.id] })
      const report = resultText(result)

      expect(report.toLowerCase()).toContain('error')
    })

    it('skips when local updated_at equals Ghost and markdown content is identical', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'markdown', ids: [testPost.id] })

      const result = await callTool(client, 'posts_sync_to_ghost', { format: 'markdown', ids: [testPost.id] })
      const report = resultText(result)

      expect(report).toContain('skip')
    })

    it('errors when local updated_at does not match Ghost updated_at', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'markdown', ids: [testPost.id] })

      const meta = readMeta(testPost.slug)
      meta.updated_at = '2000-01-01T00:00:00.000Z'
      meta.title = 'Stale Markdown Update'
      writeMeta(testPost.slug, meta)

      const result = await callTool(client, 'posts_sync_to_ghost', { format: 'markdown', ids: [testPost.id] })
      const report = resultText(result)

      expect(report.toLowerCase()).toContain('error')
    })

    it('returns a sync report with synced and skipped counts', async () => {
      await callTool(client, 'posts_sync_from_ghost', { format: 'markdown', ids: [testPost.id] })

      const meta = readMeta(testPost.slug)
      meta.title = 'Markdown Report Test'
      writeMeta(testPost.slug, meta)

      const result = await callTool(client, 'posts_sync_to_ghost', { format: 'markdown', ids: [testPost.id] })
      const report = resultText(result)

      expect(report).toMatch(/sync/i)
      expect(report).toMatch(/skip/i)
    })
  })
})
