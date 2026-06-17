# Supplier Card Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build supplier-level balance-purchased recharge cards with public share/redeem links and admin sales/redeem management.

**Architecture:** Add an isolated supplier-card backend module with its own GORM models, transactional purchase/redeem methods, controller, and routes. Add frontend feature folders for supplier purchase/history, public share redemption, and admin management while reusing existing layout, table, i18n, and wallet formatting helpers.

**Tech Stack:** Go 1.22+, Gin, GORM, SQLite/MySQL/PostgreSQL-compatible SQL, React 19, TypeScript, TanStack Router, TanStack Query, Base UI/shadcn components, Bun.

---

## File Structure

- Modify `model/user.go`: add `supplier_level`, validate/edit it, and include it in admin create/update.
- Create `model/supplier_card.go`: models, status constants, price JSON helpers, purchase/redeem transactions, list/stat queries.
- Create `model/supplier_card_test.go`: TDD coverage for level validation, purchase, insufficient balance, snapshotting, redeem, and filters.
- Modify `model/main.go`: AutoMigrate supplier card tables.
- Modify `model/option.go`: add `SupplierCardMaxPurchaseCount` option and update parsing.
- Create `controller/supplier_card.go`: supplier, public share, and admin handlers.
- Modify `router/api-router.go`: mount `/api/supplier-cards`.
- Modify `controller/user.go`: validate and persist supplier level.
- Modify `web/default/src/features/users/*`: expose supplier level in types and user drawer.
- Create `web/default/src/features/supplier-cards/*`: supplier purchase/history UI.
- Create `web/default/src/features/supplier-card-management/*`: admin plans/orders/cards/stats UI.
- Create `web/default/src/features/supplier-card-share/*`: public card page.
- Add route files under `web/default/src/routes/_authenticated/supplier-cards`, `web/default/src/routes/_authenticated/supplier-card-management`, and `web/default/src/routes/supplier-card/$token.tsx`.
- Modify `web/default/src/hooks/use-sidebar-data.ts` and `web/default/src/hooks/use-sidebar-config.ts`: navigation and module keys.
- Run `web/default` route generation through build/typecheck and `bun run i18n:sync`.

---

### Task 1: Backend Model Tests

**Files:**
- Create: `model/supplier_card_test.go`
- Create: `model/supplier_card.go`
- Modify: `model/user.go`

- [ ] **Step 1: Write failing model tests**

Create tests that set `model.DB` to in-memory SQLite, migrate `User`, `SupplierCardPlan`, `SupplierCardOrder`, `SupplierCard`, and `Log`, then exercise the public model API:

```go
func TestPurchaseSupplierCardsRejectsLevelZero(t *testing.T) {
	db := setupSupplierCardTestDB(t)
	seedSupplierCardPlan(t, db, 1, 10, `{"1":8,"2":7,"3":6,"4":5,"5":4,"6":3,"7":2,"8":1,"9":1,"10":1}`)
	user := seedSupplierUser(t, db, 1, 0, 1000000)

	_, _, err := PurchaseSupplierCards(user.Id, 1, 1, 100)

	require.Error(t, err)
	require.Contains(t, err.Error(), "not a supplier")
}
```

Also add tests for successful purchase, insufficient balance, purchase snapshot fields, redeem success, repeat redeem failure, and admin status filtering.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
go test ./model -run 'TestPurchaseSupplierCards|TestRedeemSupplierCard|TestListSupplierCards' -count=1
```

Expected: compile fails because supplier card types/functions do not exist.

- [ ] **Step 3: Implement minimal model code**

Add `SupplierLevel` to `User`:

```go
SupplierLevel int `json:"supplier_level" gorm:"type:int;default:0;column:supplier_level;index"`
```

Create `model/supplier_card.go` with:

```go
const (
	SupplierCardStatusUnused   = 1
	SupplierCardStatusRedeemed = 2
	SupplierCardStatusDisabled = 3
)

const DefaultSupplierCardMaxPurchaseCount = 100

type SupplierCardPlan struct { /* fields from spec */ }
type SupplierCardOrder struct { /* fields from spec */ }
type SupplierCard struct { /* fields from spec */ }

