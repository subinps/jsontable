/**
 * JSON Table Editor
 * A modern web app for viewing, editing, and exporting JSON files
 */

class JSONTableEditor {
    constructor() {
        this.jsonData = null;
        this.fileName = '';
        this.expandedPaths = new Set();
        this.modifiedPaths = new Set();

        // Drag selection state
        this.isDragging = false;
        this.dragStartCell = null;
        this.selectedCells = [];
        this.currentTablePath = null;

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

        // Global paste handler
        document.addEventListener('paste', (e) => this.handlePaste(e));

        // Global mouse up to end drag selection
        document.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        // Click outside to clear selection
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.embedded-table-wrapper')) {
                this.clearSelection();
            }
        });

        // Escape to clear selection
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearSelection();
            }
        });

        // Event delegation for nested preview clicks (handles dynamically created elements)
        document.addEventListener('click', (e) => {
            // Nested preview toggle
            const nestedPreview = e.target.closest('.nested-preview');
            if (nestedPreview) {
                e.stopPropagation();
                const path = nestedPreview.dataset.path;
                if (path) {
                    this.toggleExpand(path);
                }
                return;
            }

            // Delete row button
            const deleteBtn = e.target.closest('.btn-delete-row');
            if (deleteBtn) {
                e.stopPropagation();
                const arrayPath = deleteBtn.dataset.arrayPath;
                const rowIndex = parseInt(deleteBtn.dataset.rowIndex);
                this.deleteRow(arrayPath, rowIndex);
                return;
            }

            // Add row button
            const addBtn = e.target.closest('.btn-add-row');
            if (addBtn) {
                e.stopPropagation();
                const arrayPath = addBtn.dataset.arrayPath;
                const columnsStr = addBtn.dataset.columns;
                let columns;
                try {
                    columns = JSON.parse(columnsStr);
                } catch {
                    // Try to get columns from the table header
                    const table = addBtn.closest('.nested-table-wrapper')?.querySelector('.embedded-table');
                    if (table) {
                        columns = Array.from(table.querySelectorAll('thead th'))
                            .map(th => th.textContent)
                            .filter(col => col && col !== '#');
                    }
                }
                if (columns) {
                    this.addRow(arrayPath, columns);
                }
                return;
            }

            // Export CSV button
            const exportBtn = e.target.closest('.btn-export-csv');
            if (exportBtn) {
                e.stopPropagation();
                const arrayPath = exportBtn.dataset.arrayPath;
                const columnsStr = exportBtn.dataset.columns;
                let columns;
                try {
                    columns = JSON.parse(columnsStr);
                } catch {
                    const table = exportBtn.closest('.nested-table-wrapper')?.querySelector('.embedded-table');
                    if (table) {
                        columns = Array.from(table.querySelectorAll('thead th'))
                            .map(th => th.textContent)
                            .filter(col => col && col !== '#');
                    }
                }
                if (columns) {
                    this.exportTableAsCSV(arrayPath, columns);
                }
                return;
            }

            // Import CSV button
            const importBtn = e.target.closest('.btn-import-csv');
            if (importBtn) {
                e.stopPropagation();
                const arrayPath = importBtn.dataset.arrayPath;
                const columnsStr = importBtn.dataset.columns;
                let columns;
                try {
                    columns = JSON.parse(columnsStr);
                } catch {
                    const table = importBtn.closest('.nested-table-wrapper')?.querySelector('.embedded-table');
                    if (table) {
                        columns = Array.from(table.querySelectorAll('thead th'))
                            .map(th => th.textContent)
                            .filter(col => col && col !== '#');
                    }
                }
                if (columns) {
                    this.triggerCSVImport(arrayPath, columns);
                }
                return;
            }
        });

        // Event delegation for editable cells in nested content
        document.addEventListener('blur', (e) => {
            if (e.target.classList.contains('embedded-value-cell') && e.target.classList.contains('editable')) {
                this.handleValueEdit(e);
            }
        }, true); // Use capture phase
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
                this.modifiedPaths.clear();
                this.clearSelection();
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

    // =====================================
    // DRAG SELECTION
    // =====================================

    clearSelection() {
        this.selectedCells.forEach(cell => cell.classList.remove('selected'));
        this.selectedCells = [];
        this.dragStartCell = null;
        this.isDragging = false;
    }

    startDragSelection(cell) {
        this.clearSelection();
        this.isDragging = true;
        this.dragStartCell = cell;
        cell.classList.add('selected');
        this.selectedCells = [cell];

        const table = cell.closest('.embedded-table');
        if (table) {
            this.currentTablePath = table.dataset.arrayPath;
        }
    }

    updateDragSelection(endCell) {
        if (!this.isDragging || !this.dragStartCell) return;

        const table = this.dragStartCell.closest('.embedded-table');
        if (!table || !table.contains(endCell)) return;

        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));

        const startRow = this.dragStartCell.closest('tr');
        const endRow = endCell.closest('tr');
        const startRowIndex = rows.indexOf(startRow);
        const endRowIndex = rows.indexOf(endRow);

        const startCells = Array.from(startRow.querySelectorAll('.embedded-value-cell'));
        const endCells = Array.from(endRow.querySelectorAll('.embedded-value-cell'));
        const startColIndex = startCells.indexOf(this.dragStartCell);
        const endColIndex = endCells.indexOf(endCell);

        if (startColIndex === -1 || endColIndex === -1) return;

        const minRow = Math.min(startRowIndex, endRowIndex);
        const maxRow = Math.max(startRowIndex, endRowIndex);
        const minCol = Math.min(startColIndex, endColIndex);
        const maxCol = Math.max(startColIndex, endColIndex);

        // Clear previous selection
        this.selectedCells.forEach(c => c.classList.remove('selected'));
        this.selectedCells = [];

        // Select range
        for (let r = minRow; r <= maxRow; r++) {
            const row = rows[r];
            const cells = Array.from(row.querySelectorAll('.embedded-value-cell'));
            for (let c = minCol; c <= maxCol; c++) {
                if (cells[c]) {
                    cells[c].classList.add('selected');
                    this.selectedCells.push(cells[c]);
                }
            }
        }
    }

    // =====================================
    // PASTE FUNCTIONALITY
    // =====================================

    handlePaste(e) {
        if (this.selectedCells.length === 0) return;

        const activeEl = document.activeElement;
        if (activeEl && activeEl.isContentEditable && activeEl.classList.contains('embedded-value-cell')) {
            if (this.selectedCells.length === 1 && this.selectedCells[0] === activeEl) {
                return; // Let default paste work for single cell editing
            }
        }

        e.preventDefault();

        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedText = clipboardData.getData('text');

        if (!pastedText) return;

        const rows = pastedText.split(/\r?\n/).filter(row => row.trim() !== '');
        const data = rows.map(row => row.split('\t'));

        if (data.length === 0) return;

        const startCell = this.selectedCells[0];
        const table = startCell.closest('.embedded-table');
        if (!table) return;

        const tbody = table.querySelector('tbody');
        const tableRows = Array.from(tbody.querySelectorAll('tr'));
        const startRow = startCell.closest('tr');
        const startRowIndex = tableRows.indexOf(startRow);

        const startRowCells = Array.from(startRow.querySelectorAll('.embedded-value-cell'));
        const startColIndex = startRowCells.indexOf(startCell);

        let updatedCount = 0;

        for (let r = 0; r < data.length; r++) {
            const targetRowIndex = startRowIndex + r;
            if (targetRowIndex >= tableRows.length) break;

            const targetRow = tableRows[targetRowIndex];
            const targetCells = Array.from(targetRow.querySelectorAll('.embedded-value-cell'));

            for (let c = 0; c < data[r].length; c++) {
                const targetColIndex = startColIndex + c;
                if (targetColIndex >= targetCells.length) break;

                const cell = targetCells[targetColIndex];
                const path = cell.dataset.path;
                const type = cell.dataset.type;
                let newValue = data[r][c].trim();

                try {
                    if (type === 'number') {
                        const num = parseFloat(newValue);
                        if (!isNaN(num)) newValue = num;
                        else continue;
                    } else if (type === 'boolean') {
                        if (newValue.toLowerCase() === 'true') newValue = true;
                        else if (newValue.toLowerCase() === 'false') newValue = false;
                        else continue;
                    } else if (type === 'null' && newValue.toLowerCase() === 'null') {
                        newValue = null;
                    }

                    this.setValueAtPath(path, newValue);
                    this.modifiedPaths.add(path);
                    cell.textContent = this.formatValue(newValue, type);
                    cell.classList.add('modified');
                    updatedCount++;
                } catch (error) {
                    console.warn(`Failed to paste at ${path}:`, error);
                }
            }
        }

        this.clearSelection();
        if (updatedCount > 0) {
            this.showToast(`Pasted ${updatedCount} cells`, 'success');
        }
    }

    // =====================================
    // CSV EXPORT/IMPORT
    // =====================================

    exportTableAsCSV(arrayPath, columns) {
        const arr = this.getValueAtPath(arrayPath);
        if (!Array.isArray(arr)) return;

        // Build CSV
        const csvRows = [];

        // Header row
        csvRows.push(columns.join(','));

        // Data rows
        arr.forEach(item => {
            const row = columns.map(col => {
                const value = item[col];
                const type = this.getType(value);

                if (type === 'object' || type === 'array') {
                    return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
                } else if (type === 'string') {
                    // Escape quotes and wrap in quotes if contains comma
                    const escaped = String(value).replace(/"/g, '""');
                    return value.includes(',') || value.includes('\n') ? `"${escaped}"` : escaped;
                } else {
                    return this.formatValue(value, type);
                }
            });
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const baseName = this.fileName.replace('.json', '');
        const tableName = arrayPath.split('.').pop() || 'table';
        a.download = `${baseName}_${tableName}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast(`Exported ${arr.length} rows to CSV`, 'success');
    }

    importCSVToTable(arrayPath, columns, file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csvText = e.target.result;
                const lines = csvText.split(/\r?\n/).filter(line => line.trim());

                if (lines.length < 2) {
                    this.showToast('CSV file is empty or has no data rows', 'error');
                    return;
                }

                // Parse header
                const header = this.parseCSVRow(lines[0]);

                // Validate columns match
                const missingCols = columns.filter(col => !header.includes(col));
                if (missingCols.length > 0) {
                    this.showToast(`Missing columns: ${missingCols.join(', ')}`, 'error');
                    return;
                }

                // Get the array
                const arr = this.getValueAtPath(arrayPath);
                if (!Array.isArray(arr)) return;

                // Parse data rows and update array
                const newData = [];
                for (let i = 1; i < lines.length; i++) {
                    const values = this.parseCSVRow(lines[i]);
                    if (values.length === 0) continue;

                    const item = {};
                    header.forEach((col, idx) => {
                        if (columns.includes(col)) {
                            let value = values[idx] || '';

                            // Try to infer type from existing data
                            const existingValue = arr.length > 0 ? arr[0][col] : '';
                            const type = this.getType(existingValue);

                            if (type === 'number') {
                                const num = parseFloat(value);
                                value = isNaN(num) ? 0 : num;
                            } else if (type === 'boolean') {
                                value = value.toLowerCase() === 'true';
                            } else if (type === 'null' && value.toLowerCase() === 'null') {
                                value = null;
                            }

                            item[col] = value;
                        }
                    });
                    newData.push(item);
                }

                // Replace array data
                arr.length = 0;
                newData.forEach(item => arr.push(item));

                // Mark all as modified
                newData.forEach((item, rowIndex) => {
                    columns.forEach(col => {
                        this.modifiedPaths.add(`${arrayPath}.${rowIndex}.${col}`);
                    });
                });

                this.renderTable();
                // Re-expand the path
                this.expandedPaths.add(arrayPath);
                this.renderTable();

                this.showToast(`Imported ${newData.length} rows from CSV`, 'success');
            } catch (error) {
                this.showToast('Error parsing CSV: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    parseCSVRow(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (inQuotes) {
                if (char === '"') {
                    if (line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    current += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ',') {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
        }
        result.push(current.trim());

        return result;
    }

    triggerCSVImport(arrayPath, columns) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importCSVToTable(arrayPath, columns, file);
            }
        };
        input.click();
    }

    // =====================================
    // TABLE RENDERING
    // =====================================

    isHomogeneousObjectArray(arr) {
        if (!Array.isArray(arr) || arr.length < 1) return false;

        const allObjects = arr.every(item =>
            item !== null && typeof item === 'object' && !Array.isArray(item)
        );

        if (!allObjects) return false;
        if (arr.length === 1) return true;

        const keySets = arr.map(obj => Object.keys(obj).sort().join(','));
        const keyCount = {};
        keySets.forEach(keys => {
            keyCount[keys] = (keyCount[keys] || 0) + 1;
        });

        const maxCount = Math.max(...Object.values(keyCount));
        return maxCount >= arr.length * 0.7;
    }

    getCommonKeys(arr) {
        const keyCount = {};
        arr.forEach(obj => {
            if (obj && typeof obj === 'object') {
                Object.keys(obj).forEach(key => {
                    keyCount[key] = (keyCount[key] || 0) + 1;
                });
            }
        });

        const threshold = Math.max(1, arr.length * 0.5);
        return Object.keys(keyCount)
            .filter(key => keyCount[key] >= threshold)
            .sort((a, b) => keyCount[b] - keyCount[a]);
    }

    renderTable() {
        this.tableBody.innerHTML = '';
        this.renderValue(this.jsonData, '', [], 0);
    }

    renderValue(value, key, path, level) {
        const type = this.getType(value);

        if (type === 'array' && this.isHomogeneousObjectArray(value)) {
            this.renderArrayAsTable(value, key, path, level);
        } else if (type === 'object' || type === 'array') {
            this.renderComplexValue(value, key, path, level, type);
        } else {
            this.renderPrimitiveValue(value, key, path, level, type);
        }
    }

    renderArrayAsTable(arr, key, path, level) {
        const pathStr = path.join('.');
        const isExpanded = this.expandedPaths.has(pathStr);
        const columns = this.getCommonKeys(arr);

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

        headerRow.querySelector('.toggle-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpand(pathStr);
        });

        this.tableBody.appendChild(headerRow);

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
                    <div class="table-toolbar">
                        <div class="toolbar-left">
                            <button class="btn-csv btn-export-csv" data-array-path="${pathStr}" title="Export to CSV for Excel editing">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                Export CSV
                            </button>
                            <button class="btn-csv btn-import-csv" data-array-path="${pathStr}" title="Import from CSV to replace data">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                                Import CSV
                            </button>
                        </div>
                        <span class="selection-hint">
                            Drag to select • Ctrl+V to paste
                        </span>
                    </div>
                    <table class="embedded-table" data-array-path="${pathStr}">
                        <thead>
                            <tr>
                                <th class="row-index-header">#</th>
                                ${columns.map(col => `<th>${this.escapeHtml(col)}</th>`).join('')}
                                <th class="row-actions-header"></th>
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

            this.attachTableEventListeners(tableRow, path, columns);
        }
    }

    renderTableRow(item, rowIndex, columns, path) {
        const pathStr = path.join('.');
        const isNewRow = this.modifiedPaths.has(`${pathStr}.${rowIndex}.__new__`);

        // Build the main row
        let rowHtml = `<tr data-row-index="${rowIndex}" class="${isNewRow ? 'new-row' : ''}">
            <td class="row-index">${rowIndex}</td>
            ${columns.map((col, colIndex) => {
            const value = item[col];
            const type = this.getType(value);
            const cellPath = [...path, rowIndex, col].join('.');
            const isModified = this.modifiedPaths.has(cellPath);
            const isExpanded = this.expandedPaths.has(cellPath);

            if (type === 'object' || type === 'array') {
                const preview = type === 'array'
                    ? `[${value.length}]`
                    : `{${Object.keys(value).length}}`;
                return `<td class="nested-cell">
                        <span class="nested-preview ${type} ${isExpanded ? 'expanded' : ''}" 
                              data-path="${cellPath}"
                              title="Click to ${isExpanded ? 'collapse' : 'expand'}">
                            <svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                            ${preview}
                        </span>
                    </td>`;
            } else {
                const displayValue = this.formatValue(value, type);
                return `<td>
                        <div class="embedded-value-cell editable ${type} ${isModified ? 'modified' : ''}" 
                             contenteditable="true" 
                             data-path="${cellPath}" 
                             data-type="${type}"
                             data-row="${rowIndex}"
                             data-col="${colIndex}">${this.escapeHtml(displayValue)}</div>
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
        </tr>`;

        // Add expansion rows for any expanded nested items
        columns.forEach((col, colIndex) => {
            const value = item[col];
            const type = this.getType(value);
            const cellPath = [...path, rowIndex, col].join('.');

            if ((type === 'object' || type === 'array') && this.expandedPaths.has(cellPath)) {
                rowHtml += this.renderNestedExpansionRow(value, cellPath, columns.length);
            }
        });

        return rowHtml;
    }

    renderNestedExpansionRow(value, cellPath, colSpan) {
        const type = this.getType(value);

        // Check if it's a homogeneous array of objects - render as table
        if (type === 'array' && this.isHomogeneousObjectArray(value)) {
            const nestedColumns = this.getCommonKeys(value);
            const columnsJson = JSON.stringify(nestedColumns).replace(/"/g, '&quot;');

            return `
                <tr class="nested-expansion-row">
                    <td colspan="${colSpan + 2}" class="nested-expansion-cell">
                        <div class="nested-content">
                            <div class="nested-table-wrapper" data-array-path="${cellPath}">
                                <div class="table-toolbar nested-toolbar">
                                    <div class="toolbar-left">
                                        <button class="btn-csv btn-export-csv" data-array-path="${cellPath}" data-columns="${columnsJson}" title="Export to CSV">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                <polyline points="7 10 12 15 17 10"></polyline>
                                                <line x1="12" y1="15" x2="12" y2="3"></line>
                                            </svg>
                                            Export CSV
                                        </button>
                                        <button class="btn-csv btn-import-csv" data-array-path="${cellPath}" data-columns="${columnsJson}" title="Import from CSV">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                <polyline points="17 8 12 3 7 8"></polyline>
                                                <line x1="12" y1="3" x2="12" y2="15"></line>
                                            </svg>
                                            Import CSV
                                        </button>
                                    </div>
                                    <span class="selection-hint">Drag to select • Ctrl+V to paste</span>
                                </div>
                                <table class="embedded-table nested-level" data-array-path="${cellPath}">
                                    <thead>
                                        <tr>
                                            <th class="row-index-header">#</th>
                                            ${nestedColumns.map(col => `<th>${this.escapeHtml(col)}</th>`).join('')}
                                            <th class="row-actions-header"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${value.map((item, idx) => this.renderNestedTableRow(item, idx, nestedColumns, cellPath)).join('')}
                                    </tbody>
                                </table>
                                <div class="table-footer">
                                    <button class="btn-add-row" data-array-path="${cellPath}" data-columns="${columnsJson}" title="Add new row">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <line x1="12" y1="8" x2="12" y2="16"></line>
                                            <line x1="8" y1="12" x2="16" y2="12"></line>
                                        </svg>
                                        Add Row
                                    </button>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        } else if (type === 'array') {

            // Regular array - show items as a list
            return `
                <tr class="nested-expansion-row">
                    <td colspan="${colSpan + 2}" class="nested-expansion-cell">
                        <div class="nested-content nested-list">
                            ${value.map((item, idx) => {
                const itemPath = `${cellPath}.${idx}`;
                const itemType = this.getType(item);
                const isModified = this.modifiedPaths.has(itemPath);

                if (itemType === 'object' || itemType === 'array') {
                    const preview = itemType === 'array' ? `[${item.length}]` : `{${Object.keys(item).length}}`;
                    const isExpanded = this.expandedPaths.has(itemPath);
                    return `
                                        <div class="nested-list-item">
                                            <span class="nested-index">[${idx}]</span>
                                            <span class="nested-preview ${itemType} ${isExpanded ? 'expanded' : ''}" 
                                                  data-path="${itemPath}">${preview}</span>
                                        </div>
                                        ${isExpanded ? `<div class="nested-expanded-content">${this.renderNestedExpansionContent(item, itemPath)}</div>` : ''}
                                    `;
                } else {
                    return `
                                        <div class="nested-list-item">
                                            <span class="nested-index">[${idx}]</span>
                                            <div class="embedded-value-cell editable ${itemType} ${isModified ? 'modified' : ''}" 
                                                 contenteditable="true" 
                                                 data-path="${itemPath}"
                                                 data-type="${itemType}">${this.escapeHtml(this.formatValue(item, itemType))}</div>
                                        </div>
                                    `;
                }
            }).join('')}
                        </div>
                    </td>
                </tr>
            `;
        } else if (type === 'object') {
            // Object - show key-value pairs
            return `
                <tr class="nested-expansion-row">
                    <td colspan="${colSpan + 2}" class="nested-expansion-cell">
                        <div class="nested-content nested-object">
                            ${Object.entries(value).map(([key, val]) => {
                const itemPath = `${cellPath}.${key}`;
                const itemType = this.getType(val);
                const isModified = this.modifiedPaths.has(itemPath);

                if (itemType === 'object' || itemType === 'array') {
                    const preview = itemType === 'array' ? `[${val.length}]` : `{${Object.keys(val).length}}`;
                    const isExpanded = this.expandedPaths.has(itemPath);
                    return `
                                        <div class="nested-object-item">
                                            <span class="nested-key">${this.escapeHtml(key)}:</span>
                                            <span class="nested-preview ${itemType} ${isExpanded ? 'expanded' : ''}" 
                                                  data-path="${itemPath}">${preview}</span>
                                        </div>
                                        ${isExpanded ? `<div class="nested-expanded-content">${this.renderNestedExpansionContent(val, itemPath)}</div>` : ''}
                                    `;
                } else {
                    return `
                                        <div class="nested-object-item">
                                            <span class="nested-key">${this.escapeHtml(key)}:</span>
                                            <div class="embedded-value-cell editable ${itemType} ${isModified ? 'modified' : ''}" 
                                                 contenteditable="true" 
                                                 data-path="${itemPath}"
                                                 data-type="${itemType}">${this.escapeHtml(this.formatValue(val, itemType))}</div>
                                            <span class="type-badge small ${itemType}">${itemType}</span>
                                        </div>
                                    `;
                }
            }).join('')}
                        </div>
                    </td>
                </tr>
            `;
        }

        return '';
    }

    renderNestedExpansionContent(value, cellPath) {
        const type = this.getType(value);

        if (type === 'array' && this.isHomogeneousObjectArray(value)) {
            const nestedColumns = this.getCommonKeys(value);
            return `
                <div class="nested-table-wrapper">
                    <table class="embedded-table nested-level" data-array-path="${cellPath}">
                        <thead>
                            <tr>
                                <th class="row-index-header">#</th>
                                ${nestedColumns.map(col => `<th>${this.escapeHtml(col)}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${value.map((item, idx) => this.renderNestedTableRow(item, idx, nestedColumns, cellPath)).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else if (type === 'array') {
            return `
                <div class="nested-list">
                    ${value.map((item, idx) => {
                const itemPath = `${cellPath}.${idx}`;
                const itemType = this.getType(item);
                return `
                            <div class="nested-list-item">
                                <span class="nested-index">[${idx}]</span>
                                <span class="nested-value ${itemType}">${this.escapeHtml(this.formatValue(item, itemType))}</span>
                            </div>
                        `;
            }).join('')}
                </div>
            `;
        } else if (type === 'object') {
            return `
                <div class="nested-object">
                    ${Object.entries(value).map(([key, val]) => {
                const itemType = this.getType(val);
                return `
                            <div class="nested-object-item">
                                <span class="nested-key">${this.escapeHtml(key)}:</span>
                                <span class="nested-value ${itemType}">${this.escapeHtml(this.formatValue(val, itemType))}</span>
                            </div>
                        `;
            }).join('')}
                </div>
            `;
        }
        return '';
    }

    renderNestedTableRow(item, rowIndex, columns, parentPath) {
        return `
            <tr data-row-index="${rowIndex}">
                <td class="row-index">${rowIndex}</td>
                ${columns.map(col => {
            const value = item[col];
            const type = this.getType(value);
            const cellPath = `${parentPath}.${rowIndex}.${col}`;
            const isModified = this.modifiedPaths.has(cellPath);
            const isExpanded = this.expandedPaths.has(cellPath);

            if (type === 'object' || type === 'array') {
                const preview = type === 'array' ? `[${value.length}]` : `{${Object.keys(value).length}}`;
                return `<td class="nested-cell">
                            <span class="nested-preview ${type} ${isExpanded ? 'expanded' : ''}" 
                                  data-path="${cellPath}">
                                <svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                                ${preview}
                            </span>
                        </td>`;
            } else {
                const displayValue = this.formatValue(value, type);
                return `<td>
                            <div class="embedded-value-cell editable ${type} ${isModified ? 'modified' : ''}" 
                                 contenteditable="true" data-path="${cellPath}" data-type="${type}">${this.escapeHtml(displayValue)}</div>
                        </td>`;
            }
        }).join('')}
                <td class="row-actions">
                    <button class="btn-delete-row" data-array-path="${parentPath}" data-row-index="${rowIndex}" title="Delete row">
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

        // CSV buttons
        const exportBtn = tableRow.querySelector('.btn-export-csv');
        const importBtn = tableRow.querySelector('.btn-import-csv');

        exportBtn.addEventListener('click', () => {
            this.exportTableAsCSV(pathStr, columns);
        });

        importBtn.addEventListener('click', () => {
            this.triggerCSVImport(pathStr, columns);
        });

        // Editable cells with drag selection
        tableRow.querySelectorAll('.embedded-value-cell.editable').forEach(cell => {
            // Mouse down - start drag selection
            cell.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return; // Only left click
                e.preventDefault();
                this.startDragSelection(cell);
            });

            // Mouse enter during drag
            cell.addEventListener('mouseenter', (e) => {
                if (this.isDragging) {
                    this.updateDragSelection(cell);
                }
            });

            // Double click to edit
            cell.addEventListener('dblclick', (e) => {
                this.clearSelection();
                cell.focus();
                const range = document.createRange();
                range.selectNodeContents(cell);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            });

            cell.addEventListener('blur', (e) => this.handleValueEdit(e));
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.target.blur();
                }
                if (e.key === 'Tab') {
                    const allCells = Array.from(tableRow.querySelectorAll('.embedded-value-cell.editable'));
                    const currentIndex = allCells.indexOf(e.target);
                    if (!e.shiftKey && currentIndex < allCells.length - 1) {
                        e.preventDefault();
                        allCells[currentIndex + 1].focus();
                    } else if (e.shiftKey && currentIndex > 0) {
                        e.preventDefault();
                        allCells[currentIndex - 1].focus();
                    }
                }
            });
        });

        // Nested object/array clicks - toggle inline expansion
        tableRow.querySelectorAll('.nested-preview').forEach(preview => {
            preview.addEventListener('click', (e) => {
                e.stopPropagation();
                const nestedPath = e.target.dataset.path;
                this.toggleExpand(nestedPath);
            });
        });


        // Add row button
        tableRow.querySelector('.btn-add-row').addEventListener('click', () => {
            this.addRow(pathStr, columns);
        });

        // Delete row buttons
        tableRow.querySelectorAll('.btn-delete-row').forEach(btn => {
            btn.addEventListener('click', () => {
                this.deleteRow(pathStr, parseInt(btn.dataset.rowIndex));
            });
        });
    }

    addRow(arrayPath, columns) {
        const arr = this.getValueAtPath(arrayPath);
        if (!Array.isArray(arr)) return;

        const newItem = {};
        columns.forEach(col => {
            const existingValue = arr.length > 0 ? arr[0][col] : '';
            const type = this.getType(existingValue);

            if (type === 'number') newItem[col] = 0;
            else if (type === 'boolean') newItem[col] = false;
            else if (type === 'null') newItem[col] = null;
            else newItem[col] = '';
        });

        arr.push(newItem);

        const newRowIndex = arr.length - 1;
        this.modifiedPaths.add(`${arrayPath}.${newRowIndex}.__new__`);
        columns.forEach(col => {
            this.modifiedPaths.add(`${arrayPath}.${newRowIndex}.${col}`);
        });

        this.renderTable();
        this.showToast(`Row added`, 'success');
    }

    deleteRow(arrayPath, rowIndex) {
        const arr = this.getValueAtPath(arrayPath);
        if (!Array.isArray(arr) || rowIndex < 0 || rowIndex >= arr.length) return;

        arr.splice(rowIndex, 1);

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

        row.querySelector('.toggle-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpand(pathStr);
        });

        this.tableBody.appendChild(row);

        if (isExpanded) {
            entries.forEach(([k, v]) => {
                this.renderValue(v, k, [...path, k], level + 1);
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

    handleValueEdit(e) {
        const cell = e.target;
        const path = cell.dataset.path;
        const type = cell.dataset.type;
        let newValue = cell.textContent.trim();

        try {
            if (type === 'number') {
                const num = parseFloat(newValue);
                if (isNaN(num)) throw new Error('Invalid number');
                newValue = num;
            } else if (type === 'boolean') {
                if (newValue.toLowerCase() === 'true') newValue = true;
                else if (newValue.toLowerCase() === 'false') newValue = false;
                else throw new Error('Invalid boolean');
            } else if (type === 'null' && newValue.toLowerCase() === 'null') {
                newValue = null;
            }

            this.setValueAtPath(path, newValue);
            this.modifiedPaths.add(path);
            cell.classList.add('modified');

        } catch (error) {
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

    clearData() {
        this.jsonData = null;
        this.fileName = '';
        this.expandedPaths.clear();
        this.modifiedPaths.clear();
        this.clearSelection();
        this.tableBody.innerHTML = '';
        this.fileInput.value = '';
        this.hideUI();
        this.showToast('Data cleared', 'info');
    }

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

        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 3000);
    }

    // Show nested data in a modal
    showNestedDataModal(pathStr) {
        const value = this.getValueAtPath(pathStr);
        if (value === undefined) return;

        // Remove existing modal if any
        const existingModal = document.querySelector('.nested-modal-overlay');
        if (existingModal) existingModal.remove();

        const type = this.getType(value);
        const pathParts = pathStr.split('.');
        const fieldName = pathParts[pathParts.length - 1];

        const modal = document.createElement('div');
        modal.className = 'nested-modal-overlay';
        modal.innerHTML = `
            <div class="nested-modal">
                <div class="nested-modal-header">
                    <h3>
                        <span class="type-badge ${type}">${type}</span>
                        ${this.escapeHtml(fieldName)}
                    </h3>
                    <button class="btn-close-modal" title="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="nested-modal-content">
                    <textarea class="nested-json-editor" spellcheck="false">${JSON.stringify(value, null, 2)}</textarea>
                </div>
                <div class="nested-modal-footer">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-save">Save Changes</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeModal = () => modal.remove();
        const overlay = modal;
        const closeBtn = modal.querySelector('.btn-close-modal');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const saveBtn = modal.querySelector('.btn-save');
        const textarea = modal.querySelector('.nested-json-editor');

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        // Save changes
        saveBtn.addEventListener('click', () => {
            try {
                const newValue = JSON.parse(textarea.value);
                this.setValueAtPath(pathStr, newValue);
                this.modifiedPaths.add(pathStr);
                this.renderTable();
                closeModal();
                this.showToast('Nested data updated', 'success');
            } catch (error) {
                this.showToast('Invalid JSON: ' + error.message, 'error');
            }
        });

        // Close on Escape
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Focus textarea
        textarea.focus();
    }
}


// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.jsonEditor = new JSONTableEditor();
});
