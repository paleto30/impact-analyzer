export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskWeights {
    callerImpact: number;
    affectedFiles: number;
    dependencyDepth: number;
    testGaps: number;
    changeSize: number;
}

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
    callerImpact: 30,
    affectedFiles: 20,
    dependencyDepth: 15,
    testGaps: 20,
    changeSize: 15
};

export interface RiskFactors {
    uniqueConsumers: number;
    transitiveFiles: number;
    maxDepth: number;
    affectedComponents: number;
    uncoveredComponents: number;
    changedLines: number;
}

export interface RiskReason {
    label: string;
    points: number;
}

export interface RiskAssessment {
    score: number;
    level: RiskLevel;
    reasons: RiskReason[];
}

export function classifyRisk(score: number): RiskLevel {
    if (score <= 25) return "LOW";
    if (score <= 50) return "MEDIUM";
    if (score <= 75) return "HIGH";
    return "CRITICAL";
}

/**
 * Evalúa el riesgo de forma determinística (§16 del documento original).
 *
 * Cada factor aporta puntos proporcionales a su saturación contra un umbral
 * de referencia, limitados por su peso. Los pesos son configurables y deben
 * sumar 100.
 *
 *   - callerImpact: consumidores directos de símbolos modificados (umbral 10)
 *   - affectedFiles: archivos alcanzados transitivamente (umbral 15)
 *   - dependencyDepth: niveles de profundidad máxima del impacto (umbral 4)
 *   - testGaps: proporción de áreas afectadas sin tests
 *   - changeSize: líneas modificadas (umbral 200)
 */
export function evaluateRisk(
    factors: RiskFactors,
    weights: RiskWeights = DEFAULT_RISK_WEIGHTS
): RiskAssessment {
    // Saneo: los pesos parciales (configuración por JSON) se rellenan con 0
    const w = {
        callerImpact: weights.callerImpact ?? 0,
        affectedFiles: weights.affectedFiles ?? 0,
        dependencyDepth: weights.dependencyDepth ?? 0,
        testGaps: weights.testGaps ?? 0,
        changeSize: weights.changeSize ?? 0
    };

    const reasons: RiskReason[] = [];

    const callerImpact =
        Math.min(factors.uniqueConsumers / 10, 1) * w.callerImpact;
    if (factors.uniqueConsumers > 0) {
        reasons.push({
            label: `${factors.uniqueConsumers} consumer${factors.uniqueConsumers === 1 ? "" : "s"} of modified symbols`,
            points: Math.round(callerImpact)
        });
    }

    const affectedFiles =
        Math.min(factors.transitiveFiles / 15, 1) * w.affectedFiles;
    if (factors.transitiveFiles > 0) {
        reasons.push({
            label: `${factors.transitiveFiles} affected files (transitive reach)`,
            points: Math.round(affectedFiles)
        });
    }

    const dependencyDepth =
        Math.min(factors.maxDepth / 4, 1) * w.dependencyDepth;
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

    const changeSize = Math.min(factors.changedLines / 200, 1) * w.changeSize;
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
        100,
        Math.round(callerImpact + affectedFiles + dependencyDepth + testGaps + changeSize)
    );

    return { score, level: classifyRisk(score), reasons };
}