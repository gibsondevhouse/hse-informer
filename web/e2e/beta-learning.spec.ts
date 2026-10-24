import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { SignJWT } from 'jose';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext } from '@playwright/test';

const tenant='8da16f24-496e-42cb-aeb2-dc922dfba112';
const issuer='https://identity.beta.test/realms/test';
const secret='isolated-beta-http-session-secret-at-least-32-bytes';
let admin: {id:string;subject:string};
let learner: {id:string;subject:string};
let person:string, other:string, site:string, assignment:string;
async function session(context: BrowserContext, principal: {id:string;subject:string}, mfa=false) {
  const token=await new SignJWT({oidcIssuer:issuer,principalId:principal.id,tenantId:tenant,mfa,sessionVersion:0})
    .setProtectedHeader({alg:'HS256'}).setSubject(principal.subject).setIssuedAt().setExpirationTime('10m')
    .sign(new TextEncoder().encode(secret));
  await context.addCookies([{name:'hse_session',value:token,url:'http://127.0.0.1:5192',httpOnly:true,sameSite:'Lax'}]);
}
test.beforeAll(async()=>{
  const db=new Pool({connectionString:process.env.DATABASE_URL});
  try {
    await db.query(`INSERT INTO tenants(id,slug,name,synthetic) VALUES ($1,'beta-browser-fixture','Beta browser test',true)
      ON CONFLICT(id) DO NOTHING`,[tenant]);
    person=randomUUID();other=randomUUID();site=randomUUID();assignment=randomUUID();
    const requirement=randomUUID(),version=randomUUID(),course=randomUUID();
    admin={id:randomUUID(),subject:randomUUID()};learner={id:randomUUID(),subject:randomUUID()};
    await db.query(`INSERT INTO sites(id,tenant_id,code,name,state_code,time_zone) VALUES($1,$2,$3,'Test site','GA','America/New_York')`,[site,tenant,site]);
    for(const [id,name]of[[person,'Learner One'],[other,'Private Other Learner']]){
      await db.query(`INSERT INTO people(id,tenant_id,display_name,person_type,synthetic) VALUES($1,$2,$3,'employee',true)`,[id,tenant,name]);
      await db.query('INSERT INTO person_site_memberships(tenant_id,person_id,site_id) VALUES($1,$2,$3)',[tenant,id,site]);
    }
    for(const [principal,role,personId]of[[admin,'tenant_admin',null],[learner,'learner',person]] as const)
      await db.query(`INSERT INTO principals(id,tenant_id,oidc_issuer,oidc_subject,person_id,role) VALUES($1,$2,$3,$4,$5,$6)`,[principal.id,tenant,issuer,principal.subject,personId,role]);
    await db.query('INSERT INTO requirements(id,tenant_id,code,title) VALUES($1,$2,$3,$4)',[requirement,tenant,requirement,'Practice learning']);
    await db.query(`INSERT INTO requirement_versions(id,tenant_id,requirement_id,version,legal_status,authority,audience,
      site_overlay_requirement,content_digest,authorization_prerequisites,review_status,reviewed_by,reviewed_at)
      VALUES($1,$2,$3,'1','general_awareness','Practice only','Test learners','None',repeat('a',64),'["knowledge"]','approved','Test reviewer',now())`,[version,tenant,requirement]);
    await db.query('UPDATE requirements SET active_version_id=$2 WHERE id=$1',[requirement,version]);
    await db.query(`INSERT INTO course_versions(id,tenant_id,requirement_version_id,content_id,content_version,title,package_sha256,
      export_format,moodle_course_id,review_status,reviewed_by,reviewed_at,completion_criteria_verified,completion_verification_note,practice_only)
      VALUES($1,$2,$3,$4,'1.0','Practice learning',repeat('b',64),'url',42,'approved','Test reviewer',now(),true,'Isolated HTTP fixture',true)`,[course,tenant,version,course]);
    await db.query(`INSERT INTO assignments(id,tenant_id,person_id,site_id,requirement_id,requirement_version_id,course_version_id,
      reason,trigger_kind,due_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,'Practice assignment','manual',now()+interval '7 days',$8)`,[assignment,tenant,person,site,requirement,version,course,admin.id]);
    await db.query(`INSERT INTO moodle_enrollments(tenant_id,assignment_id,moodle_user_id,moodle_course_id,enrolled_at)
      VALUES($1,$2,17,42,now())`,[tenant,assignment]);
    await db.query(`INSERT INTO knowledge_evidence(tenant_id,assignment_id,course_version_id,moodle_course_id,moodle_user_id,
      moodle_timecompleted,score,attempts,delivery_method,source_payload) VALUES($1,$2,$3,42,17,now(),90,2,'moodle','{}')`,[tenant,assignment,course]);
  } finally {await db.end();}
});
test('learner portal launches mapped Moodle course and protects profiles and completions',async({page,context})=>{
  await session(context,learner);
  await page.goto('/');
  await expect(page).toHaveURL(/\/learn$/);
  await expect(page.getByRole('heading',{name:'My training',exact:true})).toBeVisible();
  await page.getByLabel('Show', {exact:false}).selectOption('all');
  await expect(page.getByRole('link',{name:'Open course in Moodle ↗'})).toHaveAttribute('href','https://moodle.beta.test/course/view.php?id=42');
  await expect(page.getByRole('table')).toContainText('Practice learning');
  await expect(page.getByRole('table')).toContainText('90');
  const records=await page.request.get('/api/completions');
  expect(records.status()).toBe(200);
  expect((await records.json()).items.every((r:{personId:string})=>r.personId===person)).toBe(true);
  expect((await page.request.get(`/api/people/${other}`)).status()).toBe(404);
  expect((await page.request.post('/api/completions',{headers:{Origin:'http://127.0.0.1:5192'},data:{}})).status()).toBe(403);
  expect((await page.request.delete(`/api/assignments/${assignment}`,{headers:{Origin:'http://127.0.0.1:5192'},data:{reason:'Unauthorized cancellation'}})).status()).toBe(403);
  const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(a11y.violations).toEqual([]);
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);}
});
test('identity administration fails closed and disabled profiles revoke existing sessions',async({page,context,browser})=>{
  await session(context,learner);
  const adminContext=await browser.newContext();
  await session(adminContext,admin,true);
  try {
    const response=await adminContext.request.patch(`http://127.0.0.1:5192/api/people/${person}`,{
      headers:{Origin:'http://127.0.0.1:5192'},data:{active:false,reason:'Deactivate isolated test account'}});
    expect(response.status()).toBe(503);
    expect((await page.request.get('/api/me')).status()).toBe(200);
    const db=new Pool({connectionString:process.env.DATABASE_URL});
    try{await db.query('UPDATE people SET active=false WHERE tenant_id=$1 AND id=$2',[tenant,person]);}finally{await db.end();}
    expect((await page.request.get('/api/me')).status()).toBe(401);
  } finally {await adminContext.close();}
});

