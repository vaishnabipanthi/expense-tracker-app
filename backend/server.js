const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const express = require('express');
const mongoose = require('mongoose');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense_tracker';

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
      return;
    }

    cb(new Error('Only PDF files are allowed.'));
  },
});

const transactionSchema = new mongoose.Schema({
  description: String,
  category: String,
  amount: Number,
  date: String,
  createdAt: { type: Date, default: Date.now },
});

const Transaction = mongoose.model('Transaction', transactionSchema);

function getCategory(description) {
  const text = description.toLowerCase();

  if (/(food|swiggy|zomato|restaurant|cafe|hotel)/.test(text)) {
    return 'Food';
  }

  if (/(travel|uber|ola|metro|fuel|petrol|diesel|bus|train|flight)/.test(text)) {
    return 'Travel';
  }

  if (/(shopping|amazon|flipkart|myntra|store|mart)/.test(text)) {
    return 'Shopping';
  }

  return 'Other';
}

function parseTransactions(text) {
  const amountPattern = /(?:rs\.?|inr|₹)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2})?)/i;
  const datePattern = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/;

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const amountMatch = line.match(amountPattern);
      if (!amountMatch) {
        return null;
      }

      const amount = Number(amountMatch[1].replace(/,/g, ''));
      if (!Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      const dateMatch = line.match(datePattern);
      const description = line
        .replace(datePattern, '')
        .replace(amountPattern, '')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        description: description || line,
        category: getCategory(description || line),
        amount,
        date: dateMatch ? dateMatch[1] : '',
      };
    })
    .filter(Boolean);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected.');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message);
  });

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Backend is running.' });
});

app.post('/api/upload', upload.single('statement'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Please upload a PDF statement.' });
  }

  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const parsedPdf = await pdfParse(fileBuffer);
    const transactions = parseTransactions(parsedPdf.text);

    if (transactions.length > 0 && mongoose.connection.readyState === 1) {
      await Transaction.insertMany(transactions);
    }

    return res.json({ success: true, transactions });
  } catch (error) {
    console.error('Upload parse error:', error);
    return res.status(500).json({ success: false, error: 'Unable to parse the uploaded PDF.' });
  }
});

app.use((error, _req, res, _next) => {
  console.error('Server error:', error);
  res.status(400).json({ success: false, error: error.message || 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
