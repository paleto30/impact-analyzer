import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { buildTestMapping, getRelatedTests, isTestFile } from "../src/engine/testing/test-mapping.js";
import { computeImpactCoverage } from "../src/engine/testing/impact-coverage.js";
import { analyzeFile } from "../src/engine/parser/parser.js";

const COVERAGE = path.resolve("test/fixtures/test-coverage");

describe("test mapping", () => {
    it("detects test files by name", () => {
        assert.ok(isTestFile("PaymentService.test.ts"));
        assert.ok(isTestFile("foo.spec.tsx"));
        assert.ok(!isTestFile("PaymentService.ts"));
        assert.ok(!isTestFile("PaymentService.test.tsx.js"));
    });

    it("detects all test files in the fixture", () => {
        const mapping = buildTestMapping(COVERAGE);
        assert.deepEqual(
            mapping.testFiles.sort(),
            ["payment/CheckoutService.test.ts", "payment/PaymentService.test.ts"]
        );
    });

    it("maps tests to the files they import", () => {
        const mapping = buildTestMapping(COVERAGE);

        const paymentTests = getRelatedTests(mapping, "payment/PaymentService.ts");
        assert.ok(paymentTests.includes("payment/PaymentService.test.ts"));
        assert.ok(paymentTests.includes("payment/CheckoutService.test.ts"));

        const checkoutTests = getRelatedTests(mapping, "payment/CheckoutService.ts");
        assert.ok(checkoutTests.includes("payment/CheckoutService.test.ts"));

        const invoiceTests = getRelatedTests(mapping, "payment/InvoiceService.ts");
        assert.deepEqual(invoiceTests, [], "InvoiceService has no tests");
    });

    it("computes impact coverage over affected files", () => {
        const mapping = buildTestMapping(COVERAGE);

        const coverage = computeImpactCoverage(
            [
                "payment/CheckoutService.ts",
                "payment/InvoiceService.ts",
                "payment/PaymentService.test.ts",
                "payment/CheckoutService.test.ts"
            ],
            mapping
        );

        assert.equal(coverage.affected, 2, "test files are not counted as affected areas");
        assert.equal(coverage.covered, 1);
        assert.equal(coverage.uncovered, 1);
        assert.deepEqual(coverage.uncoveredFiles, ["payment/InvoiceService.ts"]);
        assert.equal(coverage.percentage, 50);
    });

    it("returns 0% coverage when nothing is covered", () => {
        const mapping = buildTestMapping(COVERAGE);
        const coverage = computeImpactCoverage(["payment/InvoiceService.ts"], mapping);
        assert.equal(coverage.percentage, 0);
        assert.equal(coverage.covered, 0);
    });

    it("excludes pure-contract files from the coverage metric when analyzed", () => {
        const mapping = buildTestMapping(COVERAGE);
        const analyses = new Map([
            [
                "payment/OrderStatus.interface.ts",
                analyzeFile(path.join(COVERAGE, "payment/OrderStatus.interface.ts"))
            ]
        ]);

        const coverage = computeImpactCoverage(
            ["payment/InvoiceService.ts", "payment/OrderStatus.interface.ts"],
            mapping,
            analyses
        );

        assert.equal(coverage.affected, 1, "interface-only files are not affected areas");
        assert.deepEqual(coverage.uncoveredFiles, ["payment/InvoiceService.ts"]);
        assert.equal(coverage.percentage, 0);
    });
});