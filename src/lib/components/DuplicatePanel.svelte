<script lang="ts">
  import type { DuplicateGroup } from '../core/dedupe';
  import type { EditNode } from '../edit/patch-tree';
  import { t } from '../i18n/index.svelte';
  import Button from './Button.svelte';

  interface Props {
    groups: readonly DuplicateGroup<EditNode>[];
    onclose: () => void;
    ondelete: (node: EditNode) => void;
    onkeepFirst: () => void;
  }

  let { groups, onclose, ondelete, onkeepFirst }: Props = $props();

  const extra = $derived(groups.reduce((n, group) => n + group.nodes.length - 1, 0));
</script>

<aside aria-label={t('edit.duplicates')}>
  <header>
    <strong>{t('edit.duplicatesFound', { groups: groups.length, extra })}</strong>
    <button class="close" aria-label={t('common.cancel')} onclick={onclose}>✕</button>
  </header>

  {#if groups.length === 0}
    <p class="muted">{t('edit.noDuplicates')}</p>
  {:else}
    <Button variant="danger" onclick={onkeepFirst}>{t('edit.keepFirst', { n: extra })}</Button>

    <ul>
      {#each groups as group (group.key)}
        <li>
          <p class="key">{group.key}</p>
          <ul class="items">
            {#each group.nodes as node, i (node.id)}
              <li>
                <span class="title">{node.title}</span>
                {#if i === 0}
                  <span class="keep">{t('edit.keeps')}</span>
                {:else}
                  <button onclick={() => ondelete(node)}>{t('edit.delete')}</button>
                {/if}
              </li>
            {/each}
          </ul>
        </li>
      {/each}
    </ul>
  {/if}
</aside>

<style>
  aside {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--sp-3);
    background: var(--bg-raised);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    max-height: 520px;
    overflow: auto;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
  }

  .close {
    font: inherit;
    background: none;
    border: none;
    color: var(--fg-muted);
    cursor: pointer;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }

  .key {
    margin: 0 0 var(--sp-1);
    font-size: var(--fs-0);
    color: var(--fg-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .items {
    gap: var(--sp-1);
    font-size: var(--fs-1);
  }

  .items li {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }

  .items .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .items button {
    margin-left: auto;
    font: inherit;
    font-size: var(--fs-0);
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--danger);
    cursor: pointer;
    padding: 0 var(--sp-2);
  }

  .keep {
    margin-left: auto;
    font-size: var(--fs-0);
    color: var(--success);
  }

  .muted {
    margin: 0;
    color: var(--fg-muted);
    font-size: var(--fs-1);
  }
</style>
