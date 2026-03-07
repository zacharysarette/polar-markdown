import type { UndoAction } from "../types";

const MAX_UNDO_STACK = 50;
const COALESCE_WINDOW_MS = 10_000;

export class UndoManager {
  private undoStack: { action: UndoAction; timestamp: number }[] = [];
  private redoStack: UndoAction[] = [];

  push(action: UndoAction): void {
    const now = Date.now();

    // Coalesce save-file actions for the same path within the time window
    if (action.type === "save-file" && this.undoStack.length > 0) {
      const top = this.undoStack[this.undoStack.length - 1];
      if (
        top.action.type === "save-file" &&
        top.action.path === action.path &&
        now - top.timestamp < COALESCE_WINDOW_MS
      ) {
        top.action.newContent = action.newContent;
        top.timestamp = now;
        this.redoStack = [];
        return;
      }
    }

    this.undoStack.push({ action, timestamp: now });

    // Cap at max size
    if (this.undoStack.length > MAX_UNDO_STACK) {
      this.undoStack.splice(0, this.undoStack.length - MAX_UNDO_STACK);
    }

    this.redoStack = [];
  }

  undo(): UndoAction | undefined {
    const entry = this.undoStack.pop();
    if (!entry) return undefined;
    this.redoStack.push(entry.action);
    return entry.action;
  }

  redo(): UndoAction | undefined {
    const action = this.redoStack.pop();
    if (!action) return undefined;
    this.undoStack.push({ action, timestamp: Date.now() });
    return action;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  peekUndo(): UndoAction | undefined {
    return this.undoStack.length > 0
      ? this.undoStack[this.undoStack.length - 1].action
      : undefined;
  }

  peekRedo(): UndoAction | undefined {
    return this.redoStack.length > 0
      ? this.redoStack[this.redoStack.length - 1]
      : undefined;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
