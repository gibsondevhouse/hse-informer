import { spawn } from 'node:child_process';
const mode = process.argv[2];
if (!['web','jobs'].includes(mode)) throw new Error('Choose web or jobs');
if (process.env.DEV_AUTH) throw new Error('DEV_AUTH is forbidden in the real beta stack');
const tenantId = process.env.HSE_TENANT_ID;
const token = process.env.MOODLE_SERVICE_TOKEN;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (Boolean(tenantId) !== Boolean(token)) throw new Error('Set both HSE_TENANT_ID and MOODLE_SERVICE_TOKEN after Moodle setup');
if (mode === 'jobs' && (!tenantId || !token)) throw new Error('Configure the tenant and Moodle service before starting jobs');
if (tenantId && (!uuid.test(tenantId) || !uuid.test(process.env.MOODLE_INSTANCE_ID ?? ''))) throw new Error('Invalid tenant or stable Moodle instance UUID');
const connections = tenantId ? { [tenantId]: { instanceId: process.env.MOODLE_INSTANCE_ID,
  baseUrl: process.env.MOODLE_BASE_URL, token, learnerRoleId: 5,
  authMethod: process.env.MOODLE_AUTH_METHOD || 'oauth2', completionEvidence: 'local_hse_evidence' } } : {};
const child = spawn(process.execPath, mode === 'web' ? ['build'] : ['/app/infra/beta/run-jobs.mjs'], {
  cwd: '/app/web', stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production', MOODLE_CONNECTIONS_JSON: JSON.stringify(connections) }
});
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => child.kill(signal));
child.on('error', () => { process.exitCode = 127; });
child.on('close', (code) => process.exit(code ?? 1));
