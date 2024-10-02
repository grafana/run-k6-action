import { TestRunUrlsMap } from './types';

const REGEX_EXPRESSIONS = {
    scriptPath: /^\s*script:\s*(.+)$/m,
    // output: https://k6cloud.grafana.net/a/k6-app/runs/123
    // output: cloud (https://k6cloud.grafana.net/a/k6-app/runs/2662254)
    output: /^\s*output:\s*(.+)$/m,
    outputCloudUrl: /cloud\s*\((.+)\)/,
    runningIteration: /running \(.*\), \d+\/\d+ VUs, \d+ complete and \d+ interrupted iterations/g,
    //  default   [  20% ] 10 VUs  1.0s/5s
    // createBrowser   [  61% ] 035/500 VUs  0m36.5s/1m0s  5.00 iters/s
    executionProgress: /\[\s*(\d+)%\s*\]\s*\d+(\/\d+)? VUs/g,
    // Init   [   0% ] Loading test script...
    // Init   [   0% ] Validating script options
    // Run    [  17% ] 14.0s/35s
    // Run    [   0% ] Initializing
    cloudRunExecution: /Init|Run\s+\[\s+\d+%\s+\]/g
},
    TEST_RUN_PROGRESS_MSG_REGEXES = [
        REGEX_EXPRESSIONS.runningIteration,
        REGEX_EXPRESSIONS.executionProgress,
        REGEX_EXPRESSIONS.cloudRunExecution
    ];


function extractTestRunUrl(data: string, testRunUrlsMap: TestRunUrlsMap): boolean {
    /**
     * This function extracts the script path and output URL from the k6 output.
     * It then adds the script path and output URL to the testRunUrlsMap which is a reference to
     * an object passed from the main function to store test run urls mapped to corresponding test script.
     *
     * @param {string} data - The k6 command output data as string
     * @param {TestRunUrlsMap} testRunUrlsMap - The map containing the script path and output URL
     *
     * @returns {boolean} - Returns true if the script path and output URL were successfully extracted and added to the map. Otherwise, returns false.
     *
     */

    // Extracting the script path
    const scriptMatch = data.match(REGEX_EXPRESSIONS.scriptPath);
    const scriptPath = scriptMatch ? scriptMatch[1] : null;

    // Extracting the output URL
    const outputMatch = data.match(REGEX_EXPRESSIONS.output);
    const output = outputMatch ? outputMatch[1] : null;
    const outputCloudUrlMatch = output ? output.match(REGEX_EXPRESSIONS.outputCloudUrl) : null;
    const outputCloudUrl = outputCloudUrlMatch ? outputCloudUrlMatch[1] : output;

    if (scriptPath && output) {
        testRunUrlsMap[scriptPath] = outputCloudUrl || '';
        return true;
    } else {
        return false;
    }
}


function checkIfK6ASCIIArt(data: string): boolean {
    /**
     * This function checks if the given data is the k6 ASCII art or not.
     *
     * @param {string} data - The data to check
     *
     * @returns {boolean} - Returns true if the data is the k6 ASCII art. Otherwise, returns false.
     *
     * The k6 ASCII art is as follows:
     *
     *
     *
     *          /\      |‾‾| /‾‾/   /‾‾/
     *     /\  /  \     |  |/  /   /  /
     *    /  \/    \    |     (   /   ‾‾\
     *   /          \   |  |\  \ |  (‾)  |
     *  / __________ \  |__| \__\ \_____/ .io
     *
     * To determine if the data is the k6 ASCII art, the function checks the following:
     * 1. The function checks if the data contains only the following characters:
     *      |, ' ', '\n', '/', '‾', '(', ')', '_', '.', 'i', 'o'
     *
     * 2. The function also checks if the data contains ".io" at the end.
     *
     * */

    if (!data.includes(".io")) {
        return false;
    }

    // During cloud execution, the ASCII art is printed with %0A instead of \n
    data = data.replace(/%0A/g, "\n");

    data = data.slice(0, data.indexOf(".io") + 3);

    let K6_ASCII_ART_CHARS = [
        '|', ' ', '\n', '/',
        '‾', '(', ')', '_',
        '.', 'i', 'o', '\\'
    ],
        dataChars = new Set(data);


    if (dataChars.size !== K6_ASCII_ART_CHARS.length) {
        return false;
    } else {
        for (let char of dataChars) {
            if (!K6_ASCII_ART_CHARS.includes(char)) {
                return false;
            }
        }
        return true;
    }
}

export function parseK6Output(data: Buffer, testRunUrlsMap: TestRunUrlsMap | null, totalTestRuns: number, debug: boolean): void {
    /*
    * This function is responsible for parsing the output of the k6 command.
    * It filters out the progress lines and logs the rest of the output.
    * It also extracts the test run URLs from the output.
    *
    * @param {Buffer} data - The k6 command output data
    * @param {TestRunUrlsMap | null} testRunUrlsMap - The map containing the script path and output URL. If null, the function will not extract test run URLs.
    * @param {number} totalTestRuns - The total number of test runs. This is used to determine when all test run URLs have been extracted.
    * @param {boolean} debug - A flag to determine if the k6 progress output should be shown or not.
    *
    * @returns {void}
    */

    const dataString = data.toString(),
        lines = dataString.split('\n');

    // Extract test run URLs
    if (testRunUrlsMap && Object.keys(testRunUrlsMap).length < totalTestRuns) {
        const testRunUrlExtracted = extractTestRunUrl(dataString, testRunUrlsMap),
            k6ASCIIArt = checkIfK6ASCIIArt(dataString);

        if ((testRunUrlExtracted || k6ASCIIArt) && !debug) {
            /*
                If either the test run URL was extracted successfully or the k6 ASCII art was found,
                and the k6 progress output is not to be shown, then return.
            */
            return;
        }
    }

    if (debug) {
        process.stdout.write(data);
    } else {
        const filteredLines = lines.filter((line) => {
            const isRegexMatch = TEST_RUN_PROGRESS_MSG_REGEXES.some((regex) => regex.test(line));

            return !isRegexMatch;
        });

        if (filteredLines.length < lines.length) {
            // ignore empty lines only when progress lines output was ignored.
            if (filteredLines.join("") === "") {
                return;
            }
        }
        process.stdout.write(filteredLines.join('\n'))
    }
}
