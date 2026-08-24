package v1

import (
	"slices"

	"github.com/obot-platform/nah/pkg/fields"
	"github.com/obot-platform/obot/apiclient/types"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var (
	_ fields.Fields = (*AccessPolicy)(nil)
	_ DeleteRefs    = (*AccessPolicy)(nil)
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

type AccessPolicy struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata"`

	Spec   AccessPolicySpec `json:"spec"`
	Status EmptyStatus      `json:"status"`
}

type AccessPolicySpec struct {
	MCPCatalogID         string                     `json:"mcpCatalogID,omitempty"`
	Manifest             types.AccessPolicyManifest `json:"manifest"`
	PowerUserWorkspaceID string                     `json:"powerUserWorkspaceID,omitempty"`
	Generated            bool                       `json:"generated,omitempty"`
}

func (in *AccessPolicy) GetColumns() [][]string {
	return [][]string{
		{"Name", "Name"},
		{"Display Name", "Spec.Manifest.DisplayName"},
		{"Subjects", "{{len .Spec.Manifest.Subjects}}"},
		{"MCP Servers", "{{len .Spec.Manifest.MCPServers}}"},
		{"Skills", "{{len .Spec.Manifest.Skills}}"},
		{"Models", "{{len .Spec.Manifest.Models}}"},
		{"Hosted Agents", "{{len .Spec.Manifest.HostedAgents}}"},
	}
}

func (in *AccessPolicy) Has(field string) bool {
	return slices.Contains(in.FieldNames(), field)
}

func (in *AccessPolicy) Get(field string) string {
	switch field {
	case "spec.mcpCatalogID":
		return in.Spec.MCPCatalogID
	case "spec.powerUserWorkspaceID":
		return in.Spec.PowerUserWorkspaceID
	}
	return ""
}

func (*AccessPolicy) FieldNames() []string {
	return []string{
		"spec.mcpCatalogID",
		"spec.powerUserWorkspaceID",
	}
}

func (in *AccessPolicy) DeleteRefs() []Ref {
	return []Ref{{ObjType: &PowerUserWorkspace{}, Name: in.Spec.PowerUserWorkspaceID}}
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

type AccessPolicyList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`

	Items []AccessPolicy `json:"items"`
}
