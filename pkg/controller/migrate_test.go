package controller

import (
	"testing"

	"github.com/obot-platform/obot/apiclient/types"
	v1 "github.com/obot-platform/obot/pkg/storage/apis/obot.obot.ai/v1"
	storagescheme "github.com/obot-platform/obot/pkg/storage/scheme"
	"github.com/obot-platform/obot/pkg/system"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	ktypes "k8s.io/apimachinery/pkg/types"
	kclient "sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func newFakeClient(t *testing.T, objects ...kclient.Object) kclient.Client {
	t.Helper()
	return fake.NewClientBuilder().
		WithScheme(storagescheme.Scheme).
		WithObjects(objects...).
		Build()
}

func TestMigrateDefaultModelAccessPolicyModels(t *testing.T) {
	ctx := t.Context()

	t.Run("missing default policy is a no-op", func(t *testing.T) {
		client := newFakeClient(t)
		require.NoError(t, migrateDefaultModelAccessPolicyModels(ctx, client))
	})

	t.Run("cleans only the default policy and preserves custom policies", func(t *testing.T) {
		defaultPolicyName := system.ModelAccessPolicyPrefix + "-default"
		subjects := []types.Subject{{
			Type: types.SubjectTypeGroup,
			ID:   "custom-group",
		}}
		client := newFakeClient(t,
			&v1.AccessPolicy{
				ObjectMeta: metav1.ObjectMeta{
					Name:      defaultPolicyName,
					Namespace: system.DefaultNamespace,
				},
				Spec: v1.AccessPolicySpec{
					Manifest: types.AccessPolicyManifest{
						DisplayName: "Customized Default Policy",
						Subjects:    subjects,
						Models: []types.ModelResource{
							{ID: "obot://llm"},
							{ID: "obot://text-embedding"},
							{ID: "m1-custom"},
							{ID: "obot://image-generation"},
							{ID: "obot://llm-mini"},
							{ID: "obot://vision"},
							{ID: "custom-*"},
						},
					},
				},
			},
			&v1.AccessPolicy{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "custom-policy",
					Namespace: system.DefaultNamespace,
				},
				Spec: v1.AccessPolicySpec{
					Manifest: types.AccessPolicyManifest{
						Subjects: subjects,
						Models: []types.ModelResource{
							{ID: "obot://text-embedding"},
							{ID: "obot://llm"},
							{ID: "m1-missing"},
							{ID: "not-a-model"},
							{ID: "obot://unknown"},
						},
					},
				},
			},
			&v1.Model{
				Name:      "m1-custom",
				Namespace: system.DefaultNamespace,
				Spec: v1.ModelSpec{
					Manifest: types.ModelManifest{
						Usage: types.ModelUsageLLM,
					},
				},
			},
		)

		require.NoError(t, migrateDefaultModelAccessPolicyModels(ctx, client))
		require.NoError(t, migrateDefaultModelAccessPolicyModels(ctx, client))

		var defaultPolicy v1.AccessPolicy
		require.NoError(t, client.Get(ctx, kclient.ObjectKey{
			Namespace: system.DefaultNamespace,
			Name:      defaultPolicyName,
		}, &defaultPolicy))
		assert.Equal(t, "Customized Default Policy", defaultPolicy.Spec.Manifest.DisplayName)
		assert.Equal(t, subjects, defaultPolicy.Spec.Manifest.Subjects)
		assert.Equal(t, []types.ModelResource{
			{ID: "obot://llm"},
			{ID: "m1-custom"},
			{ID: "obot://llm-mini"},
			{ID: "custom-*"},
		}, defaultPolicy.Spec.Manifest.Models)

		var customPolicy v1.AccessPolicy
		require.NoError(t, client.Get(ctx, kclient.ObjectKey{
			Namespace: system.DefaultNamespace,
			Name:      "custom-policy",
		}, &customPolicy))
		assert.Equal(t, []types.ModelResource{
			{ID: "obot://text-embedding"},
			{ID: "obot://llm"},
			{ID: "m1-missing"},
			{ID: "not-a-model"},
			{ID: "obot://unknown"},
		}, customPolicy.Spec.Manifest.Models)
	})
}

