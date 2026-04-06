import { execSync } from 'child_process'
import { gte, valid } from 'semver'
import { MIN_NODE_VERSION, MIN_CCS_VERSION, MIN_CLAUDE_VERSION } from './constants.js'

export interface ToolStatus {
  installed: boolean
  version: string | null
  meetsMinimum: boolean
}

export interface PrerequisitesResult {
  success: boolean
  node: ToolStatus
  ccs: ToolStatus
  claude: ToolStatus
}

export function parseVersion(output: string, tool: 'node' | 'ccs' | 'claude'): string | null {
  if (tool === 'node') {
    const match = output.match(/v(\d+\.\d+\.\d+)/)
    return match ? match[1] : null
  }

  if (tool === 'ccs') {
    const match = output.match(/v(\d+\.\d+\.\d+)/)
    return match ? match[1] : null
  }

  if (tool === 'claude') {
    const match = output.match(/^(\d+\.\d+\.\d+)/)
    return match ? match[1] : null
  }

  return null
}

export function checkVersion(version: string | null, minimum: string): boolean {
  if (!version || !valid(version)) {
    return false
  }
  return gte(version, minimum)
}

function getMinVersion(tool: 'node' | 'ccs' | 'claude'): string {
  switch (tool) {
    case 'node': return MIN_NODE_VERSION
    case 'ccs': return MIN_CCS_VERSION
    case 'claude': return MIN_CLAUDE_VERSION
  }
}

function getToolVersion(command: string, tool: 'node' | 'ccs' | 'claude'): ToolStatus {
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    const version = parseVersion(output, tool)
    const minimum = getMinVersion(tool)

    return {
      installed: true,
      version,
      meetsMinimum: checkVersion(version, minimum),
    }
  } catch {
    return {
      installed: false,
      version: null,
      meetsMinimum: false,
    }
  }
}

export async function checkPrerequisites(): Promise<PrerequisitesResult> {
  const node = getToolVersion('node --version', 'node')
  const ccs = getToolVersion('ccs --version', 'ccs')
  const claude = getToolVersion('claude --version', 'claude')

  return {
    success: node.meetsMinimum && ccs.installed && ccs.meetsMinimum && claude.installed && claude.meetsMinimum,
    node,
    ccs,
    claude,
  }
}
