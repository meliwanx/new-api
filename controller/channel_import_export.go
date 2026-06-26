package controller

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const channelExportVersion = 1

type channelExportFile struct {
	Version      int                        `json:"version"`
	ExportedAt   int64                      `json:"exported_at"`
	Channels     []channelExportItem        `json:"channels"`
	Groups       *channelExportGroups       `json:"groups,omitempty"`
	ModelPricing *channelExportModelPricing `json:"model_pricing,omitempty"`
}

type channelExportGroups struct {
	GroupRatio       map[string]float64 `json:"group_ratio,omitempty"`
	UserUsableGroups map[string]string  `json:"user_usable_groups,omitempty"`
}

type channelExportModelPricing struct {
	ModelPrice           map[string]float64 `json:"model_price,omitempty"`
	ModelRatio           map[string]float64 `json:"model_ratio,omitempty"`
	CompletionRatio      map[string]float64 `json:"completion_ratio,omitempty"`
	CacheRatio           map[string]float64 `json:"cache_ratio,omitempty"`
	CreateCacheRatio     map[string]float64 `json:"create_cache_ratio,omitempty"`
	ImageRatio           map[string]float64 `json:"image_ratio,omitempty"`
	AudioCompletionRatio map[string]float64 `json:"audio_completion_ratio,omitempty"`
}

type channelRelatedImportStats struct {
	ImportedGroups                int `json:"imported_groups"`
	ImportedUserUsableGroups      int `json:"imported_user_usable_groups"`
	ImportedModelPrices           int `json:"imported_model_prices"`
	ImportedModelRatios           int `json:"imported_model_ratios"`
	ImportedCompletionRatios      int `json:"imported_completion_ratios"`
	ImportedCacheRatios           int `json:"imported_cache_ratios"`
	ImportedCreateCacheRatios     int `json:"imported_create_cache_ratios"`
	ImportedImageRatios           int `json:"imported_image_ratios"`
	ImportedAudioCompletionRatios int `json:"imported_audio_completion_ratios"`
}

type channelExportItem struct {
	Type              int               `json:"type"`
	Key               string            `json:"key"`
	OpenAIOrg         *string           `json:"openai_organization,omitempty"`
	TestModel         *string           `json:"test_model,omitempty"`
	Status            int               `json:"status"`
	Name              string            `json:"name"`
	Weight            *uint             `json:"weight,omitempty"`
	BaseURL           *string           `json:"base_url,omitempty"`
	Other             string            `json:"other,omitempty"`
	Models            string            `json:"models"`
	Group             string            `json:"group"`
	ModelMapping      *string           `json:"model_mapping,omitempty"`
	StatusCodeMapping *string           `json:"status_code_mapping,omitempty"`
	Priority          *int64            `json:"priority,omitempty"`
	AutoBan           *int              `json:"auto_ban,omitempty"`
	Tag               *string           `json:"tag,omitempty"`
	Setting           *string           `json:"setting,omitempty"`
	ParamOverride     *string           `json:"param_override,omitempty"`
	HeaderOverride    *string           `json:"header_override,omitempty"`
	Remark            *string           `json:"remark,omitempty"`
	ChannelInfo       model.ChannelInfo `json:"channel_info"`
	Settings          string            `json:"settings,omitempty"`
}

func newChannelExportItem(channel model.Channel) channelExportItem {
	return channelExportItem{
		Type:              channel.Type,
		Key:               channel.Key,
		OpenAIOrg:         channel.OpenAIOrganization,
		TestModel:         channel.TestModel,
		Status:            channel.Status,
		Name:              channel.Name,
		Weight:            channel.Weight,
		BaseURL:           channel.BaseURL,
		Other:             channel.Other,
		Models:            channel.Models,
		Group:             channel.Group,
		ModelMapping:      channel.ModelMapping,
		StatusCodeMapping: channel.StatusCodeMapping,
		Priority:          channel.Priority,
		AutoBan:           channel.AutoBan,
		Tag:               channel.Tag,
		Setting:           channel.Setting,
		ParamOverride:     channel.ParamOverride,
		HeaderOverride:    channel.HeaderOverride,
		Remark:            channel.Remark,
		ChannelInfo:       channel.ChannelInfo,
		Settings:          channel.OtherSettings,
	}
}