func TestMigrateAccessPolicies(t *testing.T) {
	ctx := t.Context()
	objects := []kclient.Object{
		&v1.AccessControlRule{
			ObjectMeta: metav1.ObjectMeta{Name: "acr1-one", Namespace: system.DefaultNamespace},
			Spec: v1.AccessControlRuleSpec{
				MCPCatalogID: "mcpc1-test",
				Manifest: types.AccessControlRuleManifest{
					DisplayName: "MCP",
					Subjects:    []types.Subject{{Type: types.SubjectTypeUser, ID: "u1"}},
					Resources:   []types.Resource{{Type: types.ResourceTypeMCPServer, ID: "mcp1-one"}},
				},
			},
		},
		&v1.AccessControlRule{
			ObjectMeta: metav1.ObjectMeta{Name: "acr1-workspace", Namespace: system.DefaultNamespace},
			Spec: v1.AccessControlRuleSpec{
				PowerUserWorkspaceID: "pws1",
				Generated:            true,
				Manifest: types.AccessControlRuleManifest{
					DisplayName: "Workspace MCP",
					Subjects:    []types.Subject{{Type: types.SubjectTypeUser, ID: "u3"}},
					Resources:   []types.Resource{{Type: types.ResourceTypeSelector, ID: "*"}},
				},
			},
		},
		&v1.SkillAccessRule{
			ObjectMeta: metav1.ObjectMeta{Name: "sar1-one", Namespace: system.DefaultNamespace},
			Spec: v1.SkillAccessRuleSpec{Manifest: types.SkillAccessRuleManifest{
				DisplayName: "Skills",
				Subjects:    []types.Subject{{Type: types.SubjectTypeGroup, ID: "g1"}},
				Resources:   []types.SkillResource{{Type: types.SkillResourceTypeSkill, ID: "skill1"}},
			}},
		},
		&v1.ModelAccessPolicy{
			ObjectMeta: metav1.ObjectMeta{Name: "map1-one", Namespace: system.DefaultNamespace},
			Spec: v1.ModelAccessPolicySpec{Manifest: types.ModelAccessPolicyManifest{
				DisplayName: "Models",
				Subjects:    []types.Subject{{Type: types.SubjectTypeSelector, ID: "*"}},
				Models:      []types.ModelResource{{ID: "obot://llm"}},
			}},
		},
		&v1.HostedAgentAccessRule{
			ObjectMeta: metav1.ObjectMeta{Name: "haar1-one", Namespace: system.DefaultNamespace},
			Spec: v1.HostedAgentAccessRuleSpec{Manifest: types.HostedAgentAccessRuleManifest{
				DisplayName: "Agents",
				Subjects:    []types.Subject{{Type: types.SubjectTypeUser, ID: "u2"}},
				Resources:   []types.HostedAgentResource{{Type: types.HostedAgentResourceTypeHostedAgent, ID: "ha1"}},
			}},
		},
	}

	client := newFakeClient(t, objects...)
	require.NoError(t, migrateAccessPolicies(ctx, client))
	require.NoError(t, migrateAccessPolicies(ctx, client), "migration must be restart-safe")

	var list v1.AccessPolicyList
	require.NoError(t, client.List(ctx, &list))
	require.Len(t, list.Items, 5)

	policies := make(map[string]v1.AccessPolicy, len(list.Items))
	for _, policy := range list.Items {
		policies[policy.Name] = policy
		assert.Equal(t, []string{v1.AccessPolicyFinalizer}, policy.Finalizers)
	}
	assert.Equal(t, "mcpc1-test", policies["acr1-one"].Spec.MCPCatalogID)
	assert.Equal(t, objects[0].(*v1.AccessControlRule).Spec.Manifest.Resources, policies["acr1-one"].Spec.Manifest.MCPServers)
	assert.Equal(t, "pws1", policies["acr1-workspace"].Spec.PowerUserWorkspaceID)
	assert.True(t, policies["acr1-workspace"].Spec.Generated)
	assert.Equal(t, objects[2].(*v1.SkillAccessRule).Spec.Manifest.Resources, policies["sar1-one"].Spec.Manifest.Skills)
	assert.Equal(t, objects[3].(*v1.ModelAccessPolicy).Spec.Manifest.Models, policies["map1-one"].Spec.Manifest.Models)
	assert.Equal(t, objects[4].(*v1.HostedAgentAccessRule).Spec.Manifest.Resources, policies["haar1-one"].Spec.Manifest.HostedAgents)

	for _, object := range objects {
		key := kclient.ObjectKeyFromObject(object)
		require.NoError(t, client.Get(ctx, key, object))
		assert.NotEmpty(t, object.GetAnnotations()[accessPolicyMigrationAnnotation])
	}
}

