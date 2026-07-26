<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import type { Locale } from '../i18n/resolve-locale';
  import { LOCALE_CHOICES, parseChoice } from '../settings/options';

  interface Props {
    /**
     * The stored *preference*, which includes `'auto'` — never `getLocale()`.
     * Binding this to the resolved locale would make choosing "Automatic" snap
     * the control straight to "English".
     */
    value: Locale | 'auto';
    onchange: (next: Locale | 'auto') => void;
    /** Header variant: hides the visible label, keeps the accessible one. */
    compact?: boolean;
  }

  let { value, onchange, compact = false }: Props = $props();

  function select(raw: string): void {
    const next = parseChoice(raw, LOCALE_CHOICES);
    if (next === undefined) return;
    onchange(next);
  }
</script>

<label class:compact>
  <span class="label">{t('settings.language')}</span>
  <select
    aria-label={compact ? t('settings.language') : undefined}
    {value}
    onchange={(event) => select(event.currentTarget.value)}
  >
    {#each LOCALE_CHOICES as choice (choice.value)}
      <option value={choice.value}>{t(choice.labelKey)}</option>
    {/each}
  </select>
</label>

<style>
  label {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    font-size: var(--fs-1);
  }

  .compact .label {
    /* Visually hidden, still read aloud and still the select's accessible name. */
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  select {
    font: inherit;
    padding: var(--sp-1) var(--sp-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--fg);
  }

  select:hover {
    border-color: var(--accent);
  }
</style>
