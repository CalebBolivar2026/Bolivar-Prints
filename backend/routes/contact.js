// Contact submissions route
// Stores submissions in backend/data/contactSubmissions.json
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const submissionsFile = path.join(__dirname, '../data/contactSubmissions.json');

// Ensure file exists
if (!fs.existsSync(submissionsFile)) {
  fs.writeFileSync(submissionsFile, JSON.stringify([]), 'utf-8');
}

function readSubmissions() {
  try {
    return JSON.parse(fs.readFileSync(submissionsFile, 'utf-8'));
  } catch (err) {
    return [];
  }
}

function writeSubmissions(data) {
  fs.writeFileSync(submissionsFile, JSON.stringify(data, null, 2), 'utf-8');
}

// POST new contact submission
router.post('/', (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }
  const newEntry = {
    id: Date.now().toString(),
    name: name.trim(),
    email: email.trim(),
    message: message.trim(),
    status: 'unread',
    createdAt: new Date().toISOString(),
  };
  try {
    const data = readSubmissions();
    data.unshift(newEntry);
    writeSubmissions(data);
    res.json({ success: true, submission: newEntry });
  } catch (err) {
    console.error('Contact route error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET all submissions
router.get('/', (req, res) => {
  try {
    const data = readSubmissions();
    // Sort descending by creation date (newest first)
    data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, submissions: data });
  } catch (err) {
    console.error('Contact GET error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PUT update submission status
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const data = readSubmissions();
    const item = data.find(s => s.id === id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }
    if (status) item.status = status;
    writeSubmissions(data);
    res.json({ success: true, submission: item });
  } catch (err) {
    console.error('Contact PUT error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE submission
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  try {
    let data = readSubmissions();
    const initialLen = data.length;
    data = data.filter(s => s.id !== id);
    if (data.length === initialLen) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }
    writeSubmissions(data);
    res.json({ success: true, message: 'Submission deleted' });
  } catch (err) {
    console.error('Contact DELETE error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
