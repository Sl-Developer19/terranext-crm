'use client';

import { AudioLines, Pause, Play, RotateCcw } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

import { getSessionPlaybackManifest } from '../actions/get-session-audio';
import { formatDuration, locatePlaybackPosition, totalPlaybackDurationSeconds } from '../logic';
import type { PlaybackChunk } from '../schema';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

/**
 * Plays back a finalized session's recording as one continuous timeline,
 * even though it's stored as several separately-encoded ~10-minute chunk
 * files (long-session support, see `CHUNK_DURATION_SECONDS`). A single
 * `<audio>` element is reused across chunks: its `src` swaps to the next
 * chunk's short-lived signed URL on `ended` (auto-advance) or when a seek
 * lands in a different chunk (`locatePlaybackPosition`), and playback
 * intent (`isPlaying`) carries across that swap so scrubbing across a chunk
 * boundary feels like one recording, not several.
 *
 * URLs are fetched fresh on mount from `getSessionPlaybackManifest` — never
 * stored, never passed in from the server component — and expire in 15
 * minutes (matches the participants-document download pattern). A review
 * session longer than that will need a page refresh; that trade-off is
 * intentional (short-lived access over a permanent link).
 */
export function SessionAudioPlayer({ sessionId }: { sessionId: string }) {
  const [loadState, setLoadState] = React.useState<LoadState>('loading');
  const [chunks, setChunks] = React.useState<PlaybackChunk[]>([]);
  const [chunkIndex, setChunkIndex] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTimeInChunk, setCurrentTimeInChunk] = React.useState(0);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const pendingSeekSecRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const outcome = await getSessionPlaybackManifest({ sessionId });
      if (cancelled) return;
      if (!outcome.ok) {
        setLoadState('error');
        return;
      }
      if (outcome.data.chunks.length === 0) {
        setLoadState('empty');
        return;
      }
      setChunks(outcome.data.chunks);
      setLoadState('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const activeChunk = chunks[chunkIndex] ?? null;
  const totalDuration = totalPlaybackDurationSeconds(chunks);
  const globalTime = activeChunk ? activeChunk.startOffsetSec + currentTimeInChunk : 0;

  function handlePlayPause() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }

  function handleSeek(targetGlobalSec: number) {
    const located = locatePlaybackPosition(chunks, targetGlobalSec);
    if (!located) return;
    if (located.index === chunkIndex) {
      if (audioRef.current) audioRef.current.currentTime = located.offsetWithinChunkSec;
      setCurrentTimeInChunk(located.offsetWithinChunkSec);
    } else {
      pendingSeekSecRef.current = located.offsetWithinChunkSec;
      setChunkIndex(located.index);
      setCurrentTimeInChunk(located.offsetWithinChunkSec);
    }
  }

  function handleLoadedMetadata() {
    const audio = audioRef.current;
    if (!audio) return;
    if (pendingSeekSecRef.current !== null) {
      audio.currentTime = pendingSeekSecRef.current;
      pendingSeekSecRef.current = null;
    }
    if (isPlaying) void audio.play();
  }

  function handleEnded() {
    if (chunkIndex < chunks.length - 1) {
      setChunkIndex((i) => i + 1);
      setCurrentTimeInChunk(0);
      // `isPlaying` intentionally untouched — if it was true, the next
      // chunk's `onLoadedMetadata` (above) resumes playback automatically.
    } else {
      setIsPlaying(false);
    }
  }

  function handleReplay() {
    pendingSeekSecRef.current = 0;
    setChunkIndex(0);
    setCurrentTimeInChunk(0);
    setIsPlaying(false);
  }

  if (loadState === 'loading') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recording</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading the saved audio…</p>
        </CardContent>
      </Card>
    );
  }

  if (loadState === 'error') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recording</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Could not load the saved audio. Reload the page to try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loadState === 'empty' || !activeChunk) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={AudioLines}
            headline="No audio available"
            explanation="Recorded audio appears here once at least one segment has finished uploading."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recording</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- classroom voice recording, no captions track exists */}
        <audio
          ref={audioRef}
          src={activeChunk.url}
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={() => setCurrentTimeInChunk(audioRef.current?.currentTime ?? 0)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
          className="hidden"
        />
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={handlePlayPause}
          >
            {isPlaying ? <Pause aria-hidden /> : <Play aria-hidden />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Replay from the beginning"
            onClick={handleReplay}
          >
            <RotateCcw aria-hidden />
          </Button>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {formatDuration(globalTime)} / {formatDuration(totalDuration)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(totalDuration, 1)}
          step={1}
          value={Math.min(globalTime, totalDuration)}
          onChange={(e) => handleSeek(Number(e.target.value))}
          aria-label="Seek recording"
          className="h-1.5 w-full cursor-pointer accent-gold"
        />
        {chunks.length > 1 ? (
          <p className="text-xs text-muted-foreground">
            Segment {chunkIndex + 1} of {chunks.length}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
