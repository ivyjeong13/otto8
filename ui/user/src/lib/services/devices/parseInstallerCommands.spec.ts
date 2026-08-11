import { parseInstallerCommands } from './parseInstallerCommands';
import { describe, expect, it } from 'vitest';

const macosInstructions = `
# Follow the instructions to install obot-sentry

The install package contains \`obot-sentry.pkg\`.

## Installer (pkg)

Everything below needs an administrator account.

1. Write the deployment configuration, replacing \`REPLACE_WITH_ENROLLMENT_KEY\` with your enrollment key:

\`\`\`bash
sudo defaults write /Library/Preferences/ai.obot.obot-sentry ServerURL -string "http://localhost:8080"
sudo defaults write /Library/Preferences/ai.obot.obot-sentry EnrollmentKey -string "REPLACE_WITH_ENROLLMENT_KEY"
sudo defaults write /Library/Preferences/ai.obot.obot-sentry ScanIntervalMinutes -int 60
sudo defaults write /Library/Preferences/ai.obot.obot-sentry EnforcementEnabled -bool false
\`\`\`

2. Install the agent:

\`\`\`bash
sudo installer -pkg obot-sentry.pkg -target /
\`\`\`

3. Enroll the device:

\`\`\`bash
sudo obot-sentry enroll
\`\`\`

Enroll verifies the configuration and prints the enrolled device ID.

## What the installer does

This later section also has a command that must not be included:

\`\`\`bash
obot-sentry version
\`\`\`
`;

const windowsInstructions = `
# Follow the instructions to install obot-sentry

## Installer (MSI)

Everything below needs an Administrator PowerShell.

1. Install the agent, replacing \`REPLACE_WITH_ENROLLMENT_KEY\` with your enrollment key:

\`\`\`powershell
msiexec /i "obot-sentry.msi" /qn SERVER_URL="http://localhost:8080" ENROLLMENT_KEY="REPLACE_WITH_ENROLLMENT_KEY" SCAN_INTERVAL_MINUTES="60"
\`\`\`

2. Trigger the first scan without waiting for the schedule (optional):

\`\`\`powershell
Start-ScheduledTask -TaskName 'Obot Sentry Scan'
\`\`\`

## Verify the install

\`\`\`powershell
& "C:\\Program Files\\Obot\\obot-sentry\\obot-sentry.exe" version
\`\`\`
`;

describe('parseInstallerCommands', () => {
	it('returns commands from the first Installer (pkg) section only', () => {
		expect(parseInstallerCommands(macosInstructions)).toEqual([
			`sudo defaults write /Library/Preferences/ai.obot.obot-sentry ServerURL -string "http://localhost:8080"
sudo defaults write /Library/Preferences/ai.obot.obot-sentry EnrollmentKey -string "REPLACE_WITH_ENROLLMENT_KEY"
sudo defaults write /Library/Preferences/ai.obot.obot-sentry ScanIntervalMinutes -int 60
sudo defaults write /Library/Preferences/ai.obot.obot-sentry EnforcementEnabled -bool false`,
			'sudo installer -pkg obot-sentry.pkg -target /',
			'sudo obot-sentry enroll'
		]);
	});

	it('returns commands from the first Installer (MSI) section only', () => {
		expect(parseInstallerCommands(windowsInstructions)).toEqual([
			'msiexec /i "obot-sentry.msi" /qn SERVER_URL="http://localhost:8080" ENROLLMENT_KEY="REPLACE_WITH_ENROLLMENT_KEY" SCAN_INTERVAL_MINUTES="60"',
			"Start-ScheduledTask -TaskName 'Obot Sentry Scan'"
		]);
	});

	it('matches Installer headings without a space before the type', () => {
		const instructions = `
### Installer(pkg)

\`\`\`
sudo installer -pkg obot-sentry.pkg -target /
\`\`\`
`;
		expect(parseInstallerCommands(instructions)).toEqual([
			'sudo installer -pkg obot-sentry.pkg -target /'
		]);
	});

	it('returns an empty list when there is no Installer section', () => {
		expect(parseInstallerCommands('## Setup\n\n```\necho hi\n```')).toEqual([]);
		expect(parseInstallerCommands('')).toEqual([]);
		expect(parseInstallerCommands(undefined)).toEqual([]);
	});

	it('strips leading tabs and spaces from indented fence bodies', () => {
		const instructions = `
## Installer (pkg)

1. Write the deployment configuration:

\t\`\`\`bash
\t\tsudo defaults write /Library/Preferences/ai.obot.obot-sentry ServerURL -string "http://localhost:8080"
\t\tsudo defaults write /Library/Preferences/ai.obot.obot-sentry EnrollmentKey -string "REPLACE_WITH_ENROLLMENT_KEY"
\t\`\`\`

2. Install the agent:

    \`\`\`bash
        sudo installer -pkg obot-sentry.pkg -target /
    \`\`\`
`;
		expect(parseInstallerCommands(instructions)).toEqual([
			`sudo defaults write /Library/Preferences/ai.obot.obot-sentry ServerURL -string "http://localhost:8080"
sudo defaults write /Library/Preferences/ai.obot.obot-sentry EnrollmentKey -string "REPLACE_WITH_ENROLLMENT_KEY"`,
			'sudo installer -pkg obot-sentry.pkg -target /'
		]);
	});
});
