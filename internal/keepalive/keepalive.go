package keepalive

import (
	"sync"
	"time"
)

// KeepAlive implements a death clock that self-terminates the server
// if no ping is received within the configured duration.
type KeepAlive struct {
	timer    *time.Timer
	duration time.Duration
	mu       sync.Mutex
}

// New creates a new KeepAlive with the given timeout in seconds.
func New(seconds int) *KeepAlive {
	return &KeepAlive{
		duration: time.Duration(seconds) * time.Second,
	}
}

// Start begins the death clock. When the timer expires without a Reset,
// onExpire is called.
func (k *KeepAlive) Start(onExpire func()) {
	k.mu.Lock()
	defer k.mu.Unlock()
	k.timer = time.AfterFunc(k.duration, onExpire)
}

// Reset resets the death clock timer.
func (k *KeepAlive) Reset() {
	k.mu.Lock()
	defer k.mu.Unlock()
	if k.timer != nil {
		k.timer.Reset(k.duration)
	}
}
