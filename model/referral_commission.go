/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

package model

import (
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

const (
	ReferralCommissionStatusActive   = "active"
	ReferralCommissionStatusReversed = "reversed"
)

// ReferralCommission 记录每一笔多级邀请返佣，便于对账、用户端展示与退款冲正。
// 该表通过 GORM AutoMigrate 创建，兼容 MySQL / PostgreSQL / SQLite。
type ReferralCommission struct {
	Id            int     `json:"id" gorm:"primaryKey"`
	BeneficiaryId int     `json:"beneficiary_id" gorm:"index;comment:受益人(上级)用户ID"`
	SourceUserId  int     `json:"source_user_id" gorm:"index;comment:产生充值的下级用户ID"`
	Level         int     `json:"level" gorm:"comment:返佣层级 1/2/3"`
	RechargeMoney float64 `json:"recharge_money" gorm:"comment:触发返佣的充值金额(原始)"`
	RechargeQuota int     `json:"recharge_quota" gorm:"comment:触发返佣的到账额度"`
	Commission    int     `json:"commission" gorm:"comment:实际发放的佣金额度"`
	TradeNo       string  `json:"trade_no" gorm:"type:varchar(64);index;comment:关联充值订单号(幂等/冲正用)"`
	Status        string  `json:"status" gorm:"type:varchar(16);default:'active';comment:active/reversed"`
	CreatedAt     int64   `json:"created_at" gorm:"autoCreateTime;comment:创建时间(秒)"`
	ReversedAt    int64   `json:"reversed_at" gorm:"default:0;comment:冲正时间(秒)"`
}

// DistributeReferralCommission 在一笔充值成功入账后调用，沿邀请链向上最多 3 级发放佣金。
//
// 设计要点：
//   - 幂等：以 tradeNo 去重，重复回调/补单不会重复发放（依赖订单号唯一）。
//   - 有效期：从下级用户“注册时间(CreatedAt)”起算；0 表示永久有效。
//   - 防环：visited 集合 + 最多 3 级，避免互相邀请造成死循环。
//   - 容错：任何异常仅记录日志，绝不影响主充值流程（panic 已 recover）。
//
// rechargeMoney 与 TopUp.Money 同单位；rechargeQuota 为本次实际到账额度。
func DistributeReferralCommission(sourceUserId int, rechargeMoney float64, rechargeQuota int64, tradeNo string) {
	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("DistributeReferralCommission panic: %v", r))
		}
	}()

	if !common.AffMultiLevelEnabled {
		return
	}
	if rechargeQuota <= 0 || tradeNo == "" {
		return
	}
	if common.AffCommissionMinRecharge > 0 && rechargeMoney < common.AffCommissionMinRecharge {
		return
	}

	// 幂等：该订单已分佣则跳过。
	var existing int64
	if err := DB.Model(&ReferralCommission{}).Where("trade_no = ?", tradeNo).Count(&existing).Error; err != nil {
		common.SysError("referral commission idempotency check failed: " + err.Error())
		return
	}
	if existing > 0 {
		return
	}

	source, err := GetUserById(sourceUserId, false)
	if err != nil || source == nil {
		return
	}

	// 返佣有效期：从下级注册日算起。
	if common.AffCommissionValidityDays > 0 && source.CreatedAt > 0 {
		deadline := source.CreatedAt + int64(common.AffCommissionValidityDays)*86400
		if common.GetTimestamp() > deadline {
			return
		}
	}

	rates := []float64{
		common.AffCommissionRateL1,
		common.AffCommissionRateL2,
		common.AffCommissionRateL3,
	}

	visited := map[int]bool{sourceUserId: true}
	cur := source
	for level := 0; level < len(rates); level++ {
		if cur.InviterId == 0 {
			break
		}
		parent, perr := GetUserById(cur.InviterId, false)
		if perr != nil || parent == nil {
			break
		}
		if visited[parent.Id] {
			break // 防环
		}

		rate := rates[level]
		if rate > 0 {
			commission := int(math.Round(float64(rechargeQuota) * rate))
			if commission > 0 {
				if err := DB.Model(&User{}).Where("id = ?", parent.Id).Updates(map[string]interface{}{
					"aff_quota":   gorm.Expr("aff_quota + ?", commission),
					"aff_history": gorm.Expr("aff_history + ?", commission),
				}).Error; err != nil {
					common.SysError(fmt.Sprintf("referral commission credit failed (beneficiary %d): %s", parent.Id, err.Error()))
				} else {
					record := &ReferralCommission{
						BeneficiaryId: parent.Id,
						SourceUserId:  sourceUserId,
						Level:         level + 1,
						RechargeMoney: rechargeMoney,
						RechargeQuota: int(rechargeQuota),
						Commission:    commission,
						TradeNo:       tradeNo,
						Status:        ReferralCommissionStatusActive,
					}
					if err := DB.Create(record).Error; err != nil {
						common.SysError("referral commission record insert failed: " + err.Error())
					}
					RecordLog(parent.Id, LogTypeSystem, fmt.Sprintf(
						"邀请返佣：下级用户(ID %d)充值 %.2f，第 %d 级返佣 %s",
						sourceUserId, rechargeMoney, level+1, logger.LogQuota(commission)))
				}
			}
		}

		visited[parent.Id] = true
		cur = parent
	}
}

