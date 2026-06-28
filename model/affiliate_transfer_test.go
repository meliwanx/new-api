package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTransferAffQuotaToQuotaIsDisabled(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create(&User{
		Id:       2101,
		Username: "affiliate_transfer_disabled_user",
		Status:   common.UserStatusEnabled,
		Quota:    250,
		AffQuota: 1000,
	}).Error)

	user, err := GetUserById(2101, false)
	require.NoError(t, err)

	err = user.TransferAffQuotaToQuota(400)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "分销返佣只能提现")

	var refreshed User
	require.NoError(t, DB.Select("quota", "aff_quota").Where("id = ?", 2101).First(&refreshed).Error)
	assert.Equal(t, 250, refreshed.Quota)
	assert.Equal(t, 1000, refreshed.AffQuota)
}
