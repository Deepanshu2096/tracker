import { supabase } from '@/integrations/supabase/client';
import { create } from 'zustand';

// Types based on your API structure
export interface TeamMember {
  id: string;
  name: string | null;
  email: string | null; 
  user_id: string; 
  org_id: string | null; 
  role_id: string; 
  status: string | null
  user_roles:{
    role: string
  }
}

interface TeamState {
  // State
  loading: boolean;
  error: string | null;
  profiles: TeamMember[];

  // Actions
  clearError: () => void;
  getProfiles: (orgId: string) => Promise<void>;
  getActiveAnnotators: (orgId: string) => Promise<TeamMember[]>;
  updateMemberStatus: (memberId: string, status: string) => Promise<void>;
  sendInvite: (email: string, role: string, name: string, orgId: string) => Promise<{success: boolean, message: string}>;
  // Project team (ACL) helpers
  getProjectMembers: (orgId: string, projectId: string) => Promise<TeamMember[]>;
  addMembersToProject: (orgId: string, projectId: string, userIds: string[]) => Promise<void>;
  removeMemberFromProject: (orgId: string, projectId: string, userId: string) => Promise<void>;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  // Initial state
  profiles: [],
  loading: false,
  error: null,

  clearError: () => {
    set({ error: null });
  },

  getProfiles: async (orgId: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, 
          name, 
          email, 
          user_id, 
          org_id, 
          role, 
          status,
          user_roles!inner(
            role
          )
        `)
        .eq('org_id', orgId)
        .order('name', { ascending: true });
        

      if (error) {
        console.log('faile to fetch profiles', error);
        throw error;
      }

      set({
        profiles: data || [],
        loading: false
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch profiles',
        loading: false
      });
    }
  },

  getActiveAnnotators: async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, 
          name, 
          email, 
          user_id, 
          org_id, 
          role, 
          status,
          user_roles!inner(
            role
          )
        `)
        .eq('org_id', orgId)
        .eq('status', 'active')
        .eq('user_roles.role', 'annotator')
        .order('name', { ascending: true });

      if (error) {
        console.error('Failed to fetch active annotators:', error);
        throw error;
      }

      return data || [];
    } catch (error: any) {
      console.error('Error getting active annotators:', error);
      return [];
    }
  },

  updateMemberStatus: async (memberId: string, status: string) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', memberId);

      if (error) {
        throw error;
      }

      // Update the local state
      set((state) => ({
        profiles: state.profiles.map(profile =>
          profile.id === memberId
            ? { ...profile, status }
            : profile
        ),
        loading: false
      }));
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update member status',
        loading: false
             });
     }
   },

   sendInvite: async (email: string, role: string, name: string, orgId: string) => {
     set({ loading: true, error: null });
     try {
       // Insert invite into the invites table
       const { data, error } = await supabase
         .from('invites')
         .insert({ 
           email, 
           role: role as "manager" | "annotator" | "reviewer" | "admin", 
           org_id: orgId,
           name 
         })
         .select()
         .single();

       if (error) {
        console.log(error);
         throw error;
       }

       // Generate invite link
       const inviteLink = `${window.location.origin}/invite/${data.token}`;
       console.log('inviteLink', inviteLink);
       
       // Call edge function to send email
       const { error: emailError, response } = await supabase.functions.invoke('send-invite', {
         body: {
           name,
           email,
           role,
           inviteLink
         }
       });

       
       if (emailError) {
         console.error('Failed to send invite email:', emailError);
         try {
          const { data, error } = await supabase
          .from('invites')
          .delete().eq('email', email)
         } catch (error) {
          console.log('Failed to delete the invite');
         }
         // Don't throw here - invite was created successfully, just email failed
         return { success: false, message: 'Failed to send invite email' }
       }

       // Dummy function call - replace with actual edge function
       console.log(`Sending invite email to ${email} with link: ${inviteLink}`);
       console.log(`Invite details: Name: ${name}, Role: ${role}`);
       set({ loading: false });
       return { success: true, message: 'Invitation sent Successfully' }
     } catch (error: any) {
       set({
         error: error.message || 'Failed to send invite',
         loading: false
       });
       throw error;
     }
   },

  // Project team (ACL) helpers
  getProjectMembers: async (orgId: string, projectId: string) => {
    try {
      // 1) Fetch user_ids from ACL for this project
      const { data: aclRows, error: aclError } = await supabase
        .from('resource_acl')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('resource_type', 'project')
        .eq('resource_id', projectId);

      if (aclError) {
        throw aclError;
      }

      const userIds = (aclRows || []).map(r => r.user_id);
      if (userIds.length === 0) {
        return [];
      }

      // 2) Fetch profiles for those user_ids
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          user_id,
          org_id,
          role,
          status,
          user_roles!inner(
            role
          )
        `)
        .in('user_id', userIds)
        .order('name', { ascending: true });

      if (profilesError) {
        throw profilesError;
      }

      return (profilesData as unknown as TeamMember[]) || [];
    } catch (error) {
      console.error('Error fetching project members:', error);
      return [];
    }
  },

  addMembersToProject: async (orgId: string, projectId: string, userIds: string[]) => {
    if (!userIds || userIds.length === 0) return;
    set({ loading: true, error: null });
    try {
      const rows = userIds.map(userId => ({
        id: crypto.randomUUID(),
        org_id: orgId,
        resource_id: projectId,
        resource_type: 'project',
        user_id: userId,
      }));

      const { error } = await supabase
        .from('resource_acl')
        .insert(rows);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to add members to project' });
    } finally {
      set({ loading: false });
    }
  },

  removeMemberFromProject: async (orgId: string, projectId: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('resource_acl')
        .delete()
        .eq('org_id', orgId)
        .eq('resource_type', 'project')
        .eq('resource_id', projectId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to remove member from project' });
    } finally {
      set({ loading: false });
    }
  },
 }));
