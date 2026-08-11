package client

import (
	"reflect"
	"strconv"
	"testing"

	"github.com/obot-platform/obot/pkg/gateway/types"
)

func TestUpdateUserCategoryPreferences(t *testing.T) {
	c := newTestClient(t)
	user := types.User{
		Username:       "user-1",
		HashedUsername: "user-1",
		Email:          "user-1@example.com",
	}
	if err := c.db.WithContext(t.Context()).Create(&user).Error; err != nil {
		t.Fatalf("creating user: %v", err)
	}
	userID := strconv.FormatUint(uint64(user.ID), 10)

	want := []string{"productivity", "development"}
	if _, err := c.UpdateUser(t.Context(), false, &types.User{CategoryPreferences: want}, userID); err != nil {
		t.Fatalf("updating category preferences: %v", err)
	}
	assertUserCategoryPreferences(t, c, userID, want)

	if _, err := c.UpdateUser(t.Context(), false, &types.User{Timezone: "UTC"}, userID); err != nil {
		t.Fatalf("updating user without category preferences: %v", err)
	}
	assertUserCategoryPreferences(t, c, userID, want)

	if _, err := c.UpdateUser(t.Context(), false, &types.User{CategoryPreferences: []string{}}, userID); err != nil {
		t.Fatalf("clearing category preferences: %v", err)
	}
	assertUserCategoryPreferences(t, c, userID, []string{})
}

func assertUserCategoryPreferences(t *testing.T, c *Client, userID string, want []string) {
	t.Helper()

	user, err := c.UserByID(t.Context(), userID)
	if err != nil {
		t.Fatalf("getting user: %v", err)
	}
	if !reflect.DeepEqual(user.CategoryPreferences, want) {
		t.Fatalf("category preferences = %#v, want %#v", user.CategoryPreferences, want)
	}
}
