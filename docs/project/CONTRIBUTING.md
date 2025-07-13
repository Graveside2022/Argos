# Contributing to ArgosFinal

Thank you for your interest in contributing to ArgosFinal! This document provides guidelines and instructions for contributing to the project.

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or 20.x
- npm 9.x or higher
- Git
- Docker (optional, for containerized development)

### Development Setup

1. **Clone the repository**

    ```bash
    git clone https://github.com/yourusername/ArgosFinal.git
    cd ArgosFinal
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Copy environment variables**

    ```bash
    cp .env.example .env
    ```

4. **Start development server**

    ```bash
    npm run dev
    ```

    The application will be available at http://localhost:5173

## 📝 Development Workflow

### Code Style

This project uses ESLint and Prettier for code formatting and linting. Configuration files are provided, and formatting is automatically applied via pre-commit hooks.

- **ESLint**: TypeScript and Svelte-aware linting
- **Prettier**: Consistent code formatting
- **EditorConfig**: Consistent coding styles across editors

### Pre-commit Hooks

We use Husky and lint-staged to ensure code quality. The following checks run automatically before each commit:

- ESLint (with auto-fix)
- Prettier formatting
- TypeScript type checking

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run dev:all          # Start dev server + websocket server
npm run build            # Build for production
npm run preview          # Preview production build

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Run ESLint with auto-fix
npm run format           # Format code with Prettier
npm run format:check     # Check formatting without changes
npm run check            # Run svelte-check for type checking

# Testing
npm run test             # Run all tests
npm run test:unit        # Run unit tests
npm run test:integration # Run integration tests
npm run test:e2e         # Run end-to-end tests
npm run test:coverage    # Generate coverage report
npm run test:watch       # Run tests in watch mode

# Framework Validation
npm run framework:validate-all  # Validate CSS and HTML structure
npm run framework:check-visual  # Run visual regression tests
```

## 🧪 Testing

### Test Structure

```
tests/
├── unit/           # Unit tests for individual components
├── integration/    # Integration tests for API endpoints
├── e2e/            # End-to-end tests with Playwright
├── visual/         # Visual regression tests
└── performance/    # Performance benchmarks
```

### Writing Tests

- Use Vitest for unit and integration tests
- Use Playwright for E2E tests
- Follow the existing test patterns in the codebase
- Aim for high test coverage (minimum 80%)

## 🏗️ Project Structure

```
ArgosFinal/
├── src/
│   ├── lib/            # Shared libraries and components
│   │   ├── components/ # Svelte components
│   │   ├── server/     # Server-side utilities
│   │   ├── services/   # Business logic
│   │   ├── stores/     # Svelte stores
│   │   └── types/      # TypeScript definitions
│   ├── routes/         # SvelteKit routes
│   │   ├── api/        # API endpoints
│   │   └── [pages]/    # UI pages
│   └── styles/         # Global styles
├── static/             # Static assets
├── tests/              # Test files
└── scripts/            # Build and utility scripts
```

## 📦 Making Changes

### Branch Naming

Use descriptive branch names following this pattern:

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/updates

### Commit Messages

Follow conventional commit format:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Maintenance tasks

Example:

```
feat: add real-time spectrum analysis to HackRF sweep

- Implement WebSocket connection for live data
- Add spectrum visualization component
- Update API endpoints for streaming support
```

### Pull Request Process

1. Create a feature branch from `develop`
2. Make your changes following the coding standards
3. Write/update tests as needed
4. Update documentation if applicable
5. Ensure all tests pass locally
6. Create a pull request with a clear description
7. Address review feedback
8. Merge after approval

## 🐳 Docker Development

### Using Docker Compose

```bash
# Development environment
docker-compose -f docker-compose.dev.yml up

# Production build
docker-compose up --build

# Run tests in container
docker-compose run app npm test
```

### Building Images

```bash
# Build production image
docker build -t argos-final:latest .

# Build development image
docker build --target builder -t argos-final:dev .
```

## 🔒 Security

- Never commit sensitive data or credentials
- Use environment variables for configuration
- Report security vulnerabilities privately
- Keep dependencies up to date

## 📚 Documentation

- Update README.md for user-facing changes
- Document new APIs in code comments
- Add JSDoc comments for complex functions
- Update this guide for process changes

## 🤝 Code of Conduct

Please note that this project adheres to a Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## 💬 Getting Help

- Check existing issues and discussions
- Join our community chat (if available)
- Create a detailed issue for bugs
- Ask questions in discussions

## 📄 License

By contributing to ArgosFinal, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to ArgosFinal! Your efforts help make this project better for everyone.
