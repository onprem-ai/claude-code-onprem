import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readJsonFile, writeJsonFile, readYamlFile, writeYamlFile, mergeConfig } from '../src/config.js'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('config', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'config-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('readJsonFile', () => {
    it('returns parsed JSON when file exists', async () => {
      const filePath = join(tempDir, 'test.json')
      writeFileSync(filePath, '{"key": "value"}')
      const result = await readJsonFile(filePath)
      expect(result).toEqual({ key: 'value' })
    })

    it('returns null when file does not exist', async () => {
      const result = await readJsonFile(join(tempDir, 'missing.json'))
      expect(result).toBeNull()
    })

    it('throws on invalid JSON', async () => {
      const filePath = join(tempDir, 'invalid.json')
      writeFileSync(filePath, 'not json')
      await expect(readJsonFile(filePath)).rejects.toThrow()
    })
  })

  describe('writeJsonFile', () => {
    it('writes JSON to file', async () => {
      const filePath = join(tempDir, 'output.json')
      await writeJsonFile(filePath, { foo: 'bar' })
      const content = await readJsonFile(filePath)
      expect(content).toEqual({ foo: 'bar' })
    })

    it('creates parent directories if needed', async () => {
      const filePath = join(tempDir, 'nested', 'dir', 'output.json')
      await writeJsonFile(filePath, { nested: true })
      const content = await readJsonFile(filePath)
      expect(content).toEqual({ nested: true })
    })
  })

  describe('readYamlFile', () => {
    it('returns parsed YAML when file exists', async () => {
      const filePath = join(tempDir, 'test.yaml')
      writeFileSync(filePath, 'key: value\nnested:\n  foo: bar')
      const result = await readYamlFile(filePath)
      expect(result).toEqual({ key: 'value', nested: { foo: 'bar' } })
    })

    it('returns null when file does not exist', async () => {
      const result = await readYamlFile(join(tempDir, 'missing.yaml'))
      expect(result).toBeNull()
    })
  })

  describe('writeYamlFile', () => {
    it('writes YAML to file', async () => {
      const filePath = join(tempDir, 'output.yaml')
      await writeYamlFile(filePath, { foo: 'bar' })
      const content = await readYamlFile(filePath)
      expect(content).toEqual({ foo: 'bar' })
    })
  })

  describe('mergeConfig', () => {
    it('deep merges objects', () => {
      const existing = { a: 1, nested: { x: 1 } }
      const updates = { b: 2, nested: { y: 2 } }
      const result = mergeConfig(existing, updates)
      expect(result).toEqual({ a: 1, b: 2, nested: { x: 1, y: 2 } })
    })

    it('returns updates when existing is null', () => {
      const result = mergeConfig(null, { new: 'value' })
      expect(result).toEqual({ new: 'value' })
    })

    it('overwrites arrays instead of merging', () => {
      const existing = { arr: [1, 2] }
      const updates = { arr: [3, 4] }
      const result = mergeConfig(existing, updates)
      expect(result).toEqual({ arr: [3, 4] })
    })
  })
})
