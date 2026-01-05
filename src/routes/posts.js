const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const path = require('path');

function normalizeImagePath(p) {
  if (!p) return p;
  let s = p.replace(/\\/g, '/');
  const lower = s.toLowerCase();
  const idx = lower.lastIndexOf('/uploads/');
  if (idx !== -1) {
    s = s.substring(idx + 1); // drops leading '/'
  }
  if (!s.startsWith('uploads/')) {
    s = 'uploads/' + s.replace(/^\/+/, '');
  }
  return s;
}

// Create post
router.post('/', [
  auth,
  upload.array('images', 10),
  body('description').optional().trim(),
  body('location').optional().custom((value) => {
    try {
      if (typeof value === 'string') {
        JSON.parse(value);
      }
      return true;
    } catch (error) {
      throw new Error('Invalid location format');
    }
  }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: errors.array()
        }
      });
    }
    
    // Check if at least description or images exist
    if ((!req.body.description || req.body.description.trim() === '') && (!req.files || req.files.length === 0)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Post must contain either description or images'
        }
      });
    }
    
    next();
  }
], async (req, res) => {
  try {
    const { description, location } = req.body;

    let parsedLocation;
    if (location) {
      try {
        parsedLocation = typeof location === 'string' ? JSON.parse(location) : location;
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid location format'
          }
        });
      }
    }

    const post = new Post({
      user: req.user._id,
      description,
      images: req.files ? req.files.map(file => normalizeImagePath(path.posix.join('uploads', file.filename || path.basename(file.path)))) : [],
      location: parsedLocation
    });

    await post.save();
    await post.populate('user', 'username fullName profilePicture');

    // Ensure normalized images in response
    post.images = (post.images || []).map(normalizeImagePath);

    res.status(201).json({
      success: true,
      data: { post }
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error creating post'
      }
    });
  }
});

// Get feed posts
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const posts = await Post.find({
      user: { $in: [...req.user.following, req.user._id] }
    })
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('user', 'username fullName profilePicture')
      .populate({
        path: 'comments.user',
        select: 'username fullName profilePicture'
      });

    const total = await Post.countDocuments({
      user: { $in: [...req.user.following, req.user._id] }
    });

    // Normalize image paths for response
    posts.forEach(p => {
      p.images = (p.images || []).map(normalizeImagePath);
    });

    res.json({
      success: true,
      data: { posts, total }
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error fetching posts'
      }
    });
  }
});

// Get post by id
router.get('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'username fullName profilePicture')
      .populate({
        path: 'comments.user',
        select: 'username fullName profilePicture'
      });

    if (!post) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        }
      });
    }

    // Normalize image paths for response
    post.images = (post.images || []).map(normalizeImagePath);

    res.json({
      success: true,
      data: { post }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error fetching post'
      }
    });
  }
});

// Update post
router.put('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        }
      });
    }

    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only update your own posts'
        }
      });
    }

    const { description, location } = req.body;
    const updateData = {};

    if (description) updateData.description = description;
    if (location) updateData.location = typeof location === 'string' ? JSON.parse(location) : location;

    const updatedPost = await Post.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).populate('user', 'username fullName profilePicture');

    res.json({
      success: true,
      data: { post: updatedPost }
    });
  } catch (error) {
    console.error('Update post error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        }
      });
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error updating post'
      }
    });
  }
});

// Delete post
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        }
      });
    }

    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own posts'
        }
      });
    }

    await post.deleteOne();

    res.json({
      success: true,
      data: {
        message: 'Post deleted successfully'
      }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error deleting post'
      }
    });
  }
});

// Like post
router.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        }
      });
    }

    if (post.likes.includes(req.user._id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_LIKED',
          message: 'You have already liked this post'
        }
      });
    }

    post.likes.push(req.user._id);
    await post.save();

    // Create notification for post like
    if (post.user.toString() !== req.user._id.toString()) {
      await Notification.create({
        type: 'like',
        user: post.user,
        fromUser: req.user._id,
        content: 'Your post was liked',
        relatedPost: post._id
      });
    }

    res.json({
      success: true,
      data: { message: 'Post liked successfully' }
    });
  } catch (error) {
    console.error('Like post error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        }
      });
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error liking post'
      }
    });
  }
});

// Unlike post
router.delete('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        }
      });
    }

    post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
    await post.save();

    res.json({
      success: true,
      data: {
        message: 'Post unliked successfully'
      }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error unliking post'
      }
    });
  }
});

// Get comments for a post
router.get('/:id/comments', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate({ path: 'comments.user', select: 'username fullName profilePicture' });

    if (!post) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        }
      });
    }

    // Ensure comments array exists
    const comments = (post.comments || []).map(c => {
      // If mongoose subdocument, convert to plain object for consistent JSON
      const obj = typeof c.toObject === 'function' ? c.toObject() : c;
      return obj;
    });

    res.json({
      success: true,
      data: { comments }
    });
  } catch (error) {
    console.error('Get comments error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error fetching comments'
      }
    });
  }
});

// Add comment
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Comment content is required'
        }
      });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        }
      });
    }

    const comment = {
      user: req.user._id,
      content,
      createdAt: new Date()
    };

    post.comments.push(comment);
    await post.save();

    // Create notification for comment
    if (post.user.toString() !== req.user._id.toString()) {
      await Notification.create({
        type: 'comment',
        user: post.user,
        fromUser: req.user._id,
        content: 'New comment on your post',
        relatedPost: post._id
      });
    }

    await post.populate('comments.user', 'username fullName profilePicture');
    const newComment = post.comments[post.comments.length - 1];

    res.status(201).json({
      success: true,
      data: { comment: newComment }
    });
  } catch (error) {
    console.error('Add comment error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        }
      });
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error adding comment'
      }
    });
  }
});

// Delete comment
router.delete('/:id/comments/:commentId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        }
      });
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COMMENT_NOT_FOUND',
          message: 'Comment not found'
        }
      });
    }

    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own comments'
        }
      });
    }

    comment.deleteOne();
    await post.save();

    res.json({
      success: true,
      data: {
        message: 'Comment deleted successfully'
      }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error deleting comment'
      }
    });
  }
});

// Get posts for a specific user
router.get('/users/:userId/posts', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const posts = await Post.find({ user: req.params.userId })
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('user', 'username fullName profilePicture')
      .populate({
        path: 'comments.user',
        select: 'username fullName profilePicture'
      });
    const total = await Post.countDocuments({ user: req.params.userId });
    res.json({
      success: true,
      data: { posts, total }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error fetching user posts'
      }
    });
  }
});

module.exports = router;