# 2026-08-24: Unify resource access policies

- **Authors:** []
- **Created:** 2026-08-24

## Summary

Replace the separate MCP server, skill, model, and hosted-agent access policy
resources with one persisted `AccessPolicy`. Each policy has one subject set and
four explicitly typed resource collections: `mcpServers`, `skills`, `models`,
and `hostedAgents`.

Global policies may grant access across any combination of resource families.
Power-user workspace policies remain MCP-only because a workspace represents a
user-owned MCP registry. Enforcement retains resource-specific matching logic,
but all matchers consume the same `AccessPolicy` informer and persisted model.

- TODO: How to handle migration of existing access policies? Are there many custom access policies in the hosted Obot instances? 

Make decision in migration: 
Existing policies are migrated one-to-one during startup. The migration does
not combine policies that happen to have the same subjects, avoiding ambiguous
decisions about names, ownership, scope, and future independent edits. A one-to-one conversion is likely safest and easiest to audit.

Do best attempt at merging to a single access policy based on subjects. ex. mcpServers access policy, skills access policy, and models access policy with Everyone gets merged into one. Any differentiation in subject means it should remain as a distinct access policy.

Only handle the default everyone access policies of each type. Leave custom ones as 1:1 and have admin handle rest?

## Related issues

None.

## Related ODPs

None.

## Problem and motivation

Obot currently represents the same authorization relationship—subjects receive
access to resources—with four persisted policy kinds:

- MCP server access control rules
- Skill access rules
- Model access policies
- Hosted-agent access rules

The kinds repeat subject handling, lifecycle logic, storage registration,
informers, indexes, routes, clients, and administration screens. Administrators
must create several policy objects to express one organizational grant, such as
giving an engineering group access to a set of MCP servers, skills, and models.

The duplication also makes cross-resource policy management difficult. New
shared behavior must be implemented and verified separately for every policy
kind even though the subject semantics are the same.

## Goals

- Provide one persisted access-policy kind with shared subject semantics.
- Allow one global policy to grant access to multiple resource families.
- Provide one global administration surface and one set of global policy
  routes.
- Preserve the effective grants and stable identifiers of existing policies.
- Make startup migration restart-safe and safe to run more than once.
- Keep resource-specific validation, indexing, and matching behavior explicit.
- Preserve the existing MCP-only semantics of power-user workspaces.
- Keep generated policies distinguishable and immutable through user-facing
  routes.

## Non-goals

- Introducing deny rules, priorities, conditions, or conflict resolution.
- Supporting dynamically registered or plugin-defined resource kinds.
- Making workspace policies grant skills, models, or hosted agents.
- Removing legacy storage kinds in the same release as the migration.
- Generalizing subjects beyond the existing user, group, and wildcard forms.
- Changing the resource matching semantics of any existing policy family.

## Context and constraints

Subjects are users, groups, or the wildcard selector `*`.

- MCP resources include catalogs, catalog entries, servers, and a wildcard.
  Global MCP grants are interpreted within one MCP catalog.
- Skill resources include repositories, individual skills, and a wildcard.
- Model resources include concrete model IDs, Obot default-model aliases, the
  global wildcard, and trailing wildcard patterns for provider-native model
  names.
- Hosted-agent resources include individual hosted agents and a wildcard.

Wildcards are exclusive within their resource family, not across the whole
policy. For example, a policy may grant all skills and two specific models.

The storage layer uses generated Go deep-copy and OpenAPI metadata. The public
wire representation is consumed by Go and TypeScript clients, so weakening the
resource types would move validation responsibility into runtime code and
client implementations.

Power-user workspace scope and global MCP catalog scope are policy metadata,
not resource kinds. They must remain explicit even though the semantic core of
a grant is subjects plus resources.

## Proposed design

### Persisted model

Introduce one `AccessPolicy` storage kind. Its editable manifest is:

```go
type AccessPolicyManifest struct {
    DisplayName  string
    Subjects     []Subject
    MCPServers   []Resource
    Skills       []SkillResource
    Models       []ModelResource
    HostedAgents []HostedAgentResource
}
```

The storage envelope additionally records lifecycle and scope data, including
the global MCP catalog ID, power-user workspace ID, generated status, object
metadata, and finalizers.

The JSON representation follows the same shape:

```json
{
  "displayName": "Engineering tools",
  "subjects": [
    { "type": "group", "id": "engineering" }
  ],
  "mcpCatalogID": "default",
  "mcpServers": [
    { "type": "mcpServerCatalogEntry", "id": "github" }
  ],
  "skills": [
    { "type": "skillRepository", "id": "company-skills" }
  ],
  "models": [
    { "id": "obot://default" }
  ],
  "hostedAgents": []
}
```

Subjects and resources must be valid and unique. A wildcard subject 
must be the only subject. A family wildcard must be the only resource in that family.

Referenced resources are validated on writes using the rules for their family.
Unknown resource types fail closed. Workspace writes reject non-MCP resources.
Global policies containing MCP resources require a valid, immutable MCP catalog
scope. Workspace policies derive MCP scope from the workspace and cannot set a
global catalog ID.

### Routes and clients

