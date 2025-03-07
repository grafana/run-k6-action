import { describe, expect, it } from 'vitest'
import {
  formatFloat,
  formatNumber,
  generateMetricsSummary,
  getBrowserMetricsMarkdown,
  getChecksMarkdown,
  getGrpcMetricsMarkdown,
  getHttpMetricsMarkdown,
  getTestRunStatusMarkdown,
  getThresholdsMarkdown,
  getTrendSummaryMarkdown,
  getWebSocketMetricsMarkdown,
} from '../src/markdownRenderer'
import {
  BrowserMetricSummary,
  ChecksMetricSummary,
  GrpcMetricSummary,
  HttpMetricSummary,
  MetricsSummary,
  ThresholdsSummary,
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

  const browserMetrics: BrowserMetricSummary = {
    browser_data_received: 1024000,
    browser_data_sent: 512000,
    http_request_count: 200,
    http_failure_count: 10,
    web_vital_lcp_p75: 2500,
    web_vital_fid_p75: 100,
    web_vital_cls_p75: 0.1,
    web_vital_ttfb_p75: 800,
  }

  const grpcMetrics: GrpcMetricSummary = {
    requests_count: 300,
    rps_mean: 15.3,
    rps_max: 20.1,
    duration: trendSummary,
  }

  const checksMetrics: ChecksMetricSummary = {
    total: 2000,
    successes: 1950,
    hits_total: 10000,
    hits_successes: 9800,
  }

  const thresholdsMetrics: ThresholdsSummary = {
    total: 10,
    successes: 9,
  }

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
  })

  describe('getGrpcMetricsMarkdown', () => {
    it('should return empty array for null or empty input', () => {
      expect(getGrpcMetricsMarkdown(null)).toEqual([])
      expect(getGrpcMetricsMarkdown({})).toEqual([])
    })

    it('should format gRPC metrics correctly', () => {
      const result = getGrpcMetricsMarkdown(grpcMetrics)
      expect(result.join('\n')).toContain('gRPC Metrics')
      expect(result.join('\n')).toContain('95th percentile response time')
      expect(result.join('\n')).toContain('Average RPS')
      expect(result.join('\n')).toContain('Peak RPS')
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
      expect(result.join('\n')).toContain('LCP p75')
      expect(result.join('\n')).toContain('FID p75')
    })
  })

  describe('getChecksMarkdown', () => {
    it('should return empty array for null, empty or zero total input', () => {
      expect(getChecksMarkdown(null)).toEqual([])
      expect(getChecksMarkdown({})).toEqual([])
      expect(getChecksMarkdown({ total: 0 })).toEqual([])
    })

    it('should show success message when all checks pass', () => {
      const result = getChecksMarkdown({ total: 10, successes: 10 })
      expect(result.join('\n')).toContain('All')
      expect(result.join('\n')).toContain('successful')
    })

    it('should show failure message when some checks fail', () => {
      const result = getChecksMarkdown({ total: 10, successes: 8 })
      expect(result.join('\n')).toContain('not successful')
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

  describe('generateMetricsSummary', () => {
    it('should return default message for null or undefined input', () => {
      expect(generateMetricsSummary(null)).toBe('No metrics data available.')
      expect(generateMetricsSummary(undefined)).toBe(
        'No metrics data available.'
      )
    })

    it('should return default message for empty metrics summary', () => {
      const emptyMetrics: MetricsSummary = {
        http_metric_summary: null,
        ws_metric_summary: null,
        grpc_metric_summary: null,
        checks_metric_summary: null,
        thresholds_summary: null,
        browser_metric_summary: null,
      }

      expect(generateMetricsSummary(emptyMetrics)).toBe(
        'No metrics data available.'
      )
    })

    it('should include all sections for a complete metrics summary', () => {
      const metrics: MetricsSummary = {
        http_metric_summary: httpMetrics,
        ws_metric_summary: wsMetrics,
        grpc_metric_summary: grpcMetrics,
        checks_metric_summary: checksMetrics,
        thresholds_summary: thresholdsMetrics,
        browser_metric_summary: browserMetrics,
      }

      const result = generateMetricsSummary(metrics)

      expect(result).toContain('HTTP Metrics')
      expect(result).toContain('WebSocket Metrics')
      expect(result).toContain('gRPC Metrics')
      expect(result).toContain('checks were not successful')
      expect(result).toContain('thresholds were not met')
      expect(result).toContain('Browser Metrics')
    })
  })
})