// ReverseReferralCommissionByTradeNo 在订单退款时调用，把该订单已发放的佣金从各受益人处扣回。
// 扣回时对 aff_quota / aff_history 做下限保护（不低于 0），并把对应记录标记为 reversed。幂等。
func ReverseReferralCommissionByTradeNo(tradeNo string, reason string) error {
	if tradeNo == "" {
		return nil
	}
	var records []ReferralCommission
	if err := DB.Where("trade_no = ? AND status = ?", tradeNo, ReferralCommissionStatusActive).Find(&records).Error; err != nil {
		return err
	}
	now := common.GetTimestamp()
	for _, rc := range records {
		commission := rc.Commission
		err := DB.Transaction(func(tx *gorm.DB) error {
			// CASE WHEN 在 MySQL / PostgreSQL / SQLite 下均为标准语法，避免余额被扣成负数。
			if err := tx.Model(&User{}).Where("id = ?", rc.BeneficiaryId).Updates(map[string]interface{}{
				"aff_quota":   gorm.Expr("CASE WHEN aff_quota >= ? THEN aff_quota - ? ELSE 0 END", commission, commission),
				"aff_history": gorm.Expr("CASE WHEN aff_history >= ? THEN aff_history - ? ELSE 0 END", commission, commission),
			}).Error; err != nil {
				return err
			}
			return tx.Model(&ReferralCommission{}).Where("id = ?", rc.Id).Updates(map[string]interface{}{
				"status":      ReferralCommissionStatusReversed,
				"reversed_at": now,
			}).Error
		})
		if err != nil {
			return err
		}
		RecordLog(rc.BeneficiaryId, LogTypeSystem, fmt.Sprintf(
			"邀请返佣冲正：订单 %s（%s），扣回第 %d 级佣金 %s",
			tradeNo, reason, rc.Level, logger.LogQuota(commission)))
	}
	return nil
}

// GetReferralTeamCounts 返回某用户向下 3 级的团队人数（L1=直接邀请，L2=孙级，L3=曾孙级）。
// 通过逐层按 inviter_id 归集子节点 id 实现，最多 3 层，避免无限递归。
func GetReferralTeamCounts(userId int) ([3]int64, error) {
	var counts [3]int64
	if userId == 0 {
		return counts, nil
	}
	parentIds := []int{userId}
	for level := 0; level < 3; level++ {
		if len(parentIds) == 0 {
			break
		}
		var children []int
		if err := DB.Model(&User{}).
			Where("inviter_id IN ?", parentIds).
			Pluck("id", &children).Error; err != nil {
			return counts, err
		}
		counts[level] = int64(len(children))
		parentIds = children
	}
	return counts, nil
}

// GetReferralCommissionSummary 返回某受益人各层级的有效返佣汇总（用户端“我的分销收益”展示）。
func GetReferralCommissionSummary(beneficiaryId int) (map[int]int64, error) {
	type row struct {
		Level int
		Total int64
	}
	var rows []row
	err := DB.Model(&ReferralCommission{}).
		Select("level, COALESCE(SUM(commission),0) as total").
		Where("beneficiary_id = ? AND status = ?", beneficiaryId, ReferralCommissionStatusActive).
		Group("level").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make(map[int]int64, len(rows))
	for _, r := range rows {
		result[r.Level] = r.Total
	}
	return result, nil
}
