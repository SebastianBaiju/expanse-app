package main

import (
	"log"
	"net/http"
	"time"

	"expense-manager/backend/internal/config"
	"expense-manager/backend/internal/handlers"
	"expense-manager/backend/internal/services"

	"github.com/gin-gonic/gin"
)

// CORSMiddleware enables cross-origin resource sharing for the Angular client.
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func main() {
	log.Println("Starting Expense Management Backend...")

	// 1. Initialize Keys & Database
	config.InitKeys()
	config.InitDB()

	// 2. Start Recurring Transaction Scheduler (runs every 5 minutes)
	stopScheduler := services.StartScheduler(5 * time.Minute)
	defer close(stopScheduler)

	// 3. Configure HTTP server
	r := gin.Default()
	r.Use(CORSMiddleware())

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "time": time.Now().Format(time.RFC3339)})
	})
	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "time": time.Now().Format(time.RFC3339)})
	})

	// Public Auth Routes
	auth := r.Group("/api/auth")
	{
		auth.POST("/register", handlers.Register)
		auth.POST("/login", handlers.Login)
	}

	// Protected Routes (JWT required)
	api := r.Group("/api")
	api.Use(handlers.AuthMiddleware())
	{
		// Dashboard stats
		api.GET("/dashboard/stats", handlers.GetDashboardStats)

		// Transactions
		api.GET("/transactions", handlers.GetTransactions)
		api.POST("/transactions", handlers.CreateTransaction)
		api.PUT("/transactions/:id", handlers.UpdateTransaction)
		api.DELETE("/transactions/:id", handlers.DeleteTransaction)

		// Recurring rules (Salary / Loan EMIs)
		api.GET("/recurring", handlers.GetRecurringRules)
		api.POST("/recurring", handlers.CreateRecurringRule)
		api.PUT("/recurring/:id", handlers.UpdateRecurringRule)
		api.DELETE("/recurring/:id", handlers.DeleteRecurringRule)

		// Push Notifications
		api.GET("/notifications/vapid-key", handlers.GetVAPIDKey)
		api.POST("/notifications/subscribe", handlers.SubscribeUser)

		// Email Configurations
		api.GET("/mail/config", handlers.GetMailConfig)
		api.POST("/mail/config", handlers.CreateOrUpdateMailConfig)
		api.PUT("/mail/config/active", handlers.ToggleMailConfigActive)
		api.POST("/mail/sync", handlers.TriggerMailSync)

		// Bill Upload & Parser
		api.POST("/bills/parse", handlers.ParseBill)

		// Bank Statement Parser
		api.POST("/statements/parse", handlers.ParseStatement)
		api.POST("/transactions/bulk", handlers.CreateTransactionsBulk)

		// Admin accounts manager (Admin-only)
		admin := api.Group("/admin")
		admin.Use(handlers.AdminMiddleware())
		{
			admin.GET("/users", handlers.AdminGetUsers)
			admin.PUT("/users/:id/role", handlers.AdminUpdateUserRole)
			admin.DELETE("/users/:id", handlers.AdminDeleteUser)
		}
	}

	port := ":8080"
	log.Printf("Server listening on port %s", port)
	if err := r.Run(port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
