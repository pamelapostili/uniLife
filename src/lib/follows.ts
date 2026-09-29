import { supabase } from "./supabase";

export async function isFollowing(followerId: string, followedId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("followed_id", followedId)
    .maybeSingle();

  if (error) {
    console.warn("[follows.select] ", error.message);
    return false;
  }

  return !!data;
}

export async function fetchFollowingSet(followerId: string, followedIds: string[]): Promise<Set<string>> {
  if (followedIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", followerId)
    .in("followed_id", followedIds);

  if (error) {
    console.warn("[follows.select bulk] ", error.message);
    return new Set();
  }

  return new Set((data ?? []).map((row: any) => row.followed_id));
}

export async function follow(followerId: string, followedId: string) {
  return supabase.from("follows").insert({ follower_id: followerId, followed_id: followedId });
}

export async function unfollow(followerId: string, followedId: string) {
  return supabase.from("follows").delete().eq("follower_id", followerId).eq("followed_id", followedId);
}
