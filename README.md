# Obsidian Archiver Plugin

An Obsidian plugin that allows you to archive files and folders with customizable folder structure options.

## Features

- **Right-click archiving**: Right-click on any file or folder in the file explorer to archive it
- **Folder structure options**: Choose whether to keep the original folder structure or flatten files into the archive folder
- **Batch archiving**: Archive entire folders with all their contents
- **Configurable archive location**: Set your preferred archive folder name
- **Automatic cleanup**: Empty folders are automatically removed after archiving

## Usage

1. Right-click on any file or folder in the Obsidian file explorer
2. Select "Archive" from the context menu
3. The file/folder will be moved to your configured archive location

## Settings

- **Archive folder**: Set the name of the folder where archived items will be moved (default: "Archive")
- **Keep folder structure**: Toggle whether to maintain the original folder structure within the archive

### Folder Structure Examples

With archive folder set to "Archive":

**Keep folder structure ON:**
- `notes/work/project.md` → `Archive/notes/work/project.md`
- `images/diagrams/flow.png` → `Archive/images/diagrams/flow.png`

**Keep folder structure OFF:**
- `notes/work/project.md` → `Archive/project.md`
- `images/diagrams/flow.png` → `Archive/flow.png`

## Development

To build the plugin:

```bash
npm run build
```

To develop with hot reload:

```bash
npm run dev
```

## Installation

1. Download the latest release
2. Extract the files to your Obsidian plugins folder: `{VaultFolder}/.obsidian/plugins/obsidian-archiver/`
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins