# Invoice export design (draft)

- `GET /tenants/{tenant}/exports/{id}` returns a time-limited signed link to a file in a bucket.
- `POST /tenants/{tenant}/exports` starts an export job for the caller's tenant.
- A worker reads invoices for the tenant, writes a CSV to the bucket, and records the result.
- After the file is written, a model summarises the customer-entered "notes" field of each invoice so the
  CSV can include a one-line summary column. The notes are free text typed by tenant users.
- Data class: Confidential (customer legal name, billing address, totals). Region: northamerica-northeast2.
