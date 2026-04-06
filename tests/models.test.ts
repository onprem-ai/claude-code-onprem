import { describe, it, expect } from 'vitest'
import { fetchModels, testExaConnection, testBraveConnection } from '../src/models.js'
import { server, http, HttpResponse } from './setup.js'

describe('models', () => {
  describe('fetchModels', () => {
    it('fetches models from endpoint', async () => {
      server.use(
        http.get('https://llm.example.com/v1/models', () => {
          return HttpResponse.json({
            data: [
              { id: 'model-a', object: 'model' },
              { id: 'model-b', object: 'model' },
            ]
          })
        })
      )

      const result = await fetchModels('https://llm.example.com', 'test-key')

      expect(result.success).toBe(true)
      expect(result.models).toHaveLength(2)
      expect(result.models![0].id).toBe('model-a')
    })

    it('tries OpenAI auth header when Anthropic fails', async () => {
      let attempts = 0
      server.use(
        http.get('https://llm.example.com/v1/models', ({ request }) => {
          attempts++
          const auth = request.headers.get('authorization')
          if (auth === 'Bearer test-key') {
            return HttpResponse.json({
              data: [{ id: 'model-openai', object: 'model' }]
            })
          }
          return new HttpResponse(null, { status: 401 })
        })
      )

      const result = await fetchModels('https://llm.example.com', 'test-key')

      expect(result.success).toBe(true)
      expect(attempts).toBe(2)
      expect(result.models![0].id).toBe('model-openai')
    })

    it('returns failure when both auth methods fail', async () => {
      server.use(
        http.get('https://llm.example.com/v1/models', () => {
          return new HttpResponse(null, { status: 401 })
        })
      )

      const result = await fetchModels('https://llm.example.com', 'test-key')

      expect(result.success).toBe(false)
      expect(result.error).toContain('401')
    })

    it('returns failure on network error', async () => {
      server.use(
        http.get('https://llm.example.com/v1/models', () => {
          return HttpResponse.error()
        })
      )

      const result = await fetchModels('https://llm.example.com', 'test-key')

      expect(result.success).toBe(false)
    })
  })

  describe('testExaConnection', () => {
    it('returns success for valid API key', async () => {
      server.use(
        http.post('https://api.exa.ai/search', () => {
          return HttpResponse.json({ results: [] })
        })
      )

      const result = await testExaConnection('valid-key')
      expect(result.success).toBe(true)
    })

    it('returns failure for invalid API key', async () => {
      server.use(
        http.post('https://api.exa.ai/search', () => {
          return new HttpResponse(null, { status: 401 })
        })
      )

      const result = await testExaConnection('invalid-key')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid API key')
    })
  })

  describe('testBraveConnection', () => {
    it('returns success for valid API key', async () => {
      server.use(
        http.get('https://api.search.brave.com/res/v1/web/search', () => {
          return HttpResponse.json({ web: { results: [] } })
        })
      )

      const result = await testBraveConnection('valid-key')
      expect(result.success).toBe(true)
    })

    it('returns failure for invalid API key', async () => {
      server.use(
        http.get('https://api.search.brave.com/res/v1/web/search', () => {
          return new HttpResponse(null, { status: 401 })
        })
      )

      const result = await testBraveConnection('invalid-key')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid API key')
    })
  })
})
