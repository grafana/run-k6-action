import { glob } from 'node:fs/promises'
import { matchesGlob } from 'node:path'

import * as fs from 'fs-extra'

/**
 * Checks if a given path is a directory.
 *
 * @param {string} filepath - The path to check.
 * @returns {boolean} - True if the path is a directory, false otherwise.
 */
export function isDirectory(filepath: string): boolean {
  try {
    return fs.statSync(filepath).isDirectory()
  } catch {
    // Ignore error
    return false
  }
}

/**
 * Finds all test files in a given path.
 *
 * @param {string} path - The path to search for tests.
 * @returns {Promise<string[]>} - A promise that resolves to an array of test file paths.
 */
export async function findTestsToRun(path: string): Promise<string[]> {
  const lines = path
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const includes = lines.filter((l) => !l.startsWith('!'))
  const excludes = lines
    .filter((l) => l.startsWith('!'))
    .map((l) => l.slice(1).trim())

  const seen = new Set<string>()
  const files: string[] = []
  for (const pattern of includes) {
    for await (const file of glob(pattern)) {
      if (
        !seen.has(file) &&
        !isDirectory(file) &&
        !excludes.some((ex) => matchesGlob(file, ex))
      ) {
        seen.add(file)
        files.push(file)
      }
    }
  }
  return files
}
