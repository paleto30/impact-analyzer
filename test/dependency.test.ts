import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { buildDependencyGraph, findTransitiveDependents } from "../src/engine/graph/dependency.js";

const SIMPLE = path.resolve("test/fixtures/simple-project");
const COVERAGE = path.resolve("test/fixtures/test-coverage");
const CIRCULAR = path.resolve("test/fixtures/circular-dependencies");

describe("dependency graph", () => {
    it("builds the A -> B -> C chain", () => {
        const graph = buildDependencyGraph(SIMPLE);
        assert.ok(graph.dependents["B.ts"]?.includes("A.ts"), "A.ts imports B.ts");
        assert.ok(graph.dependents["C.ts"]?.includes("B.ts"), "B.ts imports C.ts");
        assert.equal(graph.dependents["A.ts"], undefined, "A.ts should have no dependents");
    });

    it("builds the forward imports index", () => {
        const graph = buildDependencyGraph(SIMPLE);
        assert.deepEqual(graph.imports["A.ts"], ["B.ts"]);
        assert.deepEqual(graph.imports["B.ts"], ["C.ts"]);
        assert.deepEqual(graph.imports["C.ts"], []);
    });

    it("detects consumers of PaymentService in the test-coverage fixture", () => {
        const graph = buildDependencyGraph(COVERAGE);
        const consumers = graph.dependents["payment/PaymentService.ts"];
        assert.ok(consumers?.includes("payment/CheckoutService.ts"));
        assert.ok(consumers?.includes("payment/InvoiceService.ts"));
        assert.ok(consumers?.includes("payment/PaymentService.test.ts"));
        assert.ok(consumers?.includes("payment/CheckoutService.test.ts"));
    });
});

describe("transitive dependents", () => {
    it("finds all transitive dependents with depth", () => {
        const graph = buildDependencyGraph(SIMPLE);

        const impact = findTransitiveDependents(graph, "C.ts");
        assert.deepEqual(impact.files.sort(), ["A.ts", "B.ts"]);
        assert.equal(impact.depthMap.get("B.ts"), 1);
        assert.equal(impact.depthMap.get("A.ts"), 2);
        assert.equal(impact.maxDepth, 2);

        const leafImpact = findTransitiveDependents(graph, "A.ts");
        assert.deepEqual(leafImpact.files, []);
        assert.equal(leafImpact.maxDepth, 0);
    });

    it("terminates on circular dependencies", () => {
        const graph = buildDependencyGraph(CIRCULAR);

        const impact = findTransitiveDependents(graph, "X.ts");
        assert.deepEqual(impact.files, ["Y.ts"]);
        assert.equal(impact.maxDepth, 1);

        assert.deepEqual(findTransitiveDependents(graph, "Y.ts").files, ["X.ts"]);
    });
});