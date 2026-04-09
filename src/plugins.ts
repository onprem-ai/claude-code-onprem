import { execSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'
import { access } from 'fs/promises'
import { getProfileEnvVar, setProfileEnvVar, removeProfileEnvVar } from './profile.js'
import { DEFAULTS } from './constants.js'

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
  try {
    const value = await getProfileEnvVar(DEFAULTS.profileName, keyName)
    return value
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
    await removeProfileEnvVar(DEFAULTS.profileName, envVarName)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
