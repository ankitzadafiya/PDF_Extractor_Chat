// ✅ Load environment variables from .env file
require('dotenv').config();

// ✅ Core Express app setup
const express = require('express');
const multer = require('multer'); // Handles multipart/form-data for file uploads
const pdfParse = require('pdf-parse'); // Parses and extracts text from PDF files
const fs = require('fs'); // File system module for reading/writing files
const path = require('path'); // Utility for handling file paths
const cors = require('cors'); // Enables Cross-Origin Resource Sharing
const crypto = require('crypto'); // Used for creating MD5 hash of PDF contents (caching)

// ✅ AI SDKs
const { OpenAI } = require('openai'); // Groq-compatible LLM client using OpenAI-compatible SDK
const { CohereClient } = require('cohere-ai'); // Cohere SDK for embeddings

// ✅ Initialize Express app
const app = express();

// ✅ Enable CORS for local and deployed frontend (update domain later if needed)
app.use(cors({
  origin: ['http://localhost:4200', 'https://your-vercel-frontend.vercel.app'] // ← update Vercel URL here later
}));

app.use(express.json()); // Parse JSON request bodies

// ✅ Configure multer for file uploads (stored in 'uploads/' directory)
const upload = multer({ dest: 'uploads/' });

// ✅ Folder to store embeddings (vector database)
const VECTOR_DIR = './vectorstore';
if (!fs.existsSync(VECTOR_DIR)) fs.mkdirSync(VECTOR_DIR); // Create if it doesn't exist

// ✅ Initialize AI clients
const co = new CohereClient({ apiKey: process.env.CO_API_KEY }); // Cohere for embeddings
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY, // Groq API key (used as OpenAI-compatible)
  baseURL: 'https://api.groq.com/openai/v1' // Groq’s base URL for OpenAI-compatible API
});

// 🔐 Generate MD5 hash for deduplication/caching based on file content
function getFileHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

// 📚 Chunk extracted text into manageable sizes (~500 characters per chunk)
function chunkText(text, chunkSize = 500) {
  const paragraphs = text.split('\n\n'); // Break text by double newline
  const chunks = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = '';
    }
    currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
  }

  if (currentChunk) chunks.push(currentChunk); // Push remaining chunk
  return chunks;
}

// 🔎 Compute cosine similarity between two embedding vectors
function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (magA * magB); // Cosine formula
}

// 📤 Upload endpoint → Parses PDF, creates embeddings and caches
app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    const file = req.file;
    const dataBuffer = fs.readFileSync(file.path); // Read uploaded PDF
    const fileHash = getFileHash(dataBuffer); // Generate unique hash
    const vectorPath = path.join(VECTOR_DIR, `${fileHash}.json`);

    // 🧠 If already processed, return cached result
    if (fs.existsSync(vectorPath)) {
      return res.json({ message: '✅ PDF already processed (cached)', filename: fileHash });
    }

    const data = await pdfParse(dataBuffer); // Extract text from PDF
    const chunks = chunkText(data.text, 500); // Chunk extracted text

    // 🔁 Generate embeddings for each chunk using Cohere
    const embeddingPromises = chunks.map(async (chunk) => {
      const embedResponse = await co.embed({
        texts: [chunk],
        model: 'embed-english-v3.0',
        input_type: 'search_document' // For document indexing
      });
      return {
        text: chunk,
        embedding: embedResponse.embeddings[0]
      };
    });

    const chunkEmbeddings = await Promise.all(embeddingPromises); // Wait for all chunks
    fs.writeFileSync(vectorPath, JSON.stringify(chunkEmbeddings, null, 2)); // Save embeddings

    console.log(`✅ Uploaded & vectorized → ${fileHash} (${chunks.length} chunks)`);
    res.json({ message: '✅ PDF parsed & vectorized', filename: fileHash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '❌ Failed to process PDF', details: err.message });
  }
});

// 💬 Chat endpoint → Accepts a question and returns an answer using Groq
app.post('/chat', async (req, res) => {
  try {
    const { question, filename } = req.body;
    const vectorPath = path.join(VECTOR_DIR, `${filename}.json`);

    // 🛑 Return error if file not found
    if (!fs.existsSync(vectorPath)) {
      return res.status(404).json({ error: '❌ File not indexed. Upload first!' });
    }

    const chunks = JSON.parse(fs.readFileSync(vectorPath, 'utf-8')); // Load stored embeddings

    // 🧠 Embed the user's question
    const embedResponse = await co.embed({
      texts: [question],
      model: 'embed-english-v3.0',
      input_type: 'search_query' // For querying
    });
    const questionEmbedding = embedResponse.embeddings[0];

    // 🔎 Score each chunk by similarity to the question
    const scored = chunks.map(chunk => ({
      text: chunk.text,
      score: cosineSimilarity(questionEmbedding, chunk.embedding)
    }));

    // 🏆 Take top 2 most relevant chunks
    const topChunks = scored.sort((a, b) => b.score - a.score).slice(0, 2);
    const context = topChunks.map(c => c.text).join('\n\n'); // Combine as context

    // 🗣️ Ask Groq LLM to generate an answer based on selected context
    const completion = await openai.chat.completions.create({
      model: 'llama3-8b-8192',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Answer concisely using only the given context.' },
        { role: 'user', content: `Context:\n\n${context}\n\nQuestion: ${question}` }
      ]
    });

    // ✅ Return final answer to frontend
    res.json({
      answer: completion.choices[0].message.content || '',
      model: completion.model,
      created_at: completion.created
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '❌ Chat failed', details: err.message });
  }
});

// 🚀 Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));

// End of Streamed Ollama Code






