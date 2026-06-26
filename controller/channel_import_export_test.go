package controller

import (
	"bytes"
	"encoding/csv"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelImportExportControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	previousUsingSQLite := common.UsingSQLite
	previousRedisEnabled := common.RedisEnabled
	previousBatchUpdateEnabled := common.BatchUpdateEnabled

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	common.UsingSQLite = true
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))

	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.UsingSQLite = previousUsingSQLite
		common.RedisEnabled = previousRedisEnabled
		common.BatchUpdateEnabled = previousBatchUpdateEnabled
	})

	return db
}

func TestExportChannelsWritesJsonConfigWithKeysAndNoRuntimeState(t *testing.T) {
	db := setupChannelImportExportControllerTestDB(t)
	baseURL := "https://upstream.example.com/v1"
	tag := "premium"
	remark := "primary route"
	weight := uint(30)
	priority := int64(10)
	require.NoError(t, db.Create(&model.Channel{
		Type:               constant.ChannelTypeOpenAI,
		Key:                "sk-secret",
		Status:             common.ChannelStatusEnabled,
		Name:               "OpenAI upstream",
		Weight:             &weight,
		CreatedTime:        123,
		TestTime:           456,
		ResponseTime:       789,
		BaseURL:            &baseURL,
		Balance:            99.5,
		BalanceUpdatedTime: 321,
		Models:             "gpt-4o,gpt-4.1",
		Group:              "default,vip",
		UsedQuota:          1000,
		Priority:           &priority,
		Tag:                &tag,
		Remark:             &remark,
		OtherSettings:      `{"upstream_model_update_check_enabled":true}`,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/channel/export?format=json", nil)

	ExportChannels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "application/json; charset=utf-8", recorder.Header().Get("Content-Type"))

	var payload map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.Equal(t, float64(1), payload["version"])
	channels, ok := payload["channels"].([]any)
	require.True(t, ok)
	require.Len(t, channels, 1)
	channel, ok := channels[0].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "sk-secret", channel["key"])
	require.Equal(t, "OpenAI upstream", channel["name"])
	require.Equal(t, `{"upstream_model_update_check_enabled":true}`, channel["settings"])
	require.NotContains(t, channel, "id")
	require.NotContains(t, channel, "created_time")
	require.NotContains(t, channel, "test_time")
	require.NotContains(t, channel, "response_time")
	require.NotContains(t, channel, "balance")
	require.NotContains(t, channel, "balance_updated_time")
	require.NotContains(t, channel, "used_quota")
}

func TestExportChannelsWritesCsvWithConfigColumns(t *testing.T) {
	db := setupChannelImportExportControllerTestDB(t)
	baseURL := "https://csv.example.com/v1"
	require.NoError(t, db.Create(&model.Channel{
		Type:    constant.ChannelTypeAnthropic,
		Key:     "anthropic-key",
		Status:  common.ChannelStatusManuallyDisabled,
		Name:    "Claude, backup",
		BaseURL: &baseURL,
		Models:  "claude-opus-4-8",
		Group:   "default",
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/channel/export?format=csv", nil)

	ExportChannels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "text/csv; charset=utf-8", recorder.Header().Get("Content-Type"))

	records, err := csv.NewReader(strings.NewReader(recorder.Body.String())).ReadAll()
	require.NoError(t, err)
	require.Len(t, records, 2)
	require.Equal(t, []string{"name", "type", "key", "base_url", "models", "group", "status", "priority", "weight", "tag", "remark"}, records[0])
	require.Equal(t, []string{"Claude, backup", "14", "anthropic-key", baseURL, "claude-opus-4-8", "default", "2", "", "", "", ""}, records[1])
}

func TestImportChannelsCreatesSelectedConfigsAndClearsRuntimeState(t *testing.T) {
	db := setupChannelImportExportControllerTestDB(t)
	body, err := common.Marshal(map[string]any{
		"version": 1,
		"channels": []map[string]any{
			{
				"id":                   99,
				"type":                 constant.ChannelTypeOpenAI,
				"key":                  "sk-imported",
				"status":               common.ChannelStatusEnabled,
				"name":                 "Imported OpenAI",
				"created_time":         100,
				"test_time":            200,
				"response_time":        300,
				"balance":              400,
				"balance_updated_time": 500,
				"used_quota":           600,
				"base_url":             "https://imported.example.com/v1",
				"models":               "gpt-4o,gpt-4.1",
				"group":                "default",
				"settings":             `{"disable_store":true}`,
			},
		},
	})
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/import", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	ImportChannels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.Equal(t, true, response["success"])
	data, ok := response["data"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(1), data["imported"])

	var imported model.Channel
	require.NoError(t, db.First(&imported, "name = ?", "Imported OpenAI").Error)
	require.NotEqual(t, 99, imported.Id)
	require.Equal(t, "sk-imported", imported.Key)
	require.Equal(t, "https://imported.example.com/v1", imported.GetBaseURL())
	require.NotZero(t, imported.CreatedTime)
	require.Zero(t, imported.TestTime)
	require.Zero(t, imported.ResponseTime)
	require.Zero(t, imported.Balance)
	require.Zero(t, imported.BalanceUpdatedTime)
	require.Zero(t, imported.UsedQuota)
	require.Equal(t, `{"disable_store":true}`, imported.OtherSettings)

	var abilityCount int64
	require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", imported.Id).Count(&abilityCount).Error)
	require.Equal(t, int64(2), abilityCount)
}
