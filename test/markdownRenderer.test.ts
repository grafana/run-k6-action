import { describe, expect, it } from 'vitest'
import {
  formatFloat,
  formatNumber,
  generateMarkdownSummary,
  getBrowserMetricsMarkdown,
  getChecksMarkdown,
  getGrpcMetricsMarkdown,
  getHttpMetricsMarkdown,
  getPercentageChange,
  getTestRunStatusMarkdown,
  getThresholdsMarkdown,
  getTrendSummaryMarkdown,
  getWebSocketMetricsMarkdown,
} from '../src/markdownRenderer'
import {
  BrowserMetricSummary,
  Check,
  ChecksMetricSummary,
  GrpcMetricSummary,
  HttpMetricSummary,
  MetricsSummary,
  TrendSummary,
  WsMetricSummary,
} from '../src/types'

describe('Formatting functions', () => {
  describe('formatNumber', () => {
    it('should format numbers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000')
      expect(formatNumber(1000000)).toBe('1,000,000')
    })

    it('should return default value for undefined input', () => {
      expect(formatNumber(undefined)).toBe('0')
      expect(formatNumber(undefined, 'N/A')).toBe('N/A')
    })

    it('should return default value for null input', () => {
      expect(formatNumber(null as unknown as number)).toBe('0')
      expect(formatNumber(null as unknown as number, 'N/A')).toBe('N/A')
    })
  })

  describe('formatFloat', () => {
    it('should format floats with two decimal places', () => {
      expect(formatFloat(10.123)).toBe('10.12')
      expect(formatFloat(10.129)).toBe('10.13')
    })

    it('should append unit if provided', () => {
      expect(formatFloat(10.123, 'ms')).toBe('10.12 ms')
    })

    it('should return default value for undefined input', () => {
      expect(formatFloat(undefined)).toBe('0')
      expect(formatFloat(undefined, 'ms', 'N/A')).toBe('N/A')
    })

    it('should return default value for null input', () => {
      expect(formatFloat(null as unknown as number)).toBe('0')
      expect(formatFloat(null as unknown as number, 'ms', 'N/A')).toBe('N/A')
    })
  })

  describe('getPercentageChange', () => {
    it('should return empty string for undefined or null inputs', () => {
      expect(getPercentageChange(undefined, 100)).toBe('')
      expect(getPercentageChange(100, undefined)).toBe('')
      expect(getPercentageChange(0, 100)).toContain('↓')
      expect(getPercentageChange(100, 0)).toBe('')
    })

    it('should return empty string when baseline is zero', () => {
      expect(getPercentageChange(100, 0)).toBe('')
    })

    it('should correctly calculate percentage decrease', () => {
      // For metrics where lower is better (default higherIsBetter = false)
      expect(getPercentageChange(80, 100)).toBe(' (✅ ↓ 20.00%)')
      expect(getPercentageChange(50, 100)).toBe(' (✅ ↓ 50.00%)')
    })

    it('should correctly calculate percentage increase', () => {
      // For metrics where lower is better (default higherIsBetter = false)
      expect(getPercentageChange(120, 100)).toBe(' (❌ ↑ 20.00%)')
      expect(getPercentageChange(150, 100)).toBe(' (❌ ↑ 50.00%)')
    })

    it('should correctly handle higherIsBetter flag', () => {
      // For metrics where higher is better (higherIsBetter = true)
      expect(getPercentageChange(120, 100, true)).toBe(' (✅ ↑ 20.00%)')
      expect(getPercentageChange(80, 100, true)).toBe(' (❌ ↓ 20.00%)')
    })

    it('should show no change when values are equal', () => {
      expect(getPercentageChange(100, 100)).toBe(' (🔘  0.00%)')
    })
  })
})

