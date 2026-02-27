import type { ChatEvent } from './types';

export interface ChatEventSource {
  close: () => void;
}

export function subscribeChatEvents(
  instanceId: string,
  sessionId: string,
  onEvent: (event: ChatEvent) => void,
  onComplete: () => void,
  onError: (error: string) => void,
): ChatEventSource {
  const url = `/api/instances/${instanceId}/chat/${sessionId}/events`;
  const es = new EventSource(url);

  const handleEvent = (e: MessageEvent) => {
    try {
      const event: ChatEvent = JSON.parse(e.data);
      onEvent(event);

      if (event.eventType === 'turn_complete' || event.eventType === 'error') {
        es.close();
        onComplete();
      }
    } catch {
      // Skip malformed events
    }
  };

  const eventTypes = [
    'thinking', 'reasoning_chunk', 'reasoning_done',
    'answer_chunk', 'answer_done',
    'calling_tool', 'tool_complete',
    'turn_complete', 'error',
  ];

  for (const type of eventTypes) {
    es.addEventListener(type, handleEvent);
  }

  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) {
      onComplete();
    } else {
      onError('Connection lost');
      es.close();
    }
  };

  return { close: () => es.close() };
}
