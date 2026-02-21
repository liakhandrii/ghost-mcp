import { describe, it, expect, beforeAll } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { createTestClient } from '../setup'

describe('posts_add', () => {
  let client: Client

  beforeAll(async () => {
    client = await createTestClient()
  })

  it('creates a post with only a title', async () => {
    const result = await client.callTool({
      name: 'posts_add',
      arguments: { title: 'Test Post From Vitest' },
    })

    const content = result.content as Array<{ type: string; text: string }>
    const post = JSON.parse(content[0].text)

    expect(post.title).toBe('Test Post From Vitest')
    expect(post.id).toBeDefined()
    expect(post.slug).toBeDefined()
  })
})
