import { homedir } from 'os'
import { join } from 'path'
import { access } from 'fs/promises'
import { readJsonFile, writeJsonFile } from './config.js'
import type { CcsProfile } from './types.js'

function getHome(): string {
  return process.env.HOME || homedir()
}

export function getProfilePath(name: string): string {
  return join(getHome(), '.ccs', `${name}.settings.json`)
}

export async function profileExists(name: string): Promise<boolean> {
  try {
    await access(getProfilePath(name))
    return true
  } catch {
    return false
  }
}

export async function loadProfile(name: string): Promise<CcsProfile | null> {
  return readJsonFile<CcsProfile>(getProfilePath(name))
}

interface ProfileOptions {
  endpoint: string
  apiKey: string
  model: string
}

export async function createProfile(name: string, options: ProfileOptions): Promise<void> {
  const profile: CcsProfile = {
    env: {
      CLAUDE_CODE_USE_FOUNDRY: '0',
      CLAUDE_CODE_USE_BEDROCK: '0',
      CLAUDE_CODE_USE_VERTEX: '0',
      ANTHROPIC_BASE_URL: options.endpoint,
      ANTHROPIC_AUTH_TOKEN: options.apiKey,
      ANTHROPIC_MODEL: options.model,
    }
  }

  await writeJsonFile(getProfilePath(name), profile)
}
