/**
 * JSON Table Editor
 * A modern web app for viewing, editing, and exporting JSON files
 */

class JSONTableEditor {
    constructor() {
        this.jsonData = null;
        this.fileName = '';
        this.expandedPaths = new Set();
        this.modifiedPaths = new Set(); // Track modified cells

        this.initElements();
        this.initEventListeners();
    }

    initElements() {
        this.uploadZone = document.getElementById('upload-zone');
        this.fileInput = document.getElementById('file-input');
        this.actionBar = document.getElementById('action-bar');
        this.tableContainer = document.getElementById('table-container');
        this.tableBody = document.getElementById('table-body');
        this.fileNameEl = document.getElementById('file-name');
        this.fileSizeEl = document.getElementById('file-size');
        this.toastContainer = document.getElementById('toast-container');

        this.btnExpandAll = document.getElementById('btn-expand-all');
        this.btnCollapseAll = document.getElementById('btn-collapse-all');
        this.btnExport = document.getElementById('btn-export');
        this.btnClear = document.getElementById('btn-clear');
    }

    initEventListeners() {
        // Upload zone events
        this.uploadZone.addEventListener('click', () => this.fileInput.click());
        this.uploadZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadZone.addEventListener('drop', (e) => this.handleDrop(e));
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Action buttons
        this.btnExpandAll.addEventListener('click', () => this.expandAll());
        this.btnCollapseAll.addEventListener('click', () => this.collapseAll());
        this.btnExport.addEventListener('click', () => this.exportJSON());
        this.btnClear.addEventListener('click', () => this.clearData());
    }

