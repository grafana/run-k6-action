// Common helper functions used in the action
import * as core from '@actions/core'
import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import { apiRequest } from './apiUtils'
import { parseK6Output } from './k6OutputParser'
import { TestRunSummary, TestRunUrlsMap } from './types'

/**
 * Validates the test paths by running `k6 inspect --execution-requirements` on each test file.
 * A test path is considered valid if the command returns an exit code of 0.
 *
 * @export
 * @param {string[]} testPaths - List of test paths to validate
 * @return {Promise<string[]>} - List of valid test paths
 */
export async function validateTestPaths(
  testPaths: string[],
  flags: string[]
): Promise<string[]> {
  if (testPaths.length === 0) {
    throw new Error('No test files found')
  }

  console.log(`🔍 Validating test run files.`)

  const validK6TestPaths: string[] = [],
    command = 'k6',
    defaultArgs = ['inspect', '--execution-requirements', ...flags]

  const allPromises = [] as Promise<void>[]

  testPaths.forEach(async (testPath) => {
    const args = [...defaultArgs, testPath]

    const child = spawn(command, args, {
      stdio: ['inherit', 'ignore', 'inherit'], // 'ignore' is for stdout
      detached: false,
    })

    allPromises.push(
      new Promise<void>((resolve) => {
        child.on('exit', (code: number) => {
          if (code === 0) {
            validK6TestPaths.push(testPath)
          }
          resolve()
        })
      })
    )
  })

  await Promise.all(allPromises)

  return validK6TestPaths
}

/**
 * Cleans the script path by:
 * 1. Removing the base directory prefix if present
 * 2. Normalizing path separators for the current OS
 * 3. Removing any leading slashes
 * 4. Ensuring consistent formatting
 *
 * @export
 * @param {string} scriptPath - The script path to clean
 * @return {string} - Cleaned script path
 */
export function cleanScriptPath(scriptPath: string): string {
  const baseDir = process.env['GITHUB_WORKSPACE'] || ''

  // Normalize paths to ensure consistent separators
  const normalizedScriptPath = path.normalize(scriptPath)
  const normalizedBaseDir = path.normalize(baseDir)

  // Remove base directory if present
  let cleanedPath = normalizedScriptPath
  if (normalizedBaseDir && normalizedScriptPath.startsWith(normalizedBaseDir)) {
    cleanedPath = normalizedScriptPath.substring(normalizedBaseDir.length)
  }

  // Remove leading separator(s) if present
  while (cleanedPath.startsWith(path.sep)) {
    cleanedPath = cleanedPath.substring(1)
  }

  // Ensure consistent path format
  cleanedPath = cleanedPath.trim()

  return cleanedPath
}

/**
 * Checks if the cloud integration is enabled by checking if the K6_CLOUD_TOKEN and K6_CLOUD_PROJECT_ID are set.
 *
 * @export
 * @return {boolean} - True if the cloud integration is enabled, false otherwise
 */
export function isCloudIntegrationEnabled(): boolean {
  if (
    process.env.K6_CLOUD_TOKEN === undefined ||
    process.env.K6_CLOUD_TOKEN === ''
  ) {
    return false
  }

  if (
    process.env.K6_CLOUD_PROJECT_ID === undefined ||
    process.env.K6_CLOUD_PROJECT_ID === ''
  ) {
    throw new Error(
      'K6_CLOUD_PROJECT_ID must be set when K6_CLOUD_TOKEN is set'
    )
  }

  return true
}

/**
 * Generates a command for running k6 tests.
 *
 * @param path - The path to the test file.
 * @param flags - The flags to pass to k6.
 * @param isCloud - Whether the test is running in the cloud.
 * @param cloudRunLocally - Whether to run the test locally and upload results to cloud.
 *
 * @returns The generated command.
 */
export function generateK6RunCommand(
  path: string,
  flags: string,
  isCloud: boolean,
  cloudRunLocally: boolean
): string {
  let command
  const args = [`--address=`, ...(flags ? flags.split(' ') : [])]

  if (isCloud) {
    // Cloud execution is possible for the test
    if (cloudRunLocally) {
      // Execute tests locally and upload results to cloud
      command = 'k6 run'
      args.push(`--out=cloud`)
    } else {
      // Execute tests in cloud
      command = 'k6 cloud'
    }
  } else {
    // Local execution
    command = 'k6 run'
  }

  // Add path the arguments list
  args.push(path)

  // Append arguments to the command
  command = `${command} ${args.join(' ')}`

  core.debug('🤖 Generated command: ' + command)
  return command
}

export function executeRunK6Command(
  command: string,
  totalTestRuns: number,
  testResultUrlsMap: TestRunUrlsMap,
  debug: boolean
): ChildProcess {
  const parts = command.split(' ')
  const cmd = parts[0]
  const args = parts.slice(1)

  console.log(`🤖 Running test: ${cmd} ${args.join(' ')}`)
  const child = spawn(cmd, args, {
    stdio: ['inherit'],
    detached: true,
    env: process.env,
  })

  // Parse k6 command output and extract test run URLs if running in cloud mode.
  // Also, print the output to the console, excluding the progress lines.
  child.stdout?.on('data', (data) =>
    parseK6Output(data, testResultUrlsMap, totalTestRuns, debug)
  )
  child.stderr?.on('data', (data) =>
    process.stderr.write(`🚨 ${data.toString()}`)
  )

  return child
}

/**
 * Extracts the test run ID from a Grafana Cloud K6 URL.
 *
 * @param {string} testRunUrl - The URL of the test run (e.g., https://xxx.grafana.net/a/k6-app/runs/4050582)
 * @returns {string | null} - The test run ID or null if not found
 */
export function extractTestRunId(testRunUrl: string): string | null {
  const match = testRunUrl.match(/\/runs\/(\d+)$/)
  return match ? match[1] : null
}

/**
 * Fetches the test run summary from the Grafana Cloud K6 API.
 * Uses retry mechanism with exponential backoff for reliability.
 * Will automatically retry on transient errors and server errors, but not on client errors like 404 or 401.
 *
 * @param {string} testRunId - The ID of the test run to fetch the summary for
 * @returns {TestRunSummary | undefined} The test run summary or undefined if there was an error
 */
export async function fetchTestRunSummary(
  testRunId: string
): Promise<TestRunSummary | undefined> {
  const baseUrl = process.env.K6_CLOUD_BASE_URL || 'https://api.k6.io/cloud/v5'
  const url = `${baseUrl}/test_runs(${testRunId})/result_summary?$select=metrics_summary`

  return apiRequest<TestRunSummary>(url)
}
