export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskWeights {
    callerImpact: number;
    affectedFiles: number;
    dependencyDepth: number;
    testGaps: number;
    changeSize: number;
}

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