    // File handling
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadZone.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadZone.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    processFile(file) {
        if (!file.name.endsWith('.json') && file.type !== 'application/json') {
            this.showToast('Please upload a valid JSON file', 'error');
            return;
        }

        this.fileName = file.name;
        const fileSize = this.formatFileSize(file.size);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.jsonData = JSON.parse(e.target.result);
                this.modifiedPaths.clear(); // Reset modified tracking
                this.fileNameEl.textContent = this.fileName;
                this.fileSizeEl.textContent = fileSize;
                this.renderTable();
                this.showUI();
                this.showToast('JSON file loaded successfully', 'success');
            } catch (error) {
                this.showToast('Invalid JSON format: ' + error.message, 'error');
            }
        };
        reader.onerror = () => {
            this.showToast('Error reading file', 'error');
        };
        reader.readAsText(file);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showUI() {
        this.uploadZone.classList.add('hidden');
        this.actionBar.classList.remove('hidden');
        this.tableContainer.classList.remove('hidden');
    }

    hideUI() {
        this.uploadZone.classList.remove('hidden');
        this.actionBar.classList.add('hidden');
        this.tableContainer.classList.add('hidden');
    }

    // Check if an array is homogeneous (all objects with similar keys)
    isHomogeneousObjectArray(arr) {
        if (!Array.isArray(arr) || arr.length < 1) return false;

        // Check if all items are objects (not arrays, not null)
        const allObjects = arr.every(item =>
            item !== null &&
            typeof item === 'object' &&
            !Array.isArray(item)
        );

        if (!allObjects) return false;

        if (arr.length === 1) return true;

        // Get keys from all objects
        const keySets = arr.map(obj => Object.keys(obj).sort().join(','));

        // Check if at least 70% of objects have similar structure
        const keyCount = {};
        keySets.forEach(keys => {
            keyCount[keys] = (keyCount[keys] || 0) + 1;
        });

        const maxCount = Math.max(...Object.values(keyCount));
        return maxCount >= arr.length * 0.7;
    }

    // Get common keys from homogeneous array
    getCommonKeys(arr) {
        const keyCount = {};
        arr.forEach(obj => {
            if (obj && typeof obj === 'object') {
                Object.keys(obj).forEach(key => {
                    keyCount[key] = (keyCount[key] || 0) + 1;
                });
            }
        });

        // Return keys that appear in at least 50% of objects (or at least 1 for small arrays)
        const threshold = Math.max(1, arr.length * 0.5);
        return Object.keys(keyCount)
            .filter(key => keyCount[key] >= threshold)
            .sort((a, b) => keyCount[b] - keyCount[a]);
    }

    // Table rendering
    renderTable() {
        this.tableBody.innerHTML = '';
        this.renderValue(this.jsonData, '', [], 0);
    }

    renderValue(value, key, path, level) {
        const type = this.getType(value);
        const pathStr = path.join('.');

        if (type === 'array' && this.isHomogeneousObjectArray(value)) {
            this.renderArrayAsTable(value, key, path, level);
        } else if (type === 'object' || type === 'array') {
            this.renderComplexValue(value, key, path, level, type);
        } else {
            this.renderPrimitiveValue(value, key, path, level, type);
        }
    }

    // Render homogeneous array as an embedded table
    renderArrayAsTable(arr, key, path, level) {
        const pathStr = path.join('.');
        const isExpanded = this.expandedPaths.has(pathStr);
        const columns = this.getCommonKeys(arr);

        // Header row with expand toggle
        const headerRow = document.createElement('tr');
        headerRow.className = `row-level-${Math.min(level, 4)}`;
        headerRow.dataset.path = pathStr;

        headerRow.innerHTML = `
            <td>
                <div class="key-cell">
                    ${this.getIndent(level)}
                    <button class="toggle-btn ${isExpanded ? 'expanded' : ''}" data-path="${pathStr}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                    <span class="key-name">${this.escapeHtml(String(key))}</span>
                </div>
            </td>
            <td>
                <span class="value-preview array-table-hint">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="3" y1="15" x2="21" y2="15"></line>
                        <line x1="9" y1="3" x2="9" y2="21"></line>
                        <line x1="15" y1="3" x2="15" y2="21"></line>
                    </svg>
                    Table: ${arr.length} rows × ${columns.length} columns
                </span>
            </td>
            <td>
                <span class="type-badge array">array</span>
            </td>
        `;

        const toggleBtn = headerRow.querySelector('.toggle-btn');
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpand(pathStr);
        });

        this.tableBody.appendChild(headerRow);

        // Render embedded table when expanded
        if (isExpanded) {
            const tableRow = document.createElement('tr');
            tableRow.className = `row-level-${Math.min(level + 1, 4)} embedded-table-row`;

            const tableCell = document.createElement('td');
            tableCell.colSpan = 3;
            tableCell.style.padding = '0';

            const embeddedContainer = document.createElement('div');
            embeddedContainer.className = 'embedded-table-container';
            embeddedContainer.innerHTML = `
                <div class="embedded-indent">${this.getIndent(level + 1)}</div>
                <div class="embedded-table-wrapper">
                    <table class="embedded-table" data-array-path="${pathStr}">
                        <thead>
                            <tr>
                                <th class="row-index-header">#</th>
                                ${columns.map(col => `<th>${this.escapeHtml(col)}</th>`).join('')}
                                <th class="row-actions-header">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${arr.map((item, rowIndex) => this.renderTableRow(item, rowIndex, columns, path)).join('')}
                        </tbody>
                    </table>
                    <div class="table-footer">
                        <button class="btn-add-row" data-array-path="${pathStr}" title="Add new row">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="16"></line>
                                <line x1="8" y1="12" x2="16" y2="12"></line>
                            </svg>
                            Add Row
                        </button>
                    </div>
                </div>
            `;

            tableCell.appendChild(embeddedContainer);
            tableRow.appendChild(tableCell);
            this.tableBody.appendChild(tableRow);

            // Attach event listeners
            this.attachTableEventListeners(tableRow, path, columns);
        }
    }

    renderTableRow(item, rowIndex, columns, path) {
        const pathStr = path.join('.');
        const isNewRow = this.modifiedPaths.has(`${pathStr}.${rowIndex}.__new__`);

        return `
            <tr data-row-index="${rowIndex}" class="${isNewRow ? 'new-row' : ''}">
                <td class="row-index">${rowIndex}</td>
                ${columns.map(col => {
            const value = item[col];
            const type = this.getType(value);
            const cellPath = [...path, rowIndex, col].join('.');
            const isModified = this.modifiedPaths.has(cellPath);

            if (type === 'object' || type === 'array') {
                const preview = type === 'array'
                    ? `[${value.length}]`
                    : `{${Object.keys(value).length}}`;
                return `<td class="nested-cell">
                            <span class="nested-preview ${type}" 
                                  data-path="${cellPath}"
                                  title="Click to expand">${preview}</span>
                        </td>`;
            } else {
                const displayValue = this.formatValue(value, type);
                return `<td>
                            <div class="embedded-value-cell editable ${type} ${isModified ? 'modified' : ''}" 
                                 contenteditable="true" 
                                 data-path="${cellPath}" 
                                 data-type="${type}">${this.escapeHtml(displayValue)}</div>
                        </td>`;
            }
        }).join('')}
                <td class="row-actions">
                    <button class="btn-delete-row" data-array-path="${pathStr}" data-row-index="${rowIndex}" title="Delete row">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }

    attachTableEventListeners(tableRow, path, columns) {
        const pathStr = path.join('.');

        // Editable cells
        tableRow.querySelectorAll('.embedded-value-cell.editable').forEach(cell => {
            cell.addEventListener('blur', (e) => this.handleValueEdit(e));
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.target.blur();
                }
                // Tab navigation within table
                if (e.key === 'Tab') {
                    const cells = Array.from(tableRow.querySelectorAll('.embedded-value-cell.editable'));
                    const currentIndex = cells.indexOf(e.target);
                    if (!e.shiftKey && currentIndex < cells.length - 1) {
                        e.preventDefault();
                        cells[currentIndex + 1].focus();
                    } else if (e.shiftKey && currentIndex > 0) {
                        e.preventDefault();
                        cells[currentIndex - 1].focus();
                    }
                }
            });
        });

        // Nested object/array clicks
        tableRow.querySelectorAll('.nested-preview').forEach(preview => {
            preview.addEventListener('click', (e) => {
                const nestedPath = e.target.dataset.path;
                this.toggleExpand(nestedPath);
            });
        });

        // Add row button
        tableRow.querySelector('.btn-add-row').addEventListener('click', (e) => {
            this.addRow(pathStr, columns);
        });

        // Delete row buttons
        tableRow.querySelectorAll('.btn-delete-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const rowIndex = parseInt(btn.dataset.rowIndex);
                this.deleteRow(pathStr, rowIndex);
            });
        });
    }

    // Add a new row to the array
    addRow(arrayPath, columns) {
        const arr = this.getValueAtPath(arrayPath);
        if (!Array.isArray(arr)) return;

        // Create a new object with empty values for each column
        const newItem = {};
        columns.forEach(col => {
            // Try to infer type from existing items
            const existingValue = arr.length > 0 ? arr[0][col] : '';
            const type = this.getType(existingValue);

            if (type === 'number') {
                newItem[col] = 0;
            } else if (type === 'boolean') {
                newItem[col] = false;
            } else if (type === 'null') {
                newItem[col] = null;
            } else {
                newItem[col] = '';
            }
        });

        arr.push(newItem);

        // Mark the new row as modified
        const newRowIndex = arr.length - 1;
        this.modifiedPaths.add(`${arrayPath}.${newRowIndex}.__new__`);
        columns.forEach(col => {
            this.modifiedPaths.add(`${arrayPath}.${newRowIndex}.${col}`);
        });

        this.renderTable();
        this.showToast(`Row added`, 'success');
    }

    // Delete a row from the array
    deleteRow(arrayPath, rowIndex) {
        const arr = this.getValueAtPath(arrayPath);
        if (!Array.isArray(arr) || rowIndex < 0 || rowIndex >= arr.length) return;

        arr.splice(rowIndex, 1);

        // Update modified paths (remove old ones, they'll be stale)
        const newModifiedPaths = new Set();
        this.modifiedPaths.forEach(p => {
            if (!p.startsWith(arrayPath + '.')) {
                newModifiedPaths.add(p);
            }
        });
        this.modifiedPaths = newModifiedPaths;

        this.renderTable();
        this.showToast(`Row deleted`, 'info');
    }

    renderComplexValue(value, key, path, level, type) {
        const pathStr = path.join('.');
        const isExpanded = this.expandedPaths.has(pathStr);
        const entries = type === 'array' ? value.map((v, i) => [i, v]) : Object.entries(value);
        const count = entries.length;
        const preview = type === 'array' ? `[${count} items]` : `{${count} keys}`;

        const row = document.createElement('tr');
        row.className = `row-level-${Math.min(level, 4)}`;
        row.dataset.path = pathStr;

        row.innerHTML = `
            <td>
                <div class="key-cell">
                    ${this.getIndent(level)}
                    <button class="toggle-btn ${isExpanded ? 'expanded' : ''}" data-path="${pathStr}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                    <span class="key-name">${this.escapeHtml(String(key))}</span>
                </div>
            </td>
            <td>
                <span class="value-preview">${preview}</span>
            </td>
            <td>
                <span class="type-badge ${type}">${type}</span>
            </td>
        `;

        const toggleBtn = row.querySelector('.toggle-btn');
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpand(pathStr);
        });

        this.tableBody.appendChild(row);

        if (isExpanded) {
            entries.forEach(([k, v]) => {
                const childPath = [...path, k];
                this.renderValue(v, k, childPath, level + 1);
            });
        }
    }

    renderPrimitiveValue(value, key, path, level, type) {
        const pathStr = path.join('.');
        const displayValue = this.formatValue(value, type);
        const isModified = this.modifiedPaths.has(pathStr);

        const row = document.createElement('tr');
        row.className = `row-level-${Math.min(level, 4)}`;
        row.dataset.path = pathStr;

        row.innerHTML = `
            <td>
                <div class="key-cell">
                    ${this.getIndent(level)}
                    <span class="key-name">${this.escapeHtml(String(key))}</span>
                </div>
            </td>
            <td>
                <div class="value-cell editable ${type} ${isModified ? 'modified' : ''}" 
                     contenteditable="true" 
                     data-path="${pathStr}" 
                     data-type="${type}">${this.escapeHtml(displayValue)}</div>
            </td>
            <td>
                <span class="type-badge ${type}">${type}</span>
            </td>
        `;

        const valueCell = row.querySelector('.value-cell');
        valueCell.addEventListener('blur', (e) => this.handleValueEdit(e));
        valueCell.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.target.blur();
            }
        });

        this.tableBody.appendChild(row);
    }

    getIndent(level) {
        let indent = '';
        for (let i = 0; i < level; i++) {
            indent += '<span class="indent"></span>';
        }
        return indent;
    }

    getType(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (Array.isArray(value)) return 'array';
        return typeof value;
    }

    formatValue(value, type) {
        if (type === 'null') return 'null';
        if (type === 'undefined') return '';
        if (type === 'string') return value;
        if (type === 'boolean') return value ? 'true' : 'false';
        return String(value);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Value editing
    handleValueEdit(e) {
        const cell = e.target;
        const path = cell.dataset.path;
        const type = cell.dataset.type;
        let newValue = cell.textContent.trim();

        // Parse the value based on original type
        try {
            if (type === 'number') {
                const num = parseFloat(newValue);
                if (isNaN(num)) {
                    throw new Error('Invalid number');
                }
                newValue = num;
            } else if (type === 'boolean') {
                if (newValue.toLowerCase() === 'true') {
                    newValue = true;
                } else if (newValue.toLowerCase() === 'false') {
                    newValue = false;
                } else {
                    throw new Error('Invalid boolean');
                }
            } else if (type === 'null') {
                if (newValue.toLowerCase() === 'null') {
                    newValue = null;
                }
                // Allow converting null to string
            }
            // String values stay as strings

            this.setValueAtPath(path, newValue);

            // Mark as modified and add visual indicator
            this.modifiedPaths.add(path);
            cell.classList.add('modified');

        } catch (error) {
            // Revert to original value
            const originalValue = this.getValueAtPath(path);
            cell.textContent = this.formatValue(originalValue, type);
            this.showToast('Invalid value: ' + error.message, 'error');
        }
    }

    getValueAtPath(pathStr) {
        if (!pathStr) return this.jsonData;
        const keys = pathStr.split('.');
        let current = this.jsonData;
        for (const key of keys) {
            if (current === null || current === undefined) return undefined;
            current = Array.isArray(current) ? current[parseInt(key)] : current[key];
        }
        return current;
    }

    setValueAtPath(pathStr, value) {
        if (!pathStr) {
            this.jsonData = value;
            return;
        }
        const keys = pathStr.split('.');
        let current = this.jsonData;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            current = Array.isArray(current) ? current[parseInt(key)] : current[key];
        }
        const lastKey = keys[keys.length - 1];
        if (Array.isArray(current)) {
            current[parseInt(lastKey)] = value;
        } else {
            current[lastKey] = value;
        }
    }

    // Expand/Collapse
    toggleExpand(pathStr) {
        if (this.expandedPaths.has(pathStr)) {
            this.expandedPaths.delete(pathStr);
        } else {
            this.expandedPaths.add(pathStr);
        }
        this.renderTable();
    }

    expandAll() {
        this.collectAllPaths(this.jsonData, []);
        this.renderTable();
        this.showToast('All sections expanded', 'info');
    }

    collectAllPaths(value, path) {
        const type = this.getType(value);
        if (type === 'object' || type === 'array') {
            const pathStr = path.join('.');
            if (pathStr) this.expandedPaths.add(pathStr);
            const entries = type === 'array' ? value.map((v, i) => [i, v]) : Object.entries(value);
            entries.forEach(([k, v]) => {
                this.collectAllPaths(v, [...path, k]);
            });
        }
    }

    collapseAll() {
        this.expandedPaths.clear();
        this.renderTable();
        this.showToast('All sections collapsed', 'info');
    }

    // Export
    exportJSON() {
        if (!this.jsonData) {
            this.showToast('No data to export', 'error');
            return;
        }

        const jsonStr = JSON.stringify(this.jsonData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = this.fileName.replace('.json', '_edited.json');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('JSON exported successfully', 'success');
    }

    // Clear
    clearData() {
        this.jsonData = null;
        this.fileName = '';
        this.expandedPaths.clear();
        this.modifiedPaths.clear();
        this.tableBody.innerHTML = '';
        this.fileInput.value = '';
        this.hideUI();
        this.showToast('Data cleared', 'info');
    }

    // Toast notifications (only for important actions, not value updates)
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
        };

        toast.innerHTML = `${icons[type]}<span>${message}</span>`;
        this.toastContainer.appendChild(toast);

        // Remove after animation
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    window.jsonEditor = new JSONTableEditor();
});
