<script lang="ts">
  import { page } from '$app/state';
  import type { LayoutData } from './$types';
  let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
  const admin = $derived(data.sessionActor && ['tenant_admin','site_admin','hse_reviewer'].includes(data.sessionActor.role));
</script>
{#if data.sessionActor && page.url.pathname !== '/' && !page.url.pathname.startsWith('/preview/')}
  <nav class="beta-nav" aria-label="HSE Informer navigation"><a class="brand" href="/">HSE INFORMER</a><span class="beta-label">Beta test</span><div>{#if admin}<a href="/">Overview & assignments</a><a href="/courses">Courses</a>{/if}{#if data.sessionActor.role === 'learner'}<a href="/learn">My training</a>{/if}<a href="/people">{data.sessionActor.role === 'learner' ? 'My profile' : 'People'}</a><a href="/records">Completion records</a></div><form method="POST" action="/auth/logout"><button>Sign out</button></form></nav>
{/if}
{@render children()}
<style>.beta-nav{display:flex;align-items:center;gap:24px;padding:16px 24px;background:#12354e;color:white;flex-wrap:wrap;font:14px Arial,sans-serif}.beta-nav a{color:white;text-decoration:none}.beta-nav .beta-label{font-size:11px;border:1px solid #8aa6ba;border-radius:3px;padding:3px 6px;white-space:nowrap}.beta-nav .brand{font-size:13px;letter-spacing:1px;font-weight:700}.beta-nav div{display:flex;gap:20px;flex-wrap:wrap;flex:1}.beta-nav button{background:none;border:1px solid #8aa6ba;color:white;border-radius:5px;padding:8px 12px;font:inherit}.beta-nav a:focus-visible,.beta-nav button:focus-visible{outline:3px solid #a4d3f6;outline-offset:4px}</style>
