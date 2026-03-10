<script lang="ts">
  import { tick } from "svelte";

  let {
    svgHtml = "",
    visible = false,
    onclose,
  }: {
    svgHtml?: string;
    visible?: boolean;
    onclose?: () => void;
  } = $props();

  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 20.0;
  const ZOOM_STEP = 0.25;

  let zoomLevel = $state(1);
  let contentEl: HTMLDivElement | undefined = $state();

  function clampZoom(z: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));
  }

  function zoomIn() {
    zoomLevel = clampZoom(zoomLevel + ZOOM_STEP);
  }

  function zoomOut() {
    zoomLevel = clampZoom(zoomLevel - ZOOM_STEP);
  }

  function fitToScreen() {
    if (!contentEl) return;
    const svg = contentEl.querySelector("svg");
    if (!svg) return;
    const oldTransform = svg.style.transform;
    svg.style.transform = "scale(1)";
    const rect = svg.getBoundingClientRect();
    svg.style.transform = oldTransform;
    const svgW = rect.width;
    const svgH = rect.height;
    if (svgW === 0 || svgH === 0) return;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const fitScale = Math.min((viewportW * 0.9) / svgW, (viewportH * 0.85) / svgH);
    zoomLevel = clampZoom(fitScale);
  }

  $effect(() => {
    if (visible) {
      tick().then(() => {
        fitToScreen();
      });
    }
  });

  function handleKeydown(event: KeyboardEvent) {
    if (!visible) return;
    if (event.key === "Escape") {
      onclose?.();
      return;
    }
    if (event.ctrlKey && (event.key === "=" || event.key === "+")) {
      event.preventDefault();
      zoomIn();
    } else if (event.ctrlKey && event.key === "-") {
      event.preventDefault();
      zoomOut();
    } else if (event.ctrlKey && event.key === "0") {
      event.preventDefault();
      fitToScreen();
    }
  }

  function handleWheel(event: WheelEvent) {
    if (!visible || !event.ctrlKey) return;
    event.preventDefault();
    if (event.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
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
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="diagram-overlay" onclick={handleBackdropClick} onwheel={handleWheel}>
    <button class="diagram-overlay-close" onclick={() => onclose?.()} aria-label="Close diagram overlay">&times;</button>
    <div class="diagram-overlay-content" bind:this={contentEl}>
      <div class="diagram-overlay-svg-wrapper" style="transform: scale({zoomLevel}); transform-origin: center center;">
        {@html svgHtml}
      </div>
    </div>
    <div class="diagram-overlay-toolbar">
      <button class="toolbar-btn" onclick={zoomOut} aria-label="Zoom out" disabled={zoomLevel <= MIN_ZOOM}>−</button>
      <span class="zoom-display">{Math.round(zoomLevel * 100)}%</span>
      <button class="toolbar-btn" onclick={zoomIn} aria-label="Zoom in" disabled={zoomLevel >= MAX_ZOOM}>+</button>
      <button class="toolbar-btn toolbar-fit" onclick={fitToScreen} aria-label="Fit to screen">Fit</button>
    </div>
  </div>
{/if}

<style>
  .diagram-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: var(--bg-primary);
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
    width: 90vw;
    height: 85vh;
    overflow: auto;
    padding: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .diagram-overlay-svg-wrapper :global(svg) {
    max-width: none;
    display: block;
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 16px;
  }

  .diagram-overlay-toolbar {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2001;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 12px;
  }

  .toolbar-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-primary);
    width: 32px;
    height: 32px;
    border-radius: 6px;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .toolbar-btn:hover:not(:disabled) {
    background: var(--accent);
    color: var(--bg-primary);
  }

  .toolbar-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .toolbar-fit {
    width: auto;
    padding: 0 10px;
    font-size: 13px;
    margin-left: 4px;
  }

  .zoom-display {
    color: var(--text-primary);
    font-size: 13px;
    min-width: 48px;
    text-align: center;
    user-select: none;
  }
</style>
