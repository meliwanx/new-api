package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestUpdateOptionReturnsDatabaseError(t *testing.T) {
	originalDB := DB
	originalOptionMap := common.OptionMap
	t.Cleanup(func() {
		DB = originalDB
		common.OptionMap = originalOptionMap
	})

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	common.OptionMap = map[string]string{}

	err = UpdateOption("TestOptionWriteError", "new-value")

	require.Error(t, err)
	require.Empty(t, common.OptionMap["TestOptionWriteError"])
}
