export interface TransitiveImpact {
    files: string[];
    maxDepth: number;
    depthMap: Map<string, number>;
}