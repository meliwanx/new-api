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

func setupRedemptionControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	previousQuotaPerUnit := common.QuotaPerUnit
	previousUsingSQLite := common.UsingSQLite
	previousRedisEnabled := common.RedisEnabled
	previousBatchUpdateEnabled := common.BatchUpdateEnabled

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	common.QuotaPerUnit = 100
	common.UsingSQLite = true
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	require.NoError(t, db.AutoMigrate(&model.Redemption{}))

	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.QuotaPerUnit = previousQuotaPerUnit
		common.UsingSQLite = previousUsingSQLite
		common.RedisEnabled = previousRedisEnabled
		common.BatchUpdateEnabled = previousBatchUpdateEnabled
	})

	return db
}

func TestExportRedemptionsWritesTxtWithFilters(t *testing.T) {
	db := setupRedemptionControllerTestDB(t)
	require.NoError(t, db.Create(&model.Redemption{
		Key:    "CODE10",
		Name:   "ten",
		Status: common.RedemptionCodeStatusEnabled,
		Quota:  1000,
	}).Error)
	require.NoError(t, db.Create(&model.Redemption{
		Key:    "CODE20",
		Name:   "twenty",
		Status: common.RedemptionCodeStatusUsed,
		Quota:  2000,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/redemption/export?format=txt&status=1&quota=1000", nil)

	ExportRedemptions(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "text/plain; charset=utf-8", recorder.Header().Get("Content-Type"))
	require.Equal(t, "CODE10/＄10.000000\n", recorder.Body.String())
}

func TestExportRedemptionsWritesCsvWithCodeAndQuotaOnly(t *testing.T) {
	db := setupRedemptionControllerTestDB(t)
	require.NoError(t, db.Create(&model.Redemption{
		Key:    "CODE20",
		Name:   "twenty",
		Status: common.RedemptionCodeStatusUsed,
		Quota:  2000,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/redemption/export?format=csv", nil)

	ExportRedemptions(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "text/csv; charset=utf-8", recorder.Header().Get("Content-Type"))
	require.Equal(t, "CODE20,＄20.000000\n", recorder.Body.String())
}
