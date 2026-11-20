# Import templates (fictional data only)

| File | Layout |
|---|---|
| `sample-import.csv` | Structured: `VRM`, `Date`, `Client Code` — one activation per row. |
| `sample-single-column.csv` | One column of client codes; you choose the VRM and activation date on the import screen. |

Rules:
- **Client Code** must be text. In Excel, format the column as *Text* before typing so leading zeros survive. Codes stored as
  numbers are flagged; codes damaged into scientific notation (e.g. `1.23E+15`) are always rejected.
- **Date**: Excel date cells, `YYYY-MM-DD`, or `DD/MM/YYYY`. When a file only contains dates such as `03/04/2026` (could be
  3 April or 4 March) the rows are flagged and you choose the format; nothing is guessed. Future dates are rejected.
- **VRM** must be a roster name or a configured alias (e.g. `pavan lekhraj soni` → Pavan Soni). Unknown names are never created
  automatically; an administrator can approve a genuinely new VRM during preview.
- Recognised header spellings (exact, case-insensitive): VRM — `VRM`, `VRM Name`, `RM`, `RM Name`, `Relationship Manager`;
  Date — `Date`, `Activation Date`, `Account Opening Date`, `Opening Date`; Code — `Client Code`, `Client ID`, `Code`, `UCC`.
  Anything else is mapped by hand on the import screen.
- Never put real client data in this public repository.
