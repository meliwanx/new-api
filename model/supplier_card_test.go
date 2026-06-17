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

func seedSupplierUser(t *testing.T, db *gorm.DB, id int, supplierLevel int, quota int) *User {
	t.Helper()
	user := &User{
		Id:            id,
		Username:      fmt.Sprintf("supplier_%d", id),
		DisplayName:   fmt.Sprintf("Supplier %d", id),
		Password:      "hashed_password",
		Status:        common.UserStatusEnabled,
		Role:          common.RoleCommonUser,
		Quota:         quota,
		SupplierLevel: supplierLevel,
		AffCode:       fmt.Sprintf("aff%d", id),
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
	user := seedSupplierUser(t, DB, 1, 0, 1000000)

	_, _, err := PurchaseSupplierCards(user.Id, 1, 1, 100)

	require.Error(t, err)
	require.Contains(t, err.Error(), "not a supplier")
}

func TestPurchaseSupplierCardsCreatesOrderCardsAndDeductsBalance(t *testing.T) {
	truncateTables(t)
	cleanupSupplierCardTables(t)
	withSupplierCardQuotaPerUnit(t, 100)
	seedSupplierCardPlan(t, DB, 1, 10, supplierCardTestPrices)
	user := seedSupplierUser(t, DB, 1, 2, 5000)

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
	require.Equal(t, 3600, refreshed.Quota)
}

func TestPurchaseSupplierCardsRejectsInsufficientBalance(t *testing.T) {
	truncateTables(t)
	cleanupSupplierCardTables(t)
	withSupplierCardQuotaPerUnit(t, 100)
	seedSupplierCardPlan(t, DB, 1, 10, supplierCardTestPrices)
	user := seedSupplierUser(t, DB, 1, 1, 100)

	_, _, err := PurchaseSupplierCards(user.Id, 1, 1, 100)

	require.Error(t, err)
	require.Contains(t, err.Error(), "insufficient purchasing balance")

	var count int64
	require.NoError(t, DB.Model(&SupplierCard{}).Count(&count).Error)
	require.Equal(t, int64(0), count)
}

func TestPurchaseSupplierCardsRejectsRestrictedQuota(t *testing.T) {
	truncateTables(t)
	cleanupSupplierCardTables(t)
	withSupplierCardQuotaPerUnit(t, 100)
	seedSupplierCardPlan(t, DB, 1, 10, supplierCardTestPrices)
	user := seedSupplierUser(t, DB, 1, 1, 1000)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("restricted_quota", 1000).Error)

	_, _, err := PurchaseSupplierCards(user.Id, 1, 1, 100)

	require.Error(t, err)
	require.Contains(t, err.Error(), "insufficient purchasing balance")

	var count int64
	require.NoError(t, DB.Model(&SupplierCard{}).Count(&count).Error)
	require.Equal(t, int64(0), count)
}

func TestRedeemSupplierCardAddsQuotaAndRejectsRepeat(t *testing.T) {
	truncateTables(t)
	cleanupSupplierCardTables(t)
	withSupplierCardQuotaPerUnit(t, 100)
	seedSupplierCardPlan(t, DB, 1, 10, supplierCardTestPrices)
	supplier := seedSupplierUser(t, DB, 1, 1, 5000)
	redeemer := seedSupplierUser(t, DB, 2, 0, 25)
	_, cards, err := PurchaseSupplierCards(supplier.Id, 1, 1, 100)
	require.NoError(t, err)

	card, err := RedeemSupplierCardByShareToken(cards[0].ShareToken, redeemer.Id)

	require.NoError(t, err)
	require.Equal(t, SupplierCardStatusRedeemed, card.Status)
	require.Equal(t, redeemer.Id, card.RedeemedUserId)

	var refreshed User
	require.NoError(t, DB.First(&refreshed, redeemer.Id).Error)
	require.Equal(t, 1025, refreshed.Quota)
	require.Equal(t, 1000, refreshed.RestrictedQuota)

	_, err = RedeemSupplierCardByShareToken(cards[0].ShareToken, redeemer.Id)
	require.Error(t, err)
	require.Contains(t, err.Error(), "already redeemed")
}

func TestRestrictedQuotaConsumptionAndRefundKeepsPurchaseBalanceZero(t *testing.T) {
	truncateTables(t)
	cleanupSupplierCardTables(t)
	user := seedSupplierUser(t, DB, 1, 1, 1000)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("restricted_quota", 1000).Error)

	restrictedUsed, err := DecreaseUserQuotaForConsumption(user.Id, 700, true)
	require.NoError(t, err)
	require.Equal(t, 700, restrictedUsed)

	var consumed User
	require.NoError(t, DB.First(&consumed, user.Id).Error)
	require.Equal(t, 300, consumed.Quota)
	require.Equal(t, 300, consumed.RestrictedQuota)
	require.Equal(t, 0, GetUserPurchasableQuota(&consumed))

	require.NoError(t, IncreaseUserQuotaForConsumptionRefund(user.Id, 700, restrictedUsed, true))

	var refunded User
	require.NoError(t, DB.First(&refunded, user.Id).Error)
	require.Equal(t, 1000, refunded.Quota)
	require.Equal(t, 1000, refunded.RestrictedQuota)
	require.Equal(t, 0, GetUserPurchasableQuota(&refunded))
}

func TestBackfillSupplierCardRestrictedQuotaRunsOnce(t *testing.T) {
	truncateTables(t)
	cleanupSupplierCardTables(t)
	require.NoError(t, DB.Exec("DELETE FROM options").Error)
	user := seedSupplierUser(t, DB, 1, 1, 600)
	require.NoError(t, DB.Create(&SupplierCard{
		SupplierUserId: 2,
		SupplierLevel:  1,
		OrderId:        1,
		OrderNo:        "order_1",
		PlanId:         1,
		Amount:         10,
		Quota:          1000,
		Code:           "code_1",
		ShareToken:     "share_1",
		Status:         SupplierCardStatusRedeemed,
		RedeemedUserId: user.Id,
	}).Error)

	require.NoError(t, backfillSupplierCardRestrictedQuota())

	var backfilled User
	require.NoError(t, DB.First(&backfilled, user.Id).Error)
	require.Equal(t, 600, backfilled.Quota)
	require.Equal(t, 600, backfilled.RestrictedQuota)
	require.Equal(t, 0, GetUserPurchasableQuota(&backfilled))

	restrictedUsed, err := DecreaseUserQuotaForConsumption(user.Id, 500, true)
	require.NoError(t, err)
	require.Equal(t, 500, restrictedUsed)
	require.NoError(t, backfillSupplierCardRestrictedQuota())

	var afterSecondRun User
	require.NoError(t, DB.First(&afterSecondRun, user.Id).Error)
	require.Equal(t, 100, afterSecondRun.Quota)
	require.Equal(t, 100, afterSecondRun.RestrictedQuota)
	require.Equal(t, 0, GetUserPurchasableQuota(&afterSecondRun))
}

func TestListSupplierCardsFiltersUnusedAndKeyword(t *testing.T) {
	truncateTables(t)
	cleanupSupplierCardTables(t)
	withSupplierCardQuotaPerUnit(t, 100)
	seedSupplierCardPlan(t, DB, 1, 10, supplierCardTestPrices)
	supplier := seedSupplierUser(t, DB, 1, 1, 5000)
	redeemer := seedSupplierUser(t, DB, 2, 0, 0)
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
