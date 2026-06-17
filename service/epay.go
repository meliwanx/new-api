package service

import (
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

func GetCallbackAddress() string {
	serverAddress := normalizeCallbackBaseAddress(system_setting.ServerAddress)
	customAddress := normalizeCallbackBaseAddress(operation_setting.CustomCallbackAddress)
	if customAddress == "" {
		return serverAddress
	}
	if serverAddress != "" && (!isHTTPAddress(customAddress) || IsPayGatewayCallbackAddress(customAddress, operation_setting.PayAddress)) {
		return serverAddress
	}
	return customAddress
}

func IsPayGatewayCallbackAddress(callbackAddress string, payAddress string) bool {
	callbackURL, err := url.Parse(normalizeCallbackBaseAddress(callbackAddress))
	if err != nil || callbackURL.Host == "" {
		return false
	}
	payURL, err := url.Parse(normalizeCallbackBaseAddress(payAddress))
	if err != nil || payURL.Host == "" {
		return false
	}
	return strings.EqualFold(callbackURL.Host, payURL.Host)
}

func normalizeCallbackBaseAddress(address string) string {
	return strings.TrimRight(strings.TrimSpace(address), "/")
}

func isHTTPAddress(address string) bool {
	parsed, err := url.Parse(address)
	if err != nil {
		return false
	}
	return parsed.Host != "" && (strings.EqualFold(parsed.Scheme, "http") || strings.EqualFold(parsed.Scheme, "https"))
}
