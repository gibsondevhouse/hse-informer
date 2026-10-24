<script lang="ts">
  import { onMount } from 'svelte';
  let interactive = $state(false);
  onMount(() => { interactive = true; });
  let code=$state(''),password=$state(''),confirmation=$state(''),saving=$state(false),failure=$state(''),complete=$state(false);
  async function activate(event:SubmitEvent){
    event.preventDefault();failure='';if(password!==confirmation){failure='Passwords must match';return;}saving=true;
    try{const response=await fetch('/api/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,password})});
      if(!response.ok){const result=await response.json();throw new Error(result.message||'Activation failed');}code='';password='';confirmation='';complete=true;
    }catch(cause){failure=(cause as Error).message;}finally{saving=false;}
  }
</script>
<svelte:head><title>Activate your account · HSE Informer</title><meta name="robots" content="noindex,nofollow"/></svelte:head>
<main><p>Beta test workspace</p><h1>Activate your account</h1>{#if complete}<p role="status">Your password has been set. Sign in to continue. Administrative roles also require multi-factor authentication.</p><a href="/auth/login">Sign in</a>{:else}<p>Enter the one-time activation code provided by your administrator and choose your password. Codes expire after 30 minutes and can be used once.</p>{#if failure}<p class="error" role="alert">{failure}</p>{/if}<form onsubmit={activate}><label>Activation code<input bind:value={code} required autocomplete="one-time-code" spellcheck="false" autocapitalize="none"/></label><label>New password<input type="password" bind:value={password} required minlength="12" maxlength="128" autocomplete="new-password"/></label><label>Confirm password<input type="password" bind:value={confirmation} required minlength="12" maxlength="128" autocomplete="new-password"/></label><button disabled={saving || !interactive} type="submit">{saving?'Activating…':'Set password and activate'}</button></form>{/if}</main>
<style>:global(body){margin:0;background:#f5f7f9;color:#172b3a;font-family:system-ui,sans-serif}main{max-width:460px;margin:60px auto;padding:28px;background:white;border:1px solid #dbe3e9;border-radius:12px}h1{font-size:28px}p{line-height:1.6}label{display:block;margin:18px 0;font-weight:600}input{box-sizing:border-box;width:100%;padding:12px;margin-top:8px;border:1px solid #889eac;border-radius:6px;font:inherit}button,a{background:#165b75;color:white;border:0;border-radius:6px;padding:12px 16px;font:inherit}button:disabled{opacity:.6}.error{color:#9b2720}@media(max-width:600px){main{margin:20px 12px}}</style>
