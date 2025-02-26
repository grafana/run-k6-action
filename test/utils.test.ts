import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findTestsToRun, isDirectory } from '../src/utils';

describe('utils', () => {
  // Create a temporary test directory structure in the system temp directory
  const tempDir = path.join(os.tmpdir(), `k6-action-test-${Date.now()}`);
  const tempFile = path.join(tempDir, 'test-file.js');
  const tempSubDir = path.join(tempDir, 'sub-dir');

  // Set up temporary files and directories before tests
  beforeAll(() => {
    // Create test directory structure
    fs.ensureDirSync(tempDir);
    fs.ensureDirSync(tempSubDir);
    fs.writeFileSync(tempFile, 'console.log("test file");');
  });

  // Clean up after tests
  afterAll(() => {
    // Remove test directory and all contents
    fs.removeSync(tempDir);
  });

  describe('isDirectory', () => {
    it('should return true for a directory', () => {
      expect(isDirectory(tempDir)).toBe(true);
      expect(isDirectory(tempSubDir)).toBe(true);
    });

    it('should return false for a file', () => {
      expect(isDirectory(tempFile)).toBe(false);
    });

    it('should return false for a non-existent path', () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist');
      expect(isDirectory(nonExistentPath)).toBe(false);
    });
  });

  describe('findTestsToRun', () => {
    it('should find test files in a directory', async () => {
      // Create some test files in the temp directory
      const testFile1 = path.join(tempDir, 'test1.js');
      const testFile2 = path.join(tempSubDir, 'test2.js');
      fs.writeFileSync(testFile1, 'console.log("test1");');
      fs.writeFileSync(testFile2, 'console.log("test2");');

      // Test with a glob pattern
      const testFiles = await findTestsToRun(`${tempDir}/**/*.js`);

      // Verify results
      expect(testFiles).toContain(testFile1);
      expect(testFiles).toContain(testFile2);
      expect(testFiles).toContain(tempFile);
      expect(testFiles.length).toBe(3);
    });

    it('should return an empty array for non-matching patterns', async () => {
      const testFiles = await findTestsToRun(`${tempDir}/**/*.xyz`);
      expect(testFiles).toEqual([]);
    });

    it('should return an empty array for a non-existent path', async () => {
      const testFiles = await findTestsToRun(`${tempDir}/does-not-exist/**/*.js`);
      expect(testFiles).toEqual([]);
    });

    it('should return subset of files that match the pattern', async () => {
      const testFile1 = path.join(tempDir, 'subsettest1.js');
      const testFile2 = path.join(tempDir, 'subsettest2.js');
      const testFile3 = path.join(tempDir, 'test3.js');
      fs.writeFileSync(testFile1, 'console.log("test1");');
      fs.writeFileSync(testFile2, 'console.log("test2");');
      fs.writeFileSync(testFile3, 'console.log("test3");');

      const testFiles = await findTestsToRun(`${tempDir}/subset*.js`);
      expect(testFiles).toEqual([testFile1, testFile2]);
    });
  });
});