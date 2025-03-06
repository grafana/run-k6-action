import * as core from '@actions/core'
import { ChildProcess } from 'child_process'
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest'
import * as githubHelper from '../src/githubHelper'
import { run } from '../src/index'
import * as k6helper from '../src/k6helper'
import * as utils from '../src/utils'

// Mock dependencies
vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  setFailed: vi.fn(),
  debug: vi.fn(),
}))

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
    killed: false,
    kill: vi.fn(),
  })),
}))

vi.mock('../src/utils', () => ({
  findTestsToRun: vi.fn(),
}))

vi.mock('../src/k6helper', () => ({
  validateTestPaths: vi.fn(),
  executeRunK6Command: vi.fn(),
  generateK6RunCommand: vi.fn(),
  isCloudIntegrationEnabled: vi.fn(),
  cleanScriptPath: vi.fn(),
}))

vi.mock('../src/githubHelper', () => ({
  generatePRComment: vi.fn(),
}))

type MockChildProcess = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: Mock<any[], any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stdout: { on: Mock<any[], any> }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stderr: { on: Mock<any[], any> }
  pid: number
  killed: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kill: Mock<any[], any>
}

describe('run function', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should run k6 tests successfully with parallel=true', async () => {
    // Mock input values
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'path') return 'test/*.js'
      if (name === 'flags') return '--vus=10'
      if (name === 'inspect-flags') return ''
      return ''
    })

    vi.mocked(core.getBooleanInput).mockImplementation((name) => {
      if (name === 'parallel') return true
      if (name === 'fail-fast') return false
      if (name === 'cloud-run-locally') return false
      if (name === 'only-verify-scripts') return false
      if (name === 'cloud-comment-on-pr') return false
      if (name === 'debug') return false
      return false
    })

    // Mock test paths
    vi.mocked(utils.findTestsToRun).mockResolvedValue(['test1.js', 'test2.js'])
    vi.mocked(k6helper.validateTestPaths).mockResolvedValue([
      'test1.js',
      'test2.js',
    ])
    vi.mocked(k6helper.isCloudIntegrationEnabled).mockReturnValue(false)
    vi.mocked(k6helper.generateK6RunCommand).mockImplementation(
      (path) => `k6 run ${path}`
    )

    // Create a mock child process with expected behavior
    const mockChildProcess: MockChildProcess = {
      on: vi.fn((event, callback) => {
        if (event === 'exit') {
          // Simulate successful exit
          callback(0, '')
        }
        return mockChildProcess
      }),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      pid: 123,
      killed: false,
      kill: vi.fn(),
    }

    vi.mocked(k6helper.executeRunK6Command).mockReturnValue(
      mockChildProcess as unknown as ChildProcess
    )

    // Run the function
    await run()

    // Verify the test run flow
    expect(utils.findTestsToRun).toHaveBeenCalledWith('test/*.js')
    expect(k6helper.validateTestPaths).toHaveBeenCalledWith(
      ['test1.js', 'test2.js'],
      []
    )
    expect(k6helper.isCloudIntegrationEnabled).toHaveBeenCalled()
    expect(k6helper.generateK6RunCommand).toHaveBeenCalledTimes(2)
    expect(k6helper.executeRunK6Command).toHaveBeenCalledTimes(2)
    expect(console.log).toHaveBeenCalledWith('✅ Test passed')
  })

  it('should run k6 tests successfully with parallel=false', async () => {
    // Mock input values
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'path') return 'test/*.js'
      if (name === 'flags') return '--vus=10'
      if (name === 'inspect-flags') return ''
      return ''
    })

    vi.mocked(core.getBooleanInput).mockImplementation((name) => {
      if (name === 'parallel') return false
      if (name === 'fail-fast') return false
      if (name === 'cloud-run-locally') return false
      if (name === 'only-verify-scripts') return false
      if (name === 'cloud-comment-on-pr') return false
      if (name === 'debug') return false
      return false
    })

    // Mock test paths
    vi.mocked(utils.findTestsToRun).mockResolvedValue(['test1.js', 'test2.js'])
    vi.mocked(k6helper.validateTestPaths).mockResolvedValue([
      'test1.js',
      'test2.js',
    ])
    vi.mocked(k6helper.isCloudIntegrationEnabled).mockReturnValue(false)
    vi.mocked(k6helper.generateK6RunCommand).mockImplementation(
      (path) => `k6 run ${path}`
    )

    // Create a mock child process with expected behavior
    const mockChildProcess: MockChildProcess = {
      on: vi.fn((event, callback) => {
        if (event === 'exit') {
          // Simulate successful exit
          callback(0, '')
        }
        return mockChildProcess
      }),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      pid: 123,
      killed: false,
      kill: vi.fn(),
    }

    vi.mocked(k6helper.executeRunK6Command).mockReturnValue(
      mockChildProcess as unknown as ChildProcess
    )

    // Run the function
    await run()

    // Verify the test run flow
    expect(utils.findTestsToRun).toHaveBeenCalledWith('test/*.js')
    expect(k6helper.validateTestPaths).toHaveBeenCalledWith(
      ['test1.js', 'test2.js'],
      []
    )
    expect(k6helper.isCloudIntegrationEnabled).toHaveBeenCalled()
    expect(k6helper.generateK6RunCommand).toHaveBeenCalledTimes(2)
    expect(k6helper.executeRunK6Command).toHaveBeenCalledTimes(2)
    expect(console.log).toHaveBeenCalledWith('✅ Test passed')
  })

  it('should handle no valid test files', async () => {
    // Mock input values
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'path') return 'test/*.js'
      return ''
    })

    vi.mocked(core.getBooleanInput).mockReturnValue(false)

    // Mock test paths
    vi.mocked(utils.findTestsToRun).mockResolvedValue(['test1.js', 'test2.js'])
    vi.mocked(k6helper.validateTestPaths).mockResolvedValue([])

    // Run the function
    await run()

    // Verify error handling
    expect(core.setFailed).toHaveBeenCalledWith('No valid test files found')
  })

  it('should handle no test files found', async () => {
    // Mock input values
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'path') return 'test/*.js'
      return ''
    })

    vi.mocked(core.getBooleanInput).mockReturnValue(false)

    // Mock no test paths
    vi.mocked(utils.findTestsToRun).mockResolvedValue([])

    // Run the function
    await run()

    // Verify error handling
    expect(core.setFailed).toHaveBeenCalledWith('No test files found')
  })

  it('should skip test execution if only-verify-scripts is true', async () => {
    // Mock input values
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'path') return 'test/*.js'
      return ''
    })

    vi.mocked(core.getBooleanInput).mockImplementation((name) => {
      if (name === 'only-verify-scripts') return true
      return false
    })

    // Mock test paths
    vi.mocked(utils.findTestsToRun).mockResolvedValue(['test1.js', 'test2.js'])
    vi.mocked(k6helper.validateTestPaths).mockResolvedValue([
      'test1.js',
      'test2.js',
    ])

    // Run the function
    await run()

    // Verify test execution is skipped
    expect(k6helper.executeRunK6Command).not.toHaveBeenCalled()
    expect(console.log).toHaveBeenCalledWith(
      '🔍 Only verifying scripts. Skipping test execution'
    )
  })

  it('should handle failed tests with fail-fast=true', async () => {
    // Mock process.exit
    const mockExit = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    // Mock input values
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'path') return 'test/*.js'
      return ''
    })

    vi.mocked(core.getBooleanInput).mockImplementation((name) => {
      if (name === 'parallel') return true
      if (name === 'fail-fast') return true
      return false
    })

    // Mock test paths
    vi.mocked(utils.findTestsToRun).mockResolvedValue(['test1.js', 'test2.js'])
    vi.mocked(k6helper.validateTestPaths).mockResolvedValue([
      'test1.js',
      'test2.js',
    ])
    vi.mocked(k6helper.isCloudIntegrationEnabled).mockReturnValue(false)
    vi.mocked(k6helper.generateK6RunCommand).mockImplementation(
      (path) => `k6 run ${path}`
    )

    // Create a mock child process that fails
    const mockChildProcess: MockChildProcess = {
      on: vi.fn((event, callback) => {
        if (event === 'exit') {
          // Simulate failed exit
          callback(1, '')
        }
        return mockChildProcess
      }),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      pid: 123,
      killed: false,
      kill: vi.fn(),
    }

    vi.mocked(k6helper.executeRunK6Command).mockReturnValue(
      mockChildProcess as unknown as ChildProcess
    )

    // Run the function
    await run()

    // Verify fail-fast behavior
    expect(console.log).toHaveBeenCalledWith(
      '🚨 Fail fast enabled. Stopping further tests.'
    )
    expect(mockExit).toHaveBeenCalledWith(1)

    // Restore process.exit mock
    mockExit.mockRestore()
  })

  it('should handle failed tests with fail-fast=false', async () => {
    // Mock process.exit
    const mockExit = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    // Mock input values
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'path') return 'test/*.js'
      return ''
    })

    vi.mocked(core.getBooleanInput).mockImplementation((name) => {
      if (name === 'parallel') return false
      if (name === 'fail-fast') return false
      return false
    })

    // Mock test paths
    vi.mocked(utils.findTestsToRun).mockResolvedValue(['test1.js', 'test2.js'])
    vi.mocked(k6helper.validateTestPaths).mockResolvedValue([
      'test1.js',
      'test2.js',
    ])
    vi.mocked(k6helper.isCloudIntegrationEnabled).mockReturnValue(false)
    vi.mocked(k6helper.generateK6RunCommand).mockImplementation(
      (path) => `k6 run ${path}`
    )

    // Create a mock child process that fails
    const mockChildProcess: MockChildProcess = {
      on: vi.fn((event, callback) => {
        if (event === 'exit') {
          // Simulate failed exit
          callback(1, '')
        }
        return mockChildProcess
      }),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      pid: 123,
      killed: false,
      kill: vi.fn(),
    }

    vi.mocked(k6helper.executeRunK6Command).mockReturnValue(
      mockChildProcess as unknown as ChildProcess
    )

    // Run the function
    await run()

    // Verify non-fail-fast behavior
    expect(console.log).toHaveBeenCalledWith(
      '🚨 Test failed with code: 1 and signal: '
    )
    expect(console.log).toHaveBeenCalledWith('🚨 Some tests failed')
    expect(mockExit).toHaveBeenCalledWith(1)

    // Restore process.exit mock
    mockExit.mockRestore()
  })

  it('should handle cloud integration with PR comment', async () => {
    // Mock input values
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'path') return 'test/*.js'
      return ''
    })

    vi.mocked(core.getBooleanInput).mockImplementation((name) => {
      if (name === 'parallel') return true
      if (name === 'cloud-comment-on-pr') return true
      return false
    })

    // Mock test paths
    vi.mocked(utils.findTestsToRun).mockResolvedValue(['test1.js'])
    vi.mocked(k6helper.validateTestPaths).mockResolvedValue(['test1.js'])
    vi.mocked(k6helper.isCloudIntegrationEnabled).mockReturnValue(true)
    vi.mocked(k6helper.generateK6RunCommand).mockReturnValue(
      'k6 cloud test1.js'
    )
    vi.mocked(k6helper.cleanScriptPath).mockReturnValue('test1.js')
    vi.mocked(githubHelper.generatePRComment).mockResolvedValue()

    // Create a mock child process that handles cloud URL extraction
    const mockChildProcess: MockChildProcess = {
      on: vi.fn((event, callback) => {
        if (event === 'exit') {
          // Create a test results map directly
          callback(0, '')
        }
        return mockChildProcess
      }),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      pid: 123,
      killed: false,
      kill: vi.fn(),
    }

    vi.mocked(k6helper.executeRunK6Command).mockReturnValue(
      mockChildProcess as unknown as ChildProcess
    )

    // Run the function
    await run()

    // Verify cloud integration behavior
    expect(k6helper.isCloudIntegrationEnabled).toHaveBeenCalled()
    expect(k6helper.generateK6RunCommand).toHaveBeenCalledWith(
      'test1.js',
      '',
      true,
      false
    )
  })
})
