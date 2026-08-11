import type { MDMAsset, MDMConfiguration } from '../admin/types';
import type { TargetOption } from './types';

export const getTargetOptions = (
	asset?: MDMAsset,
	configuration?: MDMConfiguration
): TargetOption[] => {
	if (asset?.configurations.length) {
		return asset.configurations.map((target) => ({
			description: target.description,
			os: target.os,
			osLabel: target.osLabel || target.os,
			platform: target.platform,
			platformLabel:
				asset.platforms.find((platform) => platform.id === target.platform)?.label ??
				target.platform
		}));
	}
	return (configuration?.artifacts ?? []).map((artifact) => ({
		os: artifact.os,
		osLabel: artifact.os,
		platform: artifact.platform,
		platformLabel: artifact.platform
	}));
};

export const getPlatformGroups = (targetOptions: TargetOption[]) => {
	const groups: {
		platform: string;
		platformLabel: string;
		targets: { option: TargetOption; index: number }[];
	}[] = [];
	for (const [index, option] of targetOptions.entries()) {
		let group = groups.find((candidate) => candidate.platform === option.platform);
		if (!group) {
			group = { platform: option.platform, platformLabel: option.platformLabel, targets: [] };
			groups.push(group);
		}
		group.targets.push({ option, index });
	}
	const manualIndex = groups.findIndex((group) => group.platform.toLowerCase() === 'manual');
	if (manualIndex > 0) {
		groups.unshift(...groups.splice(manualIndex, 1));
	}
	return groups;
};
