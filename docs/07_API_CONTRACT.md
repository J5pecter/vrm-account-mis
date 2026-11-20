# 07 · API contract — v3

**Transport:** `POST {APPS_SCRIPT_EXEC_URL}`, header `Content-Type: text/plain;charset=utf-8`, body = JSON object.
Apps Script answers with HTTP 302 to a one-time `script.googleusercontent.com` URL; `fetch` follows it. Errors are always HTTP 200
with `ok:false` (Apps Script cannot set status codes). `GET {exec}` returns `health` only.

**Envelope**
```json
{ "ok": true,  "apiVersion": 3, "requestId": "srv-uuid", "serverTime": "2026-11-17T06:00:00.000Z", "today": "2026-11-17", "data": { } }
{ "ok": false, "apiVersion": 3, "requestId": "srv-uuid", "serverTime": "...", "error": { "code": "FORBIDDEN", "message": "You do not have permission for this action.", "details": null } }
```
Authenticated calls add `"token"`. Mutations (marked ✎) require `"requestId"`; repeating a request ID returns the stored result
with `"replayed": true` (or `CONFLICT` if reused for another user/action).

## Error codes
| Code | Meaning | Client behaviour |
|---|---|---|
| `BAD_REQUEST` | Missing/malformed body or required protocol field | Bug |
| `PAYLOAD_TOO_LARGE` | Body > 3 MB or > 1,500 rows | Split |
| `UNKNOWN_ACTION` | Not a v3 action | Bug |
| `CLIENT_UPGRADE_REQUIRED` | v1/v2 call (`{pw}` or removed action) | Reload |
| `AUTH_REQUIRED` · `SESSION_EXPIRED` · `SESSION_REVOKED` | No/expired/idle/revoked token | Back to sign-in with message |
| `ACCOUNT_DISABLED` · `ACCOUNT_LOCKED` · `INVALID_CREDENTIALS` | Sign-in / account state | Message |
| `PASSWORD_CHANGE_REQUIRED` | Temporary password not yet replaced | Password screen |
| `FORBIDDEN` | Role/VRM not allowed (audited for writes) | Message |
| `VALIDATION` · `NOT_FOUND` · `CONFLICT` | Business rule (audited as `rejected` for writes) | Message |
| `BUSY` | Script lock not obtained in 25 s; nothing written | Retry with same requestId |
| `SERVER_NOT_CONFIGURED` | Missing properties/tabs | Operator |
| `INTERNAL` | Unexpected; message carries a reference only | Report reference |

## Actions
Roles: **P** public · **R** admin/member/reviewer · **W** admin/member · **A** admin · **AR** admin/reviewer.

