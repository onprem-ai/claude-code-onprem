import { execSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'
import { access } from 'fs/promises'
import { getProfileEnvVar, setProfileEnvVar, removeProfileEnvVar } from './profile.js'
import { getExistingExaKey, getExistingBraveKey, addExaMcp, addBraveMcp, getClaudeConfig } from './mcp.js'
import { readJsonFile, writeJsonFile } from './config.js'
import { DEFAULTS } from './constants.js'

function getClaudeConfigPath(): string {
  const home = process.env.HOME || homedir()
  return join(home, '.claude.json')
}

const MARKETPLACE_NAME = 'onprem-ai'
const MARKETPLACE_REPO = 'onprem-ai/claude-marketplace'

function getHome(): string {
  return process.env.HOME || homedir()
}

function getPluginsCacheDir(): string {
  return join(getHome(), '.claude', 'plugins', 'cache', MARKETPLACE_NAME)
}

function execClaude(args: string): { success: boolean; output: string } {
  try {
    const output = execSync(`claude ${args}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    return { success: true, output }
  } catch (error: any) {
    return { success: false, output: error.message || String(error) }
  }
}

export async function isMarketplaceAdded(): Promise<boolean> {
  const result = execClaude('plugin marketplace list')
  return result.success && result.output.includes(MARKETPLACE_NAME)
}

export async function addMarketplace(): Promise<{ success: boolean; error?: string }> {
  const result = execClaude(`plugin marketplace add ${MARKETPLACE_REPO}`)
  if (!result.success) {
    return { success: false, error: result.output }
  }
  return { success: true }
}

export async function pluginInstalled(pluginName: string): Promise<boolean> {
  try {
    await access(join(getPluginsCacheDir(), pluginName))
    return true
  } catch {
    return false
  }
}

export async function installPlugin(pluginName: string): Promise<{ success: boolean; error?: string }> {
  const result = execClaude(`plugin install ${pluginName}@${MARKETPLACE_NAME} --scope user`)
  if (!result.success) {
    return { success: false, error: result.output }
  }
  return { success: true }
}

export async function uninstallPlugin(pluginName: string): Promise<{ success: boolean; error?: string }> {
  const result = execClaude(`plugin uninstall ${pluginName}@${MARKETPLACE_NAME}`)
  if (!result.success) {
    return { success: false, error: result.output }
  }
  return { success: true }
}

// API key management - stores in CCS profile so env vars are available when running `ccs onprem`
export async function getInstalledPluginApiKey(pluginName: string, keyName: string): Promise<string | null> {
  // First, check CCS profile (the current location for websearch plugins)
  try {
    const value = await getProfileEnvVar(DEFAULTS.profileName, keyName)
    if (value) return value
  } catch {
    // Continue to check other locations
  }

  // Fallback: Check .claude.json for exa or brave-search MCP servers
  if (keyName === 'EXA_API_KEY') {
    return await getExistingExaKey()
  }
  if (keyName === 'BRAVE_API_KEY') {
    return await getExistingBraveKey()
  }

  return null
}

export async function setPluginApiKey(
  pluginName: string,
  envVarName: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // First, clean up old locations to avoid duplicate/conflicting keys

    // Clean up .claude.json for exa (stored in headers['x-api-key'])
    if (envVarName === 'EXA_API_KEY') {
      const claudeConfig = await getClaudeConfig()
      if (claudeConfig?.mcpServers?.exa) {
        const exaServer = claudeConfig.mcpServers.exa
        if ('headers' in exaServer && exaServer.headers?.['x-api-key']) {
          // Remove the exa server from .claude.json
          delete claudeConfig.mcpServers.exa
          await writeJsonFile(getClaudeConfigPath(), claudeConfig)
        }
      }
    }

    // Clean up .claude.json for brave (stored in env.BRAVE_API_KEY)
    if (envVarName === 'BRAVE_API_KEY') {
      const claudeConfig = await getClaudeConfig()
      if (claudeConfig?.mcpServers?.['brave-search']) {
        const braveServer = claudeConfig.mcpServers['brave-search']
        if ('env' in braveServer && braveServer.env?.BRAVE_API_KEY) {
          // Remove the brave-search server from .claude.json
          delete claudeConfig.mcpServers['brave-search']
          await writeJsonFile(getClaudeConfigPath(), claudeConfig)
        }
      }
    }

    // Write to CCS profile env section - available when running `ccs onprem`
    await setProfileEnvVar(DEFAULTS.profileName, envVarName, value)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function removePluginApiKey(
  envVarName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Remove from CCS profile
    await removeProfileEnvVar(DEFAULTS.profileName, envVarName)

    // Also clean up old location in .claude.json if it exists
    if (envVarName === 'EXA_API_KEY') {
      const claudeConfig = await getClaudeConfig()
      if (claudeConfig?.mcpServers?.exa) {
        const exaServer = claudeConfig.mcpServers.exa
        if ('headers' in exaServer && exaServer.headers?.['x-api-key']) {
          delete claudeConfig.mcpServers.exa
          await writeJsonFile(getClaudeConfigPath(), claudeConfig)
        }
      }
    }

    if (envVarName === 'BRAVE_API_KEY') {
      const claudeConfig = await getClaudeConfig()
      if (claudeConfig?.mcpServers?.['brave-search']) {
        const braveServer = claudeConfig.mcpServers['brave-search']
        if ('env' in braveServer && braveServer.env?.BRAVE_API_KEY) {
          delete claudeConfig.mcpServers['brave-search']
          await writeJsonFile(getClaudeConfigPath(), claudeConfig)
        }
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
