package model

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func insertInvoiceTestUser(t *testing.T, id int) {
	t.Helper()
	require.NoError(t, DB.Create(&User{
		Id:       id,
		Username: "invoice_user_" + strconv.Itoa(id),
		Email:    "buyer@example.com",
		Status:   common.UserStatusEnabled,
		AffCode:  "invoice_aff_" + strconv.Itoa(id),
	}).Error)
}

func insertInvoiceTestTopUp(t *testing.T, tradeNo string, userID int, status string) *TopUp {
	t.Helper()
	topUp := &TopUp{
		UserId:          userID,
		Amount:          20,
		Money:           20.5,
		TradeNo:         tradeNo,
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		Status:          status,
		CreateTime:      1700000000,
		CompleteTime:    1700000100,
	}
	require.NoError(t, topUp.Insert())
	return topUp
}

func validInvoiceCreateRequest(tradeNo string) InvoiceCreateRequest {
	return InvoiceCreateRequest{
		TradeNo:     tradeNo,
		InvoiceType: InvoiceTypeBusiness,
		Title:       "OnlyMeOK LLC",
		TaxNo:       "TAX-123",
		Email:       "billing@example.com",
		Remark:      "Please issue a VAT invoice",
	}
}

func TestCreateInvoiceRequest_CreatesOneRequestForSuccessfulTopUp(t *testing.T) {
	truncateTables(t)
	insertInvoiceTestUser(t, 1001)
	topUp := insertInvoiceTestTopUp(t, "invoice-success-order", 1001, common.TopUpStatusSuccess)

	invoice, err := CreateInvoiceRequest(1001, validInvoiceCreateRequest(topUp.TradeNo))

	require.NoError(t, err)
	require.NotZero(t, invoice.Id)
	assert.Equal(t, topUp.Id, invoice.TopUpId)
	assert.Equal(t, topUp.TradeNo, invoice.TradeNo)
	assert.Equal(t, 1001, invoice.UserId)
	assert.Equal(t, InvoiceTypeBusiness, invoice.InvoiceType)
	assert.Equal(t, InvoiceStatusPending, invoice.Status)
	assert.Equal(t, topUp.Money, invoice.Money)

	duplicate, err := CreateInvoiceRequest(1001, validInvoiceCreateRequest(topUp.TradeNo))
	require.ErrorIs(t, err, ErrInvoiceAlreadyExists)
	assert.Nil(t, duplicate)
}

func TestCreateInvoiceRequest_RejectsInvalidTopUpStatusAndOwnership(t *testing.T) {
	testCases := []struct {
		name      string
		tradeNo   string
		userID    int
		status    string
		requester int
		wantErr   error
	}{
		{
			name:      "pending order",
			tradeNo:   "invoice-pending-order",
			userID:    1002,
			status:    common.TopUpStatusPending,
			requester: 1002,
			wantErr:   ErrInvoiceTopUpNotEligible,
		},
		{
			name:      "refunded order",
			tradeNo:   "invoice-refunded-order",
			userID:    1003,
			status:    common.TopUpStatusRefunded,
			requester: 1003,
			wantErr:   ErrInvoiceTopUpNotEligible,
		},
		{
			name:      "other user order",
			tradeNo:   "invoice-other-user-order",
			userID:    1004,
			status:    common.TopUpStatusSuccess,
			requester: 9999,
			wantErr:   ErrInvoiceTopUpNotFound,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			insertInvoiceTestUser(t, tc.userID)
			insertInvoiceTestTopUp(t, tc.tradeNo, tc.userID, tc.status)

			invoice, err := CreateInvoiceRequest(tc.requester, validInvoiceCreateRequest(tc.tradeNo))

			require.ErrorIs(t, err, tc.wantErr)
			assert.Nil(t, invoice)
		})
	}
}

func TestInvoiceRequestTransitionsAndListing(t *testing.T) {
	truncateTables(t)
	insertInvoiceTestUser(t, 1005)
	insertInvoiceTestUser(t, 1006)
	insertInvoiceTestTopUp(t, "invoice-list-a", 1005, common.TopUpStatusSuccess)
	insertInvoiceTestTopUp(t, "invoice-list-b", 1006, common.TopUpStatusSuccess)

	first, err := CreateInvoiceRequest(1005, validInvoiceCreateRequest("invoice-list-a"))
	require.NoError(t, err)
	second, err := CreateInvoiceRequest(1006, validInvoiceCreateRequest("invoice-list-b"))
	require.NoError(t, err)

	require.NoError(t, MarkInvoiceProcessing(first.Id, "admin started"))
	require.NoError(t, MarkInvoiceIssued(first.Id, InvoiceIssueRequest{
		DeliveryMethod: InvoiceDeliveryEmail,
		AdminNote:      "Sent by email",
		Provider:       "manual",
		ExternalId:     "manual-001",
	}))
	require.NoError(t, RejectInvoiceRequest(second.Id, "missing tax data"))

	userItems, userTotal, err := ListUserInvoiceRequests(1005, &common.PageInfo{Page: 1, PageSize: 10})
	require.NoError(t, err)
	require.Equal(t, int64(1), userTotal)
	require.Len(t, userItems, 1)
	assert.Equal(t, InvoiceStatusIssued, userItems[0].Status)
	assert.Equal(t, InvoiceDeliveryEmail, userItems[0].DeliveryMethod)

	adminItems, adminTotal, err := ListInvoiceRequests(InvoiceListFilter{
		PageInfo: &common.PageInfo{Page: 1, PageSize: 10},
		Status:   InvoiceStatusRejected,
	})
	require.NoError(t, err)
	require.Equal(t, int64(1), adminTotal)
	require.Len(t, adminItems, 1)
	assert.Equal(t, second.Id, adminItems[0].Id)
	assert.Equal(t, "missing tax data", adminItems[0].RejectReason)
}

func TestGetInvoiceFileAuthorizesUserOrAdmin(t *testing.T) {
	truncateTables(t)
	insertInvoiceTestUser(t, 1007)
	insertInvoiceTestTopUp(t, "invoice-file-order", 1007, common.TopUpStatusSuccess)
	invoice, err := CreateInvoiceRequest(1007, validInvoiceCreateRequest("invoice-file-order"))
	require.NoError(t, err)

	require.NoError(t, MarkInvoiceIssuedWithFile(invoice.Id, InvoiceFileInfo{
		Path: "data/invoices/test.pdf",
		Name: "test.pdf",
		Mime: "application/pdf",
		Size: 123,
	}, "uploaded"))

	userFile, err := GetInvoiceFile(invoice.Id, 1007, false)
	require.NoError(t, err)
	assert.Equal(t, "data/invoices/test.pdf", userFile.Path)

	otherUserFile, err := GetInvoiceFile(invoice.Id, 2000, false)
	require.ErrorIs(t, err, ErrInvoiceNotFound)
	assert.Nil(t, otherUserFile)

	adminFile, err := GetInvoiceFile(invoice.Id, 0, true)
	require.NoError(t, err)
	assert.Equal(t, "test.pdf", adminFile.Name)
}
