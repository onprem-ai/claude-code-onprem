import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execSync } from 'child_process'
import { checkPrerequisites, parseVersion, checkVersion } from '../src/prerequisites.js'

vi.mock('child_process')

const mockExecSync = vi.mocked(execSync)

describe('prerequisites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('parseVersion', () => {
    it('extracts version from node output', () => {
      const output = 'v20.10.0'
      expect(parseVersion(output, 'node')).toBe('20.10.0')
    })

    it('extracts version from ccs output', () => {
      const output = 'CCS (Claude Code Switch) v7.65.3\n\nInstallation:\n...'
      expect(parseVersion(output, 'ccs')).toBe('7.65.3')
    })

    it('extracts version from claude output', () => {
      const output = '2.1.72 (Claude Code)'
      expect(parseVersion(output, 'claude')).toBe('2.1.72')
    })

    it('returns null for unrecognized format', () => {
      expect(parseVersion('unknown format', 'ccs')).toBeNull()
    })
  })

  describe('checkVersion', () => {
    it('returns true when version meets minimum', () => {
      expect(checkVersion('7.65.3', '7.65.3')).toBe(true)
      expect(checkVersion('7.66.0', '7.65.3')).toBe(true)
      expect(checkVersion('8.0.0', '7.65.3')).toBe(true)
    })

    it('returns false when version is below minimum', () => {
      expect(checkVersion('7.65.2', '7.65.3')).toBe(false)
      expect(checkVersion('7.64.0', '7.65.3')).toBe(false)
      expect(checkVersion('6.0.0', '7.65.3')).toBe(false)
    })

    it('returns false for invalid version', () => {
      expect(checkVersion(null, '7.65.3')).toBe(false)
      expect(checkVersion('invalid', '7.65.3')).toBe(false)
    })
  })

  describe('checkPrerequisites', () => {
    it('returns success when all tools meet minimum versions', async () => {
      mockExecSync
        .mockReturnValueOnce('v20.10.0')
        .mockReturnValueOnce('CCS (Claude Code Switch) v7.65.3')
        .mockReturnValueOnce('2.1.72 (Claude Code)')

      const result = await checkPrerequisites()

      expect(result.success).toBe(true)
      expect(result.node).toEqual({ installed: true, version: '20.10.0', meetsMinimum: true })
      expect(result.ccs).toEqual({ installed: true, version: '7.65.3', meetsMinimum: true })
      expect(result.claude).toEqual({ installed: true, version: '2.1.72', meetsMinimum: true })
    })

    it('returns failure when node version is too low', async () => {
      mockExecSync
        .mockReturnValueOnce('v16.0.0')
        .mockReturnValueOnce('CCS (Claude Code Switch) v7.65.3')
        .mockReturnValueOnce('2.1.72 (Claude Code)')

      const result = await checkPrerequisites()

      expect(result.success).toBe(false)
      expect(result.node.meetsMinimum).toBe(false)
    })

    it('returns failure when ccs is not installed', async () => {
      mockExecSync
        .mockReturnValueOnce('v20.10.0')
        .mockImplementationOnce(() => {
          throw new Error('command not found')
        })

      const result = await checkPrerequisites()

      expect(result.success).toBe(false)
      expect(result.ccs.installed).toBe(false)
    })

    it('returns failure when ccs version is too low', async () => {
      mockExecSync
        .mockReturnValueOnce('v20.10.0')
        .mockReturnValueOnce('CCS (Claude Code Switch) v7.50.0')
        .mockReturnValueOnce('2.1.72 (Claude Code)')

      const result = await checkPrerequisites()

      expect(result.success).toBe(false)
      expect(result.ccs.meetsMinimum).toBe(false)
    })

    it('returns failure when claude is not installed', async () => {
      mockExecSync
        .mockReturnValueOnce('v20.10.0')
        .mockReturnValueOnce('CCS (Claude Code Switch) v7.65.3')
        .mockImplementationOnce(() => {
          throw new Error('command not found')
        })

      const result = await checkPrerequisites()

      expect(result.success).toBe(false)
      expect(result.claude.installed).toBe(false)
    })
  })
})