Serve global policies through:

- `/api/access-policies`
- `/api/access-policies/{id}`

Serve workspace policies through:

- `/api/workspaces/{workspace_id}/access-policies`
- `/api/workspaces/{workspace_id}/access-policies/{id}`
- `/api/workspaces/all-access-policies`

The former resource-specific policy routes are removed as part of the
coordinated backend and UI rollout. Generated policies cannot be modified or
deleted through these routes.

### Enforcement

Create one informer for `AccessPolicy`. Register separate indexes for the
resource identities needed by MCP, skill, model, and hosted-agent enforcement.

Existing resource-specific enforcement helpers remain as narrow interfaces for
their callers. Their implementations read the applicable typed collection from
the shared policy objects. This limits consumer changes while removing separate
active policy informers and storage lifecycles.

User deletion cleanup uses the shared subject index and therefore removes a
deleted user from every policy family consistently.

### Administration experience

Provide one global Access Policies list and editor. The editor groups resource
selection by family and uses each family's existing lookup and validation
behavior. It supports mixed-resource global grants.

Former global resource-specific pages redirect to the unified administration
surface. The power-user workspace MCP policy experience remains MCP-specific
but uses the unified workspace routes.

### Startup migration

-- TODO: Depending on migration decision, update this

## Alternatives considered

### Use one heterogeneous `resources` collection

Under this alternative, a policy would expose a single collection of resource
references, potentially represented by `(family, kind, id)` or a globally
unique resource kind such as `skill.repository`.

This shape more directly expresses the semantic statement that subjects receive
access to resources. It also simplifies generic counting, sorting, diffing,
auditing, and iteration, and avoids adding a top-level field for each future
resource family.

It was not selected because the current resource families have materially
different validation and matching semantics. A heterogeneous collection would
permit invalid family/kind combinations at the type level, require per-family
grouping for wildcard validation, and still require family-specific indexes,
matchers, data sources, and administration controls. The visible schema would
be smaller, but the underlying complexity would move into validators and every
consumer of the collection.

This alternative should be reconsidered if any of the following is considered: 
dynamically registered resource kinds, several additional resource families, or
a broader policy language with actions and conditions. If reconsidered, a
globally unique `kind` is preferable to independent `type` and `subtype` 
fields because it avoids an invalid-combination matrix.

## Trade-offs

The proposed model removes duplicated policy lifecycles and enables
mixed-resource grants while preserving strong resource typing. Adding another
compiled-in resource family still requires a schema field, generated-code
updates, validation, indexes, client support, and administration controls.

Keeping typed collections makes the public representation wider than a generic
resource list. In return, invalid cross-family combinations are unrepresentable,
family wildcard rules remain local, generated schemas are more useful, and
callers can consume the relevant collection without filtering unrelated
resources.

## Risks and open questions

- **Rollback after new writes:** Legacy objects remain available for rollback,
  but policies created or modified only in the new representation will not be
  visible to an older binary. (Is this a concern?)

## Rollout and migration

1. Register the new storage kind and generated schema metadata.
2. Add the idempotent startup migration and run it before default creation and
   enforcement startup.
3. Switch enforcement helpers and controllers to the shared informer.
4. Serve the unified routes and update bundled clients.
5. Deploy the unified administration experience and redirects in the same
   release.
6. Observe migration counts and failures during startup. A migration failure
   prevents enforcement startup so the system does not run with partially
   visible policy state.
7. Retain legacy kinds and source objects for at least the supported rollback
   window. Remove them only through a later compatibility decision.

Migration is restart-safe because target creation precedes source annotation
and an existing target is accepted on retry. The source remains unchanged as an
authorization input until the new runtime starts enforcing unified policies.

Rollback before new-policy writes restores the previous runtime's view because
the legacy sources remain. Rollback after new writes requires restoring policy
data from backup or converting the new policies back to legacy forms; automatic
reverse migration is not part of this proposal.

## Testing and validation

- Unit-test shared subject validation, family validation, duplicate detection,
  wildcard exclusivity, and model pattern handling.
- Unit-test global and workspace scope validation, including mixed-resource
  global policies and rejection of non-MCP workspace resources.
- Test every legacy-kind conversion and verify preservation of identifiers,
  subjects, resources, scope, metadata, and generated status.
- Test migration restart points: before target creation, after target creation,
  and before source annotation.
- Test that repeated startup does not duplicate policies or change effective
  grants.
- Test resource-specific enforcement helpers against mixed policies and the
  shared indexes.
- Test cleanup of deleted users and deleted resources across all families.
- Test generated-policy immutability and route authorization.

## References

- [MCP Access Control Rule Type](https://github.com/obot-platform/obot/blob/main/apiclient/types/accesscontrolrule.go)
- [Hosted Agent Access Control Rule Type](https://github.com/obot-platform/obot/blob/main/apiclient/types/hostedagentaccessrule.go)
- [Model Access Control Rule Type](https://github.com/obot-platform/obot/blob/main/apiclient/types/modelaccesspolicy.go)
- [Skill Access Rule Type](https://github.com/obot-platform/obot/blob/main/apiclient/types/skillaccessrule.go)