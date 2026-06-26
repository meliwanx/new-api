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
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const channelExportVersion = 1

type channelExportFile struct {
	Version    int                 `json:"version"`
	ExportedAt int64               `json:"exported_at"`
	Channels   []channelExportItem `json:"channels"`
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
		Version:    channelExportVersion,
		ExportedAt: common.GetTimestamp(),
		Channels:   items,
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

	items, err := parseChannelImportItems(body)
	if err != nil {
		common.ApiError(c, err)
		return
	}
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

	if err := model.BatchInsertChannels(channels); err != nil {
		common.ApiError(c, err)
		return
	}
	service.ResetProxyClientCache()
	recordManageAudit(c, "channel.import", map[string]interface{}{
		"count": len(channels),
	})
	common.ApiSuccess(c, gin.H{"imported": len(channels)})
}

func parseChannelImportItems(body []byte) ([]channelExportItem, error) {
	var payload channelExportFile
	if err := common.Unmarshal(body, &payload); err == nil && payload.Channels != nil {
		return payload.Channels, nil
	}
	var items []channelExportItem
	if err := common.Unmarshal(body, &items); err != nil {
		return nil, err
	}
	return items, nil
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
