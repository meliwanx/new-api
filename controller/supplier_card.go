package controller

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type supplierCardPlanRequest struct {
	Amount    int64              `json:"amount"`
	Enabled   bool               `json:"enabled"`
	SortOrder int                `json:"sort_order"`
	Prices    map[string]float64 `json:"prices"`
}

type supplierCardPurchaseRequest struct {
	PlanId int `json:"plan_id"`
	Count  int `json:"count"`
}

type supplierCardSettingsRequest struct {
	MaxPurchaseCount int `json:"max_purchase_count"`
}

type supplierCardShareResponse struct {
	Id                  int     `json:"id"`
	Amount              int64   `json:"amount"`
	Quota               int     `json:"quota"`
	CodePreview         string  `json:"code_preview"`
	ShareTokenPreview   string  `json:"share_token_preview"`
	Status              int     `json:"status"`
	RedeemedTime        int64   `json:"redeemed_time"`
	SupplierDisplayName string  `json:"supplier_display_name"`
	PurchasePrice       float64 `json:"purchase_price"`
}

type supplierCardPlanWithPrice struct {
	*model.SupplierCardPlan
	Price float64 `json:"price"`
}

func parseOptionalIntQuery(c *gin.Context, key string) (*int, error) {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return nil, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return nil, err
	}
	return &value, nil
}

func parseOptionalInt64Query(c *gin.Context, key string) (*int64, error) {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return nil, nil
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return nil, err
	}
	return &value, nil
}

func parseInt64Query(c *gin.Context, key string) int64 {
	value, _ := strconv.ParseInt(strings.TrimSpace(c.Query(key)), 10, 64)
	return value
}

func GetSupplierCardPlans(c *gin.Context) {
	user, err := model.GetUserById(c.GetInt("id"), false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user.SupplierLevel == 0 {
		common.ApiError(c, errors.New("not a supplier"))
		return
	}
	var plans []*model.SupplierCardPlan
	if err := model.DB.Where("enabled = ?", true).Order("sort_order asc, amount asc").Find(&plans).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]supplierCardPlanWithPrice, 0, len(plans))
	for _, plan := range plans {
		price, err := plan.PriceForLevel(user.SupplierLevel)
		if err != nil {
			continue
		}
		items = append(items, supplierCardPlanWithPrice{SupplierCardPlan: plan, Price: price})
	}
	common.ApiSuccess(c, gin.H{
		"supplier_level":     user.SupplierLevel,
		"max_purchase_count": model.GetSupplierCardMaxPurchaseCount(),
		"plans":              items,
	})
}

func PurchaseSupplierCards(c *gin.Context) {
	var req supplierCardPurchaseRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	order, cards, err := model.PurchaseSupplierCards(c.GetInt("id"), req.PlanId, req.Count, model.GetSupplierCardMaxPurchaseCount())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"order": order,
		"cards": cards,
	})
}

