# Supplier Card Design

## Goal

Build an independent supplier recharge card module for New API. Admins can assign supplier levels to users, configure card denominations and per-level prices, fund a dedicated supplier card purchase balance, suppliers can buy cards only with that dedicated balance, and recipients can open a public card link before logging in and redeem after login.

## Confirmed Product Decisions

- Supplier level is stored on the user account.
- `supplier_level = 0` means a normal user and cannot buy supplier cards.
- `supplier_level = 1..10` means a supplier and can buy supplier cards.
- Suppliers pay with a dedicated `supplier_card_quota` balance. They cannot buy supplier cards with normal account balance.
- Admins are the only actors that can fund or correct `supplier_card_quota` through the supplier card management page.
- Card denominations use the normal top-up display unit. Redeeming a card adds `amount * QuotaPerUnit` internal quota.
- Redeeming a supplier card adds normal user `quota`, not `supplier_card_quota`.
- Suppliers may redeem their own purchased cards.
- Batch purchase is supported, with an admin-configured maximum quantity per purchase.
- Public share pages do not show the full redemption code. They show card information and a partial code preview only.
- Admin reporting includes enhanced filters by supplier, time range, redeemed user, card status, amount, level, and keyword.

## Architecture

This is a new module instead of an extension of the existing redemption-code module. Existing `Redemption` records remain admin-generated codes. Supplier cards get their own model, controller, routes, and frontend feature folders to keep the fork easier to merge with upstream.

The backend follows the existing Router -> Controller -> Model/Service pattern. Business operations that require atomicity live in model/service methods and run in GORM transactions. JSON storage uses `TEXT` with `common.Marshal` and `common.UnmarshalJsonStr`.

## Data Model

### User

Add:

- `SupplierLevel int json:"supplier_level" gorm:"type:int;default:0;column:supplier_level;index"`
- `SupplierCardQuota int json:"supplier_card_quota" gorm:"type:int;default:0;column:supplier_card_quota"`

Validation:

- Admin user create/update accepts `0..10`.
- Values outside the range are rejected.
- Existing users default to `0` through AutoMigrate.
- `SupplierCardQuota` is not changed by online top-up, redemption, consumption, refund, or normal balance adjustment flows.

### SupplierCardPlan

Purpose: admin-configured purchasable card type.

Fields:

- `Id int`
- `Amount int64`: display amount, for example `10`, `20`, `1000`.
- `Quota int`: frozen redeem quota for cards generated from this plan. Admin save computes `Amount * QuotaPerUnit`.
- `Enabled bool`
- `SortOrder int`
- `Prices string`: JSON object of supplier level to purchase price, stored as `TEXT`, for example `{"1":9.5,"2":9,"10":6.5}`.
- `CreatedAt int64`
- `UpdatedAt int64`
- `DeletedAt gorm.DeletedAt`

Constraints:

- `amount` should be unique among non-deleted plans.
- Price values must be non-negative.
- Plan must contain prices for levels `1..10`.

Default seed behavior:

- If no plans exist, admin UI offers a quick-create action for `10/20/30/40/50/100/500/1000`.
- The backend does not silently create plans during migration to avoid hidden operational changes.

### SupplierCardOrder

Purpose: one successful supplier dedicated-balance purchase operation.

Fields:

- `Id int`
- `OrderNo string uniqueIndex`
- `SupplierUserId int index`
- `SupplierLevel int`
- `PlanId int index`
- `Amount int64`
- `Quota int`
- `Count int`
- `UnitPrice float64`: display-unit price snapshot for one card.
- `TotalPrice float64`: display-unit total price snapshot.
- `TotalDebitQuota int`: internal quota deducted from supplier dedicated card purchase balance.
- `CreatedTime int64 index`

Accounting:

- Prices are configured and shown in the same display unit as card denominations.
- Balance deduction uses `round(total_price * QuotaPerUnit)` internal quota from `users.supplier_card_quota`.
- Purchase is rejected if the supplier's current `supplier_card_quota` is lower than `TotalDebitQuota`.
- Purchase does not change `users.quota`.

### SupplierCardQuotaLog

Purpose: audit all movements of the dedicated supplier card purchase balance.

Fields:

- `Id int`
- `SupplierUserId int index`
- `OperatorUserId int index`: admin user for manual adjustments, `0` for automatic purchase deductions.
- `Action string`: `admin_add`, `admin_subtract`, `admin_override`, or `purchase`.
- `QuotaDelta int`: signed internal quota change.
- `QuotaBefore int`
- `QuotaAfter int`
- `OrderId int index`
- `OrderNo string index`
- `Memo string`
- `CreatedTime int64 index`

Rules:

- Admin adjustments and supplier purchases must create a log row in the same transaction as the balance change.
- The log table is the audit source for supplier card purchase balance funding and deductions.

### SupplierCard

Purpose: each purchased card instance.

Fields:

- `Id int`
- `SupplierUserId int index`
- `SupplierLevel int`
- `OrderId int index`
- `OrderNo string index`
- `PlanId int index`
- `Amount int64`
- `Quota int`
- `PurchasePrice float64`
- `DebitQuota int`
- `Code string uniqueIndex`
- `CodePreview string`
- `ShareToken string uniqueIndex`
- `ShareTokenPreview string`
- `Status int index`: `1 = unused`, `2 = redeemed`, `3 = disabled`
- `RedeemedUserId int index`
- `RedeemedTime int64`
- `CreatedTime int64 index`
- `UpdatedTime int64`

Security:

- Full redeem code and full share token are returned only to the supplier owner and admin authenticated detail responses.
- Public share responses never return full code or full share token.
- This follows the existing local pattern where redemption keys are persisted, while keeping public API responses intentionally redacted.

## Backend API

### Supplier APIs

`GET /api/supplier-cards/plans`

- Auth: user.
- Returns enabled plans with current user's level-specific price and current `supplier_card_quota`.
- Normal users with level `0` receive a business error.

`POST /api/supplier-cards/purchase`

- Auth: user plus critical rate limit.
- Body: `{"plan_id": 1, "count": 10}`.
- Validates supplier level `1..10`, enabled plan, price for level, positive count, and count <= configured max.
- Transaction locks supplier user row, creates a `SupplierCardOrder`, deducts `round(total_price * QuotaPerUnit)` from `supplier_card_quota`, records a `SupplierCardQuotaLog`, then creates cards linked to the order.
- Returns the order plus created cards with share links, full code, status, amount, price, and previews.

`GET /api/supplier-cards/self`

- Auth: user.
- Query: pagination, `status`, `keyword`, `unused_only`.
- Returns cards owned by current supplier.

`GET /api/supplier-cards/share/:token`

- Public.
- Returns card display data: amount, status, partial preview, supplier display name, redeemed flag, redeemed time if already redeemed.
- Does not return full code or supplier user id if not necessary for display.

`POST /api/supplier-cards/share/:token/redeem`

- Auth: user plus critical rate limit.
- Transaction locks card row, checks unused status, adds `card.quota` to current user's quota, marks redeemed.
- Allows the supplier owner to redeem the card.
- Records a top-up style log.

### Admin APIs

`GET /api/supplier-cards/admin/plans`

- Auth: admin.
- Returns all plans, including disabled plans.

`POST /api/supplier-cards/admin/plans`

- Auth: admin.
- Creates a plan.

`PUT /api/supplier-cards/admin/plans/:id`

- Auth: admin.
- Updates amount, enabled status, sort order, and prices. Existing cards are not changed.

`GET /api/supplier-cards/admin/cards`

- Auth: admin.
- Query filters: supplier keyword/id, redeemed user keyword/id, status, amount, supplier level, created time range, redeemed time range, keyword.
- Returns paginated card records with supplier and redeemed user display summaries.

`GET /api/supplier-cards/admin/orders`

- Auth: admin.
- Query filters: supplier keyword/id, amount, supplier level, created time range, order number.
- Returns paginated purchase orders for sales reconciliation.

`GET /api/supplier-cards/admin/stats`

- Auth: admin.
- Same filters where applicable.
- Returns total sales amount from orders, sold card count, redeemed count, unused count, disabled count, grouped totals by amount and supplier level.

`POST /api/supplier-cards/admin/balance`

- Auth: admin.
- Body: `{"user_id": 1, "mode": "add|subtract|override", "value": 100000, "memo": "manual funding"}`.
- `value` is internal quota units.
- Requires the target user to be a supplier (`supplier_level > 0`).
- Changes `supplier_card_quota` in a transaction and records `SupplierCardQuotaLog`.
- Subtract cannot make the dedicated balance negative.

