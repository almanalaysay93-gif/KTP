# Token bindings, snapshot 001

Which tokens each component uses. Extracted by grepping Tailwind color utilities (`bg-*`, `text-*`, `border-*`, `ring-*`, `fill-*`, `stroke-*`, `from-*`, `to-*`, `shadow-*`), `var(--token)`, `clay-*` classes, `type-*` roles, radius utilities, font utilities, and motion imports. `none` means no direct use; the component may inherit through the clay components it renders.


## clay components (`components/clay`)

| component | color tokens | elevation and state classes | type roles | radius | fonts | motion |
|---|---|---|---|---|---|---|
| `clay/ClayAvatar.tsx` | `ink`, `maroon`, `peach-tint`, `sage`, `sage-tint`, `surface-2` | `clay-1`, `clay-avatar`, `clay-sunken` | none | none | `sans` | none |
| `clay/ClayButton.tsx` | `brick`, `brick-hover`, `ink`, `maroon`, `on-brick`, `overdue`, `sunken`, `surface-2` | `clay-1`, `clay-brick`, `clay-focus`, `clay-ghost`, `clay-hover`, `clay-press` | `type-button` | `rounded-md` | none | none |
| `clay/ClayCard.tsx` | `info`, `info-bg`, `ink`, `ink-muted`, `surface-1`, `surface-2` | `clay-1`, `clay-2`, `clay-3`, `clay-card`, `clay-focus`, `clay-hover`, `clay-press`, `clay-sunken` | `type-body`, `type-body-sm`, `type-title` | `rounded-lg`, `rounded-md`, `rounded-xl` | none | none |
| `clay/ClayCell.tsx` | `due-soon`, `ink`, `ink-muted`, `overdue`, `sage-deep` | `clay-cell`, `clay-cell-bar`, `clay-focus`, `clay-hover`, `clay-press` | `type-body-sm`, `type-numeral-xl`, `type-title` | none | none | none |
| `clay/ClayInput.tsx` | `ground`, `hairline`, `ink`, `ink-muted`, `line-strong`, `overdue` | `clay-focus`, `clay-input-`, `clay-sunken` | `type-body`, `type-body-sm`, `type-caption`, `type-field-label` | `rounded-sm` | none | none |
| `clay/ClaySkeleton.tsx` | none | `clay-skeleton`, `clay-sunken` | none | `rounded-md` | none | none |
| `clay/ClayStepper.tsx` | `ink`, `ink-muted`, `line-strong`, `on-brick`, `peach`, `sage-deep` | `clay-1`, `clay-sunken` | `type-body-sm`, `type-data` | none | none | none |
| `clay/ClayTabs.tsx` | `ink`, `ink-muted`, `line-strong` | `clay-focus`, `clay-focus-inset`, `clay-press`, `clay-sunken`, `clay-tab` | `type-button` | `rounded-md` | none | none |
| `clay/ClayTray.tsx` | none | `clay-tray` | none | none | none | none |
| `clay/ProgressRing.tsx` | `done`, `ink`, `sage-deep`, `sunken` | none | none | none | `mono` | none |
| `clay/StatTile.tsx` | none | none | none | none | none | none |
| `clay/StatusChip.tsx` | `done`, `done-bg`, `due-soon`, `due-soon-bg`, `filed`, `filed-bg`, `info`, `info-bg`, `lab-high`, `lab-high-bg`, `lab-low`, `lab-low-bg`, `lab-normal`, `lab-normal-bg`, `line-strong`, `overdue`, `overdue-bg`, `planned`, `superseded`, `superseded-bg` | `clay-1`, `clay-focus`, `clay-hover`, `clay-press`, `clay-pressed` | `type-label` | none | none | none |

## ktp shared (`components/ktp`)

| component | color tokens | elevation and state classes | type roles | radius | fonts | motion |
|---|---|---|---|---|---|---|
| `ktp/KtpSignIn.tsx` | `brick`, `ground`, `hairline`, `ink`, `ink-muted`, `sunken`, `surface-2` | `clay-focus` | `type-body-lg`, `type-body-sm`, `type-button`, `type-caption`, `type-display`, `type-headline` | `rounded-2xl`, `rounded-md`, `rounded-sm` | none | `OrganGridBackdrop`, `useMotionPreset` |

## ktp admin (`components/ktp/admin`)

