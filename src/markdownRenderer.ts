import { isNumber } from '@latest-version/orval-core'
import {
  BrowserMetricSummary,
  Check,
  ChecksMetricSummary,
  GrpcMetricSummary,
  HttpMetricSummary,
  MetricsSummary,
  ThresholdsSummary,
  TrendSummary,
  WsMetricSummary,
} from './types'

/**
 * Formats a number with commas as thousand separators
 * @param value The number to format, or undefined
 * @param defaultValue The default value to return if value is undefined
 * @returns Formatted number string
 */
export function formatNumber(
  value?: number,
  defaultValue: string = '0'
): string {
  if (value === undefined || value === null) {
    return defaultValue
  }
  return value.toLocaleString()
}

/**
 * Formats a float with optional unit
 * @param value The float to format, or undefined
 * @param unit Optional unit to append (e.g., 'ms')
 * @param defaultValue The default value to return if value is undefined
 * @returns Formatted float string with unit
 */
export function formatFloat(
  value?: number,
  unit: string = '',
  defaultValue: string = '0'
): string {
  if (value === undefined || value === null) {
    return defaultValue
  }
  const formattedValue = value.toFixed(2)
  return unit ? `${formattedValue} ${unit}` : formattedValue
}

/**
 * Generates markdown for trend summary data
 * @param trendSummary The trend summary data
 * @param title The title for the trend summary section
 * @param baselineTrendSummary The baseline trend summary data
 * @returns Markdown string for the trend summary
 */
export function getTrendSummaryMarkdown(
  trendSummary: TrendSummary | null | undefined,
  title: string,
  baselineTrendSummary?: TrendSummary | null
): string {
  if (!trendSummary) return ''

  const trendSummaryStrings = []

  trendSummaryStrings.push(title)
  trendSummaryStrings.push(
    `  - ⬇️ Minimum: <b>${formatFloat(trendSummary.min, 'ms')}</b>${baselineTrendSummary ? getPercentageChange(trendSummary.min, baselineTrendSummary.min) : ''} ⬆️ Maximum: <b>${formatFloat(trendSummary.max, 'ms')}</b>${baselineTrendSummary ? getPercentageChange(trendSummary.max, baselineTrendSummary.max) : ''}`
  )
  trendSummaryStrings.push(
    `  - ⏺️ Average: <b>${formatFloat(trendSummary.mean, 'ms')}</b>${baselineTrendSummary ? getPercentageChange(trendSummary.mean, baselineTrendSummary.mean) : ''} 🔀 Standard Deviation: <b>${formatFloat(trendSummary.stdev, 'ms')}</b>${baselineTrendSummary ? getPercentageChange(trendSummary.stdev, baselineTrendSummary.stdev) : ''} `
  )
  trendSummaryStrings.push(
    `  - 🔝 P95: <b>${formatFloat(trendSummary.p95, 'ms')}</b>${baselineTrendSummary ? getPercentageChange(trendSummary.p95, baselineTrendSummary.p95) : ''} 🚀 P99: <b>${formatFloat(trendSummary.p99, 'ms')}</b>${baselineTrendSummary ? getPercentageChange(trendSummary.p99, baselineTrendSummary.p99) : ''} `
  )
  return trendSummaryStrings.join('\n')
}

/**
 * Generates markdown for HTTP metrics
 * @param httpMetrics HTTP metrics data
 * @returns Markdown string for HTTP metrics
 */
export function getHttpMetricsMarkdown(
  httpMetrics: HttpMetricSummary | null,
  baselineHttpMetrics?: HttpMetricSummary | null
): string[] {
  if (!httpMetrics || Object.keys(httpMetrics).length === 0) {
    return []
  }

  const markdownSections = []

  markdownSections.push(`### 🌐 HTTP Metrics`)
  markdownSections.push('')
  markdownSections.push(
    `- ⏳ 95th Percentile Response Time: **${formatFloat(httpMetrics.duration?.p95, 'ms')}**${baselineHttpMetrics?.duration ? getPercentageChange(httpMetrics.duration?.p95, baselineHttpMetrics.duration?.p95) : ''} ⚡`
  )
  markdownSections.push(
    `- 🔢  Total Requests: **${formatNumber(httpMetrics.requests_count)}**${baselineHttpMetrics ? getPercentageChange(httpMetrics.requests_count, baselineHttpMetrics.requests_count, true) : ''}`
  )
  markdownSections.push(
    `- ⚠️ Failed Requests: **${formatNumber(httpMetrics.failures_count)}**${baselineHttpMetrics ? getPercentageChange(httpMetrics.failures_count, baselineHttpMetrics.failures_count) : ''}`
  )
  markdownSections.push(
    `- 🚀 Average Request Rate: **${formatFloat(httpMetrics.rps_mean)}**${baselineHttpMetrics ? getPercentageChange(httpMetrics.rps_mean, baselineHttpMetrics.rps_mean, true) : ''}`
  )
  markdownSections.push(
    `- 🔝 Peak RPS: **${formatFloat(httpMetrics.rps_max)}**${baselineHttpMetrics ? getPercentageChange(httpMetrics.rps_max, baselineHttpMetrics.rps_max, true) : ''}`
  )
  markdownSections.push(
    `- ${getTrendSummaryMarkdown(httpMetrics.duration, '🕒 Request Duration', baselineHttpMetrics?.duration)}`
  )
  markdownSections.push('')

  return markdownSections
}

