import type { RiskWeights } from "./risk.types.js";

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
    callerImpact: 30,
    affectedFiles: 20,
    dependencyDepth: 15,
    testGaps: 20,
    changeSize: 15
};

// Saturation thresholds for each factor (proportional scoring)
export const CALLER_IMPACT_THRESHOLD = 10;
export const AFFECTED_FILES_THRESHOLD = 15;
export const DEPENDENCY_DEPTH_THRESHOLD = 4;
export const CHANGE_SIZE_THRESHOLD = 200;

// Level boundaries and max score
export const LOW_MAX = 25;
export const MEDIUM_MAX = 50;
export const HIGH_MAX = 75;
export const MAX_SCORE = 100;