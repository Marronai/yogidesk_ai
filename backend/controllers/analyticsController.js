/**
 * Analytics Controller - Dashboard metrics and historical data aggregation
 */

const normalizeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

/**
 * Get template status aggregation (Approved, Rejected, Pending)
 * Queries public.submitted_meta_templates grouped by status
 */
const getTemplateStatusAggregation = async (req, res, db) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId parameter' });
    }

    // Query template status counts grouped by status field
    const { data, error } = await db
      .from('submitted_meta_templates')
      .select('status')
      .eq('user_id', userId);

    if (error) throw error;

    // Aggregate by status
    const statusMap = {
      APPROVED: 0,
      REJECTED: 0,
      PENDING: 0,
      PENDING_APPROVAL: 0,
    };

    (data || []).forEach((template) => {
      const status = String(template.status || '').toUpperCase();
      if (status === 'APPROVED') statusMap.APPROVED += 1;
      else if (status === 'REJECTED') statusMap.REJECTED += 1;
      else if (status === 'PENDING_APPROVAL' || status === 'PENDING') statusMap.PENDING += 1;
    });

    return res.json({
      success: true,
      data: {
        approved: statusMap.APPROVED,
        rejected: statusMap.REJECTED,
        pending: statusMap.PENDING + statusMap.PENDING_APPROVAL,
        total: (data || []).length,
      },
    });
  } catch (error) {
    console.error('Template aggregation error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to aggregate template status',
    });
  }
};

/**
 * Get 7-day message sent history with proper timezone handling
 * Accounts for Indian Standard Time (IST/Asia/Kolkata)
 * Returns data grouped by date with day labels
 */
const getMessageSentHistory = async (req, res, db) => {
  try {
    const userId = req.query.userId;
    const timezone = req.query.timezone || 'Asia/Kolkata';
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId parameter' });
    }

    // Calculate 7-day window in UTC
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startISO = sevenDaysAgo.toISOString();
    const endISO = now.toISOString();

    // Query inbox_messages for the past 7 days with successful delivery status
    const { data, error } = await db
      .from('inbox_messages')
      .select('id,created_at,status')
      .eq('workspace_id', userId)
      .eq('from_me', true)
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .in('status', ['SENT', 'sent', 'DELIVERED', 'delivered', 'READ', 'read', 'COMPLETED', 'completed']);

    if (error) throw error;

    // Build day labels and aggregate by date (in IST)
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dateMap = {};
    const dateKeys = [];

    // Generate 7 date keys based on IST
    for (let i = -6; i <= 0; i++) {
      const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      // Convert to IST midnight for consistent date grouping
      const istDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      istDate.setHours(0, 0, 0, 0);
      
      const dateKey = istDate.toISOString().split('T')[0];
      const dayLabel = dayLabels[istDate.getDay()];
      
      dateMap[dateKey] = {
        key: dateKey,
        label: dayLabel,
        fullLabel: istDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        total: 0,
      };
      dateKeys.push(dateKey);
    }

    // Aggregate messages by date (converting created_at to IST date)
    (data || []).forEach((message) => {
      if (!message.created_at) return;
      
      const messageDate = new Date(message.created_at);
      const istDate = new Date(messageDate.toLocaleString('en-US', { timeZone: timezone }));
      istDate.setHours(0, 0, 0, 0);
      
      const dateKey = istDate.toISOString().split('T')[0];
      if (dateMap[dateKey]) {
        dateMap[dateKey].total += 1;
      }
    });

    // Return data sorted by date
    const result = dateKeys.map((key) => dateMap[key]);
    const totalMessages = result.reduce((sum, day) => sum + day.total, 0);

    return res.json({
      success: true,
      data: result,
      totalMessages,
    });
  } catch (error) {
    console.error('Message history aggregation error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to aggregate message history',
    });
  }
};

/**
 * Get comprehensive dashboard metrics
 * Combines template counts, message history, and other KPIs
 */
const getDashboardMetrics = async (req, res, db) => {
  try {
    const userId = req.query.userId;
    const timezone = req.query.timezone || 'Asia/Kolkata';
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId parameter' });
    }

    // Get template aggregation
    const { data: templates, error: templatesError } = await db
      .from('submitted_meta_templates')
      .select('status')
      .eq('user_id', userId);

    // Get 7-day message history
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: messages, error: messagesError } = await db
      .from('inbox_messages')
      .select('id,created_at,status')
      .eq('workspace_id', userId)
      .eq('from_me', true)
      .gte('created_at', sevenDaysAgo.toISOString())
      .lte('created_at', now.toISOString())
      .in('status', ['SENT', 'sent', 'DELIVERED', 'delivered', 'READ', 'read', 'COMPLETED', 'completed']);

    if (templatesError) throw templatesError;
    if (messagesError) throw messagesError;

    // Aggregate template status
    const statusMap = {
      APPROVED: 0,
      REJECTED: 0,
      PENDING: 0,
    };

    (templates || []).forEach((template) => {
      const status = String(template.status || '').toUpperCase();
      if (status === 'APPROVED') statusMap.APPROVED += 1;
      else if (status === 'REJECTED') statusMap.REJECTED += 1;
      else if (status === 'PENDING_APPROVAL' || status === 'PENDING') statusMap.PENDING += 1;
    });

    // Build 7-day message history
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dateMap = {};
    const dateKeys = [];

    for (let i = -6; i <= 0; i++) {
      const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const istDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      istDate.setHours(0, 0, 0, 0);
      
      const dateKey = istDate.toISOString().split('T')[0];
      const dayLabel = dayLabels[istDate.getDay()];
      
      dateMap[dateKey] = {
        key: dateKey,
        label: dayLabel,
        fullLabel: istDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        total: 0,
      };
      dateKeys.push(dateKey);
    }

    (messages || []).forEach((message) => {
      if (!message.created_at) return;
      
      const messageDate = new Date(message.created_at);
      const istDate = new Date(messageDate.toLocaleString('en-US', { timeZone: timezone }));
      istDate.setHours(0, 0, 0, 0);
      
      const dateKey = istDate.toISOString().split('T')[0];
      if (dateMap[dateKey]) {
        dateMap[dateKey].total += 1;
      }
    });

    const messageHistory = dateKeys.map((key) => dateMap[key]);
    const totalMessages = messageHistory.reduce((sum, day) => sum + day.total, 0);

    return res.json({
      success: true,
      data: {
        templates: {
          approved: statusMap.APPROVED,
          rejected: statusMap.REJECTED,
          pending: statusMap.PENDING,
          total: (templates || []).length,
        },
        messageHistory,
        messageHistory_total: totalMessages,
      },
    });
  } catch (error) {
    console.error('Dashboard metrics aggregation error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to aggregate dashboard metrics',
    });
  }
};

module.exports = {
  getTemplateStatusAggregation,
  getMessageSentHistory,
  getDashboardMetrics,
};
