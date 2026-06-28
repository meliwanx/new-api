package model

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func insertAffiliateWithdrawalTestUser(t *testing.T, id int, affQuota int) {
	t.Helper()
	require.NoError(t, DB.Create(&User{
		Id:              id,
		Username:        "withdraw_user_" + strconv.Itoa(id),
		Email:           "withdraw@example.com",
		Status:          common.UserStatusEnabled,
		AffCode:         "withdraw_aff_" + strconv.Itoa(id),
		AffQuota:        affQuota,
		AffHistoryQuota: affQuota,
	}).Error)
}

func validAffiliateWithdrawalCreateRequest(amount int) AffiliateWithdrawalCreateRequest {
	return AffiliateWithdrawalCreateRequest{
		Amount:      amount,
		Method:      AffiliateWithdrawalMethodAlipay,
		Account:     "buyer@example.com",
		AccountName: "Buyer Name",
	}
}

func TestCreateAffiliateWithdrawalDeductsAffiliateQuota(t *testing.T) {
	truncateTables(t)
	insertAffiliateWithdrawalTestUser(t, 2001, 1000)

	withdrawal, err := CreateAffiliateWithdrawal(2001, validAffiliateWithdrawalCreateRequest(400))

	require.NoError(t, err)
	require.NotNil(t, withdrawal)
	assert.Equal(t, 2001, withdrawal.UserId)
	assert.Equal(t, 400, withdrawal.Amount)
	assert.Equal(t, AffiliateWithdrawalMethodAlipay, withdrawal.Method)
	assert.Equal(t, AffiliateWithdrawalStatusProcessing, withdrawal.Status)

	user, err := GetUserById(2001, false)
	require.NoError(t, err)
	assert.Equal(t, 600, user.AffQuota)
	assert.Equal(t, 1000, user.AffHistoryQuota)
}

func TestCreateAffiliateWithdrawalRejectsInvalidAndInsufficientRequests(t *testing.T) {
	testCases := []struct {
		name    string
		req     AffiliateWithdrawalCreateRequest
		wantErr error
	}{
		{
			name: "missing account",
			req: AffiliateWithdrawalCreateRequest{
				Amount:      100,
				Method:      AffiliateWithdrawalMethodAlipay,
				AccountName: "Buyer Name",
			},
			wantErr: ErrAffiliateWithdrawalInvalidInput,
		},
		{
			name: "unsupported method",
			req: AffiliateWithdrawalCreateRequest{
				Amount:      100,
				Method:      "wechat",
				Account:     "buyer@example.com",
				AccountName: "Buyer Name",
			},
			wantErr: ErrAffiliateWithdrawalInvalidInput,
		},
		{
			name:    "insufficient balance",
			req:     validAffiliateWithdrawalCreateRequest(1200),
			wantErr: ErrAffiliateWithdrawalInsufficientBalance,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			insertAffiliateWithdrawalTestUser(t, 2002, 1000)

			withdrawal, err := CreateAffiliateWithdrawal(2002, tc.req)

			require.ErrorIs(t, err, tc.wantErr)
			assert.Nil(t, withdrawal)

			user, err := GetUserById(2002, false)
			require.NoError(t, err)
			assert.Equal(t, 1000, user.AffQuota)
		})
	}
}

func TestAffiliateWithdrawalTransitionsAndRefund(t *testing.T) {
	truncateTables(t)
	insertAffiliateWithdrawalTestUser(t, 2003, 1000)
	insertAffiliateWithdrawalTestUser(t, 2004, 1000)

	completed, err := CreateAffiliateWithdrawal(2003, validAffiliateWithdrawalCreateRequest(400))
	require.NoError(t, err)
	rejected, err := CreateAffiliateWithdrawal(2004, validAffiliateWithdrawalCreateRequest(300))
	require.NoError(t, err)

	require.NoError(t, CompleteAffiliateWithdrawal(completed.Id, "paid manually"))
	require.ErrorIs(t, RejectAffiliateWithdrawal(completed.Id, "already paid"), ErrAffiliateWithdrawalInvalidTransition)

	require.NoError(t, RejectAffiliateWithdrawal(rejected.Id, "account mismatch"))
	require.ErrorIs(t, CompleteAffiliateWithdrawal(rejected.Id, "paid"), ErrAffiliateWithdrawalInvalidTransition)

	completedUser, err := GetUserById(2003, false)
	require.NoError(t, err)
	assert.Equal(t, 600, completedUser.AffQuota)

	rejectedUser, err := GetUserById(2004, false)
	require.NoError(t, err)
	assert.Equal(t, 1000, rejectedUser.AffQuota)
}

func TestListAffiliateWithdrawalsFiltersByStatusAndUser(t *testing.T) {
	truncateTables(t)
	insertAffiliateWithdrawalTestUser(t, 2005, 1000)
	insertAffiliateWithdrawalTestUser(t, 2006, 1000)

	first, err := CreateAffiliateWithdrawal(2005, validAffiliateWithdrawalCreateRequest(200))
	require.NoError(t, err)
	second, err := CreateAffiliateWithdrawal(2006, validAffiliateWithdrawalCreateRequest(300))
	require.NoError(t, err)
	require.NoError(t, RejectAffiliateWithdrawal(second.Id, "manual reject"))

	userItems, userTotal, err := ListUserAffiliateWithdrawals(2005, &common.PageInfo{Page: 1, PageSize: 10})
	require.NoError(t, err)
	require.Equal(t, int64(1), userTotal)
	require.Len(t, userItems, 1)
	assert.Equal(t, first.Id, userItems[0].Id)

	rejectedItems, rejectedTotal, err := ListAffiliateWithdrawals(AffiliateWithdrawalListFilter{
		PageInfo: &common.PageInfo{Page: 1, PageSize: 10},
		Status:   AffiliateWithdrawalStatusRejected,
	})
	require.NoError(t, err)
	require.Equal(t, int64(1), rejectedTotal)
	require.Len(t, rejectedItems, 1)
	assert.Equal(t, second.Id, rejectedItems[0].Id)
	assert.Equal(t, "manual reject", rejectedItems[0].RejectReason)
}
