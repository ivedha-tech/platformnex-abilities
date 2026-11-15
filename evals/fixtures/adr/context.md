# Context for the export decision

The invoice CSV export (PRD: docs/specs/invoice-export.md) may reach two million rows.
Two options are on the table:

- Stream the CSV from the API request, row by row.
- Create an export job, write the file to a bucket, and give the user a time-limited link.

The team has a request timeout of 60 seconds and no queue today. Data is Confidential and must stay in
northamerica-northeast2.
