package model

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	InvoiceTypePersonal = "personal"
	InvoiceTypeBusiness = "business"
)

const (
	InvoiceStatusPending    = "pending"
	InvoiceStatusProcessing = "processing"
	InvoiceStatusIssued     = "issued"
	InvoiceStatusRejected   = "rejected"
)

const (
	InvoiceDeliveryUpload   = "upload"
	InvoiceDeliveryEmail    = "email"
	InvoiceDeliveryExternal = "external"
)

var (
	ErrInvoiceNotFound          = errors.New("invoice request not found")
	ErrInvoiceAlreadyExists     = errors.New("invoice request already exists")
	ErrInvoiceTopUpNotFound     = errors.New("topup order not found")
	ErrInvoiceTopUpNotEligible  = errors.New("topup order is not eligible for invoice")
	ErrInvoiceInvalidInput      = errors.New("invalid invoice request input")
	ErrInvoiceInvalidTransition = errors.New("invalid invoice status transition")
	ErrInvoiceFileNotAvailable  = errors.New("invoice file is not available")
)

type InvoiceRequest struct {
	Id      int `json:"id"`
	TopUpId int `json:"topup_id" gorm:"index"`
	UserId  int `json:"user_id" gorm:"index"`

	TradeNo       string  `json:"trade_no" gorm:"unique;type:varchar(255);index"`
	Amount        int64   `json:"amount"`
	Money         float64 `json:"money"`
	PaymentMethod string  `json:"payment_method" gorm:"type:varchar(50)"`

	InvoiceType string `json:"invoice_type" gorm:"type:varchar(32);index"`
	Title       string `json:"title" gorm:"type:varchar(255)"`
	TaxNo       string `json:"tax_no" gorm:"type:varchar(128);default:''"`
	Email       string `json:"email" gorm:"type:varchar(255)"`
	Remark      string `json:"remark" gorm:"type:text"`

	Status         string `json:"status" gorm:"type:varchar(32);index"`
	DeliveryMethod string `json:"delivery_method" gorm:"type:varchar(32);default:''"`
	AdminNote      string `json:"admin_note" gorm:"type:text"`
	RejectReason   string `json:"reject_reason" gorm:"type:text"`

	FilePath string `json:"-" gorm:"type:text"`
	FileName string `json:"file_name" gorm:"type:varchar(255);default:''"`
	FileMime string `json:"file_mime" gorm:"type:varchar(128);default:''"`
	FileSize int64  `json:"file_size" gorm:"type:bigint;default:0"`

	Provider        string `json:"provider" gorm:"type:varchar(64);default:'manual';index"`
	ExternalId      string `json:"external_id" gorm:"type:varchar(255);default:'';index"`
	ProviderPayload string `json:"provider_payload" gorm:"type:text"`

	CreatedAt int64 `json:"created_at" gorm:"type:bigint;index"`
	UpdatedAt int64 `json:"updated_at" gorm:"type:bigint"`
	IssuedAt  int64 `json:"issued_at" gorm:"type:bigint;default:0"`
}

func (i *InvoiceRequest) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	if i.Status == "" {
		i.Status = InvoiceStatusPending
	}
	if i.Provider == "" {
		i.Provider = "manual"
	}
	i.CreatedAt = now
	i.UpdatedAt = now
	return nil
}

func (i *InvoiceRequest) BeforeUpdate(tx *gorm.DB) error {
	i.UpdatedAt = common.GetTimestamp()
	return nil
}

type InvoiceCreateRequest struct {
	TradeNo     string `json:"trade_no"`
	InvoiceType string `json:"invoice_type"`
	Title       string `json:"title"`
	TaxNo       string `json:"tax_no"`
	Email       string `json:"email"`
	Remark      string `json:"remark"`
}

type InvoiceIssueRequest struct {
	DeliveryMethod  string `json:"delivery_method"`
	AdminNote       string `json:"admin_note"`
	Provider        string `json:"provider"`
	ExternalId      string `json:"external_id"`
	ProviderPayload string `json:"provider_payload"`
}

type InvoiceFileInfo struct {
	Path string `json:"-"`
	Name string `json:"name"`
	Mime string `json:"mime"`
	Size int64  `json:"size"`
}

type InvoiceListFilter struct {
	PageInfo *common.PageInfo
	Keyword  string
	Status   string
	UserId   int
}

