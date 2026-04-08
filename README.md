# claude-code-onprem

Super easy setup wizard for using Claude Code with on-premise LLMs. 

CCS (Claude Code Switch) is being used so that your original configs remain intact and available while a separate config profile for on-premise LLMs will be added: You can later run `claude` as you know it or `ccs onprem` for running claude with on-premise LLMs. 

> **Disclaimer:** This is an unofficial community project. We are not affiliated with Anthropic or Claude Code in any way. We're just enthusiastic community members who love building with Claude Code and focus on privacy and sovereign AI solutions. Read more on (our website)[https://onprem.ai].

## Quick Start

1. Install prerequisites (if not already installed):
- [Claude Code](https://github.com/anthropics/claude-code) >= 2.1.72
- Node.js >= 18 (install via [fnm](https://github.com/Schniz/fnm) - fast, cross-platform)
- [CCS](https://github.com/kaitranntt/ccs) >= 7.65.3

2. Run setup wizard:
```bash
npx claude-code-onprem@latest
```

## What It Configures

1. **CCS Profile** - Creates `~/.ccs/onprem.settings.json` with your LLM endpoint
2. **Web Search MCPs** - Optionally configures advanced Exa and/or Brave search MCPs
3. **CCS Config** - Also optionally disables built-in CCS websearch when advanced search MCPs are installed

## Why Custom Web Search?

Strong web search is critical for on-prem AI coding. On-premise LLMs are typically smaller than cloud-hosted trillion-parameter models and have less factual knowlege memorized in their weights. Solid web search with proper skill instructions acts as a form of RAG, compensating for smaller model sizes by providing access to up-to-date documentation and code examples.

**Why custom search plugins?** The built-in CCS web search is standardized and limited. We chose two providers: Exa for code-focused search and Brave for privacy-conscious general search. Both search plugins expose their full MCP capabilities with usage instructions (skills) optimized for agentic coding. This made a significant difference for us, though these search plugins are entirely optional.

**What about privacy?** With on-prem LLMs, your source code never leaves your infrastructure - that's the whole point. Web search only exposes search queries, which typically relate to external libraries and public APIs rather than your proprietary code patterns. Yes, search providers can see which technologies you're working with, which may be compliance-relevant in certain contexts. But the critical risks like source code exposure and potential credential leaks are practically eliminated when LLM processing stays on-premises.

## Web Search Providers

| Provider | Strengths |
|----------|-----------|
| **Exa** | Code search, API docs |
| **Brave** | Privacy, news/media |


## CLI Options

The setup wizard supports command-line arguments for automation and prefilling values:

| Flag | Description |
|------|-------------|
| `--llm-url=<url>` | LLM endpoint URL |
| `--llm-key=<key>` | LLM API key |
| `--model=<name>` | Model name (skips model selection) |
| `--exa-key=<key>` | Exa API key |
| `--brave-key=<key>` | Brave API key |
| `-y`, `--yes` | Non-interactive mode (auto-approve all prompts) |

### Examples

```bash
# Interactive with prefilled values
npx claude-code-onprem@latest --llm-url=http://localhost:8000/v1

# Fully non-interactive setup
npx claude-code-onprem@latest \
  --llm-url=http://localhost:8000/v1 \
  --llm-key=your-llm-api-key \
  --model=qwen3-coder-next-80b \
  --exa-key=your-exa-api-key \
  -y
```

In non-interactive mode (`-y`):
- Uses provided values without prompting
- Auto-selects web search providers based on which API keys are provided
- Auto-selects the first available model if `--model` is not specified
- Keeps existing plugin installations

## After Setup

```bash
ccs onprem
```

## License

MIT
