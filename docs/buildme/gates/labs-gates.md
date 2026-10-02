# Quality gates: Labs workspace (2026-10-02)

Scope: `AdminLabsChecklist.tsx`, `LabsSection.tsx`, `ChecklistItemRow.tsx`, `LabResultLine.tsx`, `LabResultsDialog.tsx`, `NurseApprovalCard.tsx`, `labCatalogMeta.ts`, the lab part of `ServiceRecordEditor.tsx`, and the shared `ClayDialog.tsx` and `ClinicalForm.tsx`.

Method: three reviewers read the code (Agents 7, 8, 10) and did not run it.
The orchestrator fixed the findings in one revision round.
The orchestrator then checked the result in headless Chrome on a scratch SQLite database with synthetic data.

## Verdict

| Gate | First pass | After the revision round |
|---|---|---|
| Agent 7, anti-slop | FAIL: 1 block | PASS: 0 block, 3 minor open |
| Agent 8, bug hunt | FAIL: 1 major | PASS: 0 block, 0 major, 2 minor open |
| Agent 10, performance and accessibility | FAIL: 1 block, 4 major | PASS: 0 block, 0 major, 2 minor open |

## Agent 7: anti-slop

All 13 detectors passed or were exempt (V4 hero: the screen has no hero).

| ID | Severity | Finding | Result |
|---|---|---|---|
| S1 | block | Each open row had a brick "Save status" button in the same section as "Review and save" | Fixed: `ClinicalForm` has a `variant` prop, the row passes `secondary`. Browser check: one brick button in the section. |
| S2 | minor | "Not applicable" used the Superseded chip with the History icon | Fixed: own chip with the `CircleMinus` icon. |
| S3 | minor | "Pending" was text with no icon | Fixed: hollow status chip. |
| S4 | minor | Counts and dates outside the data face, two raw ISO dates | Fixed: `type-data` and `fmtDate`. |
| S5 | minor | Text on translucent fills (`bg-ground/60`, `bg-peach-tint/50`) | Fixed: opaque `bg-ground` and `bg-peach-tint`. |
| S6 | minor | Error text with no icon | Open. The same pattern is in `ClinicalForm` for all clinical forms. A change must cover all forms. |
| S7 | minor | Capitals and range separators in the reference texts of `labCatalogMeta.ts` | Open. `VOICE.md` and `DESIGN.md` do not agree on the separator. An owner decision is necessary. |
| S8 | note | `labCatalogMeta.ts` holds clinical reference ranges with no source in the proof-point list | Open. A clinical owner must approve the ranges. |

## Agent 8: bug hunt

| ID | Severity | Finding | Result |
|---|---|---|---|
| B1 | major | Typed values were lost on a tab change: Radix unmounts the inactive tab | Fixed: the Labs tab content stays mounted. Browser check: values survive Tracker and back. |
| B2 | minor | A failed refetch replaced the Labs screen with the error card | Fixed: the error card shows only when no data is loaded. |
| B3 | minor | A closed section gave no sign of unsaved values | Fixed: the section header shows the unsaved count. |
| B4 | minor | The row alert stayed after a later successful save of the details form | Fixed: the toggle and the form use separate mutations. |
| B5 | minor | A typed note was lost when the status changed | Fixed: the details fields are controlled. A server change replaces the status and date only. |
| B6 | minor | The last result is removed and the checklist item stays Done | Open by decision. The user can set an item Done with no result, so the server does not change the status. |
| B7 | minor | Column labels showed over empty columns in Phase 2 and Phase 3 | Fixed: the labels show only when the section has a lab test. |
| B8 | minor | A reason of blanks showed the raw validation error | Fixed: the client checks the trimmed length. |
| B9 | minor | "Add a test" added a row on each key press | Fixed: an Add button adds the row, then the new field takes focus. |
| B10 | minor | A parsed test that is not in the catalog made a row that could not be saved or removed | Fixed: such tests are ignored. |
| B11 | minor | Tab order at 768 px and wider did not follow the columns | Fixed: the details control is last in the DOM. |
| B12 | minor | No unique constraint on (`serviceRecordId`, `labTestId`) | Open. Two saves at the same instant on PostgreSQL can make a duplicate result. A database constraint is necessary. |

## Agent 10: performance and accessibility

Contrast (WCAG 1.4.3, 1.4.11): no failure.
The lowest text pair is ink-muted on the sunken sub-heading at 5.60:1.
The lowest non-text pair is the line-strong icon on a hovered sunken fill at 3.81:1.

Performance: no measurable finding at about 70 rows.

| ID | Severity | Criterion | Finding | Result |
|---|---|---|---|---|
| A1 | block | 2.4.3 | Focus went to `body` on each dialog close | Fixed in `ClayDialog`: focus returns to the control that opened the dialog, or to the Labs heading when that control is gone. Browser check: both paths pass. |
| A2 | major | 2.4.3 | Focus went to `body` when a focused control was removed | Fixed: Cancel returns focus to Remove, a removal moves focus to the result list, and the "Pending only" filter keeps a row that the user completes. |
| A3 | major | 3.2.2 | "Add a test" changed the dialog on a select change | Fixed, same as B9. |
| A4 | major | 2.4.11 | The sticky bar could cover a focused field | Fixed: row controls have `scroll-mb-28`. |
| A5 | major | 4.1.2 | The toggle changed its name and its pressed state together. A Not applicable item with a result had no chip | Fixed: the name is "Done: {item}" with `aria-pressed`. The Not applicable chip always shows. |
| A6 | minor | 2.4.3 | Focus order of a row | Fixed, same as B11. |
| A7 | minor | 2.4.3 | Focus after a dialog row is removed | Fixed: the test list takes focus. |
| A8 | minor | 4.1.3 | Status text mounted together with its region | Fixed for the file note. Open for the sticky bar. |
| A9 | minor | 4.1.2 | The hidden file input was in the accessibility tree | Fixed: `hidden` attribute. |
| A10 | minor | 2.4.3 | The toggle used `disabled` during a save | Fixed: `aria-disabled`. |
| A11 | minor | 3.3.2 | Under 768 px the New result field has a placeholder and no visible label | Open. The unit is the placeholder and the accessible name has the test name. |
| A12 | minor | Reduced motion | Fade of 180 ms against a limit of 150 ms | Fixed: 150 ms. |
| A13 | minor | Targets | 4 px between the two filter buttons | Fixed: 8 px. |

## Browser evidence after the revision round

All checks ran on `http://localhost:3210` with a scratch database.

- Sections, panel sub-headings, and the open section for the patient stage: pass.
- Smallest text: 12 px at 1440 (caption token), 14 px at 390.
- Smallest control: 44 px at 1440 and at 390, in the tab and in the dialog.
- No horizontal page scroll at 390 and at 320.
- No `backdrop-filter`.
- Three typed values saved together with the nurse approval: pass.
- Typed values survive a tab change: pass.
- One brick button in a section with a details region open: pass.
- Focus after Escape, after a save, and after Cancel in the removal form: pass.
- A test is added only with the Add button, and focus moves to its field: pass.
- Console errors: 0.
- `tsc --noEmit` clean, 117 tests pass, `vite build` passes.

Not checked: Lighthouse (the screen needs a session), a screen reader, a real phone, and production.
