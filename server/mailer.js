const db = require('./db');

let nodemailer;
let openpgp;

try {
    nodemailer = require('nodemailer');
} catch {
    console.warn('[MAILER] nodemailer not installed. Email notifications disabled.');
}

try {
    openpgp = require('openpgp');
} catch {
    console.warn('[MAILER] openpgp not available for email encryption.');
}

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'notifications@goxmr.click';

let transporter = null;

if (nodemailer && SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
    console.log('[MAILER] Email notifications enabled');
} else {
    console.log('[MAILER] Email notifications disabled (missing SMTP config or nodemailer)');
}

/**
 * Send notification email to a user. PGP-encrypts if they have a key.
 * Never throws — failures are logged silently.
 *
 * @param {number} userId
 * @param {string} subject
 * @param {string} body
 * @param {object} [options]
 * @param {boolean} [options.useStoreKey] If true, prefer store_config.store_pgp_public_key over the profile key
 */
async function sendNotification(userId, subject, body, options = {}) {
    if (!transporter) return;

    try {
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT u.notification_email, u.email_notifications, u.pgp_public_key,
                        s.store_pgp_public_key
                 FROM users u
                 LEFT JOIN store_config s ON s.user_id = u.id
                 WHERE u.id = ?`,
                [userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!user || !user.notification_email || !user.email_notifications) return;

        let emailBody = body;
        let contentType = 'text/plain';

        // Pick encryption key: when this is a store-context notification, prefer
        // the store-specific key (so the seller can isolate store ops opsec); else profile key.
        const encryptionKey = options.useStoreKey
            ? (user.store_pgp_public_key || user.pgp_public_key)
            : user.pgp_public_key;

        // PGP-encrypt if a key is available
        if (encryptionKey && openpgp) {
            try {
                const publicKey = await openpgp.readKey({ armoredKey: encryptionKey });
                emailBody = await openpgp.encrypt({
                    message: await openpgp.createMessage({ text: body }),
                    encryptionKeys: publicKey
                });
                contentType = 'text/plain'; // PGP armor is plain text
                subject = '[PGP] ' + subject;
            } catch (pgpErr) {
                console.error('[MAILER] PGP encryption failed, sending unencrypted:', pgpErr.message);
            }
        }

        await transporter.sendMail({
            from: `"GOXMR" <${SMTP_FROM}>`,
            to: user.notification_email,
            subject: subject,
            text: emailBody,
            headers: { 'Content-Type': contentType }
        });
    } catch (err) {
        console.error('[MAILER] Failed to send notification:', err.message);
    }
}

module.exports = { sendNotification };
