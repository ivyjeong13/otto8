package controller

import (
	"context"
	"fmt"
	"log/slog"
	"maps"

	"github.com/obot-platform/obot/apiclient/types"
	"github.com/obot-platform/obot/pkg/modelaccesspolicy"
	v1 "github.com/obot-platform/obot/pkg/storage/apis/obot.obot.ai/v1"
	"github.com/obot-platform/obot/pkg/system"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	kclient "sigs.k8s.io/controller-runtime/pkg/client"
)

const accessPolicyMigrationAnnotation = "obot.obot.ai/migrated-to-access-policy"

func migrateAccessPolicies(ctx context.Context, client kclient.Client) error {
	if err := migrateAccessControlRules(ctx, client); err != nil {
		return err
	}
	if err := migrateSkillAccessRules(ctx, client); err != nil {
		return err
	}
	if err := migrateModelAccessPolicies(ctx, client); err != nil {
		return err
	}
	if err := migrateHostedAgentAccessRules(ctx, client); err != nil {
		return err
	}

	return nil
}

func migrateAccessControlRules(ctx context.Context, client kclient.Client) error {
	var list v1.AccessControlRuleList
	if err := client.List(ctx, &list); err != nil {
		return fmt.Errorf("failed to list access control rules: %w", err)
	}

	for i := range list.Items {
		source := &list.Items[i]
		if source.Annotations[accessPolicyMigrationAnnotation] != "" {
			continue
		}

		target := newMigratedAccessPolicy(
			source.ObjectMeta,
			source.Spec.Manifest.DisplayName,
			source.Spec.Manifest.Subjects,
		)
		target.Spec.MCPCatalogID = source.Spec.MCPCatalogID
		target.Spec.PowerUserWorkspaceID = source.Spec.PowerUserWorkspaceID
		if target.Spec.MCPCatalogID == "" && target.Spec.PowerUserWorkspaceID == "" {
			target.Spec.MCPCatalogID = system.DefaultCatalog
		}
		target.Spec.Generated = source.Spec.Generated
		target.Spec.Manifest.MCPServers = source.Spec.Manifest.Resources
		if err := createMigratedAccessPolicy(ctx, client, target); err != nil {
			return fmt.Errorf("failed to migrate access control rule %q: %w", source.Name, err)
		}
		if err := markAccessPolicyMigrated(ctx, client, source); err != nil {
			return fmt.Errorf("failed to mark access control rule %q migrated: %w", source.Name, err)
		}
	}

	return nil
}

func migrateSkillAccessRules(ctx context.Context, client kclient.Client) error {
	var list v1.SkillAccessRuleList
	if err := client.List(ctx, &list); err != nil {
		return fmt.Errorf("failed to list skill access rules: %w", err)
	}

	for i := range list.Items {
		source := &list.Items[i]
		if source.Annotations[accessPolicyMigrationAnnotation] != "" {
			continue
		}

		target := newMigratedAccessPolicy(
			source.ObjectMeta,
			source.Spec.Manifest.DisplayName,
			source.Spec.Manifest.Subjects,
		)
		target.Spec.Manifest.Skills = source.Spec.Manifest.Resources
		if err := createMigratedAccessPolicy(ctx, client, target); err != nil {
			return fmt.Errorf("failed to migrate skill access rule %q: %w", source.Name, err)
		}
		if err := markAccessPolicyMigrated(ctx, client, source); err != nil {
			return fmt.Errorf("failed to mark skill access rule %q migrated: %w", source.Name, err)
		}
	}

	return nil
}

func migrateModelAccessPolicies(ctx context.Context, client kclient.Client) error {
	var list v1.ModelAccessPolicyList
	if err := client.List(ctx, &list); err != nil {
		return fmt.Errorf("failed to list model access policies: %w", err)
	}

	for i := range list.Items {
		source := &list.Items[i]
		if source.Annotations[accessPolicyMigrationAnnotation] != "" {
			continue
		}

		target := newMigratedAccessPolicy(
			source.ObjectMeta,
			source.Spec.Manifest.DisplayName,
			source.Spec.Manifest.Subjects,
		)
		target.Spec.Manifest.Models = source.Spec.Manifest.Models
		if err := createMigratedAccessPolicy(ctx, client, target); err != nil {
			return fmt.Errorf("failed to migrate model access policy %q: %w", source.Name, err)
		}
		if err := markAccessPolicyMigrated(ctx, client, source); err != nil {
			return fmt.Errorf("failed to mark model access policy %q migrated: %w", source.Name, err)
		}
	}

	return nil
}

