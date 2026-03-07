use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Vec<FileEntry>,
    pub modified: Option<u64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SearchMatch {
    pub line_number: usize,
    pub line_content: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub matches: Vec<SearchMatch>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct CreateFileResult {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct RenameFileResult {
    pub old_path: String,
    pub new_path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct MoveFileResult {
    pub old_path: String,
    pub new_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DirectoryFileContent {
    pub relative_path: String,
    pub content: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_entry_creation() {
        let entry = FileEntry {
            name: "test.md".into(),
            path: "/docs/test.md".into(),
            is_directory: false,
            children: vec![],
            modified: Some(1234567890),
        };
        assert_eq!(entry.name, "test.md");
        assert!(!entry.is_directory);
        assert!(entry.children.is_empty());
        assert_eq!(entry.modified, Some(1234567890));
    }

    #[test]
    fn test_directory_entry_with_children() {
        let child = FileEntry {
            name: "note.md".into(),
            path: "/docs/sub/note.md".into(),
            is_directory: false,
            children: vec![],
            modified: None,
        };
        let dir = FileEntry {
            name: "sub".into(),
            path: "/docs/sub".into(),
            is_directory: true,
            children: vec![child],
            modified: None,
        };
        assert!(dir.is_directory);
        assert_eq!(dir.children.len(), 1);
        assert_eq!(dir.children[0].name, "note.md");
    }

    #[test]
    fn test_create_file_result_serializes_to_json() {
        let result = CreateFileResult {
            path: "/docs/test.md".into(),
            content: "# Test\n\n".into(),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"path\":\"/docs/test.md\""));
        assert!(json.contains("\"content\":\"# Test\\n\\n\""));
    }

    #[test]
    fn test_rename_file_result_serializes_to_json() {
        let result = RenameFileResult {
            old_path: "/docs/old.md".into(),
            new_path: "/docs/new.md".into(),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"old_path\":\"/docs/old.md\""));
        assert!(json.contains("\"new_path\":\"/docs/new.md\""));
    }

    #[test]
    fn test_move_file_result_serializes_to_json() {
        let result = MoveFileResult {
            old_path: "/docs/file.md".into(),
            new_path: "/docs/sub/file.md".into(),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"old_path\":\"/docs/file.md\""));
        assert!(json.contains("\"new_path\":\"/docs/sub/file.md\""));
    }

    #[test]
    fn test_directory_file_content_serializes_to_json() {
        let content = DirectoryFileContent {
            relative_path: "sub/note.md".into(),
            content: "# Note".into(),
        };
        let json = serde_json::to_string(&content).unwrap();
        assert!(json.contains("\"relative_path\":\"sub/note.md\""));
        assert!(json.contains("\"content\":\"# Note\""));
    }

    #[test]
    fn test_directory_file_content_deserializes_from_json() {
        let json = r##"{"relative_path":"test.md","content":"# Test"}"##;
        let content: DirectoryFileContent = serde_json::from_str(json).unwrap();
        assert_eq!(content.relative_path, "test.md");
        assert_eq!(content.content, "# Test");
    }

    #[test]
    fn test_file_entry_serializes_to_json() {
        let entry = FileEntry {
            name: "test.md".into(),
            path: "/docs/test.md".into(),
            is_directory: false,
            children: vec![],
            modified: Some(1000),
        };
        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("\"name\":\"test.md\""));
        assert!(json.contains("\"is_directory\":false"));
    }
}
