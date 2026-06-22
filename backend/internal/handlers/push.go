package handlers

import (
	"net/http"

	"expense-manager/backend/internal/config"
	"expense-manager/backend/internal/models"

	"github.com/gin-gonic/gin"
)

// GetVAPIDKey returns the public VAPID key.
func GetVAPIDKey(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"public_key": config.VAPIDPublicKey})
}

type SubscribeRequest struct {
	Endpoint string `json:"endpoint" binding:"required"`
	Keys     struct {
		P256dh string `json:"p256dh" binding:"required"`
		Auth   string `json:"auth" binding:"required"`
	} `json:"keys" binding:"required"`
}

// SubscribeUser registers or updates a device for push notifications.
func SubscribeUser(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var req SubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var subscription models.PushSubscription
	err := config.DB.Where("endpoint = ?", req.Endpoint).First(&subscription).Error

	if err == nil {
		// Update existing subscription's user
		subscription.UserID = userID
		subscription.P256dh = req.Keys.P256dh
		subscription.Auth = req.Keys.Auth
		if err := config.DB.Save(&subscription).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update subscription"})
			return
		}
	} else {
		// Create new subscription
		subscription = models.PushSubscription{
			UserID:   userID,
			Endpoint: req.Endpoint,
			P256dh:   req.Keys.P256dh,
			Auth:     req.Keys.Auth,
		}
		if err := config.DB.Create(&subscription).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save subscription"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Subscription registered successfully"})
}
