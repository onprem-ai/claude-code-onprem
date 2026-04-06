import { homedir } from 'os'
import { join } from 'path'
import { readJsonFile, writeJsonFile, readYamlFile, writeYamlFile, mergeConfig } from './config.js'
import { DEFAULTS } from './constants.js'
import type { ClaudeConfig, CcsConfig, McpServer } from './types.js'

function getHome(): string {
  return process.env.HOME || homedir()
}

function getClaudeConfigPath(): string {
  return join(getHome(), '.claude.json')
}

function getCcsConfigPath(): string {
  return join(getHome(), '.ccs', 'config.yaml')
}

export async function getClaudeConfig(): Promise<ClaudeConfig | null> {
  return readJsonFile<ClaudeConfig>(getClaudeConfigPath())
}

export async function getCcsConfig(): Promise<CcsConfig | null> {
  return readYamlFile<CcsConfig>(getCcsConfigPath())
}

export async function getExistingExaKey(): Promise<string | null> {
  const config = await getClaudeConfig()
  const exaServer = config?.mcpServers?.exa
  if (exaServer && 'headers' in exaServer && exaServer.headers?.['x-api-key']) {
    return exaServer.headers['x-api-key']
  }
  return null
}

export async function getExistingBraveKey(): Promise<string | null> {
  const config = await getClaudeConfig()
  const braveServer = config?.mcpServers?.['brave-search']
  if (braveServer && 'env' in braveServer && braveServer.env?.BRAVE_API_KEY) {
    return braveServer.env.BRAVE_API_KEY
  }
  return null
}

export async function addExaMcp(apiKey: string): Promise<void> {
  const existing = await getClaudeConfig()

  const exaServer: McpServer = {
    type: 'http',
    url: DEFAULTS.exaMcpUrl,
    headers: {
      'x-api-key': apiKey,
    },
  }

  const updated = mergeConfig(existing, {
    mcpServers: {
      ...existing?.mcpServers,
      exa: exaServer,
    },
  })

  await writeJsonFile(getClaudeConfigPath(), updated)
}

export async function addBraveMcp(apiKey: string): Promise<void> {
  const existing = await getClaudeConfig()

  const braveServer: McpServer = {
    command: 'npx',
    args: ['-y', 'brave-search-mcp'],
    env: {
      BRAVE_API_KEY: apiKey,
    },
  }

  const updated = mergeConfig(existing, {
    mcpServers: {
      ...existing?.mcpServers,
      'brave-search': braveServer,
    },
  })

  await writeJsonFile(getClaudeConfigPath(), updated)
}

export async function disableCcsWebsearch(): Promise<void> {
  const existing = await getCcsConfig()

  const updated = mergeConfig(existing, {
    websearch: {
      ...existing?.websearch,
      enabled: false,
    },
  })

  await writeYamlFile(getCcsConfigPath(), updated)
}
