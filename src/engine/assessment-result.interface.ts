import type { ImpactCoverage } from "./testing/impact-coverage.interface.js";
import type { RiskAssessment } from "./risk/risk.types.js";

export interface AssessmentResult {
    uniqueDependentFiles: number;
    testsOnAffected: number;
    impactCoverage: ImpactCoverage;
    riskAssessment: RiskAssessment;
}