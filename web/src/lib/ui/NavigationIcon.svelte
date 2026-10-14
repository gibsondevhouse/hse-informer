<script lang="ts">
  let { name }: { name: 'overview' | 'programs' | 'assignments' | 'sites' } = $props();
</script>

<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  {#if name === 'overview'}
    <rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" />
  {:else if name === 'programs'}
    <path d="M12 6c-2.3-1.5-5-2-9-1v14c3.8-1 6.7-.5 9 1 2.3-1.5 5.2-2 9-1V5c-4-1-6.7-.5-9 1Z" /><path d="M12 6v14" />
  {:else if name === 'assignments'}
    <path d="M9 5h12M9 12h12M9 19h12" /><path d="m3 5 1.5 1.5L7 4M3 12l1.5 1.5L7 11M3 19l1.5 1.5L7 18" />
  {:else}
    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" />
  {/if}
</svg>
