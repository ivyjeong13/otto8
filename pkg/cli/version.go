package cli

import (
	"fmt"

	"github.com/acorn-io/acorn/pkg/version"
	"github.com/spf13/cobra"
)

type Version struct {
	root *Acorn
}

func (l *Version) Run(cmd *cobra.Command, args []string) error {
	fmt.Println("Version: ", version.Get())
	return nil
}
