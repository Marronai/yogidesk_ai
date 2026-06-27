import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StaffMember } from '../types';

interface Props {
  visible: boolean;
  staff: StaffMember[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}

export function StaffAssignmentModal({ visible, staff, selectedId, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Assign conversation</Text>
          {[{ id: '', name: 'Unassigned', email: null, status: 'ACTIVE' }, ...staff].map((member) => {
            const id = member.id || null;
            const selected = selectedId === id;
            return (
              <Pressable key={member.id || 'unassigned'} style={[styles.option, selected && styles.selected]} onPress={() => onSelect(id)}>
                <Text style={styles.name}>{member.name || member.email || 'Staff member'}</Text>
                {selected ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            );
          })}
          <Pressable style={styles.cancel} onPress={onClose}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,.42)' },
  sheet: { padding: 22, paddingBottom: 34, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  option: { minHeight: 50, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selected: { backgroundColor: '#fff7ed' }, name: { color: '#334155', fontWeight: '600' }, check: { color: '#ea580c', fontSize: 18 },
  cancel: { alignItems: 'center', padding: 14, marginTop: 8 }, cancelText: { color: '#64748b', fontWeight: '700' },
});
