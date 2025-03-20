// API utility functions for making robust requests with retry capability
import * as core from '@actions/core'

/**
 * Interface for retry options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Initial delay in milliseconds before the first retry */
  initialDelayMs: number
  /** Factor by which the delay increases with each retry */
  backoffFactor: number
  /** HTTP status codes that should NOT trigger a retry (typically permanent client errors) */
  nonRetryStatusCodes: number[]
}

/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffFactor: 2,
  nonRetryStatusCodes: [400, 401, 403, 404, 405, 422],
}

/**
 * Makes an HTTP request with automatic retry and exponential backoff.
 * Will retry on all error status codes except those specified in nonRetryStatusCodes.
 *
 * @param url - The URL to request
 * @param options - Fetch options (method, headers, body, etc.)
 * @param retryOptions - Options for the retry mechanism (optional)
 * @returns Promise with the fetch response
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: Partial<RetryOptions> = {}
): Promise<Response> {
  // Merge default retry options with provided options
  const retry: RetryOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    ...retryOptions,
  }

  let lastError: Error | undefined
  let attemptCount = 0

  while (attemptCount <= retry.maxRetries) {
    try {
      const response = await fetch(url, options)

      // If response is ok or status code is in the non-retry list, return the response
      if (response.ok || retry.nonRetryStatusCodes.includes(response.status)) {
        return response
      }

      // If we get here, we have an error status code that should be retried
      lastError = new Error(
        `HTTP error ${response.status}: ${response.statusText}`
      )
    } catch (error) {
      // Network errors, timeouts, etc.
      lastError = error instanceof Error ? error : new Error(String(error))
    }
    // Log the retry attempt
    if (attemptCount < retry.maxRetries) {
      const retryDelayMs =
        retry.initialDelayMs * Math.pow(retry.backoffFactor, attemptCount)
      core.info(
        `Request to ${url} failed: ${lastError?.message}. Retrying in ${retryDelayMs}ms... (${attemptCount + 1}/${retry.maxRetries})`
      )
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
    }

    attemptCount++
  }

  // If we've exhausted all retries, throw the last error
  throw lastError || new Error(`Failed after ${retry.maxRetries} retries`)
}

/**
 * Makes an API request with retries and returns the parsed JSON response or undefined on error.
 * Will retry on all error status codes except those specified in nonRetryStatusCodes.
 *
 * @template T - The expected type of the response data
 * @param {string} url - The URL to request
 * @param {RequestInit} options - Fetch options (method, headers, body, etc.)
 * @param {Partial<RetryOptions>} retryOptions - Options for the retry mechanism (optional)
 * @returns {Promise<T | undefined>} - The parsed response data or undefined on error
 */
export async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
  retryOptions: Partial<RetryOptions> = {}
): Promise<T | undefined> {
  try {
    // Set default headers if not specified
    if (!options.headers) {
      options.headers = {
        'Content-Type': 'application/json',
      }
    }

    // Add auth token if available and not already set
    const authHeaders = options.headers as Record<string, string>
    if (process.env.K6_CLOUD_TOKEN && !authHeaders['Authorization']) {
      authHeaders['Authorization'] = `Token ${process.env.K6_CLOUD_TOKEN}`
    }

    // Use our retry mechanism
    const response = await fetchWithRetry(url, options, retryOptions)

    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text()
      core.info(
        `API request to ${url} failed with status ${response.status}: ${response.statusText}`
      )
      core.info(`Response: ${errorText}`)
      return undefined
    }

    // Parse and return the JSON response
    const responseText = await response.text()
    try {
      return JSON.parse(responseText) as T
    } catch {
      return responseText as T
    }
  } catch (error) {
    core.error(
      `Exception during API request to ${url}: ${error instanceof Error ? error.message : String(error)}`
    )
    return undefined
  }
}
