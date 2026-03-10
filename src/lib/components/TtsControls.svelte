<script lang="ts">
  import type { TtsState } from "../services/tts";

  let {
    state = "idle" as TtsState,
    voices = [] as SpeechSynthesisVoice[],
    selectedVoice = "",
    rate = 1.0,
    onplay,
    onpause,
    onresume,
    onstop,
    onvoicechange,
    onratechange,
    onclose,
  }: {
    state?: TtsState;
    voices?: SpeechSynthesisVoice[];
    selectedVoice?: string;
    rate?: number;
    onplay?: () => void;
    onpause?: () => void;
    onresume?: () => void;
    onstop?: () => void;
    onvoicechange?: (name: string) => void;
    onratechange?: (rate: number) => void;
    onclose?: () => void;
  } = $props();

  function handlePlayPause() {
    if (state === "playing") {
      onpause?.();
    } else if (state === "paused") {
      onresume?.();
    } else {
      onplay?.();
    }
  }

  const playLabel = $derived(
    state === "playing" ? "Pause" : state === "paused" ? "Resume" : "Play"
  );

  const playIcon = $derived(
    state === "playing" ? "\u23F8" : "\u25B6"
  );
</script>

<div class="tts-controls">
  <button
    class="tts-btn play-btn"
    onclick={handlePlayPause}
    title={playLabel}
  >{playIcon}</button>
  <button
    class="tts-btn stop-btn"
    onclick={() => onstop?.()}
    disabled={state === "idle"}
    title="Stop"
  >&#x25A0;</button>

  <select
    class="tts-select rate-select"
    value={String(rate)}
    onchange={(e) => onratechange?.(parseFloat((e.target as HTMLSelectElement).value))}
    title="Reading speed"
  >
    <option value="0.5">0.5x</option>
    <option value="0.75">0.75x</option>
    <option value="1">1x</option>
    <option value="1.25">1.25x</option>
    <option value="1.5">1.5x</option>
    <option value="2">2x</option>
  </select>

  <select
    class="tts-select voice-select"
    value={selectedVoice}
    onchange={(e) => onvoicechange?.((e.target as HTMLSelectElement).value)}
    title="Voice"
  >
    <option value="">System Default</option>
    {#each voices as voice}
      <option value={voice.name}>{voice.name}</option>
    {/each}
  </select>

  <button
    class="tts-btn close-btn"
    onclick={() => onclose?.()}
    title="Close reader"
  >&#x2715;</button>
</div>

<style>
  .tts-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
    flex-shrink: 0;
  }

  .tts-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: 4px;
    width: 28px;
    height: 28px;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .tts-btn:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }

  .tts-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .play-btn {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }

  .close-btn {
    margin-left: auto;
    font-size: 12px;
  }

  .close-btn:hover {
    color: var(--red);
    border-color: var(--red);
  }

  .tts-select {
    background: var(--bg-input);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 4px 6px;
    font-size: 12px;
    cursor: pointer;
    height: 28px;
  }

  .tts-select:hover {
    border-color: var(--accent);
  }

  .rate-select {
    width: 60px;
  }

  .voice-select {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
