import { test, expect } from '@playwright/test';

const CONVO_START_RESPONSE = {
  streamId: 'mocked-stream-id',
  conversationId: 'mocked-conversation-id',
  status: 'started',
};

const SSE_EVENTS = [
  {
    created: true,
    message: {
      sender: 'User',
      text: 'Can you tell me a joke?',
    },
  },
  {
    event: 'on_message_delta',
    data: {
      id: 'step_mock',
      delta: {
        content: [
          {
            type: 'text',
            text: 'Mocked response',
            index: 0,
          },
        ],
      },
    },
  },
  {
    final: true,
    responseMessage: {
      sender: 'AWS Bedrock',
      text: 'Mocked response',
      content: [
        {
          type: 'text',
          text: 'Mocked response',
        },
      ],
    },
  },
];

// Join SSE events into one stream
const sseBody = SSE_EVENTS.map(
  (event) => `event: message\ndata: ${JSON.stringify(event)}\n\n`,
).join('');

test('prompt submission', async ({ page }) => {
  // Intercept and mock API responses
  await page.route('**/api/agents/chat/bedrock', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CONVO_START_RESPONSE),
    });
  });

  await page.route('**/api/agents/chat/stream/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: { 'Cache-Control': 'no-cache' },
      body: sseBody,
    });
  });

  await page.goto('http://localhost:3080/', { timeout: 10000 });

  // Submit a prompt
  const inputField = page.getByTestId('text-input');
  await expect(inputField).toBeVisible({ timeout: 10000 });
  await inputField.fill('Can you tell me a joke?');
  await inputField.press('Enter');
  await expect(page.getByText('Can you tell me a joke?')).toBeVisible();

  // Wait for mocked response
  await expect(page.getByText('Mocked response')).toBeVisible({ timeout: 10000 });
});
