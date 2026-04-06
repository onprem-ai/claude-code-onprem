import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

export async function readJsonFile<T = unknown>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

export async function readYamlFile<T = unknown>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, 'utf-8')
    return parseYaml(content) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function writeYamlFile(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, stringifyYaml(data), 'utf-8')
}

export function mergeConfig<T extends Record<string, unknown>>(
  existing: T | null,
  updates: Partial<T>
): T {
  if (!existing) {
    return updates as T
  }

  const result = { ...existing }

  for (const key in updates) {
    const existingValue = result[key]
    const updateValue = updates[key]

    if (
      updateValue !== null &&
      typeof updateValue === 'object' &&
      !Array.isArray(updateValue) &&
      existingValue !== null &&
      typeof existingValue === 'object' &&
      !Array.isArray(existingValue)
    ) {
      result[key] = mergeConfig(
        existingValue as Record<string, unknown>,
        updateValue as Record<string, unknown>
      ) as T[Extract<keyof T, string>]
    } else {
      result[key] = updateValue as T[Extract<keyof T, string>]
    }
  }

  return result
}
