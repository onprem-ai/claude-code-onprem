---
name: websearch-exa
description: Use when needing to search the web for code examples, API documentation, library usage, error solutions, or technical content. Provides code-optimized search via Exa MCP tools.
---

# Exa Web Search

> **CRITICAL: Tool Selection Rules**
>
> 1. **For code-related searches:** Always use `get_code_context_exa`. This is the absolute best and preferred method for any code, API, library, or technical documentation search. It returns dense, highly relevant code snippets.
>
> 2. **For general web searches:** Use `web_search_exa` — it returns content directly with search results (highlights). Only follow up with `web_fetch_exa` if highlights are insufficient.
>
> 3. **Avoid `web_fetch_exa` during searches.** Only use it when the user explicitly provides a specific URL to fetch, or when another document references it or when searches need expansion.

## Overview

Exa provides code-optimized web search with dense, relevant code snippets. Use for API lookups, code examples, error debugging, and technical documentation.

## Available Tools

| Tool | Purpose |
|------|---------|
| `get_code_context_exa` | Code-specific search (GitHub, StackOverflow, docs) |
| `web_search_exa` | General web search (returns highlights automatically) |
| `web_fetch_exa` | Fetch full page content (only when URL is explicitly provided) |

## When to Use Which Tool

| Query Type | Tool | Why |
|------------|------|-----|
| API/SDK usage, code examples | `get_code_context_exa` | Returns dense, relevant code snippets |
| Library documentation | `get_code_context_exa` | Searches GitHub, StackOverflow, docs |
| Debugging errors | `get_code_context_exa` | Finds StackOverflow solutions |
| General web research | `web_search_exa` | Returns highlights automatically |
| Expand on search result | `web_fetch_exa` | When highlights aren't enough |
| Specific URL provided by user | `web_fetch_exa` | Fetches full page content |

## Version Awareness (Critical)

Before searching, determine which version of a library/API you're working with:

1. Check `package.json`, `requirements.txt`, `go.mod`, etc.
2. Look at existing imports and usage patterns in the codebase
3. **Always include the version in your search query**

**Bad:** "React useEffect cleanup"
**Good:** "React 18 useEffect cleanup"

**Bad:** "Stripe create customer API"
**Good:** "Stripe API v2024-12 create customer Python"

## Query Tips for `get_code_context_exa`

**Always include version numbers:**
- Check the project's dependencies first
- Include major version: "React 18 useEffect" not "React useEffect"
- Include API version if applicable: "Stripe API 2024-12 webhooks"

**Be specific with context:**
- Include language: "Stripe webhook signature verification Python"
- Include framework: "NextAuth v5 Google OAuth app router"
- Include environment: "AWS Lambda Node 20 cold start optimization"

## What Exa Searches

- GitHub repositories (1B+ files)
- Official documentation sites
- StackOverflow questions and answers
- Technical blog posts

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Searching without version | Always check and include library version |
| Using `web_search_exa` for code | Use `get_code_context_exa` for code queries |
| Using `web_fetch_exa` to search | Only use when a specific URL is provided or to expand highlights |
| Vague queries | Be specific: language, framework, version |
| Not checking project deps first | Always check package.json/requirements.txt first |
