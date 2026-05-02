import { runTruffleHog, parseTruffleHogOutput } from './scanners/truffleHog';
import path from 'path';

async function test() {
  // Use absolute path to the leaky test repo we created
  const repoPath = 'D:/AI_Agents/DevFlow/test-repo';
  
  console.log('🚀 Triggering TruffleHog scan on local test-repo...');
  const output = await runTruffleHog(repoPath);
  
  if (!output) {
    console.log('⚠️ No output returned from TruffleHog (No secrets found or command failed).');
    return;
  }

  const findings = parseTruffleHogOutput(output);
  console.log(`\n✅ Scan complete. Found ${findings.length} potential secrets.`);
  
  findings.forEach((f, i) => {
    console.log(`\nFINDING #${i+1}:`);
    console.log(`- Type: ${f.type}`);
    console.log(`- Commit: ${f.commitSha?.slice(0, 7)}`);
    console.log(`- Verified: ${f.isVerified}`);
  });
}

test().catch(console.error);
