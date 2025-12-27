import { describe, it, expect } from "vitest";
import { calculateUnitTestTotals, calculateScore, type SingleTestResult } from "./report.ts";

describe("calculateScore", () => {
  it("returns 0 for zero total tests", () => {
    expect(calculateScore(0, 0)).toBe(0);
  });

  it("returns 100 for all tests passed", () => {
    expect(calculateScore(10, 10)).toBe(100);
    expect(calculateScore(20, 20)).toBe(100);
    expect(calculateScore(1, 1)).toBe(100);
  });

  it("returns 0 for no tests passed", () => {
    expect(calculateScore(0, 10)).toBe(0);
    expect(calculateScore(0, 5)).toBe(0);
  });

  it("returns 50 for half tests passed", () => {
    expect(calculateScore(5, 10)).toBe(50);
    expect(calculateScore(10, 20)).toBe(50);
  });

  it("rounds to nearest integer", () => {
    // 1/3 = 33.33... -> 33
    expect(calculateScore(1, 3)).toBe(33);
    // 2/3 = 66.66... -> 67
    expect(calculateScore(2, 3)).toBe(67);
    // 7/9 = 77.77... -> 78
    expect(calculateScore(7, 9)).toBe(78);
  });

  it("handles various percentages correctly", () => {
    expect(calculateScore(9, 10)).toBe(90);
    expect(calculateScore(3, 4)).toBe(75);
    expect(calculateScore(1, 4)).toBe(25);
    expect(calculateScore(24, 27)).toBe(89);
  });
});

