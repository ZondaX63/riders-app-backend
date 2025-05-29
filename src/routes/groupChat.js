const express = require('express');
const router = express.Router();
const GroupChat = require('../models/GroupChat');
const auth = require('../middleware/auth');
const mapsService = require('../services/mapsService');

// Create a new group chat
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;
    const groupChat = new GroupChat({
      name,
      description,
      isPrivate,
      creator: req.user._id,
      members: [{ user: req.user._id, role: 'admin' }]
    });

    await groupChat.save();
    res.status(201).json({
      success: true,
      data: groupChat
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message
      }
    });
  }
});

// Get all group chats (public ones or ones user is member of)
router.get('/', auth, async (req, res) => {
  try {
    const groupChats = await GroupChat.find({
      $or: [
        { isPrivate: false },
        { 'members.user': req.user._id }
      ]
    }).populate('creator', 'username fullName')
      .populate('members.user', 'username fullName');

    res.json({
      success: true,
      data: groupChats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message
      }
    });
  }
});

// Get a specific group chat
router.get('/:id', auth, async (req, res) => {
  try {
    const groupChat = await GroupChat.findOne({
      _id: req.params.id,
      $or: [
        { isPrivate: false },
        { 'members.user': req.user._id }
      ]
    }).populate('creator', 'username fullName')
      .populate('members.user', 'username fullName')
      .populate('messages.sender', 'username fullName');

    if (!groupChat) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Group chat not found'
        }
      });
    }

    res.json({
      success: true,
      data: groupChat
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message
      }
    });
  }
});

// Add a member to the group chat
router.post('/:id/members', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    const groupChat = await GroupChat.findById(req.params.id);

    if (!groupChat) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Group chat not found'
        }
      });
    }

    // Check if user is admin
    const isAdmin = groupChat.members.some(
      member => member.user.toString() === req.user._id.toString() && member.role === 'admin'
    );

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can add members'
        }
      });
    }

    // Check if user is already a member
    const isMember = groupChat.members.some(
      member => member.user.toString() === userId
    );

    if (isMember) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'User is already a member'
        }
      });
    }

    groupChat.members.push({ user: userId });
    await groupChat.save();

    res.json({
      success: true,
      data: groupChat
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message
      }
    });
  }
});

// Send a message to the group chat
router.post('/:id/messages', auth, async (req, res) => {
  try {
    const { content, type = 'text', location } = req.body;
    const groupChat = await GroupChat.findById(req.params.id);

    if (!groupChat) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Group chat not found'
        }
      });
    }

    // Check if user is a member
    const isMember = groupChat.members.some(
      member => member.user.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not a member of this group'
        }
      });
    }

    // If it's a location message, get the address
    let locationData = null;
    if (type === 'location' && location) {
      const address = await mapsService.reverseGeocode(location.lat, location.lng);
      locationData = {
        ...location,
        name: address
      };
    }

    groupChat.messages.push({
      sender: req.user._id,
      content,
      type,
      location: locationData
    });

    await groupChat.save();

    // Emit socket event for real-time updates
    req.app.get('io').to(req.params.id).emit('newMessage', {
      groupId: req.params.id,
      message: groupChat.messages[groupChat.messages.length - 1]
    });

    res.json({
      success: true,
      data: groupChat.messages[groupChat.messages.length - 1]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message
      }
    });
  }
});

// Get messages from a group chat
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const { limit = 50, before } = req.query;
    const groupChat = await GroupChat.findById(req.params.id);

    if (!groupChat) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Group chat not found'
        }
      });
    }

    // Check if user is a member
    const isMember = groupChat.members.some(
      member => member.user.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not a member of this group'
        }
      });
    }

    let query = { _id: req.params.id };
    if (before) {
      query['messages.createdAt'] = { $lt: new Date(before) };
    }

    const messages = await GroupChat.aggregate([
      { $match: query },
      { $unwind: '$messages' },
      { $sort: { 'messages.createdAt': -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: 'messages.sender',
          foreignField: '_id',
          as: 'sender'
        }
      },
      {
        $project: {
          _id: '$messages._id',
          content: '$messages.content',
          type: '$messages.type',
          location: '$messages.location',
          createdAt: '$messages.createdAt',
          sender: { $arrayElemAt: ['$sender', 0] }
        }
      }
    ]);

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message
      }
    });
  }
});

module.exports = router; 