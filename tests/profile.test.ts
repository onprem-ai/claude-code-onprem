import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createProfile, loadProfile, profileExists, getProfilePath } from '../src/profile.js'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { CcsProfile } from '../src/types.js'

describe('profile', () => {
  let tempDir: string
  let originalHome: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'profile-test-'))
    originalHome = process.env.HOME || ''
    process.env.HOME = tempDir
    mkdirSync(join(tempDir, '.ccs'), { recursive: true })
  })

  afterEach(() => {
    process.env.HOME = originalHome
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('getProfilePath', () => {
    it('returns correct path for profile name', () => {
      const path = getProfilePath('onprem')
      expect(path).toBe(join(tempDir, '.ccs', 'onprem.settings.json'))
    })
  })

  describe('profileExists', () => {
    it('returns false when profile does not exist', async () => {
      const result = await profileExists('onprem')
      expect(result).toBe(false)
    })

    it('returns true when profile exists', async () => {
      const profilePath = join(tempDir, '.ccs', 'onprem.settings.json')
      writeFileSync(profilePath, '{}')

      const result = await profileExists('onprem')
      expect(result).toBe(true)
    })
  })

  describe('loadProfile', () => {
    it('returns null when profile does not exist', async () => {
      const result = await loadProfile('onprem')
      expect(result).toBeNull()
    })

    it('returns profile when it exists', async () => {
      const profile: CcsProfile = {
        env: {
          CLAUDE_CODE_USE_FOUNDRY: '0',
          CLAUDE_CODE_USE_BEDROCK: '0',
          CLAUDE_CODE_USE_VERTEX: '0',
          ANTHROPIC_BASE_URL: 'https://example.com',
          ANTHROPIC_AUTH_TOKEN: 'test-key',
          ANTHROPIC_MODEL: 'test-model',
        }
      }
      const profilePath = join(tempDir, '.ccs', 'onprem.settings.json')
      writeFileSync(profilePath, JSON.stringify(profile))

      const result = await loadProfile('onprem')
      expect(result).toEqual(profile)
    })
  })

  describe('createProfile', () => {
    it('creates a new profile', async () => {
      await createProfile('onprem', {
        endpoint: 'https://llm.example.com',
        apiKey: 'my-key',
        model: 'my-model',
      })

      const result = await loadProfile('onprem')
      expect(result?.env.ANTHROPIC_BASE_URL).toBe('https://llm.example.com')
      expect(result?.env.ANTHROPIC_AUTH_TOKEN).toBe('my-key')
      expect(result?.env.ANTHROPIC_MODEL).toBe('my-model')
      expect(result?.env.CLAUDE_CODE_USE_FOUNDRY).toBe('0')
    })

    it('allows empty API key', async () => {
      await createProfile('onprem', {
        endpoint: 'https://llm.example.com',
        apiKey: '',
        model: 'my-model',
      })

      const result = await loadProfile('onprem')
      expect(result?.env.ANTHROPIC_AUTH_TOKEN).toBe('')
    })
  })
})
