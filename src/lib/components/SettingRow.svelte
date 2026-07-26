<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    /** Explicit `| undefined` — exactOptionalPropertyTypes rejects the short form. */
    description?: string | undefined;
    control: Snippet;
  }

  let { label, description, control }: Props = $props();
</script>

<div class="row">
  <div class="text">
    <span class="label">{label}</span>
    {#if description !== undefined}<span class="description">{description}</span>{/if}
  </div>
  <div class="control">{@render control()}</div>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-4);
    padding: var(--sp-3) 0;
    border-bottom: 1px solid var(--border);
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }

  .label {
    font-size: var(--fs-2);
  }

  .description {
    font-size: var(--fs-0);
    color: var(--fg-muted);
  }

  .control {
    flex-shrink: 0;
  }

  @media (max-width: 560px) {
    .row {
      flex-direction: column;
      align-items: stretch;
      gap: var(--sp-2);
    }
  }
</style>
