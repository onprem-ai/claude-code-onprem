import { homedir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

export const MIN_NODE_VERSION = '18.0.0'
export const MIN_CCS_VERSION = '7.65.3'
export const MIN_CLAUDE_VERSION = '2.1.72'

// Use getter functions for paths to support test overrides of process.env.HOME
function getHome(): string {
  return process.env.HOME || homedir()
}

// Package root directory (parent of dist/ where this file lives)
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

export const PATHS = {
  get ccsConfig() { return join(getHome(), '.ccs', 'config.yaml') },
  get ccsProfilesDir() { return join(getHome(), '.ccs') },
  get claudeConfig() { return join(getHome(), '.claude.json') },
  get lastProfileName() { return join(packageRoot, '.cache', 'last-profile-name') },
}

export const DEFAULTS = {
  exaMcpUrl: 'https://mcp.exa.ai/mcp?tools=get_code_context_exa,web_search_exa,web_fetch_exa',
  exaApiUrl: 'https://api.exa.ai',
  braveApiUrl: 'https://api.search.brave.com',
  profileName: 'onprem',
} as const
