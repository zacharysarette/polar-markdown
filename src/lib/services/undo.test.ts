import { describe, it, expect, beforeEach } from "vitest";
import { UndoManager } from "./undo";
import type { UndoAction } from "../types";

let manager: UndoManager;

beforeEach(() => {
  manager = new UndoManager();
});

describe("UndoManager", () => {
  describe("push", () => {
    it("adds an action to the undo stack", () => {
      const action: UndoAction = {
        type: "create-file",
        path: "/docs/test.md",
        content: "# Test",
        directory: "/docs",
        filename: "test.md",
        description: "Create test.md",
      };
      manager.push(action);
      expect(manager.canUndo()).toBe(true);
    });

    it("clears the redo stack on push", () => {
      const action1: UndoAction = {
        type: "create-file",
        path: "/docs/a.md",
        content: "",
        directory: "/docs",
        filename: "a.md",
        description: "Create a.md",
      };
      const action2: UndoAction = {
        type: "create-file",
        path: "/docs/b.md",
        content: "",
        directory: "/docs",
        filename: "b.md",
        description: "Create b.md",
      };
      manager.push(action1);
      manager.undo();
      expect(manager.canRedo()).toBe(true);

      manager.push(action2);
      expect(manager.canRedo()).toBe(false);
    });

    it("caps undo stack at 50 entries", () => {
      for (let i = 0; i < 60; i++) {
        manager.push({
          type: "create-file",
          path: `/docs/file${i}.md`,
          content: "",
          directory: "/docs",
          filename: `file${i}.md`,
          description: `Create file${i}.md`,
        });
      }
      // Should only have 50 items — oldest ones removed
      let count = 0;
      while (manager.canUndo()) {
        manager.undo();
        count++;
      }
      expect(count).toBe(50);
    });
  });

  describe("undo", () => {
    it("returns undefined when stack is empty", () => {
      expect(manager.undo()).toBeUndefined();
    });

    it("returns the last pushed action", () => {
      const action: UndoAction = {
        type: "delete-file",
        path: "/docs/test.md",
        content: "# Test",
        description: "Delete test.md",
      };
      manager.push(action);
      const result = manager.undo();
      expect(result).toEqual(action);
    });

    it("moves action to redo stack", () => {
      const action: UndoAction = {
        type: "delete-file",
        path: "/docs/test.md",
        content: "# Test",
        description: "Delete test.md",
      };
      manager.push(action);
      manager.undo();
      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(true);
    });
  });

  describe("redo", () => {
    it("returns undefined when redo stack is empty", () => {
      expect(manager.redo()).toBeUndefined();
    });

    it("returns the last undone action", () => {
      const action: UndoAction = {
        type: "rename-file",
        oldPath: "/docs/old.md",
        newPath: "/docs/new.md",
        description: "Rename old.md to new.md",
      };
      manager.push(action);
      manager.undo();
      const result = manager.redo();
      expect(result).toEqual(action);
    });

    it("moves action back to undo stack", () => {
      const action: UndoAction = {
        type: "rename-file",
        oldPath: "/docs/old.md",
        newPath: "/docs/new.md",
        description: "Rename old.md to new.md",
      };
      manager.push(action);
      manager.undo();
      manager.redo();
      expect(manager.canUndo()).toBe(true);
      expect(manager.canRedo()).toBe(false);
    });
  });

  describe("peekUndo / peekRedo", () => {
    it("peekUndo returns the top action without removing", () => {
      const action: UndoAction = {
        type: "move-file",
        oldPath: "/docs/a.md",
        newPath: "/docs/sub/a.md",
        description: "Move a.md",
      };
      manager.push(action);
      expect(manager.peekUndo()).toEqual(action);
      expect(manager.canUndo()).toBe(true);
    });

    it("peekRedo returns the top redo action without removing", () => {
      const action: UndoAction = {
        type: "move-file",
        oldPath: "/docs/a.md",
        newPath: "/docs/sub/a.md",
        description: "Move a.md",
      };
      manager.push(action);
      manager.undo();
      expect(manager.peekRedo()).toEqual(action);
      expect(manager.canRedo()).toBe(true);
    });

    it("peekUndo returns undefined when empty", () => {
      expect(manager.peekUndo()).toBeUndefined();
    });

    it("peekRedo returns undefined when empty", () => {
      expect(manager.peekRedo()).toBeUndefined();
    });
  });

  describe("clear", () => {
    it("empties both stacks", () => {
      manager.push({
        type: "create-file",
        path: "/docs/a.md",
        content: "",
        directory: "/docs",
        filename: "a.md",
        description: "Create a.md",
      });
      manager.push({
        type: "create-file",
        path: "/docs/b.md",
        content: "",
        directory: "/docs",
        filename: "b.md",
        description: "Create b.md",
      });
      manager.undo(); // moves one to redo

      manager.clear();
      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
    });
  });

  describe("save-file coalescing", () => {
    it("coalesces save-file actions for the same path within 10s", () => {
      manager.push({
        type: "save-file",
        path: "/docs/test.md",
        previousContent: "original",
        newContent: "v1",
        description: "Save test.md",
      });
      manager.push({
        type: "save-file",
        path: "/docs/test.md",
        previousContent: "v1",
        newContent: "v2",
        description: "Save test.md",
      });

      // Should only have 1 entry with original previousContent and latest newContent
      const action = manager.undo();
      expect(action).toBeDefined();
      expect(action!.type).toBe("save-file");
      if (action!.type === "save-file") {
        expect(action!.previousContent).toBe("original");
        expect(action!.newContent).toBe("v2");
      }
      expect(manager.canUndo()).toBe(false);
    });

    it("does not coalesce save-file for different paths", () => {
      manager.push({
        type: "save-file",
        path: "/docs/a.md",
        previousContent: "a-orig",
        newContent: "a-v1",
        description: "Save a.md",
      });
      manager.push({
        type: "save-file",
        path: "/docs/b.md",
        previousContent: "b-orig",
        newContent: "b-v1",
        description: "Save b.md",
      });

      // Should have 2 entries
      manager.undo();
      expect(manager.canUndo()).toBe(true);
      manager.undo();
      expect(manager.canUndo()).toBe(false);
    });

    it("does not coalesce when non-save action is between saves", () => {
      manager.push({
        type: "save-file",
        path: "/docs/test.md",
        previousContent: "original",
        newContent: "v1",
        description: "Save test.md",
      });
      manager.push({
        type: "create-file",
        path: "/docs/other.md",
        content: "",
        directory: "/docs",
        filename: "other.md",
        description: "Create other.md",
      });
      manager.push({
        type: "save-file",
        path: "/docs/test.md",
        previousContent: "v1",
        newContent: "v2",
        description: "Save test.md",
      });

      // Should have 3 entries
      let count = 0;
      while (manager.canUndo()) {
        manager.undo();
        count++;
      }
      expect(count).toBe(3);
    });
  });

  describe("multiple undo/redo chain", () => {
    it("supports undo then redo back and forth", () => {
      const a1: UndoAction = {
        type: "create-file",
        path: "/docs/1.md",
        content: "",
        directory: "/docs",
        filename: "1.md",
        description: "Create 1.md",
      };
      const a2: UndoAction = {
        type: "create-file",
        path: "/docs/2.md",
        content: "",
        directory: "/docs",
        filename: "2.md",
        description: "Create 2.md",
      };
      const a3: UndoAction = {
        type: "create-file",
        path: "/docs/3.md",
        content: "",
        directory: "/docs",
        filename: "3.md",
        description: "Create 3.md",
      };

      manager.push(a1);
      manager.push(a2);
      manager.push(a3);

      expect(manager.undo()).toEqual(a3);
      expect(manager.undo()).toEqual(a2);
      expect(manager.redo()).toEqual(a2);
      expect(manager.redo()).toEqual(a3);
      expect(manager.undo()).toEqual(a3);
      expect(manager.undo()).toEqual(a2);
      expect(manager.undo()).toEqual(a1);
      expect(manager.canUndo()).toBe(false);
    });
  });

  describe("canUndo / canRedo", () => {
    it("returns false initially", () => {
      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
    });
  });
});
