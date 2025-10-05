import { Link } from 'react-router-dom';

export default function Home() {      
   return (
    <>
    <div className="relative h-screen w-full overflow-hidden">
      <video
        src="/gifMeteoro.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover">
      </video>
      
      <div className="relative z-10 flex flex-col w-screen items-center place-content-end h-screen justify-center sm:justify-end sm:pb-30">
        <div className="relative z-10 flex flex-col items-center justify-center w-fit h-fit">
          <p className="lilita text-6xl mb-5 sm:mb-0 sm:text-9xl drop-shadow-lg justify-items-center">
            METEORO
          </p>
          <div className="flex flex-col md:flex-row justify-between items-center w-full text-white text-3xl drop-shadow-lg pb-5 space-y-4 md:space-y-0">
            <Link to='/listaMeteoritos' className='lilita'>Meteoritos</Link>
            <Link to='/simulaciones' className='lilita'>Simulaciones</Link>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}