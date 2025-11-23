'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useState, useEffect } from 'react';

// Cloud image options with their relative sizes
const cloudImages = [
  { src: '/cloud-1.png', scale: 1.2 },
  { src: '/cloud-2.png', scale: 0.7 },
  { src: '/cloud-3.png', scale: 1.3 },
  { src: '/cloud-4.png', scale: 0.6 },
  { src: '/cloud-group-1.png', scale: 1.5 },
  { src: '/cloud-group-2.png', scale: 1.4 },
];

// Generate cloud data with random positions and animation parameters
const generateClouds = (count) => {
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const cloudImage = cloudImages[Math.floor(Math.random() * cloudImages.length)];
    const baseSize = Math.random() * 100 + 100; // Random base size between 100-200px
    
    clouds.push({
      id: i,
      image: cloudImage.src,
      width: baseSize * cloudImage.scale,
      initialX: Math.random() * 100 - 20, // Random starting position -20% to 100%
      initialY: Math.random() * 80, // Random Y position 0-80%
      duration: Math.random() * 100 + 120, // Random duration 120-220s (2-3.5 minutes)
      delay: Math.random() * 30, // Random delay 0-30s
      opacity: Math.random() * 0.3 + 0.5, // Random opacity 0.5-0.8
    });
  }
  return clouds;
};

export default function AnimatedBackground({ fadeOut = false }) {
  const [clouds, setClouds] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Generate clouds only on client side to avoid hydration mismatch
    setClouds(generateClouds(15));
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <motion.div 
      className="fixed inset-0 overflow-hidden pointer-events-none"
      animate={{ opacity: fadeOut ? 0 : 1 }}
      transition={{ duration: 1.5, ease: 'easeOut' }}
    >
      {clouds.map((cloud) => (
        <motion.div
          key={cloud.id}
          className="absolute"
          style={{
            width: cloud.width,
            top: `${cloud.initialY}%`,
            left: `${cloud.initialX}%`,
            opacity: cloud.opacity,
          }}
          animate={{
            x: ['0vw', '120vw'],
          }}
          transition={{
            duration: cloud.duration,
            delay: cloud.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <Image
            src={cloud.image}
            alt="cloud"
            width={500}
            height={300}
            className="w-full h-auto"
            priority={false}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

