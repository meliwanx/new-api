package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const supplierCardTestPrices = `{"1":8,"2":7,"3":6,"4":5,"5":4,"6":3,"7":2,"8":1,"9":1,"10":1}`

func cleanupSupplierCardTables(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.Exec("DELETE FROM supplier_cards").Error)
	require.NoError(t, DB.Exec("DELETE FROM supplier_card_orders").Error)
	require.NoError(t, DB.Exec("DELETE FROM supplier_card_plans").Error)
	require.NoError(t, DB.Exec("DELETE FROM supplier_card_quota_logs").Error)
	require.NoError(t, DB.Exec("DELETE FROM users").Error)
	require.NoError(t, DB.Exec("DELETE FROM logs").Error)
}

func withSupplierCardQuotaPerUnit(t *testing.T, quotaPerUnit float64) {
	t.Helper()
	previous := common.QuotaPerUnit
	common.QuotaPerUnit = quotaPerUnit
	t.Cleanup(func() {
		common.QuotaPerUnit = previous
	})
}

func seedSupplierCardPlan(t *testing.T, db *gorm.DB, id int, amount int64, prices string) *SupplierCardPlan {
	t.Helper()
	plan := &SupplierCardPlan{
		Id:        id,
		Amount:    amount,
		Quota:     int(float64(amount) * common.QuotaPerUnit),
		Enabled:   true,
		SortOrder: id,
		Prices:    prices,
	}
	require.NoError(t, db.Create(plan).Error)
	return plan
}

func seedSupplierUser(t *testing.T, db *gorm.DB, id int, supplierLevel int, quota int, supplierCardQuota int) *User {
	t.Helper()
	user := &User{
		Id:                id,
		Username:          fmt.Sprintf("supplier_%d", id),
		DisplayName:       fmt.Sprintf("Supplier %d", id),
		Password:          "hashed_password",
		Status:            common.UserStatusEnabled,
		Role:              common.RoleCommonUser,
		Quota:             quota,
		SupplierLevel:     supplierLevel,
		SupplierCardQuota: supplierCardQuota,
		AffCode:           fmt.Sprintf("aff%d", id),
	}
	require.NoError(t, db.Create(user).Error)
	return user
}

func TestValidateSupplierLevel(t *testing.T) {
	require.NoError(t, ValidateSupplierLevel(0))
	require.NoError(t, ValidateSupplierLevel(10))
	require.Error(t, ValidateSupplierLevel(-1))
	require.Error(t, ValidateSupplierLevel(11))
}

func TestPurchaseSupplierCardsRejectsLevelZero(t *testing.T) {
	truncateTables(t)
	cleanupSupplierCardTables(t)
	withSupplierCardQuotaPerUnit(t, 100)
	seedSupplierCardPlan(t, DB, 1, 10, supplierCardTestPrices)
	user := seedSupplierUser(t, DB, 1, 0, 1000000, 1000000)

	_, _, err := PurchaseSupplierCards(user.Id, 1, 1, 100)

	require.Error(t, err)
	require.Contains(t, err.Error(), "not a supplier")
}

func TestPurchaseSupplierCardsCreatesOrderCardsAndDeductsSupplierCardBalance(t *testing.T) {
	truncateTables(t)
	cleanupSupplierCardTables(t)
	withSupplierCardQuotaPerUnit(t, 100)
	seedSupplierCardPlan(t, DB, 1, 10, supplierCardTestPrices)
	user := seedSupplierUser(t, DB, 1, 2, 0, 5000)

	order, cards, err := PurchaseSupplierCards(user.Id, 1, 2, 100)

	require.NoError(t, err)
	require.Len(t, cards, 2)
	require.NotEmpty(t, order.OrderNo)
	require.Equal(t, 2, order.SupplierLevel)
	require.Equal(t, int64(10), order.Amount)
	require.Equal(t, 1000, order.Quota)
	require.InDelta(t, 7.0, order.UnitPrice, 0.000001)
	require.InDelta(t, 14.0, order.TotalPrice, 0.000001)
	require.Equal(t, 1400, order.TotalDebitQuota)
	require.NotEmpty(t, cards[0].Code)
	require.NotEmpty(t, cards[0].ShareToken)
	require.Len(t, cards[0].ShareToken, SupplierCardShareTokenLength)
	require.NotEqual(t, cards[0].Code, cards[1].Code)
	require.Equal(t, order.Id, cards[0].OrderId)
	require.Equal(t, order.OrderNo, cards[0].OrderNo)
	require.Equal(t, 1000, cards[0].Quota)
	require.Equal(t, 700, cards[0].DebitQuota)
	require.Equal(t, SupplierCardStatusUnused, cards[0].Status)

	var refreshed User
	require.NoError(t, DB.First(&refreshed, user.Id).Error)
	require.Equal(t, 0, refreshed.Quota)
	require.Equal(t, 3600, refreshed.SupplierCardQuota)

	var movement SupplierCardQuotaLog
	require.NoError(t, DB.First(&movement, "supplier_user_id = ? AND action = ?", user.Id, "purchase").Error)
	require.Equal(t, user.Id, movement.SupplierUserId)
	require.Equal(t, order.Id, movement.OrderId)
	require.Equal(t, order.OrderNo, movement.OrderNo)
	require.Equal(t, -1400, movement.QuotaDelta)
	require.Equal(t, 5000, movement.QuotaBefore)
	require.Equal(t, 3600, movement.QuotaAfter)
}

