// Common helper functions used in the action
import * as core from '@actions/core'
import { ChildProcess, execSync, spawn } from 'child_process'
import path from 'path'
import { apiRequest, DEFAULT_RETRY_OPTIONS } from './apiUtils'
import { parseK6Output } from './k6OutputParser'
import { Check, ChecksResponse, TestRunSummary, TestRunUrlsMap } from './types'

function getK6CloudBaseUrl(): string {
  return process.env.K6_CLOUD_BASE_URL || 'https://api.k6.io'
}

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
  let command = 'k6 run'
  const args = [`--address=`, ...(flags ? flags.split(' ') : [])]

  // Cloud execution is possible for the test
  if (isCloud) {
    // Get the current k6 version
    const k6Version = getInstalledK6Version()
    // In k6 v0.54.0 and later, `k6 cloud run` is the command to use
    // https://github.com/grafana/k6/blob/20369d707f5ee6d7fd8a995972ccdd6b86db2b5d/release%20notes/v0.54.0.md?plain=1#L122
    if (isVersionAtLeast(k6Version, '0.54.0')) {
      command = 'k6 cloud run';
      if (cloudRunLocally) {
          // Execute tests locally and upload results to cloud
          args.push(`--local-execution`);
      }
    } else {
      if (cloudRunLocally) {
        args.push('--out=cloud')
      } else {
        // Execute tests in cloud
        command = 'k6 cloud'
      }
    }
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
  const baseUrl = getK6CloudBaseUrl()
  const url = `${baseUrl}/cloud/v5/test_runs(${testRunId})/result_summary?$select=metrics_summary,baseline_test_run_details`

  return apiRequest<TestRunSummary>(
    url,
    {},
    {
      ...DEFAULT_RETRY_OPTIONS,
      backoffFactor: 3,
      maxRetries: 5,
    }
  )
}

/**
 * Fetches the checks for a test run from the Grafana Cloud K6 API.
 * Uses retry mechanism with exponential backoff for reliability.
 * Will automatically retry on transient errors and server errors, but not on client errors like 404 or 401.
 *
 * @param {string} testRunId - The ID of the test run to fetch checks for
 * @returns {Promise<Check[]>} Array of checks or empty array if there was an error
 */
export async function fetchChecks(testRunId: string): Promise<Check[]> {
  const baseUrl = getK6CloudBaseUrl()
  const url = `${baseUrl}/loadtests/v4/test_runs(${testRunId})/checks?$select=name,metric_summary&$filter=group_id eq null`

  const response = await apiRequest<ChecksResponse>(
    url,
    {},
    {
      ...DEFAULT_RETRY_OPTIONS,
      backoffFactor: 3,
      maxRetries: 5,
    }
  )

  // If the API request fails, return an empty array
  if (!response) {
    return []
  }

  // Return the checks array from the response
  return response.value
}

/**
 * Extracts the semantic version (e.g., "0.56.0") from the full k6 version string which looks like
 * `k6 v0.56.0 (go1.23.4, darwin/arm64)`.
 *
 * @param {string} versionString - The full version string from k6 version command
 * @returns {string} The semantic version or empty string if not found
 */
export function extractK6SemVer(versionString: string): string {
  // Match pattern like "v0.56.0" and extract just the digits and dots
  const match = versionString.match(/v(\d+\.\d+\.\d+)/)
  return match ? match[1] : ''
}

/**
 * Gets the installed k6 version using the `k6 version` command.
 *
 * @returns The installed k6 version as a semantic version string
 */
export function getInstalledK6Version(): string {
  try {
    // Use execSync for synchronous output capture
    const output = execSync('k6 version').toString().trim()

    // Return only the semantic version if requested
    return extractK6SemVer(output)
  } catch (error) {
    console.error('Error executing k6 version:', error)
    return ''
  }
}

/**
 * Compares two semantic version strings and checks if version1 is at least (greater than or equal to) version2.
 *
 * @param {string} version1 - The first version string (e.g., "0.56.0")
 * @param {string} version2 - The second version string (e.g., "0.55.0")
 * @returns {boolean} True if version1 is at least version2, false otherwise
 */
export function isVersionAtLeast(
  version1: string,
  version2: string
): boolean {
  // Check that both versions are valid and have the same number of segments
  if (!version1 || !version2) {
    throw new Error('Both version strings must be provided')
  }

  const version1Segments = version1.split('.')
  const version2Segments = version2.split('.')
  if (version1Segments.length !== version2Segments.length) {
    throw new Error(
      'Both version strings must have the same number of segments'
    )
  }

  // Solution from https://stackoverflow.com/questions/6832596/how-can-i-compare-software-version-number-using-javascript-only-numbers/65687141#65687141
  // We can use this because we always have the same number of digits in the versions
  const result = version1.localeCompare(version2, undefined, {
    numeric: true,
    sensitivity: 'base',
  })

  return result >= 0
}