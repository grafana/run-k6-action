import * as core from '@actions/core';
import * as glob from '@actions/glob';
import { spawn } from 'child_process';
import * as fs from 'fs-extra';
import { generatePRComment } from './githubHelper';
import { parseK6Output } from './k6OutputParser';
import { cleanScriptPath, validateTestPaths } from './k6helper';
import { TestRunUrlsMap } from './types';

const TEST_PIDS: number[] = [];

run()

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
    try {
        const testPaths = await findTestsToRun(core.getInput('path', { required: true }))
        const parallel = core.getInput('parallel', { required: false }) === 'true'
        const failFast = core.getInput('fail-fast', { required: false }) === 'true'
        const flags = core.getInput('flags', { required: false })
        const inspectFlags = core.getInput('inspect-flags', { required: false })
        const cloudRunLocally = core.getInput('cloud-run-locally', { required: false }) === 'true'
        const onlyVerifyScripts = core.getInput('only-verify-scripts', { required: false }) === 'true'
        const shouldCommentCloudTestRunUrlOnPR = core.getInput('cloud-comment-on-pr', { required: false }) === 'true'
        const debug = core.getInput('debug', { required: false }) === 'true'
        const allPromises: Promise<void>[] = [];

        core.debug(`Flag to show k6 progress output set to: ${debug}`);

        core.debug(`🔍 Found following ${testPaths.length} test run files:`);
        testPaths.forEach((testPath, index) => {
            core.debug(`${index + 1}. ${testPath}`);
        });

        if (testPaths.length === 0) {
            throw new Error('No test files found')
        }

                
        const verifiedTestPaths = await validateTestPaths(
            testPaths,
            inspectFlags ? inspectFlags.split(' ') : []
        );

        if (verifiedTestPaths.length === 0) {
            throw new Error('No valid test files found')
        }

        console.log(`🧪 Found ${verifiedTestPaths.length} valid K6 tests out of total ${testPaths.length} test files.`);
        verifiedTestPaths.forEach((testPath, index) => {
            console.log(`  ${index + 1}. ${testPath}`);
        });

        if (onlyVerifyScripts) {
            console.log('🔍 Only verifying scripts. Skipping test execution');
            return;
        }

        const isCloud = await isCloudIntegrationEnabled()

        const commands = testPaths.map(testPath => generateCommand(testPath)),
            TOTAL_TEST_RUNS = commands.length,
            TEST_RESULT_URLS_MAP = new Proxy({}, {
                set: (target: TestRunUrlsMap, key: string, value: string) => {
                    target[key] = value;
                    if (Object.keys(target).length === TOTAL_TEST_RUNS) {
                        // All test run cloud urls are available
                        if (isCloud) {
                            // Log test run URLs to the console
                            console.log('🌐 Test run URLs:');
                            for (const [script, url] of Object.entries(target)) {
                                console.log(`  ${cleanScriptPath(script)}: ${url}`);
                            }

                            if (shouldCommentCloudTestRunUrlOnPR) {
                                // Generate PR comment with test run URLs
                                allPromises.push(generatePRComment(target));
                            }
                        }
                    }
                    return true;
                }
            });

        let allTestsPassed = true;

        if (parallel) {
            const childProcesses = [] as any[];

            commands.forEach(command => {
                const child = runCommand(command);
                childProcesses.push(child);
                TEST_PIDS.push(child.pid);
                allPromises.push(new Promise(resolve => {
                    child.on('exit', (code: number, signal: string) => {
                        const index = TEST_PIDS.indexOf(child.pid);
                        if (index > -1) {
                            TEST_PIDS.splice(index, 1);
                        }
                        if (code !== 0) {
                            if (failFast) {
                                console.log('🚨 Fail fast enabled. Stopping further tests.');
                                childProcesses.forEach(child => {
                                    if (!child.killed) {
                                        child.kill('SIGINT');
                                    }
                                });
                                process.exit(1); // Exit parent process with failure status
                            } else {
                                console.log(`🚨 Test failed with code: ${code} and signal: ${signal}`);
                                allTestsPassed = false;
                            }
                        } else {
                            console.log('✅ Test passed');
                        }
                        resolve();
                    });
                }));
            });
        } else {
            for (const command of commands) {
                const child = runCommand(command);
                TEST_PIDS.push(child.pid);
                allPromises.push(new Promise<void>(resolve => {
                    child.on('exit', (code: number, signal: string) => {
                        const index = TEST_PIDS.indexOf(child.pid);
                        if (index > -1) {
                            TEST_PIDS.splice(index, 1);
                        }
                        if (code !== 0) {
                            if (failFast) {
                                console.log('🚨 Fail fast enabled. Stopping further tests.');
                                process.exit(1); // Exit parent process with failure status
                            } else {
                                console.log(`🚨 Test failed with code: ${code} and signal: ${signal}`);
                                allTestsPassed = false;
                            }
                        } else {
                            console.log('✅ Test passed');
                        }
                        resolve();
                    });
                }));
            }
        }
        await Promise.all(allPromises);

        if (!allTestsPassed) {
            console.log('🚨 Some tests failed');
            process.exit(1);
        }

        function generateCommand(path: string): string {
            let command;
            const args = [
                `--address=`,
                ...(flags ? flags.split(' ') : []),
            ]

            if (isCloud) {
                // Cloud execution is possible for the test
                if (cloudRunLocally) {
                    // Execute tests locally and upload results to cloud
                    command = "k6 run"
                    args.push(`--out=cloud`)
                } else {
                    // Execute tests in cloud
                    command = "k6 cloud"
                }
            } else {
                // Local execution
                command = "k6 run"
            }

            // Add path the arguments list
            args.push(path)

            // Append arguments to the command
            command = `${command} ${args.join(' ')}`

            core.debug("🤖 Generated command: " + command);
            return command;
        }

        function runCommand(command: string): any {
            const parts = command.split(' ');
            const cmd = parts[0];
            const args = parts.slice(1);

            console.log(`🤖 Running test: ${cmd} ${args.join(' ')}`);
            const child = spawn(cmd, args, {
                stdio: ['inherit'],
                detached: true,
                env: process.env,
            });
            // Parse k6 command output and extract test run URLs if running in cloud mode.
            // Also, print the output to the console, excluding the progress lines.
            child.stdout?.on('data', (data) => parseK6Output(data, TEST_RESULT_URLS_MAP, TOTAL_TEST_RUNS, debug));
            child.stderr?.on('data', (data) => process.stderr.write(`🚨 ${data.toString()}`));

            return child;
        }
    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message)
    }
}

process.on('SIGINT', () => {
    console.log('🚨 Caught SIGINT. Stoping all tests')
    TEST_PIDS.forEach(pid => {
        try {
            process.kill(pid, 'SIGINT');
        } catch (error) {
            console.error(`Failed to kill process with PID ${pid}`);
        }
    });
    process.exit(1);
});

async function isCloudIntegrationEnabled(): Promise<boolean> {
    if (process.env.K6_CLOUD_TOKEN === undefined || process.env.K6_CLOUD_TOKEN === '') {
        return false
    }

    if (process.env.K6_CLOUD_PROJECT_ID === undefined || process.env.K6_CLOUD_PROJECT_ID === '') {
        throw new Error('K6_CLOUD_PROJECT_ID must be set when K6_CLOUD_TOKEN is set')
    }

    return true
}

async function findTestsToRun(path: string): Promise<string[]> {
    const globber = await glob.create(path)
    const files = await globber.glob()
    return files.filter(file => !isDirectory(file))
}

function isDirectory(filepath: string): boolean {
    try {
        return fs.statSync(filepath).isDirectory();
    } catch (err) {
        // Ignore error
    }
    return false;
}