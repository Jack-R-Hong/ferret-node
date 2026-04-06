export const en: Record<string, string> = {
	// ─── Error messages ──────────────────────────────────────────────────
	'error.credentials_invalid': 'The provided credentials are invalid.',
	'error.session_expired': 'Your session has expired. Please log in again.',
	'error.session_invalid': 'Your session is invalid. Please log in again.',
	'error.token_expired': 'The token has expired.',
	'error.token_invalid': 'The token is invalid.',
	'error.reauthentication_required': 'Please re-enter your password to continue.',
	'error.account_locked': 'Your account has been locked. Please try again later.',
	'error.forbidden': 'You do not have permission to perform this action.',
	'error.admin_required': 'Administrator access required.',
	'error.csrf_invalid': 'Security token mismatch. Please refresh and try again.',
	'error.device_mismatch': 'Device verification failed.',
	'error.client_type_mismatch': 'Client type mismatch.',
	'error.flow_not_found': 'This flow has expired or does not exist.',
	'error.flow_method_unsupported': 'This authentication method is not supported.',
	'error.validation_failed': 'One or more fields failed validation.',
	'error.email_already_taken': 'This email is already registered.',
	'error.username_already_taken': 'This username is already taken.',
	'error.rate_limited': 'Too many requests. Please try again later.',
	'error.internal': 'An unexpected error occurred. Please try again later.',
	'error.service_unavailable': 'Service is temporarily unavailable.',
	'error.content_type_invalid': 'Invalid content type.',
	'error.body_too_large': 'Request body is too large.',

	// ─── Field-level errors ──────────────────────────────────────────────
	'error.field.required': 'This field is required.',
	'error.field.email_invalid_format': 'Please enter a valid email address.',
	'error.field.username_too_short': 'Username must be at least {{min}} characters.',
	'error.field.username_too_long': 'Username must be at most {{max}} characters.',
	'error.field.username_invalid_chars': 'Username contains invalid characters.',
	'error.field.password_too_short': 'Password must be at least {{min}} characters.',
	'error.field.password_too_long': 'Password must be at most {{max}} characters.',
	'error.field.password_too_common': 'This password is too common. Please choose another.',
	'error.field.password_same_as_email': 'Password cannot be the same as your email.',
	'error.field.current_password_wrong': 'Current password is incorrect.',

	// ─── Flow field labels ───────────────────────────────────────────────
	'flow.field.identifier': 'Email or Username',
	'flow.field.email': 'Email',
	'flow.field.username': 'Username',
	'flow.field.password': 'Password',
	'flow.field.current_password': 'Current Password',
	'flow.field.new_password': 'New Password',
	'flow.field.given_name': 'First Name',
	'flow.field.family_name': 'Last Name',
	'flow.field.code': 'Verification Code',
	'flow.field.totp_code': 'Authenticator Code',
	'flow.field.recovery_code': 'Recovery Code',

	// ─── Flow status ─────────────────────────────────────────────────────
	'flow.status.input_required': 'Please fill in the following information.',
	'flow.status.mfa_required': 'Please complete two-factor authentication.',
	'flow.status.mfa_setup_required': 'Please set up two-factor authentication to continue.',
	'flow.status.code_sent': 'A verification code has been sent to your email.',
	'flow.status.password_required': 'Please enter your new password.',
	'flow.status.success': 'Success!',

	// ─── Flow methods ────────────────────────────────────────────────────
	'flow.method.password': 'Password',
	'flow.method.totp': 'Authenticator App',
	'flow.method.webauthn': 'Passkey',
	'flow.method.recovery_code': 'Recovery Code',

	// ─── Actions ─────────────────────────────────────────────────────────
	'action.login': 'Log In',
	'action.register': 'Sign Up',
	'action.logout': 'Log Out',
	'action.recover': 'Reset Password',
	'action.verify': 'Verify',
	'action.save': 'Save',
	'action.cancel': 'Cancel',
	'action.submit': 'Submit',
	'action.back': 'Back',
	'action.forgot_password': 'Forgot password?',
	'action.have_account': 'Already have an account?',
	'action.no_account': "Don't have an account?",
	'action.resend_code': 'Resend Code',

	// ─── MFA Setup ───────────────────────────────────────────────────────
	'mfa.totp.scan_qr': 'Scan the QR code with your authenticator app:',
	'mfa.totp.manual_entry': 'Or enter this secret manually:',
	'mfa.recovery_codes.save': 'Save these recovery codes in a safe place:'
};