| Action | Role | Params | `data` |
|---|---|---|---|
| `health` | P | — | `{service, version, apiVersion, configured}` |
| `getLoginBootstrap` | P | — | `{apiVersion, rosterMode:'typed'|'list', names?, minPasswordLength}` |
| `login` | P | `user, pw, remember?` | `{token, expiresAt, me}` |
| `logout` | R* | — | `{loggedOut:true}` |
| `whoami` | R* | — | `{me}` |
| `changePassword` | R* | `currentPassword, newPassword` | `{changed, me}` (other sessions revoked) |
| `getData` | R | — | `{me, config, vrms[{id,name,status}], counts[[vrmId,date,n]], zeroReports[[vrmId,date]], totals, asOf}` |
| `queryEntries` | R | `q?, codes?[], vrmId?, from?, to?, batchId?, status?(active|deleted|all; non-active admin/reviewer), sort?(date|code|vrm|created), dir?, page?, pageSize?(≤200)` | `{items[entry], total, page, pageSize, pages}` |
| `lookupCodes` | R | `codes[] (≤500)` | `{results[{input, valid, status: available|taken|reserved|repeated|invalid, reason?, owner?{vrmId,vrmName,date}, entryId?}]}` |
| `exportReport` (audited, no requestId) | R | `filter{year, month?, from?, to?, allTime?, vrmId?}` | `{asOf, period{kind,from,to}, vrmId, total, summary[{vrmId,vrmName,status,count}], detail[{date,vrmName,code,source,batchId,createdAt,createdBy}]}` |
| `addEntries` ✎ | W | `vrmId, date, codes[] (≤1500 strings)` | `{summary{received,added,duplicateInPaste,duplicateExisting,invalid,failed,recovered}, results[{i,input,status,reason?,entryId?,owner?,recovered?}], vrmId, date}` |
| `previewImport` | W | `rows[{row,vrm,date,code}] (≤1500), batchId?` | `{summary, results[{row,input,status,reason,vrmId?,vrmName?,owner?,canCreate?}], newVrmNames[]}` |
| `commitImport` ✎ | W | `batchId, chunkIndex, chunkCount, rows[], fileName?, fileRows?, clientRejected?, mode?, approveNewVrms?[] (admin)` | `{summary{received,accepted,duplicateInFile,duplicateExisting,invalid,unauthorized,recovered}, results[], batch, createdVrms[]}` |
| `cancelImport` ✎ | W | `batchId` | `{batch}` |
| `getImportStatus` | R | `batchId` (members: own batches) | `{batch}` |
| `submitZeroReport` ✎ | W | `vrmId, date` | `{zeroReport, alreadyReported?}` |
| `withdrawZeroReport` ✎ | W | `vrmId, date` | `{withdrawn:true}` |
| `addVRM` ✎ | A | `name` | `{vrm}` |
| `renameVRM` ✎ | A | `vrmId, newName` | `{vrm}` |
| `archiveVRM` ✎ | A | `vrmId, reason` | `{vrm}` |
| `restoreVRM` ✎ | A | `vrmId` | `{vrm}` |
| `correctEntry` ✎ | A | `entryId, vrmId?, date?, reason` | `{entry}` |
| `softDeleteEntry` ✎ | A | `entryId, reason` | `{entry}` |
| `restoreEntry` ✎ | A | `entryId, reason` | `{entry}` |
| `listAliases` | A | — | `{aliases[{aliasKey, alias, vrmId, vrmName}]}` |
| `addAlias` ✎ | A | `alias, vrmId` | `{alias, alreadyExists?}` |
| `removeAlias` ✎ | A | `aliasKey` | `{removed}` |
| `listUsers` | A | — | `{users[{id,name,role,assignedVrmId,active,locked,mustChangePassword,lastLoginAt,createdAt}]}` |
| `createUser` ✎ | A | `name, role, assignedVrmId?, tempPassword` | `{user}` |
| `updateUser` ✎ | A | `userId, role?, assignedVrmId?` | `{user}` (sessions revoked) |
| `resetUserPassword` ✎ | A | `userId, tempPassword` | `{user}` |
| `setUserActive` ✎ | A | `userId, active, reason (when disabling)` | `{user}` |
| `unlockUser` ✎ | A | `userId` | `{user}` |
| `integrityReport` | A | — | `{ok, entries, active, deleted, distinctCodeKeys, duplicateCodeKeys, orphanEntries, invalidDates, futureDates, codeKeyMismatches, teamEqualsSumOfVrms, perVrm[], perMonth[]}` |
| `getLogs` | AR | `from?, to? (IST dates), actorId?, eventAction?, outcome?, page?, pageSize?` | `{items[audit], total, page, pageSize, pages, actors[], actions[]}` |
| `listImportBatches` | AR | `page?, pageSize?` | `{items[batch], total}` |
| `getAdminOverview` | AR | — | `{users (admin only), recent[], corrections[], backdated[], backdatedEntries[], importExceptions[], windowDays}` |

\* also allowed while `PASSWORD_CHANGE_REQUIRED`.

## Examples (fictional data)
```json
→ {"action":"addEntries","token":"…","requestId":"5f0c…","vrmId":"a1b2…","date":"2026-11-16","codes":["000123"," cl002 ","CL002","A B"]}
← {"ok":true,…,"data":{"summary":{"received":4,"added":2,"duplicateInPaste":1,"duplicateExisting":0,"invalid":1,"failed":0,"recovered":0},
   "results":[{"i":0,"input":"000123","status":"ADDED","entryId":"…"},{"i":1,"input":"cl002","status":"ADDED","entryId":"…"},
   {"i":2,"input":"CL002","status":"DUPLICATE_IN_PASTE","reason":"Repeated in this submission."},
   {"i":3,"input":"A B","status":"INVALID","reason":"Code contains a space. Separate codes with commas, semicolons or new lines."}]}}

→ {"action":"addEntries","token":"<member token>","requestId":"…","vrmId":"<another VRM>","date":"2026-11-16","codes":["X1"]}
← {"ok":false,…,"error":{"code":"FORBIDDEN","message":"You may only record activity for your own VRM.","details":null}}

→ {"action":"getData","pw":"old-shared-password"}
← {"ok":false,…,"error":{"code":"CLIENT_UPGRADE_REQUIRED","message":"This dashboard version is out of date. Reload the page.","details":null}}
```

## Backward compatibility
v3 is a **new deployment** on a new Sheet. The v2 frontend keeps talking to the v2 deployment until cutover; if a v2 page ever hits
v3 it receives `CLIENT_UPGRADE_REQUIRED` (v2 shows the message as a toast). Removed: `getVrms`, `deleteVRM`, `deleteEntry`,
`importRows`, `pw`/`by`/`ip` fields.
