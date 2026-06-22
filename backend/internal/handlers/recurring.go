package handlers

import (
	"net/http"
	"strconv"
	"time"

	"expense-manager/backend/internal/config"
	"expense-manager/backend/internal/models"
	"expense-manager/backend/internal/services"

	"github.com/gin-gonic/gin"
)

// GetRecurringRules returns all active/inactive recurring rules for the current user.
func GetRecurringRules(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var rules []models.RecurringRule
	if err := config.DB.Where("user_id = ?", userID).Find(&rules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recurring rules"})
		return
	}

	c.JSON(http.StatusOK, rules)
}

// CreateRecurringRule registers a new automated transaction rule.
func CreateRecurringRule(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var req struct {
		Title     string  `json:"title" binding:"required"`
		Amount    float64 `json:"amount" binding:"required,gt=0"`
		Category  string  `json:"category" binding:"required"`
		Type      string  `json:"type" binding:"required,oneof=expense income"`
		Frequency string  `json:"frequency" binding:"required,oneof=daily weekly monthly yearly"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rule := models.RecurringRule{
		UserID:    userID,
		Title:     req.Title,
		Amount:    req.Amount,
		Category:  req.Category,
		Type:      req.Type,
		Frequency: req.Frequency,
		LastRun:   time.Time{}, // Never run yet
		IsActive:  true,
	}

	if err := config.DB.Create(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create recurring rule"})
		return
	}

	// Trigger scheduler job in background to process the rule immediately
	go services.RunSchedulerJob()

	c.JSON(http.StatusCreated, rule)
}

// UpdateRecurringRule toggles active status or updates details.
func UpdateRecurringRule(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	ruleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID"})
		return
	}

	var rule models.RecurringRule
	if err := config.DB.Where("id = ? AND user_id = ?", ruleID, userID).First(&rule).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recurring rule not found"})
		return
	}

	var req struct {
		Title     string   `json:"title"`
		Amount    float64  `json:"amount" binding:"omitempty,gt=0"`
		Category  string   `json:"category"`
		Type      string   `json:"type" binding:"omitempty,oneof=expense income"`
		Frequency string   `json:"frequency" binding:"omitempty,oneof=daily weekly monthly yearly"`
		IsActive  *bool    `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Title != "" {
		rule.Title = req.Title
	}
	if req.Amount > 0 {
		rule.Amount = req.Amount
	}
	if req.Category != "" {
		rule.Category = req.Category
	}
	if req.Type != "" {
		rule.Type = req.Type
	}
	if req.Frequency != "" {
		rule.Frequency = req.Frequency
	}
	if req.IsActive != nil {
		rule.IsActive = *req.IsActive
	}

	if err := config.DB.Save(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update recurring rule"})
		return
	}

	// Trigger scheduler job in background to process the updated rule immediately
	go services.RunSchedulerJob()

	c.JSON(http.StatusOK, rule)
}

// DeleteRecurringRule deletes (removes) a recurring rule.
func DeleteRecurringRule(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	ruleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID"})
		return
	}

	result := config.DB.Where("id = ? AND user_id = ?", ruleID, userID).Delete(&models.RecurringRule{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete recurring rule"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recurring rule not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Recurring rule deleted successfully"})
}
