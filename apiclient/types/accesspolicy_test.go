package types

import (
	"strings"
	"testing"
)

func TestAccessPolicyManifestValidate(t *testing.T) {
	t.Parallel()

	validSubject := []Subject{{Type: SubjectTypeUser, ID: "user-1"}}
	tests := []struct {
		name     string
		manifest AccessPolicyManifest
		wantErr  string
	}{
		{
			name: "mixed resources",
			manifest: AccessPolicyManifest{
				DisplayName:  "Policy",
				Subjects:     validSubject,
				MCPServers:   []Resource{{Type: ResourceTypeMCPServer, ID: "server-1"}},
				Skills:       []SkillResource{{Type: SkillResourceTypeSkill, ID: "skill-1"}},
				Models:       []ModelResource{{ID: "model-1"}},
				HostedAgents: []HostedAgentResource{{Type: HostedAgentResourceTypeHostedAgent, ID: "agent-1"}},
			},
		},
		{
			name:     "missing subjects",
			manifest: AccessPolicyManifest{DisplayName: "Policy", Models: []ModelResource{{ID: "model-1"}}},
			wantErr:  "at least one subject",
		},
		{
			name:     "missing resources",
			manifest: AccessPolicyManifest{DisplayName: "Policy", Subjects: validSubject},
			wantErr:  "at least one resource",
		},
		{
			name: "duplicate subject",
			manifest: AccessPolicyManifest{
				DisplayName: "Policy",
				Subjects: []Subject{
					{Type: SubjectTypeUser, ID: "user-1"},
					{Type: SubjectTypeUser, ID: "user-1"},
				},
				Models: []ModelResource{{ID: "model-1"}},
			},
			wantErr: "duplicate subject",
		},
		{
			name: "subject wildcard with another subject",
			manifest: AccessPolicyManifest{
				DisplayName: "Policy",
				Subjects: []Subject{
					{Type: SubjectTypeSelector, ID: "*"},
					{Type: SubjectTypeUser, ID: "user-1"},
				},
				Models: []ModelResource{{ID: "model-1"}},
			},
			wantErr: "wildcard subject",
		},
		{
			name: "resource wildcard with another resource",
			manifest: AccessPolicyManifest{
				DisplayName: "Policy",
				Subjects:    validSubject,
				Skills: []SkillResource{
					{Type: SkillResourceTypeSelector, ID: "*"},
					{Type: SkillResourceTypeSkill, ID: "skill-1"},
				},
			},
			wantErr: "wildcard skill resource",
		},
		{
			name: "missing display name",
			manifest: AccessPolicyManifest{
				Subjects: validSubject,
				Models:   []ModelResource{{ID: "model-1"}},
			},
			wantErr: "display name is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := tt.manifest.Validate()
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("Validate() error = %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("Validate() error = %v, want containing %q", err, tt.wantErr)
			}
		})
	}
}
