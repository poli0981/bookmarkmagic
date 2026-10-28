<script lang="ts">
  import { MAX_FILE_BYTES } from '../core/limits';
  import { t } from '../i18n/index.svelte';
  import Icon from './icons/Icon.svelte';

  interface Props {
    onfile: (file: File) => void;
  }

  let { onfile }: Props = $props();

  let dragging = $state(false);
  let input: HTMLInputElement | undefined = $state();
  /**
   * dragenter/dragleave fire for every child the pointer crosses, so a single
   * boolean flickered off and on over the icon and the text (uL31). A depth
   * count settles only when the pointer really leaves the zone.
   */
  let depth = 0;

  const megabytes = Math.round(MAX_FILE_BYTES / (1024 * 1024));

  function take(files: FileList | null | undefined): void {
    const file = files?.[0];
    if (file !== undefined) onfile(file);
  }
</script>

<!-- The whole zone is a button so keyboard users get the picker for free; the
     drag handlers ride along on the same element. -->
<button
  type="button"
  class="zone"
  class:dragging
  ondragenter={(event) => {
    event.preventDefault();
    depth++;
    dragging = true;
  }}
  ondragover={(event) => event.preventDefault()}
  ondragleave={() => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) dragging = false;
  }}
  ondrop={(event) => {
    event.preventDefault();
    depth = 0;
    dragging = false;
    take(event.dataTransfer?.files);
  }}
  onclick={() => input?.click()}
>
  <span class="glyph"><Icon name="upload" size={28} motion="bob" /></span>
  <span class="hint">{t('import.dropHint', { size: `${megabytes} MB` })}</span>
  <span class="formats">{t('import.dropFormats')}</span>
</button>

<!-- No `accept`: the content decides the format (docs/04 intro), and Chrome's
     profile file is called just `Bookmarks` — an extension filter hid it. Only
     the first file of a multi-file drop is read; the picker allows one. -->
<input bind:this={input} type="file" onchange={(event) => take(event.currentTarget.files)} hidden />

<style>
  .zone {
    --ants: var(--border-strong);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-3);
    width: 100%;
    padding: var(--sp-6) var(--sp-5);
    font: inherit;
    color: var(--fg-muted);
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    /* Marching ants: four dashed gradients instead of a dashed border, so the
       dashes can travel. */
    background:
      linear-gradient(90deg, var(--ants) 50%, transparent 50%) top left / 14px 1.5px repeat-x,
      linear-gradient(90deg, var(--ants) 50%, transparent 50%) bottom left / 14px 1.5px repeat-x,
      linear-gradient(0deg, var(--ants) 50%, transparent 50%) top left / 1.5px 14px repeat-y,
      linear-gradient(0deg, var(--ants) 50%, transparent 50%) top right / 1.5px 14px repeat-y,
      var(--bg);
  }

  .zone:hover,
  .dragging {
    --ants: var(--accent);
    color: var(--fg);
    background-color: var(--accent-subtle);
  }

  .glyph {
    display: inline-flex;
    padding: var(--sp-3);
    border-radius: 50%;
    background: var(--accent-subtle);
    color: var(--accent);
  }

  .hint {
    font-weight: 600;
    text-align: center;
    max-width: 44ch;
  }

  .formats {
    text-align: center;
    max-width: 60ch;
    font-size: var(--fs-1);
  }

  @media (prefers-reduced-motion: no-preference) {
    .zone:hover,
    .dragging {
      animation: march 1s linear infinite;
    }

    @keyframes march {
      to {
        background-position:
          14px 0,
          -14px 100%,
          0 -14px,
          100% 14px,
          0 0;
      }
    }
  }
</style>
