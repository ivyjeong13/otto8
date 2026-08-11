package types

import (
	"reflect"
	"testing"
)

func TestConvertUserIncludesOnboarded(t *testing.T) {
	user := ConvertUser(&User{Onboarded: true}, false, "")
	if !user.Onboarded {
		t.Fatal("expected converted user to be onboarded")
	}
}

func TestConvertUserIncludesCategoryPreferences(t *testing.T) {
	preferences := []string{"productivity", "development"}
	user := ConvertUser(&User{CategoryPreferences: preferences}, false, "")

	if !reflect.DeepEqual(user.CategoryPreferences, preferences) {
		t.Fatalf("category preferences = %#v, want %#v", user.CategoryPreferences, preferences)
	}

	preferences[0] = "changed"
	if user.CategoryPreferences[0] != "productivity" {
		t.Fatal("expected converted category preferences to be copied")
	}
}

func TestConvertUserInitializesCategoryPreferences(t *testing.T) {
	user := ConvertUser(&User{}, false, "")
	if user.CategoryPreferences == nil {
		t.Fatal("expected category preferences to be initialized")
	}
}
