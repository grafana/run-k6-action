import * as core from '@actions/core'
import { ChildProcess } from 'child_process'

import { sendAnalytics, UserSpecifiedAnalyticsData } from './analytics'
import { generatePRComment } from './githubHelper'
import {
  cleanScriptPath,
  executeRunK6Command,
  extractTestRunId,
  generateK6RunCommand,
  isCloudIntegrationEnabled,
  validateTestPaths,
} from './k6helper'
import { TestRunUrlsMap } from './types'
import { findTestsToRun } from './utils'

const TEST_PIDS: number[] = []

run()

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const testPaths = await findTestsToRun(
      core.getInput('path', { required: true })
    )
    const parallel = core.getBooleanInput('parallel')
    const failFast = core.getBooleanInput('fail-fast')
    const flags = core.getInput('flags')
    const inspectFlags = core.getInput('inspect-flags')
    const cloudRunLocally = core.getBooleanInput('cloud-run-locally')
    const onlyVerifyScripts = core.getBooleanInput('only-verify-scripts')
    const shouldCommentOnPR = core.getBooleanInput('cloud-comment-on-pr')
    const debug = core.getBooleanInput('debug')
    const disableAnalytics = core.getBooleanInput('disable-analytics')
    const allPromises: Promise<void>[] = []

    core.debug(`Flag to show k6 progress output set to: ${debug}`)

    core.debug(`🔍 Found following ${testPaths.length} test run files:`)
    testPaths.forEach((testPath, index) => {
      core.debug(`${index + 1}. ${testPath}`)
    })

    if (testPaths.length === 0) {
      throw new Error('No test files found')
    }

    const verifiedTestPaths = await validateTestPaths(
      testPaths,
      inspectFlags ? inspectFlags.split(' ') : []
    )

    if (verifiedTestPaths.length === 0) {
      throw new Error('No valid test files found')
    }

    console.log(
      `🧪 Found ${verifiedTestPaths.length} valid k6 tests out of total ${testPaths.length} test files.`
    )
    verifiedTestPaths.forEach((testPath, index) => {
      console.log(`  ${index + 1}. ${testPath}`)
    })

    if (onlyVerifyScripts) {
      console.log('🔍 Only verifying scripts. Skipping test execution')
      return
    }

    const isCloud = isCloudIntegrationEnabled()

    if (!disableAnalytics) {
      const userSpecifiedAnalyticsData: UserSpecifiedAnalyticsData = {
        totalTestScriptsExecuted: verifiedTestPaths.length,
        isCloudRun: isCloud,
        isUsingFlags: flags.length > 0,
        isUsingInspectFlags: inspectFlags.length > 0,
        failFast,
        commentOnPr: shouldCommentOnPR,
        parallelFlag: parallel,
        cloudRunLocally,
        onlyVerifyScripts,
      }

      sendAnalytics(userSpecifiedAnalyticsData)
    }

    const commands = testPaths.map((testPath) =>
        generateK6RunCommand(testPath, flags, isCloud, cloudRunLocally)
      ),
      TOTAL_TEST_RUNS = commands.length,
      TEST_RESULT_URLS_MAP = new Proxy(
        {},
        {
          set: (target: TestRunUrlsMap, key: string, value: string) => {
            target[key] = value
            if (Object.keys(target).length === TOTAL_TEST_RUNS) {
              // All test run cloud urls are available
              if (isCloud) {
                // Log test run URLs to the console
                console.log('🌐 Test run URLs:')
                for (const [script, url] of Object.entries(target)) {
                  console.log(`  ${cleanScriptPath(script)}: ${url}`)
                }
              }
            }
            return true
          },
        }
      )

    let allTestsPassed = true

    if (parallel) {
      const childProcesses = [] as ChildProcess[]

      commands.forEach((command) => {
        const child = executeRunK6Command(
          command,
          TOTAL_TEST_RUNS,
          TEST_RESULT_URLS_MAP,
          debug
        )
        childProcesses.push(child)
        if (child.pid !== undefined) {
          TEST_PIDS.push(child.pid)
        }
        allPromises.push(
          new Promise((resolve) => {
            child.on('exit', (code: number, signal: string) => {
              if (child.pid !== undefined) {
                const index = TEST_PIDS.indexOf(child.pid)
                if (index > -1) {
                  TEST_PIDS.splice(index, 1)
                }
              }
              if (code !== 0) {
                if (failFast) {
                  console.log('🚨 Fail fast enabled. Stopping further tests.')
                  childProcesses.forEach((child) => {
                    if (!child.killed) {
                      child.kill('SIGINT')
                    }
                  })
                  process.exit(1) // Exit parent process with failure status
                } else {
                  console.log(
                    `🚨 Test failed with code: ${code} and signal: ${signal}`
                  )
                  allTestsPassed = false
                }
              } else {
                console.log('✅ Test passed')
              }
              resolve()
            })
          })
        )
      })
    } else {
      for (const command of commands) {
        const child = executeRunK6Command(
          command,
          TOTAL_TEST_RUNS,
          TEST_RESULT_URLS_MAP,
          debug
        )
        if (child.pid !== undefined) {
          TEST_PIDS.push(child.pid)
        }
        await new Promise<void>((resolve) => {
          child.on('exit', (code: number, signal: string) => {
            if (child.pid !== undefined) {
              const index = TEST_PIDS.indexOf(child.pid)
              if (index > -1) {
                TEST_PIDS.splice(index, 1)
              }
            }
            if (code !== 0) {
              if (failFast) {
                console.log('🚨 Fail fast enabled. Stopping further tests.')
                process.exit(1) // Exit parent process with failure status
              } else {
                console.log(
                  `🚨 Test failed with code: ${code} and signal: ${signal}`
                )
                allTestsPassed = false
              }
            } else {
              console.log('✅ Test passed')
            }
            resolve()
          })
        })
      }
    }
    await Promise.all(allPromises)

    if (isCloud) {
      const testRunIds: Record<string, string> = {}
      for (const [scriptPath, testRunUrl] of Object.entries(TEST_RESULT_URLS_MAP)) {
        const testRunId = extractTestRunId(testRunUrl)
        if (testRunId) {
          testRunIds[scriptPath] = testRunId
        }
      }

      // Output the testRunIds as a JSON string
      core.setOutput('testRunIds', JSON.stringify(testRunIds))
      core.debug('TestRunIds have been set as an output successfully.')

      if (shouldCommentOnPR) {
        // Generate PR comment with test run URLs
        await generatePRComment(TEST_RESULT_URLS_MAP)
      }
    }    

    if (!allTestsPassed) {
      console.log('🚨 Some tests failed')
      process.exit(1)
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
    else if (error) core.setFailed(String(error))
  }
}

process.on('SIGINT', () => {
  console.log('🚨 Caught SIGINT. Stoping all tests')
  TEST_PIDS.forEach((pid) => {
    try {
      process.kill(pid, 'SIGINT')
    } catch {
      console.error(`Failed to kill process with PID ${pid}`)
    }
  })
  process.exit(1)
})
