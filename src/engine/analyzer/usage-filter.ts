/**
 * A reference whose line is just an import statement does not represent an
 * active execution of the symbol: it is contract wiring only.
 *
 * Single source of truth shared by the impact assessment (risk counting)
 * and the console reporter (usage listing) so both can never diverge.
 */
export function isImportOnlyUsage(snippet: string): boolean {
    return snippet.trim().startsWith("import ");
}
