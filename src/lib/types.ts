/** Row shapes for the tables the UI renders. Source of truth is supabase/migrations. */

export type NowPlayingSource = 'manual' | 'listenbrainz' | 'lastfm';

export interface FavoriteAlbum {
	id: string | number;
	catalogId?: string | null;
	name: string;
	artist: string;
	cover: string;
}
export interface FavoriteArtist {
	id: string | number;
	catalogId?: string | null;
	name: string;
	picture: string;
}

export interface Profile {
	id: string;
	username: string;
	bio: string | null;
	pronouns: string | null;
	website: string | null;
	avatar_url: string | null;
	favorite_albums: (FavoriteAlbum | null)[] | null;
	favorite_artists: (FavoriteArtist | null)[] | null;
	created_at: string;
	// v2 columns (null/undefined until the migration is applied)
	status_text?: string | null;
	status_emoji?: string | null;
	status_updated_at?: string | null;
	status_expires_at?: string | null;
	now_playing_id?: string | null;
	now_playing_source?: NowPlayingSource | null;
	now_playing_at?: string | null;
	listenbrainz_user?: string | null;
	last_seen_at?: string | null;
	username_set?: boolean;
	accent_color?: string | null;
	supporter_since?: string | null;
	supporter_until?: string | null;
}

/** The subset of a profile that is safe and useful to render anywhere (avatars, feeds, chat). */
export type ProfileCard = Pick<
	Profile,
	'id' | 'username' | 'avatar_url' | 'accent_color' | 'supporter_until' | 'status_text' | 'status_emoji'
>;

export type CatalogKind = 'album' | 'artist' | 'track';

export interface CatalogItem {
	id: string;
	mbid: string | null;
	kind: CatalogKind;
	title: string;
	artist_name: string | null;
	artist_id: string | null;
	parent_id: string | null;
	release_date: string | null;
	release_year: number | null;
	genres: string[];
	cover_url: string | null;
	record_type: string | null;
	duration_ms: number | null;
	position: number | null;
	label: string | null;
	track_count: number | null;
	fetched_at: string;
}

export interface AlbumStats {
	catalog_item_id: string;
	rating_count: number;
	avg_rating: number | null;
	review_count: number;
}

export interface Rating {
	id: string;
	user_id: string;
	album_id: string | null;
	catalog_item_id: string | null;
	rating: number;
	review: string | null;
	album_title: string | null;
	album_cover: string | null;
	created_at: string;
	updated_at?: string | null;
	profiles?: ProfileCard;
	like_count?: number;
	liked_by_me?: boolean;
}

export interface TrackRating {
	id: string;
	user_id: string;
	track_id: string | null;
	album_id: string | null;
	catalog_item_id: string | null;
	rating: number;
	review: string | null;
	track_title: string | null;
	track_cover: string | null;
	created_at: string;
	profiles?: ProfileCard;
}

export type ListType = 'albums' | 'songs' | 'mixed';
export interface ListItem {
	id: string;
	catalogId?: string | null;
	type: 'album' | 'track';
	title: string;
	artist: string;
	cover: string;
	albumId: string | null;
}
export interface List {
	id: string;
	user_id: string;
	title: string;
	description: string | null;
	type: ListType;
	items: ListItem[];
	created_at: string;
	updated_at: string;
	profiles?: ProfileCard;
	like_count?: number;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';
export interface Friendship {
	id: string;
	requester_id: string;
	addressee_id: string;
	status: FriendshipStatus;
	blocked_by: string | null;
	created_at: string;
	responded_at: string | null;
}

export interface Message {
	id: string;
	conversation_id: string;
	sender_id: string;
	body: string;
	shared_item_id: string | null;
	created_at: string;
	edited_at: string | null;
	deleted_at: string | null;
	shared_item?: CatalogItem | null;
}

export interface QueueEntry {
	user_id: string;
	catalog_item_id: string;
	note: string | null;
	added_at: string;
	item?: CatalogItem;
	stats?: AlbumStats | null;
}

export type NotificationType =
	| 'follow'
	| 'review_like'
	| 'friend_request'
	| 'friend_accepted'
	| 'message';

export interface Notification {
	id: string;
	user_id: string;
	type: NotificationType;
	from_user_id: string | null;
	ref_id: string | null;
	read: boolean;
	created_at: string;
	from_profile?: ProfileCard | null;
}

export interface FeedEvent {
	kind: 'rating' | 'track_rating' | 'list' | 'friendship';
	id: string;
	actor_id: string;
	actor_username: string;
	actor_avatar: string | null;
	created_at: string;
	payload: Record<string, unknown>;
}