| component | color tokens | elevation and state classes | type roles | radius | fonts | motion |
|---|---|---|---|---|---|---|
| `ktp/admin/AdminHeaderControls.tsx` | `ink`, `ink-muted`, `line-strong`, `peach`, `surface-2` | `clay-1`, `clay-focus`, `clay-hover`, `clay-press`, `clay-sunken` | `type-body`, `type-data`, `type-label` | `rounded-md`, `rounded-xs` | `mono` | none |
| `ktp/admin/AdminShell.tsx` | `ground`, `hairline`, `ink`, `ink-muted`, `on-brick`, `sunken`, `surface-2` | `clay-3`, `clay-focus` | `type-body-sm`, `type-button`, `type-caption`, `type-label`, `type-title` | `rounded-md`, `rounded-sm`, `rounded-xl`, `rounded-xs` | none | `SPRINGS.page`, `SharedPill`, `useMotionMode` |
| `ktp/admin/AdminToaster.tsx` | `done`, `info`, `ink`, `ink-muted`, `sunken`, `surface-2` | `clay-3`, `clay-focus` | `type-body`, `type-body-sm` | `rounded-md`, `rounded-xl` | none | none |
| `ktp/admin/ClayDialog.tsx` | `hairline`, `ink`, `ink-muted`, `sunken`, `surface-2` | `clay-3`, `clay-focus` | `type-body`, `type-headline` | `rounded-md`, `rounded-xl` | none | `SPRINGS.pop`, `useMotionMode` |
| `ktp/admin/LabTrendChart.tsx` | `hairline`, `ink`, `ink-muted`, `lab-high`, `lab-low`, `line-strong`, `on-brick`, `sage-tint`, `series-2`, `surface-1` | none | `type-body-sm`, `type-caption`, `type-data`, `type-data-lg`, `type-title` | `rounded-xs` | none | `SharedPill` |
| `ktp/admin/LabValuesTable.tsx` | `ink-muted`, `superseded` | `clay-focus`, `clay-struck`, `clay-table`, `clay-table-wrap` | `type-caption` | none | none | none |
| `ktp/admin/PatientHeader.tsx` | `brick`, `ink`, `ink-muted`, `sunken` | `clay-focus` | `type-body`, `type-body-sm`, `type-button`, `type-caption`, `type-data`, `type-display`, `type-label` | `rounded-md` | none | none |
| `ktp/admin/PatientTray.tsx` | `ink-muted`, `sage-deep` | none | `type-body`, `type-data`, `type-data-lg`, `type-label` | none | none | `CountUp` |
| `ktp/admin/ProfilePanels.tsx` | `hairline`, `ink`, `ink-muted`, `row-hover` | `clay-focus`, `clay-table`, `clay-table-wrap` | `type-body`, `type-body-sm`, `type-caption`, `type-data` | `rounded-sm` | none | none |
| `ktp/admin/ServiceActionDialog.tsx` | `hairline`, `ink`, `ink-muted`, `line-strong`, `overdue`, `row-hover`, `surface-2` | `clay-focus`, `clay-sunken`, `clay-table`, `clay-table-wrap` | `type-body`, `type-body-sm`, `type-caption`, `type-data`, `type-field-label` | `rounded-md`, `rounded-sm` | `sans` | none |
| `ktp/admin/ServiceRecordsTable.tsx` | `brick`, `ink`, `ink-muted`, `on-brick`, `peach-tint`, `sage-deep`, `sunken`, `surface-2` | `clay-1`, `clay-focus`, `clay-focus-inset`, `clay-hover`, `clay-press`, `clay-pressed`, `clay-struck`, `clay-sunken`, `clay-table`, `clay-table-wrap` | `type-button`, `type-caption`, `type-label` | `rounded-md`, `rounded-xs` | none | none |
| `ktp/admin/ServiceTracker.tsx` | `hairline`, `ink`, `ink-muted`, `overdue`, `peach-tint` | `clay-sunken` | `type-data`, `type-label`, `type-title` | `rounded-md` | none | none |
| `ktp/admin/StageBoard.tsx` | `brick`, `ink`, `ink-muted`, `line-strong`, `peach-tint`, `sage-deep`, `sage-tint`, `sunken` | `clay-focus`, `clay-press`, `clay-pressed` | `type-body`, `type-body-sm`, `type-data`, `type-data-lg`, `type-label`, `type-title` | `rounded-md` | none | `CountUp`, `SPRINGS.pop`, `useMotionMode` |
| `ktp/admin/TriageLists.tsx` | `hairline`, `ink`, `ink-muted`, `row-hover` | none | `type-body`, `type-body-sm`, `type-data` | `rounded-sm` | none | none |
| `ktp/admin/TriagePanel.tsx` | `hairline`, `ink`, `ink-muted` | none | `type-body-sm`, `type-data-lg`, `type-title` | none | none | `useMotionPreset` |
| `ktp/admin/TriageTray.tsx` | `sage`, `sage-deep` | none | none | none | none | `CountUp` |

## ktp patient (`components/ktp/patient`)

