import {
	App,
	Menu,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
	TFolder,
} from "obsidian";
import { basename, dirname } from "path";

interface ArchiverSettings {
  archiveFolder: string;
  keepFolderStructure: boolean;
}

const DEFAULT_SETTINGS: ArchiverSettings = {
  archiveFolder: "Archive",
  keepFolderStructure: true,
};

export default class ArchiverPlugin extends Plugin {
  settings: ArchiverSettings;

  async onload() {
    await this.loadSettings();

    // Context menu for a single file/folder
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
        menu.addItem((item) => {
          item
            .setTitle("Archive")
            .setIcon("archive")
            .onClick(async () => {
              await this.archiveItem(file);
            });
        });
      }),
    );

    // Context menu for multiple highlighted files/folders
    this.registerEvent(
      this.app.workspace.on(
        "files-menu",
        (menu: Menu, files: TAbstractFile[]) => {
          // Only show if more than one item is selected (to avoid double items)
          if (files.length > 1) {
            menu.addItem((item) => {
              item
                .setTitle(`Archive ${files.length} items`)
                .setIcon("archive")
                .onClick(async () => {
                  await this.archiveItems(files);
                });
            });
          }
        },
      ),
    );

    this.addSettingTab(new ArchiverSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Archives a list of items and shows a single summary notice
   */
  async archiveItems(files: TAbstractFile[]) {
    let succeeded = 0;
    let failed = 0;

    for (const file of files) {
      try {
        // Pass true to 'silent' to prevent individual notices
        await this.archiveItem(file, true);
        succeeded++;
      } catch (error) {
        failed++;
        console.error(`Failed to archive ${file.path}:`, error);
      }
    }

    if (failed > 0) {
      new Notice(
        `Archived ${succeeded} items. ${failed} failed (see console for details).`,
      );
    } else {
      new Notice(`Successfully archived ${succeeded} items.`);
    }
  }

  /**
   * Archives a single file or folder
   */
  async archiveItem(file: TAbstractFile, silent = false) {
    try {
      if (file instanceof TFile) {
        await this.archiveFile(file);
      } else if (file instanceof TFolder) {
        await this.archiveFolder(file);
      }

      if (!silent) {
        new Notice(`Successfully archived ${file.name}`);
      }
    } catch (error) {
      if (!silent) {
        new Notice(`Failed to archive ${file.name}: ${error.message}`);
      }
      throw error; // Propagate error for the bulk archiver to catch
    }
  }

  async archiveFile(file: TFile) {
    const archivePath = this.getArchivePath(file.path);
    await this.ensureDirectoryExists(dirname(archivePath));
    await this.app.fileManager.renameFile(file, archivePath);
  }

  async archiveFolder(folder: TFolder) {
    const filesToArchive: TFile[] = [];
    this.collectFiles(folder, filesToArchive);

    for (const file of filesToArchive) {
      await this.archiveFile(file);
    }

    await this.removeEmptyDirectories(folder);
  }

  collectFiles(folder: TFolder, files: TFile[]) {
    for (const child of folder.children) {
      if (child instanceof TFile) {
        files.push(child);
      } else if (child instanceof TFolder) {
        this.collectFiles(child, files);
      }
    }
  }

  getArchivePath(originalPath: string): string {
    const filename = basename(originalPath);

    if (this.settings.keepFolderStructure) {
      const relativePath = dirname(originalPath);
      if (relativePath === "." || relativePath === "") {
        return `${this.settings.archiveFolder}/${filename}`;
      }
      return `${this.settings.archiveFolder}/${relativePath}/${filename}`;
    } else {
      return `${this.settings.archiveFolder}/${filename}`;
    }
  }

  async ensureDirectoryExists(path: string) {
    if (path === "." || path === "" || path === this.settings.archiveFolder) {
      if (!this.app.vault.getAbstractFileByPath(this.settings.archiveFolder)) {
        await this.app.vault.createFolder(this.settings.archiveFolder);
      }
      return;
    }

    const parts = path.split("/");
    let currentPath = "";

    for (const part of parts) {
      if (part === "") continue;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!this.app.vault.getAbstractFileByPath(currentPath)) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }

  async removeEmptyDirectories(folder: TFolder) {
    try {
      if (folder.children.length === 0) {
        await this.app.vault.delete(folder);

        const parentPath = dirname(folder.path);
        if (parentPath !== "." && parentPath !== "") {
          const parentFolder = this.app.vault.getAbstractFileByPath(parentPath);
          if (parentFolder instanceof TFolder) {
            await this.removeEmptyDirectories(parentFolder);
          }
        }
      }
    } catch (error) {
      console.log("Could not remove directory (might not be empty):", folder.path);
    }
  }
}

class ArchiverSettingTab extends PluginSettingTab {
  plugin: ArchiverPlugin;

  constructor(app: App, plugin: ArchiverPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Archiver Settings" });

    new Setting(containerEl)
      .setName("Archive folder")
      .setDesc("Folder where archived files will be moved")
      .addText((text) =>
        text
          .setPlaceholder("Archive")
          .setValue(this.plugin.settings.archiveFolder)
          .onChange(async (value) => {
            this.plugin.settings.archiveFolder = value || "Archive";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Keep folder structure")
      .setDesc(
        "When enabled, archived files maintain original paths inside the archive folder",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.keepFolderStructure)
          .onChange(async (value) => {
            this.plugin.settings.keepFolderStructure = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}