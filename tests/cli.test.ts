import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseArgs } from '../src/cli.js'

// These tests verify the modules integrate correctly
// Full CLI testing would require mocking @clack/prompts

describe('cli integration', () => {
  it('exports run function', async () => {
    const { run } = await import('../src/cli.js')
    expect(typeof run).toBe('function')
  })
})

describe('parseArgs', () => {
  it('parses -y flag', () => {
    expect(parseArgs(['-y'])).toEqual({ yes: true })
  })

  it('parses --yes flag', () => {
    expect(parseArgs(['--yes'])).toEqual({ yes: true })
  })

  it('parses --llm-url with = syntax', () => {
    expect(parseArgs(['--llm-url=http://localhost:8000'])).toEqual({
      llmUrl: 'http://localhost:8000',
    })
  })

  it('parses --llm-url with space syntax', () => {
    expect(parseArgs(['--llm-url', 'http://localhost:8000'])).toEqual({
      llmUrl: 'http://localhost:8000',
    })
  })

  it('parses --llm-key with = syntax', () => {
    expect(parseArgs(['--llm-key=secret123'])).toEqual({
      llmKey: 'secret123',
    })
  })

  it('parses --llm-key with space syntax', () => {
    expect(parseArgs(['--llm-key', 'secret123'])).toEqual({
      llmKey: 'secret123',
    })
  })

  it('parses --model with = syntax', () => {
    expect(parseArgs(['--model=gpt-4'])).toEqual({
      model: 'gpt-4',
    })
  })

  it('parses --model with space syntax', () => {
    expect(parseArgs(['--model', 'gpt-4'])).toEqual({
      model: 'gpt-4',
    })
  })

  it('parses --exa-key with = syntax', () => {
    expect(parseArgs(['--exa-key=exa-secret'])).toEqual({
      exaKey: 'exa-secret',
    })
  })

  it('parses --exa-key with space syntax', () => {
    expect(parseArgs(['--exa-key', 'exa-secret'])).toEqual({
      exaKey: 'exa-secret',
    })
  })

  it('parses --brave-key with = syntax', () => {
    expect(parseArgs(['--brave-key=brave-secret'])).toEqual({
      braveKey: 'brave-secret',
    })
  })

  it('parses --brave-key with space syntax', () => {
    expect(parseArgs(['--brave-key', 'brave-secret'])).toEqual({
      braveKey: 'brave-secret',
    })
  })

  it('parses multiple flags together', () => {
    expect(parseArgs([
      '--llm-url=http://localhost:8000',
      '--llm-key=llm-secret',
      '--model=qwen-coder',
      '--exa-key=exa-secret',
      '--brave-key=brave-secret',
      '-y',
    ])).toEqual({
      llmUrl: 'http://localhost:8000',
      llmKey: 'llm-secret',
      model: 'qwen-coder',
      exaKey: 'exa-secret',
      braveKey: 'brave-secret',
      yes: true,
    })
  })

  it('returns empty object for no args', () => {
    expect(parseArgs([])).toEqual({})
  })

  it('ignores unknown flags', () => {
    expect(parseArgs(['--unknown', 'value', '-x'])).toEqual({})
  })
})
