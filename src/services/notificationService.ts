import { NotificationItem, NotificationType } from '../types/notification';
import { ApiResponse, simulateNetworkDelay, IS_DEMO_MODE } from './apiClient';
import { supabase, isSupabaseConfigured } from './supabaseClient';

class NotificationService {
  private notifications: NotificationItem[] = [];

  /**
   * Khusus isolasi unit test offline
   */
  seedTestFixtures(fixtures: { notifications?: NotificationItem[] }): void {
    if (fixtures.notifications) this.notifications = [...fixtures.notifications];
  }

  async getNotifications(userId?: string): Promise<ApiResponse<NotificationItem[]>> {
    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Supabase belum terkonfigurasi untuk mode operasional.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
          data: [],
        };
      }
      try {
        let query = supabase.from('notifications').select('*').order('created_at', { ascending: false });
        if (userId) {
          query = query.eq('recipient_user_id', userId);
        }
        const { data, error } = await query;
        if (error) {
          return { success: false, message: `Gagal memuat notifikasi: ${error.message}`, data: [] };
        }
        const list: NotificationItem[] = (data || []).map((n: any) => ({
          id: n.id,
          recipientUserId: n.recipient_user_id,
          type: n.type,
          title: n.title,
          body: n.body,
          referenceType: n.reference_type,
          referenceId: n.reference_id,
          readAt: n.read ? n.created_at : null,
          createdAt: n.created_at,
        }));
        return { success: true, data: list };
      } catch (err: any) {
        return { success: false, message: `Gagal memuat notifikasi: ${err.message || err}`, data: [] };
      }
    }

    await simulateNetworkDelay(200);
    let list = [...this.notifications];
    if (userId) {
      list = list.filter((n) => n.recipientUserId === userId);
    }
    return { success: true, data: list };
  }

  async markAsRead(id: string): Promise<ApiResponse<boolean>> {
    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Supabase belum terkonfigurasi untuk mode operasional.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
        };
      }
      try {
        const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
        if (error) {
          return { success: false, message: `Gagal menandai notifikasi dibaca: ${error.message}` };
        }
        return { success: true, data: true };
      } catch (err: any) {
        return { success: false, message: `Gagal menandai notifikasi dibaca: ${err.message || err}` };
      }
    }

    await simulateNetworkDelay(150);
    const item = this.notifications.find((n) => n.id === id);
    if (item) {
      item.readAt = new Date().toISOString();
    }
    return { success: true, data: true };
  }

  async markAllAsRead(userId: string): Promise<ApiResponse<boolean>> {
    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Supabase belum terkonfigurasi untuk mode operasional.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
        };
      }
      try {
        const { error } = await supabase.from('notifications').update({ read: true }).eq('recipient_user_id', userId);
        if (error) {
          return { success: false, message: `Gagal menandai semua notifikasi dibaca: ${error.message}` };
        }
        return { success: true, data: true, message: 'Semua notifikasi ditandai telah dibaca' };
      } catch (err: any) {
        return { success: false, message: `Gagal menandai semua notifikasi dibaca: ${err.message || err}` };
      }
    }

    await simulateNetworkDelay(200);
    const now = new Date().toISOString();
    this.notifications.forEach((n) => {
      if (n.recipientUserId === userId && !n.readAt) {
        n.readAt = now;
      }
    });
    return { success: true, data: true, message: 'Semua notifikasi ditandai telah dibaca' };
  }

  async createNotification(item: {
    recipientUserId: string;
    type: NotificationType;
    title: string;
    body: string;
    referenceType?: 'DL' | 'ABSENCE' | 'LEAVE' | 'CORRECTION' | 'SECURITY';
    referenceId?: string;
  }): Promise<ApiResponse<NotificationItem>> {
    const now = new Date().toISOString();
    const id = `notif-${Date.now().toString().slice(-6)}`;

    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Supabase belum terkonfigurasi untuk mode operasional.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
        };
      }
      try {
        const { data, error } = await supabase
          .from('notifications')
          .insert({
            id,
            recipient_user_id: item.recipientUserId,
            type: item.type,
            title: item.title,
            body: item.body,
            reference_type: item.referenceType || null,
            reference_id: item.referenceId || null,
            read: false,
            created_at: now,
          })
          .select()
          .single();

        if (error) {
          return { success: false, message: `Gagal membuat notifikasi: ${error.message}` };
        }
        if (data) {
          const newItem: NotificationItem = {
            id: data.id,
            recipientUserId: data.recipient_user_id,
            type: data.type,
            title: data.title,
            body: data.body,
            referenceType: data.reference_type,
            referenceId: data.reference_id,
            readAt: null,
            createdAt: data.created_at,
          };
          return { success: true, data: newItem };
        }
        return { success: false, message: 'Gagal membuat notifikasi' };
      } catch (err: any) {
        return { success: false, message: `Gagal membuat notifikasi: ${err.message || err}` };
      }
    }

    const newItem: NotificationItem = {
      id,
      recipientUserId: item.recipientUserId,
      type: item.type as any,
      title: item.title,
      body: item.body,
      referenceType: item.referenceType,
      referenceId: item.referenceId,
      readAt: null,
      createdAt: now,
    };
    this.notifications.unshift(newItem);
    return { success: true, data: newItem };
  }
}

export const notificationService = new NotificationService();
