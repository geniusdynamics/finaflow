# Budget Period Model Redesign Spec

## Why
The current budgets hub groups records too loosely, which causes month edits to rewrite unrelated periods, save actions to force status changes, and period handling to diverge from the intended business rules. The system needs an explicit plan-and-bucket model so monthly, quarterly, half-yearly, and annual budgets each behave correctly and predictably.

## What Changes
- Replace the implicit grouped budget model with explicit budget plans, tracked period buckets, and bucket lines
- Re-add status filters (`All`, `Draft`, `Active`, `Locked`, `Archived`) to the budgets list view
- Add month-copy workflow for monthly budgets so users can copy one source month into multiple selected target months
- Fix monthly editing so a user can edit one tracked month without mutating other months
- Preserve budget status on save unless the status is explicitly changed by the user
- Add support for `half-yearly` period handling across schema, API, helpers, and UI
- Refine period semantics so annual budgets are tracked yearly, while monthly, quarterly, and half-yearly budgets are tracked at their own bucket granularity
- Add regression coverage for schema migration, router behavior, UI workflows, and end-to-end budget lifecycle flows
- **BREAKING**: Replace budget persistence and edit semantics with a new plan/bucket storage model
- **BREAKING**: Retire the current grouped-row assumptions in the budgets router and budget detail editing flow

## Impact
- Affected specs: budgets hub, accounting hub embedded budgets, reports budgeting analytics
- Affected code: `db/schema.ts`, `db/migrations/*`, `api/budgets-router.ts`, `api/reports-router.ts`, `src/lib/budgets/*`, `src/pages/Budgets.tsx`, `src/components/budgets/*`, `src/features/reports/OperationsReportsPanel.tsx`, budget test suites

## ADDED Requirements
### Requirement: Explicit Budget Plan Model
The system SHALL store each logical budget as a stable budget plan with explicit tracked period buckets and bucket lines, instead of inferring a budget from grouped `budgets` rows by shared metadata.

#### Scenario: Budget plan is created
- **WHEN** a user creates a budget
- **THEN** the system creates one budget plan row containing shared metadata such as fiscal year, location, period, name, notes, and status
- **AND** the system creates one or more period buckets linked to that plan
- **AND** the system creates category amount lines linked to the relevant bucket

#### Scenario: Existing grouped budgets are migrated
- **WHEN** the migration runs against existing budget records
- **THEN** each existing logical budget is converted in place into one budget plan with the correct bucket structure
- **AND** migrated budgets remain visible in the budgets hub after the switchover

### Requirement: Status Filters In Budget List
The system SHALL provide status filter buttons in the general budgets view for `All`, `Draft`, `Active`, `Locked`, and `Archived`.

#### Scenario: User filters budgets by status
- **WHEN** the user clicks a status filter button in the budgets list view
- **THEN** the list updates to show only budgets matching that status
- **AND** the `All` filter restores the unfiltered list

### Requirement: Monthly Budget Copy Workflow
The system SHALL provide a copy workflow for monthly budgets that copies one source month bucket into one or more selected target month buckets.

#### Scenario: User copies one month into selected months
- **WHEN** the user opens a monthly budget, selects a source month, chooses `Copy to months`, and selects target months
- **THEN** the system copies the source month's category lines into the selected target month buckets only
- **AND** months that were not selected remain unchanged

#### Scenario: User attempts to copy a month to itself
- **WHEN** the user includes the source month in the copy targets
- **THEN** the system rejects that target and shows a clear validation message

### Requirement: Isolated Bucket Editing
The system SHALL allow editing of a single tracked bucket without mutating other buckets in the same budget plan.

#### Scenario: User edits one monthly bucket
- **WHEN** the user opens a monthly budget, selects one month, edits its category lines, and saves
- **THEN** only that selected month bucket is updated
- **AND** all other month buckets in the same budget plan remain unchanged

#### Scenario: User edits one quarterly or half-yearly bucket
- **WHEN** the user edits a quarterly or half-yearly budget bucket and saves
- **THEN** only the selected quarter or half-year bucket is updated

### Requirement: Status Preservation On Edit
The system SHALL preserve the current budget status during line edits unless the user explicitly changes the status through a dedicated lifecycle action.

#### Scenario: User saves changes to an active budget
- **WHEN** the user edits bucket lines for a budget with status `active` and saves
- **THEN** the budget remains `active`
- **AND** no implicit activation or status promotion occurs

#### Scenario: User saves changes to a draft budget
- **WHEN** the user edits bucket lines for a budget with status `draft` and saves
- **THEN** the budget remains `draft`

### Requirement: Period-Specific Tracking Semantics
The system SHALL track budgets according to their selected period type.

#### Scenario: Monthly budget tracking
- **WHEN** a budget is created with period `monthly`
- **THEN** the system tracks that budget as independently editable month buckets

