# Risk Calibration

Referencia empírica para ajustar `DEFAULT_RISK_WEIGHTS` en
`src/engine/risk/risk.constants.ts`.

## Mapeo objetivo

| Tipo de commit | Score esperado |
|---|---|
| Cambio aislado (1 archivo, sin dependientes) | `0-25 LOW` |
| 2-4 dependientes directos sin tests | `26-50 MEDIUM` |
| Blast radius transitivo amplio (>10 archivos) y/o símbolos core sin tests | `51-75 HIGH` |
| Cambios masivos (scaffolding, arquitectura) | `76-100 CRITICAL` |

## Medición — commits reales del propio proyecto (dogfooding)

Medido con `analyze -b HEAD~1` sobre cada commit, con los pesos por defecto:

| Commit | Tipo | Archivos | Score | Nivel |
|---|---|---|---|---|
| `77ef87e` | feature (formato de reporte) | 1 | 10 | LOW |
| `dc26015` | test | 1 | 8 | LOW |
| `8d1f131` | test | 2 | 12 | LOW |
| `b91a5bd` | feature (presentación visual) | 1 | 23 | LOW |
| `f7762c0` | refactor (símbolos usados) | 4 | 43 | MEDIUM |
| `bb28a6c` | test (toca símbolo con 4 consumidores sin tests) | 1 | 40 | MEDIUM |
| `69bf6ae` | scaffolding masivo (MVP completo) | 32 | 84 | CRITICAL |
| `36f637e`, `8d53665`, `c05caa8` | docs / config | 3-5 | 0 | LOW |

## Conclusiones

- Los pesos actuales producen el mapeo objetivo: commits típicos → LOW,
  cambios con consumidores reales sin tests → MEDIUM, scaffolding masivo →
  CRITICAL. **No se requieren cambios de pesos.**
- Caso de referencia útil: un cambio de 1 línea en un símbolo consumido por
  4 archivos sin tests da 40 pts (MEDIUM) — 12 pts de consumidores + 20 pts
  de test gaps. Si un commit típico del proyecto supera esto de forma
  recurrente, revisar primero la cobertura de tests (no los pesos).
- Nota: los commits de solo docs/config dan 0 (ningún símbolo modificado).