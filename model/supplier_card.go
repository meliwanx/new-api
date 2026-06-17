package model

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

const (
	SupplierCardStatusUnused   = 1
	SupplierCardStatusRedeemed = 2
	SupplierCardStatusDisabled = 3
)

const (
	SupplierCardQuotaActionAdminAdd      = "admin_add"
	SupplierCardQuotaActionAdminSubtract = "admin_subtract"
	SupplierCardQuotaActionAdminOverride = "admin_override"
	SupplierCardQuotaActionPurchase      = "purchase"
)

const DefaultSupplierCardMaxPurchaseCount = 100
const SupplierCardShareTokenLength = 16

type SupplierCardPlan struct {
	Id          int            `json:"id"`
	Amount      int64          `json:"amount" gorm:"not null;uniqueIndex:uk_supplier_card_plan_amount_delete_at,priority:1"`
	Quota       int            `json:"quota" gorm:"not null;default:0"`
	Enabled     bool           `json:"enabled" gorm:"default:true"`
	SortOrder   int            `json:"sort_order" gorm:"default:0"`
	Prices      string         `json:"prices" gorm:"type:text;not null"`
	CreatedTime int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index;uniqueIndex:uk_supplier_card_plan_amount_delete_at,priority:2"`
}

type SupplierCardOrder struct {
	Id              int     `json:"id"`
	OrderNo         string  `json:"order_no" gorm:"type:varchar(64);uniqueIndex"`
	SupplierUserId  int     `json:"supplier_user_id" gorm:"index"`
	SupplierLevel   int     `json:"supplier_level" gorm:"index"`
	PlanId          int     `json:"plan_id" gorm:"index"`
	Amount          int64   `json:"amount" gorm:"index"`
	Quota           int     `json:"quota"`
	Count           int     `json:"count"`
	UnitPrice       float64 `json:"unit_price"`
	TotalPrice      float64 `json:"total_price"`
	TotalDebitQuota int     `json:"total_debit_quota"`
	CreatedTime     int64   `json:"created_time" gorm:"bigint;index"`
}

type SupplierCardQuotaLog struct {
	Id             int    `json:"id"`
	SupplierUserId int    `json:"supplier_user_id" gorm:"index"`
	OperatorUserId int    `json:"operator_user_id" gorm:"index"`
	Action         string `json:"action" gorm:"type:varchar(32);index"`
	QuotaDelta     int    `json:"quota_delta"`
	QuotaBefore    int    `json:"quota_before"`
	QuotaAfter     int    `json:"quota_after"`
	OrderId        int    `json:"order_id" gorm:"index"`
	OrderNo        string `json:"order_no" gorm:"type:varchar(64);index"`
	Memo           string `json:"memo" gorm:"type:varchar(255)"`
	CreatedTime    int64  `json:"created_time" gorm:"bigint;index"`
}

type SupplierCardSupplier struct {
	Id                int    `json:"id"`
	Username          string `json:"username"`
	DisplayName       string `json:"display_name"`
	Email             string `json:"email"`
	Status            int    `json:"status"`
	Role              int    `json:"role"`
	Group             string `json:"group"`
	Quota             int    `json:"quota"`
	SupplierLevel     int    `json:"supplier_level"`
	SupplierCardQuota int    `json:"supplier_card_quota"`
	CreatedAt         int64  `json:"created_at"`
	LastLoginAt       int64  `json:"last_login_at"`
}

type SupplierCard struct {
	Id                int     `json:"id"`
	SupplierUserId    int     `json:"supplier_user_id" gorm:"index"`
	SupplierLevel     int     `json:"supplier_level" gorm:"index"`
	OrderId           int     `json:"order_id" gorm:"index"`
	OrderNo           string  `json:"order_no" gorm:"type:varchar(64);index"`
	PlanId            int     `json:"plan_id" gorm:"index"`
	Amount            int64   `json:"amount" gorm:"index"`
	Quota             int     `json:"quota"`
	PurchasePrice     float64 `json:"purchase_price"`
	DebitQuota        int     `json:"debit_quota"`
	Code              string  `json:"code" gorm:"type:varchar(64);uniqueIndex"`
	CodePreview       string  `json:"code_preview" gorm:"type:varchar(32);index"`
	ShareToken        string  `json:"share_token" gorm:"type:varchar(64);uniqueIndex"`
	ShareTokenPreview string  `json:"share_token_preview" gorm:"type:varchar(32);index"`
	Status            int     `json:"status" gorm:"default:1;index"`
	RedeemedUserId    int     `json:"redeemed_user_id" gorm:"index"`
	RedeemedTime      int64   `json:"redeemed_time" gorm:"bigint"`
	CreatedTime       int64   `json:"created_time" gorm:"bigint;index"`
	UpdatedTime       int64   `json:"updated_time" gorm:"bigint"`
}

