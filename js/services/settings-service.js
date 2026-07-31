// Handles business settings and user management
import { supabase } from './supabase-client.js';

// ---------- Business Settings ----------
export async function getBusinessSettings() {
    const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .limit(1)
        .single();

    if (error) throw error;
    return data;
}

export async function updateBusinessSettings(id, settingsData, userId) {
    const { data, error } = await supabase
        .from('business_settings')
        .update({ ...settingsData, updated_by: userId })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ---------- User Management (Admin only) ----------
export async function getAllUsers() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

export async function updateUserRole(userId, newRole) {
    const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function toggleUserActiveStatus(userId, isActive) {
    const { data, error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}
