#!/usr/bin/env node
/* Browser proof for the development realm. Never prints passwords or tokens. */
const {createRequire}=require('node:module');
const {pathToFileURL}=require('node:url');
const {resolve}=require('node:path');
const {randomBytes,randomUUID,createHash,createHmac}=require('node:crypto');
const {createServer}=require('node:http');
const requireWeb=createRequire(resolve(__dirname,'../../web/package.json'));
const {chromium}=requireWeb('@playwright/test');
const assert=require('node:assert/strict');
const base=(process.env.KEYCLOAK_URL||'http://auth.localhost:8080').replace(/\/$/,'');
const issuer=`${base}/realms/hse-dev`,redirect='http://localhost:5173/auth/callback';
const callbackTarget=new URL(redirect);

function isCallbackUrl(url,target=callbackTarget) {
  return url.origin===target.origin&&url.pathname===target.pathname;
}

function safeDestination(value) {
  try {const url=new URL(value);return ['http:','https:'].includes(url.protocol)?`${url.origin}${url.pathname}`:url.protocol;}catch{return 'unavailable';}
}

function requestFailureDetails(request) {
  const errorText=request.failure()?.errorText||'';
  return {destination:safeDestination(request.url()),errorText:/^net::ERR_[A-Z0-9_]+$/.test(errorText)?errorText:'request failed'};
}

async function createCallbackReceiver({redirectUrl=redirect,expectedState,timeoutMs=30000}) {
  const target=new URL(redirectUrl);
  assert.equal(target.protocol,'http:','Callback listener must use loopback HTTP');
  assert.equal(target.hostname,'localhost','Callback listener must remain on localhost');
  assert.ok(expectedState,'Expected callback state is required');
  let resolveCallback,rejectCallback,settled=false,timer;
  const received=new Promise((resolve,reject)=>{resolveCallback=resolve;rejectCallback=reject;});
  // Browser interaction can fail or take longer than the listener's deadline.
  // Handle that rejection immediately while preserving it for the later await.
  received.catch(()=>{});
  function finish(error,url) {if(settled)return;settled=true;clearTimeout(timer);if(error)rejectCallback(error);else resolveCallback(url);}
  const server=createServer((request,response)=>{
    response.setHeader('Cache-Control','no-store');response.setHeader('Referrer-Policy','no-referrer');
    response.setHeader('Content-Type','text/plain; charset=utf-8');
    let url;try{url=new URL(request.url,`http://${request.headers.host}`);}catch{response.writeHead(400);response.end('Invalid callback');return;}
    if(request.method!=='GET'||!isCallbackUrl(url,target)){response.writeHead(404);response.end('Not found');return;}
    if(settled||url.searchParams.get('state')!==expectedState){response.writeHead(400);response.end('Invalid callback');return;}
    if(url.searchParams.get('error')||!url.searchParams.get('code')){response.writeHead(400);response.end('Authorization was not completed');finish(new Error('Identity provider did not return an authorization code'));return;}
    response.end('Identity verification complete');finish(null,url);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(target.port)||0,'127.0.0.1',resolve);});
  target.port=String(server.address().port);
  timer=setTimeout(()=>finish(new Error('Timed out waiting for the identity callback')),timeoutMs);
  return {url:target.toString(),received,async close(){
    clearTimeout(timer);finish(new Error('Identity callback listener closed'));
    if(server.listening){const closing=new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));server.closeAllConnections();await closing;}
  }};
}

function otp(secret) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';
  for(const char of secret.toUpperCase().replace(/=+$/,'')){const value=alphabet.indexOf(char);if(value<0)throw new Error('DEV_ADMIN_OTP_SECRET must be base32');bits+=value.toString(2).padStart(5,'0');}
  const bytes=Buffer.from(Array.from({length:Math.floor(bits.length/8)},(_,i)=>parseInt(bits.slice(i*8,i*8+8),2)));
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const digest=createHmac('sha1',bytes).update(counter).digest(),offset=digest.at(-1)&15;
  return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
