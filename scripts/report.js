// @ts-check

const ORG = 'withastro';
const HOURS_25 = 25 * 60 * 60 * 1000;

fetchSecurityReports();

async function fetchSecurityReports() {
	try {
		const response = await fetch(
			`https://api.github.com/orgs/${ORG}/security-advisories?per_page=100`,
			{
				headers: {
					Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
					Accept: 'application/vnd.github+json',
					'X-GitHub-Api-Version': '2022-11-28',
				},
			}
		);

		if (!response.ok) {
			throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
		}

		const advisories = await response.json();
		const now = Date.now();
		const newReports = [];
		const needTriage = [];

		for (const advisory of advisories) {
			const createdAt = new Date(advisory.created_at).getTime();
			const timeSinceCreation = now - createdAt;

			// New reports from last 25 hours
			if (timeSinceCreation <= HOURS_25) {
				newReports.push(advisory);
			} else if (advisory.state === 'triage') {
				needTriage.push(advisory);
			}
		}

		await notifyDiscord({
			title: '🤖 Security Bulletin',
			description:
				newReports.length + needTriage.length > 0
					? 'Here’s your daily security update:'
					: 'It’s quiet — too quiet…\n\nNo new security reports or triage needed! 🎉',
			accent: newReports.length > 0 ? 'danger' : needTriage.length > 0 ? 'caution' : undefined,
			fields: [
				{
					name: 'New reports',
					value: newReports.length
						? newReports.map(advisoryListItem).join('\n')
						: 'No new reports today. ✅',
				},
				{
					name: 'Need triage',
					value: needTriage.length
						? needTriage.map(advisoryListItem).join('\n')
						: 'All reports triaged! ✅',
				},
			],
		});
	} catch (error) {
		console.error('Error fetching security reports:', error);
		await notifyDiscord({
			title: '⚠️ Security Bulletin Error',
			description:
				'An error occurred while fetching security reports.\n\n[See GitHub Actions logs for details](https://github.com/withastro/nightly-bot/actions)',
			accent: 'danger',
		});
		process.exit(1);
	}
}

/**
 * Send a notification message to Discord.
 * @param {DiscordEmbedConfig} options
 */
export async function notifyDiscord(options) {
	const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
	if (!DISCORD_WEBHOOK) {
		throw new Error('DISCORD_WEBHOOK environment variable not defined.');
	}
	await fetch(DISCORD_WEBHOOK, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(
			/** @satisfies {DiscordEmbedFieldConfig} */ ({
				allowed_mentions: { parse: ['everyone'] },
				embeds: [
					{
						color:
							options.accent &&
							{ success: 3066993, danger: 15548997, caution: 15105570, highlight: 10036203 }[
								options.accent
							],
						title: options.title,
						description: options.description,
						fields: options.fields ?? [],
					},
				],
			})
		),
	});
}

/**
 * Format a security advisory as a markdown list item.
 * @param {PartialGitHubSecurityAdvisory} advisory
 * @returns
 */
function advisoryListItem({ severity, summary, html_url }) {
	return `- ${severityEmoji(severity)} [${summary}](<${html_url}>)`;
}

/**
 * Get a emoji icon to represent a GitHub severity level.
 * @param {GitHubSeverity} severity
 * @returns {string}
 */
function severityEmoji(severity) {
	switch (severity) {
		case 'low':
			return '⚪';
		case 'medium':
			return '🟡';
		case 'high':
			return '🟠';
		case 'critical':
			return '🔴';
		default:
			return '';
	}
}

/**
 * @typedef {'low' | 'medium' | 'high' | 'critical' | null} GitHubSeverity
 * @typedef {{ severity: GitHubSeverity; summary: string; html_url: string }} PartialGitHubSecurityAdvisory
 */

/**
 * @typedef {{
		accent?: 'success' | 'danger' | 'caution' | 'highlight';
		title: string;
		description?: string;
		fields?: Array<{
				name: string;
				value: string;
				inline?: boolean;
		}>;
}} DiscordEmbedConfig
 */

/**
 * @typedef {{
		allowed_mentions: {
				parse?: Array<'everyone' | 'roles' | 'users'>;
				roles?: string[];
				users?: string[];
				replied_user?: boolean;
		};
		embeds?: Array<{
				title: string;
				description: string | undefined;
				color: number | undefined;
				thumbnail?: { url: string; };
				fields: Array<{ name: string; value: string; inline?: boolean; }>;
		}>;
}} DiscordEmbedFieldConfig
	*/
