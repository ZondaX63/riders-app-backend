# Social Media App

A social media application built with Flutter and Node.js.

## Features

- User authentication (login/register)
- Create, read, update, and delete posts
- Like and comment on posts
- User profiles
- Real-time updates

## Project Structure

The project is divided into two main parts:

### Frontend (Flutter)

Located in the `frontend` directory, this is a Flutter application that provides the user interface and interacts with the backend API.

### Backend (Node.js)

Located in the `backend` directory, this is a Node.js application that provides the API endpoints and handles the business logic.

## Getting Started

### Prerequisites

- Flutter SDK (latest version)
- Node.js (v14 or later)
- MongoDB

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   flutter pub get
   ```

3. Run the app:
   ```bash
   flutter run
   ```

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the backend directory with the following variables:
   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/social_media_app
   JWT_SECRET=your_jwt_secret
   ```

4. Start the server:
   ```bash
   npm start
   ```

## API Documentation

The API documentation is available at `http://localhost:3000/api-docs` when the backend server is running.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 