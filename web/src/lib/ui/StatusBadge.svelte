<script lang="ts">
  type Props = {
    label: string;
    state?: string;
    kind?: 'status' | 'review';
    additionalClass?: string;
  };
  let { label, state = '', kind = 'status', additionalClass = '' }: Props = $props();
</script>

<span class={[kind, state, additionalClass].filter(Boolean).join(' ')}>{label}</span>
