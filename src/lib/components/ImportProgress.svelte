<script lang="ts">
  /**
   * Step 04 of an import — docs/03 §1 steps 6–8: the safety backup, its
   * attestation, the Replace clear, and the write itself. No Cancel while the
   * tree is being cleared: it used to stay live there and report "0 created".
   */
  import { num, t } from '../i18n/index.svelte';
  import {
    answerAttestation,
    cancelWrite,
    type ImportState,
  } from '../stores/import-session.svelte';
  import Button from './Button.svelte';
  import Callout from './Callout.svelte';
  import { focusLost, focusWhenShown } from './focus-heading';
  import ProgressBar from './ProgressBar.svelte';

  type Writing = Extract<ImportState, { kind: 'backing-up' | 'attesting' | 'clearing' | 'writing' }>;

  interface Props {
    phase: Writing;
  }

  let { phase }: Props = $props();
  let heading = $state<HTMLElement | undefined>();

  // The step stays mounted from the backup to the last write, so its heading
  // takes focus once on its own. A phase change can then remove the control
  // that had focus — confirming the backup removes both of its buttons — and
  // focus fell to `<body>`: hand it to the heading again.
  $effect(() => {
    void phase.kind;
    if (heading !== undefined && focusLost()) heading.focus();
  });
</script>

<section class="panel">
  <h2 class="eyebrow" tabindex="-1" bind:this={heading} {@attach focusWhenShown}>
    04 · {t('import.stepWriting')}
  </h2>
  {#if phase.kind === 'backing-up'}
    <Callout tone="warn">{t('import.backingUp')}</Callout>
  {:else if phase.kind === 'attesting'}
    <!-- The anchor download reports nothing, so this confirmation is the only
         thing standing between the user and an unbacked-up deletion. -->
    <Callout tone="danger">{t('import.attest', { name: phase.backupFilename })}</Callout>
    <div class="actions">
      <Button variant="danger" onclick={() => answerAttestation(true)}>{t('import.attestConfirm')}</Button>
      <Button onclick={() => answerAttestation(false)}>{t('common.cancel')}</Button>
    </div>
  {:else if phase.kind === 'clearing'}
    <Callout tone="danger">{t('import.clearing')}</Callout>
  {:else}
    <ProgressBar done={phase.progress.done} total={phase.progress.total} label={t('common.import')} />
    <p class="muted mono">
      {t('import.progress', { done: num(phase.progress.done), total: num(phase.progress.total) })}
      {#if phase.progress.currentPath !== ''}<span class="path">{phase.progress.currentPath}</span>{/if}
    </p>
    <Callout tone="warn">{t('import.keepTabOpen')}</Callout>
    <div class="actions"><Button icon="close" onclick={cancelWrite}>{t('common.cancel')}</Button></div>
  {/if}
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
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
</style>
