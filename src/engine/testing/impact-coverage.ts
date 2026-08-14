import type { TestMapping } from "./test-mapping.interface.js";
import type { ImpactCoverage } from "./impact-coverage.interface.js";
import type { FileAnalysis } from "../parser/file-analysis.interface.js";
import { getRelatedTests, isTestFile } from "./test-mapping.js";

/**
 * Computes the coverage of the affected areas (§15 of the original document).
 *
 * Affected areas are the production files impacted by the change (test files
 * are not counted as areas, they are instruments). An area is covered if at
 * least one test imports it.
 *
 * Files that only export contracts (interfaces/types/enums, no functions or
 * classes) are not testable by design, so they do not count as affected
 * areas when their analysis is available.
 */
export function computeImpactCoverage(
    affectedFiles: string[],
    mapping: TestMapping,
    analyses?: Map<string, FileAnalysis>
): ImpactCoverage {
    const affected = affectedFiles.filter(f => {
        if (isTestFile(f)) return false;

        const analysis = analyses?.get(f);
        if (
            analysis &&
            analysis.exports.functions.length === 0 &&
            analysis.exports.classes.length === 0
        ) {
            return false;
        }

        return true;
    });

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