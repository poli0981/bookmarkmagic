<script lang="ts">
  import type { ThemePreference } from '../browser/storage';
  import { t } from '../i18n/index.svelte';
  import { THEME_CHOICES } from '../settings/options';
  import Icon, { type IconName } from './icons/Icon.svelte';

  interface Props {
    value: ThemePreference;
    onchange: (next: ThemePreference) => void;
    /** Header variant: glyphs instead of words, labels moved to aria-label. */
    compact?: boolean;
  }

  let { value, onchange, compact = false }: Props = $props();

  // A segmented control rather than docs/06 §3's single cycling glyph: one code
  // path for both placements, and the current choice is visible rather than
  // inferred. Self-drawn icons replace 1.0.x's emoji, which rendered differently
  // on every OS and could not follow the theme's colours.
  const GLYPH: Record<ThemePreference, IconName> = {
    system: 'monitor',
    light: 'sun',
    dark: 'moon',
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
      <Icon name={GLYPH[choice.value]} size={14} motion={choice.value === 'light' ? 'spin' : 'none'} />
      {#if !compact}<span>{t(choice.labelKey)}</span>{/if}
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
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    font: inherit;
    padding: 5px var(--sp-3);
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

  /* `button:hover` above is the more specific rule, and --fg on the accent
     fill is under 3:1: hovering the chosen segment dimmed its own label. */
  .selected:hover {
    color: var(--accent-fg);
  }

  /* The inset ring sits ON the selected segment's fill — and roving focus only
     ever lands on the selected segment. In --accent it was accent on accent:
     no visible focus at all (docs/06 §5). Drawn 2px further in, so the fill
     shows on both sides of it: at the very edge, a ring in the page's own
     colour only made the segment look 2px smaller. */
  .selected:focus-visible {
    outline-color: var(--accent-fg);
    outline-offset: -4px;
  }

  /* Contrast themes replace the fill, so the choice is said in system colours.
     `forced-color-adjust: none` because the label sits on that fill: Chrome
     paints a backplate in the page colour behind forced text, which left
     "Light" as a black box on the highlight. */
  @media (forced-colors: active) {
    .selected,
    .selected:hover {
      forced-color-adjust: none;
      background: Highlight;
      color: HighlightText;
    }

    .selected:focus-visible {
      outline-color: HighlightText;
    }
  }

  .compact button {
    padding: 5px 7px;
  }
</style>
