# Branch feat/42-invoice-export

Commits since main:
- feat: add invoice export job and endpoint
- chore: bump base image to python:3.12-slim and add a build arg in cloudbuild.yaml
- test: add export tests

Files changed: src/app/export.py (+210), src/app/routes.py (+40), tests/test_export.py (+120),
Dockerfile (+4 -2), cloudbuild.yaml (+6 -1). About 380 lines in total.

The PRD is docs/specs/invoice-export.md and the ADR is docs/adr/0003-export-job.md.
