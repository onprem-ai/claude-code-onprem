export interface CcsProfile {
  env: {
    CLAUDE_CODE_USE_FOUNDRY: string
    CLAUDE_CODE_USE_BEDROCK: string
    CLAUDE_CODE_USE_VERTEX: string
    ANTHROPIC_BASE_URL: string
    ANTHROPIC_AUTH_TOKEN: string
    ANTHROPIC_MODEL: string
  }
}

export interface CcsConfig {
  websearch?: {
    enabled?: boolean
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface ClaudeConfig {
  mcpServers?: Record<string, McpServer>
  [key: string]: unknown
}

export interface McpServer {
  type?: string
  url?: string
  command?: string
  args?: string[]
  headers?: Record<string, string>
  env?: Record<string, string>
}

export interface ModelInfo {
  id: string
  object?: string
}

export interface ModelsResponse {
  data: ModelInfo[]
}

export interface SetupOptions {
  endpoint: string
  apiKey: string
  model: string
  exa?: { apiKey: string }
  brave?: { apiKey: string }
}
