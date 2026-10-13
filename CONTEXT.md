```markdown
# CONTEXT.md

This document provides a high-level overview of the `Clean_Harbours_Demo` project.

## What this project does

This project is a demonstration application, specifically a proof-of-concept for visualizing and interacting with environmental data relevant to Clean Harbours operations. Its primary purpose is to showcase specific functionalities, integrations, and workflows related to environmental monitoring, waste management tracking, or resource logistics data. It serves as a foundation for demonstrating a particular feature set or technical approach rather than a full-scale production application.

## Tech stack and architecture

The project employs a modern web application stack designed for clear illustration of concepts and rapid development.

*   **Architecture:** A standard client-server architecture, consisting of a Single Page Application (SPA) frontend consuming a RESTful API backend.
*   **Frontend:** Built with **React** (including TypeScript) and standard web technologies (HTML/CSS).
*   **Backend:** A server-side API developed using **Node.js** with the **Express.js** framework.
*   **Database:** **PostgreSQL** is used for data storage, suitable for structured environmental data.
*   **Containerization:** **Docker** is utilized for simplified local setup, development, and consistent deployment environments.

## Key directories and their purpose

The project adheres to a standard web application structure:

*   `client/`: Contains the React frontend application code (components, services, views).
*   `server/`: Houses the Node.js/Express backend API code (routes, controllers, models, services).
*   `config/`: Stores configuration files for different environments (e.g., development, production, test).
*   `db/`: Contains database-related files, such as schema definitions, migration scripts, and seed data.
*   `tests/`: Houses unit and integration tests for both client and server components.
*   `docs/`: For additional project documentation, diagrams, or usage guides.
*   `scripts/`: Utility scripts for development tasks, building, or deployment.
*   `public/`: Static assets for the frontend application (e.g., images, manifest files).
*   `build/` or `dist/`: The output directory for compiled or bundled application files ready for deployment.

## Important conventions or patterns

The project follows common software engineering best practices:

*   **Code Style & Linting:** Enforced using ESLint and Prettier to maintain consistent code quality and readability across both client and server codebases.
*   **API Design:** Backend APIs are designed following RESTful principles for clear and intuitive interactions.
*   **Configuration Management:** Application settings and sensitive data are externalized using environment variables (`.env` files) to facilitate easy environment switching and secure credential handling.
*   **Testing:** Comprehensive unit and integration tests are implemented using Jest (for React) and Mocha/Chai (for Node.js) to ensure core functionalities are working as expected.
*   **Dependency Management:** Dependencies are managed through `npm` (Node Package Manager) with clear `package.json` files for both client and server.
*   **Git Workflow:** A standard Git branching model (e.g., feature branches merging into `main` after pull request reviews) is used for collaborative development and version control.
```