func TestMigratePublishedArtifactVisibility(t *testing.T) {
	ctx := t.Context()

	t.Run("migrates public and private artifacts", func(t *testing.T) {
		client := newFakeClient(t,
			&v1.PublishedArtifact{
				APIVersion: v1.SchemeGroupVersion.String(),
				Kind:       "PublishedArtifact",
				Name:       "public-artifact",
				Namespace:  system.DefaultNamespace,
				Spec: v1.PublishedArtifactSpec{
					LegacyVisibility: "public",
				},
				Status: v1.PublishedArtifactStatus{
					Versions: []types.PublishedArtifactVersionEntry{
						{Version: 1},
						{Version: 2},
					},
				},
			},
			&v1.PublishedArtifact{
				APIVersion: v1.SchemeGroupVersion.String(),
				Kind:       "PublishedArtifact",
				Name:       "private-artifact",
				Namespace:  system.DefaultNamespace,
				Spec: v1.PublishedArtifactSpec{
					LegacyVisibility: "private",
				},
				Status: v1.PublishedArtifactStatus{
					Versions: []types.PublishedArtifactVersionEntry{
						{Version: 1, Subjects: []types.Subject{{Type: types.SubjectTypeSelector, ID: "*"}}},
					},
				},
			},
		)

		require.NoError(t, migratePublishedArtifactVisibility(ctx, client))

		var publicArtifact v1.PublishedArtifact
		require.NoError(t, client.Get(ctx, kclient.ObjectKey{
			Namespace: system.DefaultNamespace,
			Name:      "public-artifact",
		}, &publicArtifact))
		require.Len(t, publicArtifact.Status.Versions, 2)
		for _, version := range publicArtifact.Status.Versions {
			assert.Equal(t, []types.Subject{{
				Type: types.SubjectTypeSelector,
				ID:   "*",
			}}, version.Subjects)
		}
		assert.Empty(t, publicArtifact.Spec.LegacyVisibility)

		var privateArtifact v1.PublishedArtifact
		require.NoError(t, client.Get(ctx, kclient.ObjectKey{
			Namespace: system.DefaultNamespace,
			Name:      "private-artifact",
		}, &privateArtifact))
		require.Len(t, privateArtifact.Status.Versions, 1)
		assert.Nil(t, privateArtifact.Status.Versions[0].Subjects)
		assert.Empty(t, privateArtifact.Spec.LegacyVisibility)
	})

	t.Run("sets no subjects for invalid legacy visibility", func(t *testing.T) {
		client := newFakeClient(t,
			&v1.PublishedArtifact{
				APIVersion: v1.SchemeGroupVersion.String(),
				Kind:       "PublishedArtifact",
				Name:       "bad-artifact",
				Namespace:  system.DefaultNamespace,
				Spec: v1.PublishedArtifactSpec{
					LegacyVisibility: "friends-only",
				},
				Status: v1.PublishedArtifactStatus{
					Versions: []types.PublishedArtifactVersionEntry{
						{Version: 1},
					},
				},
			},
		)

		err := migratePublishedArtifactVisibility(ctx, client)
		require.NoError(t, err)

		var publicArtifact v1.PublishedArtifact
		require.NoError(t, client.Get(ctx, kclient.ObjectKey{
			Namespace: system.DefaultNamespace,
			Name:      "bad-artifact",
		}, &publicArtifact))
		assert.Empty(t, publicArtifact.Status.Versions[0].Subjects)
	})
}

