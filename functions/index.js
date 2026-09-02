const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const nodemailer = require('nodemailer');

const gmailUser = defineSecret('GMAIL_SMTP_USER');
const gmailPassword = defineSecret('GMAIL_SMTP_PASSWORD');
const notificationRecipient = 'liftally.app@gmail.com';

function isQuickBenchmarkFeedback(data) {
  return data
    && data.type === 'feedback'
    && data.source === 'benchmark_helpfulness_modal'
    && typeof data.message === 'string'
    && data.message.includes('Section: step_2_historical_benchmark');
}

function field(data, key, fallback = 'Not provided') {
  const value = data && data[key];
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

function extractMessageField(message, label) {
  const line = message.split('\n').find((entry) => entry.startsWith(`${label}:`));
  return line ? line.slice(label.length + 1).trim() : 'Not provided';
}

function formatTimestamp(value) {
  if (!value) return 'Not provided';
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

exports.notifyQuickBenchmarkFeedback = onDocumentCreated(
  {
    document: 'supportRequests/{requestId}',
    region: 'us-central1',
    secrets: [gmailUser, gmailPassword]
  },
  async (event) => {
    const data = event.data && event.data.data();
    if (!isQuickBenchmarkFeedback(data)) return;

    const message = field(data, 'message');
    const response = extractMessageField(message, 'Response');
    const context = extractMessageField(message, 'Context');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser.value(),
        pass: gmailPassword.value()
      }
    });

    const text = [
      'A quick benchmark feedback response was submitted on Liftally.',
      '',
      `Response: ${response}`,
      'Page / feature: Weight Class Explorer · Step 2 Historical Benchmark',
      `Benchmark context: ${context}`,
      `Requester email: ${field(data, 'email', 'Anonymous')}`,
      `Timestamp: ${formatTimestamp(data.createdAt)}`,
      `Request ID: ${event.params.requestId}`,
      '',
      'Original message:',
      message
    ].join('\n');

    await transporter.sendMail({
      from: gmailUser.value(),
      to: notificationRecipient,
      subject: `Liftally quick feedback: ${response}`,
      text
    });
  }
);
