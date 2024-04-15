import { TestResultUrlsMap } from './types';

const REGEX_EXPRESSIONS = {
    scriptPath: /^\s*script:\s*(.+)$/m,
    output: /^\s*output:\s*(.+)$/m,
    runningIteration: /running \(.*\), \d+\/\d+ VUs, \d+ complete and \d+ interrupted iterations/g,
    //  default   [  20% ] 10 VUs  1.0s/5s  
    // createBrowser   [  61% ] 035/500 VUs  0m36.5s/1m0s  5.00 iters/s
    runProgress: /\[\s*(\d+)%\s*\]\s*\d+(\/\d+)? VUs/g
};


function extractTestRunUrl(data: string, testResultUrlsMap: TestResultUrlsMap): boolean {
    /**
     * This function extracts the script path and output URL from the k6 output.
     * It then adds the script path and output URL to the testResultUrlsMap which is a reference to 
     * an object passed from the main function to store test run urls mapped to corresponding test script.
     * 
     * @param {string} data - The k6 command output data as string
     * @param {TestResultUrlsMap} testResultUrlsMap - The map containing the script path and output URL
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

    if (scriptPath && output) {
        testResultUrlsMap[scriptPath] = output;
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
        if (extractTestRunUrl(dataString, testResultUrlsMap)) {
            // Test URL was extracted successfully and added to the map. 
            // Ignore further output parsing for this data.
            return;
        }

        if (checkIfK6ASCIIArt(dataString)) {
            // Ignore the k6 ASCII art.
            // Checking the k6 ASCII art here because it is printed at the start of execution, 
            // hence if all the test URLs are extracted, the ASCII art will not be printed. 
            return;
        }
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
