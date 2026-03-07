<script lang="ts">
  import type { DocumentStats } from "../services/doc-stats";

  let {
    stats = null,
    visible = false,
  }: {
    stats?: DocumentStats | null;
    visible?: boolean;
  } = $props();
</script>

{#if visible && stats && stats.words > 0}
  <footer class="doc-stats" data-testid="doc-stats">
    <span>{stats.words} words</span>
    <span class="sep">|</span>
    <span>{stats.characters} chars</span>
    <span class="sep">|</span>
    <span>{stats.charactersNoSpaces} chars (no spaces)</span>
    <span class="sep">|</span>
    <span>{stats.lines} lines</span>
    <span class="sep">|</span>
    <span>{stats.sentences} sentences</span>
    <span class="sep">|</span>
    <span>{stats.paragraphs} paragraphs</span>
    <span class="sep">|</span>
    <span>{stats.readingTimeMinutes} min read</span>
    <span class="sep">|</span>
    <span title="Flesch Reading Ease: 0-30 Very Difficult, 30-50 Difficult, 50-60 Fairly Difficult, 60-70 Standard, 70-80 Fairly Easy, 80-90 Easy, 90-100 Very Easy">FRE {stats.fleschReadingEase.toFixed(1)}</span>
    <span class="sep">|</span>
    <span title="Flesch-Kincaid Grade Level: approximate US school grade level needed to understand the text">FK {stats.fleschKincaidGrade.toFixed(1)}</span>
  </footer>
{/if}

<style>
  .doc-stats {
    border-top: 1px solid var(--border);
    padding: 4px 16px;
    flex-shrink: 0;
    font-size: 11px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    overflow-x: auto;
  }

  .sep {
    opacity: 0.4;
  }
</style>
