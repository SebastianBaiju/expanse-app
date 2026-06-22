package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"expense-manager/backend/internal/config"
	"expense-manager/backend/internal/models"
	"expense-manager/backend/internal/services"

	"github.com/gin-gonic/gin"
)

// Helper to get authenticated userID from context
func getUserID(c *gin.Context) (uint, bool) {
	val, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return 0, false
	}
	id, ok := val.(uint)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return 0, false
	}
	return id, true
}

// GetTransactions returns all transactions.
func GetTransactions(c *gin.Context) {
	_, ok := getUserID(c)
	if !ok {
		return
	}

	var transactions []models.Transaction
	query := config.DB.Model(&models.Transaction{})

	// Optional filter by user ID
	if filterUID := c.Query("user_id"); filterUID != "" {
		query = query.Where("user_id = ?", filterUID)
	}

	// Filter by type (expense / income)
	if t := c.Query("type"); t != "" {
		query = query.Where("type = ?", t)
	}

	// Filter by category
	if cat := c.Query("category"); cat != "" {
		query = query.Where("category = ?", cat)
	}

	// Search keyword
	if search := c.Query("search"); search != "" {
		query = query.Where("title LIKE ?", "%"+search+"%")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count transactions"})
		return
	}

	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "10")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 {
		limit = 10
	}

	offset := (page - 1) * limit

	if err := query.Preload("User").Order("date desc").Offset(offset).Limit(limit).Find(&transactions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch transactions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"transactions": transactions,
		"total":        total,
		"page":         page,
		"limit":        limit,
	})
}

// CreateTransaction adds a manual transaction and triggers a push notification.
func CreateTransaction(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var req struct {
		Title    string    `json:"title" binding:"required"`
		Amount   float64   `json:"amount" binding:"required,gt=0"`
		Category string    `json:"category" binding:"required"`
		Type     string    `json:"type" binding:"required,oneof=expense income"`
		Date     time.Time `json:"date" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	transaction := models.Transaction{
		UserID:      userID,
		Title:       req.Title,
		Amount:      req.Amount,
		Category:    req.Category,
		Type:        req.Type,
		Date:        req.Date,
		Source:      "manual",
		IsRecurring: false,
	}

	if err := config.DB.Create(&transaction).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create transaction"})
		return
	}

	// Preload User info
	config.DB.Preload("User").First(&transaction, transaction.ID)

	// Send Push Notification
	title := "Manual Expense Added"
	if req.Type == "income" {
		title = "Manual Income Added"
	}
	body := fmt.Sprintf("Added Rs. %.2f for '%s'", req.Amount, req.Title)
	services.SendNotification(userID, title, body, "/dashboard")

	c.JSON(http.StatusCreated, transaction)
}

// CreateTransactionsBulk imports multiple transactions (e.g. from bank statement scan).
func CreateTransactionsBulk(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var req struct {
		Source       string `json:"source"`
		Transactions []struct {
			Title    string    `json:"title" binding:"required"`
			Amount   float64   `json:"amount" binding:"required,gt=0"`
			Category string    `json:"category" binding:"required"`
			Type     string    `json:"type" binding:"required,oneof=expense income"`
			Date     time.Time `json:"date" binding:"required"`
		} `json:"transactions" binding:"required,min=1,dive"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	source := req.Source
	if source == "" {
		source = "statement_scan"
	}

	added := 0
	skipped := 0
	var created []models.Transaction

	for _, item := range req.Transactions {
		var existing int64
		config.DB.Model(&models.Transaction{}).
			Where("user_id = ? AND title = ? AND amount = ? AND date = ? AND source = ?",
				userID, item.Title, item.Amount, item.Date, source).
			Count(&existing)
		if existing > 0 {
			skipped++
			continue
		}

		transaction := models.Transaction{
			UserID:      userID,
			Title:       item.Title,
			Amount:      item.Amount,
			Category:    item.Category,
			Type:        item.Type,
			Date:        item.Date,
			Source:      source,
			IsRecurring: false,
		}

		if err := config.DB.Create(&transaction).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create transactions"})
			return
		}

		// Preload User info
		config.DB.Preload("User").First(&transaction, transaction.ID)
		created = append(created, transaction)
		added++
	}

	if added > 0 {
		body := fmt.Sprintf("Imported %d transaction(s) from bank statement", added)
		services.SendNotification(userID, "Bank Statement Import", body, "/transactions")
	}

	c.JSON(http.StatusCreated, gin.H{
		"added_count":   added,
		"skipped_count": skipped,
		"transactions":  created,
	})
}