test('administrator adds an accessible versioned Moodle course draft', async ({ page, context }) => {
  await session(context, admin, true);
  const code = `UI-${randomUUID().slice(0, 8)}`;
  await page.goto('/courses');
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Add course version', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Add course version', exact: true }).focus();
  await page.keyboard.press('Space');
  const form = page.locator('.course-form');
  await expect(form).toBeVisible();
  await form.getByLabel('Program code').fill(code);
  await form.getByLabel('Course title', { exact: true }).fill(`Practice UI ${code}`);
  await form.getByLabel('Source content ID').fill(code);
  await form.getByLabel('Source version', { exact: true }).fill('UI-1');
  await form.getByLabel('Package SHA-256', { exact: true }).fill('d'.repeat(64));
  await form.getByLabel('Moodle course ID', { exact: true }).fill(String(100000 + Math.floor(Math.random() * 900000000)));
  await form.getByRole('combobox', { name: 'Delivery format', exact: true }).selectOption('url');
  await form.getByRole('combobox', { name: 'Assessment mapping', exact: true }).selectOption('quiz');
  await form.getByLabel('Moodle activity module ID', { exact: true }).fill('7302');
  await form.getByLabel('Moodle quiz instance ID', { exact: true }).fill('7301');
  await form.getByLabel('Practice content only', { exact: false }).check();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);
  await form.getByRole('button', { name: 'Save draft mapping', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Draft course mapping saved');
  const course = page.locator('article').filter({ has: page.getByRole('heading', { name: `Practice UI ${code}`, exact: true }) });
  await expect(course).toContainText('Practice course');
  await expect(course).toContainText('Draft');
  await course.getByText('Package and verification details', { exact: true }).click();
  await expect(course.getByText('Assessment: native Moodle quiz 7301 · activity module 7302', { exact: true })).toBeVisible();
  await expect(course.getByRole('button', { name: 'Publish version', exact: true })).toBeDisabled();
  await course.getByRole('button', { name: 'Verify Moodle completion', exact: true }).click();
  await expect(course.getByLabel('Verification evidence and configured criteria')).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);
  }
});


test('public activation rejects an invalid code without revealing account details', async ({page}) => {
  await page.goto('/activate');
  await expect(page.getByRole('button',{name:'Set password and activate',exact:true})).toBeEnabled();
  await page.getByLabel('Activation code',{exact:true}).fill('A'.repeat(32));
  await page.getByLabel('New password',{exact:true}).fill('An-isolated-test-password-123');
  await page.getByLabel('Confirm password',{exact:true}).fill('An-isolated-test-password-123');
  await page.getByRole('button',{name:'Set password and activate',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('invalid, expired, or already used');
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);
});
