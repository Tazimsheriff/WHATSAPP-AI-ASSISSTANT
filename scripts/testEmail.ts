import { emailService } from '../src/services/emailService.js';
import { messageHandler } from '../src/handlers/messageHandler.js';

async function runTests() {
  console.log('=== 1. Testing Email Validation ===');
  console.log('test@example.com valid?', emailService.isValidEmail('test@example.com'));
  console.log('invalid-email valid?', emailService.isValidEmail('invalid-email'));
  console.log('john.doe+tag@sub.domain.org valid?', emailService.isValidEmail('john.doe+tag@sub.domain.org'));

  console.log('\n=== 2. Testing Body Preview Generation ===');
  const sampleBody = 'Hello,\n\nWe are pleased to inform you that the software development project is completed and ready for deployment.\nPlease review the deliverables and let us know your feedback.\n\nBest regards,\nHarsha';
  const preview = emailService.generateBodyPreview(sampleBody, 100);
  console.log('Preview:', preview);

  console.log('\n=== 3. Testing WhatsApp Confirmation Formatter ===');
  const mockSuccessResult = {
    success: true,
    to: 'test@example.com',
    subject: 'Project Ready for Review',
    body: sampleBody,
    preview: emailService.generateBodyPreview(sampleBody),
    messageId: '<20260912-sample-id@whatsapp-ai>',
    isConfigured: true
  };
  console.log('--- Success Response Formatter ---');
  console.log(emailService.formatEmailConfirmation(mockSuccessResult));

  console.log('\n--- Unconfigured / Failure Response Formatter ---');
  const mockFailureResult = {
    success: false,
    to: 'test@example.com',
    subject: 'Project Ready for Review',
    body: sampleBody,
    preview: emailService.generateBodyPreview(sampleBody),
    isConfigured: false,
    error: 'SMTP credentials not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in your .env file.'
  };
  console.log(emailService.formatEmailConfirmation(mockFailureResult));

  console.log('\n=== 4. Testing Live emailService.sendEmail without credentials ===');
  const liveResult = await emailService.sendEmail({
    to: 'test@example.com',
    subject: 'Test Subject',
    body: 'Test Body'
  });
  console.log('Result when unconfigured:', liveResult);
  console.log('\nFormatted WhatsApp output:');
  console.log(emailService.formatEmailConfirmation(liveResult));

  console.log('\n=== 5. Testing isEmailIntent detection via MessageHandler reflection ===');
  const isEmailIntent = (messageHandler as any).isEmailIntent.bind(messageHandler);

  const testCases = [
    { text: 'send a mail to test@example.com telling them the project is ready', expected: true },
    { text: 'send an email to client@gmail.com about the deliverables', expected: true },
    { text: '!mail to dev@agency.org project update', expected: true },
    { text: '!email contact@startup.io meeting details', expected: true },
    { text: 'mail to boss@corp.com that the task is finished', expected: true },
    { text: 'shoot an email to partner@venture.com with the pitch deck', expected: true },
    { text: 'hello, how are you today?', expected: false },
    { text: 'my email address is test@example.com, just letting you know', expected: false },
    { text: '!meet tomorrow at 3pm with colleague@gmail.com', expected: false }
  ];

  let passed = 0;
  for (const tc of testCases) {
    const result = isEmailIntent(tc.text);
    const ok = result === tc.expected;
    if (ok) passed++;
    console.log(`[${ok ? 'PASS' : 'FAIL'}] "${tc.text}" -> ${result} (expected: ${tc.expected})`);
  }

  console.log(`\nTests passed: ${passed}/${testCases.length}`);

  console.log('\n=== 6. Testing aiService.handleEmailSending ===');
  const { aiService } = await import('../src/services/ai.js');
  const aiResult = await aiService.handleEmailSending(
    'send a mail to test@example.com telling them the project is ready',
    'Tazim'
  );
  console.log('AI Email Sending Output:\n' + aiResult);
}

runTests().catch(console.error);

