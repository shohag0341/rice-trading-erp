// Handles the logged-in user's own profile (personal info + avatar)
import { supabase } from './supabase-client.js';

export async function updateOwnProfile(userId, profileData) {
    const { data, error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function uploadAvatar(userId, file) {
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true, cacheControl: '3600' });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

    // Cache-busting query param so the browser doesn't keep showing the old photo
    const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { data, error } = await supabase
        .from('profiles')
        .update({ photo_url: photoUrl })
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}
