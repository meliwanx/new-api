package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type affiliateWithdrawalProcessRequest struct {
	AdminNote string `json:"admin_note"`
}

type affiliateWithdrawalRejectRequest struct {
	Reason string `json:"reason"`
}

func CreateAffiliateWithdrawal(c *gin.Context) {
	var req model.AffiliateWithdrawalCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	withdrawal, err := model.CreateAffiliateWithdrawal(c.GetInt("id"), req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, withdrawal)
}

func ListUserAffiliateWithdrawals(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	withdrawals, total, err := model.ListUserAffiliateWithdrawals(c.GetInt("id"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(withdrawals)
	common.ApiSuccess(c, pageInfo)
}

func ListAdminAffiliateWithdrawals(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	status := strings.TrimSpace(c.Query("status"))
	keyword := strings.TrimSpace(c.Query("keyword"))
	userId, _ := strconv.Atoi(c.Query("user_id"))

	withdrawals, total, err := model.ListAffiliateWithdrawals(model.AffiliateWithdrawalListFilter{
		PageInfo: pageInfo,
		Status:   status,
		Keyword:  keyword,
		UserId:   userId,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(withdrawals)
	common.ApiSuccess(c, pageInfo)
}

func ProcessAffiliateWithdrawal(c *gin.Context) {
	id, ok := parseAffiliateWithdrawalId(c)
	if !ok {
		return
	}
	var req affiliateWithdrawalProcessRequest
	_ = c.ShouldBindJSON(&req)
	if err := model.MarkAffiliateWithdrawalProcessing(id, req.AdminNote); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func CompleteAffiliateWithdrawal(c *gin.Context) {
	id, ok := parseAffiliateWithdrawalId(c)
	if !ok {
		return
	}
	var req affiliateWithdrawalProcessRequest
	_ = c.ShouldBindJSON(&req)
	if err := model.CompleteAffiliateWithdrawal(id, req.AdminNote); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func RejectAffiliateWithdrawal(c *gin.Context) {
	id, ok := parseAffiliateWithdrawalId(c)
	if !ok {
		return
	}
	var req affiliateWithdrawalRejectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.RejectAffiliateWithdrawal(id, req.Reason); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func parseAffiliateWithdrawalId(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的提现申请 ID")
		return 0, false
	}
	return id, true
}
