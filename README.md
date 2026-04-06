# claude-code-onprem

Interactive setup wizard for on-prem Claude Code with CCS profile management and web search providers.

> **Disclaimer:** This is an unofficial community project. We are not affiliated with, endorsed by, or connected to Anthropic or Claude Code in any way. We're just enthusiastic community members who love building with Claude Code!

## Quick Start

```bash
npx claude-code-onprem
```

## What It Configures

1. **CCS Profile** - Creates `~/.ccs/onprem.settings.json` with your LLM endpoint
2. **Web Search MCPs** - Optionally configures Exa and/or Brave search
3. **CCS Config** - Disables built-in websearch when MCP is configured

## Prerequisites

- [Claude Code](https://github.com/anthropics/claude-code) >= 2.1.72
- [CCS](https://github.com/kaitranntt/ccs) >= 7.65.3

## Why Web Search?

Strong web search is critical for on-prem AI coding. On-premise LLMs are typically smaller than cloud-hosted trillion-parameter models and have less knowledge stored in their weights. Solid web search with proper skill instructions acts as a form of RAG, compensating for smaller model sizes by providing access to up-to-date documentation and code examples.

**Why custom search plugins?** The built-in CCS web search is standardized and limited. We chose two providers — Exa for code-focused search and Brave for privacy-conscious general search — and expose their full MCP capabilities with optimized usage instructions. This made a significant difference for us, though these search plugins are entirely optional.

**What about privacy?** With on-prem LLMs, your source code never leaves your infrastructure — that's the whole point. Web search only exposes search queries, which typically relate to external libraries and public APIs rather than your proprietary code patterns. Yes, search providers can see which technologies you're working with, which may be compliance-relevant in certain contexts. But the critical risks — source code exposure and potential credential leaks — are practically eliminated when LLM processing stays on-premises.

## Web Search Providers

| Provider | Strengths |
|----------|-----------|
| **Exa** | Code search, API docs |
| **Brave** | Privacy, news/media |

## After Setup

```bash
ccs onprem
```

## License

MIT
