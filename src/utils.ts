import * as glob from '@actions/glob'

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
  const globber = await glob.create(path)
  const files = await globber.glob()
  return files.filter((file) => !isDirectory(file))
}
