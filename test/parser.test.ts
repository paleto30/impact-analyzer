import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { analyzeFile, getExportedSymbolNames } from "../src/engine/parser/parser.js";

const SIMPLE = path.resolve("test/fixtures/simple-project");

describe("parser", () => {
    it("detects exported functions in A.ts", () => {
        const analysis = analyzeFile(path.join(SIMPLE, "A.ts"));
        assert.deepEqual(analysis.exports.functions, ["a"]);
        assert.ok(analysis.imports.includes("./B.js"));
    });

    it("detects exported function in C.ts (leaf)", () => {
        const analysis = analyzeFile(path.join(SIMPLE, "C.ts"));
        assert.deepEqual(analysis.exports.functions, ["c"]);
        assert.deepEqual(analysis.imports, []);
    });

    it("detects classes and methods in the test-coverage fixture", () => {
        const analysis = analyzeFile(path.resolve("test/fixtures/test-coverage/payment/PaymentService.ts"));
        assert.deepEqual(analysis.exports.classes, [
            { name: "PaymentService", methods: ["calculate"] }
        ]);
    });

    it("flattens exported symbol names", () => {
        const analysis = analyzeFile(path.resolve("test/fixtures/test-coverage/payment/PaymentService.ts"));
        assert.deepEqual(getExportedSymbolNames(analysis), ["PaymentService"]);
    });
});