func CreateInvoiceRequest(userId int, req InvoiceCreateRequest) (*InvoiceRequest, error) {
	req = normalizeInvoiceCreateRequest(req)
	if err := validateInvoiceCreateRequest(req); err != nil {
		return nil, err
	}

	var invoice *InvoiceRequest
	err := DB.Transaction(func(tx *gorm.DB) error {
		topUp := &TopUp{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("user_id = ? AND trade_no = ?", userId, req.TradeNo).
			First(topUp).Error; err != nil {
			return ErrInvoiceTopUpNotFound
		}
		if topUp.Status != common.TopUpStatusSuccess {
			return ErrInvoiceTopUpNotEligible
		}

		var existing InvoiceRequest
		err := tx.Where("trade_no = ?", req.TradeNo).First(&existing).Error
		if err == nil {
			return ErrInvoiceAlreadyExists
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		next := &InvoiceRequest{
			TopUpId:       topUp.Id,
			UserId:        userId,
			TradeNo:       topUp.TradeNo,
			Amount:        topUp.Amount,
			Money:         topUp.Money,
			PaymentMethod: topUp.PaymentMethod,
			InvoiceType:   req.InvoiceType,
			Title:         req.Title,
			TaxNo:         req.TaxNo,
			Email:         req.Email,
			Remark:        req.Remark,
			Status:        InvoiceStatusPending,
			Provider:      "manual",
		}
		if err := tx.Create(next).Error; err != nil {
			return err
		}
		invoice = next
		return nil
	})
	if err != nil {
		return nil, err
	}
	return invoice, nil
}

func ListUserInvoiceRequests(userId int, pageInfo *common.PageInfo) ([]*InvoiceRequest, int64, error) {
	return listInvoiceRequests(InvoiceListFilter{
		PageInfo: ensureInvoicePageInfo(pageInfo),
		UserId:   userId,
	})
}

func ListInvoiceRequests(filter InvoiceListFilter) ([]*InvoiceRequest, int64, error) {
	filter.PageInfo = ensureInvoicePageInfo(filter.PageInfo)
	filter.Status = strings.TrimSpace(filter.Status)
	filter.Keyword = strings.TrimSpace(filter.Keyword)
	return listInvoiceRequests(filter)
}

func GetInvoiceRequestsByTradeNos(tradeNos []string) (map[string]*InvoiceRequest, error) {
	result := map[string]*InvoiceRequest{}
	if len(tradeNos) == 0 {
		return result, nil
	}
	var invoices []*InvoiceRequest
	if err := DB.Where("trade_no IN ?", tradeNos).Find(&invoices).Error; err != nil {
		return nil, err
	}
	for _, invoice := range invoices {
		result[invoice.TradeNo] = invoice
	}
	return result, nil
}

func MarkInvoiceProcessing(id int, adminNote string) error {
	return updateInvoiceRequest(id, func(invoice *InvoiceRequest) error {
		if invoice.Status != InvoiceStatusPending {
			return ErrInvoiceInvalidTransition
		}
		invoice.Status = InvoiceStatusProcessing
		invoice.AdminNote = strings.TrimSpace(adminNote)
		return nil
	})
}

func MarkInvoiceIssued(id int, req InvoiceIssueRequest) error {
	req.DeliveryMethod = strings.TrimSpace(req.DeliveryMethod)
	if req.DeliveryMethod == "" {
		req.DeliveryMethod = InvoiceDeliveryEmail
	}
	if req.DeliveryMethod != InvoiceDeliveryEmail && req.DeliveryMethod != InvoiceDeliveryExternal {
		return ErrInvoiceInvalidInput
	}

	return updateInvoiceRequest(id, func(invoice *InvoiceRequest) error {
		if invoice.Status == InvoiceStatusIssued || invoice.Status == InvoiceStatusRejected {
			return ErrInvoiceInvalidTransition
		}
		invoice.Status = InvoiceStatusIssued
		invoice.DeliveryMethod = req.DeliveryMethod
		invoice.AdminNote = strings.TrimSpace(req.AdminNote)
		invoice.Provider = strings.TrimSpace(req.Provider)
		if invoice.Provider == "" {
			invoice.Provider = "manual"
		}
		invoice.ExternalId = strings.TrimSpace(req.ExternalId)
		invoice.ProviderPayload = strings.TrimSpace(req.ProviderPayload)
		invoice.IssuedAt = common.GetTimestamp()
		return nil
	})
}

func MarkInvoiceIssuedWithFile(id int, file InvoiceFileInfo, adminNote string) error {
	file.Path = strings.TrimSpace(file.Path)
	file.Name = strings.TrimSpace(file.Name)
	file.Mime = strings.TrimSpace(file.Mime)
	if file.Path == "" || file.Name == "" {
		return ErrInvoiceInvalidInput
	}
	return updateInvoiceRequest(id, func(invoice *InvoiceRequest) error {
		if invoice.Status == InvoiceStatusIssued || invoice.Status == InvoiceStatusRejected {
			return ErrInvoiceInvalidTransition
		}
		invoice.Status = InvoiceStatusIssued
		invoice.DeliveryMethod = InvoiceDeliveryUpload
		invoice.AdminNote = strings.TrimSpace(adminNote)
		invoice.FilePath = file.Path
		invoice.FileName = file.Name
		invoice.FileMime = file.Mime
		invoice.FileSize = file.Size
		invoice.Provider = "manual"
		invoice.IssuedAt = common.GetTimestamp()
		return nil
	})
}

func RejectInvoiceRequest(id int, reason string) error {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return ErrInvoiceInvalidInput
	}
	return updateInvoiceRequest(id, func(invoice *InvoiceRequest) error {
		if invoice.Status == InvoiceStatusIssued || invoice.Status == InvoiceStatusRejected {
			return ErrInvoiceInvalidTransition
		}
		invoice.Status = InvoiceStatusRejected
		invoice.RejectReason = reason
		return nil
	})
}

func GetInvoiceFile(id int, userId int, admin bool) (*InvoiceFileInfo, error) {
	var invoice InvoiceRequest
	query := DB.Where("id = ?", id)
	if !admin {
		query = query.Where("user_id = ?", userId)
	}
	if err := query.First(&invoice).Error; err != nil {
		return nil, ErrInvoiceNotFound
	}
	if invoice.Status != InvoiceStatusIssued || invoice.FilePath == "" {
		return nil, ErrInvoiceFileNotAvailable
	}
	return &InvoiceFileInfo{
		Path: invoice.FilePath,
		Name: invoice.FileName,
		Mime: invoice.FileMime,
		Size: invoice.FileSize,
	}, nil
}

func updateInvoiceRequest(id int, apply func(*InvoiceRequest) error) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		invoice := &InvoiceRequest{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", id).First(invoice).Error; err != nil {
			return ErrInvoiceNotFound
		}
		if err := apply(invoice); err != nil {
			return err
		}
		return tx.Save(invoice).Error
	})
}

