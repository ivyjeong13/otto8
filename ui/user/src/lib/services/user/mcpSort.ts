import type { MCPCatalogEntry, MCPCatalogServer } from '$lib/services';
import { parseCategories } from '$lib/services/user/mcp';

/**
 * Hardcoded popularity ranking for MCP catalog entries (from obot-platform/mcp-catalog).
 * Enterprise Google / Microsoft / AWS products are intentionally near the top.
 */
export const POPULAR_MCP_ENTRY_KEYS = [
	// Google
	'obot-gmail',
	'obot-google-calendar',
	'obot-google-drive',
	'obot-google-docs',
	'obot-google-sheets',
	'obot-google-cloud-run',
	'obot-bigquery-toolbox',
	'obot-google-maps-grounding-lite',
	'obot-google-search-console',
	'obot-calendar',
	'obot-contact',
	// Microsoft
	'obot-outlook',
	'obot-onedrive',
	'obot-excel',
	'obot-word',
	'obot-azure',
	'obot-microsoft-learn',
	// AWS
	'obot-aws-api',
	'obot-aws-documentation',
	'obot-aws-eks',
	'obot-aws-knowledge',
	'obot-aws-kendra',
	'obot-aws-redshift',
	// Other widely used enterprise / productivity MCPs
	'obot-github',
	'obot-github-enterprise',
	'slack',
	'obot-slack',
	'obot-notion',
	'obot-atlassian',
	'obot-salesforce',
	'obot-hubspot',
	'obot-snowflake',
	'obot-databricks-genie-spaces',
	'obot-linear',
	'obot-gitlab',
	'obot-postgresql',
	'obot-mysql',
	'obot-redis',
	'obot-stripe',
	'obot-zapier',
	'obot-tableau',
	'obot-grafana',
	'obot-datadog',
	'obot-pagerduty'
] as const;

/** Display names for fallback matching when entryKey is unavailable. */
const POPULAR_MCP_ENTRY_NAMES_BY_KEY: Record<string, string> = {
	'obot-gmail': 'Gmail',
	'obot-google-calendar': 'Google Calendar',
	'obot-google-drive': 'Google Drive',
	'obot-google-docs': 'Google Docs',
	'obot-google-sheets': 'Google Sheets',
	'obot-google-cloud-run': 'Google Cloud Run',
	'obot-bigquery-toolbox': 'BigQuery Toolbox',
	'obot-google-maps-grounding-lite': 'Google Maps Grounding Lite',
	'obot-google-search-console': 'Google Search Console',
	'obot-calendar': 'Calendar',
	'obot-contact': 'Contact',
	'obot-outlook': 'Outlook',
	'obot-onedrive': 'OneDrive',
	'obot-excel': 'Excel',
	'obot-word': 'Word',
	'obot-azure': 'Azure',
	'obot-microsoft-learn': 'Microsoft Learn',
	'obot-aws-api': 'AWS API',
	'obot-aws-documentation': 'AWS Documentation',
	'obot-aws-eks': 'AWS EKS',
	'obot-aws-knowledge': 'AWS Knowledge',
	'obot-aws-kendra': 'AWS Kendra',
	'obot-aws-redshift': 'AWS Redshift',
	'obot-github': 'GitHub',
	'obot-github-enterprise': 'GitHub Enterprise',
	slack: 'Slack Workspace',
	'obot-slack': 'Slack',
	'obot-notion': 'Notion',
	'obot-atlassian': 'Atlassian',
	'obot-salesforce': 'Salesforce',
	'obot-hubspot': 'HubSpot',
	'obot-snowflake': 'Snowflake',
	'obot-databricks-genie-spaces': 'Databricks Genie Spaces',
	'obot-linear': 'Linear',
	'obot-gitlab': 'GitLab',
	'obot-postgresql': 'PostgreSQL',
	'obot-mysql': 'MySQL',
	'obot-redis': 'Redis',
	'obot-stripe': 'Stripe',
	'obot-zapier': 'Zapier',
	'obot-tableau': 'Tableau',
	'obot-grafana': 'Grafana',
	'obot-datadog': 'Datadog',
	'obot-pagerduty': 'PagerDuty'
};