#### Scenario: Quarterly budget tracking
- **WHEN** a budget is created with period `quarterly`
- **THEN** the system tracks that budget as independently editable quarter buckets that each cover three months

#### Scenario: Half-yearly budget tracking
- **WHEN** a budget is created with period `half-yearly`
- **THEN** the system tracks that budget as independently editable half-year buckets that each cover six months

#### Scenario: Annual budget tracking
- **WHEN** a budget is created with period `annual`
- **THEN** the system stores one annual tracked bucket for the fiscal year
- **AND** the total is evenly divided across 12 derived monthly values for analysis and visualization only
- **AND** those derived monthly values are not individually editable tracked buckets

### Requirement: Annual Analytical Breakdown
The system SHALL present annual budgets with a derived monthly breakdown for reporting and visualization.

#### Scenario: User views an annual budget
- **WHEN** the user opens an annual budget detail view
- **THEN** the system shows a monthly breakdown derived from the annual total
- **AND** the UI labels that breakdown as analytical, not independently tracked monthly entries

### Requirement: Error Handling For Budget Workflows
The system SHALL provide clear user feedback for invalid copy, edit, and lifecycle actions.

#### Scenario: Copy target selection is invalid
- **WHEN** the user submits a copy action with no valid target months selected
- **THEN** the system blocks the action and shows a user-facing validation message

#### Scenario: Bucket edit conflicts with unavailable plan state
- **WHEN** the user attempts to edit a bucket in a plan state that does not allow line edits
- **THEN** the system rejects the request with a clear error message

## MODIFIED Requirements
### Requirement: Budget Detail Editing
The budget detail view SHALL edit tracked buckets from the explicit plan model rather than rewriting all rows that share the same fiscal year, location, and name.

#### Scenario: Detail view save operation
- **WHEN** the user saves changes from the budget detail view
- **THEN** the router updates only the selected plan bucket and its lines
- **AND** the save operation does not recreate unrelated buckets

### Requirement: Budget Router Write Path
The budgets router SHALL use plan-aware create, update, copy, and read procedures that target explicit budget plans and buckets.

#### Scenario: Router updates one bucket
- **WHEN** a bucket-scoped mutation is called
- **THEN** the router resolves the target plan and bucket by stable identifiers
- **AND** the mutation runs inside a transaction that updates only the addressed records

### Requirement: Budget Period Helper Logic
The budget helper layer SHALL support `monthly`, `quarterly`, `half-yearly`, and `annual` semantics and SHALL distinguish tracked buckets from analytical breakdown rows.

#### Scenario: Annual helper expansion
- **WHEN** the helper computes an annual budget display model
- **THEN** it returns one tracked annual bucket plus 12 derived analytical months for reporting use

## REMOVED Requirements
### Requirement: Grouped Budget Reconstruction
**Reason**: Reconstructing a logical budget by shared metadata rather than stable plan identifiers causes cross-period edits, accidental overwrites, and unreliable lifecycle behavior.
**Migration**: Existing budgets are migrated in place into explicit budget plans, tracked buckets, and bucket lines before the new router and UI paths become authoritative.

## Database Schema

### New Tables

#### budget_plans
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| locationId | bigint FK→locations | |
| fiscalYearStart | integer | FY start month (1-12) |
| period | budget_period enum | monthly, quarterly, half-yearly, annual |
| name | varchar(255) | |
| notes | text | nullable |
| status | budget_plan_status enum | draft, active, locked, archived |
| createdById | bigint FK→users | |
| legacyGroupKey | varchar(64) | nullable, maps to old budgets |
| lockedAt | timestamp | nullable |
| lockedById | bigint | nullable |
| archivedAt | timestamp | nullable |
| archivedById | bigint | nullable |
| createdAt | timestamp | default now() |
| updatedAt | timestamp | default now() |
| deletedAt | timestamp | nullable |

#### budget_plan_buckets
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| planId | bigint FK→budget_plans | |
| bucketType | varchar(16) | month, quarter, half, annual |
| bucketIndex | integer | 0-based index within the plan |
| startMonth | integer | FY-relative start month |
| endMonth | integer | FY-relative end month |
| label | varchar(64) | e.g. "Month 1", "Q1", "H1" |
| createdAt | timestamp | |
| updatedAt | timestamp | |

#### budget_bucket_lines
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| bucketId | bigint FK→budget_plan_buckets | |
| categoryId | bigint FK→expense_categories | |
| amount | varchar(32) | decimal string |
| notes | text | nullable |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### Enums
- `budget_period`: 'monthly', 'quarterly', 'half-yearly', 'annual'
- `budget_plan_status`: 'draft', 'active', 'locked', 'archived'

### Migration Strategy
- Create new tables and enums
- Backfill from legacy `budgets` table using `legacyGroupKey = CONCAT('legacy:', anchorBudgetId)`
- Use idempotent INSERT (guarded by legacyGroupKey uniqueness)
- Keep legacy `budgets` table during transition period
