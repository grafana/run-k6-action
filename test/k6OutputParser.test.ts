import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseK6Output } from '../src/k6OutputParser';
import { TestRunUrlsMap } from '../src/types';

describe('parseK6Output', () => {
  beforeEach(() => {
    // Mock console output
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract test run URL when output contains script path and output', () => {
    const testRunUrlsMap: TestRunUrlsMap = {};
    const data = Buffer.from(`
      script: /path/to/test.js
      output: cloud (https://k6cloud.grafana.net/runs/123)
    `);

    parseK6Output(data, testRunUrlsMap, 1, false);

    expect(testRunUrlsMap).toEqual({
      '/path/to/test.js': 'https://k6cloud.grafana.net/runs/123'
    });
    // No standard output should be written because we're extracting a URL and debug is false
    expect(process.stdout.write).not.toHaveBeenCalled();
  });

  it('should extract cloud URL when output contains direct URL format', () => {
    const testRunUrlsMap: TestRunUrlsMap = {};
    const data = Buffer.from(`
      script: /path/to/test.js
      output: https://k6cloud.grafana.net/runs/123
    `);

    parseK6Output(data, testRunUrlsMap, 1, false);

    expect(testRunUrlsMap).toEqual({
      '/path/to/test.js': 'https://k6cloud.grafana.net/runs/123'
    });
  });

  it('should write all output to stdout when debug is true', () => {
    const testRunUrlsMap: TestRunUrlsMap = {};
    const data = Buffer.from(`
      script: /path/to/test.js
      output: cloud (https://k6cloud.grafana.net/runs/123)
    `);

    parseK6Output(data, testRunUrlsMap, 1, true);

    expect(testRunUrlsMap).toEqual({
      '/path/to/test.js': 'https://k6cloud.grafana.net/runs/123'
    });
    expect(process.stdout.write).toHaveBeenCalledWith(data);
  });

  it('should filter out k6 progress lines when debug is false', () => {
    const testRunUrlsMap: TestRunUrlsMap = {};
    const data = Buffer.from(`
      Important output line 1
      running (10s), 10/10 VUs, 100 complete and 0 interrupted iterations
      Important output line 2
      default   [  20% ] 10 VUs  1.0s/5s
      Important output line 3
      Init   [   0% ] Loading test script...
    `);

    parseK6Output(data, testRunUrlsMap, 1, false);

    // Only non-progress lines should be written to stdout
    expect(process.stdout.write).toHaveBeenCalledWith(`
      Important output line 1
      Important output line 2
      Important output line 3
    `);
  });

  it('should not filter out k6 progress lines when debug is true', () => {
    const testRunUrlsMap: TestRunUrlsMap = {};
    const data = Buffer.from(`
      Important output line 1
      running (10s), 10/10 VUs, 100 complete and 0 interrupted iterations
      Important output line 2
    `);

    parseK6Output(data, testRunUrlsMap, 1, true);

    // All lines should be written to stdout
    expect(process.stdout.write).toHaveBeenCalledWith(data);
  });

  it('should recognize k6 ASCII art and not output it when debug is false', () => {
    const testRunUrlsMap: TestRunUrlsMap = {};
    const data = Buffer.from(`
          /\\      |‾‾| /‾‾/   /‾‾/
     /\\  /  \\     |  |/  /   /  /
    /  \\/    \\    |     (   /   ‾‾\\
   /          \\   |  |\\  \\ |  (‾)  |
  / __________ \\  |__| \\__\\ \\_____/ .io
    `);

    parseK6Output(data, testRunUrlsMap, 1, false);

    // ASCII art should not be written to stdout when debug is false
    expect(process.stdout.write).not.toHaveBeenCalled();
  });

  it('should write k6 ASCII art to stdout when debug is true', () => {
    const testRunUrlsMap: TestRunUrlsMap = {};
    const data = Buffer.from(`
          /\\      |‾‾| /‾‾/   /‾‾/
     /\\  /  \\     |  |/  /   /  /
    /  \\/    \\    |     (   /   ‾‾\\
   /          \\   |  |\\  \\ |  (‾)  |
  / __________ \\  |__| \\__\\ \\_____/ .io
    `);

    parseK6Output(data, testRunUrlsMap, 1, true);

    // ASCII art should be written to stdout when debug is true
    expect(process.stdout.write).toHaveBeenCalledWith(data);
  });

  it('should not extract test run URL when testRunUrlsMap is null', () => {
    const data = Buffer.from(`
      script: /path/to/test.js
      output: cloud (https://k6cloud.grafana.net/runs/123)
    `);

    parseK6Output(data, null, 1, false);

    // Should still output the data even though we're not extracting URLs
    expect(process.stdout.write).toHaveBeenCalled();
  });

  it('should not extract test run URL when all URLs have been extracted', () => {
    const testRunUrlsMap: TestRunUrlsMap = {
      '/path/to/test.js': 'https://k6cloud.grafana.net/runs/123'
    };
    const data = Buffer.from(`
      script: /path/to/test2.js
      output: cloud (https://k6cloud.grafana.net/runs/456)
    `);

    parseK6Output(data, testRunUrlsMap, 1, false);

    // Should not add more URLs since we already have the total number needed
    expect(testRunUrlsMap).toEqual({
      '/path/to/test.js': 'https://k6cloud.grafana.net/runs/123'
    });
    // Should still output the data
    expect(process.stdout.write).toHaveBeenCalled();
  });
});