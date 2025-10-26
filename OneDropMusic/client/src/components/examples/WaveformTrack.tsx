import WaveformTrack from '../WaveformTrack';

export default function WaveformTrackExample() {
  return (
    <div className="bg-background p-6 space-y-2">
      <WaveformTrack
        label="Vocals"
        color="#60a5fa"
        onSoloToggle={() => console.log('Vocals solo toggled')}
        onMuteToggle={() => console.log('Vocals mute toggled')}
        onVolumeChange={(vol) => console.log('Vocals volume:', vol)}
      />
      <WaveformTrack
        label="Drums"
        color="#a78bfa"
        onSoloToggle={() => console.log('Drums solo toggled')}
        onMuteToggle={() => console.log('Drums mute toggled')}
        onVolumeChange={(vol) => console.log('Drums volume:', vol)}
      />
    </div>
  );
}
