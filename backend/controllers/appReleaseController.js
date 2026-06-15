const { supabase } = require('../config/supabase');

exports.getLatestAppRelease = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('app_system_releases')
      .select('apk_url, version_code')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ apk_url: '', version_code: '' });
      throw error;
    }

    return res.status(200).json(data || { apk_url: '', version_code: '' });
  } catch (error) {
    console.error('Latest app release fetch failed:', error.message || error);
    return res.status(500).json({ apk_url: '', version_code: '' });
  }
};
