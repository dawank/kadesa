import { AuditLogItem, SecurityEventItem, AuditEventType } from '../types/audit';
import { mockAuditLogs, mockSecurityEvents } from '../mock/mockData';
import { ApiResponse, simulateNetworkDelay, IS_DEMO_MODE } from './apiClient';
import { supabase, isSupabaseConfigured } from './supabaseClient';

class AuditService {
  private auditLogs: AuditLogItem[] = [...mockAuditLogs];
  private securityEvents: SecurityEventItem[] = [...mockSecurityEvents];

  getCachedAuditLogs(): AuditLogItem[] {
    return this.auditLogs;
  }

  getCachedSecurityEvents(): SecurityEventItem[] {
    return this.securityEvents;
  }

  async getAuditLogs(filters?: {
    eventType?: AuditEventType | 'ALL';
    actorId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<AuditLogItem[]>> {
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
        let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
        if (filters?.eventType && filters.eventType !== 'ALL') {
          query = query.eq('action', filters.eventType);
        }
        if (filters?.actorId) {
          query = query.eq('actor_user_id', filters.actorId);
        }
        if (filters?.startDate) {
          query = query.gte('created_at', `${filters.startDate}T00:00:00Z`);
        }
        if (filters?.endDate) {
          query = query.lte('created_at', `${filters.endDate}T23:59:59Z`);
        }

        const { data, error } = await query;
        if (error) {
          return {
            success: false,
            message: `Gagal memuat log audit: ${error.message}`,
            data: [],
          };
        }
        const list: AuditLogItem[] = (data || []).map((d: any) => ({
          id: d.id,
          actorUserId: d.actor_user_id || 'system',
          actorNama: d.actor_name || 'Sistem',
          actorRole: d.actor_role || 'SISTEM',
          eventType: d.action as AuditEventType,
          entityType: d.entity_type,
          entityId: d.entity_id,
          beforeData: d.details?.beforeData,
          afterData: d.details?.afterData,
          reason: d.details?.reason,
          ipAddress: d.ip_address,
          userAgent: d.user_agent,
          createdAt: d.created_at,
        }));
        if (!filters || ((!filters.eventType || filters.eventType === 'ALL') && !filters.actorId && !filters.startDate && !filters.endDate)) {
          this.auditLogs = list;
        }
        return { success: true, data: list };
      } catch (err: any) {
        return {
          success: false,
          message: `Gagal memuat log audit: ${err.message || 'Kesalahan database'}`,
          data: [],
        };
      }
    }

    await simulateNetworkDelay(250);
    let list = [...this.auditLogs];

    if (filters?.eventType && filters.eventType !== 'ALL') {
      list = list.filter((l) => l.eventType === filters.eventType);
    }
    if (filters?.actorId) {
      list = list.filter((l) => l.actorUserId === filters.actorId);
    }
    if (filters?.startDate) {
      list = list.filter((l) => l.createdAt.split('T')[0] >= filters.startDate!);
    }
    if (filters?.endDate) {
      list = list.filter((l) => l.createdAt.split('T')[0] <= filters.endDate!);
    }

    return { success: true, data: list };
  }

  async getSecurityEvents(): Promise<ApiResponse<SecurityEventItem[]>> {
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
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .in('action', ['LOGIN_FAILED', 'GEOFENCE_VIOLATION', 'TIME_ANOMALY', 'BRUTE_FORCE_ATTEMPT', 'UNAUTHORIZED_ACCESS'])
          .order('created_at', { ascending: false });

        if (error) {
          return {
            success: false,
            message: `Gagal memuat peringatan keamanan: ${error.message}`,
            data: [],
          };
        }
        const list: SecurityEventItem[] = (data || []).map((d: any) => ({
          id: d.id,
          severity: d.action === 'BRUTE_FORCE_ATTEMPT' || d.action === 'UNAUTHORIZED_ACCESS' ? 'CRITICAL' : d.action === 'GEOFENCE_VIOLATION' ? 'HIGH' : 'MEDIUM',
          eventType: d.action,
          actorNama: d.actor_name || 'Sistem Keamanan',
          metadata: d.details || {},
          state: 'NEW',
          createdAt: d.created_at,
        }));
        return { success: true, data: list };
      } catch (err: any) {
        return {
          success: false,
          message: `Gagal memuat peringatan keamanan: ${err.message || 'Kesalahan database'}`,
          data: [],
        };
      }
    }

    await simulateNetworkDelay(200);
    return { success: true, data: [...this.securityEvents] };
  }

  async recordAuditEvent(event: Omit<AuditLogItem, 'id' | 'createdAt'>): Promise<void> {
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { error: rpcErr } = await supabase.rpc('record_system_audit_event', {
          p_action: event.eventType,
          p_entity_type: event.entityType,
          p_entity_id: event.entityId,
          p_details: {
            actorUserId: event.actorUserId,
            actorNama: event.actorNama,
            actorRole: event.actorRole,
            beforeData: event.beforeData,
            afterData: event.afterData,
            reason: event.reason,
            ipAddress: event.ipAddress || null,
            userAgent: event.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : null),
          },
        });
        if (rpcErr) {
          // If RPC returns error, attempt fallback direct insert if permitted
          try {
            await supabase.from('audit_logs').insert({
              id: `aud-${Date.now().toString().slice(-4)}`,
              actor_user_id: event.actorUserId && event.actorUserId.startsWith('usr-') ? event.actorUserId : null,
              actor_name: event.actorNama,
              actor_role: event.actorRole,
              action: event.eventType,
              entity_type: event.entityType,
              entity_id: event.entityId,
              details: {
                beforeData: event.beforeData,
                afterData: event.afterData,
                reason: event.reason,
              },
              ip_address: event.ipAddress || null,
              user_agent: event.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : null),
            });
          } catch {
            // Silently ignore if direct insert is disabled by RLS
          }
        }
      } catch (err) {
        console.warn('Supabase recordAuditEvent error:', err);
      }
    }

    const newLog: AuditLogItem = {
      ...event,
      id: `aud-${Date.now().toString().slice(-4)}`,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(newLog);
  }
}

export const auditService = new AuditService();
