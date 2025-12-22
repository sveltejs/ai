import { describe, it, expect } from "vitest";
import { calculateUnitTestTotals, type SingleTestResult } from "./report.ts";

describe("calculateUnitTestTotals", () => {
  it("returns zeros for empty test array", () => {
    const result = calculateUnitTestTotals([]);
    expect(result).toEqual({ total: 0, passed: 0, failed: 0 });
  });

  it("calculates totals from single test", () => {
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
    expect(result).toEqual({ total: 5, passed: 4, failed: 1 });
  });

  it("aggregates totals from multiple tests", () => {
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
    expect(result).toEqual({ total: 0, passed: 0, failed: 0 });
  });
});
