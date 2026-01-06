const Notification = require('../models/Notification');
const { getIO } = require('../socket');

const createNotification = async ({
    user,
    fromUser,
    type,
    title,
    message,
    relatedPost,
    relatedRoute,
    relatedGroupChat
}) => {
    try {
        const notification = new Notification({
            user,
            fromUser,
            type,
            title,
            message,
            relatedPost,
            relatedRoute,
            relatedGroupChat
        });

        await notification.save();

        const populatedNotification = await Notification.findById(notification._id)
            .populate('fromUser', 'username fullName profilePicture')
            .populate('relatedPost')
            .populate('relatedRoute');

        const io = getIO();
        if (io) {
            io.to(`user:${user}`).emit('notification:received', {
                notification: populatedNotification
            });
        }

        return notification;
    } catch (error) {
        console.error('Create notification error:', error);
    }
};

module.exports = {
    createNotification
};
