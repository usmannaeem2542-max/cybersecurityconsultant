const express = require('express');
const router = express.Router();
const assistantService = require('../services/assistantService');

/**
 * POST /api/chat
 * Accepts { message: string, history: Array<{role, content}> }
 * Validates message length (<= 500 chars)
 * Sends conversation to assistantService
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Message is required and must be text.'
      });
    }

    const trimmed = message.trim();
    if (trimmed.length === 0) {
      return res.status(400).json({
        error: 'Message cannot be empty.'
      });
    }

    if (trimmed.length > 500) {
      return res.status(400).json({
        error: 'Message exceeds the 500 character limit.'
      });
    }

    const reply = await assistantService.sendMessage({
      message: trimmed,
      history: Array.isArray(history) ? history : []
    });

    return res.json({
      success: true,
      reply
    });
  } catch (err) {
    console.error('[API Chat Error]:', err.message);
    return res.status(500).json({
      error: 'An error occurred while generating a response. Please try again or book a discovery call.'
    });
  }
});

module.exports = router;
