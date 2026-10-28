<script lang="ts">
  /**
   * The import's spoken status — docs/06 §5. One live region that is always
   * in the page and only changes its text: a region inserted already filled is
   * not reliably announced, and the progress and result sections each come and
   * go with their state (v1.1.0 review). Failures are not repeated here: their
   * callouts are alerts already.
   */
  import { t, tPlural } from '../i18n/index.svelte';
  import type { ImportState } from '../stores/import-session.svelte';

  interface Props {
    state: ImportState;
  }

  let { state }: Props = $props();

  const message = $derived.by((): string => {
    switch (state.kind) {
      case 'validating':
        return t('import.reading', { name: state.filename });
      case 'backing-up':
        return t('import.backingUp');
      case 'clearing':
        return t('import.clearing');
      // Once, not per progress tick: the text does not change between ticks.
      case 'writing':
        return t('import.stepWriting');
      case 'done':
        return t('import.doneSummary', {
          bookmarks: tPlural('import.countBookmarks', state.plan.stats.bookmarkCount),
          folders: tPlural('import.countFolders', state.plan.stats.folderCount),
        });
      case 'cancelled':
        return tPlural('import.cancelledSummary', state.created);
      default:
        return '';
    }
  });
</script>

<p class="sr-only" role="status" aria-live="polite">{message}</p>