func (item channelExportItem) toChannel(createdTime int64) model.Channel {
	status := item.Status
	if status == common.ChannelStatusUnknown {
		status = common.ChannelStatusEnabled
	}

	group := strings.TrimSpace(item.Group)
	if group == "" {
		group = "default"
	}

	channelInfo := item.ChannelInfo
	if channelInfo.IsMultiKey {
		if channelInfo.MultiKeyMode == "" {
			channelInfo.MultiKeyMode = constant.MultiKeyModeRandom
		}
		channelInfo.MultiKeyDisabledReason = nil
		channelInfo.MultiKeyDisabledTime = nil
		channelInfo.MultiKeyPollingIndex = 0
	}

	channel := model.Channel{
		Type:               item.Type,
		Key:                strings.TrimSpace(item.Key),
		OpenAIOrganization: item.OpenAIOrg,
		TestModel:          item.TestModel,
		Status:             status,
		Name:               strings.TrimSpace(item.Name),
		Weight:             item.Weight,
		CreatedTime:        createdTime,
		BaseURL:            item.BaseURL,
		Other:              item.Other,
		Models:             item.Models,
		Group:              group,
		ModelMapping:       item.ModelMapping,
		StatusCodeMapping:  item.StatusCodeMapping,
		Priority:           item.Priority,
		AutoBan:            item.AutoBan,
		Tag:                item.Tag,
		Setting:            item.Setting,
		ParamOverride:      item.ParamOverride,
		HeaderOverride:     item.HeaderOverride,
		Remark:             item.Remark,
		ChannelInfo:        channelInfo,
		OtherSettings:      item.Settings,
	}
	if channel.ChannelInfo.IsMultiKey && channel.ChannelInfo.MultiKeySize == 0 {
		channel.ChannelInfo.MultiKeySize = len(channel.GetKeys())
	}
	return channel
}

func channelExportQuery(c *gin.Context) *gorm.DB {
	groupFilter := model.NormalizeChannelGroupFilter(c.Query("group"))
	statusFilter := parseStatusFilter(c.Query("status"))
	typeFilter := -1
	if typeStr := c.Query("type"); typeStr != "" {
		if t, err := strconv.Atoi(typeStr); err == nil {
			typeFilter = t
		}
	}
	return buildChannelListQuery(groupFilter, statusFilter, typeFilter).Order("id ASC")
}

func collectExportGroupNames(items []channelExportItem) map[string]struct{} {
	groups := make(map[string]struct{})
	for _, item := range items {
		for _, group := range splitCommaFields(item.Group) {
			groups[group] = struct{}{}
		}
	}
	return groups
}

func collectExportModelNames(items []channelExportItem) map[string]struct{} {
	models := make(map[string]struct{})
	for _, item := range items {
		for _, modelName := range splitCommaFields(item.Models) {
			models[modelName] = struct{}{}
		}
		if item.TestModel != nil {
			if testModel := strings.TrimSpace(*item.TestModel); testModel != "" {
				models[testModel] = struct{}{}
			}
		}
	}
	return models
}

func splitCommaFields(value string) []string {
	parts := strings.Split(value, ",")
	results := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			results = append(results, part)
		}
	}
	return results
}

