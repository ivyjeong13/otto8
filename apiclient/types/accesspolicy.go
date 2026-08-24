package types

import (
	"fmt"
	"strings"
)

// AccessPolicy grants a set of subjects access to one or more resource families.
type AccessPolicy struct {
	Metadata             `json:",inline"`
	MCPCatalogID         string `json:"mcpCatalogID,omitempty"`
	PowerUserWorkspaceID string `json:"powerUserWorkspaceID,omitempty"`
	PowerUserID          string `json:"powerUserID,omitempty"`
	Generated            bool   `json:"generated,omitempty"`
	AccessPolicyManifest `json:",inline"`
}

// AccessPolicyManifest is the editable portion of an access policy.
type AccessPolicyManifest struct {
	DisplayName  string                `json:"displayName,omitempty"`
	Subjects     []Subject             `json:"subjects,omitempty"`
	MCPServers   []Resource            `json:"mcpServers,omitempty"`
	Skills       []SkillResource       `json:"skills,omitempty"`
	Models       []ModelResource       `json:"models,omitempty"`
	HostedAgents []HostedAgentResource `json:"hostedAgents,omitempty"`
}

// AccessPolicyInput carries editable policy fields and the optional global MCP catalog scope.
type AccessPolicyInput struct {
	AccessPolicyManifest `json:",inline"`
	MCPCatalogID         string `json:"mcpCatalogID,omitempty"`
}

// Validate validates the shared subjects and every populated resource family.
func (a AccessPolicyManifest) Validate() error {
	if strings.TrimSpace(a.DisplayName) == "" {
		return fmt.Errorf("display name is required")
	}
	if err := validateAccessPolicySubjects(a.Subjects); err != nil {
		return err
	}

	resourceCount := len(a.MCPServers) + len(a.Skills) + len(a.Models) + len(a.HostedAgents)
	if resourceCount == 0 {
		return fmt.Errorf("at least one resource is required")
	}

	if err := validateMCPResources(a.MCPServers); err != nil {
		return err
	}
	if err := validateSkillResources(a.Skills); err != nil {
		return err
	}
	if err := validateModelResources(a.Models); err != nil {
		return err
	}
	if err := validateHostedAgentResources(a.HostedAgents); err != nil {
		return err
	}

	return nil
}

func validateAccessPolicySubjects(subjects []Subject) error {
	if len(subjects) == 0 {
		return fmt.Errorf("at least one subject is required")
	}

	seen := make(map[Subject]struct{}, len(subjects))
	for _, subject := range subjects {
		if err := subject.Validate(); err != nil {
			return fmt.Errorf("invalid subject: %w", err)
		}
		if subject.Type == SubjectTypeSelector && len(subjects) > 1 {
			return fmt.Errorf("wildcard subject (*) must be the only subject")
		}
		if _, ok := seen[subject]; ok {
			return fmt.Errorf("duplicate subject: %s/%s", subject.Type, subject.ID)
		}
		seen[subject] = struct{}{}
	}

	return nil
}

func validateMCPResources(resources []Resource) error {
	seen := make(map[Resource]struct{}, len(resources))
	for _, resource := range resources {
		if err := resource.Validate(); err != nil {
			return fmt.Errorf("invalid MCP resource: %w", err)
		}
		if resource.Type == ResourceTypeSelector && len(resources) > 1 {
			return fmt.Errorf("wildcard MCP resource (*) must be the only MCP resource")
		}
		if _, ok := seen[resource]; ok {
			return fmt.Errorf("duplicate MCP resource: %s/%s", resource.Type, resource.ID)
		}
		seen[resource] = struct{}{}
	}

	return nil
}

func validateSkillResources(resources []SkillResource) error {
	seen := make(map[SkillResource]struct{}, len(resources))
	for _, resource := range resources {
		if err := resource.Validate(); err != nil {
			return fmt.Errorf("invalid skill resource: %w", err)
		}
		if resource.IsWildcard() && len(resources) > 1 {
			return fmt.Errorf("wildcard skill resource (*) must be the only skill resource")
		}
		if _, ok := seen[resource]; ok {
			return fmt.Errorf("duplicate skill resource: %s/%s", resource.Type, resource.ID)
		}
		seen[resource] = struct{}{}
	}

	return nil
}

func validateModelResources(resources []ModelResource) error {
	seen := make(map[ModelResource]struct{}, len(resources))
	for _, resource := range resources {
		if err := resource.Validate(); err != nil {
			return fmt.Errorf("invalid model resource: %w", err)
		}
		if resource.IsWildcard() && len(resources) > 1 {
			return fmt.Errorf("wildcard model (*) must be the only model")
		}
		if _, ok := seen[resource]; ok {
			return fmt.Errorf("duplicate model resource: %s", resource.ID)
		}
		seen[resource] = struct{}{}
	}

	return nil
}

func validateHostedAgentResources(resources []HostedAgentResource) error {
	seen := make(map[HostedAgentResource]struct{}, len(resources))
	for _, resource := range resources {
		if err := resource.Validate(); err != nil {
			return fmt.Errorf("invalid hosted agent resource: %w", err)
		}
		if resource.IsWildcard() && len(resources) > 1 {
			return fmt.Errorf("wildcard hosted agent resource (*) must be the only hosted agent resource")
		}
		if _, ok := seen[resource]; ok {
			return fmt.Errorf("duplicate hosted agent resource: %s/%s", resource.Type, resource.ID)
		}
		seen[resource] = struct{}{}
	}

	return nil
}

type AccessPolicyList List[AccessPolicy]
