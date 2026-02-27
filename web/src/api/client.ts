import type { InstanceState, InstanceConfig, MissionHistoryResponse, RunMissionResponse, ChatMessageResponse, ChatHistoryResponse, ChatMessagesResponse } from './types';

const BASE_URL = '/api';

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function listInstances(): Promise<InstanceState[]> {
  return fetchJSON<InstanceState[]>('/instances');
}

export async function getInstance(id: string): Promise<InstanceState> {
  return fetchJSON<InstanceState>(`/instances/${id}`);
}

export async function getInstanceConfig(id: string): Promise<InstanceConfig> {
  return fetchJSON<InstanceConfig>(`/instances/${id}/config`);
}

export async function runMission(instanceId: string, missionName: string, inputs: Record<string, string>): Promise<RunMissionResponse> {
  return fetchJSON<RunMissionResponse>(`/instances/${instanceId}/missions/${missionName}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs }),
  });
}

export async function getMissionHistory(instanceId: string): Promise<MissionHistoryResponse> {
  return fetchJSON<MissionHistoryResponse>(`/instances/${instanceId}/history`);
}

export async function sendChatMessage(instanceId: string, agentName: string, message: string, sessionId?: string): Promise<ChatMessageResponse> {
  return fetchJSON<ChatMessageResponse>(`/instances/${instanceId}/agents/${agentName}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
  });
}

export async function getChatHistory(instanceId: string, agentName: string): Promise<ChatHistoryResponse> {
  return fetchJSON<ChatHistoryResponse>(`/instances/${instanceId}/agents/${agentName}/chats`);
}

export async function getChatMessages(instanceId: string, sessionId: string): Promise<ChatMessagesResponse> {
  return fetchJSON<ChatMessagesResponse>(`/instances/${instanceId}/chats/${sessionId}/messages`);
}

export async function archiveChat(instanceId: string, sessionId: string): Promise<void> {
  await fetchJSON(`/instances/${instanceId}/chats/${sessionId}`, { method: 'DELETE' });
}
