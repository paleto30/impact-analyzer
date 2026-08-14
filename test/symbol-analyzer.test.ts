import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { SymbolAnalyzer } from "../src/engine/analyzer/symbol-analyzer.js";

const SIMPLE = path.resolve("test/fixtures/simple-project");
const COVERAGE = path.resolve("test/fixtures/test-coverage");

describe("SymbolAnalyzer", () => {
    const analyzer = new SymbolAnalyzer(SIMPLE);

    describe("getModifiedSymbolNames", () => {
        it("marks a symbol when modified lines intersect its range", () => {
            // a() spans lines 2-5 of A.ts
            const modified = analyzer.getModifiedSymbolNames("A.ts", ["a"], new Set([3]));
            assert.deepEqual(modified, new Set(["a"]));
        });

        it("returns empty when modified lines are outside the symbol range", () => {
            const modified = analyzer.getModifiedSymbolNames("A.ts", ["a"], new Set([1]));
            assert.deepEqual(modified, new Set());
        });

        it("returns empty when there are no modified lines", () => {
            const modified = analyzer.getModifiedSymbolNames("A.ts", ["a"], new Set());
            assert.deepEqual(modified, new Set());
        });

        it("ignores unknown symbols and missing files", () => {
            assert.deepEqual(
                analyzer.getModifiedSymbolNames("A.ts", ["nonexistent"], new Set([3])),
                new Set()
            );
            assert.deepEqual(
                analyzer.getModifiedSymbolNames("missing.ts", ["a"], new Set([3])),
                new Set()
            );
        });

        it("detects modified classes by their range", () => {
            const paymentFile = path.join(COVERAGE, "payment/PaymentService.ts");
            const classLine = readFileSync(paymentFile, "utf8")
                .split("\n")
                .findIndex(line => line.includes("class PaymentService")) + 1;

            const classAnalyzer = new SymbolAnalyzer(COVERAGE);
            const modified = classAnalyzer.getModifiedSymbolNames(
                "payment/PaymentService.ts",
                ["PaymentService"],
                new Set([classLine])
            );
            assert.deepEqual(modified, new Set(["PaymentService"]));
        });
    });

    describe("analyzeSymbolImpact", () => {
        it("finds the consumers of a modified symbol with line and snippet", () => {
            // b() is consumed by A.ts (import at line 1 and call at line 4)
            const impacts = analyzer.analyzeSymbolImpact("B.ts", ["b"]);
            assert.equal(impacts.length, 1);
            assert.equal(impacts[0]?.symbolName, "b");
            assert.equal(impacts[0]?.filePath, "B.ts");

            const consumers = impacts[0]?.consumers ?? [];
            assert.equal(consumers.length, 2);
            assert.ok(consumers.every(c => c.filePath === "A.ts"));
            assert.deepEqual(
                consumers.map(c => c.line).sort(),
                [1, 4]
            );
            assert.ok(consumers.every(c => c.snippet.length > 0));
        });

        it("returns an impact with no consumers for symbols without consumers", () => {
            const impacts = analyzer.analyzeSymbolImpact("A.ts", ["a"]);
            assert.equal(impacts.length, 1);
            assert.deepEqual(impacts[0]?.consumers, []);
        });

        it("returns no impacts for unknown symbols or missing files", () => {
            assert.deepEqual(analyzer.analyzeSymbolImpact("A.ts", ["nonexistent"]), []);
            assert.deepEqual(analyzer.analyzeSymbolImpact("missing.ts", ["a"]), []);
        });

        it("filters out symbols whose range does not intersect the modified lines", () => {
            // b() spans lines 2-4 of B.ts; line 1 is outside
            const impacts = analyzer.analyzeSymbolImpact("B.ts", ["b"], new Set([1]));
            assert.deepEqual(impacts, []);
        });

        it("keeps consumers when the modified lines intersect the symbol", () => {
            const impacts = analyzer.analyzeSymbolImpact("B.ts", ["b"], new Set([3]));
            assert.equal(impacts.length, 1);
            assert.ok((impacts[0]?.consumers ?? []).length > 0);
        });

        it("does not report the definition site as a consumer", () => {
            const impacts = analyzer.analyzeSymbolImpact("B.ts", ["b"]);
            const consumerLines = impacts[0]?.consumers.map(c => c.line) ?? [];
            assert.ok(!consumerLines.includes(2), "definition line of b() must be excluded");
        });
    });
});