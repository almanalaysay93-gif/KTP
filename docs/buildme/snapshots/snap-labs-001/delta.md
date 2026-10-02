# Snapshot snap-labs-001 (2026-10-02)

Scope: the Labs workspace of the admin patient profile (`DESIGN.md`, Screens 5).
Previous snapshot: `snap-final`.
The data in the screenshots is synthetic.

## Screenshots

| File | Viewport | State |
|---|---|---|
| `labs-overview-1440.png` | 1440 x 1100 | Sections closed, except the section of the patient stage |
| `labs-phase-1440.png` | 1440 x 1100 | Phase 1 open, two typed values, sticky bar |
| `labs-dialog-1440.png` | 1440 x 1100 | Result dialog with the two typed values |
| `labs-overview-390.png` | 390 x 844 | Same states at the phone width |
| `labs-phase-390.png` | 390 x 844 | |
| `labs-dialog-390.png` | 390 x 844 | |

## Token delta

No token changed.
No new colour, radius, shadow, type size, or spring.
The Labs workspace uses the tokens of `client/src/styles/clay.css` only.

## Component delta

| Change | Detail |
|---|---|
| Added | `LabResultsDialog` on `ClayDialog`: the one dialog that saves lab results |
| Added | `ResultValue`, `LabHistory` in `LabResultLine.tsx`: value with unit and flag chip, result list with trend line |
| Changed | `AdminLabsChecklist`: flat list of about 70 rows became collapsible sections with panel sub-headings |
| Changed | `ChecklistItemRow`: row on the contract sizes, New result field, details region |
| Changed | `NurseApprovalCard`: contract text sizes, 44 px rows, status chip |
| Removed | `LabManualEncodeModal`, `LabUploadTranscribeModal`, `LabPhases` |

## Token bindings in the Labs workspace

| Element | Binding |
|---|---|
| Section card | `ClayCard` level 2 on `--surface-1` |
| Row divider, sub-heading | `--hairline`, `--sunken` at 50%, label style |
| Row with a typed value | `--peach-tint` at 50% |
| Value | data face 600, unit caption `--ink-muted` |
| Lab flag | `StatusChip` `lab-low`, `lab-normal`, `lab-high` |
| New result field | `--sunken`, `--clay-sunken`, 1.5 px `--line-strong`, height 44 |
| Sticky bar | `--surface-2`, `--clay-2`, radius lg |
| Progress bar | `--sunken` track, `--sage-deep` fill, `--done` at 100% |
| Trend line | `--series-2` line, `--series-1` last point, on `--surface-2` |

## Drift guard

- Smallest text: 12 px at 1440 (caption token), 14 px at 390.
- Smallest control: 44 px at 1440 and at 390.
- No `backdrop-filter`.
- No raw hex colour and no pixel font size in the Labs components.
