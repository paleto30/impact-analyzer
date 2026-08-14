import type { RiskWeights } from "./risk.types.js";
import { CALLER_IMPACT_THRESHOLD, AFFECTED_FILES_THRESHOLD, DEPENDENCY_DEPTH_THRESHOLD, CHANGE_SIZE_THRESHOLD, LOW_MAX, MEDIUM_MAX, HIGH_MAX, MAX_SCORE, DEFAULT_RISK_WEIGHTS } from "./risk.constants.js";
import type { RiskFactors, RiskReason, RiskAssessment, RiskLevel } from "./risk.types.js";

export function classifyRisk(score: number): RiskLevel {
    if (score <= LOW_MAX) return "LOW";
    if (score <= MEDIUM_MAX) return "MEDIUM";
    if (score <= HIGH_MAX) return "HIGH";
    return "CRITICAL";
}

/**
 * Evaluates the risk deterministically (§16 of the original document).
 *
 * Each factor contributes points proportional to its saturation against a
 * reference threshold, capped by its weight. Weights are configurable and
 * must add up to 100.
 *
 *   - callerImpact: direct consumers of modified symbols (threshold 10)
 *   - affectedFiles: transitively reached files (threshold 15)
 *   - dependencyDepth: maximum impact depth levels (threshold 4)
 *   - testGaps: share of affected areas without tests
 *   - changeSize: modified lines (threshold 200)
 */
export function evaluateRisk(
    factors: RiskFactors,
    weights: RiskWeights = DEFAULT_RISK_WEIGHTS
): RiskAssessment {
    // Sanitize: partial weights (configured via JSON) are filled with 0
    const w = {
        callerImpact: weights.callerImpact ?? 0,
        affectedFiles: weights.affectedFiles ?? 0,
        dependencyDepth: weights.dependencyDepth ?? 0,
        testGaps: weights.testGaps ?? 0,
        changeSize: weights.changeSize ?? 0
    };

    const reasons: RiskReason[] = [];

    const callerImpact =
        Math.min(factors.uniqueConsumers / CALLER_IMPACT_THRESHOLD, 1) * w.callerImpact;
    if (factors.uniqueConsumers > 0) {
        reasons.push({
            label: `${factors.uniqueConsumers} consumer${factors.uniqueConsumers === 1 ? "" : "s"} of modified symbols`,
            points: Math.round(callerImpact)
        });
    }

    const affectedFiles =
        Math.min(factors.transitiveFiles / AFFECTED_FILES_THRESHOLD, 1) * w.affectedFiles;
    if (factors.transitiveFiles > 0) {
        reasons.push({
            label: `${factors.transitiveFiles} affected files (transitive reach)`,
            points: Math.round(affectedFiles)
        });
    }

    const dependencyDepth =
        Math.min(factors.maxDepth / DEPENDENCY_DEPTH_THRESHOLD, 1) * w.dependencyDepth;
    if (factors.maxDepth > 0) {
        reasons.push({
            label: `Impact reaches depth ${factors.maxDepth} dependency level${factors.maxDepth === 1 ? "" : "s"}`,
            points: Math.round(dependencyDepth)
        });
    }

    const testGaps = factors.affectedComponents === 0
        ? 0
        : (factors.uncoveredComponents / factors.affectedComponents) * w.testGaps;
    if (factors.uncoveredComponents > 0) {
        reasons.push({
            label: `${factors.uncoveredComponents} affected area${factors.uncoveredComponents === 1 ? "" : "s"} without detected tests`,
            points: Math.round(testGaps)
        });
    }

    const changeSize = Math.min(factors.changedLines / CHANGE_SIZE_THRESHOLD, 1) * w.changeSize;
    if (factors.changedLines > 0) {
        reasons.push({
            label: `${factors.changedLines} line${factors.changedLines === 1 ? "" : "s"} modified`,
            points: Math.round(changeSize)
        });
    }

    if (reasons.length === 0) {
        reasons.push({ label: "No impacted consumers detected", points: 0 });
    }

    const score = Math.min(
        MAX_SCORE,
        Math.round(callerImpact + affectedFiles + dependencyDepth + testGaps + changeSize)
    );

    return { score, level: classifyRisk(score), reasons };
}