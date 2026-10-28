<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import Button from './Button.svelte';
  import Icon from './icons/Icon.svelte';

  interface Props {
    query: string;
    /** Bound out so ⌘/Ctrl-F can focus it from the tab's window handler. */
    input?: HTMLInputElement | undefined;
    /** A bulk command is running. */
    busy: boolean;
    duplicatesOpen: boolean;
    /** False when the focused row's folder has nothing to sort. */
    canSort: boolean;
    onquery: (value: string) => void;
    onnewFolder: () => void;
    onsort: () => void;
    ontoggleDuplicates: () => void;
    onexpandAll: () => void;
    oncollapseAll: () => void;
  }

  let {
    query,
    input = $bindable(),
    busy,
    duplicatesOpen,
    canSort,
    onquery,
    onnewFolder,
    onsort,
    ontoggleDuplicates,
    onexpandAll,
    oncollapseAll,
  }: Props = $props();
</script>

<div class="toolbar" role="toolbar" aria-label={t('common.edit')}>
  <label class="search">
    <Icon name="search" size={14} />
    <input
      bind:this={input}
      type="search"
      placeholder={t('edit.search')}
      aria-label={t('edit.search')}
      value={query}
      oninput={(event) => onquery(event.currentTarget.value)}
    />
    <kbd aria-hidden="true">Ctrl F</kbd>
  </label>
  <div class="group">
    <Button icon="folder-plus" disabled={busy} onclick={onnewFolder}>{t('edit.newFolder')}</Button>
    <Button icon="sort" iconMotion="bob" disabled={busy || !canSort} onclick={onsort}>{t('edit.sort')}</Button>
    <Button icon="layers" aria-pressed={duplicatesOpen} onclick={ontoggleDuplicates}>
      {t('edit.findDuplicates')}
    </Button>
  </div>
  <div class="group">
    <Button variant="ghost" icon="expand" label={t('edit.expandAll')} onclick={onexpandAll} />
    <Button variant="ghost" icon="collapse" label={t('edit.collapseAll')} onclick={oncollapseAll} />
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
    margin-bottom: var(--sp-3);
  }

  .search {
    flex: 1;
    min-width: 18ch;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 0 var(--sp-2);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-sunken);
    color: var(--fg-muted);
  }

  .search:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .search input {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-size: var(--fs-1);
    padding: 7px 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--fg);
  }

  kbd {
    font-size: var(--fs-0);
    padding: 0 5px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--fg-muted);
  }

  .group {
    display: flex;
    gap: var(--sp-1);
  }
</style>
