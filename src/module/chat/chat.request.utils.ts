export function normalizeChatSearchQuery(value?: string | string[]) {
  const query = Array.isArray(value) ? value[0] : value;
  return query?.trim().slice(0, 120) ?? "";
}

export function resolveChatRequestThreadId(threadId: string | null | undefined, clientThreadId: string) {
  return threadId?.trim() || clientThreadId;
}

export function createRetryChatRequest<Body extends Record<string, unknown>, FilePart>(input: {
  body: Body;
  files: FilePart[];
  messageId: string;
  text: string;
}) {
  return {
    body: input.body,
    message: {
      files: input.files,
      messageId: input.messageId,
      text: input.text,
    },
  };
}
