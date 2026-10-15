# Use Cases

Status ledger for use cases under `use-cases/`. Machine-maintained — the `define-use-case` skill appends rows; the dev-team orchestrator updates the `Status` and `Updated` columns as it works. Do not hand-edit those two columns unless you know why; edit the use-case file or re-run the skill instead.

Statuses:
- `pending` — saved but not yet picked up by the dev-team
- `in-progress` — the dev-team has started analysis
- `done` — implementation and tests completed
- `blocked` — the dev-team escalated (6-round cap hit, user abort, or infeasibility)

| # | File | Title | Status | Updated |
|---|------|-------|--------|---------|
| 01 | [use-cases/01-anotar-flechas.md](use-cases/01-anotar-flechas.md) | CU-03 Anotar flechas | done | 2026-10-15 |
| 02 | [use-cases/02-corregir-flecha.md](use-cases/02-corregir-flecha.md) | CU-04 Corregir flecha | done | 2026-10-15 |
| 03 | [use-cases/03-borrar-flecha-tanda.md](use-cases/03-borrar-flecha-tanda.md) | CU-05 Borrar flecha / borrar tanda | done | 2026-10-15 |
| 04 | [use-cases/04-orden-automatico.md](use-cases/04-orden-automatico.md) | CU-06 Orden automático | done | 2026-10-15 |
| 05 | [use-cases/05-totales-en-vivo.md](use-cases/05-totales-en-vivo.md) | CU-07 Totales en vivo | done | 2026-10-15 |
| 06 | [use-cases/06-instalar-en-movil.md](use-cases/06-instalar-en-movil.md) | CU-14 Instalar en el móvil | done | 2026-10-16 |
| 07 | [use-cases/07-funcionar-sin-conexion.md](use-cases/07-funcionar-sin-conexion.md) | CU-13 Funcionar sin conexión | pending | 2026-10-15 |
