// Common helper functions used in the action 
import { spawn } from 'child_process';

export async function validateTestPaths(testPaths: string[]): Promise<string[]> {
    /**
     * Validates the test paths by running `k6 inspect --execution-requirements` on each test file.
     * A test path is considered valid if the command returns an exit code of 0.
     *
     * @export
     * @param {string[]} testPaths - List of test paths to validate
     * @return {Promise<string[]>} - List of valid test paths
     */

    if (testPaths.length === 0) {
        throw new Error('No test files found')
    }

    console.log(`🔍 Validating test run files.`);

    const validK6TestPaths: string[] = [],
        command = "k6",
        defaultArgs = ["inspect", "--execution-requirements"];

    const allPromises = [] as any[];

    testPaths.forEach(async testPath => {
        const args = [...defaultArgs, testPath];

        const child = spawn(command, args, {
            stdio: ['inherit', 'ignore', 'inherit'], // 'ignore' is for stdout
            detached: false,
        });

        allPromises.push(new Promise<void>(resolve => {
            child.on('exit', (code: number, signal: string) => {
                if (code === 0) {
                    validK6TestPaths.push(testPath);
                }
                resolve();
            });
        }));
    });

    await Promise.all(allPromises);

    return validK6TestPaths;
}