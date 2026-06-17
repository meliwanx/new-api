package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSupplierCardControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	common.UsingSQLite = true
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	previousQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 100
	t.Cleanup(func() {
		common.QuotaPerUnit = previousQuotaPerUnit
	})
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Log{},
		&model.SupplierCardPlan{},
		&model.SupplierCardOrder{},
		&model.SupplierCard{},
		&model.SupplierCardQuotaLog{},
	))
	return db
}

func TestGetSupplierCardShareOmitsFullSecrets(t *testing.T) {
	db := setupSupplierCardControllerTestDB(t)
	plan := &model.SupplierCardPlan{
		Id:      1,
		Amount:  10,
		Quota:   1000,
		Enabled: true,
		Prices:  `{"1":8,"2":7,"3":6,"4":5,"5":4,"6":3,"7":2,"8":1,"9":1,"10":1}`,
	}
	require.NoError(t, db.Create(plan).Error)
	require.NoError(t, db.Create(&model.User{
		Id:                1,
		Username:          "supplier",
		DisplayName:       "Supplier",
		Password:          "hashed_password",
		Status:            common.UserStatusEnabled,
		Quota:             5000,
		SupplierLevel:     1,
		SupplierCardQuota: 5000,
		AffCode:           "aff1",
	}).Error)
	_, cards, err := model.PurchaseSupplierCards(1, 1, 1, 100)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/supplier-cards/share/"+cards[0].ShareToken, nil)
	ctx.Params = gin.Params{{Key: "token", Value: cards[0].ShareToken}}

	GetSupplierCardShare(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.Equal(t, true, payload["success"])
	data, ok := payload["data"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, cards[0].CodePreview, data["code_preview"])
	require.NotContains(t, data, "code")
	require.NotContains(t, data, "share_token")
}
