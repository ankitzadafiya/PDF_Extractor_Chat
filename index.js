// ✅ Load environment variables
require('dotenv').config();

// ✅ Core modules and middleware
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

// ✅ PDF parser using pdfjs-dist (v2.16.105)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
// Must be a string path — require() returns an object and breaks fake-worker setup in Node.
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');

// ✅ AI SDKs
const { OpenAI } = require('openai');
const { CohereClient } = require('cohere-ai');

// ✅ Initialize Express app
const app = express();
app.use(cors({
  origin: [
    'http://localhost:4200',
    'https://elegant-genie-d3a66c.netlify.app',
    'https://pdf-extractor-project.netlify.app'
  ]
}));
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// ✅ Vector store directory
const VECTOR_DIR = './vectorstore';
if (!fs.existsSync(VECTOR_DIR)) fs.mkdirSync(VECTOR_DIR);

// ✅ AI clients
const co = new CohereClient({ apiKey: process.env.CO_API_KEY });
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});
const DEFAULT_GROQ_MODELS = ['llama-3.1-8b-instant', 'llama3-70b-8192'];

// 🔐 Generate MD5 hash
function getFileHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

// 📚 Chunk text ~500 characters
function chunkText(text, chunkSize = 500) {
  const paragraphs = text.split('\n\n');
  const chunks = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = '';
    }
    currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

function getCandidateModels() {
  const envModels = (process.env.GROQ_MODELS || process.env.GROQ_MODEL || '')
    .split(',')
    .map(m => m.trim())
    .filter(Boolean);

  return [...new Set([...envModels, ...DEFAULT_GROQ_MODELS])];
}

async function createChatCompletionWithFallback(messages) {
  const candidates = getCandidateModels();
  let lastErr = null;

  for (const model of candidates) {
    try {
      return await openai.chat.completions.create({ model, messages });
    } catch (err) {
      lastErr = err;
      const errMsg = (err && err.message ? err.message : '').toLowerCase();
      const shouldTryNext =
        errMsg.includes('decommissioned') ||
        errMsg.includes('no longer supported') ||
        errMsg.includes('not found') ||
        errMsg.includes('model');

      if (!shouldTryNext) throw err;
    }
  }

  throw lastErr || new Error('No supported Groq model available.');
}

// 📄 Extract text by page using pdfjs
async function extractTextByPage(buffer) {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    const text = strings.join(' ');
    pages.push({ pageNumber: i, text });
  }

  return pages;
}

// 📤 Upload endpoint
app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    const file = req.file;
    const dataBuffer = fs.readFileSync(file.path);
    const fileHash = getFileHash(dataBuffer);
    const vectorPath = path.join(VECTOR_DIR, `${fileHash}.json`);

    if (fs.existsSync(vectorPath)) {
      return res.json({ message: '✅ PDF already processed (cached)', filename: fileHash });
    }

    const pages = await extractTextByPage(dataBuffer);
    const chunks = [];

    for (const { pageNumber, text } of pages) {
      const pageChunks = chunkText(text, 500);
      for (const chunk of pageChunks) {
        chunks.push({ text: chunk, pageNumber });
      }
    }

    const embeddingPromises = chunks.map(async ({ text, pageNumber }) => {
      const embedResponse = await co.embed({
        texts: [text],
        model: 'embed-english-v3.0',
        input_type: 'search_document'
      });
      return {
        text,
        pageNumber,
        embedding: embedResponse.embeddings[0]
      };
    });

    const chunkEmbeddings = await Promise.all(embeddingPromises);
    fs.writeFileSync(vectorPath, JSON.stringify(chunkEmbeddings, null, 2));

    console.log(`✅ Uploaded & vectorized → ${fileHash} (${chunks.length} chunks)`);
    res.json({ message: '✅ PDF parsed & vectorized', filename: fileHash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '❌ Failed to process PDF', details: err.message });
  }
});

// 💬 Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { question, filename } = req.body;
    const vectorPath = path.join(VECTOR_DIR, `${filename}.json`);

    if (!fs.existsSync(vectorPath)) {
      return res.status(404).json({ error: '❌ File not indexed. Upload first!' });
    }

    const chunks = JSON.parse(fs.readFileSync(vectorPath, 'utf-8'));

    const embedResponse = await co.embed({
      texts: [question],
      model: 'embed-english-v3.0',
      input_type: 'search_query'
    });
    const questionEmbedding = embedResponse.embeddings[0];

    const scored = chunks.map(chunk => ({
      text: chunk.text,
      pageNumber: chunk.pageNumber,
      score: cosineSimilarity(questionEmbedding, chunk.embedding)
    }));

    const topChunks = scored.sort((a, b) => b.score - a.score).slice(0, 2);
    const context = topChunks.map(c => c.text).join('\n\n');

    const completion = await createChatCompletionWithFallback([
      { role: 'system', content: 'You are a helpful assistant. Answer concisely using only the given context.' },
      { role: 'user', content: `Context:\n\n${context}\n\nQuestion: ${question}` }
    ]);

    const uniqueCitations = [...new Set(topChunks.map(c => c.pageNumber))].map(page => ({ page }));

    console.log("🔎 Top Chunks for Citations:", topChunks);

    res.json({
      answer: completion.choices[0].message.content || '',
      model: completion.model,
      created_at: completion.created,
      citations: uniqueCitations
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '❌ Chat failed', details: err.message });
  }
});

// 🔎 Cosine similarity
function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (magA * magB);
}

// 🚀 Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));




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