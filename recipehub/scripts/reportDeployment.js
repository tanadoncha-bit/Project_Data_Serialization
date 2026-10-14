async function reportDeployment({ fetchImpl = fetch, env = process.env } = {}) {
  const repository = env.GITHUB_REPOSITORY;
  const token = env.GITHUB_TOKEN;
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('GitHub deployment credentials are missing');
  const site = 'https://cookhub-kz00.onrender.com';
  const health = await fetchImpl(site + '/healthz', { signal: AbortSignal.timeout(90000), cache: 'no-store' });
  if (!health.ok) throw new Error('Render health check failed: HTTP ' + health.status);
  const data = await health.json();
  if (data.status !== 'ok') throw new Error('Render database is not ready');
  if (!/^[a-f0-9]{40}$/.test(data.revision || '')) {
    console.log('No live revision available yet; deployment record was not changed.');
    return { recorded: false };
  }
  async function github(endpoint, body) {
    const response = await fetchImpl('https://api.github.com/repos/' + repository + endpoint, {
      method: body ? 'POST' : 'GET',
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('GitHub deployment API failed: HTTP ' + response.status);
    return response.json();
  }
  const commit = await github('/commits/' + data.revision);
  if (commit.sha !== data.revision) throw new Error('Live revision does not match the repository commit');
  const deployments = await github('/deployments?environment=production&per_page=1');
  let deployment = deployments[0];
  if (deployment && deployment.sha === data.revision) {
    const statuses = await github('/deployments/' + deployment.id + '/statuses?per_page=1');
    if (statuses[0]?.state === 'success' && statuses[0]?.environment_url === site) {
      console.log('Production deployment is already recorded: ' + data.revision);
      return { recorded: false, revision: data.revision };
    }
  } else {
    deployment = await github('/deployments', {
      ref: data.revision, environment: 'production', auto_merge: false, required_contexts: [],
      description: 'Verified running revision from Render health endpoint',
      transient_environment: false, production_environment: true,
    });
  }
  if (!Number.isInteger(deployment.id)) throw new Error('GitHub did not create a deployment');
  await github('/deployments/' + deployment.id + '/statuses', {
    state: 'success', environment: 'production', environment_url: site,
    ...(env.GITHUB_RUN_ID ? { log_url: 'https://github.com/' + repository + '/actions/runs/' + env.GITHUB_RUN_ID } : {}),
    description: 'Render is healthy and running this commit',
  });
  console.log('Recorded production deployment: ' + data.revision);
  return { recorded: true, revision: data.revision };
}
if (require.main === module) reportDeployment().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { reportDeployment };
