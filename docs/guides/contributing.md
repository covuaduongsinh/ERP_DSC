# Contributing Guide

**Hướng dẫn đóng góp / Contributing Guide**

Thank you for your interest in contributing to VietERP! This guide outlines the process and standards for contributing.

## Code of Conduct / Quy tắc ứng xử

VietERP follows the [Contributor Covenant](../CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

**Key principles:**

- Be respectful and inclusive
- Provide constructive feedback
- Focus on ideas, not individuals
- Report unacceptable behavior to core team

## Getting Started / Bắt đầu

### 1. Fork and Clone / Sao chép và nhân bản

```bash
# Fork repository on GitHub
# https://github.com/nclamvn/Viet-ERP/fork

# Clone your fork
git clone https://github.com/YOUR_USERNAME/Viet-ERP.git
cd Viet-ERP

# Add upstream remote
git remote add upstream https://github.com/nclamvn/Viet-ERP.git
```

### 2. Install Dependencies / Cài đặt phụ thuộc

```bash
npm install
npm run setup
docker compose up -d
```

### 3. Create Feature Branch / Tạo nhánh tính năng

```bash
# Update main branch
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch with conventional naming
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
# or
git checkout -b docs/documentation-update
```

## Branch Naming Conventions / Quy ước đặt tên nhánh

Use conventional branch names:

| Type          | Pattern      | Example                           |
| ------------- | ------------ | --------------------------------- |
| Feature       | `feature/*`  | `feature/add-payroll-calculation` |
| Bug Fix       | `fix/*`      | `fix/accounting-rounding-error`   |
| Documentation | `docs/*`     | `docs/update-api-reference`       |
| Refactor      | `refactor/*` | `refactor/auth-middleware`        |
| Performance   | `perf/*`     | `perf/optimize-database-query`    |
| Tests         | `test/*`     | `test/add-customer-crud-tests`    |
| Chore         | `chore/*`    | `chore/update-dependencies`       |

## Commit Conventions / Quy ước commit

Use Conventional Commits format for all commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type / Loại

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build, dependencies, CI/CD changes
- `ci`: CI/CD configuration changes

### Scope / Phạm vi

The scope specifies the module or component affected:

- `hrm`: Human Resource Management module
- `crm`: Customer Relationship Management module
- `accounting`: Accounting module
- `ecommerce`: E-commerce module
- `mcp`: Manufacturing Resource Planning module
- `auth`: Authentication system
- `events`: Event streaming system
- `cache`: Caching system
- `db`: Database schema
- `api`: API routes and handlers

### Examples / Ví dụ

```
feat(hrm): add employee leave management feature

- Add leave request creation and approval flow
- Implement calendar availability checking
- Send email notifications for request updates

Fixes #1234
```

```
fix(accounting): correct VAT calculation for services

The VAT calculation was incorrectly applying tax rates
to service invoices. This fix ensures proper VAS compliance
per Thông tư 200/2014/TT-BTC.

Closes #5678
```

```
docs(api): update CRM endpoint documentation

Update OpenAPI spec with latest CRM endpoints and
request/response schemas.
```

```
test(crm): add comprehensive tests for lead scoring

- Add unit tests for lead score calculation
- Add E2E tests for lead list filtering
- Achieve 85% coverage for crm/services

Coverage report:
- Lines: 85%
- Functions: 90%
- Branches: 82%
```

## Development Workflow / Quy trình phát triển

### 1. Make Changes / Thay đổi code

```bash
# Create/modify files
# Run linting
npm run lint

# Run type checking
npm run typecheck

# Run tests
npm run test

# Format code
npm run format
```

### 2. Commit Changes / Commit thay đổi

```bash
# Stage files
git add .

# Commit with conventional format
git commit -m "feat(hrm): add leave management"

# Or use interactive commit helper
npx commitizen
```

### 3. Push to Fork / Push đến fork

```bash
git push origin feature/your-feature-name
```

### 4. Create Pull Request / Tạo yêu cầu kéo

1. Go to https://github.com/nclamvn/Viet-ERP
2. Click "New Pull Request"
3. Select `base: main` and `compare: your-branch`
4. Fill PR template (see below)
5. Request reviewers
6. Submit PR

## Pull Request Template / Mẫu yêu cầu kéo

```markdown
## Description / Mô tả

Brief description of the changes / Mô tả ngắn gọn về các thay đổi

## Type / Loại

- [ ] Feature / Tính năng mới
- [ ] Bug Fix / Sửa lỗi
- [ ] Documentation / Tài liệu
- [ ] Refactoring / Tái cấu trúc
- [ ] Tests / Kiểm thử

## Related Issues / Vấn đề liên quan

Fixes #issue_number

## Changes Made / Những thay đổi được thực hiện

- Change 1
- Change 2
- Change 3

## Testing / Kiểm thử

- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed
- [ ] No test coverage regression

## Screenshots / Ảnh chụp (if applicable)

## Checklist / Danh sách kiểm tra

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Database migrations included (if needed)
- [ ] No breaking changes introduced
- [ ] Tested locally before submitting
```

## Code Review Checklist / Danh sách kiểm tra xem xét code

When reviewing PRs, check:

### Code Quality / Chất lượng code

- [ ] Code follows TypeScript strict mode
- [ ] No `any` types without justification
- [ ] Proper error handling
- [ ] No console.log in production code
- [ ] Function complexity not excessive (McCabe < 10)

### Testing / Kiểm thử

- [ ] Unit tests for new functions
- [ ] E2E tests for user-facing changes
- [ ] Tests pass locally and in CI
- [ ] Coverage ≥ 70%
- [ ] Edge cases covered

### Database / Cơ sở dữ liệu

- [ ] Prisma schema updated (if needed)
- [ ] Migration files included
- [ ] Migration tested on test database
- [ ] Backward compatibility maintained
- [ ] Indexes added for new queries

### Documentation / Tài liệu

- [ ] API changes documented
- [ ] Complex logic has comments
- [ ] README updated (if needed)
- [ ] API docs/OpenAPI spec updated
- [ ] Breaking changes noted

### Security / Bảo mật

- [ ] Input validation implemented
- [ ] No hardcoded secrets
- [ ] SQL injection prevention (using Prisma)
- [ ] XSS prevention (framework handles)
- [ ] CSRF protection maintained

### Performance / Hiệu suất

- [ ] No N+1 queries
- [ ] Efficient database queries
- [ ] Caching utilized appropriately
- [ ] No memory leaks
- [ ] Bundle size impact assessed

### Architecture / Kiến trúc

- [ ] Follows monorepo conventions
- [ ] Shared packages utilized
- [ ] Multi-tenancy respected
- [ ] Events published for domain changes
- [ ] Error handling consistent

## File Structure Conventions / Quy ước cấu trúc tệp

```
apps/YourModule/
├── app/
│   └── api/v1/          # API routes
├── src/
│   ├── lib/             # Utilities & helpers
│   ├── middleware/      # Express-like middleware
│   ├── services/        # Business logic
│   ├── handlers/        # Route handlers
│   ├── schemas/         # Zod validation schemas
│   └── types/           # TypeScript types
├── prisma/
│   └── schema.prisma    # Database schema
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   ├── e2e/             # E2E tests
│   └── fixtures/        # Test data
├── public/              # Static files
├── package.json
└── README.md
```

## Linting & Formatting / Kiểm tra & Định dạng

### Pre-commit Hooks / Hooks trước commit

Husky automatically runs linting on commit:

```bash
# Install hooks (usually automatic)
npx husky install

# Manually run pre-commit checks
npm run lint
npm run format
npm run typecheck
```

### Running Linters / Chạy linters

```bash
# Lint all code
npm run lint

# Lint specific package
npm run lint -- apps/HRM-unified

# Fix linting issues
npm run lint -- --fix

# Format with Prettier
npm run format

# Type checking
npm run typecheck
```

## Testing Standards / Tiêu chuẩn kiểm thử

### Coverage Requirements / Yêu cầu bao phủ

- Minimum 70% coverage across all modules
- Higher coverage (85%+) for critical paths:
  - Authentication
  - Payment processing
  - Tax calculations
  - Data migrations

### Test Locations / Vị trí kiểm thử

- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/`
- Test fixtures: `tests/fixtures/`

### Run Tests / Chạy kiểm thử

```bash
# All tests
npm run test

# Watch mode
npm run test -- --watch

# Specific file
npm run test -- customer.service.test.ts

# With coverage
npm run test -- --coverage

# E2E tests
npm run test:e2e
```

## Documentation Standards / Tiêu chuẩn tài liệu

### Code Comments / Bình luận code

Write comments for:

- **Why**, not **what** - what should be obvious from code
- Complex algorithms or business logic
- Non-obvious dependencies or side effects
- Workarounds for known issues

**Good comment:**

```typescript
// Per TT200, sales invoices must use account 5111
// not account 5112 which is reserved for services
const revenueAccount = "5111";
```

**Bad comment:**

```typescript
// Set revenue account
const revenueAccount = "5111";
```

### API Documentation / Tài liệu API

Document endpoints with:

- Endpoint path and method
- Request/response schemas
- Authentication requirements
- Example requests/responses
- Error codes and meanings

Example:

```typescript
/**
 * List customers with pagination
 * @endpoint GET /api/v1/customers
 * @auth Bearer token (JWT)
 * @param page - Page number (default: 1)
 * @param limit - Results per page (default: 20, max: 100)
 * @returns 200 - List of customers with pagination metadata
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (insufficient permissions)
 */
export const GET = withAuth(async (req: NextRequest) => {
  // Implementation
});
```

### README Guidelines / Hướng dẫn README

Each module should have a README with:

- Description
- Features
- API overview
- Installation for development
- Testing instructions
- Contributing guidelines

## CI/CD Integration / Tích hợp CI/CD

GitHub Actions automatically run on PRs:

1. **Lint Check** - TypeScript and ESLint
2. **Type Check** - TypeScript compilation
3. **Unit Tests** - Vitest coverage ≥70%
4. **E2E Tests** - Playwright on staging DB
5. **Build Check** - Can build successfully

PR will fail if any check doesn't pass. Fix and push again.

## Performance Considerations / Cân nhắc về hiệu suất

### Database Optimization / Tối ưu hóa cơ sở dữ liệu

- Always select only needed fields
- Use relations efficiently (avoid N+1)
- Add indexes for frequently filtered fields
- Consider pagination for large result sets

Bad:

```typescript
const users = await prisma.user.findMany();
// Get all users - could be thousands!
```

Good:

```typescript
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true },
  where: { tenantId },
  take: 20,
  skip: (page - 1) * 20,
});
```

### Caching Strategy / Chiến lược bộ nhớ đệm

Use Redis for:

- User sessions
- Frequently accessed reference data
- Expensive query results

Cache invalidation:

- On data mutation (create/update/delete)
- Time-based (TTL)
- Event-driven (via NATS)

### Bundle Size / Kích thước gói

- Avoid large dependencies
- Use tree-shaking compatible packages
- Lazy load components when possible
- Monitor with `next/bundle-analyzer`

## Getting Help / Nhận trợ giúp

- **Docs**: http://localhost:3014 (after `npm run dev`)
- **Discussions**: GitHub Discussions
- **Issues**: GitHub Issues for bugs
- **Discord**: Community chat (link TBD)
- **Email**: dev@vierp.vn for urgent issues

## Recognition / Ghi nhận

Contributors will be:

- Listed in CONTRIBUTORS.md
- Credited in release notes
- Acknowledged in documentation
- Invited to discuss features

## License / Giấy phép

By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).

## Questions? / Có câu hỏi?

Don't hesitate to ask! Open a discussion or email the team.

Thank you for contributing to VietERP! 🙏
