# PDF Extracter Backend

This backend service allows you to upload PDF files, extract and vectorize their text, and then ask questions about the content using a local LLM (Ollama).

---

## Installation Steps

### 1. Clone the Repository
```sh
git clone <your-repo-url>
cd PDF-ExtracterBE
```

### 2. Install Dependencies
```sh
npm install
```

### 3. Install and Run Ollama
- **Ollama** is required for embeddings and LLM responses.
- Download and install Ollama from: https://ollama.com/download
- Start the Ollama server:
  ```sh
  ollama serve
  ```
- Pull the required models:
  ```sh
  ollama pull nomic-embed-text
  ollama pull phi3
  ```

### 4. Start the Backend Server
```sh
node index.js
```
- The server will run at: [http://localhost:3000](http://localhost:3000)

---

## What Each Dependency Is For

| Dependency      | Used For                                                                 |
|----------------|--------------------------------------------------------------------------|
| express        | Creating the HTTP API server and endpoints                               |
| multer         | Handling file uploads (PDFs)                                             |
| pdf-parse      | Extracting text from uploaded PDF files                                  |
| fs (built-in)  | Reading/writing files (PDFs, vectors)                                    |
| node-fetch     | Making HTTP requests to the Ollama API                                   |
| cors           | Allowing cross-origin requests from your frontend (e.g., localhost:4200) |
| path (built-in)| Handling file and directory paths                                        |
| crypto (built-in)| Generating unique hashes for uploaded files                            |

---

## How the System Works

1. **PDF Upload**
   - User uploads a PDF via `/upload`.
   - The server extracts text, splits it into chunks, and gets vector embeddings for each chunk using Ollama.
   - Embeddings are saved in `vectorstore/` for future queries.

2. **Question Answering**
   - User sends a question and PDF reference to `/chat`.
   - The server embeds the question, finds the most relevant chunks using cosine similarity, and sends them as context to Ollama’s LLM.
   - The LLM generates a concise answer using only the provided context.

3. **Performance**
   - The backend keeps the Ollama model “warm” with periodic pings to avoid slow cold starts.
   - Timing logs are included for performance monitoring.

---

## Example .env (if needed)
If you want to use environment variables for configuration (optional), create a `.env` file:
```
PORT=3000
FRONTEND_ORIGIN=http://localhost:4200
```
And update the code to use these variables.

---

## Summary Table

| Feature         | Endpoint      | Description                                      |
|-----------------|--------------|--------------------------------------------------|
| PDF Upload      | `/upload`    | Upload and vectorize a PDF                       |
| Ask a Question  | `/chat`      | Ask a question about a specific PDF              |

---

## To Use This Project

1. Start Ollama and pull the required models.
2. Start this backend server.
3. Use your frontend (or Postman/cURL) to upload PDFs and ask questions.

---

**For any issues or questions, please refer to the code comments or contact the maintainer.** 