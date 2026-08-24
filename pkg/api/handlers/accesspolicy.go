package handlers

import (
	"fmt"

	"github.com/obot-platform/obot/apiclient/types"
	"github.com/obot-platform/obot/pkg/api"
	"github.com/obot-platform/obot/pkg/modelaccesspolicy"
	v1 "github.com/obot-platform/obot/pkg/storage/apis/obot.obot.ai/v1"
	"github.com/obot-platform/obot/pkg/system"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type AccessPolicyHandler struct{}

func NewAccessPolicyHandler() *AccessPolicyHandler {
	return nil
}

func (*AccessPolicyHandler) List(req api.Context) error {
	workspaceID := req.PathValue("workspace_id")
	powerUserID, err := validateAccessPolicyScope(req, workspaceID)
	if err != nil {
		return err
	}

	var list v1.AccessPolicyList
	if err := req.List(&list); err != nil {
		return fmt.Errorf("failed to list access policies: %w", err)
	}

	items := make([]types.AccessPolicy, 0, len(list.Items))
	for _, policy := range list.Items {
		if workspaceID == "" && policy.Spec.PowerUserWorkspaceID != "" {
			continue
		}
		if workspaceID != "" && policy.Spec.PowerUserWorkspaceID != workspaceID {
			continue
		}
		items = append(items, convertAccessPolicy(policy, powerUserID))
	}

	return req.Write(types.AccessPolicyList{Items: items})
}

func (*AccessPolicyHandler) Get(req api.Context) error {
	workspaceID := req.PathValue("workspace_id")
	powerUserID, err := validateAccessPolicyScope(req, workspaceID)
	if err != nil {
		return err
	}

	var policy v1.AccessPolicy
	if err := req.Get(&policy, req.PathValue("id")); err != nil {
		return fmt.Errorf("failed to get access policy: %w", err)
	}
	if err := validatePolicyBelongsToScope(policy, workspaceID); err != nil {
		return err
	}

	return req.Write(convertAccessPolicy(policy, powerUserID))
}

func (*AccessPolicyHandler) Create(req api.Context) error {
	workspaceID := req.PathValue("workspace_id")
	powerUserID, err := validateAccessPolicyScope(req, workspaceID)
	if err != nil {
		return err
	}

	input, err := readAndValidateAccessPolicyInput(req, workspaceID, "")
	if err != nil {
		return err
	}

	policy := v1.AccessPolicy{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: system.AccessPolicyPrefix,
			Namespace:    req.Namespace(),
			Finalizers:   []string{v1.AccessPolicyFinalizer},
		},
		Spec: v1.AccessPolicySpec{
			MCPCatalogID:         input.MCPCatalogID,
			PowerUserWorkspaceID: workspaceID,
			Manifest:             input.AccessPolicyManifest,
		},
	}
	if err := req.Create(&policy); err != nil {
		return fmt.Errorf("failed to create access policy: %w", err)
	}

	return req.WriteCreated(convertAccessPolicy(policy, powerUserID))
}

func (*AccessPolicyHandler) Update(req api.Context) error {
	workspaceID := req.PathValue("workspace_id")
	powerUserID, err := validateAccessPolicyScope(req, workspaceID)
	if err != nil {
		return err
	}

	var policy v1.AccessPolicy
	if err := req.Get(&policy, req.PathValue("id")); err != nil {
		return fmt.Errorf("failed to get access policy: %w", err)
	}
	if err := validatePolicyBelongsToScope(policy, workspaceID); err != nil {
		return err
	}
	if policy.Spec.Generated {
		return types.NewErrForbidden("generated access policies cannot be modified")
	}

	input, err := readAndValidateAccessPolicyInput(req, workspaceID, policy.Spec.MCPCatalogID)
	if err != nil {
		return err
	}
	policy.Spec.MCPCatalogID = input.MCPCatalogID
	policy.Spec.Manifest = input.AccessPolicyManifest
	if err := req.Update(&policy); err != nil {
		return fmt.Errorf("failed to update access policy: %w", err)
	}

	return req.Write(convertAccessPolicy(policy, powerUserID))
}

