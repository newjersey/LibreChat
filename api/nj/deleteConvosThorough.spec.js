const { Conversation, Message, SharedLink, ToolCall, Transaction } = require('~/db/models');
const { EModelEndpoint } = require('librechat-data-provider');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { deleteConvosThorough } = require('~/nj/deleteConvosThorough');

describe('deleteConvosThorough()', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  test('should delete conversation', async () => {
    const conversation = {
      conversationId: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      title: 'Test Conversation',
      endpoint: EModelEndpoint.openAI,
    };
    await Conversation.create(conversation);

    const result = await deleteConvosThorough(conversation.user, {
      conversationId: conversation.conversationId,
    });

    expect(result.deletedCount).toBe(1);
    expect(result.messages.deletedCount).toBe(0);
    expect(result.sharedLinks.deletedCount).toBe(0);

    // Verify conversation was deleted
    const convoCount = await Conversation.countDocuments({
      conversationId: conversation.conversationId,
    });
    expect(convoCount).toEqual(0);
  });

  test("should delete conversation's messages", async () => {
    const conversation = {
      conversationId: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      title: 'Test Conversation',
      endpoint: EModelEndpoint.openAI,
    };
    await Conversation.create(conversation);

    await Message.create(
      {
        messageId: new mongoose.Types.ObjectId(),
        conversationId: conversation.conversationId,
        user: conversation.user,
        isCreatedByUser: true,
      },
      {
        messageId: new mongoose.Types.ObjectId(),
        conversationId: conversation.conversationId,
        user: conversation.user,
        isCreatedByUser: false,
      },
    );

    const result = await deleteConvosThorough(conversation.user, {
      conversationId: conversation.conversationId,
    });
    expect(result.messages.deletedCount).toBe(2);

    // Verify all messages deleted
    const messageCount = await Message.countDocuments({
      conversationId: conversation.conversationId,
    });
    expect(messageCount).toEqual(0);
  });

  test("should delete conversation's shared links", async () => {
    const conversation = {
      conversationId: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      title: 'Test Conversation 1',
      endpoint: EModelEndpoint.openAI,
    };
    await Conversation.create(conversation);

    await SharedLink.create(
      {
        conversationId: conversation.conversationId,
        title: conversation.title,
        user: conversation.user,
        shareId: new mongoose.Types.ObjectId(),
      },
      {
        conversationId: conversation.conversationId,
        title: conversation.title,
        user: conversation.user,
        shareId: new mongoose.Types.ObjectId(),
      },
    );

    const result = await deleteConvosThorough(conversation.user, {
      conversationId: conversation.conversationId,
    });
    expect(result.sharedLinks.deletedCount).toBe(2);

    const sharedLinkCount = await SharedLink.countDocuments({
      conversationId: conversation.conversationId,
    });
    expect(sharedLinkCount).toEqual(0);
  });

  test("should delete conversation's tool calls", async () => {
    const conversation = {
      conversationId: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      title: 'Test Conversation 1',
      endpoint: EModelEndpoint.openAI,
    };
    await Conversation.create(conversation);

    await ToolCall.create(
      {
        conversationId: conversation.conversationId,
        messageId: new mongoose.Types.ObjectId(),
        toolId: new mongoose.Types.ObjectId(),
        user: conversation.user,
      },
      {
        conversationId: conversation.conversationId,
        messageId: new mongoose.Types.ObjectId(),
        toolId: new mongoose.Types.ObjectId(),
        user: conversation.user,
      },
    );

    const result = await deleteConvosThorough(conversation.user, {
      conversationId: conversation.conversationId,
    });
    expect(result.toolCalls.deletedCount).toBe(2);

    const toolCallCount = await ToolCall.countDocuments({
      conversationId: conversation.conversationId,
    });
    expect(toolCallCount).toEqual(0);
  });

  // Transactions should be preserved, otherwise balances can get off!
  test("should NOT delete conversation's transactions", async () => {
    const conversation = {
      conversationId: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      title: 'Test Conversation 1',
      endpoint: EModelEndpoint.openAI,
    };
    await Conversation.create(conversation);

    await Transaction.create({
      user: conversation.user,
      conversationId: conversation.conversationId,
      tokenType: 'prompt',
    });

    await deleteConvosThorough(conversation.user, {
      conversationId: conversation.conversationId,
    });

    const transactionCount = await Transaction.countDocuments({
      conversationId: conversation.conversationId,
    });
    expect(transactionCount).toEqual(1);
  });
});
