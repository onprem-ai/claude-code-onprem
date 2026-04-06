import * as p from '@clack/prompts'
import { checkPrerequisites } from './prerequisites.js'
import { fetchModels, testExaConnection, testBraveConnection } from './models.js'
import { loadProfile, createProfile } from './profile.js'
import { disableCcsWebsearch } from './mcp.js'
import {
  isMarketplaceAdded,
  addMarketplace,
  pluginInstalled,
  installPlugin,
  uninstallPlugin,
  setPluginApiKey,
} from './plugins.js'
import { MIN_NODE_VERSION, MIN_CCS_VERSION, MIN_CLAUDE_VERSION, DEFAULTS } from './constants.js'
import type { ModelInfo } from './types.js'

function exitOnCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.outro('Setup cancelled.')
    process.exit(0)
  }
  return value
}

export async function run(): Promise<void> {
  p.intro('Claude Code On-Prem Setup')

  // Step 1: Check prerequisites
  const prereqSpinner = p.spinner()
  prereqSpinner.start('Checking prerequisites...')

  const prereqs = await checkPrerequisites()

  if (!prereqs.success) {
    prereqSpinner.stop('Prerequisites check failed')

    if (!prereqs.node.meetsMinimum) {
      p.log.error(`Node.js ${prereqs.node.version || 'unknown'} is below minimum ${MIN_NODE_VERSION}. Please upgrade Node.js.`)
    }

    if (!prereqs.ccs.installed) {
      p.log.error(`CCS is not installed. Install it with: npm i -g @kaitranntt/ccs`)
    } else if (!prereqs.ccs.meetsMinimum) {
      p.log.error(`CCS ${prereqs.ccs.version} is below minimum ${MIN_CCS_VERSION}. Upgrade with: npm update -g @kaitranntt/ccs`)
    }

    if (!prereqs.claude.installed) {
      p.log.error(`Claude Code is not installed. Install it with: npm i -g @anthropic-ai/claude-code`)
    } else if (!prereqs.claude.meetsMinimum) {
      p.log.error(`Claude Code ${prereqs.claude.version} is below minimum ${MIN_CLAUDE_VERSION}. Upgrade with: claude update`)
    }

    p.outro('Setup cancelled.')
    process.exit(1)
  }

  prereqSpinner.stop(`Prerequisites OK (Node ${prereqs.node.version}, CCS ${prereqs.ccs.version}, Claude ${prereqs.claude.version})`)

  // Load existing profile for prefilling
  const existingProfile = await loadProfile(DEFAULTS.profileName)
  let prefillEndpoint = ''
  let prefillApiKey = ''

  if (existingProfile) {
    p.log.info('Existing profile found - current values will be prefilled')
    prefillEndpoint = existingProfile.env.ANTHROPIC_BASE_URL
    prefillApiKey = existingProfile.env.ANTHROPIC_AUTH_TOKEN
  }

  // Step 2: LLM Endpoint Configuration
  p.log.step('LLM Endpoint Configuration')

  let endpoint = ''
  let apiKey = ''
  let models: ModelInfo[] = []
  let selectedModel = ''

  while (true) {
    endpoint = exitOnCancel(await p.text({
      message: 'What is your LLM endpoint URL?',
      placeholder: 'https://llm-api2.bunker.onprem.ai',
      initialValue: prefillEndpoint,
      validate: (value) => {
        if (!value) return 'Endpoint URL is required'
        try {
          new URL(value)
        } catch {
          return 'Invalid URL format'
        }
      },
    }))

    if (prefillApiKey) {
      const keepKey = exitOnCancel(await p.confirm({
        message: `API key configured (${prefillApiKey.slice(0, 4)}••••). Keep existing?`,
        initialValue: true,
      }))
      apiKey = keepKey ? prefillApiKey : exitOnCancel(await p.password({
        message: 'Enter new API key',
      })) || ''
    } else {
      apiKey = exitOnCancel(await p.password({
        message: 'API key (optional, leave empty if not required)',
      })) || ''
    }

    const modelSpinner = p.spinner()
    modelSpinner.start('Fetching available models...')

    const modelsResult = await fetchModels(endpoint, apiKey)

    if (modelsResult.success && modelsResult.models?.length) {
      modelSpinner.stop(`Found ${modelsResult.models.length} models`)
      models = modelsResult.models
      break
    } else {
      modelSpinner.stop(`Failed: ${modelsResult.error}`)

      const retry = exitOnCancel(await p.select({
        message: 'What would you like to do?',
        options: [
          { value: 'retry', label: 'Retry with different endpoint/key' },
          { value: 'manual', label: 'Enter model name manually' },
        ],
      })) as 'retry' | 'manual'

      if (retry === 'manual') {
        selectedModel = exitOnCancel(await p.text({
          message: 'Enter model name',
          placeholder: 'qwen3-coder-next',
          validate: (value) => value ? undefined : 'Model name is required',
        }))
        break
      }

      prefillEndpoint = endpoint
      prefillApiKey = apiKey
    }
  }

  // Model selection
  if (models.length > 0) {
    selectedModel = exitOnCancel(await p.select({
      message: 'Select default model',
      options: models.map((m) => ({ value: m.id, label: m.id })),
    }))
  }

  // Create profile
  const profileSpinner = p.spinner()
  profileSpinner.start('Creating CCS profile...')
  try {
    await createProfile(DEFAULTS.profileName, {
      endpoint,
      apiKey,
      model: selectedModel,
    })
    profileSpinner.stop('Profile created at ~/.ccs/onprem.settings.json')

    // Register the profile with CCS
    const registerSpinner = p.spinner()
    registerSpinner.start('Registering profile with CCS...')
    const { execSync } = await import('child_process')
    try {
      execSync('ccs api discover --register', { stdio: 'pipe' })
      registerSpinner.stop('Profile registered')
    } catch {
      registerSpinner.stop('Profile created (manual registration may be needed: ccs api discover --register)')
    }
  } catch (error) {
    profileSpinner.stop('Failed to create profile')
    p.log.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  // Step 3: Web Search Providers
  p.log.step('Web Search Providers')
  p.log.message('Claude Code can use web search to look up documentation,\nfind code examples, and research solutions.')

  // Check what's already installed to prefill selection
  const exaInstalled = await pluginInstalled('websearch-exa')
  const braveInstalled = await pluginInstalled('websearch-brave')

  let initialSelection: string[]
  if (exaInstalled || braveInstalled) {
    // Prefill with what's installed
    initialSelection = []
    if (exaInstalled) initialSelection.push('exa')
    if (braveInstalled) initialSelection.push('brave')
  } else {
    // Nothing installed, default to Exa
    initialSelection = ['exa']
  }

  const selectedProviders = exitOnCancel(await p.multiselect({
    message: 'Which providers would you like to configure?',
    options: [
      { value: 'exa', label: 'Exa (code search, API docs, technical content)' },
      { value: 'brave', label: 'Brave (privacy-focused, news, general research)' },
    ],
    initialValues: initialSelection,
    required: false,
  }))

  let anyMcpConfigured = false

  // Check for plugins to uninstall (not selected but installed)
  if (!selectedProviders.includes('exa') && await pluginInstalled('websearch-exa')) {
    const uninstallExa = exitOnCancel(await p.confirm({
      message: 'Exa plugin is installed but not selected. Would you like to uninstall it?',
      initialValue: false,
    }))
    if (uninstallExa) {
      const spinner = p.spinner()
      spinner.start('Uninstalling Exa plugin...')
      const result = await uninstallPlugin('websearch-exa')
      if (result.success) {
        spinner.stop('Exa plugin uninstalled')
      } else {
        spinner.stop(`Failed to uninstall: ${result.error}`)
      }
    }
  }

  if (!selectedProviders.includes('brave') && await pluginInstalled('websearch-brave')) {
    const uninstallBrave = exitOnCancel(await p.confirm({
      message: 'Brave plugin is installed but not selected. Would you like to uninstall it?',
      initialValue: false,
    }))
    if (uninstallBrave) {
      const spinner = p.spinner()
      spinner.start('Uninstalling Brave plugin...')
      const result = await uninstallPlugin('websearch-brave')
      if (result.success) {
        spinner.stop('Brave plugin uninstalled')
      } else {
        spinner.stop(`Failed to uninstall: ${result.error}`)
      }
    }
  }

  // Add marketplace if needed and any providers selected
  if (selectedProviders.length > 0) {
    const marketplaceSpinner = p.spinner()
    marketplaceSpinner.start('Checking plugin marketplace...')

    if (!await isMarketplaceAdded()) {
      const result = await addMarketplace()
      if (result.success) {
        marketplaceSpinner.stop('Marketplace added: claude-code-onprem')
      } else {
        marketplaceSpinner.stop(`Failed to add marketplace: ${result.error}`)
        p.log.warning('You may need to add the marketplace manually: claude plugin marketplace add onprem-ai/claude-code-onprem')
      }
    } else {
      marketplaceSpinner.stop('Marketplace already configured')
    }
  }

  // Exa setup
  if (selectedProviders.includes('exa')) {
    p.log.step('Exa Plugin')

    const alreadyInstalled = await pluginInstalled('websearch-exa')

    if (alreadyInstalled) {
      const action = exitOnCancel(await p.select({
        message: 'Exa plugin is already installed. What would you like to do?',
        options: [
          { value: 'keep', label: 'Keep existing installation' },
          { value: 'reinstall', label: 'Reinstall plugin' },
        ],
      })) as 'keep' | 'reinstall'

      if (action === 'keep') {
        p.log.success('Keeping existing Exa plugin')
        anyMcpConfigured = true
      } else {
        // Get existing key before reinstall (reinstall overwrites .mcp.json)
        const { getInstalledPluginApiKey } = await import('./plugins.js')
        const existingKey = await getInstalledPluginApiKey('websearch-exa', 'x-api-key')

        const spinner = p.spinner()
        spinner.start('Reinstalling Exa plugin...')
        const result = await installPlugin('websearch-exa')
        if (result.success) {
          if (existingKey) {
            // Restore existing key
            await setPluginApiKey('websearch-exa', '${EXA_API_KEY}', existingKey)
            spinner.stop('Exa plugin reinstalled')
            p.log.success('Tools: get_code_context_exa, web_search_exa, web_fetch_exa')
            anyMcpConfigured = true
          } else {
            // No existing key found, prompt for one
            spinner.stop('Exa plugin reinstalled')

            let keyConfigured = false
            while (!keyConfigured) {
              const exaKey = exitOnCancel(await p.password({
                message: 'Exa API key (from dashboard.exa.ai)',
                validate: (value) => value ? undefined : 'API key is required',
              }))

              const testSpinner = p.spinner()
              testSpinner.start('Testing Exa connection...')
              const testResult = await testExaConnection(exaKey)

              if (testResult.success) {
                testSpinner.stop('Connected successfully')
                await setPluginApiKey('websearch-exa', '${EXA_API_KEY}', exaKey)
                p.log.success('Tools: get_code_context_exa, web_search_exa, web_fetch_exa')
                anyMcpConfigured = true
                keyConfigured = true
              } else {
                testSpinner.stop(`Failed: ${testResult.error}`)
                const action = exitOnCancel(await p.select({
                  message: 'What would you like to do?',
                  options: [
                    { value: 'retry', label: 'Enter a different API key' },
                    { value: 'skip', label: 'Skip Exa setup' },
                  ],
                })) as 'retry' | 'skip'
                if (action === 'skip') keyConfigured = true
              }
            }
          }
        } else {
          spinner.stop(`Failed: ${result.error}`)
        }
      }
    } else {
      // Test API key first
      let exaConfigured = false

      while (!exaConfigured) {
        const exaKey = exitOnCancel(await p.password({
          message: 'Exa API key (from dashboard.exa.ai)',
          validate: (value) => value ? undefined : 'API key is required',
        }))

        const testSpinner = p.spinner()
        testSpinner.start('Testing Exa connection...')

        const testResult = await testExaConnection(exaKey)

        if (testResult.success) {
          testSpinner.stop('Connected successfully')

          const installSpinner = p.spinner()
          installSpinner.start('Installing Exa plugin...')
          const result = await installPlugin('websearch-exa')
          if (result.success) {
            // Set API key in plugin's .mcp.json
            const keyResult = await setPluginApiKey('websearch-exa', '${EXA_API_KEY}', exaKey)
            if (keyResult.success) {
              installSpinner.stop('Exa plugin installed')
              p.log.success('Tools: get_code_context_exa, web_search_exa, web_fetch_exa')
              anyMcpConfigured = true
              exaConfigured = true
            } else {
              installSpinner.stop(`Installed but failed to set API key: ${keyResult.error}`)
              exaConfigured = true
            }
          } else {
            installSpinner.stop(`Failed: ${result.error}`)
            exaConfigured = true // Exit loop on install failure
          }
        } else {
          testSpinner.stop(`Failed: ${testResult.error}`)

          const action = exitOnCancel(await p.select({
            message: 'What would you like to do?',
            options: [
              { value: 'retry', label: 'Enter a different API key' },
              { value: 'skip', label: 'Skip Exa setup' },
            ],
          })) as 'retry' | 'skip'

          if (action === 'skip') {
            exaConfigured = true
          }
        }
      }
    }
  }

  // Brave setup
  if (selectedProviders.includes('brave')) {
    p.log.step('Brave Plugin')

    const alreadyInstalled = await pluginInstalled('websearch-brave')

    if (alreadyInstalled) {
      const action = exitOnCancel(await p.select({
        message: 'Brave plugin is already installed. What would you like to do?',
        options: [
          { value: 'keep', label: 'Keep existing installation' },
          { value: 'reinstall', label: 'Reinstall plugin' },
        ],
      })) as 'keep' | 'reinstall'

      if (action === 'keep') {
        p.log.success('Keeping existing Brave plugin')
        anyMcpConfigured = true
      } else {
        // Get existing key before reinstall (reinstall overwrites .mcp.json)
        const { getInstalledPluginApiKey } = await import('./plugins.js')
        const existingKey = await getInstalledPluginApiKey('websearch-brave', 'BRAVE_API_KEY')

        const spinner = p.spinner()
        spinner.start('Reinstalling Brave plugin...')
        const result = await installPlugin('websearch-brave')
        if (result.success) {
          if (existingKey) {
            // Restore existing key
            await setPluginApiKey('websearch-brave', '${BRAVE_API_KEY}', existingKey)
            spinner.stop('Brave plugin reinstalled')
            p.log.success('Tools: brave_web_search, brave_llm_context_search, brave_news_search')
            anyMcpConfigured = true
          } else {
            // No existing key found, prompt for one
            spinner.stop('Brave plugin reinstalled')

            let keyConfigured = false
            while (!keyConfigured) {
              const braveKey = exitOnCancel(await p.password({
                message: 'Brave API key (from api-dashboard.search.brave.com)',
                validate: (value) => value ? undefined : 'API key is required',
              }))

              const testSpinner = p.spinner()
              testSpinner.start('Testing Brave connection...')
              const testResult = await testBraveConnection(braveKey)

              if (testResult.success) {
                testSpinner.stop('Connected successfully')
                await setPluginApiKey('websearch-brave', '${BRAVE_API_KEY}', braveKey)
                p.log.success('Tools: brave_web_search, brave_llm_context_search, brave_news_search')
                anyMcpConfigured = true
                keyConfigured = true
              } else {
                testSpinner.stop(`Failed: ${testResult.error}`)
                const action = exitOnCancel(await p.select({
                  message: 'What would you like to do?',
                  options: [
                    { value: 'retry', label: 'Enter a different API key' },
                    { value: 'skip', label: 'Skip Brave setup' },
                  ],
                })) as 'retry' | 'skip'
                if (action === 'skip') keyConfigured = true
              }
            }
          }
        } else {
          spinner.stop(`Failed: ${result.error}`)
        }
      }
    } else {
      // Test API key first
      let braveConfigured = false

      while (!braveConfigured) {
        const braveKey = exitOnCancel(await p.password({
          message: 'Brave API key (from api-dashboard.search.brave.com)',
          validate: (value) => value ? undefined : 'API key is required',
        }))

        const testSpinner = p.spinner()
        testSpinner.start('Testing Brave connection...')

        const testResult = await testBraveConnection(braveKey)

        if (testResult.success) {
          testSpinner.stop('Connected successfully')

          const installSpinner = p.spinner()
          installSpinner.start('Installing Brave plugin...')
          const result = await installPlugin('websearch-brave')
          if (result.success) {
            // Set API key in plugin's .mcp.json
            const keyResult = await setPluginApiKey('websearch-brave', '${BRAVE_API_KEY}', braveKey)
            if (keyResult.success) {
              installSpinner.stop('Brave plugin installed')
              p.log.success('Tools: brave_web_search, brave_llm_context_search, brave_news_search')
              anyMcpConfigured = true
              braveConfigured = true
            } else {
              installSpinner.stop(`Installed but failed to set API key: ${keyResult.error}`)
              braveConfigured = true
            }
          } else {
            installSpinner.stop(`Failed: ${result.error}`)
            braveConfigured = true // Exit loop on install failure
          }
        } else {
          testSpinner.stop(`Failed: ${testResult.error}`)

          const action = exitOnCancel(await p.select({
            message: 'What would you like to do?',
            options: [
              { value: 'retry', label: 'Enter a different API key' },
              { value: 'skip', label: 'Skip Brave setup' },
            ],
          })) as 'retry' | 'skip'

          if (action === 'skip') {
            braveConfigured = true
          }
        }
      }
    }
  }

  // Ask about disabling CCS websearch
  p.log.step('CCS Built-in Web Search')

  if (anyMcpConfigured) {
    p.log.message('You have installed custom web search plugins (Exa/Brave).\nDisabling CCS built-in websearch is recommended to avoid duplicate results.')
  } else {
    p.log.message('No custom web search plugins were installed.\nKeeping CCS built-in websearch enabled is recommended.')
  }

  const disableWebsearch = exitOnCancel(await p.confirm({
    message: 'Disable CCS built-in web search?',
    initialValue: anyMcpConfigured,
  }))

  if (disableWebsearch) {
    const websearchSpinner = p.spinner()
    websearchSpinner.start('Disabling CCS built-in websearch...')
    try {
      await disableCcsWebsearch()
      websearchSpinner.stop('Set websearch.enabled: false in ~/.ccs/config.yaml')
    } catch (error) {
      websearchSpinner.stop('Failed to disable CCS websearch')
      p.log.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  } else {
    p.log.info('Keeping CCS built-in websearch enabled')
  }

  // Done
  p.log.success('Setup complete!')
  p.log.message('\nTo start Claude Code with on-prem:\n  ccs onprem')
  p.outro('Happy coding!')
}
