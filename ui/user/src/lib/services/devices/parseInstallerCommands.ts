const INSTALLER_HEADING = /^(#{1,6})\s+Installer\b.*$/im;
const FENCED_COMMAND = /```[^\n]*\n([\s\S]*?)```/g;

export function parseInstallerCommands(instructions?: string | null): string[] {
	if (!instructions) return [];

	const headingMatch = INSTALLER_HEADING.exec(instructions);
	if (!headingMatch) return [];

	const level = headingMatch[1].length;
	const sectionStart = headingMatch.index + headingMatch[0].length;
	const rest = instructions.slice(sectionStart);
	const nextHeading = new RegExp(`^#{1,${level}}\\s+`, 'm');
	const nextMatch = nextHeading.exec(rest);
	const section = nextMatch ? rest.slice(0, nextMatch.index) : rest;

	const commands: string[] = [];
	for (const match of section.matchAll(FENCED_COMMAND)) {
		const command = dedentCommand(match[1]);
		if (command) commands.push(command);
	}
	return commands;
}

function dedentCommand(value: string): string {
	const lines = value.replace(/\n$/, '').split('\n');
	const nonEmpty = lines.filter((line) => line.trim().length > 0);
	if (!nonEmpty.length) return '';

	let prefix = nonEmpty[0].match(/^[ \t]*/)?.[0] ?? '';
	for (const line of nonEmpty.slice(1)) {
		const indent = line.match(/^[ \t]*/)?.[0] ?? '';
		let i = 0;
		while (i < prefix.length && i < indent.length && prefix[i] === indent[i]) {
			i++;
		}
		prefix = prefix.slice(0, i);
		if (!prefix) break;
	}

	return lines.map((line) => line.slice(prefix.length)).join('\n').trim();
}