func TestMigrateAuditLogExportSourceTypes(t *testing.T) {
	ctx := t.Context()
	client := newFakeClient(t,
		&v1.ScheduledAuditLogExport{
			Name: "legacy-with-filters", Namespace: system.DefaultNamespace,
			Spec: v1.ScheduledAuditLogExportSpec{
				Filters: &types.AuditLogExportFilters{MCPIDs: []string{"mcp-1"}},
			},
		},
		&v1.ScheduledAuditLogExport{
			Name: "legacy-without-filters", Namespace: system.DefaultNamespace,
		},
		&v1.ScheduledAuditLogExport{
			Name: "already-explicit", Namespace: system.DefaultNamespace,
			Spec: v1.ScheduledAuditLogExportSpec{
				Filters: &types.AuditLogExportFilters{SourceTypes: []types.AuditLogSourceType{types.AuditLogSourceTypeMCP}},
			},
		},
		&v1.ScheduledAuditLogExport{
			Name: "local-agent", Namespace: system.DefaultNamespace,
			Spec: v1.ScheduledAuditLogExportSpec{
				Type:    types.AuditLogTypeMCP,
				Filters: &types.AuditLogExportFilters{SourceTypes: []types.AuditLogSourceType{types.AuditLogSourceTypeLocalAgentToolCall}},
			},
		},
		&v1.ScheduledAuditLogExport{
			Name: "llm", Namespace: system.DefaultNamespace,
			Spec: v1.ScheduledAuditLogExportSpec{Type: types.AuditLogTypeLLM},
		},
	)

	require.NoError(t, migrateAuditLogExportSourceTypes(ctx, client))

	var migrated v1.ScheduledAuditLogExport
	require.NoError(t, client.Get(ctx, kclient.ObjectKey{Name: "legacy-with-filters", Namespace: system.DefaultNamespace}, &migrated))
	require.NotNil(t, migrated.Spec.Filters)
	assert.Equal(t, []types.AuditLogSourceType{types.AuditLogSourceTypeMCP}, migrated.Spec.Filters.SourceTypes)
	assert.Equal(t, []string{"mcp-1"}, migrated.Spec.Filters.MCPIDs)

	require.NoError(t, client.Get(ctx, kclient.ObjectKey{Name: "legacy-without-filters", Namespace: system.DefaultNamespace}, &migrated))
	require.NotNil(t, migrated.Spec.Filters)
	assert.Equal(t, []types.AuditLogSourceType{types.AuditLogSourceTypeMCP}, migrated.Spec.Filters.SourceTypes)

	for _, name := range []string{"already-explicit", "local-agent", "llm"} {
		var unchanged v1.ScheduledAuditLogExport
		require.NoError(t, client.Get(ctx, kclient.ObjectKey{Name: name, Namespace: system.DefaultNamespace}, &unchanged))
		switch name {
		case "already-explicit":
			assert.Equal(t, []types.AuditLogSourceType{types.AuditLogSourceTypeMCP}, unchanged.Spec.Filters.SourceTypes)
		case "local-agent":
			assert.Equal(t, []types.AuditLogSourceType{types.AuditLogSourceTypeLocalAgentToolCall}, unchanged.Spec.Filters.SourceTypes)
		default:
			assert.Nil(t, unchanged.Spec.Filters)
		}
	}
}

