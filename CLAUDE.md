# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Dynastic Place**, an open-source r/place clone - a collaborative pixel canvas web application built with Node.js, Express, MongoDB, and real-time WebSockets. Users can place pixels on a shared canvas with rate limiting and OAuth authentication.

## Development Commands

```bash
# Install dependencies
yarn install

# Start the development server
node app.js
npm start

# Lint the codebase
npm run lint
# OR
node_modules/eslint/bin/eslint.js .

# Production deployment with PM2
pm2 start app.js --name=Place
```

## Prerequisites

- **Node.js 12.22.12 (LTS)** - Este projeto foi criado em 2019 e requer uma versão específica do Node
- MongoDB database
- Yarn package manager

### Node Version Setup

Este é um projeto antigo (~2019) que usa dependências incompatíveis com versões modernas do Node. Use NVM para gerenciar a versão:

```bash
# Instalar e usar Node 12.22.12
nvm install 12.22.12
nvm use 12.22.12

# Verificar versão correta
node --version  # deve mostrar v12.22.12

# Definir como padrão (opcional)
nvm alias default 12.22.12
```

**Por que Node 12.22.12?**
- ESLint 4.x requer Node ≤ 12
- Babel 6.x funciona melhor com Node 8-12  
- bcrypt 5.x precisa de Node ≥ 10
- Era a versão LTS estável quando o projeto foi criado

## Configuration

1. Copy `config/config.example.js` to `config/config.js`
2. Update database connection, secret key, and other settings
3. The secret must be changed from the default for security

## Architecture Overview

### Core Application Structure

- **app.js**: Main entry point that initializes all managers and servers
- **config/config.js**: Central configuration including database, OAuth, and feature flags
- **util/**: Core utility classes and managers
- **models/**: Mongoose data models (User, Pixel, etc.)
- **controllers/**: Route handlers for different features
- **routes/**: Express route definitions
- **client/js/**: Frontend JavaScript (processed via Babel/Gulp)
- **views/**: Pug templates for server-side rendering

### Key Managers & Systems

The app follows a manager-based architecture:

- **PaintingManager**: Handles canvas state, pixel placement, and image persistence
- **WebsocketServer**: Real-time communication for live pixel updates
- **HTTPServer**: Express server setup and middleware
- **ModuleManager**: Plugin system for extending functionality  
- **LeaderboardManager**: User ranking and statistics
- **UserActivityManager**: User behavior tracking
- **PixelNotificationManager**: Push notifications for pixel events
- **JavaScriptProcessor**: Babel/Gulp build pipeline for client JS

### Data Flow

1. User authentication via Passport.js with multiple OAuth providers
2. Pixel placement requests go through rate limiting and validation
3. Canvas state managed in MongoDB with real-time sync via WebSockets
4. Client JS is processed through Babel pipeline from `client/js/` to `public/js/build/`

### Security Features

- CSRF protection via csurf middleware
- Rate limiting on pixel placement
- Input validation and sanitization
- Helmet.js security headers
- JWT tokens for API authentication

## Key Files to Understand

- `app.js:25-37`: Database connection setup
- `app.js:78-86`: Image loading from database on startup
- `util/PaintingManager.js`: Core canvas logic
- `util/WebsocketServer.js`: Real-time pixel updates
- `controllers/PlaceController.js`: Pixel placement API
- `client/js/place.js`: Frontend canvas interaction