describe("calculateUnitTestTotals", () => {
  it("returns zeros for empty test array", () => {
    const result = calculateUnitTestTotals([]);
    expect(result).toEqual({ total: 0, passed: 0, failed: 0, score: 0 });
  });

  it("calculates totals and score from single test", () => {
    const tests: SingleTestResult[] = [
      {
        testName: "test1",
        prompt: "prompt1",
        steps: [],
        resultWriteContent: null,
        verification: {
          testName: "test1",
          passed: true,
          numTests: 5,
          numPassed: 4,
          numFailed: 1,
          duration: 100,
        },
      },
    ];

    const result = calculateUnitTestTotals(tests);
    expect(result).toEqual({ total: 5, passed: 4, failed: 1, score: 80 });
  });

  it("aggregates totals from multiple tests and calculates correct score", () => {
    const tests: SingleTestResult[] = [
      {
        testName: "test1",
        prompt: "prompt1",
        steps: [],
        resultWriteContent: null,
        verification: {
          testName: "test1",
          passed: true,
          numTests: 3,
          numPassed: 3,
          numFailed: 0,
          duration: 100,
        },
      },
      {
        testName: "test2",
        prompt: "prompt2",
        steps: [],
        resultWriteContent: null,
        verification: {
          testName: "test2",
          passed: false,
          numTests: 4,
          numPassed: 2,
          numFailed: 2,
          duration: 150,
        },
      },
      {
        testName: "test3",
        prompt: "prompt3",
        steps: [],
        resultWriteContent: null,
        verification: {
          testName: "test3",
          passed: true,
          numTests: 2,
          numPassed: 2,
          numFailed: 0,
          duration: 50,
        },
      },
    ];

    const result = calculateUnitTestTotals(tests);
    expect(result).toEqual({
      total: 9, // 3 + 4 + 2
      passed: 7, // 3 + 2 + 2
      failed: 2, // 0 + 2 + 0
      score: 78, // 7/9 = 77.77... -> 78
    });
  });

  it("handles tests with null verification", () => {
    const tests: SingleTestResult[] = [
      {
        testName: "test1",
        prompt: "prompt1",
        steps: [],
        resultWriteContent: null,
        verification: {
          testName: "test1",
          passed: true,
          numTests: 5,
          numPassed: 5,
          numFailed: 0,
          duration: 100,
        },
      },
      {
        testName: "test2",
        prompt: "prompt2",
        steps: [],
        resultWriteContent: null,
        verification: null, // Skipped test
      },
      {
        testName: "test3",
        prompt: "prompt3",
        steps: [],
        resultWriteContent: null,
        verification: {
          testName: "test3",
          passed: false,
          numTests: 3,
          numPassed: 1,
          numFailed: 2,
          duration: 75,
        },
      },
    ];

    const result = calculateUnitTestTotals(tests);
    expect(result).toEqual({
      total: 8, // 5 + 0 + 3
      passed: 6, // 5 + 0 + 1
      failed: 2, // 0 + 0 + 2
      score: 75, // 6/8 = 75%
    });
  });

  it("handles all tests with null verification", () => {
    const tests: SingleTestResult[] = [
      {
        testName: "test1",
        prompt: "prompt1",
        steps: [],
        resultWriteContent: null,
        verification: null,
      },
      {
        testName: "test2",
        prompt: "prompt2",
        steps: [],
        resultWriteContent: null,
        verification: null,
      },
    ];

    const result = calculateUnitTestTotals(tests);
    expect(result).toEqual({ total: 0, passed: 0, failed: 0, score: 0 });
  });

  it("calculates 100% score when all tests pass", () => {
    const tests: SingleTestResult[] = [
      {
        testName: "test1",
        prompt: "prompt1",
        steps: [],
        resultWriteContent: null,
        verification: {
          testName: "test1",
          passed: true,
          numTests: 10,
          numPassed: 10,
          numFailed: 0,
          duration: 100,
        },
      },
      {
        testName: "test2",
        prompt: "prompt2",
        steps: [],
        resultWriteContent: null,
        verification: {
          testName: "test2",
          passed: true,
          numTests: 5,
          numPassed: 5,
          numFailed: 0,
          duration: 50,
        },
      },
    ];

    const result = calculateUnitTestTotals(tests);
    expect(result).toEqual({
      total: 15,
      passed: 15,
      failed: 0,
      score: 100,
    });
  });

  it("calculates 0% score when all tests fail", () => {
    const tests: SingleTestResult[] = [
      {
        testName: "test1",
        prompt: "prompt1",
        steps: [],
        resultWriteContent: null,
        verification: {
          testName: "test1",
          passed: false,
          numTests: 5,
          numPassed: 0,
          numFailed: 5,
          duration: 100,
        },
      },
    ];

    const result = calculateUnitTestTotals(tests);
    expect(result).toEqual({
      total: 5,
      passed: 0,
      failed: 5,
      score: 0,
    });
  });

  describe("validation failed handling", () => {
    it("counts all tests as failed when validationFailed is true, even if some passed", () => {
      const tests: SingleTestResult[] = [
        {
          testName: "test1",
          prompt: "prompt1",
          steps: [],
          resultWriteContent: null,
          verification: {
            testName: "test1",
            passed: false,
            numTests: 5,
            numPassed: 4, // 4 tests actually passed
            numFailed: 1,
            duration: 100,
            validationFailed: true, // But validation failed
          },
        },
      ];

      const result = calculateUnitTestTotals(tests);
      expect(result).toEqual({
        total: 5, // Total is still 5
        passed: 0, // But passed is 0 because validation failed
        failed: 5, // All 5 counted as failed
        score: 0, // Score is 0%
      });
    });

    it("mixes validation-failed and normal tests correctly", () => {
      const tests: SingleTestResult[] = [
        {
          testName: "test1",
          prompt: "prompt1",
          steps: [],
          resultWriteContent: null,
          verification: {
            testName: "test1",
            passed: true,
            numTests: 3,
            numPassed: 3,
            numFailed: 0,
            duration: 100,
            // No validationFailed - normal test
          },
        },
        {
          testName: "test2",
          prompt: "prompt2",
          steps: [],
          resultWriteContent: null,
          verification: {
            testName: "test2",
            passed: false,
            numTests: 4,
            numPassed: 3, // 3 actually passed
            numFailed: 1,
            duration: 150,
            validationFailed: true, // But validation failed
          },
        },
        {
          testName: "test3",
          prompt: "prompt3",
          steps: [],
          resultWriteContent: null,
          verification: {
            testName: "test3",
            passed: false,
            numTests: 2,
            numPassed: 1,
            numFailed: 1,
            duration: 50,
            // No validationFailed - normal failed test
          },
        },
      ];

      const result = calculateUnitTestTotals(tests);
      expect(result).toEqual({
        total: 9, // 3 + 4 + 2
        passed: 4, // 3 (from test1) + 0 (from test2, validation failed) + 1 (from test3)
        failed: 5, // 0 (from test1) + 4 (all from test2) + 1 (from test3)
        score: 44, // 4/9 = 44.44... -> 44
      });
    });

    it("handles validationFailed: false the same as no validationFailed", () => {
      const tests: SingleTestResult[] = [
        {
          testName: "test1",
          prompt: "prompt1",
          steps: [],
          resultWriteContent: null,
          verification: {
            testName: "test1",
            passed: true,
            numTests: 5,
            numPassed: 4,
            numFailed: 1,
            duration: 100,
            validationFailed: false, // Explicitly false
          },
        },
      ];

      const result = calculateUnitTestTotals(tests);
      expect(result).toEqual({
        total: 5,
        passed: 4, // Uses actual passed count
        failed: 1, // Uses actual failed count
        score: 80,
      });
    });

    it("handles all tests with validationFailed", () => {
      const tests: SingleTestResult[] = [
        {
          testName: "test1",
          prompt: "prompt1",
          steps: [],
          resultWriteContent: null,
          verification: {
            testName: "test1",
            passed: false,
            numTests: 5,
            numPassed: 5, // All passed
            numFailed: 0,
            duration: 100,
            validationFailed: true,
          },
        },
        {
          testName: "test2",
          prompt: "prompt2",
          steps: [],
          resultWriteContent: null,
          verification: {
            testName: "test2",
            passed: false,
            numTests: 3,
            numPassed: 2,
            numFailed: 1,
            duration: 150,
            validationFailed: true,
          },
        },
      ];

      const result = calculateUnitTestTotals(tests);
      expect(result).toEqual({
        total: 8, // 5 + 3
        passed: 0, // All 0 because all validation failed
        failed: 8, // All 8 counted as failed
        score: 0, // 0%
      });
    });
  });
});
