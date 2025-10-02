import React from 'react';
import Asteroid3DViewer from '../components/Asteroid3DViewer';
import Nav from '../components/nav';

export default function Home() {      
   return (
    <>
    <div className="relative h-screen w-full overflow-hidden">
    <video
        src="../public/gifMeteoro.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover">
      </video>
      
      <div className="relative z-10 flex flex-col w-screen items-center place-content-end h-screen justify-center sm:justify-end sm:pb-30">
        <p className="lilita text-6xl mb-5 sm:mb-0 sm:text-9xl drop-shadow-lg justify-items-center">
          METEORO
        </p>
        <Nav />
      </div>
      </div>
    </>
  );
}

