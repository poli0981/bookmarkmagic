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
    height: 8px;
    border-radius: 999px;
    background: var(--bg-raised);
    border: 1px solid var(--border);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 120ms linear;
  }

  .status {
    margin: 0;
    font-variant-numeric: tabular-nums;
    color: var(--fg-muted);
    font-size: var(--fs-1);
    min-width: 3.5ch;
  }
</style>