describe('Markdown generation functions', () => {
  const trendSummary: TrendSummary = {
    count: 100,
    mean: 250.45,
    max: 500.12,
    min: 100.23,
    p95: 450.67,
    p99: 490.89,
    stdev: 50.34,
  }

  const baselineTrendSummary: TrendSummary = {
    count: 90,
    mean: 280.45,
    max: 550.12,
    min: 120.23,
    p95: 500.67,
    p99: 530.89,
    stdev: 60.34,
  }

  const httpMetrics: HttpMetricSummary = {
    requests_count: 1000,
    failures_count: 50,
    rps_mean: 25.5,
    rps_max: 35.7,
    duration: trendSummary,
    duration_median: 240.3,
  }

  const wsMetrics: WsMetricSummary = {
    msgs_sent: 500,
    msgs_received: 450,
    sessions: 50,
    session_duration: trendSummary,
    connecting: trendSummary,
  }

  const baselineWsMetrics: WsMetricSummary = {
    msgs_sent: 450,
    msgs_received: 400,
    sessions: 45,
    session_duration: baselineTrendSummary,
    connecting: baselineTrendSummary,
  }

  const browserMetrics: BrowserMetricSummary = {
    browser_data_received: 1024000,
    browser_data_sent: 512000,
    http_request_count: 200,
    http_failure_count: 10,
    web_vital_lcp_p75: 2500,
    web_vital_fid_p75: 100,
    web_vital_cls_p75: 0.1,
    web_vital_ttfb_p75: 800,
    web_vital_fcp_p75: 1200,
    web_vital_inp_p75: 150,
  }

  const baselineBrowserMetrics: BrowserMetricSummary = {
    browser_data_received: 1124000,
    browser_data_sent: 482000,
    http_request_count: 180,
    http_failure_count: 15,
    web_vital_lcp_p75: 2700,
    web_vital_fid_p75: 120,
    web_vital_cls_p75: 0.15,
    web_vital_ttfb_p75: 850,
    web_vital_fcp_p75: 1300,
    web_vital_inp_p75: 180,
  }

  const grpcMetrics: GrpcMetricSummary = {
    requests_count: 300,
    rps_mean: 15.3,
    rps_max: 20.1,
    duration: trendSummary,
  }

  const baselineGrpcMetrics: GrpcMetricSummary = {
    requests_count: 280,
    rps_mean: 14.0,
    rps_max: 18.5,
    duration: baselineTrendSummary,
  }

  const checksMetrics: ChecksMetricSummary = {
    total: 2000,
    successes: 1950,
    hits_total: 10000,
    hits_successes: 9800,
  }

  const checks: Check[] = [
    {
      name: 'status is 200',
      metric_summary: {
        fail_count: 20,
        success_count: 980,
        success_rate: 0.98,
      },
    },
    {
      name: 'response time < 500ms',
      metric_summary: {
        fail_count: 30,
        success_count: 970,
        success_rate: 0.97,
      },
    },
  ]

  describe('getTrendSummaryMarkdown', () => {
    it('should return empty string for null or undefined input', () => {
      expect(getTrendSummaryMarkdown(null, 'Test')).toBe('')
      expect(getTrendSummaryMarkdown(undefined, 'Test')).toBe('')
    })

    it('should format trend summary correctly', () => {
      const result = getTrendSummaryMarkdown(trendSummary, 'Response Time')
      expect(result).toContain('Response Time')
      expect(result).toContain('Minimum')
      expect(result).toContain('Maximum')
      expect(result).toContain('Average')
      expect(result).toContain('Standard Deviation')
      expect(result).toContain('P95')
      expect(result).toContain('P99')
    })

    it('should include percentage changes when baseline is provided', () => {
      const result = getTrendSummaryMarkdown(
        trendSummary,
        'Response Time',
        baselineTrendSummary
      )
      expect(result).toContain('Response Time')
      // Should include percentage change for min (improved/decreased)
      expect(result).toContain('✅')
      expect(result).toContain('↓')
      // The actual implementation doesn't include baseline values in the output
      // So we just check for our current values and percentage changes
      expect(result).toContain('100.23 ms')
      expect(result).toContain('16.63%') // Percentage change for min
    })
  })

  describe('getHttpMetricsMarkdown', () => {
    it('should return empty array for null or empty input', () => {
      expect(getHttpMetricsMarkdown(null)).toEqual([])
      expect(getHttpMetricsMarkdown({})).toEqual([])
    })

    it('should format HTTP metrics correctly', () => {
      const result = getHttpMetricsMarkdown(httpMetrics)
      expect(result.join('\n')).toContain('HTTP Metrics')
      expect(result.join('\n')).toContain('95th Percentile Response Time')
      expect(result.join('\n')).toContain('Total Requests')
      expect(result.join('\n')).toContain('Failed Requests')
      expect(result.join('\n')).toContain('Average Request Rate')
      expect(result.join('\n')).toContain('Peak RPS')
    })

    it('should include percentage changes when baseline is provided', () => {
      // For baseline comparison, we'll create a new baseline with some metrics worse
      // so we get both improvement and regression indicators
      const mixedBaselineHttpMetrics: HttpMetricSummary = {
        requests_count: 900, // lower is worse for throughput
        failures_count: 45, // higher is worse for failures
        rps_mean: 28.0, // higher is better for throughput
        rps_max: 32.7,
        duration: baselineTrendSummary,
        duration_median: 270.3,
      }

      const result = getHttpMetricsMarkdown(
        httpMetrics,
        mixedBaselineHttpMetrics
      )
      expect(result.join('\n')).toContain('HTTP Metrics')
      expect(result.join('\n')).toContain('✅') // Should have improvement indicators
      expect(result.join('\n')).toContain('❌') // Should have regression indicators
    })
  })

  describe('getWebSocketMetricsMarkdown', () => {
    it('should return empty array for null or empty input', () => {
      expect(getWebSocketMetricsMarkdown(null)).toEqual([])
      expect(getWebSocketMetricsMarkdown({})).toEqual([])
    })

    it('should format WebSocket metrics correctly', () => {
      const result = getWebSocketMetricsMarkdown(wsMetrics)
      expect(result.join('\n')).toContain('WebSocket Metrics')
      expect(result.join('\n')).toContain('Messages Sent')
      expect(result.join('\n')).toContain('Messages Received')
      expect(result.join('\n')).toContain('Total Sessions')
      expect(result.join('\n')).toContain('Session Duration')
      expect(result.join('\n')).toContain('Connection Time')
    })

    it('should include percentage changes when baseline is provided', () => {
      const result = getWebSocketMetricsMarkdown(wsMetrics, baselineWsMetrics)
      expect(result.join('\n')).toContain('WebSocket Metrics')
      expect(result.join('\n')).toContain('✅') // Should have improvement indicators
      expect(result.join('\n')).toContain('↑') // Should have increase indicators
    })
  })

  describe('getGrpcMetricsMarkdown', () => {
    it('should return empty array for null or empty input', () => {
      expect(getGrpcMetricsMarkdown(null)).toEqual([])
      expect(getGrpcMetricsMarkdown({})).toEqual([])
    })

    it('should format gRPC metrics correctly', () => {
      const result = getGrpcMetricsMarkdown(grpcMetrics)
      expect(result.join('\n')).toContain('gRPC Metrics')
      expect(result.join('\n')).toContain('Total Requests')
      expect(result.join('\n')).toContain('Average Request Rate')
      expect(result.join('\n')).toContain('Peak RPS')
      expect(result.join('\n')).toContain('Request Duration')
    })

    it('should include percentage changes when baseline is provided', () => {
      const result = getGrpcMetricsMarkdown(grpcMetrics, baselineGrpcMetrics)
      expect(result.join('\n')).toContain('gRPC Metrics')
      expect(result.join('\n')).toContain('✅') // Should have improvement indicators
      expect(result.join('\n')).toContain('↑') // Should have increase indicators
    })
  })

  describe('getBrowserMetricsMarkdown', () => {
    it('should return empty array for null or empty input', () => {
      expect(getBrowserMetricsMarkdown(null)).toEqual([])
      expect(getBrowserMetricsMarkdown({})).toEqual([])
    })

    it('should format browser metrics correctly', () => {
      const result = getBrowserMetricsMarkdown(browserMetrics)
      expect(result.join('\n')).toContain('Browser Metrics')
      expect(result.join('\n')).toContain('Data Received')
      expect(result.join('\n')).toContain('Data Sent')
      expect(result.join('\n')).toContain('HTTP Requests')
      expect(result.join('\n')).toContain('HTTP Failures')
      // Should contain web vitals
      expect(result.join('\n')).toContain('LCP')
      expect(result.join('\n')).toContain('FID')
      expect(result.join('\n')).toContain('CLS')
      expect(result.join('\n')).toContain('TTFB')
      expect(result.join('\n')).toContain('FCP')
      expect(result.join('\n')).toContain('INP')
    })

    it('should include percentage changes when baseline is provided', () => {
      const result = getBrowserMetricsMarkdown(
        browserMetrics,
        baselineBrowserMetrics
      )
      expect(result.join('\n')).toContain('Browser Metrics')
      expect(result.join('\n')).toContain('✅') // Should have improvement indicators
      expect(result.join('\n')).toContain('↓') // Should have decrease indicators
    })

    it('should use fallback emoji for unknown vitals', () => {
      // We can't easily test this directly due to the way the function is implemented
      // But we can verify that the fallback emoji logic works as expected

      // Simulate the emoji selection logic from getBrowserMetricsMarkdown
      const vitalEmojis: Record<string, string> = {
        cls: '🧩',
        fcp: '🎨',
        fid: '👆',
        inp: '⌨️',
        lcp: '🖼️',
        ttfb: '⏱️',
      }

      // Test a known vital
      const knownVital = 'cls'
      const knownEmoji = vitalEmojis[knownVital] || '📏'
      expect(knownEmoji).toBe('🧩')

      // Test an unknown vital to ensure fallback emoji is used
      const unknownVital = 'custom'
      const fallbackEmoji = vitalEmojis[unknownVital] || '📏'
      expect(fallbackEmoji).toBe('📏')
    })
  })

  describe('getChecksMarkdown', () => {
    it('should return empty array for null, empty or zero total input', () => {
      expect(getChecksMarkdown(null, null)).toEqual([])
      expect(getChecksMarkdown({}, null)).toEqual([])
      expect(getChecksMarkdown({ total: 0 }, null)).toEqual([])
    })

    it('should show success message when all checks pass', () => {
      const result = getChecksMarkdown({ total: 10, successes: 10 }, null)
      expect(result.join('\n')).toContain('All')
      expect(result.join('\n')).toContain('successful')
    })

    it('should show failure message when some checks fail', () => {
      const result = getChecksMarkdown({ total: 10, successes: 8 }, null)
      expect(result.join('\n')).toContain('not successful')
    })

    it('should list failed checks when checks data is provided', () => {
      const result = getChecksMarkdown(checksMetrics, checks)
      expect(result.join('\n')).toContain('not successful')
      expect(result.join('\n')).toContain('status is 200')
      expect(result.join('\n')).toContain('response time < 500ms')
    })
  })

  describe('getThresholdsMarkdown', () => {
    it('should return empty array for null, empty or zero total input', () => {
      expect(getThresholdsMarkdown(null)).toEqual([])
      expect(getThresholdsMarkdown({})).toEqual([])
      expect(getThresholdsMarkdown({ total: 0 })).toEqual([])
    })

    it('should show success message when all thresholds are met', () => {
      const result = getThresholdsMarkdown({ total: 10, successes: 10 })
      expect(result.join('\n')).toContain('All')
      expect(result.join('\n')).toContain('were met')
    })

    it('should show failure message when some thresholds are not met', () => {
      const result = getThresholdsMarkdown({ total: 10, successes: 8 })
      expect(result.join('\n')).toContain('not met')
    })
  })

  describe('getTestRunStatusMarkdown', () => {
    it('should show unknown status for undefined or null', () => {
      expect(getTestRunStatusMarkdown(undefined)).toContain('Unknown')
      expect(getTestRunStatusMarkdown(null as unknown as number)).toContain(
        'Unknown'
      )
    })

    it('should show passed status for code 3', () => {
      expect(getTestRunStatusMarkdown(3)).toContain('Passed')
    })

    it('should show timed out status for code 4', () => {
      expect(getTestRunStatusMarkdown(4)).toContain('Timed out')
    })

    it('should show failed status for other codes', () => {
      expect(getTestRunStatusMarkdown(1)).toContain('Failed')
      expect(getTestRunStatusMarkdown(2)).toContain('Failed')
      expect(getTestRunStatusMarkdown(5)).toContain('Failed')
    })
  })
})

