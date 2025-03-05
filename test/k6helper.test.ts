import { spawn } from 'child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanScriptPath,
  executeRunK6Command,
  extractTestRunId,
  generateK6RunCommand,
  generateMetricsSummaryMarkdown,
  isCloudIntegrationEnabled,
  validateTestPaths,
} from '../src/k6helper'
import {
  BrowserMetricSummary,
  ChecksMetricSummary,
  GrpcMetricSummary,
  HttpMetricSummary,
  MetricsSummary,
  TestRunUrlsMap,
  ThresholdsSummary,
  WsMetricSummary,
} from '../src/types'

// Mock child_process.spawn
vi.mock('child_process', () => ({
  spawn: vi.fn().mockImplementation(() => ({
    on: vi.fn((event, callback) => {
      if (event === 'exit') {
        callback(0, '')
      }
      return {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      }
    }),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    pid: 123,
  })),
}))

// Mock @actions/core
vi.mock('@actions/core', () => ({
  debug: vi.fn(),
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  setFailed: vi.fn(),
}))

describe('cleanScriptPath', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should remove the base directory prefix if present', () => {
    process.env['GITHUB_WORKSPACE'] = '/workspace'
    const scriptPath = '/workspace/test.js'
    const result = cleanScriptPath(scriptPath)
    expect(result).toBe('test.js')
  })

  it('should return the original path if no base directory prefix is present without leading slashes', () => {
    process.env['GITHUB_WORKSPACE'] = '/workspace'
    const scriptPath = '/other/test.js'
    const result = cleanScriptPath(scriptPath)
    expect(result).toBe('other/test.js')
  })

  it('should handle empty base directory and return the original path without leading slashes', () => {
    delete process.env['GITHUB_WORKSPACE']
    const scriptPath = '/test.js'
    const result = cleanScriptPath(scriptPath)
    expect(result).toBe('test.js')
  })
})

describe('isCloudIntegrationEnabled', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return false if K6_CLOUD_TOKEN is not set', () => {
    delete process.env.K6_CLOUD_TOKEN
    const result = isCloudIntegrationEnabled()
    expect(result).toBe(false)
  })

  it('should return false if K6_CLOUD_TOKEN is empty', () => {
    process.env.K6_CLOUD_TOKEN = ''
    const result = isCloudIntegrationEnabled()
    expect(result).toBe(false)
  })

  it('should throw an error if K6_CLOUD_TOKEN is set but K6_CLOUD_PROJECT_ID is not set', () => {
    process.env.K6_CLOUD_TOKEN = 'token'
    delete process.env.K6_CLOUD_PROJECT_ID
    expect(() => isCloudIntegrationEnabled()).toThrow(
      'K6_CLOUD_PROJECT_ID must be set when K6_CLOUD_TOKEN is set'
    )
  })

  it('should throw an error if K6_CLOUD_TOKEN is set but K6_CLOUD_PROJECT_ID is empty', () => {
    process.env.K6_CLOUD_TOKEN = 'token'
    process.env.K6_CLOUD_PROJECT_ID = ''
    expect(() => isCloudIntegrationEnabled()).toThrow(
      'K6_CLOUD_PROJECT_ID must be set when K6_CLOUD_TOKEN is set'
    )
  })

  it('should return true if both K6_CLOUD_TOKEN and K6_CLOUD_PROJECT_ID are set', () => {
    process.env.K6_CLOUD_TOKEN = 'token'
    process.env.K6_CLOUD_PROJECT_ID = 'project-id'
    const result = isCloudIntegrationEnabled()
    expect(result).toBe(true)
  })
})

