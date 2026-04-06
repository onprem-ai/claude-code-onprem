---
name: websearch-brave
description: Use when needing privacy-focused web search, news articles, general research, or comparisons. Provides LLM-optimized content via Brave Search MCP.
---

# Brave Web Search

> **🎯 DEFAULT TOOL: `brave_llm_context_search`**
>
> **For almost all searches, use `brave_llm_context_search`.** It returns pre-extracted, relevant text content ready for synthesis — not just links and snippets. This is what you want 90% of the time.
>
> **Only use alternatives when:**
> - You need **time-filtered results** → `brave_web_search` (supports `freshness` parameter)
> - You need **recent news** → `brave_news_search`
>
> **IGNORE these tools** (not relevant for coding):
> - `brave_image_search`, `brave_video_search`, `brave_local_search`

## Overview

Brave provides privacy-focused web search with an independent index. Use for general research, news, comparisons, and non-code technical content.

**`brave_llm_context_search` is the primary tool** — it returns actual page content, pre-extracted and relevance-scored, ready for you to synthesize. No need to fetch URLs separately.

**Remember:** For code examples, API docs, and debugging — use Exa's `get_code_context_exa` instead.

## Available Tools

| Tool | Priority | Purpose |
|------|----------|---------|
| `brave_llm_context_search` | **⭐ PRIMARY** | Pre-extracted content, token-controlled, ready for synthesis |
| `brave_web_search` | Fallback | When you need freshness filtering (time-based) |
| `brave_news_search` | News only | Recent announcements and current events |
| `brave_image_search` | ❌ IGNORE | Not relevant for coding |
| `brave_video_search` | ❌ IGNORE | Not relevant for coding |
| `brave_local_search` | ❌ IGNORE | Not relevant for coding |

## When to Use Which Tool

| Query Type | Tool | Why |
|------------|------|-----|
| **Most searches** | `brave_llm_context_search` | **Returns actual content, not just links** |
| General research | `brave_llm_context_search` | Pre-extracted, relevance-scored |
| Comparisons and reviews | `brave_llm_context_search` | Full context for synthesis |
| Need results from specific time period | `brave_web_search` | Supports `freshness` param (pd/pw/pm/py) |
| News and announcements | `brave_news_search` | News-specific index |

### Limitation: `brave_llm_context_search` does NOT support freshness filtering

If you need results from a specific time period (last day, week, month), you must use `brave_web_search` with the `freshness` parameter:
- `pd` = past day
- `pw` = past week
- `pm` = past month
- `py` = past year

## Token Budget for `brave_llm_context_search`

Configure based on context needs:

| Use Case | Token Budget |
|----------|-------------|
| Quick lookup | 1024-2048 tokens |
| Detailed research | 4096-8192 tokens |
| Comprehensive analysis | 16384-32768 tokens |

## Version Awareness (Critical)

Before searching, determine which version of a library/API you're working with:

1. Check `package.json`, `requirements.txt`, `go.mod`, etc.
2. Look at existing imports and usage patterns in the codebase
3. **Always include the version in your search query**

**Bad:** "React useEffect cleanup"
**Good:** "React 18 useEffect cleanup"

**Bad:** "Kubernetes pod networking"
**Good:** "Kubernetes 1.29 pod networking CNI"

**Bad:** "TypeScript decorators"
**Good:** "TypeScript 5.0 decorators experimental"

## When to Use Brave vs Exa

| Use Brave For | Use Exa For |
|---------------|-------------|
| General research questions | Code examples and API docs |
| News and recent developments | Library documentation |
| Comparisons and reviews | Debugging errors |
| Privacy-sensitive searches | GitHub/StackOverflow content |
| Non-code technical content | Code-specific queries |

## Privacy Note

Brave operates an independent search index with strong privacy practices:
- No user tracking
- No user profiling
- Independent from Google/Bing

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| **Using `brave_web_search` by default** | **Use `brave_llm_context_search` — it returns actual content** |
| Using `brave_llm_context_search` for time-filtered search | Use `brave_web_search` with `freshness` param |
| Using Brave for code search | Use Exa's `get_code_context_exa` for code |
| Using Brave for API documentation | Use Exa's `get_code_context_exa` for technical docs |
| Using `brave_image_search` | Ignore — not relevant for coding |
| Using `brave_video_search` | Ignore — not relevant for coding |
| Using `brave_local_search` | Ignore — not relevant for coding |
| Searching without version | Always check and include library version |
| Not checking project deps first | Always check package.json/requirements.txt first |
| Not setting token budget | Configure `maximumNumberOfTokens` based on context needs |
