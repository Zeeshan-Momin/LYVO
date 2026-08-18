# Contributing to LYVO

Thank you for choosing to contribute to LYVO! Please follow these onboarding guidelines to maintain enterprise-level code quality.

## Development Workflow

1. **Fork & Branch:** Clone the repository. Always branch from `main` using descriptive naming:
   - `feature/your-feature-name`
   - `bugfix/issue-description`
2. **Setup environment:** Run `npm install` inside both `frontend` and `backend` directories. Ensure your local `.env` values are mapped appropriately.
3. **Write Tests:** Ensure backend integration test assertions are updated inside the `backend/tests/` folder.
4. **Code Quality & Lints:**
   - Execute `npm run lint` or ESLint formatters before pushing.
   - Confirm Jest and Vitest suites compile successfully:
     ```bash
     npm run test
     ```
5. **Pull Requests:** Open a pull request against `main`. Ensure CI workflows pass, code coverage metrics are high, and code changes are detailed under descriptive logs.
