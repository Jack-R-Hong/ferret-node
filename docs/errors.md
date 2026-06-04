# Error Handling

## FerretError

All API errors are thrown as `FerretError` instances. The class wraps the structured error response from the Ferret IDP backend.

```ts
import { FerretError } from '@ferret/sdk-svelte';

try {
  await client.submitLogin(flowId, data);
} catch (err) {
  if (err instanceof FerretError) {
    console.log(err.code);       // 'credentials_invalid'
    console.log(err.status);     // 401
    console.log(err.i18nKey);    // 'error.credentials_invalid'
    console.log(err.message);    // 'The provided credentials are invalid.'
  }
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `code` | `string` | Machine-readable error code |
| `status` | `number` | HTTP status code |
| `message` | `string` | Human-readable error message (English) |
| `i18nKey` | `string` | Translation key for localized message |
| `details` | `FieldError[] \| undefined` | Field-level validation errors |
| `retryAfter` | `number \| undefined` | Seconds to wait before retry (rate limiting) |

### Boolean Helpers

| Getter | Description |
|--------|-------------|
| `isValidation` | `true` if `code === 'validation_failed'` and `details` has entries |
| `isRateLimited` | `true` if `code === 'rate_limited'` |
| `isReauthRequired` | `true` if `code === 'reauthentication_required'` |

### Field Error Lookup

```ts
const fieldErr = err.fieldError('password');
if (fieldErr) {
  console.log(fieldErr.field);    // 'password'
  console.log(fieldErr.code);     // 'password_too_short'
  console.log(fieldErr.i18n_key); // 'error.field.password_too_short'
  console.log(fieldErr.params);   // { min: 10 }
}
```

---

## FieldError Interface

```ts
interface FieldError {
  field: string;                    // Field name
  code: string;                     // Error code
  message: string;                  // Human-readable message
  i18n_key: string;                 // Translation key
  params?: Record<string, unknown>; // Interpolation params
}
```

---

## Error Response Format

The backend returns errors in this structure:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "One or more fields failed validation.",
    "i18n_key": "error.validation_failed",
    "status": 400,
    "details": [
      {
        "field": "password",
        "code": "password_too_short",
        "message": "Password must be at least 10 characters.",
        "i18n_key": "error.field.password_too_short",
        "params": { "min": 10 }
      }
    ]
  }
}
```

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `credentials_invalid` | 401 | Wrong email/password |
| `session_expired` | 401 | Session has expired |
| `session_invalid` | 401 | Session is invalid |
| `token_expired` | 400 | Flow/CSRF token expired |
| `token_invalid` | 400 | Flow/CSRF token invalid |
| `reauthentication_required` | 403 | Need to re-enter password |
| `account_locked` | 403 | Account locked due to failed attempts |
| `forbidden` | 403 | No permission |
| `admin_required` | 403 | Requires admin access |
| `csrf_invalid` | 403 | CSRF token mismatch |
| `flow_not_found` | 404 | Flow expired or doesn't exist |
| `flow_method_unsupported` | 400 | Unsupported auth method |
| `validation_failed` | 400 | Field validation errors (see `details`) |
| `email_already_taken` | 409 | Email already registered |
| `username_already_taken` | 409 | Username already taken |
| `rate_limited` | 429 | Too many requests (check `retryAfter`) |
| `internal` | 500 | Server error |
| `service_unavailable` | 503 | Service temporarily down |

---

## Handling Errors in Components

The built-in components handle errors automatically:

- **Validation errors** → displayed inline next to each field
- **Non-validation errors** → displayed as a banner above the form
- **Error messages** are localized via the `i18nKey` and the `t()` function

For custom components, use this pattern:

```svelte
{#if error && !(error instanceof FerretError && error.isValidation)}
  <div class="error-banner" role="alert">
    {error instanceof FerretError ? t(error.i18nKey) : error.message}
  </div>
{/if}
```
