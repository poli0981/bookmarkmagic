<script lang="ts" module>
  /** Every icon the UI draws. Simple geometric strokes, drawn for this project. */
  export type IconName =
    | 'upload'
    | 'download'
    | 'edit'
    | 'folder'
    | 'folder-open'
    | 'folder-plus'
    | 'link'
    | 'trash'
    | 'move'
    | 'copy'
    | 'external'
    | 'search'
    | 'chevron'
    | 'check'
    | 'close'
    | 'gear'
    | 'info'
    | 'sun'
    | 'moon'
    | 'monitor'
    | 'globe'
    | 'warning'
    | 'error'
    | 'sort'
    | 'layers'
    | 'expand'
    | 'collapse'
    | 'file'
    | 'shield'
    | 'code'
    | 'heart'
    | 'backup'
    | 'lock'
    | 'logo';

  /**
   * Motion an icon can carry. All of it is defined inside
   * `prefers-reduced-motion: no-preference` (docs/06 §5), so asking for motion
   * is always safe — a user who opted out gets a still icon.
   */
  export type IconMotion = 'none' | 'spin' | 'bob' | 'tilt' | 'draw' | 'pulse';
</script>

<script lang="ts">
  interface Props {
    name: IconName;
    size?: number;
    motion?: IconMotion;
    /** Rotated a quarter turn — the disclosure chevron when open. */
    turned?: boolean;
  }

  let { name, size = 16, motion = 'none', turned = false }: Props = $props();
</script>

<!-- Decorative by contract: the control around it carries the accessible name. -->
<svg
  class="icon {motion}"
  class:turned
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#if name === 'upload'}
    <path class="arrow" d="M12 15V4m-4.5 4.5L12 4l4.5 4.5" /><path d="M4 14v5h16v-5" />
  {:else if name === 'download'}
    <path class="arrow" d="M12 4v11m-4.5-4.5L12 15l4.5-4.5" /><path d="M4 14v5h16v-5" />
  {:else if name === 'edit'}
    <path d="M14.5 5.5l4 4L9 19H5v-4z" /><path d="M13 7l4 4" />
  {:else if name === 'folder'}
    <path d="M3 7.5V18a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-8l-2-2.5H4a1 1 0 0 0-1 1z" />
  {:else if name === 'folder-open'}
    <path d="M3 18V6.5a1 1 0 0 1 1-1h5l2 2.5h7a1 1 0 0 1 1 1V11" /><path d="M3 18l3-7h15l-3 7z" />
  {:else if name === 'folder-plus'}
    <path d="M3 7.5V18a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-8l-2-2.5H4a1 1 0 0 0-1 1z" /><path d="M12 11v5m-2.5-2.5h5" />
  {:else if name === 'link'}
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />
  {:else if name === 'trash'}
    <g class="lid"><path d="M4 7h16" /><path d="M9.5 7V4.5h5V7" /></g><path d="M6 7l1 13h10l1-13" /><path d="M10 11v5m4-5v5" />
  {:else if name === 'move'}
    <path d="M3 7.5V18a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-8l-2-2.5H4a1 1 0 0 0-1 1z" /><path class="arrow" d="M8 13.5h7m-2.5-2.5l2.5 2.5-2.5 2.5" />
  {:else if name === 'copy'}
    <rect x="8" y="8" width="12" height="12" rx="1.5" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
  {:else if name === 'external'}
    <path d="M14 4h6v6m0-6l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  {:else if name === 'search'}
    <circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" />
  {:else if name === 'chevron'}
    <path d="M9 5l7 7-7 7" />
  {:else if name === 'check'}
    <path class="stroke" pathLength="1" d="M4.5 12.5l5 5 10-11" />
  {:else if name === 'close'}
    <path d="M6 6l12 12M18 6L6 18" />
  {:else if name === 'gear'}
    <g class="rotor"><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5m0 13V21m9-9h-2.5m-13 0H3m15.4-6.4l-1.8 1.8M7.4 16.6l-1.8 1.8m12.8 0l-1.8-1.8M7.4 7.4L5.6 5.6" /></g>
  {:else if name === 'info'}
    <circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-9.5v.5" />
  {:else if name === 'sun'}
    <g class="rotor"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2m0 15v2m9.5-9.5h-2m-15 0h-2m15.2-6.7l-1.4 1.4M6.7 17.3l-1.4 1.4m13.4 0l-1.4-1.4M6.7 6.7L5.3 5.3" /></g>
  {:else if name === 'moon'}
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  {:else if name === 'monitor'}
    <rect x="3" y="4.5" width="18" height="12" rx="1.5" /><path d="M9 20h6m-3-3.5V20" />
  {:else if name === 'globe'}
    <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3z" />
  {:else if name === 'warning'}
    <path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5m0 2.5v.5" />
  {:else if name === 'error'}
    <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5m0 3v.5" />
  {:else if name === 'sort'}
    <path d="M4 6h9M4 12h6M4 18h3" /><path class="arrow" d="M17 5v14m-3-3l3 3 3-3" />
  {:else if name === 'layers'}
    <path d="M12 4l9 4.5-9 4.5-9-4.5z" /><path d="M3 12.5l9 4.5 9-4.5" /><path d="M3 16.5l9 4.5 9-4.5" />
  {:else if name === 'expand'}
    <path d="M7 9l5 5 5-5" /><path d="M7 4l5 5 5-5" opacity="0.5" />
  {:else if name === 'collapse'}
    <path d="M7 15l5-5 5 5" /><path d="M7 20l5-5 5 5" opacity="0.5" />
  {:else if name === 'file'}
    <path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" />
  {:else if name === 'shield'}
    <path d="M12 3l8 3v5.5c0 5-3.4 8.4-8 9.5-4.6-1.1-8-4.5-8-9.5V6z" /><path class="stroke" pathLength="1" d="M8.5 12l2.5 2.5 4.5-5" />
  {:else if name === 'code'}
    <path d="M8.5 7L3.5 12l5 5m7-10l5 5-5 5m-2.5-12l-2 14" />
  {:else if name === 'heart'}
    <path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z" />
  {:else if name === 'backup'}
    <path d="M4 12a8 8 0 1 0 2.3-5.6" /><path d="M4 4v3.5h3.5" /><path d="M12 8v4l2.5 2.5" />
  {:else if name === 'lock'}
    <rect x="5" y="10.5" width="14" height="9.5" rx="1.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  {:else if name === 'logo'}
    <path d="M6 3h12v18l-6-4.5L6 21z" /><path class="spark" d="M12 6.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
  {/if}
