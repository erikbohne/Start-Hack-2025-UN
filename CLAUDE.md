# Start-Hack-2025-UN Development Guide

## Build/Run Commands

### Frontend (Next.js)
- `cd frontend && npm run dev` - Start frontend development server
- `cd frontend && npm run build` - Build frontend for production
- `cd frontend && npm run lint` - Run ESLint
- `cd frontend && npm run lint -- --fix` - Fix linting issues automatically
- `cd frontend && npx tsc` - Run TypeScript type checking

### Backend (FastAPI)
- `cd backend && python -m uvicorn main:app --reload` - Start backend development server
- `cd backend && python -m ruff check .` - Run Ruff linter (if installed)
- `cd backend && python -m pytest` - Run all tests (if pytest is configured)
- `cd backend && python -m pytest path/to/test_file.py` - Run specific test file

## Code Style Guidelines

### Frontend
- **TypeScript**: Always use TypeScript with proper type annotations
- **Formatting**: Use NextJS/ESLint config defaults
- **Components**: Use functional components with React Hooks
- **Imports**: Group imports - React/Next, then external packages, then local modules
- **Naming**: PascalCase for components, camelCase for functions/variables
- **Error Handling**: Use try/catch for async operations

### Backend
- **Python**: Use Python 3.12+ features and typing
- **Imports**: Standard library first, then third-party, then local modules
- **Functions**: Use descriptive names and type hints
- **Error Handling**: Use specific exceptions with FastAPI's HTTPException
- **API Structure**: Follow RESTful principles with clear endpoint naming