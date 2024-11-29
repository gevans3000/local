# Local: Multi-Model Chat Application

A sophisticated web application that enables simultaneous interactions with multiple AI models through a clean, modern interface. The application supports various AI models including OpenAI, NVIDIA, and Meta models, with real-time context sharing between chat windows.

## Project Architecture

### Core Components

1. **Server (`server.js`)**
   - Express.js-based Node.js server
   - Handles API routes and WebSocket connections
   - Manages model selection and API interactions
   - Implements robust process management and port handling

2. **Database (`database.js`)**
   - SQLite-based persistence layer
   - Stores conversation history
   - Manages context retrieval across chat windows
   - Implements efficient indexing for quick lookups

3. **Configuration (`config.js`)**
   - Centralizes all configuration settings
   - Manages environment variables
   - Handles API keys and endpoints
   - Controls logging settings

4. **Process Management (`utils/processManager.js`)**
   - Handles server lifecycle
   - Manages port conflicts
   - Implements graceful shutdown
   - Handles process signals

5. **Frontend (`index.html`)**
   - Four independent chat windows
   - Real-time message updates
   - Model selection interface
   - Context sharing capabilities

### Technical Stack

- **Runtime**: Node.js v14+
- **Framework**: Express.js
- **Database**: SQLite3
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Logging**: Winston
- **Validation**: Joi
- **Process Management**: Custom implementation
- **AI Models Integration**: OpenAI API, NVIDIA API, Meta Models

### Key Features

1. **Multi-Model Support**
   - OpenAI models (GPT-4, etc.)
   - NVIDIA models
   - Meta models (Llama)
   - Extensible model integration

2. **Context Management**
   - Cross-chat context sharing
   - Persistent conversation history
   - Token counting and management
   - System prompt customization

3. **Process Management**
   - Automatic port conflict resolution
   - Graceful shutdown handling
   - Process signal management
   - Error recovery mechanisms

4. **Security**
   - Environment-based configuration
   - API key management
   - Input validation
   - Error handling

## Project Structure

```
local/
├── server.js              # Main server file
├── database.js            # Database operations
├── config.js             # Configuration management
├── index.html            # Frontend interface
├── .env                  # Environment variables
├── utils/
│   ├── logger.js         # Logging utility
│   ├── processManager.js # Process management
│   └── validation.js     # Input validation schemas
├── public/
│   ├── css/             # Stylesheets
│   └── js/              # Frontend JavaScript
└── node_modules/         # Dependencies
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: localhost)
- `LOG_LEVEL`: Logging level
- `OPENAI_API_KEY`: OpenAI API key
- `NVIDIA_API_KEY`: NVIDIA API key
- `NVIDIA_BASE_URL`: NVIDIA API base URL
- `ALLOWED_MODELS`: Comma-separated list of enabled models

### API Configuration

1. **OpenAI Setup**
   - Requires API key in `.env`
   - Supports multiple model versions
   - Configurable temperature and parameters

2. **NVIDIA Setup**
   - Requires API key and base URL
   - Custom endpoint configuration
   - Model-specific parameters

3. **Meta Models Setup**
   - Local model configuration
   - Resource allocation settings
   - Performance tuning parameters

## Development Guidelines

1. **Code Organization**
   - Modular file structure
   - Clear separation of concerns
   - Utility-based architecture
   - Consistent error handling

2. **Error Handling**
   - Comprehensive logging
   - Graceful degradation
   - User-friendly error messages
   - Debug information preservation

3. **Process Management**
   - Signal handling (SIGINT, SIGTERM, SIGQUIT)
   - Resource cleanup
   - Port management
   - Process recovery

4. **Database Operations**
   - Prepared statements
   - Transaction management
   - Index optimization
   - Connection pooling

## Common Development Tasks

1. **Adding New Models**
   - Update `config.js` with model details
   - Implement model-specific handlers
   - Add validation schemas
   - Update frontend selection UI

2. **Modifying Chat Interface**
   - Edit `index.html` for layout changes
   - Update CSS for styling
   - Modify frontend JavaScript for behavior
   - Test cross-browser compatibility

3. **Database Schema Changes**
   - Update `database.js` schema
   - Add migration scripts
   - Update related queries
   - Test data integrity

4. **Process Management Updates**
   - Modify `processManager.js`
   - Update signal handlers
   - Test cleanup procedures
   - Verify resource management

## Troubleshooting

Common issues and solutions:

1. **Port Conflicts**
   - Check running processes
   - Use `killExistingProcess()` utility
   - Verify port availability
   - Check process permissions

2. **Database Issues**
   - Verify SQLite connection
   - Check file permissions
   - Review query performance
   - Monitor connection pool

3. **API Integration**
   - Validate API keys
   - Check rate limits
   - Monitor response times
   - Review error logs

4. **Process Management**
   - Check signal handling
   - Verify cleanup procedures
   - Monitor resource usage
   - Review process logs

## Future Enhancements

1. **Planned Features**
   - Additional model integrations
   - Enhanced context management
   - Improved UI/UX
   - Performance optimizations

2. **Technical Debt**
   - Code refactoring opportunities
   - Performance bottlenecks
   - Security improvements
   - Testing coverage

This documentation provides a comprehensive overview of the project's technical architecture and development guidelines. For specific implementation details, refer to the inline documentation in each file.
