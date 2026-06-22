package services

import (
	"fmt"
	"log"
	"time"

	"expense-manager/backend/internal/config"
	"expense-manager/backend/internal/models"
)

// StartScheduler starts a background worker that runs periodically to execute recurring transactions.
func StartScheduler(interval time.Duration) chan struct{} {
	ticker := time.NewTicker(interval)
	stopChan := make(chan struct{})

	go func() {
		log.Println("Recurring transaction scheduler worker started.")
		// Run once on startup
		RunSchedulerJob()
		
		for {
			select {
			case <-ticker.C:
				RunSchedulerJob()
			case <-stopChan:
				ticker.Stop()
				log.Println("Recurring transaction scheduler worker stopped.")
				return
			}
		}
	}()

	return stopChan
}

// RunSchedulerJob checks and processes all active recurring rules.
func RunSchedulerJob() {
	var rules []models.RecurringRule
	if err := config.DB.Where("is_active = ?", true).Find(&rules).Error; err != nil {
		log.Printf("Scheduler error fetching active rules: %v", err)
		return
	}

	now := time.Now()

	for _, rule := range rules {
		if IsRuleDue(rule, now) {
			// Start transaction block
			tx := config.DB.Begin()

			// 1. Create Transaction
			transaction := models.Transaction{
				UserID:          rule.UserID,
				Title:           rule.Title,
				Amount:          rule.Amount,
				Category:        rule.Category,
				Type:            rule.Type,
				Date:            now,
				Source:          "auto",
				IsRecurring:     true,
				RecurringRuleID: &rule.ID,
			}

			if err := tx.Create(&transaction).Error; err != nil {
				tx.Rollback()
				log.Printf("Scheduler failed to create transaction for rule %d: %v", rule.ID, err)
				continue
			}

			// 2. Update last run time
			rule.LastRun = now
			if err := tx.Save(&rule).Error; err != nil {
				tx.Rollback()
				log.Printf("Scheduler failed to update last run for rule %d: %v", rule.ID, err)
				continue
			}

			tx.Commit()

			log.Printf("Automated transaction processed: %s (Amount: %.2f, Type: %s)", rule.Title, rule.Amount, rule.Type)

			// 3. Send notification
			notifTitle := "Automated Income Added"
			if rule.Type == "expense" {
				notifTitle = "Automated Expense Added"
			}
			body := fmt.Sprintf("Rule '%s' processed for Rs. %.2f", rule.Title, rule.Amount)
			
			SendNotification(rule.UserID, notifTitle, body, "/dashboard")
		}
	}
}

// IsRuleDue checks if a recurring rule should be run based on current time.
func IsRuleDue(rule models.RecurringRule, now time.Time) bool {
	// If it has never run, it is due.
	if rule.LastRun.IsZero() {
		return true
	}

	switch rule.Frequency {
	case "daily":
		return now.Sub(rule.LastRun) >= 24*time.Hour
	case "weekly":
		return now.Sub(rule.LastRun) >= 7*24*time.Hour
	case "monthly":
		// Run if the year or month is newer than the last run
		return now.Year() > rule.LastRun.Year() || (now.Year() == rule.LastRun.Year() && now.Month() > rule.LastRun.Month())
	case "yearly":
		return now.Year() > rule.LastRun.Year()
	default:
		return false
	}
}