</svg>

<style>
  .icon {
    display: inline-block;
    flex: none;
    vertical-align: -0.15em;
  }

  .stroke {
    stroke-dasharray: 1;
    stroke-dashoffset: 0;
  }

  /* State, not decoration: the open chevron is turned with or without motion. */
  .turned {
    transform: rotate(90deg);
  }

  @media (prefers-reduced-motion: no-preference) {
    .icon {
      transition: transform var(--dur-2) var(--ease);
    }

    /* Settings gear and the sun: a quarter turn while the control is hovered. */
    :global(:is(button, a):hover) .spin .rotor,
    :global(:is(button, a):focus-visible) .spin .rotor {
      transform: rotate(90deg);
    }

    .rotor {
      transform-origin: 12px 12px;
      transition: transform var(--dur-3) var(--ease);
    }

    /* Upload/move arrows: a short bob, looping while hovered or dragged over. */
    :global(:is(button, a):hover) .bob .arrow,
    :global(.dragging) .bob .arrow {
      animation: bob 900ms var(--ease) infinite;
    }

    /* Trash: the lid lifts. */
    .lid {
      transform-origin: 20px 7px;
      transition: transform var(--dur-2) var(--ease);
    }

    :global(button:is(:hover, :focus-visible)) .tilt .lid {
      transform: rotate(14deg) translateY(-1px);
    }

    /* The success check draws itself once, when it appears. */
    .draw .stroke {
      animation: draw 480ms var(--ease) 120ms both;
    }

    .pulse .spark {
      transform-origin: 12px 10px;
      animation: pulse 2.4s var(--ease) infinite;
    }

    @keyframes bob {
      50% {
        transform: translateY(-2px);
      }
    }

    @keyframes draw {
      from {
        stroke-dashoffset: 1;
      }
    }

    @keyframes pulse {
      50% {
        transform: scale(0.8);
        opacity: 0.6;
      }
    }
  }
</style>