type SupplierCardListQuery struct {
	Page       int
	PageSize   int
	Status     *int
	UnusedOnly *bool
	Keyword    string
}

type SupplierCardAdminListQuery struct {
	Page             int
	PageSize         int
	Status           *int
	Amount           *int64
	SupplierLevel    *int
	SupplierUserId   *int
	RedeemedUserId   *int
	Keyword          string
	CreatedTimeFrom  int64
	CreatedTimeTo    int64
	RedeemedTimeFrom int64
	RedeemedTimeTo   int64
}

type SupplierCardOrderListQuery struct {
	Page            int
	PageSize        int
	Amount          *int64
	SupplierLevel   *int
	SupplierUserId  *int
	Keyword         string
	CreatedTimeFrom int64
	CreatedTimeTo   int64
}

type SupplierCardQuotaLogListQuery struct {
	Page            int
	PageSize        int
	SupplierUserId  *int
	OperatorUserId  *int
	Action          string
	Keyword         string
	CreatedTimeFrom int64
	CreatedTimeTo   int64
}

type SupplierCardSupplierListQuery struct {
	Page     int
	PageSize int
	Keyword  string
	Level    *int
}

type SupplierCardStats struct {
	TotalSales    float64                     `json:"total_sales"`
	SoldCount     int64                       `json:"sold_count"`
	RedeemedCount int64                       `json:"redeemed_count"`
	UnusedCount   int64                       `json:"unused_count"`
	DisabledCount int64                       `json:"disabled_count"`
	ByAmount      []SupplierCardStatsByAmount `json:"by_amount"`
	ByLevel       []SupplierCardStatsByLevel  `json:"by_level"`
}

type SupplierCardStatsByAmount struct {
	Amount float64 `json:"amount"`
	Count  int64   `json:"count"`
	Sales  float64 `json:"sales"`
}

type SupplierCardStatsByLevel struct {
	SupplierLevel int     `json:"supplier_level"`
	Count         int64   `json:"count"`
	Sales         float64 `json:"sales"`
}

func ValidateSupplierLevel(level int) error {
	if level < 0 || level > 10 {
		return errors.New("supplier level must be between 0 and 10")
	}
	return nil
}

func GetSupplierCardMaxPurchaseCount() int {
	common.OptionMapRWMutex.RLock()
	value := common.OptionMap["SupplierCardMaxPurchaseCount"]
	common.OptionMapRWMutex.RUnlock()
	count, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || count <= 0 {
		return DefaultSupplierCardMaxPurchaseCount
	}
	return count
}

func (p *SupplierCardPlan) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	if p.CreatedTime == 0 {
		p.CreatedTime = now
	}
	p.UpdatedTime = now
	if p.Quota == 0 && p.Amount > 0 {
		p.Quota = int(math.Round(float64(p.Amount) * common.QuotaPerUnit))
	}
	return nil
}

func (p *SupplierCardPlan) BeforeUpdate(tx *gorm.DB) error {
	p.UpdatedTime = common.GetTimestamp()
	if p.Amount > 0 {
		p.Quota = int(math.Round(float64(p.Amount) * common.QuotaPerUnit))
	}
	return nil
}

func (p *SupplierCardPlan) PriceMap() (map[string]float64, error) {
	prices := map[string]float64{}
	if strings.TrimSpace(p.Prices) == "" {
		return prices, nil
	}
	if err := common.UnmarshalJsonStr(p.Prices, &prices); err != nil {
		return nil, fmt.Errorf("invalid supplier card prices: %w", err)
	}
	return prices, nil
}