| component | color tokens | elevation and state classes | type roles | radius | fonts | motion |
|---|---|---|---|---|---|---|
| `ktp/patient/AppointmentList.tsx` | `brick`, `ink`, `ink-muted`, `row-hover` | none | `type-body-lg`, `type-body-sm`, `type-data`, `type-title` | `rounded-md` | none | none |
| `ktp/patient/ClaimDeadlines.tsx` | `ink`, `ink-muted` | none | `type-body-lg`, `type-body-sm`, `type-data` | none | none | none |
| `ktp/patient/DueList.tsx` | `ink`, `ink-muted` | none | `type-body-lg`, `type-body-sm`, `type-data` | none | none | none |
| `ktp/patient/EmergencyBand.tsx` | `emergency-ink`, `maroon`, `surface-2` | `clay-1`, `clay-focus`, `clay-on-dark`, `clay-press` | `type-body-lg`, `type-button` | `rounded-md`, `rounded-xl` | none | none |
| `ktp/patient/MessageList.tsx` | `brick`, `ink`, `ink-muted`, `peach`, `row-hover` | `clay-focus`, `clay-focus-inset` | `type-body-lg`, `type-body-sm`, `type-button`, `type-data`, `type-label` | `rounded-md`, `rounded-xs` | none | none |
| `ktp/patient/NextUpCard.tsx` | `brick`, `ink`, `ink-muted`, `sunken`, `surface-1` | `clay-2`, `clay-focus`, `clay-ghost`, `clay-press` | `type-body-lg`, `type-body-sm`, `type-button`, `type-numeral-xl`, `type-title` | `rounded-lg`, `rounded-md`, `rounded-xl` | none | none |
| `ktp/patient/PatientNav.tsx` | `ink`, `ink-muted`, `peach`, `surface-2` | `clay-2`, `clay-focus`, `clay-sunken` | `type-button` | `rounded-lg`, `rounded-xl` | `mono`, `sans` | `SharedPill` |
| `ktp/patient/PatientShell.tsx` | `ground`, `ink`, `surface-2` | `clay-focus` | `type-button` | `rounded-md` | none | none |
| `ktp/patient/PatientToast.tsx` | `done`, `info`, `ink`, `ink-muted`, `overdue`, `sunken`, `surface-2` | `clay-3`, `clay-focus` | `type-body`, `type-body-sm` | `rounded-md`, `rounded-xl` | none | none |
| `ktp/patient/RescheduleDialog.tsx` | `ground`, `hairline`, `ink`, `ink-muted`, `line-strong`, `overdue`, `surface-2` | `clay-3`, `clay-focus`, `clay-sunken` | `type-body-lg`, `type-body-sm`, `type-field-label`, `type-headline` | `rounded-sm`, `rounded-xl` | none | `useMotionPreset` |
| `ktp/patient/SectionCard.tsx` | `hairline`, `ink`, `ink-muted` | none | `type-body-sm`, `type-headline` | none | none | none |
| `ktp/patient/StripTray.tsx` | none | `clay-sunken` | none | `rounded-2xl`, `rounded-xl` | `display`, `sans` | none |

## ktp sign-in (`components/ktp/signin`)

| component | color tokens | elevation and state classes | type roles | radius | fonts | motion |
|---|---|---|---|---|---|---|
| `ktp/signin/GoogleButton.tsx` | none | `clay-1`, `clay-focus`, `clay-hover`, `clay-press` | none | `rounded-md` | none | none |
| `ktp/signin/LogoTray.tsx` | none | none | none | none | none | none |

## Hard-coded hex values in components (token bypass)

| component | hex values |
|---|---|
| `ktp/signin/GoogleButton.tsx` | `#1f1f1f`, `#34A853`, `#4285F4`, `#747775`, `#EA4335`, `#FBBC05`, `#ffffff` |

## Color token usage (number of component files using each)

| token | files |
|---|---|
| `ink` | 32 |
| `ink-muted` | 30 |
| `surface-2` | 15 |
| `hairline` | 12 |
| `sunken` | 11 |
| `line-strong` | 9 |
| `brick` | 8 |
| `overdue` | 8 |
| `sage-deep` | 7 |
| `ground` | 5 |
| `on-brick` | 5 |
| `row-hover` | 5 |
| `done` | 4 |
| `info` | 4 |
| `peach` | 4 |
| `peach-tint` | 4 |
| `maroon` | 3 |
| `sage-tint` | 3 |
| `surface-1` | 3 |
| `due-soon` | 2 |
| `info-bg` | 2 |
| `lab-high` | 2 |
| `lab-low` | 2 |
| `sage` | 2 |
| `superseded` | 2 |
| `brick-hover` | 1 |
| `done-bg` | 1 |
| `due-soon-bg` | 1 |
| `emergency-ink` | 1 |
| `filed` | 1 |
| `filed-bg` | 1 |
| `lab-high-bg` | 1 |
| `lab-low-bg` | 1 |
| `lab-normal` | 1 |
| `lab-normal-bg` | 1 |
| `overdue-bg` | 1 |
| `planned` | 1 |
| `series-2` | 1 |
| `superseded-bg` | 1 |

Color tokens with no direct use in component files: `coral`, `focus`, `focus-ring`, `lilac`, `mauve`, `series-1`, `series-3`, `series-4`, `series-5`.
