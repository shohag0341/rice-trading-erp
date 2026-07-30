// Handles all authentication logic: login, logout, session check, role fetching
import { supabase } from './supabase-client.js';

export async function loginUser(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function logoutUser() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

export async function getCurrentSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
}

export async function getCurrentUserProfile() {
    const session = await getCurrentSession();
    if (!session) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (error) throw error;
    return data;
}

export async function sendPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password.html'
    });
    if (error) throw error;
}
