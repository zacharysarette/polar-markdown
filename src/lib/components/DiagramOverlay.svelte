<script lang="ts">
  let {
    svgHtml = "",
    visible = false,
    onclose,
  }: {
    svgHtml?: string;
    visible?: boolean;
    onclose?: () => void;
  } = $props();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && visible) {
      onclose?.();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains("diagram-overlay")) {
      onclose?.();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="diagram-overlay" onclick={handleBackdropClick}>
    <button class="diagram-overlay-close" onclick={() => onclose?.()} aria-label="Close diagram overlay">&times;</button>
    <div class="diagram-overlay-content">
      {@html svgHtml}
    </div>
  </div>
{/if}

<style>
  .diagram-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .diagram-overlay-close {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2001;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text-primary);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .diagram-overlay-close:hover {
    background: var(--accent);
    color: var(--bg-primary);
  }

  .diagram-overlay-content {
    max-width: 95vw;
    max-height: 90vh;
    overflow: auto;
    padding: 16px;
  }

  .diagram-overlay-content :global(svg) {
    max-width: none;
    display: block;
  }
</style>
