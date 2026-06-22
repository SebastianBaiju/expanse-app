package handlers

import (
	"net/http"
	"strconv"

	"expense-manager/backend/internal/config"
	"expense-manager/backend/internal/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// AdminGetUsers lists all users.
func AdminGetUsers(c *gin.Context) {
	var users []models.User
	if err := config.DB.Order("username asc").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	c.JSON(http.StatusOK, users)
}

// AdminUpdateUserRole updates a user's role.
func AdminUpdateUserRole(c *gin.Context) {
	targetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	currentAdminID, _ := getUserID(c)
	if uint(targetID) == currentAdminID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot change your own role"})
		return
	}

	var req struct {
		Role string `json:"role" binding:"required,oneof=admin user"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := config.DB.First(&user, targetID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	user.Role = req.Role
	if err := config.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user role"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// AdminDeleteUser deletes a user account.
func AdminDeleteUser(c *gin.Context) {
	targetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	currentAdminID, _ := getUserID(c)
	if uint(targetID) == currentAdminID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot delete your own account"})
		return
	}

	// Delete user (Cascade constraints on GORM will clean up foreign keys)
	result := config.DB.Delete(&models.User{}, targetID)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}

type AdminCreateUserRequest struct {
	Username string `json:"username" binding:"required,min=3"`
	Password string `json:"password" binding:"required,min=6"`
	Email    string `json:"email" binding:"required,email"`
	Role     string `json:"role" binding:"required,oneof=admin user"`
}

// AdminCreateUser allows administrators to register a new user.
func AdminCreateUser(c *gin.Context) {
	var req AdminCreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if user exists
	var existing models.User
	if err := config.DB.Where("username = ?", req.Username).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Username already exists"})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encrypt password"})
		return
	}

	user := models.User{
		Username:     req.Username,
		PasswordHash: string(hashedPassword),
		Email:        req.Email,
		Role:         req.Role,
	}

	if err := config.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	c.JSON(http.StatusCreated, user)
}

// GetUsersList returns a list of user IDs and usernames for filtering transactions.
func GetUsersList(c *gin.Context) {
	var users []struct {
		ID       uint   `json:"id"`
		Username string `json:"username"`
	}
	if err := config.DB.Model(&models.User{}).Select("id, username").Order("username asc").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users list"})
		return
	}
	c.JSON(http.StatusOK, users)
}
