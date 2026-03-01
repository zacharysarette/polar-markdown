export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  children: FileEntry[];
  modified?: number;
}

export type LayoutMode = "centered" | "columns";

export interface OpenPane {
  id: string;
  path: string;
  content: string;
  editMode?: boolean;
  readOnly?: boolean;
}

export interface SearchMatch {
  line_number: number;
  line_content: string;
}

export interface SearchResult {
  path: string;
  name: string;
  matches: SearchMatch[];
}
