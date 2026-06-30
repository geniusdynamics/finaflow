export function welcomeEmailHtml(name: string, businessName: string, accountId: string, loginUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to Finaflow</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #2D2A26; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .brand { color: #C73E1D; font-weight: bold; font-size: 24px; margin-bottom: 24px; }
    .card { background: #FFF9F5; border-radius: 12px; padding: 24px; margin: 24px 0; }
    .label { color: #8D8A87; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .value { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
    .footer { color: #8D8A87; font-size: 12px; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">Finaflow</div>
    <h1>Welcome, ${escapeHtml(name)}!</h1>
    <p>Your new Finaflow account has been created and is ready to use.</p>
    <div class="card">
      <div class="label">Business</div>
      <div class="value">${escapeHtml(businessName)}</div>
      <div class="label">Account ID</div>
      <div class="value">${escapeHtml(accountId)}</div>
    </div>
    <p>You can sign in at <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a> using your Account ID, username, and password.</p>
    <p>If you have any questions, reply to this email and our team will be happy to help.</p>
    <div class="footer">
      <p>© Finaflow. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`.trim();
}

export function welcomeEmailText(name: string, businessName: string, accountId: string, loginUrl: string): string {
  return `Welcome to Finaflow, ${name}!

Your new account has been created and is ready to use.

Business: ${businessName}
Account ID: ${accountId}

Sign in at: ${loginUrl}

Use your Account ID, username, and password to log in.

If you have any questions, reply to this email and our team will be happy to help.

© Finaflow. All rights reserved.
`.trim();
}

export function newSignupNotificationHtml(name: string, email: string, businessName: string, accountId: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Finaflow Signup</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #2D2A26; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .brand { color: #C73E1D; font-weight: bold; font-size: 24px; margin-bottom: 24px; }
    .card { background: #FFF9F5; border-radius: 12px; padding: 24px; margin: 24px 0; }
    .label { color: #8D8A87; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .value { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">Finaflow Admin</div>
    <h1>New user signup</h1>
    <p>A new user just registered on Finaflow.</p>
    <div class="card">
      <div class="label">Name</div>
      <div class="value">${escapeHtml(name)}</div>
      <div class="label">Email</div>
      <div class="value">${escapeHtml(email)}</div>
      <div class="label">Business</div>
      <div class="value">${escapeHtml(businessName)}</div>
      <div class="label">Account ID</div>
      <div class="value">${escapeHtml(accountId)}</div>
    </div>
    <p>You can review account activity from the admin dashboard.</p>
  </div>
</body>
</html>
`.trim();
}

export function newSignupNotificationText(name: string, email: string, businessName: string, accountId: string): string {
  return `New Finaflow Signup

Name: ${name}
Email: ${email}
Business: ${businessName}
Account ID: ${accountId}

You can review account activity from the admin dashboard.
`.trim();
}

export function passwordResetHtml(name: string, resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset your Finaflow password</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #2D2A26; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .brand { color: #C73E1D; font-weight: bold; font-size: 24px; margin-bottom: 24px; }
    .card { background: #FFF9F5; border-radius: 12px; padding: 24px; margin: 24px 0; }
    .button { display: inline-block; background: #C73E1D; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .footer { color: #8D8A87; font-size: 12px; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">Finaflow</div>
    <h1>Reset your password</h1>
    <p>Hi ${escapeHtml(name)},</p>
    <p>We received a request to reset the password for your Finaflow account. Click the button below to choose a new password.</p>
    <div class="card" style="text-align: center;">
      <a href="${escapeHtml(resetUrl)}" class="button">Reset Password</a>
    </div>
    <p>This link expires in 1 hour and can only be used once. If you did not request a password reset, you can safely ignore this email.</p>
    <p>If the button does not work, copy and paste this link into your browser:</p>
    <p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p>
    <div class="footer">
      <p>© Finaflow. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`.trim();
}

export function passwordResetText(name: string, resetUrl: string): string {
  return `Hi ${name},

We received a request to reset the password for your Finaflow account. Use the link below to choose a new password:

${resetUrl}

This link expires in 1 hour and can only be used once. If you did not request a password reset, you can safely ignore this email.

© Finaflow. All rights reserved.
`.trim();
}

export function ownerBroadcastHtml(title: string, message: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #2D2A26; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .brand { color: #C73E1D; font-weight: bold; font-size: 24px; margin-bottom: 24px; }
    .card { background: #FFF9F5; border-radius: 12px; padding: 24px; margin: 24px 0; }
    .footer { color: #8D8A87; font-size: 12px; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">Finaflow</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="card">
      <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
    </div>
    <p>This is an announcement from the Finaflow team. No action is required unless stated above.</p>
    <div class="footer">
      <p>© Finaflow. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`.trim();
}

export function ownerBroadcastText(title: string, message: string): string {
  return `${title}

${message}

This is an announcement from the Finaflow team. No action is required unless stated above.

© Finaflow. All rights reserved.
`.trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