func listInvoiceRequests(filter InvoiceListFilter) ([]*InvoiceRequest, int64, error) {
	query := DB.Model(&InvoiceRequest{})
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
			query = query.Where("(trade_no LIKE ? ESCAPE '!' OR title LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!' OR user_id = ?)", pattern, pattern, pattern, id)
		} else {
			query = query.Where("(trade_no LIKE ? ESCAPE '!' OR title LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!')", pattern, pattern, pattern)
		}
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var invoices []*InvoiceRequest
	if err := query.Order("id desc").
		Limit(filter.PageInfo.GetPageSize()).
		Offset(filter.PageInfo.GetStartIdx()).
		Find(&invoices).Error; err != nil {
		return nil, 0, err
	}
	return invoices, total, nil
}

func normalizeInvoiceCreateRequest(req InvoiceCreateRequest) InvoiceCreateRequest {
	req.TradeNo = strings.TrimSpace(req.TradeNo)
	req.InvoiceType = strings.TrimSpace(req.InvoiceType)
	req.Title = strings.TrimSpace(req.Title)
	req.TaxNo = strings.TrimSpace(req.TaxNo)
	req.Email = strings.TrimSpace(req.Email)
	req.Remark = strings.TrimSpace(req.Remark)
	if req.InvoiceType == "" {
		req.InvoiceType = InvoiceTypePersonal
	}
	return req
}

func validateInvoiceCreateRequest(req InvoiceCreateRequest) error {
	if req.TradeNo == "" || req.Title == "" || req.Email == "" {
		return ErrInvoiceInvalidInput
	}
	if req.InvoiceType != InvoiceTypePersonal && req.InvoiceType != InvoiceTypeBusiness {
		return ErrInvoiceInvalidInput
	}
	if req.InvoiceType == InvoiceTypeBusiness && req.TaxNo == "" {
		return ErrInvoiceInvalidInput
	}
	if !strings.Contains(req.Email, "@") {
		return ErrInvoiceInvalidInput
	}
	return nil
}

func ensureInvoicePageInfo(pageInfo *common.PageInfo) *common.PageInfo {
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