describe('generateK6RunCommand', () => {
  it('should generate a local k6 run command when isCloud is false', () => {
    const path = 'test.js'
    const flags = ''
    const isCloud = false
    const cloudRunLocally = false
    const result = generateK6RunCommand(path, flags, isCloud, cloudRunLocally)
    expect(result).toBe('k6 run --address= test.js')
  })

  it('should generate a cloud k6 run command when isCloud is true and cloudRunLocally is false', () => {
    const path = 'test.js'
    const flags = ''
    const isCloud = true
    const cloudRunLocally = false
    const result = generateK6RunCommand(path, flags, isCloud, cloudRunLocally)
    expect(result).toBe('k6 cloud --address= test.js')
  })

  it('should generate a local k6 run command with cloud output when isCloud is true and cloudRunLocally is true', () => {
    const path = 'test.js'
    const flags = ''
    const isCloud = true
    const cloudRunLocally = true
    const result = generateK6RunCommand(path, flags, isCloud, cloudRunLocally)
    expect(result).toBe('k6 run --address= --out=cloud test.js')
  })

  it('should include provided flags in the command', () => {
    const path = 'test.js'
    const flags = '--vus=10 --duration=30s'
    const isCloud = false
    const cloudRunLocally = false
    const result = generateK6RunCommand(path, flags, isCloud, cloudRunLocally)
    expect(result).toBe('k6 run --address= --vus=10 --duration=30s test.js')
  })
})

describe('executeRunK6Command', () => {
  it('should spawn a child process with the given command', () => {
    const command = 'k6 run test.js'
    const totalTestRuns = 1
    const testResultUrlsMap: TestRunUrlsMap = {}
    const debug = false

    executeRunK6Command(command, totalTestRuns, testResultUrlsMap, debug)

    expect(spawn).toHaveBeenCalledWith(
      'k6',
      ['run', 'test.js'],
      expect.any(Object)
    )
  })
})

describe('validateTestPaths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('should return valid test paths', async () => {
    const testPaths = ['test1.js', 'test2.js']
    const flags: string[] = []

    const result = await validateTestPaths(testPaths, flags)

    expect(result).toEqual(testPaths)
    expect(spawn).toHaveBeenCalledTimes(2)
    expect(spawn).toHaveBeenCalledWith(
      'k6',
      ['inspect', '--execution-requirements', 'test1.js'],
      expect.any(Object)
    )
    expect(spawn).toHaveBeenCalledWith(
      'k6',
      ['inspect', '--execution-requirements', 'test2.js'],
      expect.any(Object)
    )
  })

  it('should throw an error if no test paths are provided', async () => {
    const testPaths: string[] = []
    const flags: string[] = []

    await expect(validateTestPaths(testPaths, flags)).rejects.toThrow(
      'No test files found'
    )
  })

  it('should include provided flags in the command', async () => {
    const testPaths = ['test1.js']
    const flags = ['--no-thresholds']

    await validateTestPaths(testPaths, flags)

    expect(spawn).toHaveBeenCalledWith(
      'k6',
      ['inspect', '--execution-requirements', '--no-thresholds', 'test1.js'],
      expect.any(Object)
    )
  })
})

describe('extractTestRunId', () => {
  it('should return the test run ID from a Grafana Cloud K6 URL', () => {
    const testRunUrl = 'https://xxx.grafana.net/a/k6-app/runs/4050582'
    const result = extractTestRunId(testRunUrl)
    expect(result).toBe('4050582')
  })

  it('should return null if the test run URL does not contain a valid ID', () => {
    const testRunUrl = 'https://xxx.grafana.net/a/k6-app/runs/'
    const result = extractTestRunId(testRunUrl)
    expect(result).toBeNull()
  })

  it('should return null if the test run URL is not a Grafana Cloud K6 URL', () => {
    const testRunUrl = 'https://xxx.com/test-run/4050582'
    const result = extractTestRunId(testRunUrl)
    expect(result).toBeNull()
  })
})

