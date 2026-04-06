import { describe, it, expect, vi, beforeEach } from 'vitest'

// These tests verify the modules integrate correctly
// Full CLI testing would require mocking @clack/prompts

describe('cli integration', () => {
  it('exports run function', async () => {
    const { run } = await import('../src/cli.js')
    expect(typeof run).toBe('function')
  })
})