func migrateHostedAgentAccessRules(ctx context.Context, client kclient.Client) error {
	var list v1.HostedAgentAccessRuleList
	if err := client.List(ctx, &list); err != nil {
		return fmt.Errorf("failed to list hosted agent access rules: %w", err)
	}

	for i := range list.Items {
		source := &list.Items[i]
		if source.Annotations[accessPolicyMigrationAnnotation] != "" {
			continue
		}

		target := newMigratedAccessPolicy(
			source.ObjectMeta,
			source.Spec.Manifest.DisplayName,
			source.Spec.Manifest.Subjects,
		)
		target.Spec.Manifest.HostedAgents = source.Spec.Manifest.Resources
		if err := createMigratedAccessPolicy(ctx, client, target); err != nil {
			return fmt.Errorf("failed to migrate hosted agent access rule %q: %w", source.Name, err)
		}
		if err := markAccessPolicyMigrated(ctx, client, source); err != nil {
			return fmt.Errorf("failed to mark hosted agent access rule %q migrated: %w", source.Name, err)
		}
	}

	return nil
}

func newMigratedAccessPolicy(
	metadata metav1.ObjectMeta,
	displayName string,
	subjects []types.Subject,
) *v1.AccessPolicy {
	return &v1.AccessPolicy{
		ObjectMeta: metav1.ObjectMeta{
			Name:        metadata.Name,
			Namespace:   metadata.Namespace,
			Labels:      maps.Clone(metadata.Labels),
			Annotations: maps.Clone(metadata.Annotations),
			Finalizers:  []string{v1.AccessPolicyFinalizer},
		},
		Spec: v1.AccessPolicySpec{
			Manifest: types.AccessPolicyManifest{
				DisplayName:  displayName,
				Subjects:     subjects,
				MCPServers:   []types.Resource{},
				Skills:       []types.SkillResource{},
				Models:       []types.ModelResource{},
				HostedAgents: []types.HostedAgentResource{},
			},
		},
	}
}

func createMigratedAccessPolicy(
	ctx context.Context,
	client kclient.Client,
	policy *v1.AccessPolicy,
) error {
	if err := client.Create(ctx, policy); err != nil && !apierrors.IsAlreadyExists(err) {
		return fmt.Errorf("failed to create access policy: %w", err)
	}
	return nil
}

func markAccessPolicyMigrated(
	ctx context.Context,
	client kclient.Client,
	source kclient.Object,
) error {
	annotations := maps.Clone(source.GetAnnotations())
	if annotations == nil {
		annotations = map[string]string{}
	}
	annotations[accessPolicyMigrationAnnotation] = source.GetName()
	source.SetAnnotations(annotations)
	if err := client.Update(ctx, source); err != nil {
		return fmt.Errorf("failed to update migration annotation: %w", err)
	}
	return nil
}

func migrateDefaultModelAccessPolicyModels(ctx context.Context, client kclient.Client) error {
	var policy v1.AccessPolicy
	for _, name := range []string{
		system.ModelAccessPolicyPrefix + "-default",
		system.AccessPolicyPrefix + "-default-models",
	} {
		err := client.Get(ctx, kclient.ObjectKey{
			Namespace: system.DefaultNamespace,
			Name:      name,
		}, &policy)
		if err == nil {
			break
		}
		if !apierrors.IsNotFound(err) {
			return fmt.Errorf("failed to get default model access policy: %w", err)
		}
	}
	if policy.Name == "" {
		return nil
	}

	models := make([]types.ModelResource, 0, len(policy.Spec.Manifest.Models))
	for _, model := range policy.Spec.Manifest.Models {
		err := modelaccesspolicy.ValidateModelResource(
			ctx,
			client,
			policy.Namespace,
			model,
		)
		if err == nil {
			models = append(models, model)
			continue
		}
		if modelaccesspolicy.IsInvalidModelResource(err) || apierrors.IsNotFound(err) {
			continue
		}
		return fmt.Errorf("failed to validate default model access policy: %w", err)
	}

	if len(models) == len(policy.Spec.Manifest.Models) {
		return nil
	}

	policy.Spec.Manifest.Models = models
	if err := client.Update(ctx, &policy); err != nil {
		return fmt.Errorf("failed to update default model access policy: %w", err)
	}

	return nil
}

