import React from 'react';
import  { Link } from 'react-router-dom';
import useState  from 'react';
import '../index.css';
export default function Nav() {

  return (
   <>
     <div className='flex flex-col md:flex-row md:space-x-10 text-white text-3xl drop-shadow-lg pb-5 space-y-4 md:space-y-0'>
        <Link to='/meteoritos' className='lilita' >Meteoritos </Link>
        <Link to='/simulaciones' className='lilita'>Simulaciones</Link>
        <Link to='/informacion' className='lilita'> Información   </Link>
    </div>
    </>
  );
}