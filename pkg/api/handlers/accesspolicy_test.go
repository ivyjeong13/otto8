package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/obot-platform/obot/apiclient/types"
	"github.com/obot-platform/obot/pkg/api"
	"github.com/obot-platform/obot/pkg/storage"
	v1 "github.com/obot-platform/obot/pkg/storage/apis/obot.obot.ai/v1"
	storagescheme "github.com/obot-platform/obot/pkg/storage/scheme"
	"github.com/obot-platform/obot/pkg/system"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestReadAndValidateAccessPolicyInput(t *testing.T) {
	storageClient := storage.Client(fake.NewClientBuilder().
		WithScheme(storagescheme.Scheme).
		WithObjects(&v1.MCPCatalog{ObjectMeta: metav1.ObjectMeta{
			Name:      system.DefaultCatalog,
			Namespace: system.DefaultNamespace,
		}}).
		Build())

	tests := []struct {
		name              string
		body              string
		workspaceID       string
		existingCatalogID string
		wantCatalogID     string
		wantErr           string
	}{
		{
			name: "accepts a mixed global policy",
			body: `{
				"displayName":"Engineering",
				"mcpCatalogID":"` + system.DefaultCatalog + `",
				"subjects":[{"type":"group","id":"engineering"}],
				"mcpServers":[{"type":"selector","id":"*"}],
				"skills":[{"type":"selector","id":"*"}],
				"models":[{"id":"obot://llm"}],
				"hostedAgents":[{"type":"selector","id":"*"}]
			}`,
			wantCatalogID: system.DefaultCatalog,
		},
		{
			name: "inherits an existing catalog on update",
			body: `{
				"displayName":"Existing",
				"subjects":[{"type":"user","id":"u1"}],
				"mcpServers":[{"type":"selector","id":"*"}]
			}`,
			existingCatalogID: system.DefaultCatalog,
			wantCatalogID:     system.DefaultCatalog,
		},
		{
			name: "rejects non-MCP workspace resources",
			body: `{
				"displayName":"Workspace",
				"subjects":[{"type":"user","id":"u1"}],
				"skills":[{"type":"selector","id":"*"}]
			}`,
			workspaceID: "pws1",
			wantErr:     "workspace access policies may only contain MCP servers",
		},
		{
			name: "requires a catalog for global MCP resources",
			body: `{
				"displayName":"Global",
				"subjects":[{"type":"user","id":"u1"}],
				"mcpServers":[{"type":"selector","id":"*"}]
			}`,
			wantErr: "mcpCatalogID is required",
		},
		{
			name: "rejects empty policies",
			body: `{
				"displayName":"Empty",
				"subjects":[{"type":"user","id":"u1"}]
			}`,
			wantErr: "at least one resource is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := api.Context{
				ResponseWriter: httptest.NewRecorder(),
				Request: httptest.NewRequest(
					http.MethodPost,
					"/api/access-policies",
					strings.NewReader(tt.body),
				),
				Storage: storageClient,
			}

			input, err := readAndValidateAccessPolicyInput(
				req,
				tt.workspaceID,
				tt.existingCatalogID,
			)
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.wantCatalogID, input.MCPCatalogID)
		})
	}
}

func TestValidatePolicyBelongsToScope(t *testing.T) {
	workspacePolicy := v1.AccessPolicy{Spec: v1.AccessPolicySpec{PowerUserWorkspaceID: "pws1"}}
	globalPolicy := v1.AccessPolicy{}

	assert.NoError(t, validatePolicyBelongsToScope(workspacePolicy, "pws1"))
	assert.NoError(t, validatePolicyBelongsToScope(globalPolicy, ""))
	assert.Error(t, validatePolicyBelongsToScope(workspacePolicy, ""))
	assert.Error(t, validatePolicyBelongsToScope(globalPolicy, "pws1"))
}

func TestConvertAccessPolicy(t *testing.T) {
	policy := v1.AccessPolicy{
		ObjectMeta: metav1.ObjectMeta{Name: "ap1-test"},
		Spec: v1.AccessPolicySpec{Manifest: types.AccessPolicyManifest{
			DisplayName: "Test",
		}},
	}

	result := convertAccessPolicy(policy, "u1")
	assert.Equal(t, "ap1-test", result.ID)
	assert.Equal(t, "Test", result.DisplayName)
	assert.Equal(t, "u1", result.PowerUserID)
}
