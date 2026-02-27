package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/mlund01/squadron-sdk/protocol"

	"commander/internal/hub"
)

const proxyTimeout = 30 * time.Second

func handleRunMission(h *hub.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("id")
		missionName := r.PathValue("name")

		instance := h.GetRegistry().GetInstance(instanceID)
		if instance == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "instance not found"})
			return
		}
		if !instance.Connected {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "instance disconnected"})
			return
		}

		var body struct {
			Inputs map[string]string `json:"inputs"`
		}
		if r.Body != nil {
			json.NewDecoder(r.Body).Decode(&body)
		}
		if body.Inputs == nil {
			body.Inputs = make(map[string]string)
		}

		req, err := protocol.NewRequest(protocol.TypeRunMission, &protocol.RunMissionPayload{
			MissionName: missionName,
			Inputs:      body.Inputs,
		})
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		resp, err := h.SendRequest(instanceID, req, proxyTimeout)
		if err != nil {
			writeJSON(w, http.StatusGatewayTimeout, map[string]string{"error": fmt.Sprintf("request failed: %v", err)})
			return
		}

		var ack protocol.RunMissionAckPayload
		if err := protocol.DecodePayload(resp, &ack); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "invalid response from instance"})
			return
		}

		if !ack.Accepted {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": ack.Reason})
			return
		}

		writeJSON(w, http.StatusAccepted, map[string]string{
			"missionId": ack.MissionID,
			"status":    "started",
		})
	}
}

func handleMissionEvents(h *hub.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("id")
		missionID := r.PathValue("mid")

		conn := h.GetConnection(instanceID)
		if conn == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "instance disconnected"})
			return
		}

		// Set SSE headers
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming not supported", http.StatusInternalServerError)
			return
		}

		// Subscribe to mission events
		ch, cleanup := conn.SubscribeMissionEvents(missionID)
		defer cleanup()

		ctx := r.Context()

		for {
			select {
			case <-ctx.Done():
				return
			case event, ok := <-ch:
				if !ok {
					return
				}

				data, err := json.Marshal(event)
				if err != nil {
					log.Printf("SSE marshal error: %v", err)
					continue
				}

				fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.EventType, data)
				flusher.Flush()

				// Close on terminal events
				if event.EventType == protocol.EventMissionCompleted || event.EventType == protocol.EventMissionFailed {
					return
				}
			}
		}
	}
}

func handleMissionHistory(h *hub.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("id")

		instance := h.GetRegistry().GetInstance(instanceID)
		if instance == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "instance not found"})
			return
		}
		if !instance.Connected {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "instance disconnected"})
			return
		}

		req, err := protocol.NewRequest(protocol.TypeGetMissions, &protocol.GetMissionsPayload{
			Limit:  50,
			Offset: 0,
		})
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		resp, err := h.SendRequest(instanceID, req, proxyTimeout)
		if err != nil {
			writeJSON(w, http.StatusGatewayTimeout, map[string]string{"error": fmt.Sprintf("request failed: %v", err)})
			return
		}

		var result protocol.GetMissionsResultPayload
		if err := protocol.DecodePayload(resp, &result); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "invalid response from instance"})
			return
		}

		writeJSON(w, http.StatusOK, result)
	}
}