func collectExportGroups(items []channelExportItem) *channelExportGroups {
	groupNames := collectExportGroupNames(items)
	if len(groupNames) == 0 {
		return nil
	}

	allGroupRatio := ratio_setting.GetGroupRatioCopy()
	allUserUsableGroups := setting.GetUserUsableGroupsCopy()
	groups := &channelExportGroups{
		GroupRatio:       make(map[string]float64),
		UserUsableGroups: make(map[string]string),
	}
	for groupName := range groupNames {
		if ratio, ok := allGroupRatio[groupName]; ok {
			groups.GroupRatio[groupName] = ratio
		}
		if description, ok := allUserUsableGroups[groupName]; ok {
			groups.UserUsableGroups[groupName] = description
		}
	}
	if len(groups.GroupRatio) == 0 {
		groups.GroupRatio = nil
	}
	if len(groups.UserUsableGroups) == 0 {
		groups.UserUsableGroups = nil
	}
	if groups.GroupRatio == nil && groups.UserUsableGroups == nil {
		return nil
	}
	return groups
}

func collectExportModelPricing(items []channelExportItem) *channelExportModelPricing {
	modelNames := collectExportModelNames(items)
	if len(modelNames) == 0 {
		return nil
	}

	modelPricing := &channelExportModelPricing{
		ModelPrice:           collectFloatSettingsForModels(modelNames, ratio_setting.GetModelPriceCopy()),
		ModelRatio:           collectFloatSettingsForModels(modelNames, ratio_setting.GetModelRatioCopy()),
		CompletionRatio:      collectFloatSettingsForModels(modelNames, ratio_setting.GetCompletionRatioCopy()),
		CacheRatio:           collectFloatSettingsForModels(modelNames, ratio_setting.GetCacheRatioCopy()),
		CreateCacheRatio:     collectFloatSettingsForModels(modelNames, ratio_setting.GetCreateCacheRatioCopy()),
		ImageRatio:           collectFloatSettingsForModels(modelNames, ratio_setting.GetImageRatioCopy()),
		AudioCompletionRatio: collectFloatSettingsForModels(modelNames, ratio_setting.GetAudioCompletionRatioCopy()),
	}
	if len(modelPricing.ModelPrice) == 0 {
		modelPricing.ModelPrice = nil
	}
	if len(modelPricing.ModelRatio) == 0 {
		modelPricing.ModelRatio = nil
	}
	if len(modelPricing.CompletionRatio) == 0 {
		modelPricing.CompletionRatio = nil
	}
	if len(modelPricing.CacheRatio) == 0 {
		modelPricing.CacheRatio = nil
	}
	if len(modelPricing.CreateCacheRatio) == 0 {
		modelPricing.CreateCacheRatio = nil
	}
	if len(modelPricing.ImageRatio) == 0 {
		modelPricing.ImageRatio = nil
	}
	if len(modelPricing.AudioCompletionRatio) == 0 {
		modelPricing.AudioCompletionRatio = nil
	}
	if modelPricing.ModelPrice == nil &&
		modelPricing.ModelRatio == nil &&
		modelPricing.CompletionRatio == nil &&
		modelPricing.CacheRatio == nil &&
		modelPricing.CreateCacheRatio == nil &&
		modelPricing.ImageRatio == nil &&
		modelPricing.AudioCompletionRatio == nil {
		return nil
	}
	return modelPricing
}

func collectFloatSettingsForModels(modelNames map[string]struct{}, source map[string]float64) map[string]float64 {
	result := make(map[string]float64)
	for modelName := range modelNames {
		if value, ok := source[modelName]; ok {
			result[modelName] = value
			continue
		}
		formattedModelName := ratio_setting.FormatMatchingModelName(modelName)
		if formattedModelName != modelName {
			if value, ok := source[formattedModelName]; ok {
				result[formattedModelName] = value
			}
		}
	}
	return result
}

