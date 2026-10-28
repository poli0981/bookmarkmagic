<script lang="ts">
  /**
   * What an import did — docs/03 §1 step 9. Bookmarks and folders counted
   * separately, what was skipped and reused, and WHERE it all went: a cancel or
   * a failure used to give a number and no location (uM11).
   */
  import { num, t, tPlural } from '../i18n/index.svelte';
  import { type ImportState, resetImport, type WriteSite } from '../stores/import-session.svelte';
  import { navigate } from '../stores/route.svelte';
  import Button from './Button.svelte';
  import Callout from './Callout.svelte';
  import ErrorCallout from './ErrorCallout.svelte';
  import { focusWhenShown } from './focus-heading';

  type Finished = Extract<ImportState, { kind: 'done' | 'cancelled' | 'error' }>;

  interface Props {
    state: Finished;
  }

  let { state }: Props = $props();

  const site = $derived.by((): WriteSite | undefined => {
    if (state.kind !== 'done') return state.where;
    const wrapper = state.plan.mode === 'new-folder' ? (state.plan.segments[0]?.nodes[0]?.title ?? '') : '';
    return { mode: state.plan.mode, folder: wrapper };
  });

  const wroteSomething = $derived(
    state.kind === 'done' || (state.kind === 'cancelled' ? state.created > 0 : (state.created ?? 0) > 0),
  );

  function where(site: WriteSite): string {
    if (site.mode === 'new-folder') return t('import.whereNewFolder', { folder: site.folder });
    return t(site.mode === 'merge' ? 'import.whereMerge' : 'import.whereReplace');
  }
</script>

<section class="panel">
<h2 class="eyebrow" tabindex="-1" {@attach focusWhenShown}>05 · {t('import.stepResult')}</h2>
{#if state.kind === 'error'}
  <ErrorCallout messageKey={state.messageKey} detail={state.detail} />
{/if}
{#if state.kind === 'done'}
  <Callout tone="success">
    <strong>
      {t('import.doneSummary', {
        bookmarks: tPlural('import.countBookmarks', state.plan.stats.bookmarkCount),
        folders: tPlural('import.countFolders', state.plan.stats.folderCount),
      })}
    </strong>
  </Callout>
  <ul class="facts">
    <li>
      {t('import.skipped', {
        existing: num(state.plan.stats.skippedExisting),
        inFile: num(state.plan.stats.skippedInFile),
      })}
    </li>
    {#if state.plan.stats.reusedFolders > 0}
      <li>{tPlural('import.reused', state.plan.stats.reusedFolders)}</li>
    {/if}
    {#if site !== undefined}<li>{where(site)}</li>{/if}
  </ul>
{:else if state.kind === 'cancelled'}
  <Callout tone="warn">{tPlural('import.cancelledSummary', state.created)}</Callout>
  {#if state.backupFilename !== undefined}
    <Callout tone="danger">{t('import.cancelledAfterClear')}</Callout>
  {/if}
{:else}
  {#if state.created !== undefined && state.created > 0}
    <p class="muted">{tPlural('import.partialCreated', state.created)}</p>
  {/if}
  {#if state.removed !== undefined && state.removed > 0}
    <Callout tone="danger">{tPlural('import.partialCleared', state.removed)}</Callout>
  {/if}
{/if}

{#if state.kind !== 'done' && wroteSomething && site !== undefined && site.mode !== 'replace'}
  <p class="muted">{where(site)}</p>
{/if}
{#if state.kind !== 'done' && state.backupFilename !== undefined}
  <p class="muted">{t('import.backupHint', { name: state.backupFilename })}</p>
{/if}
{#if wroteSomething}
  <p class="muted">{t('import.dateNotice')}</p>
{/if}
<div class="actions">
  {#if state.kind === 'done'}
    <Button variant="primary" icon="edit" onclick={() => navigate('edit')}>{t('import.openEdit')}</Button>
  {/if}
  <Button onclick={resetImport}>{t('import.another')}</Button>
</div>
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    min-width: 0;
  }

  h2 {
    margin: 0;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    margin-top: var(--sp-2);
  }

  .facts {
    margin: var(--sp-3) 0 0;
    padding-left: var(--sp-4);
    color: var(--fg-muted);
    font-size: var(--fs-1);
  }

  .facts li + li {
    margin-top: var(--sp-1);
  }

  .muted {
    margin: var(--sp-2) 0 0;
    color: var(--fg-muted);
    font-size: var(--fs-1);
  }
</style>
