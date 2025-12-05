const { Conversation, SharedLink, ToolCall } = require('~/db/models');
const { deleteMessages } = require('~/models/Message');
const { logger } = require('@librechat/data-schemas');

/**
 * A version of `deleteConvos()` that is a bit more thorough than the current one in the codebase.
 *
 * Ideally, we'd someday merge this into upstream, but for now we can access this one when we
 * want better deletion of conversations.
 */
const deleteConvosThorough = async (userId, filter) => {
  try {
    const userFilter = { ...filter, user: userId };
    const conversations = await Conversation.find(userFilter).select('conversationId');
    const conversationIds = conversations.map((c) => c.conversationId);

    if (!conversationIds.length) {
      throw new Error('Conversation not found or already deleted.');
    }

    const deleteConvoResult = await Conversation.deleteMany(userFilter);

    const deleteMessagesResult = await deleteMessages({
      conversationId: { $in: conversationIds },
    });

    const sharedLinkResult = await SharedLink.deleteMany(userFilter);

    const toolCallResult = await ToolCall.deleteMany(userFilter);

    return {
      ...deleteConvoResult,
      messages: deleteMessagesResult,
      sharedLinks: sharedLinkResult,
      toolCalls: toolCallResult,
    };
  } catch (error) {
    logger.error('[deleteConvos] Error deleting conversations and messages', error);
    throw error;
  }
};

module.exports = {
  deleteConvosThorough,
};
