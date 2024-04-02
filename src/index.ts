import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as fs from 'fs-extra'
import { spawn } from 'child_process'

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
        const cloudRunLocally = core.getInput('cloud-run-locally', { required: false }) === 'true'

        const isCloud = await isCloudIntegrationEnabled()

        const commands = testPaths.map(testPath => generateCommand(testPath))
        if (commands.length === 0) {
            throw new Error('No test files found')
        }

        let allTestsPassed = true;

        if (parallel) {
            const childProcesses = [] as any[];
            const exitPromises: Promise<void>[] = [];
            commands.forEach(command => {
                const child = runCommand(command);
                childProcesses.push(child);
                exitPromises.push(new Promise(resolve => {
                    child.on('exit', (code: number, signal: string) => {
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

            await Promise.all(exitPromises);
        } else {
            for (const command of commands) {
                const child = runCommand(command);
                await new Promise<void>(resolve => {
                    child.on('exit', (code: number, signal: string) => {
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
                });
            }
        }

        if (!allTestsPassed) {
            console.log('🚨 Some tests failed');
            process.exit(1);
        }

        function generateCommand(path: string): string {
            const args = [
                // `--address=""`, // Disable the REST API. THIS DOESN'T WORK???? TODO: Investigate
                '--quiet',
                ...(flags ? flags.split(' ') : []),
            ]
            if (isCloud && cloudRunLocally) {
                return `k6 cloud ${args.join(' ')} ${path}`
            } else {
                return `k6 run ${args.join(' ')}${(isCloud) ? [' --out=cloud'] : []} ${path}`
            }
        }

        function runCommand(command: string): any {
            const parts = command.split(' ');
            const cmd = parts[0];
            const args = parts.slice(1);

            console.log(`🤖 Running test: ${cmd} ${args.join(' ')}`);
            const child = spawn(cmd, args, {
                stdio: 'inherit', // piping all stdio to /dev/null
                detached: true,
                env: process.env,
            });

            return child;
        }
    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message)
    }
}

process.on('SIGINT', () => {
    console.log('🚨 Caught SIGINT. Exiting...');
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('🚨 Caught SIGTERM. Exiting...');
    process.exit(1);
})

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