# PDFExtracter

This project is a web application for uploading, viewing, and interacting with PDF files using a chat-based interface. It is built with Angular, Angular Material, and TypeScript.

## Project Overview

PDFExtracter allows users to:
- Upload PDF files via drag-and-drop or file picker
- View PDF files directly in the browser
- Interact with an AI-powered chat to ask questions about the uploaded PDF
- Receive a summary and suggested questions for each PDF

## Tech Stack & Dependencies

- **Angular:** 20.1.0 (CLI: 20.1.1)
- **TypeScript:** 5.8.2
- **Angular Material:** 20.1.2
- **ng2-pdf-viewer:** 10.4.0 (for in-browser PDF rendering)
- **RxJS:** 7.8.0
- **Karma/Jasmine:** for unit testing

## UI & Features

- **Material Design:** Uses Angular Material for a modern, responsive UI (buttons, inputs, cards, progress spinners, etc.)
- **PDF Upload:** Drag-and-drop or click to upload. Shows progress spinner during upload.
- **PDF Viewer:** Embedded PDF viewer with page navigation.
- **Chat Interface:** Ask questions about the PDF, get AI-generated answers, summary, and suggested questions.
- **Responsive Layout:** Optimized for desktop and mobile.

## Main Components

- `PdfUpload`: Handles file upload, drag-and-drop, and manages PDF state.
- `ViewPdf`: Renders the PDF using ng2-pdf-viewer.
- `Chat`: Provides a chat interface for interacting with the AI about the PDF content.

## Backend Integration

- **Upload Endpoint:** `POST http://localhost:3000/upload` (expects a PDF file, returns filename)
- **Chat Endpoint:** `POST http://localhost:3000/chat` (expects `{ question, filename }`, returns AI response)

> **Note:** You need a backend server running at `localhost:3000` that implements these endpoints.

## Getting Started

### Install dependencies

```bash
npm install
```

### Development server

```bash
ng serve
```

Navigate to `http://localhost:4200/`. The app will reload if you change any source files.

### Building

```bash
ng build
```

### Running unit tests

```bash
ng test
```

## Folder Structure

- `src/app/components/pdf-upload/` – PDF upload and viewer components
- `src/app/components/chat/` – Chat interface
- `src/app/services/` – Upload and chat service logic

## Styling & Themes

- Uses SCSS for component styles
- Includes Angular Material's Azure Blue prebuilt theme

## License

MIT