/**
 * Generates markdown for WebSocket metrics
 * @param wsMetrics WebSocket metrics data
 * @returns Markdown string for WebSocket metrics
 */
export function getWebSocketMetricsMarkdown(
  wsMetrics: WsMetricSummary | null,
  baselineWsMetrics?: WsMetricSummary | null
): string[] {
  if (!wsMetrics || Object.keys(wsMetrics).length === 0) {
    return []
  }

  const markdownSections = []

  markdownSections.push(`### 🔌 WebSocket Metrics`)
  markdownSections.push('')
  markdownSections.push(
    `- 📤 Messages Sent: **${formatNumber(wsMetrics.msgs_sent)}**${baselineWsMetrics ? getPercentageChange(wsMetrics.msgs_sent, baselineWsMetrics.msgs_sent, true) : ''}`
  )
  markdownSections.push(
    `- 📥 Messages Received: **${formatNumber(wsMetrics.msgs_received)}**${baselineWsMetrics ? getPercentageChange(wsMetrics.msgs_received, baselineWsMetrics.msgs_received, true) : ''}`
  )
  markdownSections.push(
    `- 👥 Total Sessions: **${formatNumber(wsMetrics.sessions)}**${baselineWsMetrics ? getPercentageChange(wsMetrics.sessions, baselineWsMetrics.sessions, true) : ''}`
  )
  markdownSections.push(
    `- ${getTrendSummaryMarkdown(wsMetrics.session_duration, '⏱️ Session Duration', baselineWsMetrics?.session_duration)}`
  )
  markdownSections.push(
    `- ${getTrendSummaryMarkdown(wsMetrics.connecting, '🔌 Connection Time', baselineWsMetrics?.connecting)}`
  )
  markdownSections.push('')

  return markdownSections
}

/**
 * Generates markdown for gRPC metrics
 * @param grpcMetrics gRPC metrics data
 * @returns Markdown string for gRPC metrics
 */
export function getGrpcMetricsMarkdown(
  grpcMetrics: GrpcMetricSummary | null,
  baselineGrpcMetrics?: GrpcMetricSummary | null
): string[] {
  if (!grpcMetrics || Object.keys(grpcMetrics).length === 0) {
    return []
  }

  const markdownSections = []

  markdownSections.push(`### 📡 gRPC Metrics`)
  markdownSections.push('')
  markdownSections.push(
    `The 95th percentile response time of the system being tested was **${formatFloat(grpcMetrics.duration?.p95)}**${baselineGrpcMetrics?.duration ? getPercentageChange(grpcMetrics.duration?.p95, baselineGrpcMetrics.duration?.p95) : ''} and **${formatNumber(grpcMetrics.requests_count)}**${baselineGrpcMetrics ? getPercentageChange(grpcMetrics.requests_count, baselineGrpcMetrics.requests_count, true) : ''} requests were made at an average request rate of **${formatFloat(grpcMetrics.rps_mean)}**${baselineGrpcMetrics ? getPercentageChange(grpcMetrics.rps_mean, baselineGrpcMetrics.rps_mean, true) : ''} requests/second.`
  )
  markdownSections.push('<details>')
  markdownSections.push('<summary><strong>gRPC Metrics</strong></summary>\n')
  markdownSections.push('| Metric | Value |')
  markdownSections.push('|--------|-------|')
  markdownSections.push(
    `| Total Requests | ${formatNumber(grpcMetrics.requests_count)}${baselineGrpcMetrics ? getPercentageChange(grpcMetrics.requests_count, baselineGrpcMetrics.requests_count, true) : ''} |`
  )
  markdownSections.push(
    `| Average RPS | ${formatFloat(grpcMetrics.rps_mean)}${baselineGrpcMetrics ? getPercentageChange(grpcMetrics.rps_mean, baselineGrpcMetrics.rps_mean, true) : ''} |`
  )
  markdownSections.push(
    `| Peak RPS | ${formatFloat(grpcMetrics.rps_max)}${baselineGrpcMetrics ? getPercentageChange(grpcMetrics.rps_max, baselineGrpcMetrics.rps_max, true) : ''} |`
  )

  const durationMean = grpcMetrics.duration?.mean
  const baselineDurationMean = baselineGrpcMetrics?.duration?.mean
  markdownSections.push(
    `| Average Duration | ${formatFloat(durationMean, 'ms')}${baselineDurationMean ? getPercentageChange(durationMean, baselineDurationMean) : ''} |`
  )
  markdownSections.push('</details>\n')

  return markdownSections
}

