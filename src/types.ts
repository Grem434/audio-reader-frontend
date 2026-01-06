export type Book = {
  id: string;
  title: string;
  created_at: string;
};

export type Chapter = {
  id: string;
  index_in_book: number;
  title: string | null;
  audio_path: string | null;
};

export type Bookmark = {
  id: string;
  book_id: string;
  chapter_id: string;
  position_seconds: number;
  updated_at: string;
};

export type ContinuePayload = {
  bookmark: Bookmark | null;
  chapter: (Chapter & { audio_path: string | null }) | null;
  voice?: string;
  style?: string;
};
