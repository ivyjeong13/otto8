---
title: Access Policies
---

# Access Policies

Access policies grant users and groups access to governed Obot resources. A single policy can cover any combination of:

- MCP servers and MCP catalog entries
- Skills and skill sources
- Language models, default aliases, and model-name patterns
- Hosted agent templates

Access is additive. When a user matches multiple policies, they receive the combined resources from every matching policy. Policies grant access; they do not deny access granted elsewhere.

To manage policies, go to **MCP Management > Access Policies**. The list includes global policies and MCP-only policies owned by power-user workspaces.

## Create a policy

1. Select **Add policy**.
2. Enter a descriptive policy name.
3. Add one or more subjects: individual users, identity-provider groups, or all users.
4. Add resources from one or more resource sections.
5. Save the policy.

Each policy must contain at least one subject and one resource. The all-users subject must be the only subject in its policy. Likewise, an “all resources” selection must be the only selection within that resource section. These constraints keep wildcard grants explicit.

## Resource sections

### MCP servers

Select individual MCP servers, catalog entries, or everything in the registry. Global MCP selections belong to an MCP catalog. Workspace policies can select only MCP resources from their workspace registry.

### Skills

Select an individual skill, an entire skill source, or all skills. Granting a source automatically covers skills added to that source later.

### Models

Select configured language models, default model aliases, all models, or a trailing-wildcard pattern such as `claude-haiku-4-5*`. Patterns match provider-native model IDs by case-sensitive prefix and can cover models added in the future.

### Hosted agents

Select individual hosted agent templates or all hosted agent templates.

## Defaults and upgrades

Fresh installations receive separate default policies for MCP servers, skills, hosted agents, and model aliases. Keeping these defaults separate makes each grant easy to customize or remove.

During an upgrade, each existing MCP, skill, model, or hosted-agent policy becomes one unified access policy. Obot preserves its identifier, name, subjects, resources, and MCP/workspace scope. Existing policies are deliberately not merged, even when they have the same subjects.

The migration is restart-safe and runs before normal startup data is applied. The legacy records remain inert after migration and are not exposed through the API.

## Related topics

- [MCP Servers](./mcp-servers.md)
- [Skills](./skills.md)
- [Model Providers](../configuration/model-providers.md)
- [User Roles](../configuration/user-roles.md)
