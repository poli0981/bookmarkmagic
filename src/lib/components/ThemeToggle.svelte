<script lang="ts">
  import type { ThemePreference } from '../browser/storage';
  import { t } from '../i18n/index.svelte';
  import { THEME_CHOICES } from '../settings/options';

  interface Props {
    value: ThemePreference;
    onchange: (next: ThemePreference) => void;
    /** Header variant: glyphs instead of words, labels moved to aria-label. */
    compact?: boolean;
  }

  let { value, onchange, compact = false }: Props = $props();

  // docs/06 §3 sketches a single ◐ that cycles. A segmented control instead:
  // one code path for both placements, and the current choice is visible rather
  // than inferred — a cycling button conflates "what am I" with "what's next".
  const GLYPH: Record<ThemePreference, string> = {
    system: '◐',
    light: '☀',
    dark: '☾',
  };
</script>

<div class="group" class:compact role="radiogroup" aria-label={t('settings.theme')}>
  {#each THEME_CHOICES as choice (choice.value)}
    <button
      type="button"
      role="radio"
      aria-checked={value === choice.value}
      aria-label={compact ? t(choice.labelKey) : undefined}
      class:selected={value === choice.value}
      onclick={() => onchange(choice.value)}
    >
      {#if compact}
        <span aria-hidden="true">{GLYPH[choice.value]}</span>
      {:else}
        {t(choice.labelKey)}
      {/if}
    </button>
  {/each}
</div>

<style>
  .group {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  button {
    font: inherit;
    padding: var(--sp-1) var(--sp-3);
    border: none;
    border-right: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg-muted);
    cursor: pointer;
    font-size: var(--fs-1);
  }

  button:last-child {
    border-right: none;
  }

  button:hover {
    color: var(--fg);
  }

  .selected {
    background: var(--accent);
    color: var(--accent-fg);
  }

  .compact button {
    padding: var(--sp-1) var(--sp-2);
  }
</style>
