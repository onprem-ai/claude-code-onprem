import * as p from '@clack/prompts'
import pc from 'picocolors'
import { execSync } from 'child_process'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')
import { checkPrerequisites } from './prerequisites.js'
import { fetchModels, testExaConnection, testBraveConnection } from './models.js'
import { loadProfile, createProfile, profileExists } from './profile.js'
import { disableCcsWebsearch } from './mcp.js'
import {
  isMarketplaceAdded,
  addMarketplace,
  pluginInstalled,
  installPlugin,
  uninstallPlugin,
  setPluginApiKey,
  removePluginApiKey,
} from './plugins.js'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import { MIN_NODE_VERSION, MIN_CCS_VERSION, MIN_CLAUDE_VERSION, DEFAULTS, PATHS } from './constants.js'
import type { ModelInfo } from './types.js'

export interface CliOptions {
  llmUrl?: string
  llmKey?: string
  model?: string
  exaKey?: string
  braveKey?: string
  profile?: string
  yes?: boolean
}

export function parseArgs(argv: string[] = process.argv.slice(2)): CliOptions {
  const options: CliOptions = {}

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '-y' || arg === '--yes') {
      options.yes = true
    } else if (arg.startsWith('--llm-url=')) {
      options.llmUrl = arg.slice('--llm-url='.length)
    } else if (arg === '--llm-url' && argv[i + 1]) {
      options.llmUrl = argv[++i]
    } else if (arg.startsWith('--llm-key=')) {
      options.llmKey = arg.slice('--llm-key='.length)
    } else if (arg === '--llm-key' && argv[i + 1]) {
      options.llmKey = argv[++i]
    } else if (arg.startsWith('--model=')) {
      options.model = arg.slice('--model='.length)
    } else if (arg === '--model' && argv[i + 1]) {
      options.model = argv[++i]
    } else if (arg.startsWith('--exa-key=')) {
      options.exaKey = arg.slice('--exa-key='.length)
    } else if (arg === '--exa-key' && argv[i + 1]) {
      options.exaKey = argv[++i]
    } else if (arg.startsWith('--brave-key=')) {
      options.braveKey = arg.slice('--brave-key='.length)
    } else if (arg === '--brave-key' && argv[i + 1]) {
      options.braveKey = argv[++i]
    } else if (arg.startsWith('--profile=')) {
      options.profile = arg.slice('--profile='.length)
    } else if (arg === '--profile' && argv[i + 1]) {
      options.profile = argv[++i]
    }
  }

  return options
}

function exitOnCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.outro('Setup cancelled.')
    process.exit(0)
  }
  return value
}