`GET /api/supplier-cards/admin/balance-logs`

- Auth: admin.
- Query filters: supplier user id, operator user id, action, keyword, created time range, pagination.
- Returns paginated `SupplierCardQuotaLog` records for audit.

`GET /api/supplier-cards/admin/settings`

- Auth: admin.
- Returns max purchase count per order.

`PUT /api/supplier-cards/admin/settings`

- Auth: admin.
- Saves max purchase count per order as an option.

## Permission And Navigation

Frontend visibility:

- User sidebar adds `Supplier Cards` under Personal.
- The item is visible to all authenticated users by default, but the page shows a clear unavailable state if `supplier_level = 0`.
- Admin sidebar adds `Supplier Card Management` under Admin.
- Sidebar module config gets new keys so operators can hide these pages:
  - `personal.supplier_cards`
  - `admin.supplier_cards`

Backend enforcement does not depend on frontend visibility.

## Frontend Pages

### Supplier Purchase Page

Route: `/_authenticated/supplier-cards/`

Sections:

- Header with supplier level, current dedicated card purchase balance, and purchase limit.
- Purchasable card grid. Each card shows denomination, current level price, effective discount, and enabled state.
- Quantity stepper/input with max limit.
- Purchase action with confirmation dialog showing total cost and resulting card count.
- Recent purchases in card layout with status filter, unused-only toggle, and keyword search.

Card visual style:

- Dark/white Vercel-like treatment consistent with the redesigned frontend.
- Card has denomination as the strongest element, subtle code preview, status badge, share/copy actions, and compact metadata.
- Repeated cards use 8px radius or less.

### Public Share Page

Route: `/supplier-card/:token`

Behavior:

- Public route not under `_authenticated`.
- Shows a polished card preview, status, partial code, supplier display name, and redeem action.
- If not logged in, redeem action routes to sign-in with return URL.
- If logged in, redeem action calls API and updates the card state.

### Admin Management Page

Route: `/_authenticated/supplier-card-management/`

Tabs:

- Plans: table editor for denomination, enabled state, sort order, and level `1..10` prices.
- Purchase Balances: admin form to add, subtract, or override a supplier's dedicated card purchase balance, plus searchable balance movement logs.
- Orders: searchable/filterable purchase order list for sales reconciliation.
- Cards: searchable/filterable card list using the existing data-table patterns.
- Stats: compact cards for totals and grouped tables by amount and level.

### User Management

Add `Supplier Level` to user create/update forms and user table details. The value must be constrained to `0..10`.

## Internationalization

All new frontend strings use `t('English source string')`.

After implementation, run in `web/default/`:

```bash
bun run i18n:sync
```

Then fill supported locale files for `en`, `zh`, `fr`, `ja`, `ru`, and `vi`.

## Error Handling

Purchase errors:

- Normal user: not a supplier.
- Disabled or missing plan.
- Missing price for supplier level.
- Count outside allowed range.
- Insufficient supplier card balance.

Redeem errors:

- Invalid or missing share token.
- Card disabled.
- Card already redeemed.
- User not logged in.

All business errors return the existing `{success:false,message}` shape.

## Testing

Backend tests:

- Supplier level validation rejects values outside `0..10`.
- Purchase rejects level `0`.
- Purchase deducts dedicated card purchase balance and creates the requested card count.
- Purchase rejects insufficient supplier card balance.
- Purchase snapshots level, amount, quota, and price.
- Redeem adds quota to current user and marks card redeemed.
- Redeem is idempotency-safe under repeated attempts by checking status in a transaction.
- Admin filters return expected card records.

Frontend tests:

- Supplier page shows unavailable state for level `0`.
- Supplier page lists purchasable plans and calculates total.
- Purchased card list filters unused cards.
- Public share page renders without auth and does not expose full code.
- Logged-in redeem success updates status.

Manual verification:

- `go test ./model ./controller ./service`
- `go build .`
- `cd web/default && bun run lint && bun run build`

## Out Of Scope For First Release

- Online payment checkout for supplier card purchases.
- CSV export and chart-level trend reporting.
- Expiration dates for supplier cards.
- Refund or card buyback workflow.
- Preventing suppliers from redeeming their own cards.
