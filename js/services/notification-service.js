// Handles fetching and managing notifications
import { supabase } from './supabase-client.js';

export async function getUnreadNotifications(userId) {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${userId},user_id.is.null`)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) throw error;
    return data;
}

export async function getUnreadCount(userId) {
    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${userId},user_id.is.null`)
        .eq('is_read', false);

    if (error) throw error;
    return count || 0;
}

export async function markNotificationRead(notificationId) {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

    if (error) throw error;
}
