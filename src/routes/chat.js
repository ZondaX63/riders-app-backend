const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { Conversation, Message } = require('../models/Chat');
const User = require('../models/User');

// Create new chat or get existing chat
router.post('/', auth, async (req, res) => {
  try {
    const { userId } = req.body;

    // Check if user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Check if chat already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, userId] }
    })
    .populate('participants', 'username fullName profilePicture')
    .populate('lastMessage');

    if (!conversation) {
      // Create new conversation
      conversation = new Conversation({
        participants: [req.user._id, userId]
      });
      await conversation.save();

      // Populate the conversation with user details
      conversation = await Conversation.findById(conversation._id)
        .populate('participants', 'username fullName profilePicture')
        .populate('lastMessage');
    }

    res.json({
      success: true,
      data: { conversation }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error creating chat'
      }
    });
  }
});

// Get all conversations for current user
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'username fullName profilePicture')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: { conversations }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error fetching conversations'
      }
    });
  }
});

// Get conversation by ID
router.get('/:chatId', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.chatId)
      .populate('participants', 'username fullName profilePicture')
      .populate('lastMessage');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CHAT_NOT_FOUND',
          message: 'Conversation not found'
        }
      });
    }

    if (!conversation.participants.some(p => p._id.equals(req.user._id))) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this conversation'
        }
      });
    }

    res.json({
      success: true,
      data: { conversation }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error fetching conversation'
      }
    });
  }
});

// Send message in conversation
router.post('/:chatId/messages', auth, async (req, res) => {
  try {
    const { content, type = 'text' } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Message content is required'
        }
      });
    }

    const conversation = await Conversation.findById(req.params.chatId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CHAT_NOT_FOUND',
          message: 'Conversation not found'
        }
      });
    }

    if (!conversation.participants.some(p => p.equals(req.user._id))) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this conversation'
        }
      });
    }

    const message = new Message({
      conversation: conversation._id,
      sender: req.user._id,
      content,
      type
    });
    await message.save();

    // Update conversation's last message
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;
    await conversation.save();

    // Populate the message with sender details before sending response
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username fullName profilePicture')
      .populate('readBy.user', 'username fullName profilePicture');

    res.status(201).json({
      success: true,
      data: { message: populatedMessage }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error sending message'
      }
    });
  }
});

// Get conversation messages
router.get('/:chatId/messages', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const conversation = await Conversation.findById(req.params.chatId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CHAT_NOT_FOUND',
          message: 'Conversation not found'
        }
      });
    }

    if (!conversation.participants.some(p => p.equals(req.user._id))) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this conversation'
        }
      });
    }

    const messages = await Message.find({ conversation: conversation._id })
      .populate('sender', 'username fullName profilePicture')
      .populate('readBy.user', 'username fullName profilePicture')
      .sort({ createdAt: 1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));

    // Add ETag for caching
    const etag = require('crypto')
      .createHash('md5')
      .update(JSON.stringify(messages))
      .digest('hex');

    res.set('ETag', etag);

    // Check if client's cache is still valid
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    // Mark messages as read if they are not already read by the current user
    const unreadMessages = messages.filter(message => 
      !message.readBy.some(read => read.user._id.equals(req.user._id))
    );

    if (unreadMessages.length > 0) {
      for (const message of unreadMessages) {
        message.readBy.push({
          user: req.user._id,
          readAt: new Date()
        });
        await message.save();
      }
    }

    res.json({
      success: true,
      data: { messages }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error fetching messages'
      }
    });
  }
});

// Delete conversation
router.delete('/:chatId', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.chatId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CHAT_NOT_FOUND',
          message: 'Conversation not found'
        }
      });
    }

    if (!conversation.participants.some(p => p.equals(req.user._id))) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this conversation'
        }
      });
    }

    await conversation.deleteOne();
    // Delete all messages in the conversation
    await Message.deleteMany({ conversation: conversation._id });

    res.json({
      success: true,
      data: {
        message: 'Chat deleted successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error deleting chat'
      }
    });
  }
});

// Mark conversation as read
router.put('/:chatId/read', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.chatId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CHAT_NOT_FOUND',
          message: 'Conversation not found'
        }
      });
    }

    if (!conversation.participants.some(p => p.equals(req.user._id))) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this conversation'
        }
      });
    }

    // Get all unread messages in the conversation
    const messages = await Message.find({
      conversation: conversation._id,
      'readBy.user': { $ne: req.user._id }
    });

    // Mark each message as read
    for (const message of messages) {
      message.readBy.push({
        user: req.user._id,
        readAt: new Date()
      });
      await message.save();
    }

    res.json({
      success: true,
      data: {
        message: 'Messages marked as read',
        count: messages.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error marking messages as read'
      }
    });
  }
});

// Mute/Unmute conversation
router.put('/:chatId/mute', auth, async (req, res) => {
  try {
    const { mute } = req.body;
    const conversation = await Conversation.findById(req.params.chatId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CHAT_NOT_FOUND',
          message: 'Conversation not found'
        }
      });
    }

    if (!conversation.participants.some(p => p.equals(req.user._id))) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this conversation'
        }
      });
    }

    // Update mute status
    conversation.muted = mute;
    await conversation.save();

    res.json({
      success: true,
      data: {
        message: mute ? 'Chat muted successfully' : 'Chat unmuted successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error updating mute status'
      }
    });
  }
});

module.exports = router; 