package api

import (
	"fmt"
	"net/http"

	"github.com/mlund01/squadron-wire/protocol"

	"commander/internal/hub"
)

func handleGetCostSummary(h *hub.Hub) http.HandlerFunc {
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

		from := r.URL.Query().Get("from")
		to := r.URL.Query().Get("to")
		groupBy := r.URL.Query().Get("groupBy")
		breakdownField := r.URL.Query().Get("breakdownField")

		req, err := protocol.NewRequest(protocol.TypeGetCostSummary, &protocol.GetCostSummaryPayload{
			From:           from,
			To:             to,
			GroupBy:        groupBy,
			BreakdownField: breakdownField,
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

		var result protocol.GetCostSummaryResultPayload
		if err := protocol.DecodePayload(resp, &result); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("decode response: %v", err)})
			return
		}

		writeJSON(w, http.StatusOK, result)
	}
}
