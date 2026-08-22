import { RISK_WEIGHT_KEYS } from "./risk.constants.js";
import type { RiskWeights } from "./risk.types.js";

export type ParseRiskWeightsResult =
    | { ok: true; weights: RiskWeights }
    | { ok: false; message: string };

const VALID_JSON_MESSAGE = "--risk-weights must be a valid JSON object.";

const VALID_KEYS_MESSAGE =
    "--risk-weights must only contain numeric keys: " +
    RISK_WEIGHT_KEYS.join(", ") + ".";

/**
 * Parses and validates the --risk-weights option value.
 *
 * Pure function: returns a discriminated result instead of throwing or
 * printing, so the entry point (CLI) decides how to report failures.
 */
export function parseRiskWeights(raw: string): ParseRiskWeightsResult {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { ok: false, message: VALID_JSON_MESSAGE };
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { ok: false, message: VALID_JSON_MESSAGE };
    }

    const record = parsed as Record<string, unknown>;

    const hasUnknownKey = Object.keys(record).some(
        key => !(RISK_WEIGHT_KEYS as readonly string[]).includes(key)
    );

    const hasInvalidValue = Object.values(record).some(
        value => typeof value !== "number" || !Number.isFinite(value)
    );

    if (hasUnknownKey || hasInvalidValue) {
        return { ok: false, message: VALID_KEYS_MESSAGE };
    }

    return { ok: true, weights: record as unknown as RiskWeights };
}
