module commander

go 1.23.0

require (
	github.com/gorilla/websocket v1.5.3
	github.com/mlund01/squadron-sdk v0.0.4
)

replace github.com/mlund01/squadron-sdk => ../squadron-sdk

require github.com/google/uuid v1.6.0 // indirect
