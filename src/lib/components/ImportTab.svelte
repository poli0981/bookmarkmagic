<script lang="ts">
  import { describeError } from '../browser/describe-error';
  import { timestampSuffix } from '../browser/download';
  import { BmAborted } from '../browser/errors';
  import { num, t } from '../i18n/index.svelte';
  import { prepareImport, runImport } from '../import/run-import';
  import { getSettings } from '../stores/settings.svelte';
  import {
    answerAttestation,
    awaitAttestation,
    beginWrite,
    cancelWrite,
    getImportOptions,
    getImportState,
    getPrepared,
    resetImport,
    setImportOptions,
    setImportState,
    setPrepared,
  } from '../stores/import-session.svelte';
  import { navigate } from '../stores/route.svelte';
  import Button from './Button.svelte';
  import Callout from './Callout.svelte';
  import DropZone from './DropZone.svelte';
  import ErrorCallout from './ErrorCallout.svelte';
  import ImportOptions from './ImportOptions.svelte';
  import ProgressBar from './ProgressBar.svelte';
  import StatsCard from './StatsCard.svelte';
  import TreePreview from './TreePreview.svelte';
  import WarningList from './WarningList.svelte';

  // `prepared` lives in the session store, not here: the Manager unmounts this
  // component on every route change, and losing it would leave a preview with
  // no badges and a dead Import button (docs/03 §5).
  const prepared = $derived(getPrepared());
  const session = $derived(getImportState());
  const options = $derived(getImportOptions());

  async function onFile(file: File): Promise<void> {
    setImportState({ kind: 'validating', filename: file.name });
    try {
      const result = await prepareImport(file);
      setPrepared(result);
      setImportOptions({ mode: getSettings().defaultMergeMode });
      setImportState({
        kind: 'parsed',
        filename: file.name,
        result: result.result,
        duplicates: result.duplicates,
      });
    } catch (err) {
      setPrepared(undefined);
      setImportState({ kind: 'error', filename: file.name, ...describeError(err) });
    }
  }

  async function start(filename: string): Promise<void> {
    const current = prepared;
    if (current === undefined) return;
    const signal = beginWrite();
    const now = new Date();
    const backupFilename = `bookmarkmagic-backup-${timestampSuffix(now)}.json`;
    /** Set once the backup is on disk. Nothing may point at the file before. */
    let backupProven = false;

    // runImport opens the save picker as its first statement, so the transient
    // activation from this click still holds when the dialog appears.
    setImportState(
      options.mode === 'replace'
        ? { kind: 'backing-up', filename }
        : { kind: 'writing', filename, progress: { done: 0, total: 0, currentPath: '' } },
    );

    try {
      const outcome = await runImport({
        prepared: current,
        mode: options.mode,
        dedupe: options.dedupe,
        newFolderTitle: t('import.folderName', { date: formatFolderDate(now) }),
        backupFilename,
        now,
        signal,
        onProgress: (progress) => {
          setImportState({ kind: 'writing', filename, progress });
        },
        // Backup proven; deletion starts now. No Cancel is offered here — the
        // button used to stay live through the whole delete, letting a user
        // cancel and be told "0 items created" after their tree was wiped.
        //
        // This callback is also the ONLY signal that the backup exists: it runs
        // immediately after `proveBackup` returned, and nothing else does.
        onClearing: () => {
          backupProven = true;
          setImportState({ kind: 'clearing', filename });
        },
        confirmUnprovenBackup: () => {
          setImportState({ kind: 'attesting', filename, backupFilename });
          return awaitAttestation();
        },
      });
      setImportState({ kind: 'done', filename, created: outcome.created, plan: outcome.plan });
    } catch (err) {
      if (err instanceof BmAborted) {
        setImportState({
          kind: 'cancelled',
          filename,
          created: err.done,
          // A cancel AFTER the clear is not "nothing happened": the tree is
          // gone and only `created` of it has been rebuilt. Saying "N items
          // created" alone reads as a harmless no-op on an empty browser.
          ...(backupProven ? { backupFilename } : {}),
        });
        return;
      }
      setImportState({
        kind: 'error',
        filename,
        ...describeError(err),
        // `backupProven`, not "mode was replace and this is not a BmBackupError".
        // `runImport` resolves the roots BEFORE proving the backup, so a failure
        // there — a policy-managed profile raising NO_WRITABLE_ROOTS, say —
        // reaches this catch with no file on disk. Telling a frightened user to
        // restore a backup that was never written is worse than saying nothing.
        ...(backupProven ? { backupFilename } : {}),
      });
    }
  }

  /**
   * ISO date + local time, matching the `import.folderName` key (docs/07 §3).
   *
   * Deliberately NOT run through Intl, unlike every count in this file: docs/07
   * §3 pins the folder name to the localized *word* plus an ISO date
   * (`Đã nhập 2026-07-03`). Localizing it here would change the names of
   * bookmark folders this extension creates in the user's browser.
   */
  function formatFolderDate(now: Date): string {
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

</script>

{#if session.kind === 'idle'}
  <DropZone onfile={(file) => void onFile(file)} />
{:else if session.kind === 'validating'}
  <p class="muted">{t('import.reading', { name: session.filename })}</p>
{:else if session.kind === 'parsed'}
  <div class="split">
    <section aria-label={t('import.preview')}>
      <TreePreview roots={session.result.roots} status={prepared?.status ?? new WeakMap()} />
    </section>
    <section class="side">
      <StatsCard stats={session.result.stats} duplicates={session.duplicates} />
      <WarningList warnings={session.result.warnings} />
      <ImportOptions
        mode={options.mode}
        dedupe={options.dedupe}
        duplicates={session.duplicates}
        onchange={(patch) => setImportOptions(patch)}
      />
      <p class="muted">{t('import.dateNotice')}</p>
      <Button
        variant={options.mode === 'replace' ? 'danger' : 'primary'}
        onclick={() => void start(session.filename)}
      >
        {t('import.start', { n: num(session.result.stats.bookmarks) })}
      </Button>
    </section>
  </div>
{:else if session.kind === 'backing-up'}
  <Callout tone="warn">{t('import.backingUp')}</Callout>
{:else if session.kind === 'attesting'}
  <!-- The anchor download reports nothing, so this confirmation is the only
       thing standing between the user and an unbacked-up deletion. -->
  <Callout tone="danger">{t('import.attest', { name: session.backupFilename })}</Callout>
  <div class="actions">
    <Button variant="danger" onclick={() => answerAttestation(true)}>
      {t('import.attestConfirm')}
    </Button>
    <Button onclick={() => answerAttestation(false)}>{t('common.cancel')}</Button>
  </div>
{:else if session.kind === 'clearing'}
  <Callout tone="danger">{t('import.clearing')}</Callout>
{:else if session.kind === 'writing'}
  <div class="writing">
    <ProgressBar
      done={session.progress.done}
      total={session.progress.total}
      label={t('common.import')}
    />
    <p class="muted">
      {t('import.progress', { done: num(session.progress.done), total: num(session.progress.total) })}
      {#if session.progress.currentPath !== ''}<span class="path">{session.progress.currentPath}</span>{/if}
    </p>
    <Callout tone="warn">{t('import.keepTabOpen')}</Callout>
    <Button onclick={cancelWrite}>{t('common.cancel')}</Button>
  </div>
{:else if session.kind === 'done'}
  <Callout tone="success">{t('import.doneSummary', { created: num(session.created) })}</Callout>
  <p class="muted">
    {t('import.skipped', {
      existing: num(session.plan.stats.skippedExisting),
      inFile: num(session.plan.stats.skippedInFile),
    })}
  </p>
  <p class="muted">{t('import.dateNotice')}</p>
  <div class="actions">
    <Button variant="primary" onclick={() => navigate('edit')}>{t('import.openEdit')}</Button>
    <Button
      onclick={resetImport}>{t('import.another')}</Button
    >
  </div>
{:else if session.kind === 'cancelled'}
  <Callout tone="warn">{t('import.cancelledSummary', { created: num(session.created) })}</Callout>
  {#if session.backupFilename !== undefined}
    <Callout tone="danger">{t('import.cancelledAfterClear')}</Callout>
    <p class="muted">{t('import.backupHint', { name: session.backupFilename })}</p>
  {/if}
  <p class="muted">{t('import.dateNotice')}</p>
  <Button
    onclick={resetImport}>{t('import.another')}</Button
  >
{:else if session.kind === 'error'}
  <ErrorCallout messageKey={session.messageKey} detail={session.detail} />
  {#if session.created !== undefined && session.created > 0}
    <p class="muted">{t('import.partialCreated', { created: num(session.created) })}</p>
  {/if}
  {#if session.removed !== undefined && session.removed > 0}
    <Callout tone="danger">{t('import.partialCleared', { removed: num(session.removed) })}</Callout>
  {/if}
  {#if session.backupFilename !== undefined}
    <p class="muted">{t('import.backupHint', { name: session.backupFilename })}</p>
  {/if}
  <Button
    onclick={resetImport}>{t('import.another')}</Button
  >
{/if}

<style>
  .split {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: var(--sp-5);
    align-items: start;
  }

  @media (max-width: 780px) {
    .split {
      grid-template-columns: 1fr;
    }
  }

  .side {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }

  .writing {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }

  .muted {
    color: var(--fg-muted);
    font-size: var(--fs-1);
    margin: 0;
  }

  .path {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    gap: var(--sp-2);
    margin-top: var(--sp-3);
  }

</style>
