<script lang="ts">
  import { page } from '$app/state';
</script>
<svelte:head><title>Signed out · HSE Informer</title></svelte:head>
<main><h1>You’re signed out of HSE Informer</h1>
  {#if page.url.searchParams.has('portal')}<p role="alert">Your local sign-in cookie was removed, but revocation of other portal sessions could not be confirmed. Contact your administrator if this persists.</p>{/if}
  {#if page.url.searchParams.has('moodle')}<p role="alert">Moodle sign-out could not be confirmed. Use Moodle’s own Sign out control in any open course tab.</p>{/if}
  {#if page.url.searchParams.has('identity')}<p role="alert">Your identity-provider sign-out could not be confirmed. If you share this device, also sign out of your identity account and close other training tabs.</p>{/if}
  <a href="/auth/login">Sign in again</a>
</main>
<style>:global(body){margin:0;background:#f5f7fa;color:#172b3a;font-family:Arial,sans-serif}main{max-width:600px;padding:48px 24px;margin:auto}h1{font-size:28px}p{line-height:1.7}a{display:inline-block;margin-top:16px;color:#174569}</style>
