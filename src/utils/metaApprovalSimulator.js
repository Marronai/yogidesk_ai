import { supabase } from '../supabaseClient';

/**
 * Simulates Meta's webhook approval process
 * After 5 seconds, changes template status from PENDING to APPROVED
 */
export const simulateMetaApproval = async (templateId, userId) => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('whatsapp_templates')
          .update({ status: 'APPROVED' })
          .eq('id', templateId)
          .eq('user_id', userId)
          .select();

        if (error) {
          console.error('Meta approval simulation failed:', error);
          resolve({ success: false, error });
        } else {
          console.log('✅ Template automatically approved by Meta simulation:', data);
          resolve({ success: true, data });
        }
      } catch (err) {
        console.error('Meta approval error:', err);
        resolve({ success: false, error: err });
      }
    }, 4000); // 4-second delay to simulate Meta's processing
  });
};

/**
 * Toast notification helper
 */
export const showToast = (message, type = 'info') => {
  // This can be enhanced to use a proper toast library
  console.log(`[${type.toUpperCase()}] ${message}`);
};
