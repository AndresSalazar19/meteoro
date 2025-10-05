import React from 'react';
import { Link } from 'react-router-dom';
import Nav from '../components/nav';
import '../index.css';

export default function MainLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center pt-5 w-screen">
      <Nav/>
      <main className="flex-1">{children}</main>
      
    </div>
  );
}