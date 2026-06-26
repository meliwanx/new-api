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
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
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
	previousOptionMap := common.OptionMap
	previousGroupRatio := ratio_setting.GroupRatio2JSONString()
	previousUserUsableGroups := setting.UserUsableGroups2JSONString()
	previousModelPrice := ratio_setting.ModelPrice2JSONString()
	previousModelRatio := ratio_setting.ModelRatio2JSONString()
	previousCompletionRatio := ratio_setting.CompletionRatio2JSONString()
	previousCacheRatio := ratio_setting.CacheRatio2JSONString()
	previousCreateCacheRatio := ratio_setting.CreateCacheRatio2JSONString()
	previousImageRatio := ratio_setting.ImageRatio2JSONString()
	previousAudioCompletionRatio := ratio_setting.AudioCompletionRatio2JSONString()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	common.UsingSQLite = true
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.OptionMap = map[string]string{}
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.Option{}))

	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.UsingSQLite = previousUsingSQLite
		common.RedisEnabled = previousRedisEnabled
		common.BatchUpdateEnabled = previousBatchUpdateEnabled
		common.OptionMap = previousOptionMap
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previousGroupRatio))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(previousUserUsableGroups))
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(previousModelPrice))
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(previousModelRatio))
		require.NoError(t, ratio_setting.UpdateCompletionRatioByJSONString(previousCompletionRatio))
		require.NoError(t, ratio_setting.UpdateCacheRatioByJSONString(previousCacheRatio))
		require.NoError(t, ratio_setting.UpdateCreateCacheRatioByJSONString(previousCreateCacheRatio))
		require.NoError(t, ratio_setting.UpdateImageRatioByJSONString(previousImageRatio))
		require.NoError(t, ratio_setting.UpdateAudioCompletionRatioByJSONString(previousAudioCompletionRatio))
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

