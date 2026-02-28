use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Vec<FileEntry>,
    pub modified: Option<u64>,
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
