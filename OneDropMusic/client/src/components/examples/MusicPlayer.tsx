import MusicPlayer from '../MusicPlayer';

export default function MusicPlayerExample() {
  return (
    <div className="bg-background">
      <MusicPlayer
        trackTitle="George Duke Trio - It's On"
        trackArtist="Live at Java Jazz Festival"
        thumbnail="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop"
        duration={360}
        onPlayPause={() => console.log('Play/Pause')}
        onNext={() => console.log('Next')}
        onPrevious={() => console.log('Previous')}
      />
    </div>
  );
}