func TestExportChannelsIncludesRelatedGroupsAndModelPricing(t *testing.T) {
	db := setupChannelImportExportControllerTestDB(t)
	require.NoError(t, model.UpdateOption("GroupRatio", `{"default":1,"reseller":1.23,"unused":9}`))
	require.NoError(t, model.UpdateOption("UserUsableGroups", `{"default":"Default","reseller":"Reseller Group","unused":"Unused Group"}`))
	require.NoError(t, model.UpdateOption("ModelPrice", `{"gpt-custom":0.5,"unused-model":9}`))
	require.NoError(t, model.UpdateOption("ModelRatio", `{"claude-custom":0.7,"unused-model":9}`))
	require.NoError(t, model.UpdateOption("CompletionRatio", `{"claude-custom":2,"unused-model":9}`))
	require.NoError(t, model.UpdateOption("CacheRatio", `{"gpt-custom":0.25,"unused-model":9}`))
	require.NoError(t, model.UpdateOption("CreateCacheRatio", `{"claude-custom":1.1,"unused-model":9}`))
	require.NoError(t, model.UpdateOption("ImageRatio", `{"gpt-image-1":2,"unused-model":9}`))
	require.NoError(t, model.UpdateOption("AudioCompletionRatio", `{"gpt-custom":1.4,"unused-model":9}`))
	require.NoError(t, db.Create(&model.Channel{
		Type:   constant.ChannelTypeOpenAI,
		Key:    "sk-secret",
		Status: common.ChannelStatusEnabled,
		Name:   "priced upstream",
		Models: "gpt-custom,claude-custom,gpt-image-1",
		Group:  "default,reseller",
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/channel/export?format=json", nil)

	ExportChannels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	groups, ok := payload["groups"].(map[string]any)
	require.True(t, ok)
	groupRatio, ok := groups["group_ratio"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(1.23), groupRatio["reseller"])
	require.NotContains(t, groupRatio, "unused")
	userUsableGroups, ok := groups["user_usable_groups"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "Reseller Group", userUsableGroups["reseller"])
	require.NotContains(t, userUsableGroups, "unused")

	modelPricing, ok := payload["model_pricing"].(map[string]any)
	require.True(t, ok)
	modelPrice, ok := modelPricing["model_price"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(0.5), modelPrice["gpt-custom"])
	require.NotContains(t, modelPrice, "unused-model")
	modelRatio, ok := modelPricing["model_ratio"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(0.7), modelRatio["claude-custom"])
	completionRatio, ok := modelPricing["completion_ratio"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(2), completionRatio["claude-custom"])
	cacheRatio, ok := modelPricing["cache_ratio"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(0.25), cacheRatio["gpt-custom"])
	createCacheRatio, ok := modelPricing["create_cache_ratio"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(1.1), createCacheRatio["claude-custom"])
	imageRatio, ok := modelPricing["image_ratio"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(2), imageRatio["gpt-image-1"])
	audioCompletionRatio, ok := modelPricing["audio_completion_ratio"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(1.4), audioCompletionRatio["gpt-custom"])
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
	require.Equal(t, []string{"Claude, backup", "14", "anthropic-key", baseURL, "claude-opus-4-8", "default", "2", "0", "0", "", ""}, records[1])
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

func TestImportChannelsAddsMissingRelatedGroupsAndModelPricingOnly(t *testing.T) {
	setupChannelImportExportControllerTestDB(t)
	require.NoError(t, model.UpdateOption("GroupRatio", `{"default":1,"reseller":9}`))
	require.NoError(t, model.UpdateOption("UserUsableGroups", `{"default":"Default","reseller":"Existing Reseller"}`))
	require.NoError(t, model.UpdateOption("ModelPrice", `{"gpt-custom":9}`))
	require.NoError(t, model.UpdateOption("ModelRatio", `{"claude-custom":9}`))
	require.NoError(t, model.UpdateOption("CompletionRatio", `{}`))
	require.NoError(t, model.UpdateOption("CacheRatio", `{}`))
	require.NoError(t, model.UpdateOption("CreateCacheRatio", `{}`))
	require.NoError(t, model.UpdateOption("ImageRatio", `{}`))
	require.NoError(t, model.UpdateOption("AudioCompletionRatio", `{}`))
	body, err := common.Marshal(map[string]any{
		"version": 1,
		"channels": []map[string]any{
			{
				"type":   constant.ChannelTypeOpenAI,
				"key":    "sk-imported",
				"status": common.ChannelStatusEnabled,
				"name":   "Imported priced OpenAI",
				"models": "gpt-custom,claude-custom,new-model,ratio-new,cache-model,create-cache-model,gpt-image-1",
				"group":  "reseller,newgroup",
			},
		},
		"groups": map[string]any{
			"group_ratio": map[string]float64{
				"reseller": 1.23,
				"newgroup": 1.5,
			},
			"user_usable_groups": map[string]string{
				"reseller": "Exported Reseller",
				"newgroup": "New Group",
			},
		},
		"model_pricing": map[string]any{
			"model_price": map[string]float64{
				"gpt-custom": 0.5,
				"new-model": 0.8,
				"not-selected": 7,
			},
			"model_ratio": map[string]float64{
				"claude-custom": 0.7,
				"ratio-new": 0.9,
				"not-selected": 7,
			},
			"completion_ratio": map[string]float64{
				"claude-custom": 2,
				"not-selected": 7,
			},
			"cache_ratio": map[string]float64{
				"cache-model": 0.25,
				"not-selected": 7,
			},
			"create_cache_ratio": map[string]float64{
				"create-cache-model": 1.1,
				"not-selected": 7,
			},
			"image_ratio": map[string]float64{
				"gpt-image-1": 2,
				"not-selected": 7,
			},
			"audio_completion_ratio": map[string]float64{
				"gpt-custom": 1.4,
				"not-selected": 7,
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
	require.Equal(t, float64(1), data["imported_groups"])
	require.Equal(t, float64(1), data["imported_user_usable_groups"])
	require.Equal(t, float64(1), data["imported_model_prices"])
	require.Equal(t, float64(1), data["imported_model_ratios"])
	require.Equal(t, float64(1), data["imported_completion_ratios"])
	require.Equal(t, float64(1), data["imported_cache_ratios"])
	require.Equal(t, float64(1), data["imported_create_cache_ratios"])
	require.Equal(t, float64(1), data["imported_image_ratios"])
	require.Equal(t, float64(1), data["imported_audio_completion_ratios"])

	groupRatio := ratio_setting.GetGroupRatioCopy()
	require.Equal(t, float64(9), groupRatio["reseller"])
	require.Equal(t, float64(1.5), groupRatio["newgroup"])
	userUsableGroups := setting.GetUserUsableGroupsCopy()
	require.Equal(t, "Existing Reseller", userUsableGroups["reseller"])
	require.Equal(t, "New Group", userUsableGroups["newgroup"])
	modelPrice := ratio_setting.GetModelPriceCopy()
	require.Equal(t, float64(9), modelPrice["gpt-custom"])
	require.Equal(t, float64(0.8), modelPrice["new-model"])
	require.NotContains(t, modelPrice, "not-selected")
	modelRatio := ratio_setting.GetModelRatioCopy()
	require.Equal(t, float64(9), modelRatio["claude-custom"])
	require.Equal(t, float64(0.9), modelRatio["ratio-new"])
	require.NotContains(t, modelRatio, "not-selected")
	completionRatio := ratio_setting.GetCompletionRatioCopy()
	require.Equal(t, float64(2), completionRatio["claude-custom"])
	require.NotContains(t, completionRatio, "not-selected")
	cacheRatio := ratio_setting.GetCacheRatioCopy()
	require.Equal(t, float64(0.25), cacheRatio["cache-model"])
	require.NotContains(t, cacheRatio, "not-selected")
	createCacheRatio := ratio_setting.GetCreateCacheRatioCopy()
	require.Equal(t, float64(1.1), createCacheRatio["create-cache-model"])
	require.NotContains(t, createCacheRatio, "not-selected")
	imageRatio := ratio_setting.GetImageRatioCopy()
	require.Equal(t, float64(2), imageRatio["gpt-image-1"])
	require.NotContains(t, imageRatio, "not-selected")
	audioCompletionRatio := ratio_setting.GetAudioCompletionRatioCopy()
	require.Equal(t, float64(1.4), audioCompletionRatio["gpt-custom"])
	require.NotContains(t, audioCompletionRatio, "not-selected")
}
