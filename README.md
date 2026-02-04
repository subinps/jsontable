# JSON Table Editor

A modern, elegant web application for uploading, viewing, editing, and exporting JSON files in a beautiful table format.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

## ✨ Features

- **Drag & Drop Upload** - Simply drag your JSON file onto the page
- **Smart Table View** - Arrays of objects automatically display as editable tables
- **Inline Editing** - Click any value to edit, with type preservation
- **Add/Remove Rows** - Easily modify array data with + and delete buttons
- **Visual Change Tracking** - Modified cells are highlighted in yellow
- **Expand/Collapse** - Navigate nested structures with collapsible sections
- **Export JSON** - Download your edited JSON with proper formatting
- **Dark Theme** - Beautiful modern UI with glassmorphism effects

## 🚀 Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/json-table-editor.git
   ```

2. Open `index.html` in your browser - no build step required!

3. Upload a JSON file and start editing.

## 📖 Usage

### Uploading JSON
- Drag and drop a `.json` file onto the upload zone
- Or click to browse and select a file

### Viewing Data
- Click the arrow (▶) to expand nested objects and arrays
- Arrays of objects with similar keys display as editable tables
- Use "Expand All" / "Collapse All" buttons for quick navigation

### Editing Values
- Click any value cell to edit inline
- Press `Enter` or click outside to save
- Press `Tab` to move between cells in table view
- Modified cells show a yellow highlight

### Managing Rows (for array tables)
- Click **"+ Add Row"** to add a new item
- Click the **trash icon** to delete a row

### Exporting
- Click **"Export JSON"** to download your changes
- File is saved with `_edited` suffix

## 🎨 Design

- **Dark Theme** with purple/cyan accent colors
- **Glassmorphism** card effects
- **Color-coded Types**:
  - 🟣 String (purple)
  - 🔵 Number (blue)
  - 🟢 Boolean (green)
  - ⚫ Null (gray)
  - 🟠 Object (orange)
  - 🩷 Array (pink)

## 📁 Project Structure

```
json-table-editor/
├── index.html    # Main HTML structure
├── styles.css    # Modern dark theme styling
├── app.js        # Core application logic
└── README.md     # This file
```

## 🛠️ Technologies

- **HTML5** - Semantic structure
- **CSS3** - Custom properties, flexbox, grid, animations
- **Vanilla JavaScript** - No dependencies!

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

---