func (*AccessPolicyHandler) Delete(req api.Context) error {
	workspaceID := req.PathValue("workspace_id")
	if _, err := validateAccessPolicyScope(req, workspaceID); err != nil {
		return err
	}

	var policy v1.AccessPolicy
	if err := req.Get(&policy, req.PathValue("id")); err != nil {
		return fmt.Errorf("failed to get access policy: %w", err)
	}
	if err := validatePolicyBelongsToScope(policy, workspaceID); err != nil {
		return err
	}
	if policy.Spec.Generated {
		return types.NewErrForbidden("generated access policies cannot be deleted")
	}

	return req.Delete(&policy)
}

func validateAccessPolicyScope(req api.Context, workspaceID string) (string, error) {
	if workspaceID == "" {
		return "", nil
	}

	var workspace v1.PowerUserWorkspace
	if err := req.Get(&workspace, workspaceID); err != nil {
		return "", types.NewErrBadRequest("workspace not found: %v", err)
	}
	return workspace.Spec.UserID, nil
}

func validatePolicyBelongsToScope(policy v1.AccessPolicy, workspaceID string) error {
	if workspaceID == "" && policy.Spec.PowerUserWorkspaceID != "" {
		return types.NewErrBadRequest("access policy belongs to workspace %s", policy.Spec.PowerUserWorkspaceID)
	}
	if workspaceID != "" && policy.Spec.PowerUserWorkspaceID != workspaceID {
		return types.NewErrBadRequest("access policy does not belong to workspace %s", workspaceID)
	}
	return nil
}

func readAndValidateAccessPolicyInput(
	req api.Context,
	workspaceID string,
	existingCatalogID string,
) (types.AccessPolicyInput, error) {
	var input types.AccessPolicyInput
	if err := req.Read(&input); err != nil {
		return input, types.NewErrBadRequest("failed to read access policy: %v", err)
	}
	if err := input.AccessPolicyManifest.Validate(); err != nil {
		return input, types.NewErrBadRequest("invalid access policy: %v", err)
	}

	if workspaceID != "" {
		if len(input.Skills) > 0 || len(input.Models) > 0 || len(input.HostedAgents) > 0 {
			return input, types.NewErrBadRequest("workspace access policies may only contain MCP servers")
		}
		if input.MCPCatalogID != "" {
			return input, types.NewErrBadRequest("workspace access policies cannot set mcpCatalogID")
		}
		if err := validateResourcesInWorkspace(req, input.MCPServers, workspaceID); err != nil {
			return input, err
		}
		return input, nil
	}

	if existingCatalogID != "" {
		if input.MCPCatalogID == "" {
			input.MCPCatalogID = existingCatalogID
		} else if input.MCPCatalogID != existingCatalogID {
			return input, types.NewErrBadRequest("mcpCatalogID cannot be changed")
		}
	}
	if len(input.MCPServers) > 0 && input.MCPCatalogID == "" {
		return input, types.NewErrBadRequest("mcpCatalogID is required when MCP servers are present")
	}
	if input.MCPCatalogID != "" {
		if err := req.Get(&v1.MCPCatalog{}, input.MCPCatalogID); err != nil {
			return input, types.NewErrBadRequest("catalog not found: %v", err)
		}
		if err := validateResourcesInCatalog(req, input.MCPServers, input.MCPCatalogID); err != nil {
			return input, err
		}
	}
	if err := validateReferencedResources(req, input.Skills); err != nil {
		return input, err
	}
	if err := modelaccesspolicy.ValidateModelResources(
		req.Context(),
		req.Storage,
		req.Namespace(),
		input.Models,
	); err != nil {
		return input, types.NewErrBadRequest("invalid model resources: %v", err)
	}
	if err := validateReferencedHostedAgentResources(req, input.HostedAgents); err != nil {
		return input, err
	}

	return input, nil
}

func convertAccessPolicy(policy v1.AccessPolicy, powerUserID string) types.AccessPolicy {
	return types.AccessPolicy{
		Metadata:             MetadataFrom(&policy),
		MCPCatalogID:         policy.Spec.MCPCatalogID,
		PowerUserWorkspaceID: policy.Spec.PowerUserWorkspaceID,
		PowerUserID:          powerUserID,
		Generated:            policy.Spec.Generated,
		AccessPolicyManifest: policy.Spec.Manifest,
	}
}
