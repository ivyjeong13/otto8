package handlers

import (
	"os"

	"github.com/otto8-ai/otto8/pkg/api"
	"github.com/otto8-ai/otto8/pkg/version"
	"sigs.k8s.io/yaml"
)

type VersionHandler struct {
	emailDomain string
}

func NewVersionHandler(emailDomain string) *VersionHandler {
	return &VersionHandler{
		emailDomain: emailDomain,
	}
}

func (v *VersionHandler) GetVersion(req api.Context) error {
	return req.Write(v.getVersionResponse())
}

func (v *VersionHandler) getVersionResponse() map[string]string {
	values := make(map[string]string)
	versions := os.Getenv("OTTO8_SERVER_VERSIONS")
	if versions != "" {
		if err := yaml.Unmarshal([]byte(versions), &values); err != nil {
			values["error"] = err.Error()
		}
	}
	values["otto"] = version.Get().String()
	values["emailDomain"] = v.emailDomain
	return values
}
