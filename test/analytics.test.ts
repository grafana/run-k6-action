import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiUtils from '../src/apiUtils'

// Mock dependencies
vi.mock('../src/apiUtils', () => ({
  apiRequest: vi.fn().mockResolvedValue({}),
  DEFAULT_RETRY_OPTIONS: {
    maxRetries: 3,
    initialDelayMs: 1000,
    backoffFactor: 2,
    nonRetryStatusCodes: [400, 401, 403, 404, 405, 422],
  },
}))

// Import the module under test
import { UserSpecifiedAnalyticsData } from '../src/analytics'

describe('analytics', () => {
  // Save original environment and console.error
  const originalEnv = process.env
  const originalConsoleError = console.error

  // Mock data
  const mockUserSpecifiedData: UserSpecifiedAnalyticsData = {
    totalTestScriptsExecuted: 5,
    isCloudRun: true,
    isUsingFlags: true,
    isUsingInspectFlags: false,
    failFast: true,
    commentOnPr: true,
    parallelFlag: false,
    cloudRunLocally: false,
    onlyVerifyScripts: false,
  }

  beforeEach(() => {
    // Reset mocks and environment before each test
    vi.resetAllMocks()
    process.env = { ...originalEnv }
    console.error = vi.fn()
    console.warn = vi.fn()

    // Set up environment variables
    process.env.GITHUB_ACTION = 'test-action'
    process.env.GITHUB_WORKFLOW = 'test-workflow'
  })

  afterEach(() => {
    // Restore original environment and console.error after each test
    process.env = originalEnv
    console.error = originalConsoleError
    vi.clearAllMocks()
  })

  describe('sendAnalytics', () => {
    it('should send analytics data with correct properties', async () => {
      // We need to use a dynamic import to avoid hoisting issues
      const { sendAnalytics } = await import('../src/analytics')

      await sendAnalytics(mockUserSpecifiedData)

      // Check that the API request was made with the right data
      expect(apiUtils.apiRequest).toHaveBeenCalledTimes(1)
      expect(apiUtils.apiRequest).toHaveBeenCalledWith(
        expect.any(String),
        {
          method: 'POST',
          body: expect.stringContaining('"source":"github-action"'),
        },
        expect.objectContaining({
          maxRetries: 1,
        })
      )
    })

    it('should use the default analytics URL if not provided in environment', async () => {
      delete process.env.GRAFANA_ANALYTICS_URL

      // We need to use a dynamic import to avoid hoisting issues
      const { sendAnalytics } = await import('../src/analytics')

      await sendAnalytics(mockUserSpecifiedData)

      expect(apiUtils.apiRequest).toHaveBeenCalledWith(
        'https://stats.grafana.org/runk6action-usage-report',
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('should use the custom analytics URL if provided in environment', async () => {
      process.env.GRAFANA_ANALYTICS_URL = 'https://custom-stats.example.com'

      // We need to use a dynamic import to avoid hoisting issues
      const { sendAnalytics } = await import('../src/analytics')

      await sendAnalytics(mockUserSpecifiedData)

      expect(apiUtils.apiRequest).toHaveBeenCalledWith(
        'https://custom-stats.example.com/runk6action-usage-report',
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('should handle errors when sending analytics', async () => {
      // Mock apiRequest to throw an error
      vi.mocked(apiUtils.apiRequest).mockRejectedValueOnce(
        new Error('Network error')
      )

      // We need to use a dynamic import to avoid hoisting issues
      const { sendAnalytics } = await import('../src/analytics')

      // Call the function
      await sendAnalytics(mockUserSpecifiedData)

      // Verify that the error was handled and logged
      expect(console.warn).toHaveBeenCalledWith(
        'Error sending analytics:',
        expect.any(Error)
      )
    })
  })

  describe('getUsageStatsId', () => {
    it('should generate a unique usage stats ID when GitHub variables are missing', async () => {
      // Remove GitHub environment variables
      delete process.env.GITHUB_ACTION
      delete process.env.GITHUB_WORKFLOW

      // We need to use a dynamic import to avoid hoisting issues
      const { getUsageStatsId } = await import('../src/analytics')

      const usageStatsId1 = await getUsageStatsId()
      const usageStatsId2 = await getUsageStatsId()

      expect(usageStatsId1).not.toEqual(usageStatsId2)
    })
  })
})
