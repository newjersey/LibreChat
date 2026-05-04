import { expect, test } from '@playwright/test';

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

test('log in, prompt submission, and log out', async ({ page }) => {
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

  // Load app and wait for authentication (handled in the global setup file (e2e/setup/authenticate.ts)) and redirect
  await page.goto('http://localhost:3080/', { timeout: 10000 });
  await page.waitForURL('**/c/**', { timeout: 10000 });

  // Wait for the page to load and the SVG loader to disappear
  await page.waitForSelector('nav > div > div > svg', { state: 'detached' });

  // Check that the main app container is visible
  await expect(page.locator('#root')).toBeVisible();

  // Wait for the title to be set (React hydration + config loading)
  await page.waitForFunction(() => document.title.includes('NJ AI Assistant'), { timeout: 10000 });

  // Check that the title contains "NJ AI Assistant"
  await expect(page).toHaveTitle(/NJ AI Assistant/);
  console.log('Current now', page.url());

  // Submit a prompt
  const inputField = page.getByTestId('text-input');
  await expect(inputField).toBeVisible({ timeout: 60000 });
  await inputField.fill('Can you tell me a joke?');
  await inputField.press('Enter');
  await expect(page.getByText('Can you tell me a joke?')).toBeVisible();

  // Wait for mocked response
  await expect(page.getByText('Mocked response')).toBeVisible({ timeout: 60000 });

  // Log out
  const profileMenu = page.getByLabel('Account Settings');
  await profileMenu.click();

  const logoutButton = page.getByText('Log out');
  await logoutButton.click();

  await expect(page).not.toHaveURL('http://localhost:3080/c/new');
});
