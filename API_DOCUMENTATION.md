# Motorcycle Social Media API Documentation

## Base URL
```
https://api.motorcycle-social.com/v1
```

## Authentication
All endpoints (except login and register) require JWT authentication in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Authentication

#### Register User
- **POST** `/auth/register`
- **Description**: Register a new user
- **Request Body**:
```json
{
    "username": "string",
    "email": "string",
    "password": "string",
    "fullName": "string",
    "profilePicture": "string (URL)",
    "bio": "string",
    "motorcycleInfo": {
        "brand": "string",
        "model": "string",
        "year": "number"
    }
}
```
- **Response**:
```json
{
    "success": true,
    "data": {
        "user": {
            "id": "string",
            "username": "string",
            "email": "string",
            "fullName": "string"
        },
        "token": "string"
    }
}
```

#### Login
- **POST** `/auth/login`
- **Description**: Authenticate user and get JWT token
- **Request Body**:
```json
{
    "email": "string",
    "password": "string"
}
```
- **Response**:
```json
{
    "success": true,
    "data": {
        "token": "string",
        "user": {
            "id": "string",
            "username": "string",
            "email": "string",
            "fullName": "string"
        }
    }
}
```

#### Password Reset
- **POST** `/auth/reset-password`
- **Description**: Request password reset
- **Request Body**:
```json
{
    "email": "string"
}
```

- **POST** `/auth/confirm-reset`
- **Description**: Confirm password reset with token
- **Request Body**:
```json
{
    "token": "string",
    "newPassword": "string"
}
```

### User Management

#### Get User Profile
- **GET** `/users/:userId`
- **Description**: Get user profile information
- **Response**:
```json
{
    "success": true,
    "data": {
        "user": {
            "id": "string",
            "username": "string",
            "fullName": "string",
            "profilePicture": "string",
            "bio": "string",
            "motorcycleInfo": {
                "brand": "string",
                "model": "string",
                "year": "number"
            },
            "followersCount": "number",
            "followingCount": "number"
        }
    }
}
```

#### Update Profile
- **PUT** `/users/:userId`
- **Description**: Update user profile information
- **Request Body**:
```json
{
    "fullName": "string",
    "bio": "string",
    "motorcycleInfo": {
        "brand": "string",
        "model": "string",
        "year": "number"
    }
}
```

#### Upload Profile Picture
- **POST** `/users/:userId/profile-picture`
- **Description**: Upload new profile picture
- **Content-Type**: multipart/form-data
- **Request Body**:
```
profilePicture: file
```

#### Search Users
- **GET** `/users/search`
- **Description**: Search for users
- **Query Parameters**:
  - `q`: search query
  - `limit`: number of results (default: 20)
  - `offset`: pagination offset
- **Response**:
```json
{
    "success": true,
    "data": {
        "users": [
            {
                "id": "string",
                "username": "string",
                "fullName": "string",
                "profilePicture": "string"
            }
        ],
        "total": "number"
    }
}
```

#### Follow/Unfollow User
- **POST** `/users/:userId/follow`
- **Description**: Follow a user
- **DELETE** `/users/:userId/follow`
- **Description**: Unfollow a user

#### Get Followers/Following
- **GET** `/users/:userId/followers`
- **GET** `/users/:userId/following`
- **Query Parameters**:
  - `limit`: number of results (default: 20)
  - `offset`: pagination offset

### Posts

#### Create Post
- **POST** `/posts`
- **Description**: Create a new post
- **Request Body**:
```json
{
    "description": "string",
    "images": ["string (URL)"],
    "location": {
        "latitude": "number",
        "longitude": "number",
        "name": "string"
    }
}
```

#### Get Posts
- **GET** `/posts`
- **Description**: Get feed posts
- **Query Parameters**:
  - `limit`: number of results (default: 20)
  - `offset`: pagination offset

#### Get User Posts
- **GET** `/users/:userId/posts`
- **Description**: Get posts by specific user

#### Like/Unlike Post
- **POST** `/posts/:postId/like`
- **DELETE** `/posts/:postId/like`

#### Comment on Post
- **POST** `/posts/:postId/comments`
- **Request Body**:
```json
{
    "content": "string"
}
```

#### Get Post Comments
- **GET** `/posts/:postId/comments`
- **Query Parameters**:
  - `limit`: number of results (default: 20)
  - `offset`: pagination offset

#### Delete Post
- **DELETE** `/posts/:postId`

### Stories

#### Create Story
- **POST** `/stories`
- **Description**: Create a new story
- **Request Body**:
```json
{
    "mediaUrl": "string",
    "mediaType": "image|video",
    "duration": "number (seconds)"
}
```

#### Get Stories
- **GET** `/stories`
- **Description**: Get stories from followed users

#### Get Story Views
- **GET** `/stories/:storyId/views`
- **Description**: Get users who viewed the story

### Notifications

#### Get Notifications
- **GET** `/notifications`
- **Description**: Get user notifications
- **Query Parameters**:
  - `limit`: number of results (default: 20)
  - `offset`: pagination offset
- **Response**:
```json
{
    "success": true,
    "data": {
        "notifications": [
            {
                "id": "string",
                "type": "follow|like|comment|route_share",
                "fromUser": {
                    "id": "string",
                    "username": "string",
                    "profilePicture": "string"
                },
                "content": "string",
                "createdAt": "string (ISO date)",
                "read": "boolean"
            }
        ]
    }
}
```

#### Mark Notification as Read
- **PUT** `/notifications/:notificationId/read`

### Routes

#### Create Route
- **POST** `/routes`
- **Description**: Create a new route
- **Request Body**:
```json
{
    "name": "string",
    "description": "string",
    "waypoints": [
        {
            "latitude": "number",
            "longitude": "number",
            "name": "string"
        }
    ],
    "isPublic": "boolean"
}
```

#### Get Routes
- **GET** `/routes`
- **Description**: Get public routes
- **Query Parameters**:
  - `limit`: number of results (default: 20)
  - `offset`: pagination offset

#### Get User Routes
- **GET** `/users/:userId/routes`

#### Share Route
- **POST** `/routes/:routeId/share`
- **Request Body**:
```json
{
    "userId": "string"
}
```

#### Get Route Details
- **GET** `/routes/:routeId`

### Chat (Optional)

#### Get Conversations
- **GET** `/chat/conversations`
- **Description**: Get user conversations

#### Get Messages
- **GET** `/chat/conversations/:conversationId/messages`
- **Query Parameters**:
  - `limit`: number of results (default: 50)
  - `before`: message ID to get messages before

#### Send Message
- **POST** `/chat/conversations/:conversationId/messages`
- **Request Body**:
```json
{
    "content": "string",
    "type": "text|image|video"
}
```

## Error Responses

All error responses follow this format:
```json
{
    "success": false,
    "error": {
        "code": "string",
        "message": "string"
    }
}
```

Common error codes:
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error 