func ExportChannels(c *gin.Context) {
	format := strings.ToLower(strings.TrimSpace(c.DefaultQuery("format", "json")))
	if format == "" {
		format = "json"
	}
	if format != "json" && format != "csv" {
		common.ApiErrorMsg(c, "unsupported export format")
		return
	}

	var channels []model.Channel
	if err := channelExportQuery(c).Find(&channels).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	items := make([]channelExportItem, 0, len(channels))
	for _, channel := range channels {
		items = append(items, newChannelExportItem(channel))
	}

	filename := fmt.Sprintf("channels-%s.%s", time.Now().Format("20060102-150405"), format)
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

	if format == "csv" {
		exportChannelsCSV(c, items)
		return
	}

	payload := channelExportFile{
		Version:      channelExportVersion,
		ExportedAt:   common.GetTimestamp(),
		Channels:     items,
		Groups:       collectExportGroups(items),
		ModelPricing: collectExportModelPricing(items),
	}
	data, err := common.Marshal(payload)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.Data(http.StatusOK, "application/json; charset=utf-8", data)
}

func exportChannelsCSV(c *gin.Context, items []channelExportItem) {
	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)
	header := []string{"name", "type", "key", "base_url", "models", "group", "status", "priority", "weight", "tag", "remark"}
	if err := writer.Write(header); err != nil {
		common.ApiError(c, err)
		return
	}
	for _, item := range items {
		row := []string{
			item.Name,
			strconv.Itoa(item.Type),
			item.Key,
			stringValue(item.BaseURL),
			item.Models,
			item.Group,
			strconv.Itoa(item.Status),
			int64Value(item.Priority),
			uintValue(item.Weight),
			stringValue(item.Tag),
			stringValue(item.Remark),
		}
		if err := writer.Write(row); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		common.ApiError(c, err)
		return
	}
	c.Data(http.StatusOK, "text/csv; charset=utf-8", buffer.Bytes())
}

func ImportChannels(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	payload, err := parseChannelImportPayload(body)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := payload.Channels
	if len(items) == 0 {
		common.ApiErrorMsg(c, "no channels selected")
		return
	}

	now := common.GetTimestamp()
	channels := make([]model.Channel, 0, len(items))
	for idx, item := range items {
		channel := item.toChannel(now)
		if err := validateChannel(&channel, true); err != nil {
			common.ApiError(c, fmt.Errorf("channel %d invalid: %w", idx+1, err))
			return
		}
		channels = append(channels, channel)
	}

	relatedStats, err := importChannelRelatedSettings(payload)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.BatchInsertChannels(channels); err != nil {
		common.ApiError(c, err)
		return
	}
	service.ResetProxyClientCache()
	recordManageAudit(c, "channel.import", map[string]interface{}{
		"count":         len(channels),
		"groups":        relatedStats.ImportedGroups,
		"model_prices":  relatedStats.ImportedModelPrices,
		"model_ratios":  relatedStats.ImportedModelRatios,
		"completion":    relatedStats.ImportedCompletionRatios,
		"audio_pricing": relatedStats.ImportedAudioCompletionRatios,
	})
	common.ApiSuccess(c, gin.H{
		"imported":                         len(channels),
		"imported_groups":                  relatedStats.ImportedGroups,
		"imported_user_usable_groups":      relatedStats.ImportedUserUsableGroups,
		"imported_model_prices":            relatedStats.ImportedModelPrices,
		"imported_model_ratios":            relatedStats.ImportedModelRatios,
		"imported_completion_ratios":       relatedStats.ImportedCompletionRatios,
		"imported_cache_ratios":            relatedStats.ImportedCacheRatios,
		"imported_create_cache_ratios":     relatedStats.ImportedCreateCacheRatios,
		"imported_image_ratios":            relatedStats.ImportedImageRatios,
		"imported_audio_completion_ratios": relatedStats.ImportedAudioCompletionRatios,
	})
}

func parseChannelImportPayload(body []byte) (channelExportFile, error) {
	var payload channelExportFile
	if err := common.Unmarshal(body, &payload); err == nil && payload.Channels != nil {
		return payload, nil
	}
	var items []channelExportItem
	if err := common.Unmarshal(body, &items); err != nil {
		return channelExportFile{}, err
	}
	return channelExportFile{Version: channelExportVersion, Channels: items}, nil
}