// migrateAuditLogExportSourceTypes makes the implicit MCP source selection on legacy
// scheduled MCP audit-log exports explicit. The export UI needs an explicit source selection
// when editing a schedule, while old schedules predate sourceTypes entirely.
func migrateAuditLogExportSourceTypes(ctx context.Context, client kclient.Client) error {
	var schedules v1.ScheduledAuditLogExportList
	if err := client.List(ctx, &schedules); err != nil {
		return err
	}

	for i := range schedules.Items {
		schedule := &schedules.Items[i]
		if schedule.Spec.EffectiveType() != types.AuditLogTypeMCP {
			continue
		}
		if schedule.Spec.Filters != nil && len(schedule.Spec.Filters.SourceTypes) > 0 {
			continue
		}

		if schedule.Spec.Filters == nil {
			schedule.Spec.Filters = &types.AuditLogExportFilters{}
		}
		schedule.Spec.Filters.SourceTypes = []types.AuditLogSourceType{types.AuditLogSourceTypeMCP}
		if err := client.Update(ctx, schedule); err != nil {
			return fmt.Errorf("failed to migrate scheduled audit-log export %s: %w", schedule.Name, err)
		}
	}

	return nil
}

func migratePublishedArtifactVisibility(ctx context.Context, client kclient.Client) error {
	var artifacts v1.PublishedArtifactList
	if err := client.List(ctx, &artifacts); err != nil {
		return err
	}

	for i := range artifacts.Items {
		artifact := &artifacts.Items[i]
		if artifact.Spec.LegacyVisibility == "" {
			continue
		}

		var subjects []types.Subject
		switch artifact.Spec.LegacyVisibility {
		case "public":
			subjects = []types.Subject{{
				Type: types.SubjectTypeSelector,
				ID:   "*",
			}}
		case "private":
			subjects = nil
		default:
			slog.Error("invalid legacy visibility for published artifact", "visibility", artifact.Spec.LegacyVisibility, "artifact", artifact.Name)
			// Make it private to be safe
			subjects = nil
		}

		for j := range artifact.Status.Versions {
			artifact.Status.Versions[j].Subjects = subjects
		}

		artifact.Spec.LegacyVisibility = ""
		if err := client.Update(ctx, artifact); err != nil {
			return err
		}
	}

	return nil
}

func deleteToolReferenceOwnedModels(ctx context.Context, client kclient.Client) error {
	var models v1.ModelList
	if err := client.List(ctx, &models); err != nil {
		return err
	}

	for i := range models.Items {
		model := &models.Items[i]
		for _, owner := range model.OwnerReferences {
			if owner.Kind != "ToolReference" {
				continue
			}

			if err := kclient.IgnoreNotFound(client.Delete(ctx, model)); err != nil {
				return fmt.Errorf("failed to delete ToolReference-owned model %s/%s: %w", model.Namespace, model.Name, err)
			}
			break
		}
	}

	return nil
}

func mcpServerCredentialContext(server v1.MCPServer) string {
	switch {
	case server.Spec.MCPCatalogID != "":
		return fmt.Sprintf("%s-%s", server.Spec.MCPCatalogID, server.Name)
	case server.Spec.PowerUserWorkspaceID != "":
		return fmt.Sprintf("%s-%s", server.Spec.PowerUserWorkspaceID, server.Name)
	default:
		return ""
	}
}

func extractAndClearMCPServerConfigValues(manifest *types.MCPServerManifest) (map[string]string, bool) {
	configValues := make(map[string]string)
	var changed bool

	for i := range manifest.Env {
		if manifest.Env[i].Value != "" {
			if manifest.Env[i].Key != "" {
				configValues[manifest.Env[i].Key] = manifest.Env[i].Value
			}
			manifest.Env[i].Value = ""
			changed = true
		}
	}

	if manifest.RemoteConfig != nil {
		for i := range manifest.RemoteConfig.Headers {
			if manifest.RemoteConfig.Headers[i].Value != "" {
				if manifest.RemoteConfig.Headers[i].Key != "" {
					configValues[manifest.RemoteConfig.Headers[i].Key] = manifest.RemoteConfig.Headers[i].Value
				}
				manifest.RemoteConfig.Headers[i].Value = ""
				changed = true
			}
		}
	}

	return configValues, changed
}
