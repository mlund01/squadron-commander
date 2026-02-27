package hub

import "errors"

var (
	ErrRequestTimeout      = errors.New("request timed out")
	ErrInstanceDisconnected = errors.New("instance disconnected")
)
