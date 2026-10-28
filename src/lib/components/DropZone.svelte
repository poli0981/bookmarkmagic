<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import { MAX_FILE_BYTES } from '../core/limits';

  interface Props {
    onfile: (file: File) => void;
  }

  let { onfile }: Props = $props();

  let dragging = $state(false);
  let input: HTMLInputElement | undefined = $state();

  const megabytes = Math.round(MAX_FILE_BYTES / (1024 * 1024));

  function take(files: FileList | null | undefined): void {
    const file = files?.[0];
    if (file !== undefined) onfile(file);
  }

  function onDrop(event: DragEvent): void {
    event.preventDefault();
    dragging = false;
    take(event.dataTransfer?.files);
  }
</script>

<!-- The whole zone is a button so keyboard users get the picker for free; the
     drag handlers ride along on the same element. -->
<button
  type="button"
  class="zone"
  class:dragging
  ondragover={(e) => {
    e.preventDefault();
    dragging = true;
  }}
  ondragleave={() => {
    dragging = false;
  }}
  ondrop={onDrop}
  onclick={() => input?.click()}
>
  <span class="glyph" aria-hidden="true">⬆</span>
  <span class="hint">{t('import.dropHint', { size: `${megabytes} MB` })}</span>
  <span class="formats">{t('import.dropFormats')}</span>
</button>

<!-- No `accept`: the content decides the format (docs/04 intro), and Chrome's
     profile file is called just `Bookmarks` — an extension filter hid it. -->
<input
  bind:this={input}
  type="file"
  onchange={(e) => take(e.currentTarget.files)}
  hidden
/>

<style>
  .zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-3);
    width: 100%;
    padding: var(--sp-6);
    font: inherit;
    color: var(--fg-muted);
    background: transparent;
    border: 2px dashed var(--border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .zone:hover,
  .dragging {
    border-color: var(--accent);
    color: var(--fg);
  }

  .glyph {
    font-size: var(--fs-4);
    color: var(--accent);
  }

  .hint {
    text-align: center;
    max-width: 40ch;
  }

  .formats {
    text-align: center;
    max-width: 60ch;
    font-size: var(--fs-1);
  }
</style>
