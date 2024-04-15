import { TestResultUrlsMap } from './types';

const REGEX_EXPRESSIONS = {
    scriptPath: /^\s*script:\s*(.+)$/m,
    output: /^\s*output:\s*(.+)$/m,
    runningIteration: /running \(.*\), \d+\/\d+ VUs, \d+ complete and \d+ interrupted iterations/g,
    runProgress: /\[ *(\d+)% *\] *\d+ VUs/g
};


function extractTestRunUrl(data: string, testResultUrlsMap: TestResultUrlsMap): void {
    /**
     * This function extracts the script path and output URL from the k6 output.
     * It then adds the script path and output URL to the testResultUrlsMap which is a reference to 
     * an object passed from the main function to store test run urls mapped to corresponding test script.
     * 
     * @param {string} data - The k6 command output data as string
     * @param {TestResultUrlsMap} testResultUrlsMap - The map containing the script path and output URL
     * 
     * @returns {void}
     * 
     */

    // Extracting the script path
    const scriptMatch = data.match(REGEX_EXPRESSIONS.scriptPath);
    const scriptPath = scriptMatch ? scriptMatch[1] : null;

    // Extracting the output URL
    const outputMatch = data.match(REGEX_EXPRESSIONS.output);
    const output = outputMatch ? outputMatch[1] : null;

    if (scriptPath && output) {
        testResultUrlsMap[scriptPath] = output;
    }
}


export function parseK6Output(data: Buffer, testResultUrlsMap: TestResultUrlsMap | null, totalTestRuns: number): void {
    /*
    * This function is responsible for parsing the output of the k6 command. 
    * It filters out the progress lines and logs the rest of the output.
    * It also extracts the test run URLs from the output.
    * 
    * @param {Buffer} data - The k6 command output data
    * @param {TestResultUrlsMap | null} testResultUrlsMap - The map containing the script path and output URL. If null, the function will not extract test run URLs.
    * @param {number} totalTestRuns - The total number of test runs. This is used to determine when all test run URLs have been extracted.
    * 
    * @returns {void}
    */ 

    const dataString = data.toString(),
        lines = dataString.split('\n');
    
    // Extract test run URLs
    if (testResultUrlsMap && Object.keys(testResultUrlsMap).length < totalTestRuns) {
        extractTestRunUrl(dataString, testResultUrlsMap);
    }

    const filteredLines = lines.filter((line) => {
        const isRegexMatch = REGEX_EXPRESSIONS.runningIteration.test(line) || REGEX_EXPRESSIONS.runProgress.test(line);
        return !isRegexMatch;
    });

    if (filteredLines.length < lines.length) {
        // ignore empty lines only when progress lines output was ignored.
        if (filteredLines.join("") === "") {
            return;
        }
    }
    console.log(filteredLines.join('\n'))
}
