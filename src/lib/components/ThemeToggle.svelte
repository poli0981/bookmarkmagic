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

  let buttons: HTMLButtonElement[] = $state([]);

  /**
   * The radiogroup keyboard pattern, which the ARIA roles above promise.
   *
   * Without this the roles are a lie: a screen reader announces "radio button,
   * 1 of 3" and switches to forms mode, then the arrow keys do nothing and all
   * three are separate tab stops — the inverse of the pattern (WCAG 4.1.2).
   *
   * Bound to each radio rather than the group, because only the radios are
   * focusable — a keyboard handler on a non-focusable container never fires,
   * which is exactly what svelte-check's `a11y_interactive_supports_focus`
   * warns about.
   */
  function onKeyDown(event: KeyboardEvent): void {
    const index = THEME_CHOICES.findIndex((choice) => choice.value === value);
    if (index === -1) return;

    let next: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (index + 1) % THEME_CHOICES.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (index - 1 + THEME_CHOICES.length) % THEME_CHOICES.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = THEME_CHOICES.length - 1;
    }
    if (next === undefined) return;

    event.preventDefault();
    const choice = THEME_CHOICES[next];
    if (choice === undefined) return;
    onchange(choice.value);
    buttons[next]?.focus();
  }
</script>

<div class="group" class:compact role="radiogroup" aria-label={t('settings.theme')}>
  {#each THEME_CHOICES as choice, index (choice.value)}
    <button
      bind:this={buttons[index]}
      type="button"
      role="radio"
      aria-checked={value === choice.value}
      aria-label={compact ? t(choice.labelKey) : undefined}
      tabindex={value === choice.value ? 0 : -1}
      class:selected={value === choice.value}
      onclick={() => onchange(choice.value)}
      onkeydown={onKeyDown}
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
  /* No `overflow: hidden` here. It clipped the global :focus-visible ring,
     which base.css draws at outline-offset: 2px — entirely outside the clip
     region — leaving the theme control with no keyboard focus indicator at all.
     The corner rounding it was for is done per-child instead. */
  .group {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
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

  button:first-child {
    border-top-left-radius: var(--radius-sm);
    border-bottom-left-radius: var(--radius-sm);
  }

  button:last-child {
    border-right: none;
    border-top-right-radius: var(--radius-sm);
    border-bottom-right-radius: var(--radius-sm);
  }

  /* Inset so the ring stays inside the group's own border box. */
  button:focus-visible {
    outline-offset: -2px;
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