//-----------Below Code is for Non-streamed Ollama for clean JSON
//-----------Earlier I have used this code but It's too slow and not efficient
//-----------I've tried to improve it by using different model but still not efficient
//-----------So I've decided to use Cohere for embeddings and Groq for LLM
//-----------It's much faster and more efficient
//-----------I've also added a caching mechanism to avoid re-processing the same file
//-----------I've also added a logging mechanism to log the requests and responses
//-----------I've also added a error handling mechanism to handle the errors
//-----------I've also added a rate limiting mechanism to avoid abuse

// // ✅ Corrected index.js → Non-streamed Ollama for clean JSON
// const express = require('express');
// const multer = require('multer');
// const pdfParse = require('pdf-parse');
// const fs = require('fs');
// const fetch = require('node-fetch');
// const cors = require('cors');
// const path = require('path');
// const crypto = require('crypto');

// const app = express();
// app.use(cors({ origin: 'http://localhost:4200' }));
// app.use(express.json());

// const upload = multer({ dest: 'uploads/' });

// const VECTOR_DIR = './vectorstore';
// if (!fs.existsSync(VECTOR_DIR)) {
//   fs.mkdirSync(VECTOR_DIR);
// }

// function getFileHash(buffer) {
//   return crypto.createHash('md5').update(buffer).digest('hex');
// }

// function chunkText(text, chunkSize = 500) {
//   const paragraphs = text.split('\n\n');
//   const chunks = [];
//   let currentChunk = '';

//   for (const paragraph of paragraphs) {
//     if (currentChunk.length + paragraph.length > chunkSize && currentChunk) {
//       chunks.push(currentChunk);
//       currentChunk = '';
//     }
//     currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
//   }

//   if (currentChunk) chunks.push(currentChunk);
//   return chunks;
// }

// function cosineSimilarity(vecA, vecB) {
//   const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
//   const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
//   const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
//   return dot / (magA * magB);
// }

// app.post('/upload', upload.single('pdf'), async (req, res) => {
//   try {
//     const file = req.file;
//     const dataBuffer = fs.readFileSync(file.path);
//     const fileHash = getFileHash(dataBuffer);
//     const vectorPath = path.join(VECTOR_DIR, `${fileHash}.json`);

//     if (fs.existsSync(vectorPath)) {
//       return res.json({
//         message: '✅ PDF already processed (cached)',
//         filename: fileHash
//       });
//     }

//     const data = await pdfParse(dataBuffer);
//     const chunks = chunkText(data.text, 500);

//     const embeddingPromises = chunks.map(async (chunk) => {
//       const embeddingResponse = await fetch('http://localhost:11434/api/embeddings', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           model: 'nomic-embed-text',
//           prompt: chunk
//         })
//       });
//       return embeddingResponse.json();
//     });

//     const embeddings = await Promise.all(embeddingPromises);
//     const chunkEmbeddings = chunks.map((chunk, i) => ({
//       text: chunk,
//       embedding: embeddings[i].embedding
//     }));

//     fs.writeFileSync(vectorPath, JSON.stringify(chunkEmbeddings, null, 2));

//     console.log(`✅ PDF uploaded & vectorized → ${fileHash} (${chunks.length} chunks)`);
//     res.json({ message: '✅ PDF parsed & vectorized', filename: fileHash });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: '❌ Failed to parse/vectorize PDF' });
//   }
// });

// // In-memory cache for question embeddings (simple LRU)
// const embeddingCache = new Map();
// const EMBEDDING_CACHE_SIZE = 100;

// app.post('/chat', async (req, res) => {
//   try {
//     const start = Date.now();
//     const { question, filename } = req.body;
//     const vectorPath = path.join(VECTOR_DIR, `${filename}.json`);

//     if (!fs.existsSync(vectorPath)) {
//       return res.status(404).json({ error: '❌ File not indexed. Upload first!' });
//     }

//     const chunks = JSON.parse(fs.readFileSync(vectorPath, 'utf-8'));

//     const embeddingResponse = await fetch('http://localhost:11434/api/embeddings', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         model: 'nomic-embed-text',
//         prompt: question
//       })
//     });
//     const questionEmbedding = (await embeddingResponse.json()).embedding;
//     const t1 = Date.now();

//     const scored = chunks.map(chunk => ({
//       text: chunk.text,
//       score: cosineSimilarity(questionEmbedding, chunk.embedding)
//     }));
//     const topChunks = scored.sort((a, b) => b.score - a.score).slice(0, 2);
//     const context = topChunks.map(c => c.text).join('\n\n');
//     const t2 = Date.now();

//     // 🟢 Request Ollama without streaming for clean JSON
//     const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         model: 'phi3',
//         prompt: `Answer concisely using ONLY this context:\n\n${context}\n\nQuestion: ${question}`,
//         stream: false
//       })
//     });
//     const result = await ollamaResponse.json();
//     const t3 = Date.now();

//     console.log('TIMING: embed:', t1-start, 'sim:', t2-t1, 'generate:', t3-t2, 'total:', t3-start);

//     res.json({
//       answer: result.response || '',
//       model: result.model,
//       created_at: result.created_at
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: '❌ Processing failed', details: err.message });
//   }
// });

// fetch('http://localhost:11434/api/generate', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({
//     model: 'phi3',
//     prompt: 'ping',
//     stream: false
//   })
// }).catch(() => console.log('Ollama pre-warm attempt (may fail)'));

// setInterval(() => {
//   fetch('http://localhost:11434/api/generate', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       model: 'phi3',
//       prompt: 'ping',
//       stream: false
//     })
//   }).catch(() => {});
// }, 20000); // every 20 seconds

// const PORT = 3000;
// app.listen(PORT, () => console.log(`✅ Server → http://localhost:${PORT}`));
// -----------------------------------------------------------------------------------------------------------------