func TestDeleteToolReferenceOwnedModels(t *testing.T) {
	ctx := t.Context()
	client := newFakeClient(t,
		&v1.Model{
			APIVersion: v1.SchemeGroupVersion.String(),
			Kind:       "Model",
			Name:       "tool-reference-owned",
			Namespace:  system.DefaultNamespace,
			OwnerReferences: []metav1.OwnerReference{
				{
					APIVersion: v1.SchemeGroupVersion.String(),
					Kind:       "ToolReference",
					Name:       "tool",
					UID:        ktypes.UID("tool-uid"),
				},
			},
		},
		&v1.Model{
			APIVersion: v1.SchemeGroupVersion.String(),
			Kind:       "Model",
			Name:       "model-provider-owned",
			Namespace:  system.DefaultNamespace,
			OwnerReferences: []metav1.OwnerReference{
				{
					APIVersion: v1.SchemeGroupVersion.String(),
					Kind:       "ModelProvider",
					Name:       "provider",
					UID:        ktypes.UID("provider-uid"),
				},
			},
		},
		&v1.Model{
			APIVersion: v1.SchemeGroupVersion.String(),
			Kind:       "Model",
			Name:       "unowned",
			Namespace:  system.DefaultNamespace,
		},
	)

	require.NoError(t, deleteToolReferenceOwnedModels(ctx, client))

	var model v1.Model
	err := client.Get(ctx, kclient.ObjectKey{
		Namespace: system.DefaultNamespace,
		Name:      "tool-reference-owned",
	}, &model)
	require.True(t, apierrors.IsNotFound(err))

	require.NoError(t, client.Get(ctx, kclient.ObjectKey{
		Namespace: system.DefaultNamespace,
		Name:      "model-provider-owned",
	}, &model))
	require.NoError(t, client.Get(ctx, kclient.ObjectKey{
		Namespace: system.DefaultNamespace,
		Name:      "unowned",
	}, &model))
}

func TestExtractAndClearMCPServerConfigValues(t *testing.T) {
	manifest := types.MCPServerManifest{
		Env: []types.MCPEnv{
			{
				Key:   "TOKEN",
				Value: "secret-token",
			},
			{
				Key: "EMPTY",
			},
			{
				Value: "missing-key",
			},
		},
		RemoteConfig: &types.RemoteRuntimeConfig{
			Headers: []types.MCPHeader{
				{
					Key:   "Authorization",
					Value: "Bearer secret",
				},
				{
					Key: "X-Empty",
				},
			},
		},
	}

	values, changed := extractAndClearMCPServerConfigValues(&manifest)

	assert.True(t, changed)
	assert.Equal(t, map[string]string{
		"TOKEN":         "secret-token",
		"Authorization": "Bearer secret",
	}, values)
	assert.Empty(t, manifest.Env[0].Value)
	assert.Empty(t, manifest.Env[1].Value)
	assert.Empty(t, manifest.Env[2].Value)
	assert.Empty(t, manifest.RemoteConfig.Headers[0].Value)
	assert.Empty(t, manifest.RemoteConfig.Headers[1].Value)
}

func TestExtractAndClearMCPServerConfigValuesNoValues(t *testing.T) {
	manifest := types.MCPServerManifest{
		Env: []types.MCPEnv{
			{
				Key: "TOKEN",
			},
		},
	}

	values, changed := extractAndClearMCPServerConfigValues(&manifest)

	assert.False(t, changed)
	assert.Empty(t, values)
}

func TestMCPServerCredentialContext(t *testing.T) {
	assert.Equal(t, "default-server-1", mcpServerCredentialContext(v1.MCPServer{
		Name: "server-1",
		Spec: v1.MCPServerSpec{
			MCPCatalogID: "default",
		},
	}))

	assert.Equal(t, "workspace-1-server-2", mcpServerCredentialContext(v1.MCPServer{
		Name: "server-2",
		Spec: v1.MCPServerSpec{
			PowerUserWorkspaceID: "workspace-1",
		},
	}))

	assert.Empty(t, mcpServerCredentialContext(v1.MCPServer{
		Name: "server-3",
	}))
}