/**
 * Generates markdown for browser metrics
 * @param browserMetrics Browser metrics data
 * @returns Markdown string for browser metrics
 */
export function getBrowserMetricsMarkdown(
  browserMetrics: BrowserMetricSummary | null,
  baselineBrowserMetrics?: BrowserMetricSummary | null
): string[] {
  if (!browserMetrics || Object.keys(browserMetrics).length === 0) {
    return []
  }

  const markdownSections = []

  markdownSections.push(`### 🖥️ Browser Metrics`)
  markdownSections.push('')
  markdownSections.push('<details>')
  markdownSections.push('<summary><strong>Browser Metrics</strong></summary>\n')
  markdownSections.push('| Metric | Value |')
  markdownSections.push('|--------|-------|')
  markdownSections.push(
    `| Data Received | ${formatNumber(browserMetrics.browser_data_received)}${baselineBrowserMetrics ? getPercentageChange(browserMetrics.browser_data_received, baselineBrowserMetrics.browser_data_received, false) : ''} |`
  )
  markdownSections.push(
    `| Data Sent | ${formatNumber(browserMetrics.browser_data_sent)}${baselineBrowserMetrics ? getPercentageChange(browserMetrics.browser_data_sent, baselineBrowserMetrics.browser_data_sent, true) : ''} |`
  )
  markdownSections.push(
    `| HTTP Requests | ${formatNumber(browserMetrics.http_request_count)}${baselineBrowserMetrics ? getPercentageChange(browserMetrics.http_request_count, baselineBrowserMetrics.http_request_count, true) : ''} |`
  )
  markdownSections.push(
    `| HTTP Failures | ${formatNumber(browserMetrics.http_failure_count)}${baselineBrowserMetrics ? getPercentageChange(browserMetrics.http_failure_count, baselineBrowserMetrics.http_failure_count, false) : ''} |`
  )

  // Web Vitals
  const vitals = ['cls', 'fcp', 'fid', 'inp', 'lcp', 'ttfb']
  for (const vital of vitals) {
    const vitalKey = `web_vital_${vital}_p75` as keyof BrowserMetricSummary
    const vitalP75 = browserMetrics[vitalKey]
    const baselineVitalP75 = baselineBrowserMetrics
      ? baselineBrowserMetrics[vitalKey]
      : undefined

    // For CLS, lower is better, for others it depends on the specific metric
    const higherIsBetter = vital === 'cls' ? false : false

    markdownSections.push(
      `| ${vital.toUpperCase()} p75 | ${formatFloat(vitalP75 as number | undefined, 'ms')}${baselineVitalP75 ? getPercentageChange(vitalP75 as number | undefined, baselineVitalP75 as number | undefined, higherIsBetter) : ''} |`
    )
  }
  markdownSections.push('</details>\n')

  return markdownSections
}

/**
 * Generates markdown for checks metrics
 * @param checksMetrics Checks metrics data
 * @returns Markdown string for checks metrics
 */
