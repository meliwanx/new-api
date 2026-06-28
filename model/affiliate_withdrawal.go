package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"gorm.io/gorm"
)

const (
	AffiliateWithdrawalMethodAlipay = "alipay"
)

const (
	AffiliateWithdrawalStatusProcessing = "processing"
	AffiliateWithdrawalStatusCompleted  = "completed"
	AffiliateWithdrawalStatusRejected   = "rejected"
)

var (
	ErrAffiliateWithdrawalNotFound            = errors.New("affiliate withdrawal request not found")
	ErrAffiliateWithdrawalInvalidInput        = errors.New("invalid affiliate withdrawal request input")
	ErrAffiliateWithdrawalInsufficientBalance = errors.New("affiliate commission balance is insufficient")
	ErrAffiliateWithdrawalInvalidTransition   = errors.New("invalid affiliate withdrawal status transition")
)

// AffiliateWithdrawal 记录分销返佣提现申请。金额单位为系统 quota，与 users.aff_quota 保持一致。
type AffiliateWithdrawal struct {
	Id          int    `json:"id" gorm:"primaryKey"`
	UserId      int    `json:"user_id" gorm:"index;comment:申请提现用户ID"`
	Amount      int    `json:"amount" gorm:"comment:提现返佣额度(quota)"`
	Method      string `json:"method" gorm:"type:varchar(32);default:'alipay';index"`
	Account     string `json:"account" gorm:"type:varchar(128);comment:收款账号"`
	AccountName string `json:"account_name" gorm:"type:varchar(128);comment:收款账户姓名"`

	Status       string `json:"status" gorm:"type:varchar(32);index"`
	AdminNote    string `json:"admin_note" gorm:"type:text"`
	RejectReason string `json:"reject_reason" gorm:"type:text"`

	CreatedAt   int64 `json:"created_at" gorm:"type:bigint;index"`
	UpdatedAt   int64 `json:"updated_at" gorm:"type:bigint"`
	ProcessedAt int64 `json:"processed_at" gorm:"type:bigint;default:0"`
}

func (w *AffiliateWithdrawal) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	if w.Method == "" {
		w.Method = AffiliateWithdrawalMethodAlipay
	}
	if w.Status == "" {
		w.Status = AffiliateWithdrawalStatusProcessing
	}
	w.CreatedAt = now
	w.UpdatedAt = now
	return nil
}

func (w *AffiliateWithdrawal) BeforeUpdate(tx *gorm.DB) error {
	w.UpdatedAt = common.GetTimestamp()
	return nil
}

type AffiliateWithdrawalCreateRequest struct {
	Amount      int    `json:"amount"`
	Method      string `json:"method"`
	Account     string `json:"account"`
	AccountName string `json:"account_name"`
}

type AffiliateWithdrawalListFilter struct {
	PageInfo *common.PageInfo
	Keyword  string
	Status   string
	UserId   int
}

func CreateAffiliateWithdrawal(userId int, req AffiliateWithdrawalCreateRequest) (*AffiliateWithdrawal, error) {
	req = normalizeAffiliateWithdrawalCreateRequest(req)
	if err := validateAffiliateWithdrawalCreateRequest(req); err != nil {
		return nil, err
	}

	var withdrawal *AffiliateWithdrawal
	err := DB.Transaction(func(tx *gorm.DB) error {
		user := &User{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ?", userId).
			First(user).Error; err != nil {
			return err
		}
		if user.AffQuota < req.Amount {
			return ErrAffiliateWithdrawalInsufficientBalance
		}

		result := tx.Model(&User{}).
			Where("id = ? AND aff_quota >= ?", userId, req.Amount).
			Update("aff_quota", gorm.Expr("aff_quota - ?", req.Amount))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrAffiliateWithdrawalInsufficientBalance
		}

		next := &AffiliateWithdrawal{
			UserId:      userId,
			Amount:      req.Amount,
			Method:      req.Method,
			Account:     req.Account,
			AccountName: req.AccountName,
			Status:      AffiliateWithdrawalStatusProcessing,
		}
		if err := tx.Create(next).Error; err != nil {
			return err
		}
		withdrawal = next
		return nil
	})
	if err != nil {
		return nil, err
	}

	RecordLog(userId, LogTypeSystem, fmt.Sprintf("提交分销返佣提现申请，金额 %s，方式 支付宝", logger.LogQuota(req.Amount)))
	return withdrawal, nil
}

func ListUserAffiliateWithdrawals(userId int, pageInfo *common.PageInfo) ([]*AffiliateWithdrawal, int64, error) {
	return listAffiliateWithdrawals(AffiliateWithdrawalListFilter{
		PageInfo: ensureAffiliateWithdrawalPageInfo(pageInfo),
		UserId:   userId,
	})
}

func ListAffiliateWithdrawals(filter AffiliateWithdrawalListFilter) ([]*AffiliateWithdrawal, int64, error) {
	filter.PageInfo = ensureAffiliateWithdrawalPageInfo(filter.PageInfo)
	filter.Status = strings.TrimSpace(filter.Status)
	filter.Keyword = strings.TrimSpace(filter.Keyword)
	return listAffiliateWithdrawals(filter)
}

func MarkAffiliateWithdrawalProcessing(id int, adminNote string) error {
	return updateAffiliateWithdrawal(id, false, func(withdrawal *AffiliateWithdrawal) error {
		if withdrawal.Status == AffiliateWithdrawalStatusCompleted || withdrawal.Status == AffiliateWithdrawalStatusRejected {
			return ErrAffiliateWithdrawalInvalidTransition
		}
		withdrawal.Status = AffiliateWithdrawalStatusProcessing
		withdrawal.AdminNote = strings.TrimSpace(adminNote)
		return nil
	})
}

