import * as fs from 'fs'
import * as path from 'path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

// Load .ghost-api-key into process.env before anything imports config.ts
const keyFile = path.resolve(__dirname, '..', '.ghost-api-key')
if (fs.existsSync(keyFile)) {
  for (const line of fs.readFileSync(keyFile, 'utf-8').split('\n')) {
    const idx = line.indexOf('=')
    if (idx > 0) {
      process.env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
  }
}

export async function createTestClient(): Promise<Client> {
  // Import server setup after env vars are loaded
  const { registerPostTools } = await import('../src/tools/posts')
  const { registerMemberTools } = await import('../src/tools/members')
  const { registerTagTools } = await import('../src/tools/tags')
  const { registerUserTools } = await import('../src/tools/users')
  const { registerTierTools } = await import('../src/tools/tiers')
  const { registerOfferTools } = await import('../src/tools/offers')
  const { registerNewsletterTools } = await import('../src/tools/newsletters')
  const { registerInviteTools } = await import('../src/tools/invites')
  const { registerRoleTools } = await import('../src/tools/roles')
  const { registerWebhookTools } = await import('../src/tools/webhooks')

  const server = new McpServer({ name: 'ghost-mcp-test', version: '1.0.0' })

  registerPostTools(server)
  registerMemberTools(server)
  registerTagTools(server)
  registerUserTools(server)
  registerTierTools(server)
  registerOfferTools(server)
  registerNewsletterTools(server)
  registerInviteTools(server)
  registerRoleTools(server)
  registerWebhookTools(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  const client = new Client({ name: 'test-client', version: '1.0.0' })

  await server.connect(serverTransport)
  await client.connect(clientTransport)

  return client
}
