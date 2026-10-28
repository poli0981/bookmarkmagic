<script lang="ts">
  import type { DuplicateGroup } from '../core/dedupe';
  import { displayTitle, folderPaths } from '../edit/edit-node';
  import type { EditNode } from '../edit/patch-tree';
  import { t, tPlural } from '../i18n/index.svelte';
  import Button from './Button.svelte';
  import Icon from './icons/Icon.svelte';

  interface Props {
    /** The panel's root, for the tab to move focus into after a delete. */
    element?: HTMLElement | undefined;
    groups: readonly DuplicateGroup<EditNode>[];
    roots: readonly EditNode[];
    busy: boolean;
    onclose: () => void;
    ondelete: (node: EditNode) => void;
    onkeepFirst: () => void;
  }

  let {
    element = $bindable(),
    groups,
    roots,
    busy,
    onclose,
    ondelete,
    onkeepFirst,
  }: Props = $props();

  const extra = $derived(groups.reduce((n, group) => n + group.nodes.length - 1, 0));
  // Two copies of one link differ only by where they live, so say where (uM22).
  const paths = $derived(folderPaths(roots));
</script>

<aside bind:this={element} aria-label={t('edit.duplicates')}>
  <header>
    <span class="eyebrow">{t('edit.duplicates')}</span>
    <Button
      variant="ghost"
      size="sm"
      icon="close"
      label={t('common.dismiss')}
      data-panel-close
      onclick={onclose}
    />
  </header>

  <!-- One sentence with two counts: a wrapper key, never two fragments
       glued with a separator in markup (docs/07 §2). -->
  <p class="summary" aria-live="polite">
    {t('edit.duplicateSummary', {
      links: tPlural('edit.duplicateLinks', groups.length),
      copies: tPlural('edit.extraCopies', extra),
    })}
  </p>

  {#if groups.length === 0}
    <p class="muted">{t('edit.noDuplicates')}</p>
  {:else}
    <Button variant="danger" icon="trash" iconMotion="tilt" disabled={busy} onclick={onkeepFirst}>
      {tPlural('edit.keepFirst', extra)}
    </Button>

    <ul>
      {#each groups as group (group.key)}
        <li>
          <p class="key mono">{group.key}</p>
          <ul class="items">
            {#each group.nodes as node, i (node.id)}
              <li>
                <span class="where">
                  <span class="title">{displayTitle(node, t('edit.untitled'))}</span>
                  <span class="path mono">
                    <Icon name="folder" size={12} />{paths.get(node.id) ?? ''}
                  </span>
                </span>
                {#if i === 0}
                  <span class="keep">{t('edit.keeps')}</span>
                {:else}
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="trash"
                    iconMotion="tilt"
                    label={t('edit.deleteCopy', {
                      title: displayTitle(node, t('edit.untitled')),
                      path: paths.get(node.id) ?? '',
                    })}
                    disabled={busy}
                    data-copy-delete
                    onclick={() => ondelete(node)}
                  />
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
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    padding: var(--sp-3);
    background: var(--bg-raised);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    max-height: min(62vh, 620px);
    overflow: auto;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
  }

  .summary {
    margin: 0;
    font-weight: 600;
    font-size: var(--fs-1);
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
    padding-left: var(--sp-2);
    border-left: 1px solid var(--border);
  }

  .items li {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }

  .where {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .title,
  .path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .path {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    font-size: var(--fs-0);
    color: var(--fg-muted);
  }

  .items :global(button) {
    margin-left: auto;
  }

  .keep {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: var(--fs-0);
    color: var(--success);
  }

  .muted {
    margin: 0;
    color: var(--fg-muted);
    font-size: var(--fs-1);
  }
</style>
