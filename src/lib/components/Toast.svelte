<script lang="ts">
  let {
    message = "",
    visible = false,
  }: {
    message?: string;
    visible?: boolean;
  } = $props();
</script>

{#if visible}
  <div class="toast" role="status" aria-live="polite">
    {message}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-secondary);
    color: var(--text);
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 13px;
    z-index: 1000;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: toast-in 0.2s ease-out;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
</style>
