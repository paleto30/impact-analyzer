export interface ImpactCoverage {
    affected: number;
    covered: number;
    uncovered: number;
    uncoveredFiles: string[];
    percentage: number;
}