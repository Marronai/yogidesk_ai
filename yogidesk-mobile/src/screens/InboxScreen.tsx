import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import { assignChatStaff, getInbox, setChatAiReplyActive } from '../services/api';
import { openRechargePortal } from '../services/externalLinks';
import type { InboxChat, StaffMember } from '../types';
import { StaffAssignmentModal } from '../components/StaffAssignmentModal';

interface Props { accessToken: string; onSignOut: () => void }

const isAiActive = (chat: InboxChat) => chat.ai_reply_active ?? chat.metadata?.ai_reply_active ?? !chat.metadata?.ai_paused;
const assignedId = (chat: InboxChat) => chat.assigned_staff_id ?? chat.assigned_agent_id ?? null;

export function InboxScreen({ accessToken, onSignOut }: Props) {
  const [chats, setChats] = useState<InboxChat[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingChat, setEditingChat] = useState<InboxChat | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await getInbox(accessToken);
      setChats(result.chats); setStaff(result.teamMembers);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load inbox.'); }
    finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);
  const updateLocal = (id: string, patch: Partial<InboxChat>) => setChats((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));

  const toggleAi = async (chat: InboxChat, active: boolean) => {
    const previous = isAiActive(chat);
    updateLocal(chat.id, { ai_reply_active: active });
    setPendingIds((ids) => new Set(ids).add(chat.id));
    try { await setChatAiReplyActive(accessToken, chat.id, active); }
    catch (reason) { updateLocal(chat.id, { ai_reply_active: previous }); setError(reason instanceof Error ? reason.message : 'Unable to update AI.'); }
    finally { setPendingIds((ids) => { const next = new Set(ids); next.delete(chat.id); return next; }); }
  };

  const assign = async (staffId: string | null) => {
    const chat = editingChat; setEditingChat(null);
    if (!chat) return;
    const previous = assignedId(chat);
    updateLocal(chat.id, { assigned_staff_id: staffId, assigned_agent_id: staffId });
    try { await assignChatStaff(accessToken, chat.id, staffId); }
    catch (reason) { updateLocal(chat.id, { assigned_staff_id: previous, assigned_agent_id: previous }); setError(reason instanceof Error ? reason.message : 'Unable to assign staff.'); }
  };

  const staffName = (chat: InboxChat) => staff.find((member) => member.id === assignedId(chat))?.name ?? 'Unassigned';
  if (loading) return <View style={styles.center}><ActivityIndicator color="#ea580c" size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>ADMIN MOBILE</Text><Text style={styles.title}>Inbox</Text></View>
        <View style={styles.actions}>
          <Pressable style={styles.recharge} onPress={() => void openRechargePortal().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to open billing.'))}><Text style={styles.rechargeText}>Recharge</Text></Pressable>
          <Pressable onPress={onSignOut}><Text style={styles.signOut}>Sign out</Text></Pressable>
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={chats} keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); void load(); }} tintColor="#ea580c" />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No conversations yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.copy}><Text style={styles.name} numberOfLines={1}>{item.patient_name || item.name || item.phone || 'Patient'}</Text><Text style={styles.message} numberOfLines={2}>{item.last_message || 'No messages yet'}</Text></View>
              <View style={styles.ai}><Text style={styles.aiLabel}>AI reply</Text><Switch value={isAiActive(item)} disabled={pendingIds.has(item.id)} onValueChange={(value) => void toggleAi(item, value)} trackColor={{ false: '#cbd5e1', true: '#fed7aa' }} thumbColor={isAiActive(item) ? '#ea580c' : '#f8fafc'} /></View>
            </View>
            <Pressable style={styles.assignment} onPress={() => setEditingChat(item)}><Text style={styles.assignmentLabel}>Assigned to</Text><Text style={styles.assignmentValue}>{staffName(item)}  ▾</Text></Pressable>
          </View>
        )}
      />
      <StaffAssignmentModal visible={Boolean(editingChat)} staff={staff} selectedId={editingChat ? assignedId(editingChat) : null} onSelect={(id) => void assign(id)} onClose={() => setEditingChat(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  eyebrow: { color: '#ea580c', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, title: { color: '#0f172a', fontSize: 28, fontWeight: '800' },
  actions: { alignItems: 'flex-end', gap: 8 }, recharge: { backgroundColor: '#ea580c', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11 }, rechargeText: { color: '#fff', fontWeight: '800' }, signOut: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  error: { margin: 12, borderRadius: 10, padding: 10, color: '#b91c1c', backgroundColor: '#fef2f2' }, list: { padding: 14, gap: 12, flexGrow: 1 }, empty: { marginTop: 50, textAlign: 'center', color: '#94a3b8' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' }, row: { flexDirection: 'row', gap: 12 }, copy: { flex: 1 }, name: { color: '#0f172a', fontSize: 16, fontWeight: '800' }, message: { color: '#64748b', fontSize: 13, lineHeight: 18, marginTop: 5 },
  ai: { alignItems: 'center' }, aiLabel: { color: '#64748b', fontSize: 10, fontWeight: '700' }, assignment: { borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 14, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' }, assignmentLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700' }, assignmentValue: { color: '#334155', fontSize: 12, fontWeight: '800' },
});
