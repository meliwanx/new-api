package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/require"
)

func TestGetCallbackAddressFallsBackWhenCustomAddressIsPayGateway(t *testing.T) {
	originalServerAddress := system_setting.ServerAddress
	originalPayAddress := operation_setting.PayAddress
	originalCustomCallbackAddress := operation_setting.CustomCallbackAddress
	t.Cleanup(func() {
		system_setting.ServerAddress = originalServerAddress
		operation_setting.PayAddress = originalPayAddress
		operation_setting.CustomCallbackAddress = originalCustomCallbackAddress
	})

	system_setting.ServerAddress = "https://onlymeok.com"
	operation_setting.PayAddress = "https://zpayz.cn"
	operation_setting.CustomCallbackAddress = "https://zpayz.cn"

	require.Equal(t, "https://onlymeok.com", GetCallbackAddress())
}

func TestGetCallbackAddressUsesValidCustomAddress(t *testing.T) {
	originalServerAddress := system_setting.ServerAddress
	originalPayAddress := operation_setting.PayAddress
	originalCustomCallbackAddress := operation_setting.CustomCallbackAddress
	t.Cleanup(func() {
		system_setting.ServerAddress = originalServerAddress
		operation_setting.PayAddress = originalPayAddress
		operation_setting.CustomCallbackAddress = originalCustomCallbackAddress
	})

	system_setting.ServerAddress = "https://onlymeok.com/"
	operation_setting.PayAddress = "https://zpayz.cn"
	operation_setting.CustomCallbackAddress = " https://callback.onlymeok.com/ "

	require.Equal(t, "https://callback.onlymeok.com", GetCallbackAddress())
}
