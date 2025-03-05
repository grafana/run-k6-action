// Common helper functions used in the action
import * as core from '@actions/core'
import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import { parseK6Output } from './k6OutputParser'
import {
  BrowserMetricSummary,
  MetricsSummary,
  TestRunSummary,
  TestRunUrlsMap,
  TrendSummary,
} from './types'
import { formatFloat, formatNumber } from './utils'

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

export async function fetchTestRunSummary(
  testRunId: string
): Promise<TestRunSummary | undefined> {
  const baseUrl = process.env.K6_CLOUD_BASE_URL || 'https://api.k6.io/cloud/v5'

  const url = `${baseUrl}/test_runs(${testRunId})/result_summary?$select=metrics_summary`

  const response = await fetch(url, {
    headers: {
      Authorization: `Token ${process.env.K6_CLOUD_TOKEN}`,
    },
  })

  if (!response.ok) {
    core.info(
      `Failed to fetch test run summary for test run ${testRunId}: Status code: ${response.status} - ${response.statusText}`
    )
    core.info(`Response: ${await response.text()}`)
    return undefined
  }

  const data = await response.json()
  return data as TestRunSummary
}

function getTrendSummaryMarkdown(
  trendSummary: TrendSummary | null | undefined,
  title: string
): string {
  if (!trendSummary) return ''

  const trendSummaryStrings = []

  trendSummaryStrings.push(title)
  trendSummaryStrings.push(
    `  - ⬇️ Minimum: <b>${formatFloat(trendSummary.min, 'ms')}</b> ⬆️ Maximum: <b>${formatFloat(trendSummary.max, 'ms')}</b>`
  )
  trendSummaryStrings.push(
    `  - ⏺️ Average: <b>${formatFloat(trendSummary.mean, 'ms')}</b> 🔀 Standard Deviation: <b>${formatFloat(trendSummary.stdev, 'ms')}</b> `
  )
  trendSummaryStrings.push(
    `  - 🔝 P95: <b>${formatFloat(trendSummary.p95, 'ms')}</b> 🚀 P99: <b>${formatFloat(trendSummary.p99, 'ms')}</b> `
  )
  return trendSummaryStrings.join('\n')
}

/**
 * Generates a markdown summary from metrics data
 */