function runCommand(command: string): { success: boolean; error?: string } {
  try {
    execSync(command, { stdio: 'inherit' })
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function run(cliOptions?: CliOptions): Promise<void> {
  const options = cliOptions ?? parseArgs()

  p.intro(`Claude Code On-Prem Setup v${pkg.version}`)

  // Step 1: Check prerequisites
  const prereqSpinner = p.spinner()
  prereqSpinner.start('Checking prerequisites...')
  let prereqSpinnerActive = true

  let prereqs = await checkPrerequisites()

  // Node.js check - cannot auto-install, must fail
  if (!prereqs.node.meetsMinimum) {
    prereqSpinner.stop('Prerequisites check failed')
    p.log.error(`Node.js ${prereqs.node.version || 'unknown'} is below minimum ${MIN_NODE_VERSION}. Please upgrade Node.js.`)
    p.outro('Setup cancelled.')
    process.exit(1)
  }

  // CCS check - offer to install/update
  if (!prereqs.ccs.installed) {
    prereqSpinner.stop('CCS not found')
    prereqSpinnerActive = false

    const install = options.yes || exitOnCancel(await p.confirm({
      message: 'CCS is not installed. Would you like to install it now?',
      initialValue: true,
    }))

    if (install) {
      const installSpinner = p.spinner()
      installSpinner.start('Installing CCS...')
      const result = runCommand('npm i -g @kaitranntt/ccs')
      if (result.success) {
        installSpinner.stop('CCS installed')
        prereqs = await checkPrerequisites()
      } else {
        installSpinner.stop('Failed to install CCS')
        p.log.error('Try manually: npm i -g @kaitranntt/ccs')
        p.outro('Setup cancelled.')
        process.exit(1)
      }
    } else {
      p.outro('Setup cancelled.')
      process.exit(1)
    }
  } else if (!prereqs.ccs.meetsMinimum) {
    prereqSpinner.stop(`CCS ${prereqs.ccs.version} is outdated (minimum: ${MIN_CCS_VERSION})`)
    prereqSpinnerActive = false

    const update = options.yes || exitOnCancel(await p.confirm({
      message: `Would you like to update CCS to the latest version?`,
      initialValue: true,
    }))

    if (update) {
      const updateSpinner = p.spinner()
      updateSpinner.start('Updating CCS...')
      const result = runCommand('npm update -g @kaitranntt/ccs')
      if (result.success) {
        updateSpinner.stop('CCS updated')
        prereqs = await checkPrerequisites()
      } else {
        updateSpinner.stop('Failed to update CCS')
        p.log.error('Try manually: npm update -g @kaitranntt/ccs')
        p.outro('Setup cancelled.')
        process.exit(1)
      }
    } else {
      p.outro('Setup cancelled.')
      process.exit(1)
    }
  }

  // Claude Code check - error out with instructions (npm install is deprecated)
  if (!prereqs.claude.installed) {
    if (prereqSpinnerActive) {
      prereqSpinner.stop('Claude Code not found')
      prereqSpinnerActive = false
    }
    p.log.error('Claude Code is not installed.')
    p.log.message('See install instructions: https://github.com/anthropics/claude-code')
    p.outro('Setup cancelled.')
    process.exit(1)
  } else if (!prereqs.claude.meetsMinimum) {
    if (prereqSpinnerActive) {
      prereqSpinner.stop(`Claude Code ${prereqs.claude.version} is outdated`)
      prereqSpinnerActive = false
    }
    p.log.error(`Claude Code ${prereqs.claude.version} is below minimum ${MIN_CLAUDE_VERSION}. Upgrade with: claude update`)
    p.outro('Setup cancelled.')
    process.exit(1)
  }

  // Final check - all prerequisites should be met now
  if (!prereqs.success) {
    if (prereqSpinnerActive) prereqSpinner.stop('Prerequisites check failed')
    p.log.error('Prerequisites still not met after installation/update attempts.')
    p.outro('Setup cancelled.')
    process.exit(1)
  }

  if (prereqSpinnerActive) {
    prereqSpinner.stop(`Prerequisites OK (Node ${prereqs.node.version}, CCS ${prereqs.ccs.version}, Claude ${prereqs.claude.version})`)
  } else {
    p.log.success(`Prerequisites OK (Node ${prereqs.node.version}, CCS ${prereqs.ccs.version}, Claude ${prereqs.claude.version})`)
  }

  // Step 2: Profile Name
  // Remember the last used profile name across wizard runs, but only if the profile still exists
  let lastProfileName: string | null = null
  try {
    const cached = (await readFile(PATHS.lastProfileName, 'utf-8')).trim()
    if (cached && await profileExists(cached)) {
      lastProfileName = cached
    }
  } catch { /* file doesn't exist yet */ }
  const defaultProfileName = options.profile || lastProfileName || DEFAULTS.profileName

  let profileName: string
  if (options.yes) {
    profileName = defaultProfileName
    p.log.info(`Using profile: ${profileName}`)
  } else {
    profileName = exitOnCancel(await p.text({
      message: 'Profile name for this configuration?',
      placeholder: DEFAULTS.profileName,
      initialValue: defaultProfileName,
      validate: (value) => {
        if (!value) return 'Profile name is required'
        if (!/^[a-zA-Z0-9_-]+$/.test(value)) return 'Profile name can only contain letters, numbers, hyphens, and underscores'
      },
    }))
  }

  // Load existing profile for prefilling
  const existingProfile = await loadProfile(profileName)
  let prefillEndpoint = options.llmUrl || ''
  let prefillApiKey = options.llmKey || ''

  if (existingProfile && !options.llmUrl) {
    p.log.info('Existing profile found - current values will be prefilled')
    prefillEndpoint = existingProfile.env.ANTHROPIC_BASE_URL
    if (!options.llmKey) {
      prefillApiKey = existingProfile.env.ANTHROPIC_AUTH_TOKEN
    }
  }

  // Step 3: LLM Endpoint Configuration
  p.log.step('LLM Endpoint Configuration')

  let endpoint = ''
  let apiKey = ''
  let models: ModelInfo[] = []
  let selectedModel = ''

  while (true) {
    // Use CLI option or prompt
    if (options.yes && options.llmUrl) {
      endpoint = options.llmUrl
      p.log.info(`Using LLM URL: ${endpoint}`)
    } else {
      endpoint = exitOnCancel(await p.text({
        message: 'What is your LLM endpoint URL?',
        placeholder: 'http://localhost:8000/v1',
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
    }

    // Use CLI option or prompt for API key
    if (options.yes && options.llmKey !== undefined) {
      apiKey = options.llmKey
      p.log.info('Using provided LLM API key')
    } else if (prefillApiKey && !options.yes) {
      const keepKey = exitOnCancel(await p.confirm({
        message: `API key configured (${prefillApiKey.slice(0, 4)}••••). Keep existing?`,
        initialValue: true,
      }))
      apiKey = keepKey ? prefillApiKey : exitOnCancel(await p.password({
        message: 'Enter new API key',
      })) || ''
    } else if (options.yes) {
      apiKey = prefillApiKey
      if (apiKey) p.log.info('Using existing LLM API key')
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

      if (options.yes) {
        if (options.model) {
          // User provided a model via CLI, proceed with it
          selectedModel = options.model
          p.log.info(`Using provided model: ${selectedModel}`)
          break
        }
        p.log.error('Cannot fetch models in non-interactive mode. Provide --model or a valid endpoint.')
        process.exit(1)
      }

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
          initialValue: options.model || '',
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
    if (options.model) {
      // Use CLI-provided model, validate it exists
      const modelExists = models.some(m => m.id === options.model)
      if (modelExists) {
        selectedModel = options.model
        p.log.info(`Using model: ${selectedModel}`)
      } else {
        p.log.warning(`Model "${options.model}" not found in available models`)
        if (options.yes) {
          // In non-interactive mode, use it anyway (user might know better)
          selectedModel = options.model
          p.log.info(`Using model: ${selectedModel}`)
        } else {
          selectedModel = exitOnCancel(await p.select({
            message: 'Select default model',
            options: models.map((m) => ({ value: m.id, label: m.id })),
          }))
        }
      }
    } else if (options.yes) {
      selectedModel = models[0].id
      p.log.info(`Selected model: ${selectedModel}`)
    } else {
      selectedModel = exitOnCancel(await p.select({
        message: 'Select default model',
        options: models.map((m) => ({ value: m.id, label: m.id })),
      }))
    }
  } else if (options.model) {
    // No models fetched but user provided one via CLI
    selectedModel = options.model
    p.log.info(`Using model: ${selectedModel}`)
  }

  // Create profile
  const profileSpinner = p.spinner()
  profileSpinner.start('Creating CCS profile...')
  try {
    await createProfile(profileName, {
      endpoint,
      apiKey,
      model: selectedModel,
    })
    profileSpinner.stop(`Profile created at ~/.ccs/${profileName}.settings.json`)

    // Remember the profile name for next wizard run
    await mkdir(dirname(PATHS.lastProfileName), { recursive: true })
    await writeFile(PATHS.lastProfileName, profileName, 'utf-8')

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

  // Step 4: Web Search Providers
  p.log.step('Web Search Providers')
  p.log.message('Configure web search to help your on-prem LLM with up-to-date information.')

  // Check what's already installed
  const exaInstalled = await pluginInstalled('websearch-exa')
  const braveInstalled = await pluginInstalled('websearch-brave')

  let initialSelection: string[]
  if (exaInstalled || braveInstalled) {
    initialSelection = []
    if (exaInstalled) initialSelection.push('exa')
    if (braveInstalled) initialSelection.push('brave')
  } else {
    initialSelection = ['exa']
  }

  let selectedProviders: string[]

  if (options.yes) {
    selectedProviders = []
    if (options.exaKey) selectedProviders.push('exa')
    if (options.braveKey) selectedProviders.push('brave')
    if (selectedProviders.length > 0) {
      p.log.info(`Selected providers: ${selectedProviders.join(', ')}`)
    } else {
      p.log.info('No web search providers selected')
    }
  } else {
    p.log.message('One provider is usually enough. Exa is optimized for coding agents.\nBrave is an alternative search for maximum privacy.')

    selectedProviders = exitOnCancel(await p.multiselect({
      message: 'Which providers would you like to configure?',
      options: [
        { value: 'exa', label: 'Exa - best for coding (API docs, code examples, technical content)' },
        { value: 'brave', label: 'Brave - privacy-focused (news, general research)' },
      ],
      initialValues: initialSelection,
      required: false,
    }))
  }

  let anyMcpConfigured = false

  // Add marketplace if not already added
  if (selectedProviders.length > 0) {
    const marketplaceSpinner = p.spinner()
    marketplaceSpinner.start('Setting up plugin marketplace...')

    if (!await isMarketplaceAdded()) {
      const result = await addMarketplace()
      if (result.success) {
        marketplaceSpinner.stop('Marketplace added: onprem-ai')
      } else {
        marketplaceSpinner.stop(`Failed to add marketplace: ${result.error}`)
        p.log.warning('You may need to add the marketplace manually')
      }
    } else {
      marketplaceSpinner.stop('Marketplace already configured')
    }
  }

  // Check for plugins to uninstall (not selected but installed)
  if (!options.yes && !selectedProviders.includes('exa') && await pluginInstalled('websearch-exa')) {
    const uninstallExa = exitOnCancel(await p.confirm({
      message: 'Exa plugin is installed but not selected. Would you like to uninstall it?',
      initialValue: true,
    }))
    if (uninstallExa) {
      const spinner = p.spinner()
      spinner.start('Uninstalling Exa plugin...')
      const result = await uninstallPlugin('websearch-exa')
      if (result.success) {
        await removePluginApiKey('EXA_API_KEY', profileName)
        spinner.stop('Exa plugin uninstalled')
      } else {
        spinner.stop(`Failed to uninstall: ${result.error}`)
      }
    }
  }

  if (!options.yes && !selectedProviders.includes('brave') && await pluginInstalled('websearch-brave')) {
    const uninstallBrave = exitOnCancel(await p.confirm({
      message: 'Brave plugin is installed but not selected. Would you like to uninstall it?',
      initialValue: true,
    }))
    if (uninstallBrave) {
      const spinner = p.spinner()
      spinner.start('Uninstalling Brave plugin...')
      const result = await uninstallPlugin('websearch-brave')
      if (result.success) {
        await removePluginApiKey('BRAVE_API_KEY', profileName)
        spinner.stop('Brave plugin uninstalled')
      } else {
        spinner.stop(`Failed to uninstall: ${result.error}`)
      }
    }
  }

  // Install web search plugins from marketplace
  for (const provider of selectedProviders) {
    const pluginName = provider === 'exa' ? 'websearch-exa' : 'websearch-brave'
    const providerName = provider === 'exa' ? 'Exa' : 'Brave'

    p.log.step(`${providerName} Plugin`)

    const alreadyInstalled = await pluginInstalled(pluginName)

    if (alreadyInstalled) {
      // In non-interactive mode, keep existing installation
      const action = options.yes ? 'keep' : exitOnCancel(await p.select({
        message: `${providerName} plugin is already installed. What would you like to do?`,
        options: [
          { value: 'keep', label: 'Keep existing installation' },
          { value: 'reinstall', label: 'Reinstall plugin' },
        ],
      })) as 'keep' | 'reinstall'

      if (action === 'keep') {
        p.log.success(`Keeping existing ${providerName} plugin`)
        anyMcpConfigured = true
      } else {
        // Get existing key before reinstall
        const { getInstalledPluginApiKey } = await import('./plugins.js')
        const existingKey = await getInstalledPluginApiKey(pluginName, provider === 'exa' ? 'EXA_API_KEY' : 'BRAVE_API_KEY', profileName)

        const spinner = p.spinner()
        spinner.start(`Reinstalling ${providerName} plugin...`)
        const result = await installPlugin(pluginName)
        if (result.success) {
          if (existingKey) {
            // Ask user if they want to keep the existing API key
            const keepKey = options.yes || exitOnCancel(await p.confirm({
              message: `API key configured (${existingKey.slice(0, 4)}••••). Keep existing?`,
              initialValue: true,
            }))
            if (keepKey) {
              await setPluginApiKey(pluginName, provider === 'exa' ? 'EXA_API_KEY' : 'BRAVE_API_KEY', existingKey, profileName)
              spinner.stop(`${providerName} plugin reinstalled`)
              p.log.success(provider === 'exa' ? 'Tools: get_code_context_exa, web_search_exa, web_fetch_exa' : 'Tools: brave_web_search, brave_llm_context_search, brave_news_search')
              anyMcpConfigured = true
            } else {
              // User wants to enter a new key
              spinner.stop(`${providerName} plugin reinstalled`)
              let keyConfigured = false
              while (!keyConfigured) {
                const apiKey = exitOnCancel(await p.password({
                  message: provider === 'exa' ? 'Exa API key (from dashboard.exa.ai)' : 'Brave API key (from api-dashboard.search.brave.com)',
                  validate: (value) => value ? undefined : 'API key is required',
                }))

                const testSpinner = p.spinner()
                testSpinner.start(`Testing ${providerName} connection...`)
                const testResult = provider === 'exa' ? await testExaConnection(apiKey) : await testBraveConnection(apiKey)

                if (testResult.success) {
                  testSpinner.stop('Connected successfully')
                  await setPluginApiKey(pluginName, provider === 'exa' ? 'EXA_API_KEY' : 'BRAVE_API_KEY', apiKey, profileName)
                  p.log.success(provider === 'exa' ? 'Tools: get_code_context_exa, web_search_exa, web_fetch_exa' : 'Tools: brave_web_search, brave_llm_context_search, brave_news_search')
                  anyMcpConfigured = true
                  keyConfigured = true
                } else {
                  testSpinner.stop(`Failed: ${testResult.error}`)
                  const action = exitOnCancel(await p.select({
                    message: 'What would you like to do?',
                    options: [
                      { value: 'retry', label: 'Enter a different API key' },
                      { value: 'skip', label: 'Skip setup' },
                    ],
                  })) as 'retry' | 'skip'
                  if (action === 'skip') keyConfigured = true
                }
              }
            }
          } else {
            spinner.stop(`${providerName} plugin reinstalled`)
            let keyConfigured = false
            while (!keyConfigured) {
              const apiKey = exitOnCancel(await p.password({
                message: provider === 'exa' ? 'Exa API key (from dashboard.exa.ai)' : 'Brave API key (from api-dashboard.search.brave.com)',
                validate: (value) => value ? undefined : 'API key is required',
              }))

              const testSpinner = p.spinner()
              testSpinner.start(`Testing ${providerName} connection...`)
              const testResult = provider === 'exa' ? await testExaConnection(apiKey) : await testBraveConnection(apiKey)

              if (testResult.success) {
                testSpinner.stop('Connected successfully')
                await setPluginApiKey(pluginName, provider === 'exa' ? 'EXA_API_KEY' : 'BRAVE_API_KEY', apiKey, profileName)
                p.log.success(provider === 'exa' ? 'Tools: get_code_context_exa, web_search_exa, web_fetch_exa' : 'Tools: brave_web_search, brave_llm_context_search, brave_news_search')
                anyMcpConfigured = true
                keyConfigured = true
              } else {
                testSpinner.stop(`Failed: ${testResult.error}`)
                const action = exitOnCancel(await p.select({
                  message: 'What would you like to do?',
                  options: [
                    { value: 'retry', label: 'Enter a different API key' },
                    { value: 'skip', label: 'Skip setup' },
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
      // Not installed - test API key first
      let configured = false
      const providedKey = provider === 'exa' ? options.exaKey : options.braveKey

      while (!configured) {
        let apiKey: string
        if (providedKey && options.yes) {
          apiKey = providedKey
          p.log.info(`Using provided ${providerName} API key`)
        } else {
          apiKey = exitOnCancel(await p.password({
            message: provider === 'exa' ? 'Exa API key (from dashboard.exa.ai)' : 'Brave API key (from api-dashboard.search.brave.com)',
            validate: (value) => value ? undefined : 'API key is required',
          }))
        }

        const testSpinner = p.spinner()
        testSpinner.start(`Testing ${providerName} connection...`)

        const testResult = provider === 'exa' ? await testExaConnection(apiKey) : await testBraveConnection(apiKey)

        if (testResult.success) {
          testSpinner.stop('Connected successfully')

          const installSpinner = p.spinner()
          installSpinner.start(`Installing ${providerName} plugin...`)
          const result = await installPlugin(pluginName)
          if (result.success) {
            const keyResult = await setPluginApiKey(pluginName, provider === 'exa' ? 'EXA_API_KEY' : 'BRAVE_API_KEY', apiKey, profileName)
            if (keyResult.success) {
              installSpinner.stop(`${providerName} plugin installed`)
              p.log.success(provider === 'exa' ? 'Tools: get_code_context_exa, web_search_exa, web_fetch_exa' : 'Tools: brave_web_search, brave_llm_context_search, brave_news_search')
              anyMcpConfigured = true
              configured = true
            } else {
              installSpinner.stop(`Installed but failed to set API key: ${keyResult.error}`)
              configured = true
            }
          } else {
            installSpinner.stop(`Failed: ${result.error}`)
            configured = true
          }
        } else {
          testSpinner.stop(`Failed: ${testResult.error}`)

          if (options.yes) {
            p.log.error(`${providerName} API key validation failed in non-interactive mode`)
            configured = true
          } else {
            const action = exitOnCancel(await p.select({
              message: 'What would you like to do?',
              options: [
                { value: 'retry', label: 'Enter a different API key' },
                { value: 'skip', label: 'Skip setup' },
              ],
            })) as 'retry' | 'skip'
            if (action === 'skip') configured = true
          }
        }
      }
    }
  }

  // Ask about disabling CCS websearch
  const recommendDisable = anyMcpConfigured
  p.log.step(`CCS Built-in Web Search ${recommendDisable ? '(recommended: disable)' : ''}`)

  let disableWebsearch: boolean
  if (options.yes) {
    // In non-interactive mode, disable if any MCP plugins were configured
    disableWebsearch = anyMcpConfigured
    if (disableWebsearch) {
      p.log.info('Auto-disabling CCS built-in websearch (custom plugins configured)')
    }
  } else {
    if (anyMcpConfigured) {
      p.log.message('You have installed custom web search plugins (Exa/Brave).\nDisable CCS built-in websearch to avoid duplicate results.')
    } else {
      p.log.message('No custom web search plugins were installed.\nKeeping CCS built-in websearch enabled.')
    }

    disableWebsearch = exitOnCancel(await p.confirm({
      message: `Disable CCS built-in web search?${recommendDisable ? ' (recommended: yes)' : ''}`,
      initialValue: anyMcpConfigured,
    }))
  }

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
  p.note(pc.greenBright(`ccs ${profileName}`), 'Run this to start Claude Code with on-prem LLM')
  p.outro('Happy coding!')
}