export function getChecksMarkdown(
  checksMetrics: ChecksMetricSummary | null,
  checks: Check[] | null
): string[] {
  if (
    !checksMetrics ||
    Object.keys(checksMetrics).length === 0 ||
    checksMetrics.total == null ||
    checksMetrics.total <= 0
  ) {
    return []
  }

  const markdownSections = []

  if (
    isNumber(checksMetrics.successes) &&
    checksMetrics.successes < checksMetrics.total
  ) {
    markdownSections.push(
      `- ❌ **${formatNumber(checksMetrics.total - checksMetrics.successes)}** out of **${formatNumber(checksMetrics.total)}** checks were not successful.`
    )

    // Add checks that failed
    if (checks && checks.length > 0) {
      // Aggregate checks by name
      const checksByName: Record<
        string,
        { success_count: number; fail_count: number; total_count: number }
      > = {}

      // Group checks by name and aggregate metrics
      checks.forEach((check) => {
        const { name, metric_summary } = check
        if (!checksByName[name]) {
          checksByName[name] = {
            success_count: 0,
            fail_count: 0,
            total_count: 0,
          }
        }
        checksByName[name].success_count += metric_summary.success_count
        checksByName[name].fail_count += metric_summary.fail_count
        checksByName[name].total_count +=
          metric_summary.success_count + metric_summary.fail_count
      })
      // List failed checks (those with fail_count > 0)
      Object.entries(checksByName)
        .filter(([, metrics]) => metrics.fail_count > 0)
        .forEach(([name, metrics]) => {
          markdownSections.push(
            `  - \`${name}\`: Failed **${formatNumber(metrics.fail_count)}**, out of **${formatNumber(metrics.total_count)}** times.`
          )
        })
    }
  } else {
    markdownSections.push(
      `- ✅ All **${formatNumber(checksMetrics.total)}** checks were successful.`
    )
  }

  return markdownSections
}

/**
 * Generates markdown for thresholds metrics
 * @param thresholdsMetrics Thresholds metrics data
 * @returns Markdown string for thresholds metrics
 */
export function getThresholdsMarkdown(
  thresholdsMetrics: ThresholdsSummary | null
): string[] {
  if (
    !thresholdsMetrics ||
    Object.keys(thresholdsMetrics).length === 0 ||
    thresholdsMetrics.total == null ||
    thresholdsMetrics.total <= 0
  ) {
    return []
  }

  const markdownSections = []

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

  return markdownSections
}

/**
 * Returns a markdown string representing the test run status
 * @param testRunStatus The status code of the test run
 * @returns Markdown string for test run status
 */
export function getTestRunStatusMarkdown(
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

/**
 * Calculates percentage change between current and baseline values
 * @param current The current metric value
 * @param baseline The baseline metric value
 * @param higherIsBetter Whether a higher value is considered better (defaults to false)
 * @returns Formatted string with percentage change and direction icon
 */
export function getPercentageChange(
  current?: number,
  baseline?: number,
  higherIsBetter: boolean = false
): string {
  if (current === undefined || baseline === undefined || baseline === 0) {
    return ''
  }

  const percentChange = ((current - baseline) / baseline) * 100
  const absolutePercentChange = Math.abs(percentChange).toFixed(2)

  let icon, direction
  // For metrics where lower is better (like response time), a decrease is positive
  // For metrics where higher is better (like throughput), an increase is positive
  const isPositive = higherIsBetter ? percentChange > 0 : percentChange < 0
  if (current === baseline) {
    icon = '🔘'
    direction = ''
  } else {
    icon = isPositive ? '✅' : '❌'
    direction = percentChange > 0 ? '↑' : '↓'
  }

  return ` (${icon} ${direction} ${absolutePercentChange}%)`
}

/**
 * Generates a complete markdown summary from metrics data
 * @param metricsSummary The complete metrics summary object
 * @returns Markdown string for all metrics
 */
export function generateMarkdownSummary(
  metricsSummary: MetricsSummary | null | undefined,
  baselineTestRunMetricsSummary: MetricsSummary | null | undefined,
  checks: Check[] | null
): string {
  if (!metricsSummary) return 'No metrics data available.'

  const markdownSections: string[] = []

  // Add checks summary
  markdownSections.push(
    ...getChecksMarkdown(metricsSummary.checks_metric_summary, checks)
  )

  // Add thresholds summary
  markdownSections.push(
    ...getThresholdsMarkdown(metricsSummary.thresholds_summary)
  )

  // Add HTTP metrics
  markdownSections.push(
    ...getHttpMetricsMarkdown(
      metricsSummary.http_metric_summary,
      baselineTestRunMetricsSummary?.http_metric_summary
    )
  )

  // Add WebSocket metrics
  markdownSections.push(
    ...getWebSocketMetricsMarkdown(
      metricsSummary.ws_metric_summary,
      baselineTestRunMetricsSummary?.ws_metric_summary
    )
  )

  // Add gRPC metrics
  markdownSections.push(
    ...getGrpcMetricsMarkdown(
      metricsSummary.grpc_metric_summary,
      baselineTestRunMetricsSummary?.grpc_metric_summary
    )
  )

  // Add browser metrics
  markdownSections.push(
    ...getBrowserMetricsMarkdown(
      metricsSummary.browser_metric_summary,
      baselineTestRunMetricsSummary?.browser_metric_summary
    )
  )

  return markdownSections.length ? markdownSections.join('\n') : ''
}
