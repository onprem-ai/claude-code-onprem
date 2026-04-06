import { DEFAULTS } from './constants.js'
import type { ModelInfo, ModelsResponse } from './types.js'

interface FetchResult<T> {
  success: boolean
  data?: T
  error?: string
}

interface ModelsResult {
  success: boolean
  models?: ModelInfo[]
  error?: string
}

interface ConnectionResult {
  success: boolean
  error?: string
}

async function tryFetch(
  url: string,
  apiKey: string,
  authStyle: 'anthropic' | 'openai'
): Promise<FetchResult<ModelsResponse>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (authStyle === 'anthropic') {
    headers['x-api-key'] = apiKey
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  try {
    const response = await fetch(`${url}/v1/models`, { headers })

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    const data = await response.json() as ModelsResponse
    return { success: true, data }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function fetchModels(endpoint: string, apiKey: string): Promise<ModelsResult> {
  // Try Anthropic-style auth first
  const anthropicResult = await tryFetch(endpoint, apiKey, 'anthropic')
  if (anthropicResult.success && anthropicResult.data) {
    return { success: true, models: anthropicResult.data.data }
  }

  // Fall back to OpenAI-style auth
  const openaiResult = await tryFetch(endpoint, apiKey, 'openai')
  if (openaiResult.success && openaiResult.data) {
    return { success: true, models: openaiResult.data.data }
  }

  return { success: false, error: openaiResult.error || anthropicResult.error }
}

export async function testExaConnection(apiKey: string): Promise<ConnectionResult> {
  try {
    const response = await fetch(`${DEFAULTS.exaApiUrl}/search`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'test', numResults: 1 }),
    })

    if (response.status === 401) {
      return { success: false, error: 'Invalid API key' }
    }

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function testBraveConnection(apiKey: string): Promise<ConnectionResult> {
  try {
    const response = await fetch(
      `${DEFAULTS.braveApiUrl}/res/v1/web/search?q=test&count=1`,
      {
        headers: {
          'X-Subscription-Token': apiKey,
        },
      }
    )

    if (response.status === 401) {
      return { success: false, error: 'Invalid API key' }
    }

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
