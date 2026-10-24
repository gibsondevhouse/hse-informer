#!/usr/bin/env node
/* Local redirect proof only: synthetic sample values, no provider or database. */
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {createRequire}=require('node:module');
const {resolve}=require('node:path');
const {chromium}=createRequire(resolve(__dirname,'../../web/package.json'))('@playwright/test');
const {createCallbackReceiver,isCallbackUrl,requestFailureDetails}=require('./verify-hse-identity.cjs');
let browser;
before(async()=>{browser=await chromium.launch();});
after(async()=>{if(browser)await browser.close();});

async function redirectProvider(destination){
  const server=createServer((request,response)=>{response.writeHead(302,{Location:destination});response.end();});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return {url:`http://127.0.0.1:${server.address().port}/authorize`,async close(){const closing=new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));server.closeAllConnections();await closing;}};
}
const destination=base=>`${base}?state=sample-state&iss=http://provider.invalid/realms/sample&code=sample-code`;

test('reproduces callback interception being skipped after a provider HTTP 302',async()=>{
  const reservation=await createCallbackReceiver({redirectUrl:'http://localhost:0/auth/callback',expectedState:'sample-state'});
  const target=new URL(reservation.url),provider=await redirectProvider(destination(reservation.url));
  await reservation.close(); // The old implementation had no callback HTTP listener.
  const context=await browser.newContext(),page=await context.newPage();let intercepted=false;
  try{
    await page.route(url=>isCallbackUrl(url,target),async route=>{intercepted=true;await route.fulfill({status:200,body:'Intercepted'});});
    await assert.rejects(page.goto(provider.url,{timeout:5000}),/ERR_CONNECTION_REFUSED/);
    assert.equal(intercepted,false,'Playwright must reproduce the missed redirected request');
  }finally{await context.close();await provider.close();}
});

test('a real loopback listener receives the redirected browser request with raw issuer slashes',async()=>{
  const receiver=await createCallbackReceiver({redirectUrl:'http://localhost:0/auth/callback',expectedState:'sample-state'});
  const provider=await redirectProvider(destination(receiver.url)),context=await browser.newContext(),page=await context.newPage();
  try{
    const response=await page.goto(provider.url,{timeout:5000});assert.equal(response.status(),200);
    const callback=await receiver.received;
    assert.equal(callback.origin,new URL(receiver.url).origin);assert.equal(callback.pathname,'/auth/callback');
    assert.equal(callback.searchParams.get('state'),'sample-state');assert.equal(callback.searchParams.get('code'),'sample-code');
    assert.equal(callback.searchParams.get('iss'),'http://provider.invalid/realms/sample');
    assert.equal(await page.locator('body').textContent(),'Identity verification complete');
  }finally{await context.close();await provider.close();await receiver.close();}
});

test('listener rejects wrong paths, state, methods, missing codes and replay',async()=>{
  const receiver=await createCallbackReceiver({redirectUrl:'http://localhost:0/auth/callback',expectedState:'sample-state',timeoutMs:3000});
  try{
    assert.equal((await fetch(receiver.url.replace('/auth/callback','/wrong'))).status,404);
    assert.equal((await fetch(`${receiver.url}?state=wrong&code=sample-code`)).status,400);
    assert.equal((await fetch(destination(receiver.url),{method:'POST'})).status,404);
    assert.equal((await fetch(destination(receiver.url))).status,200);
    assert.equal((await receiver.received).searchParams.get('code'),'sample-code');
    assert.equal((await fetch(destination(receiver.url))).status,400);
  }finally{await receiver.close();}
  const invalid=await createCallbackReceiver({redirectUrl:'http://localhost:0/auth/callback',expectedState:'sample-state'});
  try{
    assert.equal((await fetch(`${invalid.url}?state=sample-state`)).status,400);
    await assert.rejects(invalid.received,/did not return an authorization code/);
  }finally{await invalid.close();}
});

test('receive is bounded and closing releases the callback port',async()=>{
  const receiver=await createCallbackReceiver({redirectUrl:'http://localhost:0/auth/callback',expectedState:'sample-state',timeoutMs:25});
  try{await assert.rejects(receiver.received,/Timed out/);}finally{await receiver.close();}
  const reused=await createCallbackReceiver({redirectUrl:receiver.url,expectedState:'sample-state'});
  await reused.close();
});

test('failure diagnostics remove URL credentials, query values and fragments',()=>{
  const request={url:()=> 'http://user:sample-password@localhost:5173/auth/callback?code=sample-code&access_token=sample-token#sample-fragment',failure:()=>({errorText:'net::ERR_CONNECTION_REFUSED'})};
  assert.deepEqual(requestFailureDetails(request),{destination:'http://localhost:5173/auth/callback',errorText:'net::ERR_CONNECTION_REFUSED'});
  assert.equal(requestFailureDetails({...request,failure:()=>({errorText:'Unexpected sample-token'})}).errorText,'request failed');
});
