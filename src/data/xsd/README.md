Official XML schemas used to validate every insurance invoice before it is sent to MediData.

- `generalInvoiceRequest_500.xsd` — Forum Datenaustausch, generalInvoiceRequest 5.0 (13.12.2024),
  https://www.forum-datenaustausch.ch/xml-standards/rechnung
- `xmldsig-core-schema.xsd`, `xenc-schema.xsd` — W3C XML Signature / Encryption, imported by the above.

`schemaLocation` imports were rewritten to the local file names so validation needs no network access.
