import type { TestMapping } from "./test-mapping.interface.js";
import type { ImpactCoverage } from "./impact-coverage.interface.js";
import { getRelatedTests, isTestFile } from "./test-mapping.js";

/**
 * Computes the coverage of the affected areas (§15 of the original document).
 *
 * Affected areas are the production files impacted by the change (test files
 * are not counted as areas, they are instruments). An area is covered if at
 * least one test imports it.
 */
export function computeImpactCoverage(
    affectedFiles: string[],
    mapping: TestMapping
): ImpactCoverage {
    const affected = affectedFiles.filter(f => !isTestFile(f));

    const uncoveredFiles = affected.filter(
        f => getRelatedTests(mapping, f).length === 0
    );
    const covered = affected.length - uncoveredFiles.length;
    const percentage = affected.length === 0
        ? 0
        : Math.round((covered / affected.length) * 100);

    return {
        affected: affected.length,
        covered,
        uncovered: uncoveredFiles.length,
        uncoveredFiles,
        percentage
    };
}