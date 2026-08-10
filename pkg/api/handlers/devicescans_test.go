package handlers

import (
	"net/url"
	"testing"
)

func TestParseDeviceScanListOptsSort(t *testing.T) {
	t.Parallel()

	opts := parseDeviceScanListOpts(url.Values{
		"sort_by":    []string{"mcp_count"},
		"sort_order": []string{"asc"},
	})

	if opts.SortBy != "mcp_count" {
		t.Errorf("SortBy: got %q, want %q", opts.SortBy, "mcp_count")
	}
	if opts.SortOrder != "asc" {
		t.Errorf("SortOrder: got %q, want %q", opts.SortOrder, "asc")
	}
}
