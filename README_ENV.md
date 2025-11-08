Quick setup for running the backend (Windows PowerShell)

1) Create a `.env` file in `backend/` (you can copy the example):

   copy .env.example .env

2) Edit `.env` and set `MONGODB_URI` to your MongoDB connection string.

3) Start the server from the `backend` folder:

   # Install dependencies (only once)
   npm install

   # Start the server
   npm start

Or set the env var inline for a single run in PowerShell:

   $env:MONGODB_URI = 'mongodb://username:password@localhost:27017/riders_db'; npm start

If MONGODB_URI is missing you'll see a clear error telling you to set it.

Local MongoDB (default) example
--------------------------------

If you're using a default local MongoDB server (no authentication) the `MONGODB_URI` can be set like this:

   $env:MONGODB_URI = 'mongodb://localhost:27017/riders_db'; npm start

Or copy the example and use the `.env` file:

   copy .env.example .env
   # edit .env and keep MONGODB_URI=mongodb://localhost:27017/riders_db
   npm start

