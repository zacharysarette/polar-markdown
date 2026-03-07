export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  children: FileEntry[];
  modified?: number;
}

export type LayoutMode = "centered" | "columns";

export type ThemeType = "aurora" | "glacier";

export interface OpenPane {
  id: string;
  path: string;
  content: string;
  editMode?: boolean;
  readOnly?: boolean;
}

export interface CreateFileResult {
  path: string;
  content: string;
}

export interface RenameFileResult {
  old_path: string;
  new_path: string;
}

export interface MoveFileResult {
  old_path: string;
  new_path: string;
}

export interface DirectoryFileContent {
  relative_path: string;
  content: string;
}

export type UndoAction =
  | { type: "create-file"; path: string; content: string; directory: string; filename: string; description: string }
  | { type: "delete-file"; path: string; content: string; description: string }
  | { type: "delete-directory"; path: string; files: DirectoryFileContent[]; description: string }
  | { type: "rename-file"; oldPath: string; newPath: string; description: string }
  | { type: "move-file"; oldPath: string; newPath: string; description: string }
  | { type: "move-directory"; oldPath: string; newPath: string; description: string }
  | { type: "create-directory"; path: string; description: string }
  | { type: "save-file"; path: string; previousContent: string; newContent: string; description: string };

export interface SearchMatch {
  line_number: number;
  line_content: string;
}

export interface SearchResult {
  path: string;
  name: string;
  matches: SearchMatch[];
}
