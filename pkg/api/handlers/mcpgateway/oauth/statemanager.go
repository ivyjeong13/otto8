package oauth

import (
	"context"
	"fmt"
	"strings"
	"sync"

	nmcp "github.com/nanobot-ai/nanobot/pkg/mcp"
	"github.com/obot-platform/obot/pkg/gateway/client"
	"golang.org/x/oauth2"
)

type stateObj struct {
	conf            *oauth2.Config
	verifier, mcpID string
	ch              chan<- nmcp.CallbackPayload
}
type stateCache struct {
	lock          sync.Mutex
	cache         map[string]stateObj
	gatewayClient *client.Client
}

func newStateCache(gatewayClient *client.Client) *stateCache {
	return &stateCache{
		gatewayClient: gatewayClient,
		cache:         make(map[string]stateObj),
	}
}

func (sm *stateCache) store(ctx context.Context, mcpID, state, verifier string, conf *oauth2.Config, ch chan<- nmcp.CallbackPayload) error {
	if err := sm.gatewayClient.ReplaceMCPOAuthToken(ctx, mcpID, state, verifier, conf, &oauth2.Token{}); err != nil {
		return fmt.Errorf("failed to persist state: %w", err)
	}

	sm.lock.Lock()
	sm.cache[state] = stateObj{
		conf:     conf,
		verifier: verifier,
		mcpID:    mcpID,
		ch:       ch,
	}
	sm.lock.Unlock()
	return nil
}

func (sm *stateCache) createToken(ctx context.Context, state, code, errorStr, errorDescription string) error {
	sm.lock.Lock()
	s, ok := sm.cache[state]
	delete(sm.cache, state)
	sm.lock.Unlock()

	var (
		conf            *oauth2.Config
		mcpID, verifier string
	)
	if ok {
		defer close(s.ch)

		mcpID = s.mcpID
		verifier = s.verifier
		conf = s.conf
	} else {
		token, err := sm.gatewayClient.GetMCPOAuthTokenByState(ctx, state)
		if err != nil {
			return fmt.Errorf("failed to get oauth state: %w", err)
		}

		conf = &oauth2.Config{
			ClientID:     token.ClientID,
			ClientSecret: token.ClientSecret,
			Endpoint: oauth2.Endpoint{
				AuthURL:   token.AuthURL,
				TokenURL:  token.TokenURL,
				AuthStyle: token.AuthStyle,
			},
			RedirectURL: token.RedirectURL,
		}
		if token.Scopes != "" {
			conf.Scopes = strings.Split(token.Scopes, " ")
		}

		mcpID = token.MCPID
		verifier = token.Verifier
	}

	if errorStr != "" {
		return fmt.Errorf("error returned from oauth server: %s, %s", errorStr, errorDescription)
	}

	token, err := conf.Exchange(ctx, code, oauth2.SetAuthURLParam("code_verifier", verifier))
	if err != nil {
		return fmt.Errorf("failed to exchange code: %w", err)
	}

	return sm.gatewayClient.ReplaceMCPOAuthToken(ctx, mcpID, "", "", conf, token)
}