func ValidateSupplierLevel(level int) error
func (p *SupplierCardPlan) PriceForLevel(level int) (float64, error)
func PurchaseSupplierCards(userID int, planID int, count int, maxCount int) (*SupplierCardOrder, []*SupplierCard, error)
func RedeemSupplierCardByShareToken(shareToken string, userID int) (*SupplierCard, error)
func ListSupplierCards(userID int, query SupplierCardListQuery) ([]*SupplierCard, int64, error)
func ListAdminSupplierCards(query SupplierCardAdminListQuery) ([]*SupplierCard, int64, error)
func GetSupplierCardStats(query SupplierCardAdminListQuery) (*SupplierCardStats, error)
```

Use `common.Marshal` and `common.UnmarshalJsonStr` for prices. Use GORM transactions and `Set("gorm:query_option", "FOR UPDATE")` around user/card rows.

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
go test ./model -run 'TestPurchaseSupplierCards|TestRedeemSupplierCard|TestListSupplierCards' -count=1
```

Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add model/user.go model/supplier_card.go model/supplier_card_test.go
git commit -m "feat: add supplier card model"
```

---

### Task 2: Backend Migration, Options, Routes, Controllers

**Files:**
- Modify: `model/main.go`
- Modify: `model/option.go`
- Create: `controller/supplier_card.go`
- Modify: `router/api-router.go`
- Modify: `controller/user.go`

- [ ] **Step 1: Write failing controller/option tests**

Add focused tests in `model/supplier_card_test.go` for `GetSupplierCardMaxPurchaseCount` default and override. Add controller handler tests only where the model API is not enough: public share response must omit full `code` and `share_token`.

```go
func TestSupplierCardPublicShareOmitsFullSecrets(t *testing.T) {
	// create card, call GetSupplierCardShare with gin context,
	// assert response data has code_preview and no code/share_token fields.
}
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
go test ./model ./controller -run 'SupplierCard|SupplierLevel' -count=1
```

Expected: failures for missing option/controller symbols.

- [ ] **Step 3: Implement migration/options/controllers**

Add supplier card models to both `migrateDB` and `migrateDBFast`.

Add option defaults in `model/option.go`:

```go
common.OptionMap["SupplierCardMaxPurchaseCount"] = strconv.Itoa(DefaultSupplierCardMaxPurchaseCount)
```

Add controller handlers:

```go
func GetSupplierCardPlans(c *gin.Context)
func PurchaseSupplierCards(c *gin.Context)
func GetUserSupplierCards(c *gin.Context)
func GetSupplierCardShare(c *gin.Context)
func RedeemSupplierCardShare(c *gin.Context)
func AdminListSupplierCardPlans(c *gin.Context)
func AdminCreateSupplierCardPlan(c *gin.Context)
func AdminUpdateSupplierCardPlan(c *gin.Context)
func AdminListSupplierCardOrders(c *gin.Context)
func AdminListSupplierCards(c *gin.Context)
func AdminGetSupplierCardStats(c *gin.Context)
func AdminGetSupplierCardSettings(c *gin.Context)
func AdminUpdateSupplierCardSettings(c *gin.Context)
```

Mount routes:

```go
supplierCardRoute := apiRouter.Group("/supplier-cards")
supplierCardRoute.GET("/share/:token", controller.GetSupplierCardShare)
supplierCardRoute.POST("/share/:token/redeem", middleware.UserAuth(), middleware.CriticalRateLimit(), controller.RedeemSupplierCardShare)
supplierCardUserRoute := supplierCardRoute.Group("/")
supplierCardUserRoute.Use(middleware.UserAuth())
supplierCardUserRoute.GET("/plans", controller.GetSupplierCardPlans)
supplierCardUserRoute.POST("/purchase", middleware.CriticalRateLimit(), controller.PurchaseSupplierCards)
supplierCardUserRoute.GET("/self", controller.GetUserSupplierCards)
supplierCardAdminRoute := supplierCardRoute.Group("/admin")
supplierCardAdminRoute.Use(middleware.AdminAuth())
```

Update `controller/user.go` create/update validation:

```go
if err := model.ValidateSupplierLevel(user.SupplierLevel); err != nil {
	common.ApiError(c, err)
	return
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
go test ./model ./controller -run 'SupplierCard|SupplierLevel' -count=1
```

Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add model/main.go model/option.go controller/supplier_card.go controller/user.go router/api-router.go model/supplier_card_test.go
git commit -m "feat: expose supplier card APIs"
```

---

### Task 3: User Supplier Level UI

**Files:**
- Modify: `web/default/src/features/users/types.ts`
- Modify: `web/default/src/features/users/lib/user-form.ts`
- Modify: `web/default/src/features/users/components/users-mutate-drawer.tsx`
- Modify: `web/default/src/features/users/components/users-columns.tsx`

- [ ] **Step 1: Write failing type/form coverage**

Use existing TypeScript checks as the failure gate by adding `supplier_level` to form transformations before backend/frontend components understand it.

Expected missing type errors from `bun run typecheck`.

- [ ] **Step 2: Run typecheck to verify RED**

Run:

```bash
cd web/default && bun run typecheck
```

Expected: TypeScript errors related to missing `supplier_level` in user types/form payload.

- [ ] **Step 3: Implement user UI fields**

Add:

```ts
supplier_level: z.number().optional().default(0)
```

Add `supplier_level?: number` to `UserFormData`.

Extend `userFormSchema`:

```ts
supplier_level: z.number().min(0).max(10).optional(),
```

Add a numeric/select field labelled `Supplier Level` with options `0..10` to the user drawer and include the value in create/update payloads. Add a compact column or badge in users table.

- [ ] **Step 4: Run typecheck to verify GREEN**

Run:

```bash
cd web/default && bun run typecheck
```

Expected: typecheck passes or only exposes pre-existing unrelated errors that are documented before continuing.

- [ ] **Step 5: Commit**

```bash
git add web/default/src/features/users
git commit -m "feat: add supplier level to users"
```

---

### Task 4: Supplier Purchase And History Frontend

**Files:**
- Create: `web/default/src/features/supplier-cards/types.ts`
- Create: `web/default/src/features/supplier-cards/api.ts`
- Create: `web/default/src/features/supplier-cards/index.tsx`
- Create: `web/default/src/features/supplier-cards/components/supplier-card-visual.tsx`
- Create: `web/default/src/features/supplier-cards/components/purchase-panel.tsx`
- Create: `web/default/src/features/supplier-cards/components/card-history.tsx`
- Create: `web/default/src/routes/_authenticated/supplier-cards/index.tsx`
- Modify: `web/default/src/hooks/use-sidebar-data.ts`
- Modify: `web/default/src/hooks/use-sidebar-config.ts`

- [ ] **Step 1: Write UI shell and run typecheck RED**

Create route file importing `SupplierCards` before feature exports exist.

- [ ] **Step 2: Run typecheck to verify RED**

Run:

```bash
cd web/default && bun run typecheck
```

Expected: missing module/export errors for `SupplierCards`.

- [ ] **Step 3: Implement supplier UI**

Implement API functions:

```ts
getSupplierCardPlans()
purchaseSupplierCards({ plan_id, count })
getSupplierCards({ p, page_size, status, keyword, unused_only })
```

Implement page:

- unavailable state when `auth.user?.supplier_level` is missing or `0`;
- balance/level header;
- plan cards with denomination, price, and discount;
- quantity input capped by backend settings;
- purchase confirmation;
- owned card grid with unused filter, keyword search, copy/share actions.

Use `lucide-react` icons and existing `Button`, `Input`, `Badge`, `Card`, `Tabs`, `Dialog`, `StatusBadge`.

- [ ] **Step 4: Run typecheck to verify GREEN**

Run:

```bash
cd web/default && bun run typecheck
```

Expected: typecheck passes or only exposes pre-existing unrelated errors that are documented before continuing.

- [ ] **Step 5: Commit**

```bash
git add web/default/src/features/supplier-cards web/default/src/routes/_authenticated/supplier-cards web/default/src/hooks/use-sidebar-data.ts web/default/src/hooks/use-sidebar-config.ts
git commit -m "feat: add supplier card purchase UI"
```

---

### Task 5: Public Share And Admin Frontend

**Files:**
- Create: `web/default/src/features/supplier-card-share/*`
- Create: `web/default/src/features/supplier-card-management/*`
- Create: `web/default/src/routes/supplier-card/$token.tsx`
- Create: `web/default/src/routes/_authenticated/supplier-card-management/index.tsx`
- Modify: `web/default/src/hooks/use-sidebar-data.ts`
- Modify: `web/default/src/hooks/use-sidebar-config.ts`

- [ ] **Step 1: Write route imports and run typecheck RED**

Add route files importing `SupplierCardShare` and `SupplierCardManagement` before feature exports exist.

- [ ] **Step 2: Run typecheck to verify RED**

Run:

```bash
cd web/default && bun run typecheck
```

Expected: missing export errors.

- [ ] **Step 3: Implement public and admin UI**

Public share page:

- fetch `GET /api/supplier-cards/share/:token`;
- show polished card with amount, status, supplier display name, code preview;
- if unauthenticated, link to `/sign-in?redirect=/supplier-card/:token`;
- if authenticated, call redeem API and refresh state.

Admin management:

- tabs: Plans, Orders, Cards, Stats;
- plan table/editor for amount, enabled, sort order, level prices `1..10`;
- cards/orders filters for supplier keyword, status, amount, level, time range;
- stats cards for sales amount, sold cards, unused, redeemed, disabled.

- [ ] **Step 4: Run typecheck to verify GREEN**

Run:

```bash
cd web/default && bun run typecheck
```

Expected: typecheck passes or only exposes pre-existing unrelated errors that are documented before continuing.

- [ ] **Step 5: Commit**

```bash
git add web/default/src/features/supplier-card-share web/default/src/features/supplier-card-management web/default/src/routes/supplier-card web/default/src/routes/_authenticated/supplier-card-management web/default/src/hooks/use-sidebar-data.ts web/default/src/hooks/use-sidebar-config.ts
git commit -m "feat: add supplier card public and admin UI"
```

---

### Task 6: I18n, Route Tree, Full Verification

**Files:**
- Modify generated i18n locale files under `web/default/src/i18n/locales/`
- Modify generated `web/default/src/routeTree.gen.ts` if the router plugin updates it.

- [ ] **Step 1: Sync i18n**

Run:

```bash
cd web/default && bun run i18n:sync
```

Fill translations for all supported locales with accurate values.

- [ ] **Step 2: Run backend verification**

Run:

```bash
go test ./model ./controller ./service
go build .
```

Expected: both commands exit 0.

- [ ] **Step 3: Run frontend verification**

Run:

```bash
cd web/default && bun run typecheck && bun run build
```

Expected: both commands exit 0.

- [ ] **Step 4: Final diff review**

Run:

```bash
git status --short
git diff --stat
```

Check that changes are limited to supplier card functionality, user supplier level, navigation, i18n, and generated route files.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add supplier card module"
```
