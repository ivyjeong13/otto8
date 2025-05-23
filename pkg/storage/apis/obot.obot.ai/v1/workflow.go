package v1

import (
	"slices"
	"strconv"

	"github.com/obot-platform/nah/pkg/fields"
	"github.com/obot-platform/obot/apiclient/types"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var (
	_ fields.Fields = (*Workflow)(nil)
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

type Workflow struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   WorkflowSpec   `json:"spec,omitempty"`
	Status WorkflowStatus `json:"status,omitempty"`
}

func (in *Workflow) Has(field string) (exists bool) {
	return slices.Contains(in.FieldNames(), field)
}

func (in *Workflow) Get(field string) (value string) {
	switch field {
	case "spec.threadName":
		return in.Spec.ThreadName
	case "spec.slack":
		return strconv.FormatBool(in.Spec.Manifest.OnSlackMessage != nil)
	}
	return ""
}

func (in *Workflow) FieldNames() []string {
	return []string{
		"spec.threadName",
		"spec.slack",
	}
}

type WorkflowSpec struct {
	ThreadName         string                 `json:"threadName,omitempty"`
	Manifest           types.WorkflowManifest `json:"manifest,omitempty"`
	Managed            bool                   `json:"managed,omitempty"`
	SourceThreadName   string                 `json:"sourceThreadName,omitempty"`
	SourceWorkflowName string                 `json:"sourceWorkflowName,omitempty"`
}

func (in *Workflow) DeleteRefs() []Ref {
	refs := []Ref{
		{ObjType: &Thread{}, Name: in.Spec.ThreadName},
	}
	return refs
}

type WorkflowStatus struct {
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

type WorkflowList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Workflow `json:"items"`
}
