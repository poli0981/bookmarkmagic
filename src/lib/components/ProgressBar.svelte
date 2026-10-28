<script lang="ts">
  interface Props {
    done: number;
    total: number;
    label?: string;
  }

  let { done, total, label }: Props = $props();

  const percent = $derived(total === 0 ? 0 : Math.round((done / total) * 100));
  // Announce every 10% rather than on every tick — docs/06 §5.
  const announced = $derived(Math.floor(percent / 10) * 10);
  // Not run through Intl (unlike counts elsewhere): this is 0–100, and none of
  // en-US/vi-VN/ja-JP groups a two-digit number — so it would cost a formatter
  // lookup on the hottest render path in the app and change nothing.
</script>

<div class="wrap">
  <div
    class="track"
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={total}
    aria-valuenow={done}
    aria-label={label}
  >
    <div class="fill" style:width="{percent}%"></div>
  </div>
  <p class="status" aria-live="polite">{announced}%</p>
</div>

<style>
  .wrap {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }

  .track {
    flex: 1;
    height: 10px;
    border-radius: var(--radius-sm);
    background: var(--bg-sunken);
    border: 1px solid var(--border-strong);
    overflow: hidden;
  }

  /* Diagonal stripes say "working" even when the number stops moving between
     progress events; they only travel when motion is welcome. */
  .fill {
    height: 100%;
    background-color: var(--accent);
    background-image: repeating-linear-gradient(
      -45deg,
      transparent 0 6px,
      rgb(255 255 255 / 18%) 6px 12px
    );
    background-size: 17px 17px;
  }

  .status {
    margin: 0;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    color: var(--fg-muted);
    font-size: var(--fs-1);
    min-width: 4.5ch;
    text-align: right;
  }

  @media (prefers-reduced-motion: no-preference) {
    .fill {
      transition: width var(--dur-1) linear;
      animation: stripes 900ms linear infinite;
    }

    @keyframes stripes {
      to {
        background-position: 17px 0;
      }
    }
  }
</style>
