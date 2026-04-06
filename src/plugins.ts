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

export async function getInstalledPluginApiKey(pluginName: string, keyName: string): Promise<string | null> {
  try {
    // Check in plugin cache directory
    const cacheDir = getPluginsCacheDir()
    const pluginDir = join(cacheDir, pluginName)

    // Find the version directory (there should be one)
    const { readdirSync } = await import('fs')
    const versions = readdirSync(pluginDir)
    if (versions.length === 0) return null

    const mcpPath = join(pluginDir, versions[0], '.mcp.json')
    const content = await readFile(mcpPath, 'utf-8')
    const config = JSON.parse(content)

    // Check for key in headers (Exa style) or env (Brave style)
    for (const server of Object.values(config) as any[]) {
      if (server.headers?.[keyName]) {
        const value = server.headers[keyName]
        // Skip if it's still a placeholder
        if (value.startsWith('${')) return null
        return value
      }
      if (server.env?.[keyName]) {
        const value = server.env[keyName]
        if (value.startsWith('${')) return null
        return value
      }
    }
    return null
  } catch {
    return null
  }
}

export async function setPluginApiKey(
  pluginName: string,
  placeholder: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cacheDir = getPluginsCacheDir()
    const pluginDir = join(cacheDir, pluginName)

    const { readdirSync } = await import('fs')
    const versions = readdirSync(pluginDir)
    if (versions.length === 0) {
      return { success: false, error: 'Plugin not found' }
    }

    const mcpPath = join(pluginDir, versions[0], '.mcp.json')
    const content = await readFile(mcpPath, 'utf-8')

    // Replace placeholder with actual value
    const updated = content.replace(placeholder, value)

    if (updated === content) {
      return { success: false, error: `Placeholder ${placeholder} not found` }
    }

    await writeFile(mcpPath, updated, 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
