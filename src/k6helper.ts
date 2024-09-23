// Common helper functions used in the action
import { spawn } from 'child_process';

export async function validateTestPaths(testPaths: string[], flags: string[]): Promise<string[]> {
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
        defaultArgs = ["inspect", "--execution-requirements", ...flags];

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

export function cleanScriptPath(scriptPath: string): string {
    /**
     * Cleans the script path by removing the base directory prefix if it is present.
     *
     * @export
     * @param {string} scriptPath - The script path to clean
     * @return {string} - Cleaned script path
     *
     * */
    const baseDir = process.env['GITHUB_WORKSPACE'] || '';
    const cleanedScriptPath = scriptPath.replace(baseDir, '');

    return cleanedScriptPath.trim();

}