package controller

import (
	"context"
	"fmt"

	"github.com/acorn-io/acorn/pkg/controller/data"
	"github.com/acorn-io/acorn/pkg/controller/handlers/toolreference"
	"github.com/acorn-io/acorn/pkg/services"
	"github.com/acorn-io/nah/pkg/router"
	// Enable logrus logging in nah
	_ "github.com/acorn-io/nah/pkg/logrus"
)

type Controller struct {
	router         *router.Router
	services       *services.Services
	toolRefHandler *toolreference.Handler
}

func New(services *services.Services) (*Controller, error) {
	c := &Controller{
		router:   services.Router,
		services: services,
	}

	err := c.setupRoutes()
	if err != nil {
		return nil, err
	}

	return c, nil
}

func (c *Controller) PostStart(ctx context.Context) error {
	if err := data.Data(ctx, c.services.StorageClient); err != nil {
		return fmt.Errorf("failed to apply data: %w", err)
	}
	go c.toolRefHandler.PollRegistry(ctx, c.services.Router.Backend())
	return c.toolRefHandler.EnsureOpenAIEnvCredentialAndDefaults(ctx, c.services.Router.Backend())
}

func (c *Controller) Start(ctx context.Context) error {
	if err := c.router.Start(ctx); err != nil {
		return fmt.Errorf("failed to start router: %w", err)
	}
	return nil
}
