import { execSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'
import { readFile, writeFile, access } from 'fs/promises'

const MARKETPLACE_NAME = 'claude-code-onprem'
const MARKETPLACE_REPO = 'onprem-ai/claude-code-onprem'

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

function getClaudeSettingsPath(): string {
  return join(getHome(), '.claude', 'settings.local.json')
}

interface ClaudeSettings {
  env?: Record<string, string>
  [key: string]: unknown
}

async function readClaudeSettings(): Promise<ClaudeSettings> {
  try {
    const content = await readFile(getClaudeSettingsPath(), 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

async function writeClaudeSettings(settings: ClaudeSettings): Promise<void> {
  const { mkdir } = await import('fs/promises')
  await mkdir(join(getHome(), '.claude'), { recursive: true })
  await writeFile(getClaudeSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}

export async function getInstalledPluginApiKey(pluginName: string, keyName: string): Promise<string | null> {
  try {
    // Read from ~/.claude/settings.local.json env section
    const settings = await readClaudeSettings()
    const value = settings.env?.[keyName]
    if (value && !value.startsWith('${')) {
      return value
    }
    return null
  } catch {
    return null
  }
}

export async function setPluginApiKey(
  pluginName: string,
  envVarName: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Write to ~/.claude/settings.local.json env section
    const settings = await readClaudeSettings()
    settings.env = settings.env || {}
    settings.env[envVarName] = value
    await writeClaudeSettings(settings)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function removePluginApiKey(
  envVarName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await readClaudeSettings()
    if (settings.env && envVarName in settings.env) {
      delete settings.env[envVarName]
      // Clean up empty env object
      if (Object.keys(settings.env).length === 0) {
        delete settings.env
      }
      await writeClaudeSettings(settings)
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