func CompleteAffiliateWithdrawal(id int, adminNote string) error {
	return updateAffiliateWithdrawal(id, false, func(withdrawal *AffiliateWithdrawal) error {
		if withdrawal.Status != AffiliateWithdrawalStatusProcessing {
			return ErrAffiliateWithdrawalInvalidTransition
		}
		withdrawal.Status = AffiliateWithdrawalStatusCompleted
		withdrawal.AdminNote = strings.TrimSpace(adminNote)
		withdrawal.ProcessedAt = common.GetTimestamp()
		return nil
	})
}

func RejectAffiliateWithdrawal(id int, reason string) error {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return ErrAffiliateWithdrawalInvalidInput
	}
	return updateAffiliateWithdrawal(id, true, func(withdrawal *AffiliateWithdrawal) error {
		if withdrawal.Status == AffiliateWithdrawalStatusCompleted || withdrawal.Status == AffiliateWithdrawalStatusRejected {
			return ErrAffiliateWithdrawalInvalidTransition
		}
		withdrawal.Status = AffiliateWithdrawalStatusRejected
		withdrawal.RejectReason = reason
		withdrawal.ProcessedAt = common.GetTimestamp()
		return nil
	})
}

func updateAffiliateWithdrawal(id int, refund bool, apply func(*AffiliateWithdrawal) error) error {
	var logWithdrawal AffiliateWithdrawal
	err := DB.Transaction(func(tx *gorm.DB) error {
		withdrawal := &AffiliateWithdrawal{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", id).First(withdrawal).Error; err != nil {
			return ErrAffiliateWithdrawalNotFound
		}
		previousStatus := withdrawal.Status
		if err := apply(withdrawal); err != nil {
			return err
		}
		if refund && previousStatus != AffiliateWithdrawalStatusRejected && withdrawal.Status == AffiliateWithdrawalStatusRejected {
			if err := tx.Model(&User{}).
				Where("id = ?", withdrawal.UserId).
				Update("aff_quota", gorm.Expr("aff_quota + ?", withdrawal.Amount)).Error; err != nil {
				return err
			}
		}
		if err := tx.Save(withdrawal).Error; err != nil {
			return err
		}
		logWithdrawal = *withdrawal
		return nil
	})
	if err != nil {
		return err
	}

	switch logWithdrawal.Status {
	case AffiliateWithdrawalStatusProcessing:
		RecordLog(logWithdrawal.UserId, LogTypeSystem, fmt.Sprintf("分销返佣提现申请进入处理中，金额 %s", logger.LogQuota(logWithdrawal.Amount)))
	case AffiliateWithdrawalStatusCompleted:
		RecordLog(logWithdrawal.UserId, LogTypeSystem, fmt.Sprintf("分销返佣提现处理完成，金额 %s", logger.LogQuota(logWithdrawal.Amount)))
	case AffiliateWithdrawalStatusRejected:
		RecordLog(logWithdrawal.UserId, LogTypeSystem, fmt.Sprintf("分销返佣提现已拒绝并退回，金额 %s，原因：%s", logger.LogQuota(logWithdrawal.Amount), logWithdrawal.RejectReason))
	}
	return nil
}

func listAffiliateWithdrawals(filter AffiliateWithdrawalListFilter) ([]*AffiliateWithdrawal, int64, error) {
	query := DB.Model(&AffiliateWithdrawal{})
	if filter.UserId > 0 {
		query = query.Where("user_id = ?", filter.UserId)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Keyword != "" {
		pattern, err := sanitizeLikePattern(filter.Keyword)
		if err != nil {
			return nil, 0, err
		}
		if id, err := strconv.Atoi(filter.Keyword); err == nil {
			query = query.Where("(account LIKE ? ESCAPE '!' OR account_name LIKE ? ESCAPE '!' OR user_id = ? OR id = ?)", pattern, pattern, id, id)
		} else {
			query = query.Where("(account LIKE ? ESCAPE '!' OR account_name LIKE ? ESCAPE '!')", pattern, pattern)
		}
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var withdrawals []*AffiliateWithdrawal
	if err := query.Order("id desc").
		Limit(filter.PageInfo.GetPageSize()).
		Offset(filter.PageInfo.GetStartIdx()).
		Find(&withdrawals).Error; err != nil {
		return nil, 0, err
	}
	return withdrawals, total, nil
}

func normalizeAffiliateWithdrawalCreateRequest(req AffiliateWithdrawalCreateRequest) AffiliateWithdrawalCreateRequest {
	req.Method = strings.TrimSpace(req.Method)
	if req.Method == "" {
		req.Method = AffiliateWithdrawalMethodAlipay
	}
	req.Account = strings.TrimSpace(req.Account)
	req.AccountName = strings.TrimSpace(req.AccountName)
	return req
}

func validateAffiliateWithdrawalCreateRequest(req AffiliateWithdrawalCreateRequest) error {
	if req.Amount <= 0 || req.Account == "" || req.AccountName == "" {
		return ErrAffiliateWithdrawalInvalidInput
	}
	if req.Method != AffiliateWithdrawalMethodAlipay {
		return ErrAffiliateWithdrawalInvalidInput
	}
	return nil
}

func ensureAffiliateWithdrawalPageInfo(pageInfo *common.PageInfo) *common.PageInfo {
	if pageInfo == nil {
		return &common.PageInfo{Page: 1, PageSize: common.ItemsPerPage}
	}
	if pageInfo.Page < 1 {
		pageInfo.Page = 1
	}
	if pageInfo.PageSize < 1 {
		pageInfo.PageSize = common.ItemsPerPage
	}
	if pageInfo.PageSize > 100 {
		pageInfo.PageSize = 100
	}
	return pageInfo
}
