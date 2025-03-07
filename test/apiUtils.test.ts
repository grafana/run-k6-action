import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, fetchWithRetry, RetryOptions } from '../src/apiUtils'

// Mock core
vi.mock('@actions/core', () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}))

describe('apiUtils', () => {
  // Save original fetch and environment
  const originalFetch = global.fetch
  const originalEnv = process.env

  beforeEach(() => {
    // Reset mocks and environment before each test
    vi.resetAllMocks()
    process.env = { ...originalEnv }

    // Mock fetch globally
    global.fetch = vi.fn()
  })

  afterEach(() => {
    // Restore original fetch and environment after each test
    global.fetch = originalFetch
    process.env = originalEnv
    vi.clearAllMocks()
  })

  describe('fetchWithRetry', () => {
    it('should return response when successful on first attempt', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
        statusText: 'OK',
      })

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse)

      const result = await fetchWithRetry('https://api.example.com/test')

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        {}
      )
      expect(result).toBe(mockResponse)
    })

    it('should return response for non-retryable error status', async () => {
      const mockResponse = new Response('Not Found', {
        status: 404,
        statusText: 'Not Found',
      })

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse)

      const result = await fetchWithRetry('https://api.example.com/test')

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(result).toBe(mockResponse)
    })

    it('should retry on retryable error status and return successful response', async () => {
      // Set up a 503 error response followed by a successful response
      const errorResponse = new Response('Service Unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
      })

      const successResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
        statusText: 'OK',
      })

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse)

      // Mock setTimeout to speed up tests
      vi.useFakeTimers()

      // Start the fetch with retry
      const resultPromise = fetchWithRetry(
        'https://api.example.com/test',
        {},
        {
          initialDelayMs: 10, // Small delay for faster tests
          maxRetries: 2,
        }
      )

      // Fast-forward timer to trigger the retry
      await vi.runAllTimersAsync()

      // Get the result
      const result = await resultPromise

      // Restore timers
      vi.useRealTimers()

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(result).toBe(successResponse)
    })

    it('should throw error after max retries', async () => {
      // Set up multiple error responses
      const errorResponse = new Response('Service Unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
      })

      vi.mocked(global.fetch).mockResolvedValue(errorResponse)

      // Mock setTimeout to speed up tests
      vi.useFakeTimers()

      // Start the fetch with retry
      const resultPromise = fetchWithRetry(
        'https://api.example.com/test',
        {},
        {
          initialDelayMs: 10,
          maxRetries: 2,
        }
      )

      // Fast-forward timer for all retries
      await vi.runAllTimersAsync()

      // Verify it throws after max retries
      try {
        await resultPromise
        // If we get here, the test should fail
        expect('Promise should have been rejected').toBe('but it was resolved')
      } catch (error) {
        // We expect an error to be thrown
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('HTTP error 503')
      }

      // Restore timers
      vi.useRealTimers()

      // Should be called initial + maxRetries times
      expect(global.fetch).toHaveBeenCalledTimes(3)
    })

    it('should retry on network errors', async () => {
      // Set up a network error followed by a successful response
      vi.mocked(global.fetch)
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            statusText: 'OK',
          })
        )

      // Mock setTimeout to speed up tests
      vi.useFakeTimers()

      // Start the fetch with retry
      const resultPromise = fetchWithRetry(
        'https://api.example.com/test',
        {},
        {
          initialDelayMs: 10,
          maxRetries: 2,
        }
      )

      // Fast-forward timer to trigger the retry
      await vi.runAllTimersAsync()

      // Get the result
      const result = await resultPromise

      // Restore timers
      vi.useRealTimers()

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(result.status).toBe(200)
    })

    it('should use custom retry options', async () => {
      const errorResponse = new Response('Too Many Requests', {
        status: 429,
        statusText: 'Too Many Requests',
      })

      const successResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
        statusText: 'OK',
      })

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse)

      // Define custom retry options
      const customOptions: Partial<RetryOptions> = {
        maxRetries: 1,
        initialDelayMs: 5,
        backoffFactor: 1, // No backoff for simplicity
        nonRetryStatusCodes: [400, 401], // Only 400 and 401 non-retriable
      }

      // Mock setTimeout to speed up tests
      vi.useFakeTimers()

      // Start the fetch with custom retry options
      const resultPromise = fetchWithRetry(
        'https://api.example.com/test',
        {},
        customOptions
      )

      // Fast-forward timer to trigger the retry
      await vi.runAllTimersAsync()

      // Get the result
      const result = await resultPromise

      // Restore timers
      vi.useRealTimers()

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(result).toBe(successResponse)
    })
  })

  describe('apiRequest', () => {
    it('should return parsed data on successful request', async () => {
      const responseData = { id: 1, name: 'Test' }
      const mockResponse = new Response(JSON.stringify(responseData), {
        status: 200,
        statusText: 'OK',
      })

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse)

      const result = await apiRequest<typeof responseData>(
        'https://api.example.com/test'
      )

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(result).toEqual(responseData)
    })

    it('should set default headers if not provided', async () => {
      const responseData = { success: true }
      const mockResponse = new Response(JSON.stringify(responseData), {
        status: 200,
        statusText: 'OK',
      })

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse)

      await apiRequest('https://api.example.com/test')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    })

    it('should add authorization token if K6_CLOUD_TOKEN is set', async () => {
      process.env.K6_CLOUD_TOKEN = 'test-token'

      const responseData = { success: true }
      const mockResponse = new Response(JSON.stringify(responseData), {
        status: 200,
        statusText: 'OK',
      })

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse)

      await apiRequest('https://api.example.com/test')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Token test-token',
          },
        }
      )
    })

    it('should respect existing headers', async () => {
      const responseData = { success: true }
      const mockResponse = new Response(JSON.stringify(responseData), {
        status: 200,
        statusText: 'OK',
      })

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse)

      await apiRequest('https://api.example.com/test', {
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        {
          headers: {
            'X-Custom-Header': 'custom-value',
          },
        }
      )
    })

    it('should not override existing Authorization header', async () => {
      process.env.K6_CLOUD_TOKEN = 'test-token'

      const responseData = { success: true }
      const mockResponse = new Response(JSON.stringify(responseData), {
        status: 200,
        statusText: 'OK',
      })

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse)

      await apiRequest('https://api.example.com/test', {
        headers: {
          Authorization: 'Bearer custom-token',
        },
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        {
          headers: {
            Authorization: 'Bearer custom-token',
          },
        }
      )
    })

    it('should return undefined on non-OK response', async () => {
      const mockResponse = new Response('Not Found', {
        status: 404,
        statusText: 'Not Found',
      })

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse)

      const result = await apiRequest('https://api.example.com/test')

      expect(result).toBeUndefined()
    })

    it('should return undefined on fetch error', async () => {
      // Mock setTimeout to speed up tests
      vi.useFakeTimers()

      vi.mocked(global.fetch).mockRejectedValueOnce(
        new Error('Network failure')
      )

      const resultPromise = apiRequest('https://api.example.com/test')

      // Fast-forward timer to trigger all timeouts
      await vi.runAllTimersAsync()

      const result = await resultPromise

      // Restore timers
      vi.useRealTimers()

      expect(result).toBeUndefined()
    })

    it('should pass retry options to fetchWithRetry', async () => {
      const responseData = { success: true }
      const mockResponse = new Response(JSON.stringify(responseData), {
        status: 200,
        statusText: 'OK',
      })

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse)

      const retryOptions: Partial<RetryOptions> = {
        maxRetries: 5,
        initialDelayMs: 100,
      }

      await apiRequest('https://api.example.com/test', {}, retryOptions)

      // We can't directly test that retryOptions was passed to fetchWithRetry
      // since fetchWithRetry is not mocked but the real implementation
      // However, we can verify fetch was called with the correct URL and options
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    })
  })
})