func importChannelRelatedSettings(payload channelExportFile) (channelRelatedImportStats, error) {
	stats := channelRelatedImportStats{}
	if payload.Groups == nil && payload.ModelPricing == nil {
		return stats, nil
	}

	if err := model.SyncOptionMapFromDatabase(); err != nil {
		return stats, err
	}

	updates := make(map[string]string)
	selectedGroupKeys := collectExportGroupNames(payload.Channels)
	selectedModelKeys := collectExportModelSettingKeys(payload.Channels)
	if payload.Groups != nil {
		groupRatio, imported := mergeMissingFloatSettings(
			ratio_setting.GetGroupRatioCopy(),
			filterFloatSettingsByAllowed(payload.Groups.GroupRatio, selectedGroupKeys),
		)
		stats.ImportedGroups = imported
		if imported > 0 {
			groupRatioJSON, err := common.Marshal(groupRatio)
			if err != nil {
				return stats, err
			}
			updates["GroupRatio"] = string(groupRatioJSON)
		}

		userUsableGroups, imported := mergeMissingStringSettings(
			setting.GetUserUsableGroupsCopy(),
			filterStringSettingsByAllowed(payload.Groups.UserUsableGroups, selectedGroupKeys),
		)
		stats.ImportedUserUsableGroups = imported
		if imported > 0 {
			userUsableGroupsJSON, err := common.Marshal(userUsableGroups)
			if err != nil {
				return stats, err
			}
			updates["UserUsableGroups"] = string(userUsableGroupsJSON)
		}
	}

	if payload.ModelPricing != nil {
		modelPrice, imported := mergeMissingFloatSettings(
			ratio_setting.GetModelPriceCopy(),
			filterFloatSettingsByAllowed(payload.ModelPricing.ModelPrice, selectedModelKeys),
		)
		stats.ImportedModelPrices = imported
		if imported > 0 {
			modelPriceJSON, err := common.Marshal(modelPrice)
			if err != nil {
				return stats, err
			}
			updates["ModelPrice"] = string(modelPriceJSON)
		}

		modelRatio, imported := mergeMissingFloatSettings(
			ratio_setting.GetModelRatioCopy(),
			filterFloatSettingsByAllowed(payload.ModelPricing.ModelRatio, selectedModelKeys),
		)
		stats.ImportedModelRatios = imported
		if imported > 0 {
			modelRatioJSON, err := common.Marshal(modelRatio)
			if err != nil {
				return stats, err
			}
			updates["ModelRatio"] = string(modelRatioJSON)
		}

		completionRatio, imported := mergeMissingFloatSettings(
			ratio_setting.GetCompletionRatioCopy(),
			filterFloatSettingsByAllowed(payload.ModelPricing.CompletionRatio, selectedModelKeys),
		)
		stats.ImportedCompletionRatios = imported
		if imported > 0 {
			completionRatioJSON, err := common.Marshal(completionRatio)
			if err != nil {
				return stats, err
			}
			updates["CompletionRatio"] = string(completionRatioJSON)
		}

		cacheRatio, imported := mergeMissingFloatSettings(
			ratio_setting.GetCacheRatioCopy(),
			filterFloatSettingsByAllowed(payload.ModelPricing.CacheRatio, selectedModelKeys),
		)
		stats.ImportedCacheRatios = imported
		if imported > 0 {
			cacheRatioJSON, err := common.Marshal(cacheRatio)
			if err != nil {
				return stats, err
			}
			updates["CacheRatio"] = string(cacheRatioJSON)
		}

		createCacheRatio, imported := mergeMissingFloatSettings(
			ratio_setting.GetCreateCacheRatioCopy(),
			filterFloatSettingsByAllowed(payload.ModelPricing.CreateCacheRatio, selectedModelKeys),
		)
		stats.ImportedCreateCacheRatios = imported
		if imported > 0 {
			createCacheRatioJSON, err := common.Marshal(createCacheRatio)
			if err != nil {
				return stats, err
			}
			updates["CreateCacheRatio"] = string(createCacheRatioJSON)
		}

		imageRatio, imported := mergeMissingFloatSettings(
			ratio_setting.GetImageRatioCopy(),
			filterFloatSettingsByAllowed(payload.ModelPricing.ImageRatio, selectedModelKeys),
		)
		stats.ImportedImageRatios = imported
		if imported > 0 {
			imageRatioJSON, err := common.Marshal(imageRatio)
			if err != nil {
				return stats, err
			}
			updates["ImageRatio"] = string(imageRatioJSON)
		}

		audioCompletionRatio, imported := mergeMissingFloatSettings(
			ratio_setting.GetAudioCompletionRatioCopy(),
			filterFloatSettingsByAllowed(payload.ModelPricing.AudioCompletionRatio, selectedModelKeys),
		)
		stats.ImportedAudioCompletionRatios = imported
		if imported > 0 {
			audioCompletionRatioJSON, err := common.Marshal(audioCompletionRatio)
			if err != nil {
				return stats, err
			}
			updates["AudioCompletionRatio"] = string(audioCompletionRatioJSON)
		}
	}

	if len(updates) == 0 {
		return stats, nil
	}
	return stats, model.UpdateOptionsBulk(updates)
}

