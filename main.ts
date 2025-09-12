import { App, Menu, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, TFolder } from 'obsidian';
import { basename, dirname } from 'path';

interface ArchiverSettings {
	archiveFolder: string;
	keepFolderStructure: boolean;
}

const DEFAULT_SETTINGS: ArchiverSettings = {
	archiveFolder: 'Archive',
	keepFolderStructure: true
}

export default class ArchiverPlugin extends Plugin {
	settings: ArchiverSettings;

	async onload() {
		await this.loadSettings();

		// Add context menu items for files and folders
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
				menu.addItem((item) => {
					item
						.setTitle('Archive')
						.setIcon('archive')
						.onClick(async () => {
							await this.archiveItem(file);
						});
				});
			})
		);

		// Add settings tab
		this.addSettingTab(new ArchiverSettingTab(this.app, this));
	}

	onunload() {
		// Clean up when plugin is disabled
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async archiveItem(file: TAbstractFile) {
		try {
			if (file instanceof TFile) {
				await this.archiveFile(file);
			} else if (file instanceof TFolder) {
				await this.archiveFolder(file);
			}
			new Notice(`Successfully archived ${file.name}`);
		} catch (error) {
			new Notice(`Failed to archive ${file.name}: ${error.message}`);
			console.error('Archive error:', error);
		}
	}

	async archiveFile(file: TFile) {
		const archivePath = this.getArchivePath(file.path);
		
		// Ensure the archive directory exists
		await this.ensureDirectoryExists(dirname(archivePath));
		
		// Move the file
		await this.app.fileManager.renameFile(file, archivePath);
	}

	async archiveFolder(folder: TFolder) {
		// Get all files in the folder recursively
		const filesToArchive: TFile[] = [];
		this.collectFiles(folder, filesToArchive);

		// Archive each file
		for (const file of filesToArchive) {
			await this.archiveFile(file);
		}

		// Remove empty directories after archiving
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
			// Keep the original folder structure
			const relativePath = dirname(originalPath);
			if (relativePath === '.' || relativePath === '') {
				return `${this.settings.archiveFolder}/${filename}`;
			}
			return `${this.settings.archiveFolder}/${relativePath}/${filename}`;
		} else {
			// Just put the file directly in the archive folder
			return `${this.settings.archiveFolder}/${filename}`;
		}
	}

	async ensureDirectoryExists(path: string) {
		if (path === '.' || path === '' || path === this.settings.archiveFolder) {
			// Make sure the main archive folder exists
			if (!this.app.vault.getAbstractFileByPath(this.settings.archiveFolder)) {
				await this.app.vault.createFolder(this.settings.archiveFolder);
			}
			return;
		}

		const parts = path.split('/');
		let currentPath = '';
		
		for (const part of parts) {
			if (part === '') continue;
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			
			if (!this.app.vault.getAbstractFileByPath(currentPath)) {
				await this.app.vault.createFolder(currentPath);
			}
		}
	}

	async removeEmptyDirectories(folder: TFolder) {
		try {
			// Check if folder is empty after archiving
			if (folder.children.length === 0) {
				await this.app.vault.delete(folder);
				
				// Recursively check parent directories
				const parentPath = dirname(folder.path);
				if (parentPath !== '.' && parentPath !== '') {
					const parentFolder = this.app.vault.getAbstractFileByPath(parentPath);
					if (parentFolder instanceof TFolder) {
						await this.removeEmptyDirectories(parentFolder);
					}
				}
			}
		} catch (error) {
			// Ignore errors when removing directories (they might not be empty)
			console.log('Could not remove directory:', folder.path);
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

		containerEl.createEl('h2', { text: 'Archiver Settings' });

		new Setting(containerEl)
			.setName('Archive folder')
			.setDesc('Folder where archived files will be moved')
			.addText(text => text
				.setPlaceholder('Archive')
				.setValue(this.plugin.settings.archiveFolder)
				.onChange(async (value) => {
					this.plugin.settings.archiveFolder = value || 'Archive';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Keep folder structure')
			.setDesc('When enabled, archived files will maintain their original folder structure within the archive folder')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.keepFolderStructure)
				.onChange(async (value) => {
					this.plugin.settings.keepFolderStructure = value;
					await this.plugin.saveSettings();
				}));

		// Add some explanatory text
		containerEl.createEl('div', {
			text: 'Example: If archiving "folder/subfolder/file.md" with archive folder "Archive":'
		});
		
		containerEl.createEl('ul').createEl('li', {
			text: 'Keep structure ON: Archive/folder/subfolder/file.md'
		});
		
		containerEl.createEl('ul').createEl('li', {
			text: 'Keep structure OFF: Archive/file.md'
		});
	}
}