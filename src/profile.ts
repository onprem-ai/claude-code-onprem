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

export async function getProfileEnvVar(name: string, envVar: string): Promise<string | null> {
  const profile = await loadProfile(name)
  return profile?.env?.[envVar] || null
}

export async function setProfileEnvVar(name: string, envVar: string, value: string): Promise<void> {
  let profile = await loadProfile(name)
  if (!profile) {
    // Create minimal profile if it doesn't exist
    profile = { env: {} } as CcsProfile
  }
  profile.env = profile.env || {}
  profile.env[envVar] = value
  await writeJsonFile(getProfilePath(name), profile)
}

export async function removeProfileEnvVar(name: string, envVar: string): Promise<void> {
  const profile = await loadProfile(name)
  if (!profile?.env) return
  if (envVar in profile.env) {
    delete profile.env[envVar]
    await writeJsonFile(getProfilePath(name), profile)
  }
}
