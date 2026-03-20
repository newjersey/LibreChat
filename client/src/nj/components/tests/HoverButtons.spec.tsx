import { render } from 'test/layout-test-utils';
import HoverButtons from '~/components/Chat/Messages/HoverButtons';
import store from '~/store';
import { RecoilRoot } from 'recoil';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import * as njLog from '~/nj/analytics/logEvent';

describe('HoverButtons NJ customizations', () => {
  const renderHoverButtons = () => {
    return render(
      <RecoilRoot
        // Disable TTS (it's not needed for the test & complicates setup)
        initializeState={({ set }) => set(store.textToSpeech, false)}
        override={true}
      >
        <HoverButtons
          index={0}
          isEditing={false}
          enterEdit={() => {}}
          copyToClipboard={() => {}}
          // @ts-ignore - we only need a snippet of this complex object for the buttons
          conversation={{
            conversationId: 'abcdefg',
          }}
          isSubmitting={false}
          // @ts-ignore - we only need a snippet of this complex object for the buttons
          message={{
            isCreatedByUser: false,
            messageId: 'hijklmnop',
          }}
          regenerate={() => {}}
          handleContinue={() => {}}
          latestMessage={null}
          isLast={true}
          handleFeedback={() => {}}
        />
      </RecoilRoot>,
    );
  };

  test('Disabled fork & feedback buttons', () => {
    const dom = renderHoverButtons();

    // Expect hidden buttons NOT to be in the hover buttons
    const forkButton = dom.container.querySelector('[aria-label="Fork"]');
    expect(forkButton).not.toBeInTheDocument();

    const thumbsUpButton = screen.queryByTitle('Love this');
    expect(thumbsUpButton).not.toBeInTheDocument();

    const thumbsDownButton = screen.queryByTitle('Needs improvement');
    expect(thumbsDownButton).not.toBeInTheDocument();

    // Assert that buttons are rendering *at all* (otherwise test might be buggy)
    const copyButton = screen.queryByTitle('Copy to clipboard');
    expect(copyButton).toBeInTheDocument();
  });

  test('Copy button fires analytics event', async () => {
    const logEventSpy = jest.spyOn(njLog, 'logEvent');

    renderHoverButtons();

    const copyButton = await screen.findByTitle('Copy to clipboard');
    await userEvent.click(copyButton);

    expect(logEventSpy).toHaveBeenCalledWith('copy_response_text');
    expect(logEventSpy).toHaveBeenCalledTimes(1);
  });
});