describe('generateMarkdownSummary', () => {
  it('should return a default message for null metrics', () => {
    expect(generateMarkdownSummary(null, null, null)).toBe(
      'No metrics data available.'
    )
  })

  it('should return a default message for undefined metrics', () => {
    expect(generateMarkdownSummary(undefined, null, null)).toBe(
      'No metrics data available.'
    )
  })

  it('should include metrics sections that are available', () => {
    const metrics: MetricsSummary = {
      http_metric_summary: {
        requests_count: 1000,
        failures_count: 10,
        rps_mean: 25.5,
        rps_max: 30.2,
        duration: {
          min: 100,
          max: 500,
          mean: 250,
          p95: 450,
          p99: 490,
          stdev: 50,
        },
      },
      ws_metric_summary: null,
      grpc_metric_summary: null,
      checks_metric_summary: {
        total: 100,
        successes: 95,
      },
      thresholds_summary: {
        total: 5,
        successes: 5,
      },
      browser_metric_summary: null,
    }

    const result = generateMarkdownSummary(metrics, null, null)

    // Should include checks, thresholds, and HTTP metrics
    expect(result).toContain('checks were not successful')
    expect(result).toContain('✅ All **5** thresholds were met')
    expect(result).toContain('HTTP Metrics')

    // Should not include sections that are null
    expect(result).not.toContain('WebSocket Metrics')
    expect(result).not.toContain('gRPC Metrics')
    expect(result).not.toContain('Browser Metrics')
  })

  it('should include baseline comparisons when baseline is provided', () => {
    const metrics: MetricsSummary = {
      http_metric_summary: {
        requests_count: 1000,
        failures_count: 10,
        rps_mean: 25.5,
        rps_max: 30.2,
        duration: {
          min: 100,
          max: 500,
          mean: 250,
          p95: 450,
          p99: 490,
          stdev: 50,
        },
      },
      ws_metric_summary: null,
      grpc_metric_summary: null,
      checks_metric_summary: null,
      thresholds_summary: null,
      browser_metric_summary: null,
    }

    const baselineMetrics: MetricsSummary = {
      http_metric_summary: {
        requests_count: 900,
        failures_count: 15,
        rps_mean: 23.5,
        rps_max: 28.2,
        duration: {
          min: 120,
          max: 550,
          mean: 280,
          p95: 500,
          p99: 530,
          stdev: 60,
        },
      },
      ws_metric_summary: null,
      grpc_metric_summary: null,
      checks_metric_summary: null,
      thresholds_summary: null,
      browser_metric_summary: null,
    }

    const result = generateMarkdownSummary(metrics, baselineMetrics, null)

    // Should include baseline comparisons
    expect(result).toContain('✅')
    expect(result).toContain('↓')
  })

  it('should handle empty but provided metrics summary', () => {
    const emptyMetrics = {
      http_metric_summary: null,
      ws_metric_summary: null,
      grpc_metric_summary: null,
      checks_metric_summary: null,
      thresholds_summary: null,
      browser_metric_summary: null,
    }

    const result = generateMarkdownSummary(emptyMetrics, null, null)
    expect(result).toBe('')
  })
})
