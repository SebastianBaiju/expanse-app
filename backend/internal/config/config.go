package config

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"expense-manager/backend/internal/models"

	"github.com/SherClockHolmes/webpush-go"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"golang.org/x/crypto/bcrypt"
)

var (
	DB              *gorm.DB
	JWTSecret       []byte
	VAPIDPublicKey  string
	VAPIDPrivateKey string
)

type SavedKeys struct {
	JWTSecret       string `json:"jwt_secret"`
	VAPIDPublicKey  string `json:"vapid_public_key"`
	VAPIDPrivateKey string `json:"vapid_private_key"`
}

func InitDB() {
	var err error

	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "db" // default host in docker compose
	}
	dbPort := os.Getenv("DB_PORT")
	if dbPort == "" {
		dbPort = "5432"
	}
	dbUser := os.Getenv("DB_USER")
	if dbUser == "" {
		dbUser = "postgres"
	}
	dbPassword := os.Getenv("DB_PASSWORD")
	if dbPassword == "" {
		dbPassword = "postgrespassword"
	}
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "expense_manager"
	}
	dbSSLMode := os.Getenv("DB_SSLMODE")
	if dbSSLMode == "" {
		dbSSLMode = "disable"
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		dbHost, dbUser, dbPassword, dbName, dbPort, dbSSLMode)

	// Connect to Postgres
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("Failed to connect to Postgres: %v", err)
	}

	log.Println("Database connection established. Running migrations...")

	// Auto migrate all tables
	err = DB.AutoMigrate(
		&models.User{},
		&models.Transaction{},
		&models.RecurringRule{},
		&models.PushSubscription{},
		&models.MailConfig{},
	)
	if err != nil {
		log.Fatalf("Database migration failed: %v", err)
	}

	log.Println("Database migration completed.")

	// Seed Admin if no users exist
	var count int64
	DB.Model(&models.User{}).Count(&count)
	if count == 0 {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("adminadmin"), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("Failed to hash admin password: %v", err)
		}

		admin := models.User{
			Username:     "admin",
			PasswordHash: string(hashedPassword),
			Email:        "admin@expensemanager.local",
			Role:         "admin",
		}

		if err := DB.Create(&admin).Error; err != nil {
			log.Printf("Warning: failed to seed admin user: %v", err)
		} else {
			log.Println("Default Admin account seeded: admin / adminadmin")
		}
	}
}

func InitKeys() {
	keysFile := "keys.json"
	
	// Try loading from file
	if data, err := os.ReadFile(keysFile); err == nil {
		var saved SavedKeys
		if err := json.Unmarshal(data, &saved); err == nil {
			JWTSecret = []byte(saved.JWTSecret)
			VAPIDPublicKey = saved.VAPIDPublicKey
			VAPIDPrivateKey = saved.VAPIDPrivateKey
			log.Println("Successfully loaded existing JWT and VAPID keys.")
			return
		}
	}

	// Otherwise, generate new keys
	log.Println("Generating new JWT secret and VAPID keys...")
	
	// JWT Secret
	jwtKey := make([]byte, 32)
	_, _ = rand.Read(jwtKey)
	JWTSecret = jwtKey

	// VAPID Keys
	privateKey, publicKey, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		log.Fatalf("Failed to generate VAPID keys: %v", err)
	}
	VAPIDPublicKey = publicKey
	VAPIDPrivateKey = privateKey

	// Save to file
	saved := SavedKeys{
		JWTSecret:       string(JWTSecret),
		VAPIDPublicKey:  VAPIDPublicKey,
		VAPIDPrivateKey: VAPIDPrivateKey,
	}

	if data, err := json.MarshalIndent(saved, "", "  "); err == nil {
		_ = os.WriteFile(keysFile, data, 0600)
		log.Println("Generated and saved new keys to keys.json.")
	} else {
		log.Printf("Warning: failed to serialize keys: %v", err)
	}
	
	// Print public key for frontend reference
	fmt.Printf("\n--- VAPID PUBLIC KEY FOR FRONTEND ---\n%s\n-------------------------------------\n\n", VAPIDPublicKey)
}

func GetVAPIDKeys() (string, string) {
	return VAPIDPublicKey, VAPIDPrivateKey
}