func (p *SupplierCardPlan) PriceForLevel(level int) (float64, error) {
	if err := ValidateSupplierLevel(level); err != nil {
		return 0, err
	}
	if level == 0 {
		return 0, errors.New("not a supplier")
	}
	prices, err := p.PriceMap()
	if err != nil {
		return 0, err
	}
	price, ok := prices[strconv.Itoa(level)]
	if !ok {
		return 0, fmt.Errorf("missing supplier card price for level %d", level)
	}
	if price < 0 {
		return 0, fmt.Errorf("invalid supplier card price for level %d", level)
	}
	return price, nil
}

func NormalizeSupplierCardPrices(prices map[string]float64) (string, error) {
	if len(prices) == 0 {
		return "", errors.New("supplier card prices are required")
	}
	for level := 1; level <= 10; level++ {
		key := strconv.Itoa(level)
		price, ok := prices[key]
		if !ok {
			return "", fmt.Errorf("missing supplier card price for level %d", level)
		}
		if price < 0 {
			return "", fmt.Errorf("invalid supplier card price for level %d", level)
		}
	}
	data, err := common.Marshal(prices)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func buildSupplierCardOrderNo(userID int) string {
	return fmt.Sprintf("SC%d%s", userID, common.GetRandomString(18))
}

func buildSupplierCardCode() string {
	return strings.ToUpper(common.GetRandomString(24))
}

func buildSupplierCardShareToken() (string, error) {
	return common.GenerateRandomCharsKey(SupplierCardShareTokenLength)
}

func previewSupplierCardSecret(value string) string {
	if len(value) <= 10 {
		return value
	}
	return value[:4] + "..." + value[len(value)-4:]
}

func debitQuotaForPrice(price float64) int {
	return int(math.Round(price * common.QuotaPerUnit))
}

func recordSupplierCardQuotaLog(tx *gorm.DB, movement *SupplierCardQuotaLog) error {
	if movement.CreatedTime == 0 {
		movement.CreatedTime = common.GetTimestamp()
	}
	return tx.Create(movement).Error
}

func AdjustSupplierCardQuota(operatorUserID int, supplierUserID int, mode string, value int, memo string) (*User, *SupplierCardQuotaLog, error) {
	if operatorUserID <= 0 {
		return nil, nil, errors.New("invalid operator user id")
	}
	if supplierUserID <= 0 {
		return nil, nil, errors.New("invalid supplier user id")
	}
	mode = strings.TrimSpace(mode)
	memo = strings.TrimSpace(memo)
	memoRunes := []rune(memo)
	if len(memoRunes) > 255 {
		memo = string(memoRunes[:255])
	}

	var user *User
	var movement *SupplierCardQuotaLog
	err := DB.Transaction(func(tx *gorm.DB) error {
		lockedUser := &User{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").First(lockedUser, "id = ?", supplierUserID).Error; err != nil {
			return err
		}
		if err := ValidateSupplierLevel(lockedUser.SupplierLevel); err != nil {
			return err
		}
		if lockedUser.SupplierLevel == 0 {
			return errors.New("not a supplier")
		}

		before := lockedUser.SupplierCardQuota
		after := before
		action := ""
		switch mode {
		case "add":
			if value <= 0 {
				return errors.New("supplier card balance change must be positive")
			}
			after = before + value
			action = SupplierCardQuotaActionAdminAdd
		case "subtract":
			if value <= 0 {
				return errors.New("supplier card balance change must be positive")
			}
			if before < value {
				return errors.New("insufficient supplier card balance")
			}
			after = before - value
			action = SupplierCardQuotaActionAdminSubtract
		case "override":
			if value < 0 {
				return errors.New("supplier card balance cannot be negative")
			}
			after = value
			action = SupplierCardQuotaActionAdminOverride
		default:
			return errors.New("invalid supplier card balance adjustment mode")
		}

		delta := after - before
		if err := tx.Model(&User{}).Where("id = ?", supplierUserID).Update("supplier_card_quota", after).Error; err != nil {
			return err
		}
		movement = &SupplierCardQuotaLog{
			SupplierUserId: supplierUserID,
			OperatorUserId: operatorUserID,
			Action:         action,
			QuotaDelta:     delta,
			QuotaBefore:    before,
			QuotaAfter:     after,
			Memo:           memo,
			CreatedTime:    common.GetTimestamp(),
		}
		if err := recordSupplierCardQuotaLog(tx, movement); err != nil {
			return err
		}
		lockedUser.SupplierCardQuota = after
		user = lockedUser
		return nil
	})
	if err != nil {
		return nil, nil, err
	}

	RecordLog(operatorUserID, LogTypeManage, fmt.Sprintf("调整供应商用户 %d 购卡专属余额，变化 %s，调整后 %s", supplierUserID, logger.LogQuota(movement.QuotaDelta), logger.LogQuota(movement.QuotaAfter)))
	return user, movement, nil
}

func normalizeSupplierCardPagination(page int, pageSize int) (int, int) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func supplierCardSupplierFromUser(user *User) *SupplierCardSupplier {
	return &SupplierCardSupplier{
		Id:                user.Id,
		Username:          user.Username,
		DisplayName:       user.DisplayName,
		Email:             user.Email,
		Status:            user.Status,
		Role:              user.Role,
		Group:             user.Group,
		Quota:             user.Quota,
		SupplierLevel:     user.SupplierLevel,
		SupplierCardQuota: user.SupplierCardQuota,
		CreatedAt:         user.CreatedAt,
		LastLoginAt:       user.LastLoginAt,
	}
}

func supplierCardContainsPattern(keyword string) string {
	keyword = strings.TrimSpace(keyword)
	keyword = strings.ReplaceAll(keyword, "!", "!!")
	keyword = strings.ReplaceAll(keyword, "%", "!%")
	keyword = strings.ReplaceAll(keyword, "_", "!_")
	return "%" + keyword + "%"
}

func ListSupplierCardSuppliers(query SupplierCardSupplierListQuery) ([]*SupplierCardSupplier, int64, error) {
	page, pageSize := normalizeSupplierCardPagination(query.Page, query.PageSize)
	db := DB.Model(&User{}).Where("supplier_level > ?", 0)
	if query.Level != nil {
		db = db.Where("supplier_level = ?", *query.Level)
	}
	keyword := strings.TrimSpace(query.Keyword)
	if keyword != "" {
		pattern := supplierCardContainsPattern(keyword)
		keywordID, err := strconv.Atoi(keyword)
		if err == nil {
			db = db.Where("id = ? OR username LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!' OR display_name LIKE ? ESCAPE '!'", keywordID, pattern, pattern, pattern)
		} else {
			db = db.Where("username LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!' OR display_name LIKE ? ESCAPE '!'", pattern, pattern, pattern)
		}
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var users []*User
	if err := db.Omit("password").Order("id desc").Limit(pageSize).Offset((page - 1) * pageSize).Find(&users).Error; err != nil {
		return nil, 0, err
	}
	items := make([]*SupplierCardSupplier, 0, len(users))
	for _, user := range users {
		items = append(items, supplierCardSupplierFromUser(user))
	}
	return items, total, nil
}

func PurchaseSupplierCards(userID int, planID int, count int, maxCount int) (*SupplierCardOrder, []*SupplierCard, error) {
	if userID <= 0 {
		return nil, nil, errors.New("invalid user id")
	}
	if planID <= 0 {
		return nil, nil, errors.New("invalid supplier card plan")
	}
	if maxCount <= 0 {
		maxCount = DefaultSupplierCardMaxPurchaseCount
	}
	if count <= 0 || count > maxCount {
		return nil, nil, fmt.Errorf("count must be between 1 and %d", maxCount)
	}

	var order *SupplierCardOrder
	var cards []*SupplierCard
	err := DB.Transaction(func(tx *gorm.DB) error {
		user := &User{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").First(user, "id = ?", userID).Error; err != nil {
			return err
		}
		if err := ValidateSupplierLevel(user.SupplierLevel); err != nil {
			return err
		}
		if user.SupplierLevel == 0 {
			return errors.New("not a supplier")
		}

		plan := &SupplierCardPlan{}
		if err := tx.First(plan, "id = ?", planID).Error; err != nil {
			return errors.New("supplier card plan not found")
		}
		if !plan.Enabled {
			return errors.New("supplier card plan is disabled")
		}
		unitPrice, err := plan.PriceForLevel(user.SupplierLevel)
		if err != nil {
			return err
		}
		totalPrice := unitPrice * float64(count)
		totalDebitQuota := debitQuotaForPrice(totalPrice)
		if totalDebitQuota <= 0 {
			return errors.New("supplier card price is too low")
		}
		if user.SupplierCardQuota < totalDebitQuota {
			return errors.New("insufficient supplier card balance")
		}

		now := common.GetTimestamp()
		order = &SupplierCardOrder{
			OrderNo:         buildSupplierCardOrderNo(userID),
			SupplierUserId:  userID,
			SupplierLevel:   user.SupplierLevel,
			PlanId:          plan.Id,
			Amount:          plan.Amount,
			Quota:           plan.Quota,
			Count:           count,
			UnitPrice:       unitPrice,
			TotalPrice:      totalPrice,
			TotalDebitQuota: totalDebitQuota,
			CreatedTime:     now,
		}
		if err := tx.Create(order).Error; err != nil {
			return err
		}

		quotaBefore := user.SupplierCardQuota
		quotaAfter := quotaBefore - totalDebitQuota
		if err := tx.Model(&User{}).Where("id = ?", userID).Update("supplier_card_quota", gorm.Expr("supplier_card_quota - ?", totalDebitQuota)).Error; err != nil {
			return err
		}
		if err := recordSupplierCardQuotaLog(tx, &SupplierCardQuotaLog{
			SupplierUserId: userID,
			Action:         SupplierCardQuotaActionPurchase,
			QuotaDelta:     -totalDebitQuota,
			QuotaBefore:    quotaBefore,
			QuotaAfter:     quotaAfter,
			OrderId:        order.Id,
			OrderNo:        order.OrderNo,
			Memo:           fmt.Sprintf("purchase %d supplier cards", count),
			CreatedTime:    now,
		}); err != nil {
			return err
		}

		perCardDebitQuota := debitQuotaForPrice(unitPrice)
		cards = make([]*SupplierCard, 0, count)
		for i := 0; i < count; i++ {
			code := buildSupplierCardCode()
			shareToken, err := buildSupplierCardShareToken()
			if err != nil {
				return err
			}
			cards = append(cards, &SupplierCard{
				SupplierUserId:    userID,
				SupplierLevel:     user.SupplierLevel,
				OrderId:           order.Id,
				OrderNo:           order.OrderNo,
				PlanId:            plan.Id,
				Amount:            plan.Amount,
				Quota:             plan.Quota,
				PurchasePrice:     unitPrice,
				DebitQuota:        perCardDebitQuota,
				Code:              code,
				CodePreview:       previewSupplierCardSecret(code),
				ShareToken:        shareToken,
				ShareTokenPreview: previewSupplierCardSecret(shareToken),
				Status:            SupplierCardStatusUnused,
				CreatedTime:       now,
				UpdatedTime:       now,
			})
		}
		return tx.Create(&cards).Error
	})
	if err != nil {
		return nil, nil, err
	}

	RecordLog(userID, LogTypeTopup, fmt.Sprintf("供应商购买充值卡 %d 张，面额 %s，扣除购卡专属余额 %s", len(cards), logger.LogQuota(order.Quota), logger.LogQuota(order.TotalDebitQuota)))
	return order, cards, nil
}

func RedeemSupplierCardByShareToken(shareToken string, userID int) (*SupplierCard, error) {
	shareToken = strings.TrimSpace(shareToken)
	if shareToken == "" {
		return nil, errors.New("invalid supplier card token")
	}
	if userID <= 0 {
		return nil, errors.New("invalid user id")
	}

	card := &SupplierCard{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Set("gorm:query_option", "FOR UPDATE").First(card, "share_token = ?", shareToken).Error; err != nil {
			return errors.New("supplier card not found")
		}
		switch card.Status {
		case SupplierCardStatusUnused:
		case SupplierCardStatusRedeemed:
			return errors.New("supplier card already redeemed")
		case SupplierCardStatusDisabled:
			return errors.New("supplier card disabled")
		default:
			return errors.New("supplier card status invalid")
		}
		if err := tx.Model(&User{}).Where("id = ?", userID).Update("quota", gorm.Expr("quota + ?", card.Quota)).Error; err != nil {
			return err
		}
		now := common.GetTimestamp()
		card.Status = SupplierCardStatusRedeemed
		card.RedeemedUserId = userID
		card.RedeemedTime = now
		card.UpdatedTime = now
		return tx.Save(card).Error
	})
	if err != nil {
		return nil, err
	}

	RecordLog(userID, LogTypeTopup, fmt.Sprintf("通过供应商充值卡兑换 %s，卡片ID %d", logger.LogQuota(card.Quota), card.Id))
	return card, nil
}

func applySupplierCardKeyword(query *gorm.DB, keyword string) (*gorm.DB, error) {
	keyword = strings.TrimSpace(keyword)
	if keyword == "" {
		return query, nil
	}
	pattern, err := sanitizeLikePattern(keyword)
	if err != nil {
		return nil, err
	}
	return query.Where(
		"code LIKE ? ESCAPE '!' OR code_preview LIKE ? ESCAPE '!' OR share_token LIKE ? ESCAPE '!' OR share_token_preview LIKE ? ESCAPE '!' OR order_no LIKE ? ESCAPE '!'",
		pattern, pattern, pattern, pattern, pattern,
	), nil
}

func ListSupplierCards(userID int, query SupplierCardListQuery) ([]*SupplierCard, int64, error) {
	page, pageSize := normalizeSupplierCardPagination(query.Page, query.PageSize)
	db := DB.Model(&SupplierCard{}).Where("supplier_user_id = ?", userID)
	if query.UnusedOnly != nil && *query.UnusedOnly {
		db = db.Where("status = ?", SupplierCardStatusUnused)
	} else if query.Status != nil {
		db = db.Where("status = ?", *query.Status)
	}
	var err error
	db, err = applySupplierCardKeyword(db, query.Keyword)
	if err != nil {
		return nil, 0, err
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var cards []*SupplierCard
	if err := db.Order("id desc").Limit(pageSize).Offset((page - 1) * pageSize).Find(&cards).Error; err != nil {
		return nil, 0, err
	}
	return cards, total, nil
}

func ListAdminSupplierCards(query SupplierCardAdminListQuery) ([]*SupplierCard, int64, error) {
	page, pageSize := normalizeSupplierCardPagination(query.Page, query.PageSize)
	db := DB.Model(&SupplierCard{})
	db = applySupplierCardAdminFilters(db, query)
	var err error
	db, err = applySupplierCardKeyword(db, query.Keyword)
	if err != nil {
		return nil, 0, err
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var cards []*SupplierCard
	if err := db.Order("id desc").Limit(pageSize).Offset((page - 1) * pageSize).Find(&cards).Error; err != nil {
		return nil, 0, err
	}
	return cards, total, nil
}

func ListAdminSupplierCardOrders(query SupplierCardOrderListQuery) ([]*SupplierCardOrder, int64, error) {
	page, pageSize := normalizeSupplierCardPagination(query.Page, query.PageSize)
	db := DB.Model(&SupplierCardOrder{})
	if query.Amount != nil {
		db = db.Where("amount = ?", *query.Amount)
	}
	if query.SupplierLevel != nil {
		db = db.Where("supplier_level = ?", *query.SupplierLevel)
	}
	if query.SupplierUserId != nil {
		db = db.Where("supplier_user_id = ?", *query.SupplierUserId)
	}
	if query.CreatedTimeFrom > 0 {
		db = db.Where("created_time >= ?", query.CreatedTimeFrom)
	}
	if query.CreatedTimeTo > 0 {
		db = db.Where("created_time <= ?", query.CreatedTimeTo)
	}
	if strings.TrimSpace(query.Keyword) != "" {
		pattern, err := sanitizeLikePattern(query.Keyword)
		if err != nil {
			return nil, 0, err
		}
		db = db.Where("order_no LIKE ? ESCAPE '!'", pattern)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var orders []*SupplierCardOrder
	if err := db.Order("id desc").Limit(pageSize).Offset((page - 1) * pageSize).Find(&orders).Error; err != nil {
		return nil, 0, err
	}
	return orders, total, nil
}

func ListSupplierCardQuotaLogs(query SupplierCardQuotaLogListQuery) ([]*SupplierCardQuotaLog, int64, error) {
	page, pageSize := normalizeSupplierCardPagination(query.Page, query.PageSize)
	db := DB.Model(&SupplierCardQuotaLog{})
	if query.SupplierUserId != nil {
		db = db.Where("supplier_user_id = ?", *query.SupplierUserId)
	}
	if query.OperatorUserId != nil {
		db = db.Where("operator_user_id = ?", *query.OperatorUserId)
	}
	if strings.TrimSpace(query.Action) != "" {
		db = db.Where("action = ?", strings.TrimSpace(query.Action))
	}
	if query.CreatedTimeFrom > 0 {
		db = db.Where("created_time >= ?", query.CreatedTimeFrom)
	}
	if query.CreatedTimeTo > 0 {
		db = db.Where("created_time <= ?", query.CreatedTimeTo)
	}
	if strings.TrimSpace(query.Keyword) != "" {
		pattern, err := sanitizeLikePattern(query.Keyword)
		if err != nil {
			return nil, 0, err
		}
		db = db.Where("order_no LIKE ? ESCAPE '!' OR memo LIKE ? ESCAPE '!'", pattern, pattern)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var logs []*SupplierCardQuotaLog
	if err := db.Order("id desc").Limit(pageSize).Offset((page - 1) * pageSize).Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}

func applySupplierCardAdminFilters(db *gorm.DB, query SupplierCardAdminListQuery) *gorm.DB {
	if query.Status != nil {
		db = db.Where("status = ?", *query.Status)
	}
	if query.Amount != nil {
		db = db.Where("amount = ?", *query.Amount)
	}
	if query.SupplierLevel != nil {
		db = db.Where("supplier_level = ?", *query.SupplierLevel)
	}
	if query.SupplierUserId != nil {
		db = db.Where("supplier_user_id = ?", *query.SupplierUserId)
	}
	if query.RedeemedUserId != nil {
		db = db.Where("redeemed_user_id = ?", *query.RedeemedUserId)
	}
	if query.CreatedTimeFrom > 0 {
		db = db.Where("created_time >= ?", query.CreatedTimeFrom)
	}
	if query.CreatedTimeTo > 0 {
		db = db.Where("created_time <= ?", query.CreatedTimeTo)
	}
	if query.RedeemedTimeFrom > 0 {
		db = db.Where("redeemed_time >= ?", query.RedeemedTimeFrom)
	}
	if query.RedeemedTimeTo > 0 {
		db = db.Where("redeemed_time <= ?", query.RedeemedTimeTo)
	}
	return db
}

func GetSupplierCardStats(query SupplierCardAdminListQuery) (*SupplierCardStats, error) {
	stats := &SupplierCardStats{}
	cardDB := applySupplierCardAdminFilters(DB.Model(&SupplierCard{}), query)
	if err := cardDB.Count(&stats.SoldCount).Error; err != nil {
		return nil, err
	}
	if err := cardDB.Where("status = ?", SupplierCardStatusRedeemed).Count(&stats.RedeemedCount).Error; err != nil {
		return nil, err
	}
	if err := cardDB.Where("status = ?", SupplierCardStatusUnused).Count(&stats.UnusedCount).Error; err != nil {
		return nil, err
	}
	if err := cardDB.Where("status = ?", SupplierCardStatusDisabled).Count(&stats.DisabledCount).Error; err != nil {
		return nil, err
	}

	orderDB := DB.Model(&SupplierCardOrder{})
	if query.Amount != nil {
		orderDB = orderDB.Where("amount = ?", *query.Amount)
	}
	if query.SupplierLevel != nil {
		orderDB = orderDB.Where("supplier_level = ?", *query.SupplierLevel)
	}
	if query.SupplierUserId != nil {
		orderDB = orderDB.Where("supplier_user_id = ?", *query.SupplierUserId)
	}
	if query.CreatedTimeFrom > 0 {
		orderDB = orderDB.Where("created_time >= ?", query.CreatedTimeFrom)
	}
	if query.CreatedTimeTo > 0 {
		orderDB = orderDB.Where("created_time <= ?", query.CreatedTimeTo)
	}
	if err := orderDB.Select("COALESCE(SUM(total_price), 0)").Scan(&stats.TotalSales).Error; err != nil {
		return nil, err
	}
	if err := orderDB.Select("amount, SUM(count) as count, COALESCE(SUM(total_price), 0) as sales").Group("amount").Order("amount asc").Scan(&stats.ByAmount).Error; err != nil {
		return nil, err
	}
	if err := orderDB.Select("supplier_level, SUM(count) as count, COALESCE(SUM(total_price), 0) as sales").Group("supplier_level").Order("supplier_level asc").Scan(&stats.ByLevel).Error; err != nil {
		return nil, err
	}
	return stats, nil
}
