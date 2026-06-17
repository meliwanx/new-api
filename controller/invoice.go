package controller

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const (
	invoiceUploadDir     = "data/invoices"
	invoiceMaxUploadSize = 10 * 1024 * 1024
)

type invoiceProcessRequest struct {
	AdminNote string `json:"admin_note"`
}

type invoiceRejectRequest struct {
	Reason string `json:"reason"`
}

func CreateInvoiceRequest(c *gin.Context) {
	var req model.InvoiceCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	invoice, err := model.CreateInvoiceRequest(c.GetInt("id"), req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, invoice)
}

func ListAdminInvoiceRequests(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	status := strings.TrimSpace(c.Query("status"))
	keyword := strings.TrimSpace(c.Query("keyword"))

	invoices, total, err := model.ListInvoiceRequests(model.InvoiceListFilter{
		PageInfo: pageInfo,
		Status:   status,
		Keyword:  keyword,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(invoices)
	common.ApiSuccess(c, pageInfo)
}

func ProcessInvoiceRequest(c *gin.Context) {
	id, ok := parseInvoiceId(c)
	if !ok {
		return
	}
	var req invoiceProcessRequest
	_ = c.ShouldBindJSON(&req)
	if err := model.MarkInvoiceProcessing(id, req.AdminNote); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func IssueInvoiceRequest(c *gin.Context) {
	id, ok := parseInvoiceId(c)
	if !ok {
		return
	}
	var req model.InvoiceIssueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.MarkInvoiceIssued(id, req); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func UploadInvoiceFile(c *gin.Context) {
	id, ok := parseInvoiceId(c)
	if !ok {
		return
	}
	if err := c.Request.ParseMultipartForm(invoiceMaxUploadSize); err != nil {
		common.ApiErrorMsg(c, "上传文件过大或格式错误")
		return
	}
	fileHeader, err := c.FormFile("file")
	if err != nil {
		common.ApiErrorMsg(c, "请上传发票文件")
		return
	}
	if fileHeader.Size <= 0 || fileHeader.Size > invoiceMaxUploadSize {
		common.ApiErrorMsg(c, "发票文件不能超过 10MB")
		return
	}
	mime := fileHeader.Header.Get("Content-Type")
	if !isAllowedInvoiceMime(mime) {
		common.ApiErrorMsg(c, "仅支持 PDF、PNG、JPG 发票文件")
		return
	}
	if err := os.MkdirAll(invoiceUploadDir, 0o750); err != nil {
		common.ApiError(c, err)
		return
	}
	fileName := sanitizeInvoiceFileName(fileHeader.Filename)
	storedName := fmt.Sprintf("%d-%d-%s-%s", id, common.GetTimestamp(), common.GetRandomString(8), fileName)
	storedPath := filepath.Join(invoiceUploadDir, storedName)
	if err := c.SaveUploadedFile(fileHeader, storedPath); err != nil {
		common.ApiError(c, err)
		return
	}
	adminNote := strings.TrimSpace(c.PostForm("admin_note"))
	if err := model.MarkInvoiceIssuedWithFile(id, model.InvoiceFileInfo{
		Path: storedPath,
		Name: fileName,
		Mime: mime,
		Size: fileHeader.Size,
	}, adminNote); err != nil {
		_ = os.Remove(storedPath)
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func RejectInvoiceRequest(c *gin.Context) {
	id, ok := parseInvoiceId(c)
	if !ok {
		return
	}
	var req invoiceRejectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.RejectInvoiceRequest(id, req.Reason); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func DownloadUserInvoiceFile(c *gin.Context) {
	downloadInvoiceFile(c, c.GetInt("id"), false)
}

func DownloadAdminInvoiceFile(c *gin.Context) {
	downloadInvoiceFile(c, 0, true)
}

func downloadInvoiceFile(c *gin.Context, userId int, admin bool) {
	id, ok := parseInvoiceId(c)
	if !ok {
		return
	}
	file, err := model.GetInvoiceFile(id, userId, admin)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if _, err := os.Stat(file.Path); err != nil {
		common.ApiError(c, err)
		return
	}
	if file.Mime != "" {
		c.Header("Content-Type", file.Mime)
	}
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, strings.ReplaceAll(file.Name, `"`, "")))
	http.ServeFile(c.Writer, c.Request, file.Path)
}

func parseInvoiceId(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的发票申请 ID")
		return 0, false
	}
	return id, true
}

func isAllowedInvoiceMime(mime string) bool {
	switch strings.ToLower(strings.TrimSpace(mime)) {
	case "application/pdf", "image/png", "image/jpeg", "image/jpg":
		return true
	default:
		return false
	}
}

func sanitizeInvoiceFileName(name string) string {
	name = filepath.Base(strings.TrimSpace(name))
	name = strings.ReplaceAll(name, " ", "_")
	if name == "." || name == "" {
		return "invoice.pdf"
	}
	return name
}
