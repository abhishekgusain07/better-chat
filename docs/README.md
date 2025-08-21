# BestChatApp Documentation

## 📋 Overview

BestChatApp is a world-class chat application built with modern web technologies, featuring multi-model LLM integration, intelligent context management, and sophisticated tool calling capabilities. The architecture is inspired by Cline's proven patterns for scalable AI applications.

## 🗂️ Documentation Structure

### 🏗️ [Architecture](./architecture/README.md)
Detailed technical architecture documentation including:
- [Database Schema](./architecture/database-schema.md) - Complete database design and schema documentation
- [Chat System](./architecture/chat-system.md) - Chat system architecture and flow
- [Current State](./architecture/current-state.md) - Current implementation status

### 🔌 [API Documentation](./api/)
API reference and integration guides:
- REST API endpoints
- WebSocket event specifications  
- Authentication and authorization

### 📚 [Guides](./guides/)
User and developer guides:
- Getting started
- Configuration guides
- Best practices
- Troubleshooting

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Zustand
- **Backend**: Node.js + Express + TypeScript + tRPC
- **Database**: PostgreSQL + Drizzle ORM
- **Real-time**: WebSocket/Socket.io
- **Authentication**: Next-Auth/Auth.js
- **Payments**: Stripe + Polar

## 🚀 Quick Start

1. **Prerequisites**: Node.js 18+, PostgreSQL, Redis
2. **Installation**: `npm install`
3. **Database Setup**: Configure `.env` with database credentials
4. **Development**: `npm run dev`

## 📖 Implementation Phases

### ✅ Foundation (Sprint 00)
- [x] Database schema extensions
- [x] Chat functionality tables
- [x] Provider configuration system
- [x] Documentation structure

### 🔄 In Progress
- [ ] tRPC API routers (Sprint 01)
- [ ] Provider system integration (Sprint 02)
- [ ] Chat UI components (Sprint 03)

### 📅 Planned
- [ ] Tool calling framework
- [ ] Context management engine
- [ ] Advanced features
- [ ] Production deployment

## 🤝 Contributing

Please refer to our [contributing guidelines](../CONTRIBUTING.md) and [code of conduct](../CODE_OF_CONDUCT.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.