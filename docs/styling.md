# Styling

All components use CSS custom properties (CSS variables) for theming. Override them in your app to match your design.

## CSS Custom Properties

```css
:root {
  /* Primary (buttons, links, focus) */
  --ferret-primary-bg: #3b82f6;
  --ferret-primary-hover: #2563eb;
  --ferret-primary-color: #ffffff;

  /* Errors */
  --ferret-error-bg: #fef2f2;
  --ferret-error-color: #dc2626;
  --ferret-error-border: #fecaca;

  /* Text */
  --ferret-label-color: #374151;
  --ferret-muted-color: #6b7280;

  /* Inputs */
  --ferret-input-border: #d1d5db;

  /* Focus rings */
  --ferret-focus-color: #3b82f6;
  --ferret-focus-ring: rgba(59, 130, 246, 0.3);

  /* Layout */
  --ferret-form-width: 24rem;

  /* MFA badge (used in MfaSetup) */
  --ferret-muted-bg: #f3f4f6;
  --ferret-success-bg: #dcfce7;
  --ferret-success-color: #16a34a;
}
```

## Dark Theme Example

```css
[data-theme="dark"] {
  --ferret-primary-bg: #60a5fa;
  --ferret-primary-hover: #93bbfd;
  --ferret-primary-color: #1e293b;

  --ferret-error-bg: #451a1a;
  --ferret-error-color: #fca5a5;
  --ferret-error-border: #7f1d1d;

  --ferret-label-color: #e2e8f0;
  --ferret-muted-color: #94a3b8;

  --ferret-input-border: #475569;

  --ferret-focus-color: #60a5fa;
  --ferret-focus-ring: rgba(96, 165, 250, 0.3);

  --ferret-muted-bg: #334155;
  --ferret-success-bg: #14532d;
  --ferret-success-color: #86efac;
}
```

## CSS Class Reference

All classes are prefixed with `ferret-` to avoid collisions.

### Form (FlowForm)

| Class | Element |
|-------|---------|
| `.ferret-form` | `<form>` wrapper |
| `.ferret-form-error` | Error banner (non-field errors) |
| `.ferret-field` | Field wrapper |
| `.ferret-field-error` | Field wrapper when error present |
| `.ferret-label` | `<label>` |
| `.ferret-required` | Required asterisk `*` |
| `.ferret-input` | `<input>` |
| `.ferret-field-message` | Inline field error message |
| `.ferret-submit` | Submit button |
| `.ferret-spinner` | Loading spinner inside button |

### Login (LoginFlow)

| Class | Element |
|-------|---------|
| `.ferret-login` | Root wrapper |
| `.ferret-loading` | Loading state text |
| `.ferret-status-message` | Status/heading text |
| `.ferret-mfa` | MFA section wrapper |
| `.ferret-mfa-tabs` | MFA method tab container |
| `.ferret-mfa-tab` | Individual MFA tab button |
| `.ferret-mfa-tab.active` | Active MFA tab |
| `.ferret-login-links` | Links container (forgot/register) |
| `.ferret-link` | Text link button |
| `.ferret-link-text` | Text surrounding link |

### Registration (RegistrationFlow)

| Class | Element |
|-------|---------|
| `.ferret-registration` | Root wrapper |
| `.ferret-registration-links` | Links container |

### Recovery (RecoveryFlow)

| Class | Element |
|-------|---------|
| `.ferret-recovery` | Root wrapper |
| `.ferret-recovery-links` | Links container |

### Verification (VerificationFlow)

| Class | Element |
|-------|---------|
| `.ferret-verification` | Root wrapper |

### Settings (SettingsFlow)

| Class | Element |
|-------|---------|
| `.ferret-settings` | Root wrapper |

### MFA Setup (MfaSetup)

| Class | Element |
|-------|---------|
| `.ferret-mfa-setup` | Root wrapper |
| `.ferret-heading` | Section heading |
| `.ferret-mfa-method` | Method row (name + badge) |
| `.ferret-badge` | ON/OFF badge |
| `.ferret-badge.enabled` | Enabled state badge |
| `.ferret-totp-setup` | TOTP setup section |
| `.ferret-qr` | QR code container |
| `.ferret-secret-label` | "Manual entry" label |
| `.ferret-secret` | Secret code display |
| `.ferret-backup-codes` | Backup codes section |
| `.ferret-codes-grid` | 2-column code grid |
| `.ferret-code` | Individual backup code |
| `.ferret-verify-form` | Verification form |

### Sessions (SessionList)

| Class | Element |
|-------|---------|
| `.ferret-sessions` | Root wrapper |
| `.ferret-empty` | Empty state text |
| `.ferret-session-list` | `<ul>` container |
| `.ferret-session-item` | `<li>` session row |
| `.ferret-session-info` | Info column (device + meta) |
| `.ferret-session-device` | Device name |
| `.ferret-session-meta` | IP + timestamp |
| `.ferret-session-revoke` | Revoke button |

## Scoped Styles

All component styles use Svelte's scoped `<style>` blocks. They won't leak into your app. To override, either:

1. **CSS custom properties** (recommended) — set variables on a parent element
2. **Global CSS** with `:global()` — target `.ferret-*` classes
3. **Wrapper styles** — style the container around Ferret components
