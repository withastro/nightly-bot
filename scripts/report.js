// @ts-check

const ORG = 'withastro';
const HOURS_25 = 25 * 60 * 60 * 1000;
const DAYS_3 = 3 * 24 * 60 * 60 * 1000;

async function fetchSecurityReports() {
	try {
		const response = await fetch(
			`https://api.github.com/orgs/${ORG}/security-advisories?state=triage,draft&per_page=100`,
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

		console.log('\n=== New Reports ===');
		if (newReports.length === 0) {
			console.log('No new reports.');
		} else {
			newReports.forEach((report) => {
				console.log(`- ${report.summary} - ${report.html_url}`);
			});
		}

		console.log('\n=== Need Triage ===');
		if (needTriage.length === 0) {
			console.log('All reports triaged! 🎉');
		} else {
			needTriage.forEach((report) => {
				console.log(`- ${report.summary} - ${report.html_url}`);
			});
		}
	} catch (error) {
		console.error('Error fetching security reports:', error.message);
		process.exit(1);
	}
}

fetchSecurityReports();
