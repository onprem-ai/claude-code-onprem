import { execSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'
import { access, readFile } from 'fs/promises'
import { getProfileEnvVar, setProfileEnvVar, removeProfileEnvVar } from './profile.js'
import { getExistingExaKey, getExistingBraveKey, addExaMcp, addBraveMcp, getClaudeConfig } from './mcp.js'
import { readJsonFile, writeJsonFile } from './config.js'
import { DEFAULTS } from './constants.js'

function getClaudeConfigPath(): string {
  const home = process.env.HOME || homedir()
  return join(home, '.claude.json')
}

// Path to the installed plugins JSON file - the single source of truth for plugin installation
const INSTALLED_PLUGINS_PATH = join(process.env.HOME || homedir(), '.claude', 'plugins', 'installed_plugins.json')

const MARKETPLACE_NAME = 'onprem-ai'
const MARKETPLACE_REPO = 'onprem-ai/claude-marketplace'

function getHome(): string {
  return process.env.HOME || homedir()
}

// NOTE: Do NOT use directory-based detection for plugin installation status
// The installed_plugins.json file is the authoritative source of truth
// This cache directory is only for storing downloaded plugin files
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

export async function installPlugin(pluginName: string): Promise<{ success: boolean; error?: string }> {
  const result = execClaude(`plugin install ${pluginName}@${MARKETPLACE_NAME} --scope user`)
  if (!result.success) {
    return { success: false, error: result.output }
  }
  return { success: true }
}

// Legacy marketplace names that were previously used
// These need to be tried in order for uninstall compatibility
const MARKETPLACE_NAMES = ['onprem-ai', 'claude-code-onprem']

// Returns array of full plugin IDs (plugin@marketplace) that are installed
// pluginName is the base name without marketplace suffix (e.g., 'websearch-exa')
export async function getInstalledPlugins(pluginName: string): Promise<string[]> {
  try {
    const data = await readJsonFile<Record<string, any>>(INSTALLED_PLUGINS_PATH)
    const result: string[] = []

    // Check for plugin with each marketplace suffix
    for (const marketplace of MARKETPLACE_NAMES) {
      const pluginKey = `${pluginName}@${marketplace}`
      if (data?.plugins?.[pluginKey] !== undefined) {
        result.push(pluginKey)
      }
    }
    return result
  } catch {
    return []
  }
}

export async function pluginInstalled(pluginName: string): Promise<boolean> {
  const installed = await getInstalledPlugins(pluginName)
  return installed.length > 0
}

export async function uninstallPlugin(pluginName: string): Promise<{ success: boolean; error?: string }> {
  // First get all installed plugin IDs to know which marketplace formats are installed
  const installedPlugins = await getInstalledPlugins(pluginName)

  if (installedPlugins.length === 0) {
    // Plugin not installed, return error
    return {
      success: false,
      error: `Plugin "${pluginName}" not found in installed plugins`
    }
  }

  // Uninstall using the correct format(s) that were found
  for (const pluginId of installedPlugins) {
    // pluginId is in format "plugin@marketplace"
    const result = execClaude(`plugin uninstall ${pluginId}`)
    if (result.success) {
      return { success: true }
    }
  }

  // If none worked, return the last error
  return { success: false, error: execClaude(`plugin uninstall ${installedPlugins[0]}`).output }
}

// API key management - stores in CCS profile so env vars are available when running the profile
export async function getInstalledPluginApiKey(pluginName: string, keyName: string, profileName: string = DEFAULTS.profileName): Promise<string | null> {
  // First, check CCS profile (the current location for websearch plugins)
  try {
    const value = await getProfileEnvVar(profileName, keyName)
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
  value: string,
  profileName: string = DEFAULTS.profileName
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

    // Write to CCS profile env section - available when running the profile
    await setProfileEnvVar(profileName, envVarName, value)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function removePluginApiKey(
  envVarName: string,
  profileName: string = DEFAULTS.profileName
): Promise<{ success: boolean; error?: string }> {
  try {
    // Remove from CCS profile
    await removeProfileEnvVar(profileName, envVarName)

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
