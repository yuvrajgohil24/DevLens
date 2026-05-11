
require('dotenv').config({ path: 'apps/backend/.env' });
const { getRepoBranches, getRepoCommits, getOwnerRepos } = require('../apps/backend/dist/services/githubService');

async function testGitHub() {
  try {
    console.log('Testing GitHub Service...');
    console.log('Owner:', process.env.GITHUB_OWNER);
    
    console.log('\n1. Fetching repos...');
    const repos = await getOwnerRepos();
    console.log(`Found ${repos.length} repos.`);
    console.log('Top 3:', repos.slice(0, 3).map(r => r.name));

    const targetRepo = process.env.GITHUB_REPO || repos[0]?.name;
    if (targetRepo) {
      console.log(`\n2. Fetching branches for ${targetRepo}...`);
      const branches = await getRepoBranches(targetRepo);
      console.log(`Found ${branches.length} branches.`);
      console.log('Default branch:', branches.find(b => b.isDefault)?.name);

      console.log(`\n3. Fetching commits for ${targetRepo}...`);
      const commits = await getRepoCommits(targetRepo, 'main');
      console.log(`Found ${commits.length} commits.`);
      console.log('Latest commit:', commits[0]?.message);
    }
  } catch (err) {
    console.error('GitHub Test Failed:', err.message);
  }
}

testGitHub();
