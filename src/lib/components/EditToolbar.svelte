<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import Button from './Button.svelte';

  interface Props {
    query: string;
    /** Bound out so ⌘/Ctrl-F can focus it from the tab's window handler. */
    input?: HTMLInputElement | undefined;
    onquery: (value: string) => void;
    onnewFolder: () => void;
    ontoggleDuplicates: () => void;
    onexpandAll: () => void;
    oncollapseAll: () => void;
  }

  let {
    query,
    input = $bindable(),
    onquery,
    onnewFolder,
    ontoggleDuplicates,
    onexpandAll,
    oncollapseAll,
  }: Props = $props();
</script>

<div class="toolbar">
  <input
    bind:this={input}
    type="search"
    placeholder={t('edit.search')}
    aria-label={t('edit.search')}
    value={query}
    oninput={(event) => onquery(event.currentTarget.value)}
  />
  <Button onclick={onnewFolder}>{t('edit.newFolder')}</Button>
  <Button onclick={ontoggleDuplicates}>{t('edit.findDuplicates')}</Button>
  <Button onclick={onexpandAll}>{t('edit.expandAll')}</Button>
  <Button onclick={oncollapseAll}>{t('edit.collapseAll')}</Button>
</div>

<style>
  /* Copied verbatim from EditTab — this is a move, not a redesign. */
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    margin-bottom: var(--sp-3);
  }

  .toolbar input {
    font: inherit;
    flex: 1;
    min-width: 12ch;
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--fg);
  }
</style>
