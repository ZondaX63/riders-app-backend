const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const Story = require('../models/Story');
const User = require('../models/User');
const { normalizeImagePath } = require('../utils/fileUtils');

// Create story
router.post('/', auth, upload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Media file is required'
        }
      });
    }

    const { mediaType, duration } = req.body;

    if (!['image', 'video'].includes(mediaType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid media type'
        }
      });
    }

    if (!duration || duration < 1 || duration > 24) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Duration must be between 1 and 24 hours'
        }
      });
    }

    const story = new Story({
      user: req.user._id,
      mediaUrl: normalizeImagePath(req.file.path),
      mediaType,
      duration: parseInt(duration)
    });

    await story.save();
    await story.populate('user', 'username fullName profilePicture');

    res.status(201).json({
      success: true,
      data: { story }
    });
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error creating story'
      }
    });
  }
});

// Get stories from followed users
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const user = await User.findById(req.user._id);
    const following = user.following || [];

    const stories = await Story.find({
      user: { $in: [...following, req.user._id] },
      expiresAt: { $gt: new Date() }
    })
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('user', 'username fullName profilePicture');

    const total = await Story.countDocuments({
      user: { $in: [...following, req.user._id] },
      expiresAt: { $gt: new Date() }
    });

    res.json({
      success: true,
      data: { stories, total }
    });
  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error fetching stories'
      }
    });
  }
});

// View story
router.post('/:storyId/view', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);

    if (!story) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'STORY_NOT_FOUND',
          message: 'Story not found'
        }
      });
    }

    if (story.user.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You cannot view your own story'
        }
      });
    }

    if (!story.views.includes(req.user._id)) {
      story.views.push(req.user._id);
      await story.save();
    }

    res.json({
      success: true,
      data: {
        message: 'Story viewed successfully'
      }
    });
  } catch (error) {
    console.error('View story error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'STORY_NOT_FOUND',
          message: 'Story not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error viewing story'
      }
    });
  }
});

// Get story views
router.get('/:storyId/views', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const story = await Story.findById(req.params.storyId);

    if (!story) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'STORY_NOT_FOUND',
          message: 'Story not found'
        }
      });
    }

    if (story.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only view views of your own stories'
        }
      });
    }

    const views = await User.find({ _id: { $in: story.views } })
      .select('username fullName profilePicture')
      .skip(parseInt(offset))
      .limit(parseInt(limit));

    const total = await User.countDocuments({ _id: { $in: story.views } });

    res.json({
      success: true,
      data: { views, total }
    });
  } catch (error) {
    console.error('Get story views error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'STORY_NOT_FOUND',
          message: 'Story not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error getting story views'
      }
    });
  }
});

module.exports = router; 