export function generateMetricsSummaryMarkdown(
  metricsSummary: MetricsSummary | null | undefined
): string {
  if (!metricsSummary) return 'No metrics data available.'

  const markdownSections: string[] = []

  const httpMetrics = metricsSummary.http_metric_summary
  const wsMetrics = metricsSummary.ws_metric_summary
  const grpcMetrics = metricsSummary.grpc_metric_summary
  const checksMetrics = metricsSummary.checks_metric_summary
  const thresholdsMetrics = metricsSummary.thresholds_summary
  const browserMetrics = metricsSummary.browser_metric_summary

  // Checks Summary
  if (checksMetrics && Object.keys(checksMetrics).length > 0) {
    if (checksMetrics.total != null && checksMetrics.total > 0) {
      if (
        checksMetrics.successes != null &&
        checksMetrics.successes < checksMetrics.total
      ) {
        markdownSections.push(
          `- ❌ **${formatNumber(checksMetrics.total - checksMetrics.successes)}** out of **${formatNumber(checksMetrics.total)}** checks were not successful.`
        )
      } else {
        markdownSections.push(
          `-✅ All **${formatNumber(checksMetrics.total)}** checks were successful.`
        )
      }
    }
  }

  // Thresholds Summary
  if (thresholdsMetrics && Object.keys(thresholdsMetrics).length > 0) {
    if (thresholdsMetrics.total != null && thresholdsMetrics.total > 0) {
      if (
        thresholdsMetrics.successes != null &&
        thresholdsMetrics.successes < thresholdsMetrics.total
      ) {
        markdownSections.push(
          `- ❌ **${formatNumber(thresholdsMetrics.total - thresholdsMetrics.successes)}** out of **${formatNumber(thresholdsMetrics.total)}** thresholds were not met.`
        )
      } else {
        markdownSections.push(
          `- ✅ All **${formatNumber(thresholdsMetrics.total)}** thresholds were met.`
        )
      }
    }
  }

  // HTTP Metrics
  if (httpMetrics && Object.keys(httpMetrics).length > 0) {
    markdownSections.push(`### 🌐 HTTP Metrics`)
    markdownSections.push('')
    markdownSections.push(
      `- ⏳ 95th Percentile Response Time: **${formatFloat(httpMetrics.duration?.p95, 'ms')}** ⚡`
    )
    markdownSections.push(
      `- 🔢  Total Requests: **${formatNumber(httpMetrics.requests_count)}**`
    )
    markdownSections.push(
      `- ⚠️ Failed Requests: **${formatNumber(httpMetrics.failures_count)}**`
    )
    markdownSections.push(
      `- 🚀 Average Request Rate: **${formatFloat(httpMetrics.rps_mean)}**`
    )
    markdownSections.push(
      `- 🔝 Peak RPS: **${formatFloat(httpMetrics.rps_max)}**`
    )
    markdownSections.push(
      `- ${getTrendSummaryMarkdown(httpMetrics.duration, '🕒 Request Duration')}`
    )
    markdownSections.push('')
  }

  // WebSocket Metrics
  if (wsMetrics && Object.keys(wsMetrics).length > 0) {
    markdownSections.push(`### 🔌 WebSocket Metrics`)
    markdownSections.push('')
    markdownSections.push(
      `- 📤 Messages Sent: **${formatNumber(wsMetrics.msgs_sent)}**`
    )
    markdownSections.push(
      `- 📥 Messages Received: **${formatNumber(wsMetrics.msgs_received)}**`
    )
    markdownSections.push(
      `- 👥 Total Sessions: **${formatNumber(wsMetrics.sessions)}**`
    )
    markdownSections.push(
      `- ${getTrendSummaryMarkdown(wsMetrics.session_duration, '⏱️ Session Duration')}`
    )
    markdownSections.push(
      `- ${getTrendSummaryMarkdown(wsMetrics.connecting, '🔌 Connection Time')}`
    )
    markdownSections.push('')
  }

  // gRPC Metrics
  if (grpcMetrics && Object.keys(grpcMetrics).length > 0) {
    markdownSections.push(`### 📡 gRPC Metrics`)
    markdownSections.push('')
    markdownSections.push(
      `The 95th percentile response time of the system being tested was **${formatFloat(grpcMetrics.duration?.p95)}** and **${formatNumber(grpcMetrics.requests_count)}** requests were made at an average request rate of **${formatFloat(grpcMetrics.rps_mean)}** requests/second.`
    )
    markdownSections.push('<details>')
    markdownSections.push('<summary><strong>gRPC Metrics</strong></summary>\n')
    markdownSections.push('| Metric | Value |')
    markdownSections.push('|--------|-------|')
    markdownSections.push(
      `| Total Requests | ${formatNumber(grpcMetrics.requests_count)} |`
    )
    markdownSections.push(
      `| Average RPS | ${formatFloat(grpcMetrics.rps_mean)} |`
    )
    markdownSections.push(`| Peak RPS | ${formatFloat(grpcMetrics.rps_max)} |`)

    const durationMean = grpcMetrics.duration?.mean
    markdownSections.push(
      `| Average Duration | ${formatFloat(durationMean, 'ms')} |`
    )
    markdownSections.push('</details>\n')
  }
  // Browser Metrics
  if (browserMetrics && Object.keys(browserMetrics).length > 0) {
    markdownSections.push(`### 🖥️ Browser Metrics`)
    markdownSections.push('')
    markdownSections.push('<details>')
    markdownSections.push(
      '<summary><strong>Browser Metrics</strong></summary>\n'
    )
    markdownSections.push('| Metric | Value |')
    markdownSections.push('|--------|-------|')
    markdownSections.push(
      `| Data Received | ${formatNumber(browserMetrics.browser_data_received)} |`
    )
    markdownSections.push(
      `| Data Sent | ${formatNumber(browserMetrics.browser_data_sent)} |`
    )
    markdownSections.push(
      `| HTTP Requests | ${formatNumber(browserMetrics.http_request_count)} |`
    )
    markdownSections.push(
      `| HTTP Failures | ${formatNumber(browserMetrics.http_failure_count)} |`
    )

    // Web Vitals
    const vitals = ['cls', 'fcp', 'fid', 'inp', 'lcp', 'ttfb']
    for (const vital of vitals) {
      const vitalP75 =
        browserMetrics[`web_vital_${vital}_p75` as keyof BrowserMetricSummary]
      markdownSections.push(
        `| ${vital.toUpperCase()} p75 | ${formatFloat(vitalP75 as number | undefined, 'ms')} |`
      )
    }
    markdownSections.push('</details>\n')
  }

  return markdownSections.length
    ? markdownSections.join('\n')
    : 'No metrics data available.'
}

export function getMarkdownStringForTestRunStatus(
  testRunStatus: number | undefined
): string {
  let statusString = ''

  if (testRunStatus === undefined || testRunStatus === null) {
    statusString = '❓ Unknown'
  } else if (testRunStatus === 3) {
    statusString = '✅ Passed'
  } else if (testRunStatus === 4) {
    statusString = '⚠️ Timed out'
  } else {
    statusString = '❌ Failed'
  }

  return `- **Overall Status:** ${statusString}`
}
