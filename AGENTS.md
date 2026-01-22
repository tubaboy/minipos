# AGENTS.md

This file contains guidelines for agentic coding agents working on this repository.

## Build & Test Commands

**Development:**

```bash
npm run dev              # Start development server (Next.js)
npm run build           # Build for production
npm start              # Start production server
```

**Code Quality:**

```bash
npm run lint            # Run ESLint
npm run lint:fix        # Fix linting issues automatically
npm run typecheck       # Run TypeScript type checking
```

**Testing:**

```bash
npm test               # Run all tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report
npm run test:single    # Run single test (add file path: npm run test:single -- path/to/test.test.ts)
```

## Code Style Guidelines

### File Structure

- **Components:** `src/components/` - Reusable UI components
- **Pages:** `src/app/` - Next.js app router pages
- **Types:** `src/types/` - TypeScript type definitions
- **Utils:** `src/utils/` - Pure utility functions
- **Tests:** `src/**/__tests__/` or colocated with source as `*.test.ts`/`*.test.tsx`

### Import Order

1. React/Next.js imports
2. Third-party libraries
3. Internal imports (grouped: components, types, utils, hooks)
4. Relative imports
5. CSS imports (if any)

```typescript
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { Product } from '@/types';
import { formatCurrency } from '@/utils/currency';
import './styles.css';
```

### TypeScript & Types

- Use `interface` for object shapes, `type` for unions/aliases
- Export types from `src/types/index.ts` for reuse across modules
- Use `unknown` instead of `any` when type is truly unknown
- Avoid `any` - use `unknown` or generic constraints instead
- Enable `strict` mode in tsconfig (already enabled)

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
}

function processData<T>(data: unknown): T {
  if (typeof data === 'object' && data !== null) {
    return data as T;
  }
  throw new Error('Invalid data');
}
```

### Naming Conventions

- **Components:** PascalCase (`ProductCard`, `OrderSummary`)
- **Functions:** camelCase (`calculateTotal`, `formatPrice`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_ITEMS`, `API_URL`)
- **Types/Interfaces:** PascalCase, descriptive (`UserData`, `ApiResponse`)
- **Files:** kebab-case for components, camelCase for utilities (`product-card.tsx`, `currency.ts`)

### Component Patterns

- Functional components with hooks (no class components)
- Use TypeScript for all props: `interface Props { ... }`
- Destructure props at function signature
- Use `React.FC` or explicit return type only when necessary
- Prefer simple composition over complex props drilling

```typescript
interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ children, onClick, variant = 'primary' }: ButtonProps) {
  return <button className={`btn btn-${variant}`} onClick={onClick}>{children}</button>;
}
```

### Error Handling

- Use try-catch for async operations with proper error types
- Return early for guard clauses
- Log errors appropriately (don't expose sensitive data)
- Provide user-friendly error messages where applicable
- Use error boundaries for React components

```typescript
async function fetchProduct(id: string): Promise<Product> {
  try {
    const response = await fetch(`/api/products/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch product: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching product:', error);
    throw error; // Re-throw for caller handling
  }
}

// Guard clause pattern
function processUser(user?: User): string {
  if (!user) return 'Guest';
  if (user.isAdmin) return 'Admin';
  return user.name;
}
```

### Formatting (Prettier)

- 2 space indentation
- Single quotes
- Semicolons required
- 100 char line width
- Trailing commas in objects/arrays
- Arrow function parens: avoid when single param

### Linting (ESLint)

- Run `npm run lint:fix` before committing
- Fix all `no-unused-vars` warnings
- Use explicit returns (no implicit returns with side effects)
- Prefer `const` over `let`, only use `let` when reassigning

### Testing Guidelines

- Test pure functions with edge cases (empty, null, invalid inputs)
- Test components with user interactions and state changes
- Use `describe` blocks for logical grouping
- Write descriptive test names: "should X when Y"
- Arrange-Act-Assert pattern for clarity
- Mock external dependencies (API calls, time, etc.)
- Aim for >80% coverage on business logic

```typescript
describe('calculateTotal', () => {
  it('should return 0 for empty cart', () => {
    expect(calculateCartTotal([])).toBe(0);
  });

  it('should sum item prices multiplied by quantities', () => {
    expect(
      calculateCartTotal([
        { price: 10, quantity: 2 },
        { price: 5, quantity: 1 },
      ])
    ).toBe(25);
  });
});
```

### Performance Best Practices

- Use `React.memo` for expensive pure components
- Use `useMemo` for expensive calculations
- Use `useCallback` for callbacks passed to child components
- Avoid unnecessary re-renders with proper dependency arrays
- Optimize images with `next/image`

### Security

- Never commit secrets (use environment variables)
- Validate all user inputs
- Sanitize data before rendering (Next.js handles XSS by default)
- Use HTTPS for all API calls
- Implement proper authentication/authorization

### Commit Workflow

1. Run typecheck: `npm run typecheck`
2. Run lint: `npm run lint:fix`
3. Run tests: `npm test`
4. Build: `npm run build` (for production changes)
5. Only commit if all checks pass

### Path Aliases

- Use `@/` prefix for absolute imports from `src/`
- Example: `import { Button } from '@/components/Button';`
- Example: `import { Product } from '@/types';`

### Next.js Specifics

- Use App Router (`src/app/`) for new pages
- Use Server Components by default, Client Components when needed (`'use client'`)
- API routes in `src/app/api/` directory
- Static assets in `public/` directory
