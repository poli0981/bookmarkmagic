<script lang="ts">
  /**
   * The chevron that opens a folder — docs/06 §5. One component for the #edit
   * tree, the import preview and the export picker, so the three cannot drift.
   *
   * With a `label` it is a real disclosure button: `aria-expanded`, a name,
   * a tab stop. Without one it is the #edit tree's mouse shortcut — the tree
   * itself carries `aria-expanded` and the arrow keys, so the button is hidden
   * from assistive technology and is not a tab stop. With no `expanded` at all
   * the row has nothing to open, and an empty slot keeps the columns aligned.
   *
   * The glyph is 16 px; the target is 24 (WCAG 2.5.8), grown by a pseudo-element
   * so the row's layout does not change.
   */
  import Icon from './icons/Icon.svelte';

  interface Props {
    expanded?: boolean | undefined;
    label?: string | undefined;
    onclick?: (event: MouseEvent) => void;
  }

  let { expanded, label, onclick }: Props = $props();
</script>

{#if expanded === undefined}
  <span class="disclosure" aria-hidden="true"></span>
{:else if label === undefined}
  <button class="disclosure" tabindex="-1" aria-hidden="true" {onclick}>
    <Icon name="chevron" size={12} turned={expanded} />
  </button>
{:else}
  <button class="disclosure" aria-expanded={expanded} aria-label={label} {onclick}>
    <Icon name="chevron" size={12} turned={expanded} />
  </button>
{/if}

<style>
  .disclosure {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex: none;
    background: none;
    border: none;
    color: var(--fg-muted);
    padding: 0;
  }

  button {
    cursor: pointer;
  }

  button::after {
    content: '';
    position: absolute;
    inset: -4px;
  }
</style>
