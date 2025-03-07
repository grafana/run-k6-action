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
 * @returns Markdown string for the trend summary
 */
export function getTrendSummaryMarkdown(
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
 * Generates markdown for HTTP metrics
 * @param httpMetrics HTTP metrics data
 * @returns Markdown string for HTTP metrics
 */
export function getHttpMetricsMarkdown(
  httpMetrics: HttpMetricSummary | null
): string[] {
  if (!httpMetrics || Object.keys(httpMetrics).length === 0) {
    return []
  }

  const markdownSections = []

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

  return markdownSections
}

/**
 * Generates markdown for WebSocket metrics
 * @param wsMetrics WebSocket metrics data
 * @returns Markdown string for WebSocket metrics
 */
export function getWebSocketMetricsMarkdown(
  wsMetrics: WsMetricSummary | null
): string[] {
  if (!wsMetrics || Object.keys(wsMetrics).length === 0) {
    return []
  }

  const markdownSections = []

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

  return markdownSections
}

/**
 * Generates markdown for gRPC metrics
 * @param grpcMetrics gRPC metrics data
 * @returns Markdown string for gRPC metrics
 */
export function getGrpcMetricsMarkdown(
  grpcMetrics: GrpcMetricSummary | null
): string[] {
  if (!grpcMetrics || Object.keys(grpcMetrics).length === 0) {
    return []
  }

  const markdownSections = []

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

  return markdownSections
}

/**
 * Generates markdown for browser metrics
 * @param browserMetrics Browser metrics data
 * @returns Markdown string for browser metrics
 */
export function getBrowserMetricsMarkdown(
  browserMetrics: BrowserMetricSummary | null
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
    checksMetrics.successes != null &&
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
        { success_count: number; fail_count: number }
      > = {}

      // Group checks by name and aggregate metrics
      checks.forEach((check) => {
        const { name, metric_summary } = check
        if (!checksByName[name]) {
          checksByName[name] = { success_count: 0, fail_count: 0 }
        }
        checksByName[name].success_count += metric_summary.success_count
        checksByName[name].fail_count += metric_summary.fail_count
      })

      // Add section with failed checks
      markdownSections.push('\n**Failed checks:**')

      // List failed checks (those with fail_count > 0)
      Object.entries(checksByName)
        .filter(([, metrics]) => metrics.fail_count > 0)
        .forEach(([name, metrics]) => {
          markdownSections.push(
            `- "${name}": Failed **${formatNumber(metrics.fail_count)}**, out of **${formatNumber(metrics.success_count + metrics.fail_count)}** times.`
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
 * Generates a complete markdown summary from metrics data
 * @param metricsSummary The complete metrics summary object
 * @returns Markdown string for all metrics
 */
export function generateMarkdownSummary(
  metricsSummary: MetricsSummary | null | undefined,
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
    ...getHttpMetricsMarkdown(metricsSummary.http_metric_summary)
  )

  // Add WebSocket metrics
  markdownSections.push(
    ...getWebSocketMetricsMarkdown(metricsSummary.ws_metric_summary)
  )

  // Add gRPC metrics
  markdownSections.push(
    ...getGrpcMetricsMarkdown(metricsSummary.grpc_metric_summary)
  )

  // Add browser metrics
  markdownSections.push(
    ...getBrowserMetricsMarkdown(metricsSummary.browser_metric_summary)
  )

  return markdownSections.length
    ? markdownSections.join('\n')
    : 'No metrics data available.'
}
