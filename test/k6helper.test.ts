import { spawn } from 'child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../src/apiUtils'
import {
  cleanScriptPath,
  executeRunK6Command,
  extractTestRunId,
  fetchChecks,
  fetchTestRunSummary,
  generateK6RunCommand,
  isCloudIntegrationEnabled,
  validateTestPaths,
} from '../src/k6helper'
import { TestRunUrlsMap } from '../src/types'

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
  execSync: vi.fn().mockReturnValue(Buffer.from('k6 v0.38.0')),
}))

// Mock @actions/core
vi.mock('@actions/core', () => ({
  debug: vi.fn(),
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  setFailed: vi.fn(),
}))

// Mock apiRequest to return specific responses for different tests
vi.mock('../src/apiUtils', () => ({
  apiRequest: vi.fn(),
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

describe('fetchTestRunSummary', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should return test run summary when API request succeeds', async () => {
    // Mock response from the API
    const mockTestRunSummary = {
      metrics_summary: {
        http_metric_summary: {
          requests: 100,
          failed_requests: 5,
        },
        checks_metric_summary: {
          total: 200,
          successes: 190,
        },
      },
      baseline_test_run_details: null,
    }

    // Mock the apiRequest function to return our mock response
    vi.mocked(apiRequest).mockResolvedValueOnce(mockTestRunSummary)

    // Call the function
    const result = await fetchTestRunSummary('1234')

    // Verify the result
    expect(result).toEqual(mockTestRunSummary)
    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining('/test_runs(1234)/result_summary')
    )
  })

  it('should return undefined when API request fails', async () => {
    // Mock the apiRequest function to return undefined (API failure)
    vi.mocked(apiRequest).mockResolvedValueOnce(undefined)

    // Call the function
    const result = await fetchTestRunSummary('1234')

    // Verify the result
    expect(result).toBeUndefined()
    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining('/test_runs(1234)/result_summary')
    )
  })
})

describe('fetchChecks', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should return checks array when API request succeeds', async () => {
    // Mock response from the API
    const mockChecksResponse = {
      '@count': 3,
      value: [
        {
          group_id: null,
          id: 'c43e6629-af3b-59c4-a047-531dca123851',
          metric_summary: {
            fail_count: 10,
            success_count: 0,
            success_rate: 0.0,
          },
          name: 'black friday is present',
          scenario_id: 'efeb799c-a053-56bf-9a26-c59d78537bc0',
        },
        {
          group_id: null,
          id: 'f9c6591a-3195-525f-a1e8-c39173a65056',
          metric_summary: {
            fail_count: 0,
            success_count: 10,
            success_rate: 1.0,
          },
          name: 'Connected successfully',
          scenario_id: 'efeb799c-a053-56bf-9a26-c59d78537bc0',
        },
      ],
    }

    // Mock the apiRequest function to return our mock response
    vi.mocked(apiRequest).mockResolvedValueOnce(mockChecksResponse)

    // Call the function
    const result = await fetchChecks('1234')

    // Verify the result
    expect(result).toEqual(mockChecksResponse.value)
    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining('/test_runs(1234)/checks')
    )
  })

  it('should return empty array when API request fails', async () => {
    // Mock the apiRequest function to return undefined (API failure)
    vi.mocked(apiRequest).mockResolvedValueOnce(undefined)

    // Call the function
    const result = await fetchChecks('1234')

    // Verify the result
    expect(result).toEqual([])
    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining('/test_runs(1234)/checks')
    )
  })
})
