import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  addExaMcp,
  addBraveMcp,
  disableCcsWebsearch,
  getClaudeConfig,
  getCcsConfig
} from '../src/mcp.js'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('mcp', () => {
  let tempDir: string
  let originalHome: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mcp-test-'))
    originalHome = process.env.HOME || ''
    process.env.HOME = tempDir
    mkdirSync(join(tempDir, '.ccs'), { recursive: true })
  })

  afterEach(() => {
    process.env.HOME = originalHome
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('addExaMcp', () => {
    it('adds Exa MCP to empty config', async () => {
      await addExaMcp('test-api-key')

      const config = await getClaudeConfig()
      expect(config?.mcpServers?.exa).toBeDefined()
      expect(config?.mcpServers?.exa?.type).toBe('http')
      expect(config?.mcpServers?.exa?.url).toBe('https://mcp.exa.ai/mcp?tools=get_code_context_exa,web_search_exa,web_fetch_exa')
      expect(config?.mcpServers?.exa?.headers?.['x-api-key']).toBe('test-api-key')
    })

    it('preserves existing MCP servers', async () => {
      const existingConfig = {
        mcpServers: {
          existing: { command: 'existing-mcp' }
        }
      }
      writeFileSync(join(tempDir, '.claude.json'), JSON.stringify(existingConfig))

      await addExaMcp('test-key')

      const config = await getClaudeConfig()
      expect(config?.mcpServers?.existing).toBeDefined()
      expect(config?.mcpServers?.exa).toBeDefined()
    })
  })

  describe('addBraveMcp', () => {
    it('adds Brave MCP to empty config', async () => {
      await addBraveMcp('test-api-key')

      const config = await getClaudeConfig()
      expect(config?.mcpServers?.['brave-search']).toBeDefined()
      expect(config?.mcpServers?.['brave-search']?.command).toBe('npx')
      expect(config?.mcpServers?.['brave-search']?.args).toContain('brave-search-mcp')
      expect(config?.mcpServers?.['brave-search']?.env?.BRAVE_API_KEY).toBe('test-api-key')
    })

    it('preserves existing MCP servers', async () => {
      const existingConfig = {
        mcpServers: {
          existing: { command: 'existing-mcp' }
        }
      }
      writeFileSync(join(tempDir, '.claude.json'), JSON.stringify(existingConfig))

      await addBraveMcp('test-key')

      const config = await getClaudeConfig()
      expect(config?.mcpServers?.existing).toBeDefined()
      expect(config?.mcpServers?.['brave-search']).toBeDefined()
    })
  })

  describe('disableCcsWebsearch', () => {
    it('creates config with websearch disabled when no config exists', async () => {
      await disableCcsWebsearch()

      const config = await getCcsConfig()
      expect(config?.websearch?.enabled).toBe(false)
    })

    it('preserves other settings when disabling websearch', async () => {
      const existingConfig = `
version: 12
profiles:
  onprem:
    type: api
websearch:
  enabled: true
  providers:
    duckduckgo:
      enabled: true
`
      writeFileSync(join(tempDir, '.ccs', 'config.yaml'), existingConfig)

      await disableCcsWebsearch()

      const config = await getCcsConfig()
      expect(config?.websearch?.enabled).toBe(false)
      expect(config?.version).toBe(12)
      expect(config?.profiles).toBeDefined()
    })
  })
})
