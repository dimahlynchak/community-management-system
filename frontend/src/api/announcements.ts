import { apiClient } from './client';
import type { Announcement, AnnouncementCreate } from '../types/api';

export async function listAnnouncements(communityId: number): Promise<Announcement[]> {
  const res = await apiClient.get<Announcement[]>(
    `/communities/${communityId}/announcements/`,
  );
  return res.data;
}

export async function createAnnouncement(
  communityId: number,
  payload: AnnouncementCreate,
): Promise<Announcement> {
  const res = await apiClient.post<Announcement>(
    `/communities/${communityId}/announcements/`,
    payload,
  );
  return res.data;
}