func GetUserSupplierCards(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	status, err := parseOptionalIntQuery(c, "status")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var unusedOnly *bool
	if c.Query("unused_only") != "" {
		value := c.Query("unused_only") == "true" || c.Query("unused_only") == "1"
		unusedOnly = &value
	}
	items, total, err := model.ListSupplierCards(c.GetInt("id"), model.SupplierCardListQuery{
		Page:       pageInfo.GetPage(),
		PageSize:   pageInfo.GetPageSize(),
		Status:     status,
		UnusedOnly: unusedOnly,
		Keyword:    c.Query("keyword"),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetSupplierCardShare(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	if token == "" {
		common.ApiError(c, errors.New("invalid supplier card token"))
		return
	}
	card := &model.SupplierCard{}
	if err := model.DB.First(card, "share_token = ?", token).Error; err != nil {
		common.ApiError(c, errors.New("supplier card not found"))
		return
	}
	supplierName := ""
	if supplier, err := model.GetUserById(card.SupplierUserId, false); err == nil {
		supplierName = supplier.DisplayName
		if supplierName == "" {
			supplierName = supplier.Username
		}
	}
	common.ApiSuccess(c, supplierCardShareResponse{
		Id:                  card.Id,
		Amount:              card.Amount,
		Quota:               card.Quota,
		CodePreview:         card.CodePreview,
		ShareTokenPreview:   card.ShareTokenPreview,
		Status:              card.Status,
		RedeemedTime:        card.RedeemedTime,
		SupplierDisplayName: supplierName,
		PurchasePrice:       card.PurchasePrice,
	})
}

func RedeemSupplierCardShare(c *gin.Context) {
	card, err := model.RedeemSupplierCardByShareToken(c.Param("token"), c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"quota": card.Quota,
		"card":  card,
	})
}

func AdminListSupplierCardPlans(c *gin.Context) {
	var plans []*model.SupplierCardPlan
	if err := model.DB.Order("sort_order asc, amount asc").Find(&plans).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, plans)
}

func buildSupplierCardPlanFromRequest(req supplierCardPlanRequest) (*model.SupplierCardPlan, error) {
	if req.Amount <= 0 {
		return nil, errors.New("amount must be positive")
	}
	prices, err := model.NormalizeSupplierCardPrices(req.Prices)
	if err != nil {
		return nil, err
	}
	return &model.SupplierCardPlan{
		Amount:    req.Amount,
		Quota:     int(float64(req.Amount) * common.QuotaPerUnit),
		Enabled:   req.Enabled,
		SortOrder: req.SortOrder,
		Prices:    prices,
	}, nil
}

func AdminCreateSupplierCardPlan(c *gin.Context) {
	var req supplierCardPlanRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	plan, err := buildSupplierCardPlanFromRequest(req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DB.Create(plan).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, plan)
}

func AdminUpdateSupplierCardPlan(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req supplierCardPlanRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	updated, err := buildSupplierCardPlanFromRequest(req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	plan := &model.SupplierCardPlan{}
	if err := model.DB.First(plan, "id = ?", id).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	plan.Amount = updated.Amount
	plan.Quota = updated.Quota
	plan.Enabled = updated.Enabled
	plan.SortOrder = updated.SortOrder
	plan.Prices = updated.Prices
	if err := model.DB.Save(plan).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, plan)
}

func AdminListSupplierCardOrders(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	amount, err := parseOptionalInt64Query(c, "amount")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	level, err := parseOptionalIntQuery(c, "supplier_level")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	supplierUserId, err := parseOptionalIntQuery(c, "supplier_user_id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items, total, err := model.ListAdminSupplierCardOrders(model.SupplierCardOrderListQuery{
		Page:            pageInfo.GetPage(),
		PageSize:        pageInfo.GetPageSize(),
		Amount:          amount,
		SupplierLevel:   level,
		SupplierUserId:  supplierUserId,
		Keyword:         c.Query("keyword"),
		CreatedTimeFrom: parseInt64Query(c, "created_time_from"),
		CreatedTimeTo:   parseInt64Query(c, "created_time_to"),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func AdminListSupplierCards(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	query, err := buildSupplierCardAdminListQuery(c, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items, total, err := model.ListAdminSupplierCards(query)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func buildSupplierCardAdminListQuery(c *gin.Context, pageInfo *common.PageInfo) (model.SupplierCardAdminListQuery, error) {
	status, err := parseOptionalIntQuery(c, "status")
	if err != nil {
		return model.SupplierCardAdminListQuery{}, err
	}
	amount, err := parseOptionalInt64Query(c, "amount")
	if err != nil {
		return model.SupplierCardAdminListQuery{}, err
	}
	level, err := parseOptionalIntQuery(c, "supplier_level")
	if err != nil {
		return model.SupplierCardAdminListQuery{}, err
	}
	supplierUserId, err := parseOptionalIntQuery(c, "supplier_user_id")
	if err != nil {
		return model.SupplierCardAdminListQuery{}, err
	}
	redeemedUserId, err := parseOptionalIntQuery(c, "redeemed_user_id")
	if err != nil {
		return model.SupplierCardAdminListQuery{}, err
	}
	return model.SupplierCardAdminListQuery{
		Page:             pageInfo.GetPage(),
		PageSize:         pageInfo.GetPageSize(),
		Status:           status,
		Amount:           amount,
		SupplierLevel:    level,
		SupplierUserId:   supplierUserId,
		RedeemedUserId:   redeemedUserId,
		Keyword:          c.Query("keyword"),
		CreatedTimeFrom:  parseInt64Query(c, "created_time_from"),
		CreatedTimeTo:    parseInt64Query(c, "created_time_to"),
		RedeemedTimeFrom: parseInt64Query(c, "redeemed_time_from"),
		RedeemedTimeTo:   parseInt64Query(c, "redeemed_time_to"),
	}, nil
}

func AdminGetSupplierCardStats(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	query, err := buildSupplierCardAdminListQuery(c, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	stats, err := model.GetSupplierCardStats(query)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, stats)
}

func AdminGetSupplierCardSettings(c *gin.Context) {
	common.ApiSuccess(c, gin.H{
		"max_purchase_count": model.GetSupplierCardMaxPurchaseCount(),
	})
}

func AdminUpdateSupplierCardSettings(c *gin.Context) {
	var req supplierCardSettingsRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.MaxPurchaseCount <= 0 || req.MaxPurchaseCount > 1000 {
		common.ApiError(c, errors.New("max purchase count must be between 1 and 1000"))
		return
	}
	if err := model.UpdateOption("SupplierCardMaxPurchaseCount", strconv.Itoa(req.MaxPurchaseCount)); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"max_purchase_count": req.MaxPurchaseCount,
	})
}
