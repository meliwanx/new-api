package model

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func cleanupRedemptionTables(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.Exec("DELETE FROM redemptions").Error)
	t.Cleanup(func() {
		_ = DB.Exec("DELETE FROM redemptions").Error
	})
}

func seedRedemption(t *testing.T, redemption *Redemption) *Redemption {
	t.Helper()
	if redemption.CreatedTime == 0 {
		redemption.CreatedTime = common.GetTimestamp()
	}
	require.NoError(t, DB.Create(redemption).Error)
	return redemption
}

func TestListRedemptionsFiltersByStatusAndQuota(t *testing.T) {
	cleanupRedemptionTables(t)
	now := common.GetTimestamp()
	quota10 := 1000

	enabled10 := seedRedemption(t, &Redemption{
		Key:    "enabled10",
		Name:   "batch-a",
		Status: common.RedemptionCodeStatusEnabled,
		Quota:  quota10,
	})
	seedRedemption(t, &Redemption{
		Key:    "used10",
		Name:   "batch-b",
		Status: common.RedemptionCodeStatusUsed,
		Quota:  quota10,
	})
	seedRedemption(t, &Redemption{
		Key:    "enabled20",
		Name:   "batch-c",
		Status: common.RedemptionCodeStatusEnabled,
		Quota:  2000,
	})
	seedRedemption(t, &Redemption{
		Key:         "expired10",
		Name:        "batch-d",
		Status:      common.RedemptionCodeStatusEnabled,
		Quota:       quota10,
		ExpiredTime: now - 10,
	})

	items, total, err := ListRedemptions(RedemptionListQuery{
		Status:   strconv.Itoa(common.RedemptionCodeStatusEnabled),
		Quota:    &quota10,
		StartIdx: 0,
		Num:      10,
	})

	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Len(t, items, 2)
	require.Equal(t, "expired10", items[0].Key)
	require.Equal(t, enabled10.Id, items[1].Id)
}

func TestListRedemptionsFiltersExpiredVirtualStatus(t *testing.T) {
	cleanupRedemptionTables(t)
	now := common.GetTimestamp()

	seedRedemption(t, &Redemption{
		Key:         "expired",
		Name:        "expired-batch",
		Status:      common.RedemptionCodeStatusEnabled,
		Quota:       1000,
		ExpiredTime: now - 10,
	})
	seedRedemption(t, &Redemption{
		Key:         "future",
		Name:        "future-batch",
		Status:      common.RedemptionCodeStatusEnabled,
		Quota:       1000,
		ExpiredTime: now + 3600,
	})
	seedRedemption(t, &Redemption{
		Key:    "used",
		Name:   "used-batch",
		Status: common.RedemptionCodeStatusUsed,
		Quota:  1000,
	})

	items, total, err := ListRedemptions(RedemptionListQuery{
		Status: RedemptionFilterStatusExpired,
		Num:    10,
	})

	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	require.Equal(t, "expired", items[0].Key)
}