func TestPurchaseSupplierCardsRejectsInsufficientSupplierCardBalance(t *testing.T) {
	truncateTables(t)
	cleanupSupplierCardTables(t)
	withSupplierCardQuotaPerUnit(t, 100)
	seedSupplierCardPlan(t, DB, 1, 10, supplierCardTestPrices)
	user := seedSupplierUser(t, DB, 1, 1, 1000000, 100)

	_, _, err := PurchaseSupplierCards(user.Id, 1, 1, 100)

	require.Error(t, err)
	require.Contains(t, err.Error(), "insufficient supplier card balance")

	var count int64
	require.NoError(t, DB.Model(&SupplierCard{}).Count(&count).Error)
	require.Equal(t, int64(0), count)

	var refreshed User
	require.NoError(t, DB.First(&refreshed, user.Id).Error)
	require.Equal(t, 1000000, refreshed.Quota)
	require.Equal(t, 100, refreshed.SupplierCardQuota)
}

func TestRedeemSupplierCardAddsQuotaAndRejectsRepeat(t *testing.T) {
	truncateTables(t)
	cleanupSupplierCardTables(t)
	withSupplierCardQuotaPerUnit(t, 100)
	seedSupplierCardPlan(t, DB, 1, 10, supplierCardTestPrices)
	supplier := seedSupplierUser(t, DB, 1, 1, 0, 5000)
	redeemer := seedSupplierUser(t, DB, 2, 0, 25, 0)
	_, cards, err := PurchaseSupplierCards(supplier.Id, 1, 1, 100)
	require.NoError(t, err)

	card, err := RedeemSupplierCardByShareToken(cards[0].ShareToken, redeemer.Id)

	require.NoError(t, err)
	require.Equal(t, SupplierCardStatusRedeemed, card.Status)
	require.Equal(t, redeemer.Id, card.RedeemedUserId)

	var refreshed User
	require.NoError(t, DB.First(&refreshed, redeemer.Id).Error)
	require.Equal(t, 1025, refreshed.Quota)

	_, err = RedeemSupplierCardByShareToken(cards[0].ShareToken, redeemer.Id)
	require.Error(t, err)
	require.Contains(t, err.Error(), "already redeemed")
}

func TestListSupplierCardsFiltersUnusedAndKeyword(t *testing.T) {
	truncateTables(t)
	cleanupSupplierCardTables(t)
	withSupplierCardQuotaPerUnit(t, 100)
	seedSupplierCardPlan(t, DB, 1, 10, supplierCardTestPrices)
	supplier := seedSupplierUser(t, DB, 1, 1, 0, 5000)
	redeemer := seedSupplierUser(t, DB, 2, 0, 0, 0)
	_, cards, err := PurchaseSupplierCards(supplier.Id, 1, 2, 100)
	require.NoError(t, err)
	_, err = RedeemSupplierCardByShareToken(cards[0].ShareToken, redeemer.Id)
	require.NoError(t, err)

	unusedOnly := true
	items, total, err := ListSupplierCards(supplier.Id, SupplierCardListQuery{
		Page:       1,
		PageSize:   10,
		UnusedOnly: &unusedOnly,
		Keyword:    cards[1].CodePreview,
	})

	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	require.Equal(t, cards[1].Id, items[0].Id)
	require.Equal(t, SupplierCardStatusUnused, items[0].Status)
}

func TestGetSupplierCardMaxPurchaseCountDefaultAndOverride(t *testing.T) {
	previousMap := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() {
		common.OptionMap = previousMap
	})

	require.Equal(t, DefaultSupplierCardMaxPurchaseCount, GetSupplierCardMaxPurchaseCount())

	common.OptionMap["SupplierCardMaxPurchaseCount"] = "25"
	require.Equal(t, 25, GetSupplierCardMaxPurchaseCount())

	common.OptionMap["SupplierCardMaxPurchaseCount"] = "-1"
	require.Equal(t, DefaultSupplierCardMaxPurchaseCount, GetSupplierCardMaxPurchaseCount())
}

func TestAdjustSupplierCardQuotaRecordsAdminMovement(t *testing.T) {
	truncateTables(t)
	cleanupSupplierCardTables(t)
	withSupplierCardQuotaPerUnit(t, 100)
	supplier := seedSupplierUser(t, DB, 1, 3, 9999, 100)

	updated, movement, err := AdjustSupplierCardQuota(99, supplier.Id, "add", 250, "manual funding")

	require.NoError(t, err)
	require.Equal(t, 350, updated.SupplierCardQuota)
	require.Equal(t, 9999, updated.Quota)
	require.Equal(t, supplier.Id, movement.SupplierUserId)
	require.Equal(t, 99, movement.OperatorUserId)
	require.Equal(t, "admin_add", movement.Action)
	require.Equal(t, 250, movement.QuotaDelta)
	require.Equal(t, 100, movement.QuotaBefore)
	require.Equal(t, 350, movement.QuotaAfter)
	require.Equal(t, "manual funding", movement.Memo)

	var refreshed User
	require.NoError(t, DB.First(&refreshed, supplier.Id).Error)
	require.Equal(t, 350, refreshed.SupplierCardQuota)
	require.Equal(t, 9999, refreshed.Quota)
}

func TestAdjustSupplierCardQuotaRejectsNormalUser(t *testing.T) {
	truncateTables(t)
	cleanupSupplierCardTables(t)
	normalUser := seedSupplierUser(t, DB, 1, 0, 0, 0)

	_, _, err := AdjustSupplierCardQuota(99, normalUser.Id, "add", 100, "")

	require.Error(t, err)
	require.Contains(t, err.Error(), "not a supplier")
}