describe('generateMetricsSummaryMarkdown', () => {
  const httpMetrics: HttpMetricSummary = {
    requests_count: 1000,
    failures_count: 50,
    rps_mean: 25.5,
    rps_max: 35.7,
    duration: {
      count: 100,
      mean: 250.45,
      max: 500.12,
      min: 100.23,
      p95: 450.67,
      p99: 490.89,
      stdev: 50.34,
    },
    duration_median: 240.3,
  }

  const wsMetrics: WsMetricSummary = {
    msgs_sent: 500,
    msgs_received: 450,
    sessions: 50,
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

  it('should return default message for null or undefined input', () => {
    expect(generateMetricsSummaryMarkdown(null)).toBe(
      'No metrics data available.'
    )
    expect(generateMetricsSummaryMarkdown(undefined)).toBe(
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

    expect(generateMetricsSummaryMarkdown(emptyMetrics)).toBe(
      'No metrics data available.'
    )
  })

  it('should generate HTTP metrics section correctly', () => {
    const metrics: MetricsSummary = {
      http_metric_summary: httpMetrics,
      ws_metric_summary: null,
      grpc_metric_summary: null,
      checks_metric_summary: null,
      thresholds_summary: null,
      browser_metric_summary: null,
    }

    const result = generateMetricsSummaryMarkdown(metrics)

    expect(result).toContain('HTTP Metrics')
    expect(result).toContain('| Total Requests | 1,000 |')
    expect(result).toContain('| Failed Requests | 50 |')
    expect(result).toContain('| Average RPS | 25.50 |')
    expect(result).toContain('| Peak RPS | 35.70 |')
    expect(result).toContain('| Average Duration | 250.45ms |')
  })

  it('should generate WebSocket metrics section correctly', () => {
    const metrics: MetricsSummary = {
      http_metric_summary: null,
      ws_metric_summary: wsMetrics,
      grpc_metric_summary: null,
      checks_metric_summary: null,
      thresholds_summary: null,
      browser_metric_summary: null,
    }

    const result = generateMetricsSummaryMarkdown(metrics)

    expect(result).toContain('WebSocket Metrics')
    expect(result).toContain('| Messages Sent | 500 |')
    expect(result).toContain('| Messages Received | 450 |')
    expect(result).toContain('| Sessions | 50 |')
  })

  it('should generate Browser metrics section correctly', () => {
    const metrics: MetricsSummary = {
      http_metric_summary: null,
      ws_metric_summary: null,
      grpc_metric_summary: null,
      checks_metric_summary: null,
      thresholds_summary: null,
      browser_metric_summary: browserMetrics,
    }

    const result = generateMetricsSummaryMarkdown(metrics)

    expect(result).toContain('Browser Metrics')
    expect(result).toContain('| Data Received | 1,024,000 |')
    expect(result).toContain('| Data Sent | 512,000 |')
    expect(result).toContain('| HTTP Requests | 200 |')
    expect(result).toContain('| HTTP Failures | 10 |')
    expect(result).toContain('| LCP p75 | 2500.00ms |')
    expect(result).toContain('| FID p75 | 100.00ms |')
    expect(result).toContain('| CLS p75 | 0.10ms |')
    expect(result).toContain('| TTFB p75 | 800.00ms |')
  })

  it('should generate multiple sections for a complete metrics summary', () => {
    const metrics: MetricsSummary = {
      http_metric_summary: httpMetrics,
      ws_metric_summary: wsMetrics,
      grpc_metric_summary: grpcMetrics,
      checks_metric_summary: checksMetrics,
      thresholds_summary: thresholdsMetrics,
      browser_metric_summary: browserMetrics,
    }

    const result = generateMetricsSummaryMarkdown(metrics)

    expect(result).toContain('HTTP Metrics')
    expect(result).toContain('WebSocket Metrics')
    expect(result).toContain('gRPC Metrics')
    expect(result).toContain('Checks Summary')
    expect(result).toContain('Thresholds Summary')
    expect(result).toContain('Browser Metrics')
  })

  it('should handle missing or undefined values gracefully', () => {
    const metrics: MetricsSummary = {
      http_metric_summary: {
        requests_count: 1000,
        // failures_count is undefined
        rps_mean: undefined,
        rps_max: 35.7,
      },
      ws_metric_summary: null,
      grpc_metric_summary: null,
      checks_metric_summary: null,
      thresholds_summary: null,
      browser_metric_summary: null,
    }

    const result = generateMetricsSummaryMarkdown(metrics)

    expect(result).toContain('| Total Requests | 1,000 |')
    expect(result).toContain('| Failed Requests | N/A |')
    expect(result).toContain('| Average RPS | N/A |')
    expect(result).toContain('| Peak RPS | 35.70 |')
  })
})