async function main() {
  const password=process.env.DEV_WORKER_PASSWORD,clientSecret=process.env.HSE_OIDC_CLIENT_SECRET,adminSecret=process.env.HSE_ADMIN_CLIENT_SECRET,otpSecret=process.env.DEV_ADMIN_OTP_SECRET;
  if(!password||!clientSecret||!adminSecret||!otpSecret)throw new Error('Set DEV_WORKER_PASSWORD, HSE_OIDC_CLIENT_SECRET, HSE_ADMIN_CLIENT_SECRET, and DEV_ADMIN_OTP_SECRET from the development fixture');
  const {jwtVerify,createRemoteJWKSet}=await import(pathToFileURL(requireWeb.resolve('jose')).href);
  const keys=createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));
  const serviceResponse=await fetch(`${issuer}/protocol/openid-connect/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:'hse-account-admin',client_secret:adminSecret})});
  assert.equal(serviceResponse.status,200,'Account service authentication failed');const token=(await serviceResponse.json()).access_token;
  const personId=randomUUID(),tenantId=randomUUID(),technicalUsername=`hse-fixture-${personId}`,technicalEmail=`${personId}@${tenantId}.login.invalid`;
  const technicalPassword=`Print-${randomBytes(18).toString('base64url')}!`;
  const createResponse=await fetch(`${base}/admin/realms/hse-dev/users`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({username:technicalUsername,email:technicalEmail,firstName:'Printed Fixture Worker',enabled:true,emailVerified:false,attributes:{hse_person_id:[personId],hse_tenant_id:[tenantId],hse_identity_email_technical:['true']},credentials:[{type:'password',value:technicalPassword,temporary:true}],requiredActions:['UPDATE_PASSWORD']})});
  assert.equal(createResponse.status,201,'Account service could not create the technical printed worker');
  const technicalSubject=createResponse.headers.get('location')?.split('/').at(-1);assert.ok(technicalSubject,'Technical user identifier missing');
  let browser;
  try {
    browser=await chromium.launch();
    for(const [username,subject,mfa,printed]of[['synthetic.worker.a','11111111-1111-4111-8111-111111111111',false,false],['synthetic.admin.a','33333333-3333-4333-8333-333333333333',true,false],[technicalUsername,technicalSubject,false,true]]){
      const context=await browser.newContext(),page=await context.newPage();let receiver,phase='callback listener';
      page.on('requestfailed',request=>console.error(`Identity browser request failed: ${JSON.stringify(requestFailureDetails(request))}`));
      try {
      const verifier=randomBytes(32).toString('base64url'),state=randomBytes(24).toString('base64url'),nonce=randomBytes(24).toString('base64url');
      receiver=await createCallbackReceiver({expectedState:state});
      const auth=new URL(`${issuer}/protocol/openid-connect/auth`);
      for(const [key,value]of Object.entries({client_id:'hse-web',response_type:'code',redirect_uri:redirect,scope:'openid email',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}))auth.searchParams.set(key,value);
      phase='password authentication';
      await page.goto(auth.toString());await page.locator('input[name="username"]').fill(username);await page.locator('input[name="password"]').fill(printed?technicalPassword:password);await page.locator('#kc-login').click();
      if(mfa){phase='OTP authentication';await page.locator('input[name="otp"]').waitFor();await page.locator('input[name="otp"]').fill(otp(otpSecret));await page.locator('#kc-login').click();}
      if(printed){phase='password replacement';const replacement=`Updated-${randomBytes(18).toString('base64url')}!`;await page.locator('input[name="password-new"]').fill(replacement);await page.locator('input[name="password-confirm"]').fill(replacement);await page.locator('#kc-passwd-update-form [type="submit"]').click();}
      phase='HTTP callback reception';const callback=await receiver.received;assert.equal(callback.searchParams.get('state'),state);assert.ok(callback.searchParams.get('code'),'Expected authorization code');
      phase='authorization code exchange';
      const response=await fetch(`${issuer}/protocol/openid-connect/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:'hse-web',client_secret:clientSecret,code:callback.searchParams.get('code'),redirect_uri:redirect,code_verifier:verifier})});
      assert.equal(response.status,200,'Code exchange failed');const tokens=await response.json();
      phase='signed identity token verification';const {payload}=await jwtVerify(tokens.id_token,keys,{issuer,audience:'hse-web',algorithms:['RS256','ES256']});
      phase='identity subject binding';assert.equal(payload.sub,subject);
      phase='identity nonce binding';assert.equal(payload.nonce,nonce);
      phase='password authentication reference';assert.ok(payload.amr?.includes('pwd'),'Password AMR missing');
      phase='OTP authentication reference';assert.equal(payload.amr?.includes('otp'),mfa,'OTP AMR must prove an actual completed OTP challenge');
      if(printed){phase='technical identity email binding';assert.equal(payload.email,technicalEmail);phase='technical email verification status';assert.equal(payload.email_verified,false,'Technical identifier must remain unverified');}
      console.log(`OK ${printed?'printed worker':username}: signed identity token proves ${mfa?'password and OTP':printed?'one-time password replacement with unverified technical email':'password with no forced MFA enrollment'}`);
      } catch(error) {
        console.error(`Identity browser failure: ${JSON.stringify({phase,destination:safeDestination(page.url()),errorType:error.name})}`);
        throw new Error(`Identity browser verification failed during ${phase}`);
      } finally {try{await context.close();}finally{if(receiver)await receiver.close();}}
    }
    const allowed=await fetch(`${base}/admin/realms/hse-dev/users/11111111-1111-4111-8111-111111111111`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(allowed.status,200,'Account service must read users');
    const denied=await fetch(`${base}/admin/realms/hse-dev/clients`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(denied.status,403,'Account service must not administer clients');
    console.log('OK account service can administer users and cannot administer clients');
  }finally{try{if(browser)await browser.close();}finally{const removed=await fetch(`${base}/admin/realms/hse-dev/users/${encodeURIComponent(technicalSubject)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});assert.equal(removed.status,204,'Technical fixture account cleanup failed');}}
}
module.exports={isCallbackUrl,createCallbackReceiver,requestFailureDetails};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
