package handlers

import (
	"net/http"

	"expense-manager/backend/internal/config"
	"expense-manager/backend/internal/models"
	"expense-manager/backend/internal/services"

	"github.com/gin-gonic/gin"
)

// GetMailConfig returns the user's IMAP settings.
func GetMailConfig(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var mailConfig models.MailConfig
	if err := config.DB.Where("user_id = ?", userID).First(&mailConfig).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Email settings not configured"})
		return
	}

	// Clean password for safety
	response := gin.H{
		"id":          mailConfig.ID,
		"imap_server": mailConfig.IMAPServer,
		"imap_port":   mailConfig.IMAPPort,
		"email":       mailConfig.Email,
		"is_active":   mailConfig.IsActive,
	}

	c.JSON(http.StatusOK, response)
}

// CreateOrUpdateMailConfig registers IMAP server settings.
func CreateOrUpdateMailConfig(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var req struct {
		IMAPServer string `json:"imap_server" binding:"required"`
		IMAPPort   int    `json:"imap_port" binding:"required"`
		Email      string `json:"email" binding:"required,email"`
		Password   string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var mailConfig models.MailConfig
	err := config.DB.Where("user_id = ?", userID).First(&mailConfig).Error

	if err == nil {
		// Update
		mailConfig.IMAPServer = req.IMAPServer
		mailConfig.IMAPPort = req.IMAPPort
		mailConfig.Email = req.Email
		mailConfig.Password = req.Password // In production, we'd encrypt this
		mailConfig.IsActive = true
		if err := config.DB.Save(&mailConfig).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update settings"})
			return
		}
	} else {
		// Create
		mailConfig = models.MailConfig{
			UserID:     userID,
			IMAPServer: req.IMAPServer,
			IMAPPort:   req.IMAPPort,
			Email:      req.Email,
			Password:   req.Password,
			IsActive:   true,
		}
		if err := config.DB.Create(&mailConfig).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save settings"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email integration configured successfully"})
}

// TriggerMailSync manually runs the email crawler for the user.
func TriggerMailSync(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var mailConfig models.MailConfig
	if err := config.DB.Where("user_id = ? AND is_active = ?", userID, true).First(&mailConfig).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Active email integration not configured"})
		return
	}

	// Run IMAP sync synchronously for manual trigger feedback
	addedCount, err := services.FetchAndParseEmails(userID, mailConfig)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Email sync failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Email sync completed",
		"added_count": addedCount,
	})
}

// ToggleMailConfigActive updates the active status (permission) for email synchronization.
func ToggleMailConfigActive(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var req struct {
		IsActive bool `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var mailConfig models.MailConfig
	if err := config.DB.Where("user_id = ?", userID).First(&mailConfig).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Email settings not configured"})
		return
	}

	mailConfig.IsActive = req.IsActive
	if err := config.DB.Save(&mailConfig).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update email sync permission"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Email sync permission updated",
		"is_active": mailConfig.IsActive,
	})
}
