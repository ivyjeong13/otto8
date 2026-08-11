import { PAGE_TRANSITION_DURATION } from '$lib/constants';

export const ENTERPRISE_CATEGORY_ALIASES: Record<string, readonly string[]> = {
	google: ['google'],
	microsoft: ['microsoft'],
	'amazon-web-services': ['aws', 'amazon web services', 'amazon-web-services'],
	github: ['github']
};

export const enterpriseCategoryNames = new Set(
	Object.values(ENTERPRISE_CATEGORY_ALIASES).flatMap((aliases) => aliases)
);

export const enterpriseCategories = [
	{
		label: 'Google',
		id: 'google',
		description:
			'Google is a cloud computing company that provides a variety of services, including email, calendar, and document storage.',
		iconURL: 'https://img.icons8.com/?size=100&id=V5cGWnc9R4xj&format=png&color=000000'
	},
	{
		label: 'Microsoft',
		id: 'microsoft',
		description:
			'Microsoft is a software company that provides a variety of services, including email, calendar, and document storage.',
		iconURL: 'https://img.icons8.com/?size=100&id=22989&format=png&color=000000'
	},
	{
		label: 'Amazon Web Services',
		id: 'amazon-web-services',
		description:
			'Amazon Web Services is a cloud computing platform that provides a variety of services, including compute, storage, and database services.',
		iconURL: 'https://img.icons8.com/?size=100&id=33039&format=png&color=000000'
	},
	{
		label: 'Github',
		id: 'github',
		description:
			'Github is a web-based hosting service for version control using Git. It offers the distributed version control and source code management functionality of Git, plus its own features.',
		iconURL: 'https://img.icons8.com/?size=100&id=62856&format=png&color=000000'
	}
];

export const flyOut = { x: -100, duration: PAGE_TRANSITION_DURATION };
export const flyIn = {
	x: 100,
	duration: PAGE_TRANSITION_DURATION,
	delay: PAGE_TRANSITION_DURATION
};

export type OnboardingView =
	| 'welcome'
	| 'interests'
	| 'load-catalog-source'
	| 'selected-usage'
	| 'done';

export const EXAMPLE_MCPS = [
	{
		label: 'Google Product MCPs',
		icon: 'https://img.icons8.com/?size=100&id=V5cGWnc9R4xj&format=png&color=000000'
	},
	{
		label: 'Microsoft 365 MCPs',
		icon: 'https://img.icons8.com/?size=100&id=22989&format=png&color=000000'
	},
	{
		label: 'Azure MCP',
		icon: 'https://img.icons8.com/?size=100&id=VLKafOkk3sBX&format=png&color=000000'
	},
	{
		label: 'Slack MCP',
		icon: 'https://img.icons8.com/?size=100&id=OXVeOEj6qZqX&format=png&color=000000'
	},
	{
		label: 'Github MCP',
		icon: 'https://img.icons8.com/?size=100&id=62856&format=png&color=000000'
	},
	{
		label: 'Atlassian MCP',
		icon: 'https://avatars.githubusercontent.com/u/168166?s=200&v=4'
	}
];