/**
 * Onboarding "Enterprise MCP Servers" preference IDs → catalog entryKeys.
 * These prefs are stored in profile.categoryPreferences but are not manifest categories.
 */
export const ENTERPRISE_PREFERENCE_ENTRY_KEYS: Record<string, readonly string[]> = {
	google: [
		'obot-gmail',
		'obot-google-calendar',
		'obot-google-drive',
		'obot-google-docs',
		'obot-google-sheets',
		'obot-google-cloud-run',
		'obot-bigquery-toolbox',
		'obot-google-maps-grounding-lite',
		'obot-google-search-console',
		'obot-calendar',
		'obot-contact'
	],
	microsoft: [
		'obot-outlook',
		'obot-onedrive',
		'obot-excel',
		'obot-word',
		'obot-azure',
		'obot-microsoft-learn'
	],
	'amazon-web-services': [
		'obot-aws-api',
		'obot-aws-documentation',
		'obot-aws-eks',
		'obot-aws-knowledge',
		'obot-aws-kendra',
		'obot-aws-redshift'
	],
	github: ['obot-github', 'obot-github-enterprise']
};

const popularRankByEntryKey = new Map(
	POPULAR_MCP_ENTRY_KEYS.map((entryKey, index) => [entryKey, index])
);

const popularRankByName = new Map(
	POPULAR_MCP_ENTRY_KEYS.map((entryKey, index) => {
		const name = POPULAR_MCP_ENTRY_NAMES_BY_KEY[entryKey];
		return [name?.toLowerCase() ?? entryKey, index] as const;
	})
);

type SortableMcpItem = {
	name: string;
	connected?: boolean;
	data: MCPCatalogEntry | MCPCatalogServer;
};

function getManifestEntryKey(data: MCPCatalogEntry | MCPCatalogServer): string | undefined {
	if ('isCatalogEntry' in data) {
		return data.manifest.entryKey;
	}
	return undefined;
}

export function getPopularRank(item: SortableMcpItem): number {
	const entryKey = getManifestEntryKey(item.data);
	if (entryKey && popularRankByEntryKey.has(entryKey as (typeof POPULAR_MCP_ENTRY_KEYS)[number])) {
		return popularRankByEntryKey.get(entryKey as (typeof POPULAR_MCP_ENTRY_KEYS)[number])!;
	}
	const byName = popularRankByName.get(item.name.toLowerCase());
	return byName ?? Number.POSITIVE_INFINITY;
}

function matchesEnterprisePreference(item: SortableMcpItem, preferenceId: string): boolean {
	const entryKeys = ENTERPRISE_PREFERENCE_ENTRY_KEYS[preferenceId];
	if (!entryKeys) return false;

	const entryKey = getManifestEntryKey(item.data);
	if (entryKey && entryKeys.includes(entryKey)) return true;

	return entryKeys.some((key) => {
		const name = POPULAR_MCP_ENTRY_NAMES_BY_KEY[key];
		return name != null && name.toLowerCase() === item.name.toLowerCase();
	});
}

/**
 * Lower rank = higher priority. Uses the earliest matching categoryPreference index.
 * Matches manifest.metadata.categories, plus enterprise preference IDs (google/microsoft/aws).
 */
export function getPreferredRank(item: SortableMcpItem, categoryPreferences: string[]): number {
	if (!categoryPreferences.length) return Number.POSITIVE_INFINITY;

	const categories = new Set(parseCategories(item.data).map((c) => c.toLowerCase()));
	let best = Number.POSITIVE_INFINITY;

	for (let i = 0; i < categoryPreferences.length; i++) {
		const preference = categoryPreferences[i]?.trim();
		if (!preference) continue;

		const preferenceLower = preference.toLowerCase();
		if (categories.has(preferenceLower) || matchesEnterprisePreference(item, preferenceLower)) {
			best = Math.min(best, i);
		}
	}

	return best;
}

export function compareConnectedThenName(a: SortableMcpItem, b: SortableMcpItem): number {
	if (a.connected !== b.connected) {
		return a.connected ? -1 : 1;
	}
	return a.name.localeCompare(b.name);
}