func collectExportModelSettingKeys(items []channelExportItem) map[string]struct{} {
	modelNames := collectExportModelNames(items)
	modelKeys := make(map[string]struct{}, len(modelNames)*2)
	for modelName := range modelNames {
		modelKeys[modelName] = struct{}{}
		formattedModelName := ratio_setting.FormatMatchingModelName(modelName)
		if formattedModelName != "" {
			modelKeys[formattedModelName] = struct{}{}
		}
	}
	return modelKeys
}

func filterFloatSettingsByAllowed(incoming map[string]float64, allowed map[string]struct{}) map[string]float64 {
	if len(incoming) == 0 || len(allowed) == 0 {
		return nil
	}
	filtered := make(map[string]float64)
	for key, value := range incoming {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		if _, ok := allowed[key]; ok {
			filtered[key] = value
		}
	}
	return filtered
}

func filterStringSettingsByAllowed(incoming map[string]string, allowed map[string]struct{}) map[string]string {
	if len(incoming) == 0 || len(allowed) == 0 {
		return nil
	}
	filtered := make(map[string]string)
	for key, value := range incoming {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		if _, ok := allowed[key]; ok {
			filtered[key] = value
		}
	}
	return filtered
}

func mergeMissingFloatSettings(current map[string]float64, incoming map[string]float64) (map[string]float64, int) {
	if current == nil {
		current = make(map[string]float64)
	}
	merged := make(map[string]float64, len(current)+len(incoming))
	for key, value := range current {
		merged[key] = value
	}
	imported := 0
	for key, value := range incoming {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		if _, exists := merged[key]; exists {
			continue
		}
		merged[key] = value
		imported++
	}
	return merged, imported
}

func mergeMissingStringSettings(current map[string]string, incoming map[string]string) (map[string]string, int) {
	if current == nil {
		current = make(map[string]string)
	}
	merged := make(map[string]string, len(current)+len(incoming))
	for key, value := range current {
		merged[key] = value
	}
	imported := 0
	for key, value := range incoming {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		if _, exists := merged[key]; exists {
			continue
		}
		merged[key] = value
		imported++
	}
	return merged, imported
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func int64Value(value *int64) string {
	if value == nil {
		return ""
	}
	return strconv.FormatInt(*value, 10)
}

func uintValue(value *uint) string {
	if value == nil {
		return ""
	}
	return strconv.FormatUint(uint64(*value), 10)
}