// UpdateTransaction updates an existing transaction.
func UpdateTransaction(c *gin.Context) {
	_, ok := getUserID(c)
	if !ok {
		return
	}

	txID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction ID"})
		return
	}

	var transaction models.Transaction
	if err := config.DB.Where("id = ?", txID).First(&transaction).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
		return
	}

	var req struct {
		Title    string    `json:"title"`
		Amount   float64   `json:"amount" binding:"omitempty,gt=0"`
		Category string    `json:"category"`
		Type     string    `json:"type" binding:"omitempty,oneof=expense income"`
		Date     time.Time `json:"date"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Title != "" {
		transaction.Title = req.Title
	}
	if req.Amount > 0 {
		transaction.Amount = req.Amount
	}
	if req.Category != "" {
		transaction.Category = req.Category
	}
	if req.Type != "" {
		transaction.Type = req.Type
	}
	if !req.Date.IsZero() {
		transaction.Date = req.Date
	}

	if err := config.DB.Save(&transaction).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update transaction"})
		return
	}

	// Preload User info
	config.DB.Preload("User").First(&transaction, transaction.ID)

	c.JSON(http.StatusOK, transaction)
}

// DeleteTransaction deletes a transaction.
func DeleteTransaction(c *gin.Context) {
	_, ok := getUserID(c)
	if !ok {
		return
	}

	txID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction ID"})
		return
	}

	result := config.DB.Where("id = ?", txID).Delete(&models.Transaction{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete transaction"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Transaction deleted successfully"})
}

type CategoryBreakdown struct {
	Category string  `json:"category"`
	Amount   float64 `json:"amount"`
}

type MonthlyTrend struct {
	Month   string  `json:"month"`
	Income  float64 `json:"income"`
	Expense float64 `json:"expense"`
}

// GetDashboardStats aggregates user financial data.
func GetDashboardStats(c *gin.Context) {
	_, ok := getUserID(c)
	if !ok {
		return
	}

	incomeQuery := config.DB.Model(&models.Transaction{}).Where("type = 'income'")
	expenseQuery := config.DB.Model(&models.Transaction{}).Where("type = 'expense'")
	categoryQuery := config.DB.Model(&models.Transaction{}).Where("type = 'expense'")
	recentQuery := config.DB.Model(&models.Transaction{})

	// Optional filter by user ID
	if filterUID := c.Query("user_id"); filterUID != "" {
		incomeQuery = incomeQuery.Where("user_id = ?", filterUID)
		expenseQuery = expenseQuery.Where("user_id = ?", filterUID)
		categoryQuery = categoryQuery.Where("user_id = ?", filterUID)
		recentQuery = recentQuery.Where("user_id = ?", filterUID)
	}

	// 1. Calculate Total Income and Expense
	var totalIncome, totalExpense float64
	incomeQuery.Select("COALESCE(SUM(amount), 0)").Scan(&totalIncome)
	expenseQuery.Select("COALESCE(SUM(amount), 0)").Scan(&totalExpense)

	// 2. Fetch Category breakdowns
	var categoryBreakdowns []CategoryBreakdown
	categoryQuery.Select("category, SUM(amount) as amount").Group("category").Scan(&categoryBreakdowns)

	// 3. Fetch Monthly trends (last 6 months)
	var monthlyTrends []MonthlyTrend
	now := time.Now()
	for i := 5; i >= 0; i-- {
		t := now.AddDate(0, -i, 0)
		startOfMonth := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
		endOfMonth := startOfMonth.AddDate(0, 1, 0).Add(-time.Nanosecond)

		monthName := t.Month().String()[:3] + " " + strconv.Itoa(t.Year())

		var inc, exp float64
		incQuery := config.DB.Model(&models.Transaction{}).Where("type = 'income' AND date BETWEEN ? AND ?", startOfMonth, endOfMonth)
		expQuery := config.DB.Model(&models.Transaction{}).Where("type = 'expense' AND date BETWEEN ? AND ?", startOfMonth, endOfMonth)

		if filterUID := c.Query("user_id"); filterUID != "" {
			incQuery = incQuery.Where("user_id = ?", filterUID)
			expQuery = expQuery.Where("user_id = ?", filterUID)
		}

		incQuery.Select("COALESCE(SUM(amount), 0)").Scan(&inc)
		expQuery.Select("COALESCE(SUM(amount), 0)").Scan(&exp)

		monthlyTrends = append(monthlyTrends, MonthlyTrend{
			Month:   monthName,
			Income:  inc,
			Expense: exp,
		})
	}

	// 4. Get 5 most recent transactions
	var recentTransactions []models.Transaction
	recentQuery.Preload("User").Order("date desc").Limit(5).Find(&recentTransactions)

	c.JSON(http.StatusOK, gin.H{
		"balance":             totalIncome - totalExpense,
		"total_income":        totalIncome,
		"total_expense":       totalExpense,
		"categories":          categoryBreakdowns,
		"monthly_trends":      monthlyTrends,
		"recent_transactions": recentTransactions,
	})
}
