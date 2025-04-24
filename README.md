# Judge0 IDE Project

## Overview
This project is a Node.js application that serves as a backend for the Judge0 IDE. It utilizes Express to handle HTTP requests and connects to a MySQL database for user authentication.

## Project Structure
```
judge0-ide
├── server.js          # Main application logic
├── package.json       # npm configuration and dependencies
├── Dockerfile         # Docker configuration for containerization
├── .dockerignore      # Files to ignore when building the Docker image
└── README.md          # Project documentation
```

## Setup Instructions

### Prerequisites
- Node.js (version 14 or higher)
- npm (Node package manager)
- MySQL database

### Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   cd judge0-ide
   ```

2. Install dependencies:
   ```
   npm install
   ```

### Running the Application
To start the server, run:
```
npm start
```
The server will be available at `http://localhost:3000`.

### Docker Setup
To build and run the application using Docker, follow these steps:

1. Build the Docker image:
   ```
   docker build -t judge0-ide .
   ```

2. Run the Docker container:
   ```
   docker run -p 3000:3000 judge0-ide
   ```

The application will be accessible at `http://localhost:3000`.

## API Endpoints
- **GET /api/test**: A test endpoint to verify that the server is running.
- **POST /api/moodle-login**: Endpoint for user authentication against the Moodle database.

## Notes
- Ensure to update the database configuration in `server.js` with your MySQL credentials.
- For production use, consider securing the admin credentials and using environment variables for sensitive information.