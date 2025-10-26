import VideoCard from '../VideoCard';

export default function VideoCardExample() {
  const mockVideo = {
    id: '1',
    title: 'How to Master Music Production in 2024',
    thumbnail: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop',
    duration: '12:45',
    views: 125000,
    channel: 'Music Production Hub',
    uploadedAt: '2 weeks ago',
  };

  return <VideoCard video={mockVideo} onClick={() => console.log('Video clicked')} />;
}
