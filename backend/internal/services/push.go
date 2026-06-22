package services

import (
	"encoding/json"
	"log"
	"net/http"

	"expense-manager/backend/internal/config"
	"expense-manager/backend/internal/models"

	"github.com/SherClockHolmes/webpush-go"
)

type PushPayload struct {
	Notification struct {
		Title string                 `json:"title"`
		Body  string                 `json:"body"`
		Icon  string                 `json:"icon,omitempty"`
		Data  map[string]interface{} `json:"data,omitempty"`
	} `json:"notification"`
}

// SendNotification sends a push notification to all subscribed devices of a user.
func SendNotification(userID uint, title, body, url string) {
	var subscriptions []models.PushSubscription
	if err := config.DB.Where("user_id = ?", userID).Find(&subscriptions).Error; err != nil {
		log.Printf("Error fetching subscriptions for user %d: %v", userID, err)
		return
	}

	if len(subscriptions) == 0 {
		log.Printf("No push subscriptions found for user %d", userID)
		return
	}

	payload := PushPayload{}
	payload.Notification.Title = title
	payload.Notification.Body = body
	payload.Notification.Icon = "icons/icon-192x192.png"
	payload.Notification.Data = map[string]interface{}{
		"url": url,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal push payload: %v", err)
		return
	}

	publicKey, privateKey := config.GetVAPIDKeys()

	for _, sub := range subscriptions {
		// Parse target subscription info
		s := webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys: webpush.Keys{
				P256dh: sub.P256dh,
				Auth:   sub.Auth,
			},
		}

		// Send notification
		resp, err := webpush.SendNotification(payloadBytes, &s, &webpush.Options{
			Subscriber:      "mailto:admin@expensemanager.local",
			VAPIDPublicKey:  publicKey,
			VAPIDPrivateKey: privateKey,
			TTL:             120, // 2 minutes
		})

		if err != nil {
			log.Printf("Error sending push to endpoint %s: %v", sub.Endpoint, err)
			continue
		}

		defer resp.Body.Close()

		// If the subscription is no longer valid, delete it
		if resp.StatusCode == http.StatusGone || resp.StatusCode == http.StatusNotFound {
			log.Printf("Subscription expired. Deleting endpoint: %s", sub.Endpoint)
			config.DB.Delete(&sub)
		}
	}
}
