import { appConfig } from '../config';
import type { InboxChat, StaffMember } from '../types';

type JsonRecord = Record<string, unknown>;

const request = async <T>(path: string, options: RequestInit = {}, accessToken?: string): Promise<T> => {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) throw new Error(String(body.message ?? body.msg ?? 'Request failed.'));
  return body as T;
};

export const beginLogin = (email: string, password: string) =>
  request<{ success: boolean; token?: string }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  });

export const completeLogin = (email: string, otp: string) =>
  request<{ success: boolean; token: string }>('/auth/verify-otp', {
    method: 'POST', body: JSON.stringify({ email, otp }),
  });

export const getInbox = (token: string) =>
  request<{ chats: InboxChat[]; teamMembers: StaffMember[] }>('/inbox/chats', {}, token);

export const setChatAiReplyActive = (token: string, chatId: string, active: boolean) =>
  request<{ chat: InboxChat }>(`/inbox/chats/${encodeURIComponent(chatId)}/ai-reply`, {
    method: 'PATCH', body: JSON.stringify({ ai_reply_active: active }),
  }, token);

export const assignChatStaff = (token: string, chatId: string, staffId: string | null) =>
  request<{ chat: InboxChat }>(`/inbox/chats/${encodeURIComponent(chatId)}/assignment`, {
    method: 'PATCH', body: JSON.stringify({ assigned_staff_id: staffId }),
  }, token);
